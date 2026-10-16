// pocketbase/hooks/driver_market.js
// APEX GP Manager 2.0 - QA-GESTAO-05C4: Contratos, Mercado de Pilotos, Negociações e IA
// Regras e Invariantes:
// - Validação rigorosa de conflitos: nenhum piloto com 2 contratos titulares vigentes simultaneamente.
// - Contratos futuros suportados (vigência posterior preserva titular atual).
// - Idempotência completa com recibos em career_receipts.
// - Integração financeira transacional via career_state e reservas.
// - Jogador e IA compartilham as mesmas regras estruturais.

// ============================================================================
// 1. Guarda em driver_contracts
// ============================================================================
onRecordCreateRequest((e) => {
  const careerId = e.record.get('career_id')
  const driverId = e.record.get('driver_id')
  const teamId = e.record.get('team_id')
  const role = e.record.get('role')
  const status = e.record.get('contract_status')
  const startSeason = Number(e.record.get('start_season'))
  const endSeason = Number(e.record.get('end_season'))

  if (startSeason > endSeason) {
    throw new BadRequestError('start_season não pode ser superior a end_season.')
  }

  // Se o contrato for ACTIVE ou FUTURE e o papel for titular (PRIMARY_1 ou PRIMARY_2),
  // garantir que o piloto não tem outro contrato incompatível ativo no mesmo período
  if (
    (status === 'ACTIVE' || status === 'FUTURE') &&
    (role === 'PRIMARY_1' || role === 'PRIMARY_2')
  ) {
    const existing = $app.findRecordsByFilter(
      'driver_contracts',
      'career_id = {:careerId} && driver_id = {:driverId} && (contract_status = "ACTIVE" || contract_status = "FUTURE")',
      '',
      20,
      0,
      { careerId: careerId, driverId: driverId },
    )

    for (let i = 0; i < existing.length; i++) {
      const ec = existing[i]
      const ecRole = ec.get('role')
      if (ecRole === 'PRIMARY_1' || ecRole === 'PRIMARY_2') {
        const ecStart = Number(ec.get('start_season'))
        const ecEnd = Number(ec.get('end_season'))
        // Checagem de sobreposição de temporadas
        const overlap = Math.max(startSeason, ecStart) <= Math.min(endSeason, ecEnd)
        if (overlap) {
          throw new BadRequestError(
            'Bloqueio Contratual: O piloto ' +
              driverId +
              ' já possui um contrato titular vigente (' +
              ec.get('team_id') +
              ', ' +
              ecStart +
              '-' +
              ecEnd +
              ') que sobrepõe o período solicitado (' +
              startSeason +
              '-' +
              endSeason +
              ').',
          )
        }
      }
    }
  }

  e.next()
}, 'driver_contracts')

