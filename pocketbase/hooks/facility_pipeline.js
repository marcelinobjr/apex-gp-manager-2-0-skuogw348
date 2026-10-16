// pocketbase/hooks/facility_pipeline.js
// APEX GP Manager 2.0 - QA-GESTAO-05C3 (v0.0.18)
// Progressão das 9 instalações: nível 1..5, custos progressivos, INV-04 / INV-05,
// prazo de melhoria, capacidade operacional, sem upgrades duplicados, com histórico.
//
// Matriz de consumidores (cada efeito aponta para o serviço que o consome):
//   design_center        -> rd_pipeline (qualidade/precisão de projetos)
//   cfd_cluster          -> rd_pipeline (capacidade de desenvolvimento aerodinâmico)
//   wind_tunnel          -> rd_pipeline (validação/ensaio de aerodinâmica)
//   industrial_structure -> rd_pipeline (fabricação: logística e produtividade)
//   factory              -> rd_pipeline (capacidade/tempo/qualidade de fabricação)
//   operations_center    -> rd_pipeline (planejamento e eficiência estratégica)
//   pit_stop_center      -> Race Engine (PENDENTE DE INTEGRAÇÃO)
//   simulator            -> Race Engine / Academia (PENDENTE DE INTEGRAÇÃO)
//   driver_academy       -> módulo futuro da Academia (PENDENTE DE INTEGRAÇÃO)
//
// Observação de plataforma: a JSVM executa cada callback em pool separado — todos os
// helpers e tabelas estão declarados DENTRO de cada callback.

