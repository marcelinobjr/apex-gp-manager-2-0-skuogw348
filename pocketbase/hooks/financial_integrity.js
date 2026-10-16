// pocketbase/hooks/financial_integrity.js
// APEX GP Manager 2.0 - QA-GESTAO-05C1 (+05C3): Blindagem financeira e integridade do ledger
// Validações estritas no servidor (pb_hooks), proteção transacional e idempotente (INV-04 / INV-05)
// 05C3: novos endpoints de RESERVA e CONFIRMAÇÃO/LIBERAÇÃO reutilizáveis por P&D e instalações.
// Observação de plataforma: a JSVM executa cada callback em pool separado, então todos os
// helpers ficam declarados DENTRO de cada callback.

// ============================================================
// 1. Guarda de atualização direta em career_state
// ============================================================
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

// ============================================================
// 2. Guarda em car_components
// ============================================================
onRecordCreateRequest((e) => {
  const compType = e.record.get('component_type')
  const isInstalled = e.record.get('is_installed')
  const careerId = e.record.get('career_id')
  const physicalSerial = e.record.get('physical_serial')

  // Se for unidade instalada no cockpit, garantir que não há outra unidade ativa no mesmo carro ou mesma unidade em outro carro
  if (compType === 'engine' && isInstalled) {
    if (physicalSerial) {
      const activeSameSerial = $app.findRecordsByFilter(
        'car_components',
        'career_id = {:careerId} && physical_serial = {:serial} && is_installed = true',
        '',
        1,
        0,
        { careerId: careerId, serial: physicalSerial },
      )
      if (activeSameSerial.length > 0) {
        throw new BadRequestError(
          'Bloqueio Físico/Regulamentar: A unidade ' +
            physicalSerial +
            ' já está instalada em um chassi ativo.',
        )
      }
    }
  }
  e.next()
}, 'car_components')

onRecordUpdateRequest((e) => {
  const compType = e.record.get('component_type')
  const isInstalled = e.record.get('is_installed')
  const carIndex = e.record.get('car_index')
  const careerId = e.record.get('career_id')
  const physicalSerial = e.record.get('physical_serial')
  const seasonYear = e.record.get('season_year') || 2026
  const recordId = e.record.id

  if (compType === 'engine' && isInstalled) {
    // Verificar se outra unidade física com o mesmo serial já está instalada
    if (physicalSerial) {
      const activeSameSerial = $app.findRecordsByFilter(
        'car_components',
        'career_id = {:careerId} && physical_serial = {:serial} && is_installed = true && id != {:recId}',
        '',
        1,
        0,
        { careerId: careerId, serial: physicalSerial, recId: recordId },
      )
      if (activeSameSerial.length > 0) {
        throw new BadRequestError(
          'Bloqueio Físico/Regulamentar: A unidade física ' +
            physicalSerial +
            ' já se encontra instalada em outro carro.',
        )
      }
    }

    // Verificar se já existe outra unidade de motor instalada NO MESMO CARRO na MESMA TEMPORADA
    const activeSameCar = $app.findRecordsByFilter(
      'car_components',
      'career_id = {:careerId} && car_index = {:carIdx} && season_year = {:year} && component_type = "engine" && is_installed = true && id != {:recId}',
      '',
      1,
      0,
      { careerId: careerId, carIdx: carIndex, year: seasonYear, recId: recordId },
    )
    if (activeSameCar.length > 0) {
      throw new BadRequestError(
        'Bloqueio Operacional: O Carro #' +
          carIndex +
          ' já possui uma unidade de potência instalada na temporada ' +
          seasonYear +
          '. Remova a unidade atual antes de instalar outra.',
      )
    }
  }
  e.next()
}, 'car_components')