// ============================================================================
// 2. Endpoint de Proposta / Negociação: POST /backend/v1/market/propose
// ============================================================================
routerAdd('POST', '/backend/v1/market/propose', (c) => {
  const authRecord = c.auth
  if (!authRecord) {
    throw new UnauthorizedError('Usuário não autenticado.')
  }
  const userId = authRecord.id

  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const driverId = body.driver_id
  const teamId = body.team_id
  const targetRole = body.target_role || 'PRIMARY_1'
  const targetStartSeason = Number(body.target_start_season)
  const targetDurationYears = Number(body.target_duration_years || 1)
  const offeredSalary = Number(body.offered_salary || 0)
  const offeredBonus = Number(body.offered_bonus || 0)
  const idempotencyKey = body.idempotency_key
  const isAiTeam = body.is_ai_team === true

  if (!careerId || !driverId || !teamId) {
    throw new BadRequestError('career_id, driver_id e team_id são obrigatórios.')
  }
  if (!idempotencyKey || idempotencyKey.trim().length < 8) {
    throw new BadRequestError('idempotency_key válida é obrigatória.')
  }
  if (offeredSalary <= 0) {
    throw new BadRequestError('offered_salary deve ser positivo.')
  }

  // Idempotência
  const existingReceipts = $app.findRecordsByFilter(
    'career_receipts',
    'idempotency_key = {:key}',
    '',
    1,
    0,
    { key: idempotencyKey },
  )
  if (existingReceipts.length > 0) {
    const r = existingReceipts[0]
    return c.json(200, {
      success: true,
      idempotent_replayed: true,
      receipt: r,
      message: 'Proposta já enviada anteriormente (idempotência).',
    })
  }

  // Verificar autorização do usuário na carreira
  const career = $app.findRecordById('careers', careerId)
  if (!career || career.get('user_id') !== userId) {
    throw new ForbiddenError('Acesso negado à carreira.')
  }

  // Carregar estado financeiro da carreira se for a equipe do jogador
  const states = $app.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, {
    cid: careerId,
  })
  if (states.length === 0) {
    throw new NotFoundError('Estado da carreira não encontrado.')
  }
  const state = states[0]
  const currentYear = Number(career.get('current_year') || 2026)

  // Se a proposta é do jogador (managed_team_id), validar teto e caixa
  const isManagedTeam = teamId === career.get('managed_team_id')
  if (isManagedTeam) {
    const cash = Number(state.get('cash_balance') || 0)
    const reservedCash = Number(state.get('reserved_cash') || 0)
    const availableCash = cash - reservedCash

    // O bônus de assinatura precisa de caixa imediato disponível
    if (offeredBonus > 0 && availableCash < offeredBonus) {
      throw new BadRequestError(
        'Saldo em caixa insuficiente para o bônus de assinatura de $' +
          (offeredBonus / 1000000).toFixed(2) +
          'M.',
      )
    }

    // Se o contrato começa na temporada atual, o salário impacta o teto atual
    if (targetStartSeason === currentYear) {
      const capBudget = Number(state.get('cost_cap_budget') || 135000000)
      const capSpent = Number(state.get('cost_cap_spent') || 0)
      const reservedCap = Number(state.get('reserved_cost_cap') || 0)
      const remainingCap = capBudget - (capSpent + reservedCap)

      if (offeredSalary > remainingCap) {
        throw new BadRequestError(
          'O salário oferecido ($' +
            (offeredSalary / 1000000).toFixed(2) +
            'M) excede a margem regulamentar no teto de gastos ($' +
            (remainingCap / 1000000).toFixed(2) +
            'M).',
        )
      }
    }
  }

  // Avaliação da proposta pelo piloto (Motor de Decisão do Piloto)
  // Pilotos exigem salário compatível e avaliam status da equipe
  // Regra base: pilotos têm expectativa salarial de mercado
  // Se oferecido >= expectativa: ACEITA
  // Se oferecido entre 80% e 100%: CONTRA-PROPOSTA
  // Se oferecido < 80%: REJEITA
  // Para fins determinísticos, a expectativa pode vir do payload ou ser estimada
  const expectedSalary = Number(body.expected_salary || offeredSalary)
  let status = 'IN_PROGRESS'
  let responseMsg = ''
  let counterSalary = 0
  let counterBonus = 0

  if (offeredSalary >= expectedSalary * 0.95) {
    status = 'ACCEPTED'
    responseMsg = 'O piloto aceitou os termos apresentados pela equipe.'
  } else if (offeredSalary >= expectedSalary * 0.75) {
    status = 'COUNTER_OFFER'
    counterSalary = Math.round(expectedSalary * 1.05)
    counterBonus = Math.round(offeredBonus * 1.2)
    responseMsg = 'O piloto considera a vaga interessante, mas exige termos financeiros superiores.'
  } else {
    status = 'REJECTED'
    responseMsg = 'A proposta salarial foi considerada insultante e abaixo dos padrões de mercado.'
  }

  let createdNegRecord = null
  let createdReceipt = null

  $app.runInTransaction((txApp) => {
    // 1. Criar registro em driver_negotiations
    const negCol = txApp.findCollectionByNameOrId('driver_negotiations')
    const neg = new Record(negCol)
    neg.set('career_id', careerId)
    neg.set('user_id', userId)
    neg.set('driver_id', driverId)
    neg.set('team_id', teamId)
    neg.set('season_year', currentYear)
    neg.set('target_role', targetRole)
    neg.set('target_start_season', targetStartSeason)
    neg.set('target_duration_years', targetDurationYears)
    neg.set('offered_salary', offeredSalary)
    neg.set('offered_bonus', offeredBonus)
    neg.set('status', status)
    neg.set('round_number', Number(body.round_number || 1))
    neg.set('driver_response_message', responseMsg)
    neg.set('counter_salary', counterSalary)
    neg.set('counter_bonus', counterBonus)
    neg.set('is_ai_team', isAiTeam)
    neg.set('history', [
      {
        round: Number(body.round_number || 1),
        offeredSalary: offeredSalary,
        offeredBonus: offeredBonus,
        status: status,
        message: responseMsg,
        timestamp: new Date().toISOString(),
      },
    ])
    txApp.save(neg)
    createdNegRecord = neg

    // 2. Se a proposta for aceita imediatamente e houver bônus de assinatura para equipe do jogador, reservar valor
    if (status === 'ACCEPTED' && offeredBonus > 0 && isManagedTeam) {
      const st = txApp.findRecordById('career_state', state.id)
      st.set('reserved_cash', Number(st.get('reserved_cash') || 0) + offeredBonus)
      txApp.save(st)
    }

    // 3. Recibo de idempotência
    const rcCol = txApp.findCollectionByNameOrId('career_receipts')
    const rc = new Record(rcCol)
    rc.set('career_id', careerId)
    rc.set('user_id', userId)
    rc.set('action_type', 'DRIVER_PROPOSAL_SUBMITTED')
    rc.set('idempotency_key', idempotencyKey)
    rc.set('status', 'EXECUTED')
    rc.set('payload', {
      negotiationId: neg.id,
      driverId: driverId,
      teamId: teamId,
      status: status,
      offeredSalary: offeredSalary,
      offeredBonus: offeredBonus,
      targetStartSeason: targetStartSeason,
      timestamp: new Date().toISOString(),
    })
    txApp.save(rc)
    createdReceipt = rc
  })

  return c.json(200, {
    success: true,
    idempotent_replayed: false,
    negotiation: createdNegRecord,
    receipt: createdReceipt,
    status: status,
    driver_response: responseMsg,
    counter_salary: counterSalary,
    counter_bonus: counterBonus,
  })
})

