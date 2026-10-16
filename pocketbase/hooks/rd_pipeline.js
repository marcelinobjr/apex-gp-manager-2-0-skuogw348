// pocketbase/hooks/rd_pipeline.js
// APEX GP Manager 2.0 - QA-GESTAO-05C3 (v0.0.18)
// Ciclo completo de P&D em 8 estados no servidor (seções 13.5 e 13.9 do Doc Mestre v2.2):
// PROPOSED -> RESERVED -> RESEARCHING -> DESIGNED -> MANUFACTURING -> READY -> INSTALLED
// (+ FAILED / CANCELLED), com sorte técnico único e determinístico por seed do projeto.
//
// Regras fundamentais:
// - Concluir a pesquisa NÃO melhora o carro automaticamente: o ganho efetivo exige
//   fabricação (MANUFACTURING) e instalação (INSTALLED) do componente.
// - O resultado é sorteado UMA vez (result_seed persistido) e nunca re-sortado.
// - Jogador e IA usam exatamente as mesmas rotas e regras.
// - Toda despesa passa pela blindagem financeira (INV-04 / INV-05, coleção career_receipts).
//
// Observação de plataforma: a JSVM executa cada callback em pool separado — todos os
// helpers e tabelas estão declarados DENTRO de cada callback.

// ============================================================
// POST /backend/v1/rd/propose  (PROPOSED -> RESERVED)
// Define objetivo, atributos-alvo, custo, prazo e risco; reserva orçamento.
// ============================================================
routerAdd('POST', '/backend/v1/rd/propose', (c) => {
  // --- tabelas e helpers (dentro do callback por exigência da JSVM) ---
  const OUTCOME_TABLE = {
    CONSERVADORA: {
      excellent: 0.2,
      normal: 0.75,
      multExcellent: 1.0,
      multNormal: 0.7,
      multPoor: 0.3,
      failChance: 0.0,
    },
    EQUILIBRADA: {
      excellent: 0.25,
      normal: 0.7,
      multExcellent: 1.0,
      multNormal: 1.0,
      multPoor: 0.5,
      failChance: 0.05,
    },
    AGRESSIVA: {
      excellent: 0.35,
      normal: 0.45,
      multExcellent: 1.3,
      multNormal: 1.0,
      multPoor: 0.5,
      failChance: 0.15,
    },
  }
  const TARGETS = {
    aero: ['aeroDownforce', 'aeroEfficiency'],
    chassis: ['mechanicalGrip', 'chassisBalance'],
    braking: ['brakingPerformance'],
    tyre: ['tyrePreservation'],
    thermal: ['thermalManagement'],
    reliability: ['chassisReliability'],
  }
  const FACILITY_COST = {
    aero: { cfd_cluster: 1, wind_tunnel: 1 },
    chassis: { design_center: 1 },
    braking: { design_center: 1, factory: 1 },
    tyre: { design_center: 1, wind_tunnel: 1 },
    thermal: { cfd_cluster: 1, factory: 1 },
    reliability: { design_center: 1, factory: 1 },
  }
  const FACILITY_CODES = [
    'design_center',
    'cfd_cluster',
    'wind_tunnel',
    'industrial_structure',
    'factory',
    'operations_center',
    'pit_stop_center',
    'simulator',
    'driver_academy',
  ]

  function hash32(str) {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
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
  function facilityUsage(app, cid) {
    const usage = {}
    for (const code of FACILITY_CODES) usage[code] = 0
    const actives = app.findRecordsByFilter(
      'rd_projects',
      'career_id = {:cid} && status_canonical != "" && status_canonical != {:d1} && status_canonical != {:d2} && status_canonical != {:d3} && status_canonical != {:d4} && status_canonical != {:d5}',
      '-created',
      500,
      0,
      { cid: cid, d1: 'INSTALLED', d2: 'FAILED', d3: 'CANCELLED', d4: 'COMPLETED', d5: 'DESIGNED' },
    )
    const mfg = app.findRecordsByFilter(
      'rd_projects',
      'career_id = {:cid} && status_canonical = {:s}',
      '-created',
      500,
      0,
      { cid: cid, s: 'MANUFACTURING' },
    )
    for (const p of mfg) {
      const alloc = JSON.parse(p.get('facility_allocations') || '{}') || {}
      if (Array.isArray(alloc)) continue
      for (const code of Object.keys(alloc)) {
        if (code === 'factory' || code === 'industrial_structure') {
          usage[code] = (usage[code] || 0) + Number(alloc[code] || 0)
        }
      }
    }
    return usage
  }
  function capacities(state, usage) {
    const fac = JSON.parse(state.get('facilities_state') || '{}') || {}
    if (Array.isArray(fac))
      throw new BadRequestError('facilities_state corrompido: esperado um objeto.')
    const out = {}
    for (const code of FACILITY_CODES) {
      out[code] = {
        level: Number(fac[code] || 1),
        used: Number(usage[code] || 0),
        available: Number(fac[code] || 1) - Number(usage[code] || 0),
      }
    }
    return out
  }
  function reserveFunds(app, cid, uid, key, costCash, costCap) {
    // duplica a lógica do endpoint /finances/reserve (JSVM não compartilha escopo de topo)
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
    // validação INV-05 / INV-04 (mesma fórmula do financial_integrity.js)
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
  if (!careerId) throw new BadRequestError('career_id é obrigatório.')

  const name = String(body.name || '').trim()
  if (name.length < 2) throw new BadRequestError('Nome do projeto é obrigatório.')
  const category = String(body.category || '')
  if (!TARGETS[category]) {
    throw new BadRequestError(
      'Área de engenharia inválida (aero/chassis/braking/tyre/thermal/reliability).',
    )
  }
  const targets = TARGETS[category]
  const cost = Math.max(0, Number(body.cost || 0))
  const durationRounds = Math.max(1, Math.min(24, parseInt(body.duration_rounds, 10) || 3))
  const strategy = String(body.risk_strategy || 'EQUILIBRADA')
  if (!OUTCOME_TABLE[strategy]) {
    throw new BadRequestError(
      'Estratégia de risco inválida (CONSERVADORA / EQUILIBRADA / AGRESSIVA).',
    )
  }

  const career = loadCareer($app, careerId, userId)
  const state = loadState($app, careerId)
  const seasonYear = Number(career.get('current_year') || 2026)

  // Capacidade disponível de CFD / túnel / fábrica (teste de aceite 9)
  const usage = facilityUsage($app, careerId)
  const caps = capacities(state, usage)
  const need = FACILITY_COST[category]
  for (const code of Object.keys(need)) {
    if (caps[code].available < need[code]) {
      throw new BadRequestError(
        'Capacidade insuficiente em ' +
          code +
          ': requerido ' +
          need[code] +
          ', disponível ' +
          caps[code].available +
          '.',
      )
    }
  }

  // Reserva financeira (orçamento reservado, ainda não gasto)
  const reserveKey =
    'RD_RESERVE_' +
    careerId +
    '_' +
    hash32(
      name + '|' + category + '|' + seasonYear + '|' + Date.now() + '|' + Math.random(),
    ).toString(16)
  reserveFunds($app, careerId, userId, reserveKey, cost, cost)

  // Seed determinística do projeto (persistida; o resultado deriva dela)
  const projectSeed =
    'RDSEED_' +
    hash32(careerId + '|' + name + '|' + category + '|' + seasonYear + '|' + reserveKey)
      .toString(16)
      .toUpperCase()

  const allocations = {}
  for (const code of Object.keys(need)) allocations[code] = need[code]

  const now = new Date().toISOString()
  const project = $app.collection('rd_projects').create({
    career_id: careerId,
    user_id: userId,
    name: name,
    category: category,
    cost: cost,
    duration_rounds: durationRounds,
    rounds_remaining: durationRounds,
    status: 'IN_PROGRESS',
    status_canonical: 'RESERVED',
    target_attributes: JSON.stringify(targets),
    risk_strategy: strategy,
    project_seed: projectSeed,
    spent_cash: 0,
    spend_cap_used: 0,
    released_cash: 0,
    released_cap: 0,
    progress_pct: 0,
    facility_allocations: allocations,
    state_history: [
      {
        state: 'PROPOSED',
        at: now,
        note: 'Projeto definido: objetivo, atributos-alvo, custo, prazo e risco.',
      },
      {
        state: 'RESERVED',
        at: now,
        note:
          'Orçamento e capacidade operacional reservados ($' + (cost / 1000000).toFixed(2) + 'M).',
      },
    ],
  })

  return c.json(200, { success: true, project: project, reserve_key: reserveKey })
})

// ============================================================
// POST /backend/v1/rd/start  (RESERVED -> RESEARCHING)
// ============================================================
routerAdd('POST', '/backend/v1/rd/start', (c) => {
  function loadOwned(app, pid, cid, uid) {
    const project = app.findRecordById('rd_projects', pid)
    if (!project || project.get('career_id') !== cid) {
      throw new NotFoundError('Projeto de P&D não encontrado nesta carreira.')
    }
    const career = app.findRecordById('careers', cid)
    if (!career || career.get('user_id') !== uid) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }
    return { project: project, career: career }
  }
  function pushHistory(project, state, note) {
    const history = JSON.parse(project.get('state_history') || '[]') || []
    if (Array.isArray(history)) {
      history.push({ state: state, at: new Date().toISOString(), note: note || '' })
      project.set('state_history', history)
    }
  }
  function setActive(project, state, note) {
    pushHistory(project, project.get('status_canonical'), 'Transição para ' + (note || state))
    project.set('status_canonical', state)
    if (state === 'FAILED' || state === 'CANCELLED' || state === 'INSTALLED') {
      project.set('status', 'COMPLETED')
    } else {
      project.set('status', 'IN_PROGRESS')
    }
  }

  const authRecord = c.auth
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id
  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const projectId = body.project_id
  if (!careerId || !projectId) throw new BadRequestError('career_id e project_id são obrigatórios.')

  const owned = loadOwned($app, projectId, careerId, userId)
  const project = owned.project
  if (project.get('status_canonical') !== 'RESERVED') {
    throw new BadRequestError(
      'Estado inválido para iniciar pesquisa: ' + project.get('status_canonical') + '.',
    )
  }

  project.set('progress_pct', 0)
  setActive(
    project,
    'RESEARCHING',
    'Pesquisa em andamento: consome tempo e capacidade das instalações.',
  )
  $app.save(project)
  return c.json(200, { success: true, project: project })
})

// ============================================================
// POST /backend/v1/rd/complete-research  (RESEARCHING -> DESIGNED | FAILED)
// Sorte técnico ÚNICO, determinístico pela seed persistida do projeto.
// ============================================================
routerAdd('POST', '/backend/v1/rd/complete-research', (c) => {
  const OUTCOME_TABLE = {
    CONSERVADORA: {
      excellent: 0.2,
      normal: 0.75,
      multExcellent: 1.0,
      multNormal: 0.7,
      multPoor: 0.3,
      failChance: 0.0,
    },
    EQUILIBRADA: {
      excellent: 0.25,
      normal: 0.7,
      multExcellent: 1.0,
      multNormal: 1.0,
      multPoor: 0.5,
      failChance: 0.05,
    },
    AGRESSIVA: {
      excellent: 0.35,
      normal: 0.45,
      multExcellent: 1.3,
      multNormal: 1.0,
      multPoor: 0.5,
      failChance: 0.15,
    },
  }
  const FACILITY_COST = {
    aero: { cfd_cluster: 1, wind_tunnel: 1 },
    chassis: { design_center: 1 },
    braking: { design_center: 1, factory: 1 },
    tyre: { design_center: 1, wind_tunnel: 1 },
    thermal: { cfd_cluster: 1, factory: 1 },
    reliability: { design_center: 1, factory: 1 },
  }
  function hash32(str) {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }
  function makeRng(seedStr) {
    let s = hash32(seedStr) || 123456789
    return function () {
      s ^= s << 13
      s >>>= 0
      s ^= s >> 17
      s >>>= 0
      s ^= s << 5
      s >>>= 0
      return s / 4294967296
    }
  }
  function loadOwned(app, pid, cid, uid) {
    const project = app.findRecordById('rd_projects', pid)
    if (!project || project.get('career_id') !== cid) {
      throw new NotFoundError('Projeto de P&D não encontrado nesta carreira.')
    }
    const career = app.findRecordById('careers', cid)
    if (!career || career.get('user_id') !== uid) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }
    return { project: project, career: career }
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
  function pushHistory(project, state, note) {
    const history = JSON.parse(project.get('state_history') || '[]') || []
    if (Array.isArray(history)) {
      history.push({ state: state, at: new Date().toISOString(), note: note || '' })
      project.set('state_history', history)
    }
  }
  function setActive(project, state, note) {
    pushHistory(project, project.get('status_canonical'), 'Transição para ' + (note || state))
    project.set('status_canonical', state)
    if (state === 'FAILED' || state === 'CANCELLED' || state === 'INSTALLED') {
      project.set('status', 'COMPLETED')
    } else {
      project.set('status', 'IN_PROGRESS')
    }
  }
  function findReserveReceipt(app, cid, cost) {
    // localiza a reserva ativa deste projeto (status RESERVED, valor correspondente)
    const candidates = app.findRecordsByFilter(
      'career_receipts',
      'action_type = {:at} && status = {:st}',
      '-created',
      50,
      0,
      { at: 'FINANCE_RESERVE', st: 'RESERVED' },
    )
    for (const r of candidates) {
      const pl = JSON.parse(r.get('payload') || '{}') || {}
      if (Number(pl.costCash || 0) === Number(cost) && r.get('career_id') === cid) {
        return r.get('idempotency_key')
      }
    }
    return null
  }
  function commitOrRelease(app, cid, uid, key, commit, extraPayload) {
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
      receipt.set('career_id', cid)
      receipt.set('user_id', uid)
      receipt.set('action_type', commit ? 'FINANCE_COMMIT' : 'FINANCE_RELEASE')
      receipt.set('idempotency_key', key + (commit ? '_COMMIT' : '_RELEASE'))
      receipt.set('status', 'EXECUTED')
      receipt.set('payload', {
        reservationKey: key,
        costCash: costCash,
        costCap: costCap,
        released: !commit,
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
  const projectId = body.project_id
  if (!careerId || !projectId) throw new BadRequestError('career_id e project_id são obrigatórios.')

  const owned = loadOwned($app, projectId, careerId, userId)
  const project = owned.project

  if (project.get('status_canonical') !== 'RESEARCHING') {
    throw new BadRequestError(
      'Estado inválido para concluir pesquisa: ' + project.get('status_canonical') + '.',
    )
  }
  // Idempotência estrita do resultado: sorte já realizado não é refeito
  if (project.get('result_seed')) {
    const detail = JSON.parse(project.get('result_detail') || '{}') || {}
    return c.json(200, {
      success: true,
      project: project,
      outcome: detail.outcome || 'NORMAL',
      gain_pct: Number(detail.gainPct || 0),
      already_rolled: true,
    })
  }

  const state = loadState($app, careerId)
  const fac = JSON.parse(state.get('facilities_state') || '{}') || {}
  if (Array.isArray(fac))
    throw new BadRequestError('facilities_state corrompido: esperado um objeto.')

  // Score de qualidade das instalações consumidoras deste projeto (0..1)
  const need = FACILITY_COST[project.get('category')] || { design_center: 1 }
  let facilityScore = 0
  let facCount = 0
  for (const code of Object.keys(need)) {
    facilityScore += Number(fac[code] || 1) / 5
    facCount++
  }
  facilityScore = facCount > 0 ? facilityScore / facCount : 0.5

  // Score de investimento (0..1): compara o custo do projeto com uma referência de $20M
  const investmentScore = Math.min(1, Number(project.get('cost') || 0) / 20000000)

  // SORTE ÚNICO: derivado apenas da seed persistida do projeto
  const resultSeed = String(project.get('project_seed') || '') + '_RESULT'
  const strategy = project.get('risk_strategy') || 'EQUILIBRADA'
  const table = OUTCOME_TABLE[strategy] || OUTCOME_TABLE.EQUILIBRADA
  const rng = makeRng(resultSeed)

  // Falha: estratégias arriscadas falham mais; estrutura fraca agrava. Determinístico pela seed.
  const failRoll = rng()
  const failChance = Math.min(0.5, table.failChance + Math.max(0, 0.1 - facilityScore * 0.1))
  const roll = rng()
  let outcome
  if (failRoll < failChance) {
    outcome = 'FAILED'
  } else if (roll < table.excellent) {
    outcome = 'EXCELLENT'
  } else if (roll < table.excellent + table.normal) {
    outcome = 'NORMAL'
  } else {
    outcome = 'POOR'
  }

  let mult = table.multNormal
  if (outcome === 'EXCELLENT') mult = table.multExcellent
  if (outcome === 'POOR') mult = table.multPoor
  const base = { EXCELLENT: 15, NORMAL: 8, POOR: 2 }[outcome] || 0
  const gainPct =
    Math.round(base * mult * (0.7 + 0.3 * facilityScore) * (0.8 + 0.4 * investmentScore) * 10) / 10

  // Financeiro: metade do orçamento é despesa incorrida de pesquisa; o resto segue reservado
  const cost = Number(project.get('cost') || 0)
  const researchSpend = Math.round(cost / 2)
  const reserveKey = findReserveReceipt($app, careerId, cost)

  if (outcome === 'FAILED') {
    if (reserveKey) {
      // Consome a despesa de pesquisa (não reembolsa) e libera o restante da reserva
      commitOrRelease($app, careerId, userId, reserveKey, true, {
        projectId: projectId,
        phase: 'RESEARCH_FAILED',
        spent: researchSpend,
      })
      if (cost - researchSpend > 0) {
        // Devolve ao caixa a parte não incorrida, como receita de estorno (sem tocar o teto)
        const incomeKey = reserveKey + '_REFUND'
        const existsRefund = $app.findRecordsByFilter(
          'career_receipts',
          'idempotency_key = {:k}',
          '',
          1,
          0,
          { k: incomeKey },
        )
        if (existsRefund.length === 0) {
          const refundState = loadState($app, careerId)
          refundState.set(
            'cash_balance',
            Number(refundState.get('cash_balance') || 0) + (cost - researchSpend),
          )
          $app.save(refundState)
          const receiptsCollection = $app.findCollectionByNameOrId('career_receipts')
          const refundReceipt = new Record(receiptsCollection)
          refundReceipt.set('career_id', careerId)
          refundReceipt.set('user_id', userId)
          refundReceipt.set('action_type', 'RD_PROJECT_REFUND')
          refundReceipt.set('idempotency_key', incomeKey)
          refundReceipt.set('status', 'EXECUTED')
          refundReceipt.set('payload', {
            projectId: projectId,
            amount: cost - researchSpend,
            reason: 'Estorno da parcela não incorrida de projeto malsucedido',
            timestamp: new Date().toISOString(),
          })
          $app.save(refundReceipt)
        }
      }
    }
    project.set('result_seed', resultSeed)
    project.set('result_rolled_at', new Date().toISOString())
    project.set('result_detail', {
      outcome: 'FAILED',
      gainPct: 0,
      facilityScore: facilityScore,
      investmentScore: investmentScore,
      spentCash: researchSpend,
      refunded: cost - researchSpend,
    })
    project.set('spent_cash', researchSpend)
    project.set('spend_cap_used', researchSpend)
    project.set('released_cash', cost - researchSpend)
    project.set('cancelled_reason', 'Projeto malsucedido na fase de pesquisa')
    setActive(
      project,
      'FAILED',
      'Projeto malsucedido: perda de $' +
        (researchSpend / 1000000).toFixed(2) +
        'M registrada, sem ganho técnico.',
    )
    $app.save(project)
    return c.json(200, { success: true, project: project, outcome: 'FAILED', gain_pct: 0 })
  }

  // Sucesso: confirma a reserva integral como despesa (caixa e teto)
  if (reserveKey) {
    commitOrRelease($app, careerId, userId, reserveKey, true, {
      projectId: projectId,
      phase: 'RESEARCH_DONE',
    })
  }

  project.set('result_seed', resultSeed)
  project.set('result_rolled_at', new Date().toISOString())
  project.set('result_detail', {
    outcome: outcome,
    gainPct: gainPct,
    facilityScore: facilityScore,
    investmentScore: investmentScore,
    targets: JSON.parse(project.get('target_attributes') || '[]') || [],
    strategy: strategy,
  })
  project.set('spent_cash', cost)
  project.set('spend_cap_used', cost)
  project.set('progress_pct', 100)
  setActive(
    project,
    'DESIGNED',
    'Resultado técnico materializado: ' +
      outcome +
      ' (+' +
      gainPct +
      '% nos atributos-alvo; ganho pendente de fabricação e instalação).',
  )
  $app.save(project)

  return c.json(200, { success: true, project: project, outcome: outcome, gain_pct: gainPct })
})

// ============================================================
// POST /backend/v1/rd/start-manufacturing  (DESIGNED -> MANUFACTURING)
// Respeita a capacidade da Fábrica e da Estrutura Industrial.
// ============================================================
routerAdd('POST', '/backend/v1/rd/start-manufacturing', (c) => {
  const FACILITY_CODES = [
    'design_center',
    'cfd_cluster',
    'wind_tunnel',
    'industrial_structure',
    'factory',
    'operations_center',
    'pit_stop_center',
    'simulator',
    'driver_academy',
  ]
  function loadOwned(app, pid, cid, uid) {
    const project = app.findRecordById('rd_projects', pid)
    if (!project || project.get('career_id') !== cid) {
      throw new NotFoundError('Projeto de P&D não encontrado nesta carreira.')
    }
    const career = app.findRecordById('careers', cid)
    if (!career || career.get('user_id') !== uid) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }
    return { project: project, career: career }
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
  function facilityUsage(app, cid) {
    const usage = {}
    for (const code of FACILITY_CODES) usage[code] = 0
    const actives = app.findRecordsByFilter(
      'rd_projects',
      'career_id = {:cid} && status_canonical = {:s}',
      '-created',
      500,
      0,
      { cid: cid, s: 'MANUFACTURING' },
    )
    for (const p of actives) {
      const alloc = JSON.parse(p.get('facility_allocations') || '{}') || {}
      if (Array.isArray(alloc)) continue
      for (const code of Object.keys(alloc)) {
        usage[code] = (usage[code] || 0) + Number(alloc[code] || 0)
      }
    }
    return usage
  }
  function pushHistory(project, state, note) {
    const history = JSON.parse(project.get('state_history') || '[]') || []
    if (Array.isArray(history)) {
      history.push({ state: state, at: new Date().toISOString(), note: note || '' })
      project.set('state_history', history)
    }
  }

  const authRecord = c.auth
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id
  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const projectId = body.project_id
  if (!careerId || !projectId) throw new BadRequestError('career_id e project_id são obrigatórios.')

  const owned = loadOwned($app, projectId, careerId, userId)
  const project = owned.project
  if (project.get('status_canonical') !== 'DESIGNED') {
    throw new BadRequestError(
      'Estado inválido para fabricação: ' + project.get('status_canonical') + '.',
    )
  }

  const state = loadState($app, careerId)
  const usage = facilityUsage($app, careerId)
  const fac = JSON.parse(state.get('facilities_state') || '{}') || {}
  if (Array.isArray(fac))
    throw new BadRequestError('facilities_state corrompido: esperado um objeto.')

  // Fabricação consome Fábrica (1) e Estrutura Industrial (1)
  for (const code of ['factory', 'industrial_structure']) {
    const available = Number(fac[code] || 1) - Number(usage[code] || 0)
    if (available < 1) {
      throw new BadRequestError('Capacidade de fabricação insuficiente em ' + code + '.')
    }
  }

  const alloc = JSON.parse(project.get('facility_allocations') || '{}') || {}
  if (!Array.isArray(alloc)) {
    alloc['factory'] = (alloc['factory'] || 0) + 1
    alloc['industrial_structure'] = (alloc['industrial_structure'] || 0) + 1
    project.set('facility_allocations', alloc)
  }
  pushHistory(
    project,
    project.get('status_canonical'),
    'Transição para MANUFACTURING: fabricação do componente aprovado.',
  )
  project.set('status_canonical', 'MANUFACTURING')
  project.set('status', 'IN_PROGRESS')
  $app.save(project)

  return c.json(200, { success: true, project: project })
})

// ============================================================
// POST /backend/v1/rd/complete-manufacturing  (MANUFACTURING -> READY)
// Cria o componente físico com identidade própria no inventário (05C2).
// ============================================================
routerAdd('POST', '/backend/v1/rd/complete-manufacturing', (c) => {
  const COMPONENTS = {
    aero: [
      { type: 'front_wing', name: 'Asa Dianteira' },
      { type: 'rear_wing', name: 'Asa Traseira' },
      { type: 'floor', name: 'Assoalho Venturi' },
    ],
    chassis: [
      { type: 'sidepods', name: 'Laterais & Radiadores' },
      { type: 'suspension', name: 'Suspensão Pushrod' },
    ],
    braking: [{ type: 'brakes', name: 'Sistema de Freios Carbono' }],
    tyre: [{ type: 'suspension', name: 'Suspensão Pushrod (Aderência)' }],
    thermal: [{ type: 'sidepods', name: 'Laterais & Radiadores (Térmico)' }],
    reliability: [{ type: 'gearbox', name: 'Transmissão & Câmbio 8 Velocidades' }],
  }
  function hash32(str) {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }
  function makeRng(seedStr) {
    let s = hash32(seedStr) || 123456789
    return function () {
      s ^= s << 13
      s >>>= 0
      s ^= s >> 17
      s >>>= 0
      s ^= s << 5
      s >>>= 0
      return s / 4294967296
    }
  }
  function loadOwned(app, pid, cid, uid) {
    const project = app.findRecordById('rd_projects', pid)
    if (!project || project.get('career_id') !== cid) {
      throw new NotFoundError('Projeto de P&D não encontrado nesta carreira.')
    }
    const career = app.findRecordById('careers', cid)
    if (!career || career.get('user_id') !== uid) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }
    return { project: project, career: career }
  }
  function pushHistory(project, state, note) {
    const history = JSON.parse(project.get('state_history') || '[]') || []
    if (Array.isArray(history)) {
      history.push({ state: state, at: new Date().toISOString(), note: note || '' })
      project.set('state_history', history)
    }
  }

  const authRecord = c.auth
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id
  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const projectId = body.project_id
  if (!careerId || !projectId) throw new BadRequestError('career_id e project_id são obrigatórios.')

  const owned = loadOwned($app, projectId, careerId, userId)
  const project = owned.project
  const career = owned.career
  if (project.get('status_canonical') !== 'MANUFACTURING') {
    throw new BadRequestError(
      'Estado inválido para concluir fabricação: ' + project.get('status_canonical') + '.',
    )
  }
  if (project.get('manufactured_component_id')) {
    return c.json(200, {
      success: true,
      project: project,
      component_id: project.get('manufactured_component_id'),
      already_manufactured: true,
    })
  }

  const category = project.get('category')
  const options = COMPONENTS[category] || COMPONENTS.aero
  const rng = makeRng(String(project.get('project_seed') || '') + '_MF')
  const pick = options[Math.floor(rng() * options.length) % options.length]

  const shortId = String(careerId).substring(0, 8)
  const seasonYear = Number(career.get('current_year') || 2026)
  // Serial próprio da peça fabricada (mesma família dos seriais homologados em 05C2)
  const serial =
    'PART-' + shortId + '-' + seasonYear + '-RD-' + hash32(project.id).toString(16).toUpperCase()

  const resultDetail = JSON.parse(project.get('result_detail') || '{}') || {}
  // Fábrica e Estrutura Industrial melhoram a condição inicial da peça fabricada
  const stateList = $app.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, {
    cid: careerId,
  })
  let fac = {}
  if (stateList.length > 0) {
    fac = JSON.parse(stateList[0].get('facilities_state') || '{}') || {}
  }
  const facBonus = (Number(fac['factory'] || 1) + Number(fac['industrial_structure'] || 1)) * 2 // até +20
  const conditionStart = Math.max(
    50,
    Math.min(100, Math.round(Number(resultDetail.initialCondition || 96)) + facBonus - 20),
  )

  const created = $app.collection('car_components').create({
    career_id: careerId,
    user_id: userId,
    team_id: career.get('managed_team_id'),
    car_index: 0, // 0 = banco de peças aguardando instalação
    component_type: pick.type,
    component_name: pick.name + ' (' + project.get('name') + ')',
    level: 1,
    condition_pct: conditionStart,
    physical_serial: serial,
    season_year: seasonYear,
    manufacturer_id: career.get('managed_team_id'),
    status: 'AVAILABLE_BENCH',
    mileage_km: 0,
    penalty_incurred: false,
    is_installed: false,
    usage_history: [],
    installation_history: [
      {
        car_index: 0,
        action: 'BENCH_ALLOCATION',
        timestamp: new Date().toISOString(),
        reason: 'Componente fabricado pelo projeto de P&D "' + project.get('name') + '"',
      },
    ],
  })

  project.set('component_type', pick.type)
  project.set('component_name', pick.name)
  project.set('component_serial', serial)
  project.set('manufactured_component_id', created.id)

  // Libera o consumo de fábrica deste projeto
  const alloc = JSON.parse(project.get('facility_allocations') || '{}') || {}
  if (!Array.isArray(alloc)) {
    alloc['factory'] = 0
    alloc['industrial_structure'] = 0
    project.set('facility_allocations', alloc)
  }
  pushHistory(
    project,
    project.get('status_canonical'),
    'Transição para READY: componente pronto (' + serial + ').',
  )
  project.set('status_canonical', 'READY')
  project.set('status', 'IN_PROGRESS')
  $app.save(project)

  return c.json(200, { success: true, project: project, component_id: created.id, serial: serial })
})

// ============================================================
// POST /backend/v1/rd/install  (READY -> INSTALLED)
// Aplica o ganho técnico UMA única vez, em um carro compatível.
// ============================================================
routerAdd('POST', '/backend/v1/rd/install', (c) => {
  function loadOwned(app, pid, cid, uid) {
    const project = app.findRecordById('rd_projects', pid)
    if (!project || project.get('career_id') !== cid) {
      throw new NotFoundError('Projeto de P&D não encontrado nesta carreira.')
    }
    const career = app.findRecordById('careers', cid)
    if (!career || career.get('user_id') !== uid) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }
    return { project: project, career: career }
  }
  function ensureTechState(txApp, cid, uid, teamId, seasonYear) {
    const existing = txApp.findRecordsByFilter(
      'team_technical_state',
      'career_id = {:cid} && team_id = {:tid} && season_year = {:y}',
      '',
      1,
      0,
      { cid: cid, tid: teamId, y: seasonYear },
    )
    if (existing.length > 0) return existing[0]
    // Baseline canônico do catálogo mestre (33 equipes em src/data/game.ts) — somente leitura
    const teamRecs = txApp.findRecordsByFilter('teams', 'team_id = {:tid}', '', 1, 0, {
      tid: teamId,
    })
    let baseline = {}
    if (teamRecs.length > 0) {
      const raw = teamRecs[0].get('raw') || {}
      const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw
      if (parsed && parsed.carBaseline) baseline = parsed.carBaseline
    }
    if (!baseline.aeroDownforce) {
      baseline = {
        aeroDownforce: 75,
        aeroEfficiency: 75,
        mechanicalGrip: 75,
        chassisBalance: 75,
        brakingPerformance: 75,
        tyrePreservation: 75,
        thermalManagement: 75,
        chassisReliability: 75,
      }
    }
    return txApp.collection('team_technical_state').create({
      career_id: cid,
      user_id: uid,
      team_id: teamId,
      season_year: seasonYear,
      effective_attributes: baseline,
      baseline_attributes: baseline,
      source_ledger: [],
    })
  }
  function pushHistory(project, state, note) {
    const history = JSON.parse(project.get('state_history') || '[]') || []
    if (Array.isArray(history)) {
      history.push({ state: state, at: new Date().toISOString(), note: note || '' })
      project.set('state_history', history)
    }
  }

  const authRecord = c.auth
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id
  const body = c.requestInfo().body || {}
  const careerId = body.career_id
  const projectId = body.project_id
  const carIndex = parseInt(body.car_index, 10)
  if (!careerId || !projectId) throw new BadRequestError('career_id e project_id são obrigatórios.')

  const owned = loadOwned($app, projectId, careerId, userId)
  const project = owned.project
  const career = owned.career
  if (project.get('status_canonical') !== 'READY') {
    throw new BadRequestError(
      'Estado inválido para instalação: ' + project.get('status_canonical') + '.',
    )
  }

  const seasonYear = Number(career.get('current_year') || 2026)
  const teamId = career.get('managed_team_id')
  const componentType = project.get('component_type')

  // 1. O componente fabricado deve estar pronto no banco e pertencer a esta carreira/equipe
  const componentId = project.get('manufactured_component_id')
  if (!componentId) {
    throw new BadRequestError('Este projeto ainda não possui componente fabricado.')
  }
  const newPart = $app.findRecordById('car_components', componentId)
  if (newPart.get('career_id') !== careerId || newPart.get('team_id') !== teamId) {
    throw new ForbiddenError('Componente não pertence a esta carreira/equipe.')
  }
  if (newPart.get('status') !== 'AVAILABLE_BENCH' || newPart.getBool('is_installed')) {
    throw new BadRequestError('O componente não está disponível no banco para instalação.')
  }
  if (componentType === 'engine') {
    throw new BadRequestError('Componentes de potência não são fabricados por projetos de P&D.')
  }

  // 2. Somente carros compatíveis (1 ou 2)
  if (carIndex !== 1 && carIndex !== 2) {
    throw new BadRequestError('Instalação permitida somente nos carros 1 ou 2.')
  }

  // 3. Idempotência: instalar duas vezes não aplica o ganho duas vezes
  if (project.get('status_canonical') === 'INSTALLED' || project.get('installed_component_id')) {
    throw new BadRequestError(
      'Este projeto já teve seu componente instalado (efeito técnico já aplicado).',
    )
  }

  // 4. Peça antiga do mesmo tipo no carro é arquivada preservando o histórico
  const olds = $app.findRecordsByFilter(
    'car_components',
    'career_id = {:cid} && car_index = {:cidx} && component_type = {:ctype} && season_year = {:y} && is_installed = true',
    '-updated',
    1,
    0,
    { cid: careerId, cidx: carIndex, ctype: componentType, y: seasonYear },
  )

  $app.runInTransaction(function (txApp) {
    let previousId = null
    if (olds.length > 0) {
      const old = txApp.findRecordById('car_components', olds[0].id)
      previousId = old.id
      const hist = JSON.parse(old.get('installation_history') || '[]') || []
      if (Array.isArray(hist)) {
        hist.push({
          car_index: carIndex,
          action: 'REMOVED_TO_BENCH',
          previousUnitId: old.id,
          timestamp: new Date().toISOString(),
          reason:
            'Substituído pela peça de P&D ' +
            project.get('component_serial') +
            ' (histórico preservado)',
        })
        old.set('installation_history', hist)
      }
      old.set('is_installed', false)
      old.set('status', 'RETIRED')
      txApp.save(old) // a peça anterior preserva desgaste, km e históricos
    }

    const targetHist = JSON.parse(newPart.get('installation_history') || '[]') || []
    if (Array.isArray(targetHist)) {
      targetHist.push({
        car_index: carIndex,
        action: 'INSTALLED_TO_CAR',
        previousUnitId: previousId,
        timestamp: new Date().toISOString(),
        reason: 'Instalação do componente de P&D "' + project.get('name') + '"',
      })
      newPart.set('installation_history', targetHist)
    }

    // Desgaste inicial conforme a condição de fabricação; nada além desta peça é reiniciado
    newPart.set('car_index', carIndex)
    newPart.set('driver_id', previousId ? newPart.get('driver_id') || '' : '')
    newPart.set('is_installed', true)
    newPart.set('status', 'ACTIVE_INSTALLED')
    txApp.save(newPart)

    // 5. Aplicar o ganho técnico UMA única vez nas notas efetivas da temporada
    const targets = JSON.parse(project.get('target_attributes') || '[]') || []
    if (!Array.isArray(targets) || targets.length === 0) {
      throw new BadRequestError('Projeto sem atributos-alvo registrados.')
    }
    const resultDetail = JSON.parse(project.get('result_detail') || '{}') || {}
    const gainPct = Number(resultDetail.gainPct || 0)

    const techRecord = ensureTechState(txApp, careerId, userId, teamId, seasonYear)
    const attrs = JSON.parse(techRecord.get('effective_attributes') || '{}') || {}
    if (Array.isArray(attrs))
      throw new BadRequestError('effective_attributes corrompido: esperado um objeto.')
    const ledger = JSON.parse(techRecord.get('source_ledger') || '[]') || []
    const applied = {}
    for (const attr of targets) {
      const current = Number(attrs[attr] || 0)
      if (current <= 0) continue // atributo fora do escopo do projeto: não alterar
      const newValue = Math.min(99, Math.round((current + gainPct) * 10) / 10)
      attrs[attr] = newValue
      applied[attr] = { from: current, to: newValue }
    }
    techRecord.set('effective_attributes', attrs)
    if (Array.isArray(ledger)) {
      ledger.push({
        projectId: projectId,
        projectName: project.get('name'),
        gainPct: gainPct,
        applied: applied,
        at: new Date().toISOString(),
      })
      techRecord.set('source_ledger', ledger)
    }
    txApp.save(techRecord)

    project.set('installed_component_id', newPart.id)
    project.set('installed_car_index', String(carIndex))
    pushHistory(
      project,
      project.get('status_canonical'),
      'Transição para INSTALLED: Carro ' + carIndex + ', ganho técnico aplicado uma única vez.',
    )
    project.set('status_canonical', 'INSTALLED')
    project.set('status', 'COMPLETED')
    project.set('result_detail', Object.assign({}, resultDetail, { appliedGains: applied }))
    txApp.save(project)
  })

  return c.json(200, { success: true, project: project, component: newPart })
})

// ============================================================
// POST /backend/v1/rd/cancel  (estado ativo -> CANCELLED)
// Trata despesas já incorridas, reservas e liberações.
// ============================================================
routerAdd('POST', '/backend/v1/rd/cancel', (c) => {
  function loadOwned(app, pid, cid, uid) {
    const project = app.findRecordById('rd_projects', pid)
    if (!project || project.get('career_id') !== cid) {
      throw new NotFoundError('Projeto de P&D não encontrado nesta carreira.')
    }
    const career = app.findRecordById('careers', cid)
    if (!career || career.get('user_id') !== uid) {
      throw new ForbiddenError('Acesso não autorizado a esta carreira.')
    }
    return { project: project, career: career }
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
  function pushHistory(project, state, note) {
    const history = JSON.parse(project.get('state_history') || '[]') || []
    if (Array.isArray(history)) {
      history.push({ state: state, at: new Date().toISOString(), note: note || '' })
      project.set('state_history', history)
    }
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
  const reason = String(body.reason || '').substring(0, 280)
  if (!careerId || !projectId) throw new BadRequestError('career_id e project_id são obrigatórios.')

  const owned = loadOwned($app, projectId, careerId, userId)
  const project = owned.project
  const canonical = project.get('status_canonical')
  if (canonical === 'INSTALLED' || canonical === 'CANCELLED' || canonical === 'FAILED') {
    throw new BadRequestError('Projeto já encerrado (' + canonical + '); não pode ser cancelado.')
  }

  // Localiza e libera a reserva ativa do projeto (se ainda existir)
  const candidates = $app.findRecordsByFilter(
    'career_receipts',
    'action_type = {:at} && status = {:st}',
    '-created',
    50,
    0,
    { at: 'FINANCE_RESERVE', st: 'RESERVED' },
  )
  for (const r of candidates) {
    if (r.get('career_id') !== careerId) continue
    const pl = JSON.parse(r.get('payload') || '{}') || {}
    if (Number(pl.costCash || 0) === Number(project.get('cost') || 0)) {
      releaseReservation($app, careerId, userId, r.get('idempotency_key'))
      break
    }
  }

  // Despesa incorrida: a partir de DESIGNED a reserva já foi confirmada como despesa
  // e NÃO é reembolsada (mantida no ledger); antes disso o estorno é integral.
  const spent =
    canonical === 'DESIGNED' || canonical === 'MANUFACTURING' || canonical === 'READY'
      ? Number(project.get('cost') || 0)
      : 0

  project.set('cancelled_reason', reason || 'Cancelado pelo gestor')
  project.set('spent_cash', spent)
  project.set('spend_cap_used', spent)
  pushHistory(
    project,
    project.get('status_canonical'),
    spent > 0
      ? 'Transição para CANCELLED: despesa incorrida de $' +
          (spent / 1000000).toFixed(2) +
          'M mantida no ledger.'
      : 'Transição para CANCELLED: reserva liberada integralmente, sem despesa.',
  )
  project.set('status_canonical', 'CANCELLED')
  project.set('status', 'COMPLETED')
  $app.save(project)

  return c.json(200, { success: true, project: project, spent_cash: spent })
})

// ============================================================
// GET /backend/v1/rd/state — visão do pipeline (usada pela UI e pelos testes)
// ============================================================
routerAdd('GET', '/backend/v1/rd/state', (c) => {
  const FACILITY_CODES = [
    'design_center',
    'cfd_cluster',
    'wind_tunnel',
    'industrial_structure',
    'factory',
    'operations_center',
    'pit_stop_center',
    'simulator',
    'driver_academy',
  ]
  const END_STATES = ['INSTALLED', 'FAILED', 'CANCELLED']
  function loadState(app, cid) {
    const states = app.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, {
      cid: cid,
    })
    if (states.length === 0) {
      throw new NotFoundError('Estado da carreira (career_state) não encontrado.')
    }
    return states[0]
  }
  function facilityUsage(app, cid) {
    const usage = {}
    for (const code of FACILITY_CODES) usage[code] = 0
    const actives = app.findRecordsByFilter(
      'rd_projects',
      'career_id = {:cid} && status_canonical = {:s1} || status_canonical = {:s2}',
      '-created',
      500,
      0,
      { cid: cid, s1: 'RESERVED', s2: 'RESEARCHING' },
    )
    for (const p of actives) {
      const alloc = JSON.parse(p.get('facility_allocations') || '{}') || {}
      if (Array.isArray(alloc)) continue
      for (const code of Object.keys(alloc)) {
        usage[code] = (usage[code] || 0) + Number(alloc[code] || 0)
      }
    }
    const mfg = app.findRecordsByFilter(
      'rd_projects',
      'career_id = {:cid} && status_canonical = {:s}',
      '-created',
      500,
      0,
      { cid: cid, s: 'MANUFACTURING' },
    )
    for (const p of mfg) {
      const alloc = JSON.parse(p.get('facility_allocations') || '{}') || {}
      if (Array.isArray(alloc)) continue
      for (const code of Object.keys(alloc)) {
        if (code === 'factory' || code === 'industrial_structure') {
          usage[code] = (usage[code] || 0) + Number(alloc[code] || 0)
        }
      }
    }
    return usage
  }

  const authRecord = c.auth
  if (!authRecord) throw new UnauthorizedError('Usuário não autenticado.')
  const userId = authRecord.id
  const careerId = c.requestInfo().query.career_id
  if (!careerId) throw new BadRequestError('career_id é obrigatório.')

  const career = $app.findRecordById('careers', careerId)
  if (!career || career.get('user_id') !== userId) {
    throw new ForbiddenError('Acesso não autorizado a esta carreira.')
  }
  const state = loadState($app, careerId)
  const projects = $app.findRecordsByFilter(
    'rd_projects',
    'career_id = {:cid}',
    '-created',
    100,
    0,
    { cid: careerId },
  )
  const usage = facilityUsage($app, careerId)
  const fac = JSON.parse(state.get('facilities_state') || '{}') || {}
  if (Array.isArray(fac))
    throw new BadRequestError('facilities_state corrompido: esperado um objeto.')
  const capacities = {}
  for (const code of FACILITY_CODES) {
    capacities[code] = {
      level: Number(fac[code] || 1),
      used: Number(usage[code] || 0),
      available: Number(fac[code] || 1) - Number(usage[code] || 0),
    }
  }

  const tech = $app.findRecordsByFilter(
    'team_technical_state',
    'career_id = {:cid} && team_id = {:tid} && season_year = {:y}',
    '',
    1,
    0,
    {
      cid: careerId,
      tid: String(career.get('managed_team_id') || ''),
      y: Number(career.get('current_year') || 2026),
    },
  )
  const effective = tech.length > 0 ? JSON.parse(tech[0].get('effective_attributes') || '{}') : {}

  return c.json(200, {
    success: true,
    projects: projects,
    facilities: capacities,
    effective_attributes: effective,
    reserved_cash: Number(state.get('reserved_cash') || 0),
    reserved_cost_cap: Number(state.get('reserved_cost_cap') || 0),
  })
})