// ============================================================
// POST /backend/v1/facilities/upgrade — RESERVA o upgrade (obra CONSTRUCTION)
// ============================================================
routerAdd('POST', '/backend/v1/facilities/upgrade', (c) => {
  // --- tabelas e helpers (dentro do callback por exigência da JSVM) ---
  const FACILITY_META = {
    design_center: {
      name: 'Centro de Design',
      consumer: 'rd_pipeline',
      consumerLabel: 'Qualidade e precisão dos projetos de P&D',
      pendingIntegration: false,
      effect:
        'Cada nível reduz a chance de falha dos projetos e melhora a nota mínima do resultado.',
    },
    cfd_cluster: {
      name: 'Cluster de CFD',
      consumer: 'rd_pipeline',
      consumerLabel: 'Capacidade de desenvolvimento aerodinâmico (projetos simultâneos)',
      pendingIntegration: false,
      effect: 'Cada nível adiciona 1 slot de pesquisa aerodinâmica simultânea.',
    },
    wind_tunnel: {
      name: 'Túnel de Vento',
      consumer: 'rd_pipeline',
      consumerLabel: 'Ensaios e validação de aerodinâmica',
      pendingIntegration: false,
      effect: 'Cada nível adiciona 1 slot de pesquisa (aero/pneus) e melhora a nota do resultado.',
    },
    industrial_structure: {
      name: 'Estrutura Industrial',
      consumer: 'rd_pipeline',
      consumerLabel: 'Logística, fornecimento e produtividade de fabricação',
      pendingIntegration: false,
      effect: 'Cada nível adiciona 1 slot de fabricação simultânea.',
    },
    factory: {
      name: 'Fábrica',
      consumer: 'rd_pipeline',
      consumerLabel: 'Capacidade, tempo e qualidade de fabricação',
      pendingIntegration: false,
      effect:
        'Cada nível adiciona 1 slot de fabricação simultânea e melhora a condição inicial da peça.',
    },
    operations_center: {
      name: 'Centro de Operações',
      consumer: 'rd_pipeline',
      consumerLabel: 'Planejamento e eficiência estratégica (cronograma de P&D)',
      pendingIntegration: false,
      effect: 'Cada nível reduz em 1 rodada a duração de um projeto novo (mínimo 1).',
    },
    pit_stop_center: {
      name: 'Centro de Pit-Stop',
      consumer: 'race_engine',
      consumerLabel: 'Qualidade e confiabilidade dos pit-stops',
      pendingIntegration: true,
      effect:
        'CONTRATO DE INTEGRAÇÃO: o Race Engine lerá o nível para calibrar tempo/risco de pit-stop.',
    },
    simulator: {
      name: 'Simulador',
      consumer: 'race_engine',
      consumerLabel: 'Preparação de pilotos e qualidade de acerto de setup',
      pendingIntegration: true,
      effect:
        'CONTRATO DE INTEGRAÇÃO: o Race Engine lerá o nível para bônus de acerto de setup e preparação.',
    },
    driver_academy: {
      name: 'Academia de Pilotos',
      consumer: 'driver_academy_module',
      consumerLabel: 'Formação, treinamento e evolução de talentos',
      pendingIntegration: true,
      effect:
        'CONTRATO DE INTEGRAÇÃO: o futuro módulo da Academia lerá o nível para evolução de talentos.',
    },
  }
  const UPGRADE_COST = {
    2: { cash: 4000000, cap: 4000000, rounds: 2 },
    3: { cash: 8000000, cap: 8000000, rounds: 3 },
    4: { cash: 15000000, cap: 15000000, rounds: 4 },
    5: { cash: 25000000, cap: 25000000, rounds: 5 },
  }

  function loadCareer(app, cid, uid) {
    const career = app.findRecordById('careers', cid)
    if (!career || career.get('user_id') !== uid) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }
    return career
  }
  function loadState(app, cid) {
    const states = app.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, {
      cid: cid,
    })
    if (states.length === 0) {
      throw new NotFoundError('Estado da carreira (career_state) não encontrado.')
    }
    return states[0]
  }
  function reserveFunds(app, cid, uid, key, costCash, costCap) {
    function ls(a, ccid) {
      const s = a.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, { cid: ccid })
      if (s.length === 0)
        throw new NotFoundError('Estado da carreira (career_state) não encontrado.')
      return s[0]
    }
    const existing = app.findRecordsByFilter(
      'career_receipts',
      'idempotency_key = {:k}',
      '',
      1,
      0,
      { k: key },
    )
    const st = ls(app, cid)
    if (existing.length > 0) return st
    const cash = Number(st.get('cash_balance') || 0)
    const capSpent = Number(st.get('cost_cap_spent') || 0)
    const capBudget = Number(st.get('cost_cap_budget') || 135000000)
    const resCash = Number(st.get('reserved_cash') || 0)
    const resCap = Number(st.get('reserved_cost_cap') || 0)
    if (costCash > 0 && cash - resCash < costCash) {
      throw new BadRequestError('Rejeição INV-05: Saldo em caixa insuficiente (após reservas).')
    }
    if (costCap > 0 && capBudget - (capSpent + resCap) < costCap) {
      throw new BadRequestError(
        'Rejeição INV-04: Teto regulamentar anual insuficiente (após reservas).',
      )
    }
    app.runInTransaction(function (txApp) {
      const s2 = ls(txApp, cid)
      s2.set('reserved_cash', Number(s2.get('reserved_cash') || 0) + costCash)
      s2.set('reserved_cost_cap', Number(s2.get('reserved_cost_cap') || 0) + costCap)
      txApp.save(s2)
      const receiptsCollection = txApp.findCollectionByNameOrId('career_receipts')
      const receipt = new Record(receiptsCollection)
      receipt.set('career_id', cid)
      receipt.set('user_id', uid)
      receipt.set('action_type', 'FINANCE_RESERVE')
      receipt.set('idempotency_key', key)
      receipt.set('status', 'RESERVED')
      receipt.set('payload', {
        costCash: costCash,
        costCap: costCap,
        reservedAt: new Date().toISOString(),
      })
      txApp.save(receipt)
    })
    return ls(app, cid)
  }

  // --- execução ---
  const authRecord = c.auth
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id
  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const facilityCode = String(body.facility_code || '')
  if (!careerId || !FACILITY_META[facilityCode]) {
    throw new BadRequestError('facility_code inválido.')
  }

  const career = loadCareer($app, careerId, userId)
  const state = loadState($app, careerId)
  const fac = JSON.parse(state.get('facilities_state') || '{}') || {}
  if (Array.isArray(fac))
    throw new BadRequestError('facilities_state corrompido: esperado um objeto.')

  const currentLevel = Number(fac[facilityCode] || 1)
  const targetLevel = Number(body.target_level || currentLevel + 1)

  // Limite máximo de nível 5 e ausência de upgrades duplicados
  if (targetLevel <= currentLevel) {
    throw new BadRequestError('A instalação já está no nível ' + currentLevel + '.')
  }
  if (targetLevel > 5) {
    throw new BadRequestError('Nível máximo da instalação é 5.')
  }
  if (targetLevel !== currentLevel + 1) {
    throw new BadRequestError(
      'É necessário evoluir um nível por vez: o próximo é ' + (currentLevel + 1) + '.',
    )
  }

  // Sem upgrades duplicados: já existe obra em andamento para esta instalação?
  const inProgress = $app.findRecordsByFilter(
    'facility_projects',
    'career_id = {:cid} && facility_code = {:fc} && status = {:st}',
    '-created',
    1,
    0,
    { cid: careerId, fc: facilityCode, st: 'CONSTRUCTION' },
  )
  if (inProgress.length > 0) {
    throw new BadRequestError('Já existe uma melhoria em andamento para esta instalação.')
  }

  const spec = UPGRADE_COST[targetLevel]
  const meta = FACILITY_META[facilityCode]

  // Reserva financeira (INV-04 / INV-05): caixa e teto ficam reservados durante a obra
  const reserveKey =
    'FAC_RESERVE_' +
    careerId +
    '_' +
    facilityCode +
    '_L' +
    targetLevel +
    '_' +
    Date.now() +
    '_' +
    Math.floor(Math.random() * 1e9).toString(16)
  reserveFunds($app, careerId, userId, reserveKey, spec.cash, spec.cap)

  const history = [
    {
      event: 'CONSTRUCTION_STARTED',
      fromLevel: currentLevel,
      toLevel: targetLevel,
      costCash: spec.cash,
      costCap: spec.cap,
      durationRounds: spec.rounds,
      at: new Date().toISOString(),
    },
  ]

  const record = $app.collection('facility_projects').create({
    career_id: careerId,
    user_id: userId,
    facility_code: facilityCode,
    facility_name: meta.name,
    from_level: currentLevel,
    to_level: targetLevel,
    cost_cash: spec.cash,
    cost_cap: spec.cap,
    rounds_remaining: spec.rounds,
    duration_rounds: spec.rounds,
    status: 'CONSTRUCTION',
    effect_target_service: meta.consumer,
    effect_summary: meta.effect,
    pending_integration: meta.pendingIntegration,
    reserve_key: reserveKey,
    history: history,
  })

  return c.json(200, {
    success: true,
    project: record,
    reserve_key: reserveKey,
    target_level: targetLevel,
  })
})