// ============================================================================
// 3. Endpoint de Assinatura Definitiva de Contrato: POST /backend/v1/market/sign
// ============================================================================
routerAdd('POST', '/backend/v1/market/sign', (c) => {
  const authRecord = c.auth
  if (!authRecord) {
    throw new UnauthorizedError('Usuário não autenticado.')
  }
  const userId = authRecord.id

  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const driverId = body.driver_id
  const teamId = body.team_id
  const role = body.role || 'PRIMARY_1'
  const startSeason = Number(body.start_season)
  const durationYears = Number(body.duration_years || 1)
  const salaryAnnual = Number(body.salary_annual)
  const signingBonus = Number(body.signing_bonus || 0)
  const buyoutClause = Number(body.buyout_clause || Math.round(salaryAnnual * 0.5))
  const idempotencyKey = body.idempotency_key
  const source = body.source || 'PLAYER_SIGNING'

  if (!careerId || !driverId || !teamId || !startSeason || !salaryAnnual) {
    throw new BadRequestError('Parâmetros obrigatórios ausentes.')
  }
  if (!idempotencyKey || idempotencyKey.trim().length < 8) {
    throw new BadRequestError('idempotency_key válida é obrigatória.')
  }

  // Idempotência
  const existingReceipts = $app.findRecordsByFilter(
    'career_receipts',
    'idempotency_key = {:key}',
    '',
    1,
    0,
    { key: idempotencyKey },
  )
  if (existingReceipts.length > 0) {
    const rc = existingReceipts[0]
    return c.json(200, {
      success: true,
      idempotent_replayed: true,
      receipt: rc,
      message: 'Contrato já assinado e formalizado (idempotência).',
    })
  }

  const career = $app.findRecordById('careers', careerId)
  if (!career || career.get('user_id') !== userId) {
    throw new ForbiddenError('Acesso não autorizado.')
  }

  const currentYear = Number(career.get('current_year') || 2026)
  const endSeason = startSeason + durationYears - 1

  // Determinar status do contrato: se startSeason == currentYear -> ACTIVE; se > currentYear -> FUTURE
  const contractStatus = startSeason > currentYear ? 'FUTURE' : 'ACTIVE'

  // Verificar se piloto já possui contrato ativo conflitante para as mesmas temporadas
  if (role === 'PRIMARY_1' || role === 'PRIMARY_2') {
    const activeContracts = $app.findRecordsByFilter(
      'driver_contracts',
      'career_id = {:careerId} && driver_id = {:driverId} && (contract_status = "ACTIVE" || contract_status = "FUTURE")',
      '',
      10,
      0,
      { careerId: careerId, driverId: driverId },
    )
    for (let i = 0; i < activeContracts.length; i++) {
      const ac = activeContracts[i]
      const acRole = ac.get('role')
      if (acRole === 'PRIMARY_1' || acRole === 'PRIMARY_2') {
        const acStart = Number(ac.get('start_season'))
        const acEnd = Number(ac.get('end_season'))
        const overlap = Math.max(startSeason, acStart) <= Math.min(endSeason, acEnd)
        if (overlap) {
          throw new BadRequestError(
            'Conflito Contratual: O piloto ' +
              driverId +
              ' já possui vínculo com ' +
              ac.get('team_id') +
              ' no período ' +
              acStart +
              '-' +
              acEnd +
              '. Rescinda o contrato anterior ou assine para período futuro.',
          )
        }
      }
    }
  }

  let createdContractRecord = null
  let updatedStateRecord = null
  let createdReceiptRecord = null

  $app.runInTransaction((txApp) => {
    // 1. Criar novo registro de contrato canônico
    const contractsCol = txApp.findCollectionByNameOrId('driver_contracts')
    const contract = new Record(contractsCol)
    contract.set('career_id', careerId)
    contract.set('user_id', userId)
    contract.set('driver_id', driverId)
    contract.set('team_id', teamId)
    contract.set('role', role)
    contract.set('start_season', startSeason)
    contract.set('end_season', endSeason)
    contract.set('salary_annual', salaryAnnual)
    contract.set('signing_bonus', signingBonus)
    contract.set('buyout_clause', buyoutClause)
    contract.set('contract_status', contractStatus)
    contract.set('source', source)
    contract.set('signed_at', new Date().toISOString())
    txApp.save(contract)
    createdContractRecord = contract

    // 2. Se for equipe gerenciada e o contrato for ACTIVE (para a temporada atual):
    // debitar o signing_bonus do caixa e atualizar contracts_ledger em career_state
    const isManagedTeam = teamId === career.get('managed_team_id')
    if (isManagedTeam) {
      const states = txApp.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, {
        cid: careerId,
      })
      if (states.length > 0) {
        const st = states[0]
        const cash = Number(st.get('cash_balance') || 0)
        const currentCapSpent = Number(st.get('cost_cap_spent') || 0)

        // Se houver bônus de assinatura, debita imediatamente do caixa
        if (signingBonus > 0) {
          if (cash < signingBonus) {
            throw new BadRequestError('Saldo em caixa insuficiente para o bônus de assinatura.')
          }
          st.set('cash_balance', cash - signingBonus)
          // Signing bonus conta no teto da temporada corrente
          st.set('cost_cap_spent', currentCapSpent + signingBonus)
        }

        // Se o contrato for ACTIVE (temporada corrente), atualiza o slot no contracts_ledger
        if (contractStatus === 'ACTIVE') {
          let ledger = {}
          try {
            ledger = JSON.parse(st.getString('contracts_ledger')) || {}
          } catch (_) {
            ledger = {}
          }
          const slot = role === 'PRIMARY_2' ? 'driver2' : 'driver1'
          ledger[slot] = {
            driverId: driverId,
            salaryAnnual: salaryAnnual,
            durationYears: durationYears,
          }
          st.set('contracts_ledger', ledger)
        }

        txApp.save(st)
        updatedStateRecord = st
      }
    }

    // 3. Atualizar ou criar driver_career_records para manter o estado esportivo do piloto
    const dcrRecords = txApp.findRecordsByFilter(
      'driver_career_records',
      'career_id = {:careerId} && driver_id = {:driverId}',
      '',
      1,
      0,
      { careerId: careerId, driverId: driverId },
    )
    let dcr = null
    const dcrCol = txApp.findCollectionByNameOrId('driver_career_records')
    if (dcrRecords.length > 0) {
      dcr = dcrRecords[0]
    } else {
      dcr = new Record(dcrCol)
      dcr.set('career_id', careerId)
      dcr.set('user_id', userId)
      dcr.set('driver_id', driverId)
      dcr.set('morale', 80)
      dcr.set('reputation', 75)
      dcr.set('career_history', [])
    }

    if (contractStatus === 'ACTIVE') {
      dcr.set('current_team_id', teamId)
      dcr.set('current_role', role)
      dcr.set('active_contract_id', contract.id)
      dcr.set('market_status', 'CONTRACTED')
    } else if (contractStatus === 'FUTURE') {
      dcr.set('future_contract_id', contract.id)
      dcr.set('market_status', 'FUTURE_COMMITTED')
    }

    let hist = []
    try {
      hist = JSON.parse(dcr.getString('career_history')) || []
    } catch (_) {
      hist = []
    }
    hist.push({
      action: contractStatus === 'FUTURE' ? 'SIGNED_FUTURE_CONTRACT' : 'SIGNED_CONTRACT',
      teamId: teamId,
      role: role,
      startSeason: startSeason,
      endSeason: endSeason,
      salaryAnnual: salaryAnnual,
      timestamp: new Date().toISOString(),
    })
    dcr.set('career_history', hist)
    txApp.save(dcr)

    // 4. Recibo de idempotência
    const rcCol = txApp.findCollectionByNameOrId('career_receipts')
    const rc = new Record(rcCol)
    rc.set('career_id', careerId)
    rc.set('user_id', userId)
    rc.set('action_type', 'DRIVER_CONTRACT_SIGNED')
    rc.set('idempotency_key', idempotencyKey)
    rc.set('status', 'EXECUTED')
    rc.set('payload', {
      contractId: contract.id,
      driverId: driverId,
      teamId: teamId,
      role: role,
      contractStatus: contractStatus,
      startSeason: startSeason,
      endSeason: endSeason,
      salaryAnnual: salaryAnnual,
      signingBonus: signingBonus,
      timestamp: new Date().toISOString(),
    })
    txApp.save(rc)
    createdReceiptRecord = rc
  })

  return c.json(200, {
    success: true,
    idempotent_replayed: false,
    contract: createdContractRecord,
    state: updatedStateRecord,
    receipt: createdReceiptRecord,
    message:
      contractStatus === 'FUTURE'
        ? 'Contrato futuro firmado com sucesso (vínculo iniciará na temporada ' + startSeason + ').'
        : 'Contrato ativo firmado com sucesso.',
  })
})

