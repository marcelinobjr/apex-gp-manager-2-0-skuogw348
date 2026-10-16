// pocketbase/hooks/financial_integrity.js
// APEX GP Manager 2.0 - QA-GESTAO-05C1: Blindagem financeira e integridade do ledger
// Validações estritas no servidor (pb_hooks), proteção transacional e idempotente (INV-04 / INV-05)

// 1. Hook de validação em career_state antes de update
// Impede atualização direta pelo cliente de valores negativos ou estouros de teto
onRecordUpdate((e) => {
  const cashBalance = e.record.get('cash_balance')
  const costCapSpent = e.record.get('cost_cap_spent')
  const costCapBudget = e.record.get('cost_cap_budget')
  const reservedCash = e.record.get('reserved_cash') || 0
  const reservedCostCap = e.record.get('reserved_cost_cap') || 0

  // Invariante INV-05: Caixa real não pode ser negativo
  if (cashBalance < 0) {
    throw new BadRequestError('Bloqueio INV-05 (Servidor): Saldo em caixa não pode ser negativo.')
  }

  // Invariante INV-05 com compromissos reservados
  if (cashBalance - reservedCash < 0) {
    throw new BadRequestError(
      'Bloqueio INV-05 (Servidor): Saldo em caixa insuficiente considerando os compromissos reservados.',
    )
  }

  // Invariante INV-04: Teto regulamentar não pode ser ultrapassado
  if (costCapSpent > costCapBudget) {
    throw new BadRequestError(
      'Bloqueio INV-04 (Servidor): Gastos ultrapassam o teto regulamentar anual (' +
        costCapBudget +
        ').',
    )
  }

  // Invariante INV-04 com reservas
  if (costCapSpent + reservedCostCap > costCapBudget) {
    throw new BadRequestError(
      'Bloqueio INV-04 (Servidor): Teto regulamentar anual insuficiente considerando as reservas vigentes.',
    )
  }

  e.next()
}, 'career_state')