// ============================================================
// POST /backend/v1/facilities/advance-round — avança obras na virada de rodada
// ============================================================
routerAdd('POST', '/backend/v1/facilities/advance-round', (c) => {
  function loadCareer(app, cid, uid) {
    const career = app.findRecordById('careers', cid)
    if (!career || career.get('user_id') !== uid) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }
    return career
  }
  function loadState(app, cid) {
    const states = app.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, {
      cid: cid,
    })
    if (states.length === 0) {
      throw new NotFoundError('Estado da carreira (career_state) não encontrado.')
    }
    return states[0]
  }
  function commitReservation(app, cid, uid, key, extraPayload) {
    function ls(a, ccid) {
      const s = a.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, { cid: ccid })
      if (s.length === 0)
        throw new NotFoundError('Estado da carreira (career_state) não encontrado.')
      return s[0]
    }
    const receipts = app.findRecordsByFilter(
      'career_receipts',
      'idempotency_key = {:k}',
      '',
      1,
      0,
      { k: key },
    )
    if (receipts.length === 0) {
      throw new NotFoundError('Reserva correspondente não encontrada: ' + key)
    }
    const payload = JSON.parse(receipts[0].get('payload') || '{}') || {}
    const costCash = Number(payload.costCash || 0)
    const costCap = Number(payload.costCap || 0)
    let resultState = null
    app.runInTransaction(function (txApp) {
      const state = ls(txApp, cid)
      const cash = Number(state.get('cash_balance') || 0)
      const capSpent = Number(state.get('cost_cap_spent') || 0)
      const resCash = Number(state.get('reserved_cash') || 0)
      const resCap = Number(state.get('reserved_cost_cap') || 0)
      if (costCash > 0 && cash - resCash < costCash) {
        throw new BadRequestError(
          'Rejeição INV-05: Saldo em caixa insuficiente para confirmar a obra.',
        )
      }
      state.set('cash_balance', cash - costCash)
      state.set('cost_cap_spent', capSpent + costCap)
      state.set('reserved_cash', Math.max(0, resCash - costCash))
      state.set('reserved_cost_cap', Math.max(0, resCap - costCap))
      txApp.save(state)
      resultState = state
      const receiptsCollection = txApp.findCollectionByNameOrId('career_receipts')
      const receipt = new Record(receiptsCollection)
      receipt.set('career_id', cid)
      receipt.set('user_id', uid)
      receipt.set('action_type', 'FINANCE_COMMIT')
      receipt.set('idempotency_key', key + '_COMMIT')
      receipt.set('status', 'EXECUTED')
      receipt.set('payload', {
        reservationKey: key,
        costCash: costCash,
        costCap: costCap,
        released: false,
        extraPayload: extraPayload || {},
        timestamp: new Date().toISOString(),
      })
      txApp.save(receipt)
    })
    return resultState
  }

  const authRecord = c.auth
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id
  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  if (!careerId) throw new BadRequestError('career_id é obrigatório.')

  loadCareer($app, careerId, userId)

  const constructions = $app.findRecordsByFilter(
    'facility_projects',
    'career_id = {:cid} && status = {:st}',
    'created',
    100,
    0,
    { cid: careerId, st: 'CONSTRUCTION' },
  )

  const completed = []
  for (const proj of constructions) {
    const remaining = Number(proj.get('rounds_remaining') || 0) - 1
    const facilityCode = proj.get('facility_code')
    const targetLevel = Number(proj.get('to_level'))

    if (remaining > 0) {
      proj.set('rounds_remaining', remaining)
      const hist = JSON.parse(proj.get('history') || '[]') || []
      if (Array.isArray(hist)) {
        hist.push({ event: 'PROGRESS', roundsRemaining: remaining, at: new Date().toISOString() })
        proj.set('history', hist)
      }
      $app.save(proj)
      continue
    }

    // Concluir: confirmar a reserva como despesa e aplicar o nível no career_state
    const reserveKey = proj.get('reserve_key')
    if (!reserveKey) {
      throw new BadRequestError('Obra sem reserva financeira associada; impossível confirmar.')
    }
    commitReservation($app, careerId, userId, reserveKey, {
      facilityCode: facilityCode,
      targetLevel: targetLevel,
    })

    $app.runInTransaction(function (txApp) {
      const st = loadState(txApp, careerId)
      const fac = JSON.parse(st.get('facilities_state') || '{}') || {}
      if (!Array.isArray(fac)) {
        fac[facilityCode] = targetLevel
        st.set('facilities_state', fac)
        txApp.save(st)
      }
    })

    proj.set('rounds_remaining', 0)
    proj.set('status', 'COMPLETED')
    const hist = JSON.parse(proj.get('history') || '[]') || []
    if (Array.isArray(hist)) {
      hist.push({ event: 'COMPLETED', level: targetLevel, at: new Date().toISOString() })
      proj.set('history', hist)
    }
    $app.save(proj)
    completed.push({ facilityCode: facilityCode, level: targetLevel })
  }

  return c.json(200, {
    success: true,
    completed: completed,
    remaining_constructions: constructions.length - completed.length,
  })
})