// ============================================================================
// 4. Endpoint de Rescisão de Contrato: POST /backend/v1/market/terminate
// ============================================================================
routerAdd('POST', '/backend/v1/market/terminate', (c) => {
  const authRecord = c.auth
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id

  const body = c.requestInfo().body || {}
  const contractId = body.contract_id
  const reason = body.reason || 'MUTUAL_AGREEMENT'
  const idempotencyKey = body.idempotency_key

  if (!contractId || !idempotencyKey) {
    throw new BadRequestError('contract_id e idempotency_key são obrigatórios.')
  }

  // Idempotência
  const existing = $app.findRecordsByFilter(
    'career_receipts',
    'idempotency_key = {:key}',
    '',
    1,
    0,
    { key: idempotencyKey },
  )
  if (existing.length > 0) {
    return c.json(200, {
      success: true,
      idempotent_replayed: true,
      message: 'Rescisão já processada.',
    })
  }

  const contract = $app.findRecordById('driver_contracts', contractId)
  if (!contract || contract.get('user_id') !== userId) {
    throw new ForbiddenError('Acesso não autorizado ao contrato.')
  }

  const careerId = contract.get('career_id')
  const driverId = contract.get('driver_id')
  const teamId = contract.get('team_id')
  const buyout = Number(contract.get('buyout_clause') || 0)

  $app.runInTransaction((txApp) => {
    // Atualizar status do contrato para TERMINATED (preservando histórico integralmente)
    contract.set('contract_status', 'TERMINATED')
    contract.set('terminated_at', new Date().toISOString())
    contract.set('termination_reason', reason)
    txApp.save(contract)

    // Se for equipe do jogador, pagar multa rescisória (se aplicável)
    const career = txApp.findRecordById('careers', careerId)
    if (career && career.get('managed_team_id') === teamId && buyout > 0) {
      const states = txApp.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, {
        cid: careerId,
      })
      if (states.length > 0) {
        const st = states[0]
        const cash = Number(st.get('cash_balance') || 0)
        if (cash < buyout) {
          throw new BadRequestError(
            'Saldo insuficiente para pagar a multa rescisória de $' +
              (buyout / 1000000).toFixed(2) +
              'M.',
          )
        }
        st.set('cash_balance', cash - buyout)
        txApp.save(st)
      }
    }

    // Atualizar driver_career_records para FREE_AGENT
    const dcrList = txApp.findRecordsByFilter(
      'driver_career_records',
      'career_id = {:cid} && driver_id = {:did}',
      '',
      1,
      0,
      { cid: careerId, did: driverId },
    )
    if (dcrList.length > 0) {
      const dcr = dcrList[0]
      if (dcr.get('active_contract_id') === contractId) {
        dcr.set('current_team_id', '')
        dcr.set('current_role', '')
        dcr.set('active_contract_id', '')
        dcr.set('market_status', 'FREE_AGENT')
      } else if (dcr.get('future_contract_id') === contractId) {
        dcr.set('future_contract_id', '')
      }
      txApp.save(dcr)
    }

    // Recibo
    const rcCol = txApp.findCollectionByNameOrId('career_receipts')
    const rc = new Record(rcCol)
    rc.set('career_id', careerId)
    rc.set('user_id', userId)
    rc.set('action_type', 'DRIVER_CONTRACT_TERMINATED')
    rc.set('idempotency_key', idempotencyKey)
    rc.set('status', 'EXECUTED')
    rc.set('payload', {
      contractId: contractId,
      driverId: driverId,
      teamId: teamId,
      buyoutPaid: buyout,
      reason: reason,
      timestamp: new Date().toISOString(),
    })
    txApp.save(rc)
  })

  return c.json(200, {
    success: true,
    message: 'Contrato rescindido com sucesso. Histórico preservado.',
  })
})