// ============================================================
// 3. Endpoint financeiro genérico
// Rota: POST /backend/v1/finances/execute-operation
// ============================================================
routerAdd('POST', '/backend/v1/finances/execute-operation', (c) => {
  // 1. Autenticação obrigatória
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

  // 4. Execução transacional atômica
  let updatedStateRecord = null
  let createdReceiptRecord = null

  $app.runInTransaction((txApp) => {
    const career = txApp.findRecordById('careers', careerId)
    if (!career || career.get('user_id') !== userId) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }

    const rulesFrozen = career.get('rules_frozen') || {}
    const frozenBudget = Number(rulesFrozen.financialCapAmount || 135000000)

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

    // Invariante INV-04: Teto regulamentar suficiente
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

// ============================================================
// 4. (05C3) Endpoint de reserva: POST /backend/v1/finances/reserve
// Acumula reserved_cash / reserved_cost_cap com recibo de status RESERVED.
// ============================================================
routerAdd('POST', '/backend/v1/finances/reserve', (c) => {
  // --- helpers (declarados dentro do callback por exigência da JSVM) ---
  function loadState(app, cid) {
    const states = app.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, {
      cid: cid,
    })
    if (states.length === 0) {
      throw new NotFoundError('Estado da carreira (career_state) não encontrado.')
    }
    return states[0]
  }
  function validateOp(state, cost, countsAgainstCostCap) {
    const currentCash = Number(state.get('cash_balance') || 0)
    const currentCapSpent = Number(state.get('cost_cap_spent') || 0)
    const capBudget = Number(state.get('cost_cap_budget') || 135000000)
    const reservedCash = Number(state.get('reserved_cash') || 0)
    const reservedCap = Number(state.get('reserved_cost_cap') || 0)
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
  }

  const authRecord = c.auth
  if (!authRecord) {
    throw new UnauthorizedError('Usuário não autenticado.')
  }
  const userId = authRecord.id
  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const idempotencyKey = body.idempotency_key
  const costCash = Number(body.cost_cash || 0)
  const costCap = Number(body.cost_cap || 0)

  if (!careerId) throw new BadRequestError('career_id é obrigatório.')
  if (!idempotencyKey || idempotencyKey.trim().length < 8) {
    throw new BadRequestError('idempotency_key válida é obrigatória (mínimo 8 caracteres).')
  }
  if (costCash < 0 || costCap < 0) {
    throw new BadRequestError('Valores monetários devem ser não-negativos.')
  }

  const career = $app.findRecordById('careers', careerId)
  if (!career || career.get('user_id') !== userId) {
    throw new ForbiddenError('Acesso não autorizado a esta carreira.')
  }

  // Idempotência: se a chave já existe, não reserva duas vezes
  const existing = $app.findRecordsByFilter(
    'career_receipts',
    'idempotency_key = {:key}',
    '',
    1,
    0,
    { key: idempotencyKey },
  )
  const state = loadState($app, careerId)
  if (existing.length > 0) {
    return c.json(200, {
      success: true,
      already_reserved: true,
      state: state,
      message: 'Reserva já registrada anteriormente.',
    })
  }

  // Validação de caixa (INV-05) e teto (INV-04) considerando reservas vigentes
  validateOp(state, costCash, costCap > 0)

  $app.runInTransaction((txApp) => {
    const st = loadState(txApp, careerId)
    st.set('reserved_cash', Number(st.get('reserved_cash') || 0) + costCash)
    st.set('reserved_cost_cap', Number(st.get('reserved_cost_cap') || 0) + costCap)
    txApp.save(st)
    const receiptsCollection = txApp.findCollectionByNameOrId('career_receipts')
    const receipt = new Record(receiptsCollection)
    receipt.set('career_id', careerId)
    receipt.set('user_id', userId)
    receipt.set('action_type', 'FINANCE_RESERVE')
    receipt.set('idempotency_key', idempotencyKey)
    receipt.set('status', 'RESERVED')
    receipt.set('payload', {
      costCash: costCash,
      costCap: costCap,
      reservedAt: new Date().toISOString(),
    })
    txApp.save(receipt)
  })

  const finalState = loadState($app, careerId)
  return c.json(200, {
    success: true,
    already_reserved: false,
    state: finalState,
    message: 'Reserva registrada (INV-04 / INV-05).',
  })
})

// ============================================================
// 5. (05C3) Endpoint de confirmação/liberação: POST /backend/v1/finances/commit-or-release
// - commit = true : transfere a reserva para despesa efetiva (caixa e teto)
// - commit = false: libera a reserva (cancelamento; despesas já incorridas não são reembolsadas)
// ============================================================
routerAdd('POST', '/backend/v1/finances/commit-or-release', (c) => {
  // --- helpers (declarados dentro do callback por exigência da JSVM) ---
  function loadState(app, cid) {
    const states = app.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, {
      cid: cid,
    })
    if (states.length === 0) {
      throw new NotFoundError('Estado da carreira (career_state) não encontrado.')
    }
    return states[0]
  }

  const authRecord = c.auth
  if (!authRecord) {
    throw new UnauthorizedError('Usuário não autenticado.')
  }
  const userId = authRecord.id
  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const idempotencyKey = body.idempotency_key
  const commit = body.commit !== false // padrão: commit (confirmação)
  const extraPayload = body.extra_payload || {}

  if (!careerId) throw new BadRequestError('career_id é obrigatório.')
  if (!idempotencyKey || idempotencyKey.trim().length < 8) {
    throw new BadRequestError('idempotency_key válida é obrigatória (mínimo 8 caracteres).')
  }

  const career = $app.findRecordById('careers', careerId)
  if (!career || career.get('user_id') !== userId) {
    throw new ForbiddenError('Acesso não autorizado a esta carreira.')
  }

  const receipts = $app.findRecordsByFilter(
    'career_receipts',
    'idempotency_key = {:key}',
    '',
    1,
    0,
    { key: idempotencyKey },
  )
  if (receipts.length === 0) {
    throw new NotFoundError('Reserva correspondente não encontrada: ' + idempotencyKey)
  }
  const reservationReceipt = receipts[0]
  const payload = JSON.parse(reservationReceipt.get('payload') || '{}') || {}
  const costCash = Number(payload.costCash || 0)
  const costCap = Number(payload.costCap || 0)

  let resultState = null
  $app.runInTransaction((txApp) => {
    const state = loadState(txApp, careerId)
    const cash = Number(state.get('cash_balance') || 0)
    const capSpent = Number(state.get('cost_cap_spent') || 0)
    const resCash = Number(state.get('reserved_cash') || 0)
    const resCap = Number(state.get('reserved_cost_cap') || 0)

    if (commit) {
      if (costCash > 0 && cash - resCash < costCash) {
        throw new BadRequestError(
          'Rejeição INV-05: Saldo em caixa insuficiente para confirmar a reserva.',
        )
      }
      state.set('cash_balance', cash - costCash)
      state.set('cost_cap_spent', capSpent + costCap)
    }
    state.set('reserved_cash', Math.max(0, resCash - costCash))
    state.set('reserved_cost_cap', Math.max(0, resCap - costCap))
    txApp.save(state)
    resultState = state

    const receiptsCollection = txApp.findCollectionByNameOrId('career_receipts')
    const receipt = new Record(receiptsCollection)
    receipt.set('career_id', careerId)
    receipt.set('user_id', userId)
    receipt.set('action_type', commit ? 'FINANCE_COMMIT' : 'FINANCE_RELEASE')
    receipt.set('idempotency_key', idempotencyKey + (commit ? '_COMMIT' : '_RELEASE'))
    receipt.set('status', 'EXECUTED')
    receipt.set('payload', {
      reservationKey: idempotencyKey,
      costCash: costCash,
      costCap: costCap,
      released: !commit,
      extraPayload: extraPayload,
      timestamp: new Date().toISOString(),
    })
    txApp.save(receipt)
  })

  return c.json(200, {
    success: true,
    committed: commit,
    state: resultState,
    message: commit ? 'Reserva confirmada como despesa.' : 'Reserva liberada (cancelamento).',
  })
})