// ============================================================
// POST /backend/v1/facilities/cancel — cancela obra em andamento (libera a reserva)
// ============================================================
routerAdd('POST', '/backend/v1/facilities/cancel', (c) => {
  function loadCareer(app, cid, uid) {
    const career = app.findRecordById('careers', cid)
    if (!career || career.get('user_id') !== uid) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }
    return career
  }
  function releaseReservation(app, cid, uid, key) {
    function ls(a, ccid) {
      const s = a.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, { cid: ccid })
      if (s.length === 0)
        throw new NotFoundError('Estado da carreira (career_state) não encontrado.')
      return s[0]
    }
    const receipts = app.findRecordsByFilter(
      'career_receipts',
      'idempotency_key = {:k}',
      '',
      1,
      0,
      { k: key },
    )
    if (receipts.length === 0) return null
    const payload = JSON.parse(receipts[0].get('payload') || '{}') || {}
    const costCash = Number(payload.costCash || 0)
    const costCap = Number(payload.costCap || 0)
    let resultState = null
    app.runInTransaction(function (txApp) {
      const state = ls(txApp, cid)
      state.set('reserved_cash', Math.max(0, Number(state.get('reserved_cash') || 0) - costCash))
      state.set(
        'reserved_cost_cap',
        Math.max(0, Number(state.get('reserved_cost_cap') || 0) - costCap),
      )
      txApp.save(state)
      resultState = state
      const receiptsCollection = txApp.findCollectionByNameOrId('career_receipts')
      const receipt = new Record(receiptsCollection)
      receipt.set('career_id', cid)
      receipt.set('user_id', uid)
      receipt.set('action_type', 'FINANCE_RELEASE')
      receipt.set('idempotency_key', key + '_RELEASE')
      receipt.set('status', 'EXECUTED')
      receipt.set('payload', {
        reservationKey: key,
        costCash: costCash,
        costCap: costCap,
        released: true,
        timestamp: new Date().toISOString(),
      })
      txApp.save(receipt)
    })
    return resultState
  }

  const authRecord = c.auth
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id
  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const projectId = body.project_id
  if (!careerId || !projectId) throw new BadRequestError('career_id e project_id são obrigatórios.')

  loadCareer($app, careerId, userId)
  const proj = $app.findRecordById('facility_projects', projectId)
  if (proj.get('career_id') !== careerId) {
    throw new NotFoundError('Obra não encontrada nesta carreira.')
  }
  if (proj.get('status') !== 'CONSTRUCTION') {
    throw new BadRequestError('Somente obras em andamento podem ser canceladas.')
  }

  const reserveKey = proj.get('reserve_key')
  if (reserveKey) {
    releaseReservation($app, careerId, userId, reserveKey)
  }

  const hist = JSON.parse(proj.get('history') || '[]') || []
  if (Array.isArray(hist)) {
    hist.push({ event: 'CANCELLED', at: new Date().toISOString() })
    proj.set('history', hist)
  }
  proj.set('status', 'CANCELLED')
  $app.save(proj)

  return c.json(200, { success: true, project: proj })
})