// ============================================================================
// 5. Endpoint de Virada de Temporada para Pilotos: POST /backend/v1/market/apply-season-transition
// Converte contratos FUTURE da nova temporada em ACTIVE e encerra contratos expirados.
// Idempotente via career_receipts.
// ============================================================================
routerAdd('POST', '/backend/v1/market/apply-season-transition', (c) => {
  const authRecord = c.auth
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id

  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const targetYear = Number(body.target_year)
  const idempotencyKey = body.idempotency_key

  if (!careerId || !targetYear || !idempotencyKey) {
    throw new BadRequestError('career_id, target_year e idempotency_key são obrigatórios.')
  }

  // Idempotência
  const existing = $app.findRecordsByFilter(
    'career_receipts',
    'idempotency_key = {:key}',
    '',
    1,
    0,
    { key: idempotencyKey },
  )
  if (existing.length > 0) {
    return c.json(200, {
      success: true,
      idempotent_replayed: true,
      message: 'Transição contratual já processada para este ano.',
    })
  }

  let activatedCount = 0
  let expiredCount = 0

  $app.runInTransaction((txApp) => {
    // 1. Encerrar contratos com end_season < targetYear que ainda estejam ACTIVE -> EXPIRED
    const activeList = txApp.findRecordsByFilter(
      'driver_contracts',
      'career_id = {:cid} && contract_status = "ACTIVE"',
      '',
      200,
      0,
      { cid: careerId },
    )
    for (let i = 0; i < activeList.length; i++) {
      const ac = activeList[i]
      const endYear = Number(ac.get('end_season'))
      if (endYear < targetYear) {
        ac.set('contract_status', 'EXPIRED')
        txApp.save(ac)
        expiredCount++

        // Liberar status no dcr
        const did = ac.get('driver_id')
        const dcrs = txApp.findRecordsByFilter(
          'driver_career_records',
          'career_id = {:cid} && driver_id = {:did}',
          '',
          1,
          0,
          { cid: careerId, did: did },
        )
        if (dcrs.length > 0) {
          const dcr = dcrs[0]
          if (dcr.get('active_contract_id') === ac.id) {
            dcr.set('current_team_id', '')
            dcr.set('current_role', '')
            dcr.set('active_contract_id', '')
            dcr.set('market_status', 'FREE_AGENT')
            txApp.save(dcr)
          }
        }
      }
    }

    // 2. Ativar contratos FUTURE que iniciam em targetYear -> ACTIVE
    const futureList = txApp.findRecordsByFilter(
      'driver_contracts',
      'career_id = {:cid} && contract_status = "FUTURE" && start_season <= {:tyear}',
      '',
      100,
      0,
      { cid: careerId, tyear: targetYear },
    )
    for (let j = 0; j < futureList.length; j++) {
      const fc = futureList[j]
      fc.set('contract_status', 'ACTIVE')
      txApp.save(fc)
      activatedCount++

      const did = fc.get('driver_id')
      const dcrs = txApp.findRecordsByFilter(
        'driver_career_records',
        'career_id = {:cid} && driver_id = {:did}',
        '',
        1,
        0,
        { cid: careerId, did: did },
      )
      if (dcrs.length > 0) {
        const dcr = dcrs[0]
        dcr.set('current_team_id', fc.get('team_id'))
        dcr.set('current_role', fc.get('role'))
        dcr.set('active_contract_id', fc.id)
        dcr.set('future_contract_id', '')
        dcr.set('market_status', 'CONTRACTED')
        txApp.save(dcr)
      }
    }

    // Recibo
    const rcCol = txApp.findCollectionByNameOrId('career_receipts')
    const rc = new Record(rcCol)
    rc.set('career_id', careerId)
    rc.set('user_id', userId)
    rc.set('action_type', 'DRIVER_SEASON_TRANSITION_APPLIED')
    rc.set('idempotency_key', idempotencyKey)
    rc.set('status', 'EXECUTED')
    rc.set('payload', {
      targetYear: targetYear,
      activatedCount: activatedCount,
      expiredCount: expiredCount,
      timestamp: new Date().toISOString(),
    })
    txApp.save(rc)
  })

  return c.json(200, {
    success: true,
    activated_contracts: activatedCount,
    expired_contracts: expiredCount,
    message: 'Transição de contratos concluída com sucesso.',
  })
})