// 2. Endpoint transacional seguro e idempotente para operações financeiras no servidor
// Rota: POST /backend/v1/finances/execute-operation
// Executa validação de caixa e teto dentro de uma transação com bloqueio de concorrência e chave de idempotência.
routerAdd('POST', '/backend/v1/finances/execute-operation', (c) => {
  // 1. Autenticação obrigatória: No PocketBase v0.23+, auth record fica em c.auth
  const authRecord = c.auth
  if (!authRecord) {
    throw new UnauthorizedError('Usuário não autenticado.')
  }
  const userId = authRecord.id

  // 2. Parse do body
  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const idempotencyKey = body.idempotency_key
  const actionType = body.action_type || 'FINANCIAL_OPERATION'
  const cost = Number(body.cost || 0)
  const income = Number(body.income || 0)
  const countsAgainstCostCap = body.counts_against_cost_cap !== false // padrão: conta no teto
  const description = body.description || ''
  const metadata = body.metadata || {}

  if (!careerId) {
    throw new BadRequestError('career_id é obrigatório.')
  }
  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8) {
    throw new BadRequestError('idempotency_key válida é obrigatória (mínimo 8 caracteres).')
  }
  if (cost < 0 || income < 0) {
    throw new BadRequestError('Valores monetários devem ser não-negativos.')
  }

  // 3. Verificação de idempotência no ledger de recibos canônicos
  const existingReceipts = $app.findRecordsByFilter(
    'career_receipts',
    'idempotency_key = {:key}',
    '-created',
    1,
    0,
    { key: idempotencyKey },
  )

  if (existingReceipts.length > 0) {
    const receipt = existingReceipts[0]
    // Se já executada, retorna o estado financeiro atual sem reexecutar (idempotência pura)
    const stateList = $app.findRecordsByFilter(
      'career_state',
      'career_id = {:careerId}',
      '',
      1,
      0,
      { careerId: careerId },
    )
    const currentState = stateList.length > 0 ? stateList[0] : null
    return c.json(200, {
      success: true,
      idempotent_replayed: true,
      receipt: receipt,
      state: currentState,
      message: 'Operação já processada anteriormente (idempotência confirmada).',
    })
  }

  // 4. Execução transacional atômica com $app.runInTransaction
  let updatedStateRecord = null
  let createdReceiptRecord = null

  $app.runInTransaction((txApp) => {
    // Obter o registro da carreira e verificar posse
    const career = txApp.findRecordById('careers', careerId)
    if (!career || career.get('user_id') !== userId) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }

    // Snapshot congelado do regulamento
    const rulesFrozen = career.get('rules_frozen') || {}
    const frozenBudget = Number(rulesFrozen.financialCapAmount || 135000000)

    // Obter estado financeiro atual
    const states = txApp.findRecordsByFilter('career_state', 'career_id = {:careerId}', '', 1, 0, {
      careerId: careerId,
    })
    if (states.length === 0) {
      throw new NotFoundError('Estado da carreira (career_state) não encontrado.')
    }

    const state = states[0]
    const currentCash = Number(state.get('cash_balance') || 0)
    const currentCapSpent = Number(state.get('cost_cap_spent') || 0)
    const capBudget = Number(state.get('cost_cap_budget') || frozenBudget)
    const reservedCash = Number(state.get('reserved_cash') || 0)
    const reservedCap = Number(state.get('reserved_cost_cap') || 0)

    // Invariante INV-05: Saldo em caixa suficiente
    const effectiveAvailableCash = currentCash - reservedCash
    if (cost > 0 && effectiveAvailableCash < cost) {
      throw new BadRequestError(
        'Rejeição INV-05: Saldo em caixa insuficiente. Requer $' +
          (cost / 1000000).toFixed(2) +
          'M, disponível $' +
          (effectiveAvailableCash / 1000000).toFixed(2) +
          'M (após reservas de $' +
          (reservedCash / 1000000).toFixed(2) +
          'M).',
      )
    }

    // Invariante INV-04: Teto regulamentar suficiente (se a operação computa no teto)
    if (countsAgainstCostCap && cost > 0) {
      const remainingCap = capBudget - (currentCapSpent + reservedCap)
      if (cost > remainingCap) {
        throw new BadRequestError(
          'Rejeição INV-04: Operação excede o teto regulamentar anual. Custo: $' +
            (cost / 1000000).toFixed(2) +
            'M, margem no teto: $' +
            (remainingCap / 1000000).toFixed(2) +
            'M (teto: $' +
            (capBudget / 1000000).toFixed(0) +
            'M, gasto acumulado: $' +
            (currentCapSpent / 1000000).toFixed(2) +
            'M).',
        )
      }
    }

    // Atualizar o estado financeiro:
    // Receitas aumentam caixa, mas NUNCA aumentam o teto regulamentar anual
    const newCash = currentCash - cost + income
    const newCapSpent = countsAgainstCostCap ? currentCapSpent + cost : currentCapSpent

    state.set('cash_balance', newCash)
    state.set('cost_cap_spent', newCapSpent)
    txApp.save(state)
    updatedStateRecord = state

    // Gravar recibo canônico imutável em career_receipts
    const receiptsCollection = txApp.findCollectionByNameOrId('career_receipts')
    const receipt = new Record(receiptsCollection)
    receipt.set('career_id', careerId)
    receipt.set('user_id', userId)
    receipt.set('action_type', actionType)
    receipt.set('idempotency_key', idempotencyKey)
    receipt.set('status', 'EXECUTED')
    receipt.set('payload', {
      actionType: actionType,
      description: description,
      cost: cost,
      income: income,
      countsAgainstCostCap: countsAgainstCostCap,
      previousCash: currentCash,
      newCash: newCash,
      previousCapSpent: currentCapSpent,
      newCapSpent: newCapSpent,
      capBudget: capBudget,
      metadata: metadata,
      executedAt: new Date().toISOString(),
    })
    txApp.save(receipt)
    createdReceiptRecord = receipt
  })

  return c.json(200, {
    success: true,
    idempotent_replayed: false,
    receipt: createdReceiptRecord,
    state: updatedStateRecord,
    message: 'Operação financeira validada e executada com sucesso.',
  })
})