// ============================================================
// GET /backend/v1/facilities/state — matriz completa das 9 instalações
// ============================================================
routerAdd('GET', '/backend/v1/facilities/state', (c) => {
  const FACILITY_META = {
    design_center: {
      name: 'Centro de Design',
      consumer: 'rd_pipeline',
      consumerLabel: 'Qualidade e precisão dos projetos de P&D',
      pendingIntegration: false,
      effect:
        'Cada nível reduz a chance de falha dos projetos e melhora a nota mínima do resultado.',
    },
    cfd_cluster: {
      name: 'Cluster de CFD',
      consumer: 'rd_pipeline',
      consumerLabel: 'Capacidade de desenvolvimento aerodinâmico (projetos simultâneos)',
      pendingIntegration: false,
      effect: 'Cada nível adiciona 1 slot de pesquisa aerodinâmica simultânea.',
    },
    wind_tunnel: {
      name: 'Túnel de Vento',
      consumer: 'rd_pipeline',
      consumerLabel: 'Ensaios e validação de aerodinâmica',
      pendingIntegration: false,
      effect: 'Cada nível adiciona 1 slot de pesquisa (aero/pneus) e melhora a nota do resultado.',
    },
    industrial_structure: {
      name: 'Estrutura Industrial',
      consumer: 'rd_pipeline',
      consumerLabel: 'Logística, fornecimento e produtividade de fabricação',
      pendingIntegration: false,
      effect: 'Cada nível adiciona 1 slot de fabricação simultânea.',
    },
    factory: {
      name: 'Fábrica',
      consumer: 'rd_pipeline',
      consumerLabel: 'Capacidade, tempo e qualidade de fabricação',
      pendingIntegration: false,
      effect:
        'Cada nível adiciona 1 slot de fabricação simultânea e melhora a condição inicial da peça.',
    },
    operations_center: {
      name: 'Centro de Operações',
      consumer: 'rd_pipeline',
      consumerLabel: 'Planejamento e eficiência estratégica (cronograma de P&D)',
      pendingIntegration: false,
      effect: 'Cada nível reduz em 1 rodada a duração de um projeto novo (mínimo 1).',
    },
    pit_stop_center: {
      name: 'Centro de Pit-Stop',
      consumer: 'race_engine',
      consumerLabel: 'Qualidade e confiabilidade dos pit-stops',
      pendingIntegration: true,
      effect:
        'CONTRATO DE INTEGRAÇÃO: o Race Engine lerá o nível para calibrar tempo/risco de pit-stop.',
    },
    simulator: {
      name: 'Simulador',
      consumer: 'race_engine',
      consumerLabel: 'Preparação de pilotos e qualidade de acerto de setup',
      pendingIntegration: true,
      effect:
        'CONTRATO DE INTEGRAÇÃO: o Race Engine lerá o nível para bônus de acerto de setup e preparação.',
    },
    driver_academy: {
      name: 'Academia de Pilotos',
      consumer: 'driver_academy_module',
      consumerLabel: 'Formação, treinamento e evolução de talentos',
      pendingIntegration: true,
      effect:
        'CONTRATO DE INTEGRAÇÃO: o futuro módulo da Academia lerá o nível para evolução de talentos.',
    },
  }
  const UPGRADE_COST = {
    2: { cash: 4000000, cap: 4000000, rounds: 2 },
    3: { cash: 8000000, cap: 8000000, rounds: 3 },
    4: { cash: 15000000, cap: 15000000, rounds: 4 },
    5: { cash: 25000000, cap: 25000000, rounds: 5 },
  }
  const MAINTENANCE = { 1: 0, 2: 500000, 3: 1000000, 4: 2000000, 5: 3500000 }

  function loadCareer(app, cid, uid) {
    const career = app.findRecordById('careers', cid)
    if (!career || career.get('user_id') !== uid) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }
    return career
  }
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
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id
  const careerId = c.requestInfo().query.career_id
  if (!careerId) throw new BadRequestError('career_id é obrigatório.')

  loadCareer($app, careerId, userId)
  const state = loadState($app, careerId)
  const fac = JSON.parse(state.get('facilities_state') || '{}') || {}
  if (Array.isArray(fac))
    throw new BadRequestError('facilities_state corrompido: esperado um objeto.')

  const constructions = $app.findRecordsByFilter(
    'facility_projects',
    'career_id = {:cid} && status = {:st}',
    'created',
    100,
    0,
    { cid: careerId, st: 'CONSTRUCTION' },
  )

  const facilities = []
  for (const code of Object.keys(FACILITY_META)) {
    const meta = FACILITY_META[code]
    const level = Number(fac[code] || 1)
    const next = level + 1
    let construction = null
    for (const p of constructions) {
      if (p.get('facility_code') === code) {
        construction = p
        break
      }
    }
    facilities.push({
      code: code,
      name: meta.name,
      level: level,
      maxLevel: 5,
      atMax: level >= 5,
      nextUpgradeCost: level < 5 ? UPGRADE_COST[next].cash : 0,
      nextUpgradeRounds: level < 5 ? UPGRADE_COST[next].rounds : 0,
      maintenanceAnnual: MAINTENANCE[level],
      consumer: meta.consumer,
      consumerLabel: meta.consumerLabel,
      effect: meta.effect,
      pendingIntegration: meta.pendingIntegration,
      inProgress: construction
        ? {
            id: construction.id,
            toLevel: Number(construction.get('to_level')),
            roundsRemaining: Number(construction.get('rounds_remaining')),
          }
        : null,
    })
  }

  return c.json(200, { success: true, facilities: facilities })
})
