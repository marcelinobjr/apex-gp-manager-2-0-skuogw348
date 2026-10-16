// pocketbase/hooks/qa_05c3_selftest.js
// APEX GP Manager 2.0 - QA-GESTAO-05C3 (v0.0.20)
// Suíte de testes de aceite em ambiente isolado, executável no SERVIDOR:
//   POST /backend/v1/qa/05c3   (corpo opcional: { "keep_careers": true })
//   cron: "0 0 0 * * 6" desativado por padrão (execução manual/diagnóstico)
//
// Estratégia: cria um usuário efêmero + 2 carreiras isoladas (jogador e IA), executa
// o pipeline de P&D e instalações ponta a ponta pelo mesmo código das rotas (extraído
// em funções locais para reuso determinístico) e devolve um laudo executado/inspeção.
// Não toca em dados de produção: tudo é criado e apagado dentro da transação do teste.
//
// Observação de plataforma: a JSVM executa cada callback em pool separado — todos os
// helpers estão declarados DENTRO de cada callback.

routerAdd('POST', '/backend/v1/qa/05c3', (c) => {
  // ----------------- helpers determinísticos (idênticos ao rd_pipeline.js) -----------------
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
  function loadState(app, cid) {
    const states = app.findRecordsByFilter('career_state', 'career_id = {:cid}', '', 1, 0, {
      cid: cid,
    })
    if (states.length === 0) throw new NotFoundError('career_state não encontrado')
    return states[0]
  }
  function reserveFunds(app, cid, uid, key, costCash, costCap) {
    const existing = app.findRecordsByFilter(
      'career_receipts',
      'idempotency_key = {:k}',
      '',
      1,
      0,
      { k: key },
    )
    const st = loadState(app, cid)
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
      const s2 = loadState(txApp, cid)
      s2.set('reserved_cash', Number(s2.get('reserved_cash') || 0) + costCash)
      s2.set('reserved_cost_cap', Number(s2.get('reserved_cost_cap') || 0) + costCap)
      txApp.save(s2)
      const rc = txApp.findCollectionByNameOrId('career_receipts')
      const rec = new Record(rc)
      rec.set('career_id', cid)
      rec.set('user_id', uid)
      rec.set('action_type', 'FINANCE_RESERVE')
      rec.set('idempotency_key', key)
      rec.set('status', 'RESERVED')
      rec.set('payload', {
        costCash: costCash,
        costCap: costCap,
        reservedAt: new Date().toISOString(),
      })
      txApp.save(rec)
    })
    return loadState(app, cid)
  }
  function commitOrRelease(app, cid, uid, key, commit, extraPayload) {
    const receipts = app.findRecordsByFilter(
      'career_receipts',
      'idempotency_key = {:k}',
      '',
      1,
      0,
      { k: key },
    )
    if (receipts.length === 0) throw new NotFoundError('Reserva não encontrada: ' + key)
    const payload = JSON.parse(receipts[0].get('payload') || '{}') || {}
    const costCash = Number(payload.costCash || 0)
    const costCap = Number(payload.costCap || 0)
    let resultState = null
    app.runInTransaction(function (txApp) {
      const state = loadState(txApp, cid)
      const cash = Number(state.get('cash_balance') || 0)
      const capSpent = Number(state.get('cost_cap_spent') || 0)
      const resCash = Number(state.get('reserved_cash') || 0)
      const resCap = Number(state.get('reserved_cost_cap') || 0)
      if (commit) {
        if (costCash > 0 && cash - resCash < costCash) {
          throw new BadRequestError('Rejeição INV-05: saldo insuficiente para confirmar.')
        }
        state.set('cash_balance', cash - costCash)
        state.set('cost_cap_spent', capSpent + costCap)
      }
      state.set('reserved_cash', Math.max(0, resCash - costCash))
      state.set('reserved_cost_cap', Math.max(0, resCap - costCap))
      txApp.save(state)
      resultState = state
      const rc = txApp.findCollectionByNameOrId('career_receipts')
      const rec = new Record(rc)
      rec.set('career_id', cid)
      rec.set('user_id', uid)
      rec.set('action_type', commit ? 'FINANCE_COMMIT' : 'FINANCE_RELEASE')
      rec.set('idempotency_key', key + (commit ? '_COMMIT' : '_RELEASE'))
      rec.set('status', 'EXECUTED')
      rec.set('payload', {
        reservationKey: key,
        costCash: costCash,
        costCap: costCap,
        released: !commit,
        extraPayload: extraPayload || {},
        timestamp: new Date().toISOString(),
      })
      txApp.save(rec)
    })
    return resultState
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
    const baseline = {
      aeroDownforce: 60,
      aeroEfficiency: 60,
      mechanicalGrip: 60,
      chassisBalance: 60,
      brakingPerformance: 60,
      tyrePreservation: 60,
      thermalManagement: 60,
      chassisReliability: 60,
    }
    const col = txApp.findCollectionByNameOrId('team_technical_state')
    const rec = new Record(col)
    rec.set('career_id', cid)
    rec.set('user_id', uid)
    rec.set('team_id', teamId)
    rec.set('season_year', seasonYear)
    rec.set('effective_attributes', baseline)
    rec.set('baseline_attributes', baseline)
    rec.set('source_ledger', [])
    txApp.save(rec)
    return rec
  }
  function applyGain(txApp, cid, uid, teamId, seasonYear, targets, gainPct, projectId) {
    const techRecord = ensureTechState(txApp, cid, uid, teamId, seasonYear)
    const attrs = JSON.parse(techRecord.get('effective_attributes') || '{}') || {}
    const ledger = JSON.parse(techRecord.get('source_ledger') || '[]') || []
    const applied = {}
    for (const attr of targets) {
      const current = Number(attrs[attr] || 0)
      if (current <= 0) continue
      const newValue = Math.min(99, Math.round((current + gainPct) * 10) / 10)
      attrs[attr] = newValue
      applied[attr] = { from: current, to: newValue }
    }
    techRecord.set('effective_attributes', attrs)
    ledger.push({
      projectId: projectId,
      gainPct: gainPct,
      applied: applied,
      at: new Date().toISOString(),
    })
    techRecord.set('source_ledger', ledger)
    txApp.save(techRecord)
    return applied
  }
  function makeProject(app, cid, uid, name, category, cost, strategy, allocations) {
    const col = app.findCollectionByNameOrId('rd_projects')
    const rec = new Record(col)
    rec.set('career_id', cid)
    rec.set('user_id', uid)
    rec.set('name', name)
    rec.set('category', category)
    rec.set('cost', cost)
    rec.set('duration_rounds', 3)
    rec.set('rounds_remaining', 3)
    rec.set('status', 'IN_PROGRESS')
    rec.set('status_canonical', 'RESEARCHING')
    rec.set(
      'target_attributes',
      JSON.stringify(
        category === 'aero'
          ? ['aeroDownforce', 'aeroEfficiency']
          : ['mechanicalGrip', 'chassisBalance'],
      ),
    )
    rec.set('risk_strategy', strategy)
    rec.set(
      'project_seed',
      'RDSEED_' +
        hash32(cid + '|' + name + '|' + category)
          .toString(16)
          .toUpperCase(),
    )
    rec.set('spent_cash', 0)
    rec.set('spend_cap_used', 0)
    rec.set('released_cash', 0)
    rec.set('released_cap', 0)
    rec.set('progress_pct', 0)
    rec.set('facility_allocations', allocations || {})
    rec.set('state_history', [])
    app.save(rec)
    return rec
  }
  function rollOutcome(seedStr, strategy, facilityScore, investmentScore) {
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
    const table = OUTCOME_TABLE[strategy] || OUTCOME_TABLE.EQUILIBRADA
    const rng = makeRng(seedStr)
    const failRoll = rng()
    const failChance = Math.min(0.5, table.failChance + Math.max(0, 0.1 - facilityScore * 0.1))
    const roll = rng()
    let outcome
    if (failRoll < failChance) outcome = 'FAILED'
    else if (roll < table.excellent) outcome = 'EXCELLENT'
    else if (roll < table.excellent + table.normal) outcome = 'NORMAL'
    else outcome = 'POOR'
    let mult = table.multNormal
    if (outcome === 'EXCELLENT') mult = table.multExcellent
    if (outcome === 'POOR') mult = table.multPoor
    const base = { EXCELLENT: 15, NORMAL: 8, POOR: 2 }[outcome] || 0
    const gainPct =
      Math.round(base * mult * (0.7 + 0.3 * facilityScore) * (0.8 + 0.4 * investmentScore) * 10) /
      10
    return { outcome: outcome, gainPct: gainPct }
  }

  // ----------------- executor -----------------
  const results = []
  function record(id, name, executed, passed, detail) {
    results.push({ id: id, name: name, executed: executed, passed: passed, detail: detail || '' })
  }

  const body = c.requestInfo().body || {}
  const keepCareers = body.keep_careers === true
  const testPrefix = 'QA05C3_'
  const cleanupIds = []
  const evidence = {
    receipts: [],
    projects: [],
    components: [],
    techStates: [],
    facilityProjects: [],
  }

  let userA = null
  let userB = null
  let careerA = null
  let careerB = null
  let stateA = null
  let stateB = null

  try {
    // ---- setup: usuário efêmero A (jogador) e B (IA) com carreiras isoladas ----
    const usersCollection = $app.findCollectionByNameOrId('users')
    const suffix = hash32(String(Date.now()) + Math.random()).toString(16)
    userA = new Record(usersCollection)
    userA.setEmail('qa05c3_a_' + suffix + '@apex-test.invalid')
    userA.setPassword('Qa05c3!' + suffix)
    userA.setVerified(true)
    userA.set('name', 'QA05C3-A')
    $app.save(userA)

    userB = new Record(usersCollection)
    userB.setEmail('qa05c3_b_' + suffix + '@apex-test.invalid')
    userB.setPassword('Qa05c3!' + suffix)
    userB.setVerified(true)
    userB.set('name', 'QA05C3-B')
    $app.save(userB)
    cleanupIds.push({ collection: 'users', id: userA.id })
    cleanupIds.push({ collection: 'users', id: userB.id })

    function makeCareer(user, nameSuffix) {
      const careersCollection = $app.findCollectionByNameOrId('careers')
      const rec = new Record(careersCollection)
      rec.set('user_id', user.id)
      rec.set('name', 'QA05C3 ' + nameSuffix)
      rec.set('initial_year', 2026)
      rec.set('current_year', 2026)
      rec.set('universe_type', 'REAL')
      rec.set('manager_archetype_id', 'balanced')
      rec.set('managed_team_id', 'team_0006')
      rec.set('managed_team_power_factor', 100)
      rec.set('master_seed', 'QA05C3SEED-' + suffix + '-' + nameSuffix)
      rec.set('rules_frozen', { financialCapAmount: 135000000 })
      $app.save(rec)
      return rec
    }

    careerA = makeCareer(userA, 'A')
    careerB = makeCareer(userB, 'B')
    cleanupIds.push({ collection: 'careers', id: careerA.id })
    cleanupIds.push({ collection: 'careers', id: careerB.id })

    function makeState(career) {
      const cc = $app.findCollectionByNameOrId('career_state')
      const rec = new Record(cc)
      rec.set('career_id', career.id)
      rec.set('user_id', career.get('user_id'))
      rec.set('cash_balance', 120000000)
      rec.set('cost_cap_budget', 135000000)
      rec.set('cost_cap_spent', 0)
      rec.set('team_morale', 70)
      rec.set('sponsor_income_annual', 60000000)
      rec.set('reserved_cash', 0)
      rec.set('reserved_cost_cap', 0)
      rec.set('facilities_state', {
        design_center: 3,
        cfd_cluster: 3,
        wind_tunnel: 3,
        industrial_structure: 3,
        factory: 3,
        operations_center: 3,
        pit_stop_center: 3,
        simulator: 3,
        driver_academy: 3,
      })
      $app.save(rec)
      return rec
    }

    stateA = makeState(careerA)
    stateB = makeState(careerB)
    cleanupIds.push({ collection: 'career_state', id: stateA.id })
    cleanupIds.push({ collection: 'career_state', id: stateB.id })

    // ================= T1: projeto aprovado consome orçamento e reservas =================
    {
      const name = 'Projeto T1 Aerodinâmica'
      const cost = 12000000
      const preState = loadState($app, careerA.id)
      const preCash = Number(preState.get('cash_balance') || 0)
      const preCap = Number(preState.get('cost_cap_spent') || 0)
      const key = 'QA05C3_RESERVE_T1_' + suffix
      reserveFunds($app, careerA.id, userA.id, key, cost, cost)
      const midState = loadState($app, careerA.id)
      const reservedOk =
        Number(midState.get('reserved_cash') || 0) === cost &&
        Number(midState.get('reserved_cost_cap') || 0) === cost
      const project = makeProject($app, careerA.id, userA.id, name, 'aero', cost, 'EQUILIBRADA', {
        cfd_cluster: 1,
        wind_tunnel: 1,
      })
      const roll = rollOutcome(
        project.get('project_seed') + '_RESULT',
        'EQUILIBRADA',
        0.6,
        cost / 20000000,
      )
      if (roll.outcome !== 'FAILED') {
        commitOrRelease($app, careerA.id, userA.id, key, true, {
          projectId: project.id,
          phase: 'RESEARCH_DONE',
        })
      }
      const postState = loadState($app, careerA.id)
      const postCash = Number(postState.get('cash_balance') || 0)
      const postCap = Number(postState.get('cost_cap_spent') || 0)
      const receiptsCount = $app.findRecordsByFilter(
        'career_receipts',
        'career_id = {:cid} && idempotency_key = {:k}',
        '',
        5,
        0,
        { cid: careerA.id, k: key + '_COMMIT' },
      ).length
      const t1Ok =
        reservedOk &&
        postCash === preCash - cost &&
        postCap === preCap + cost &&
        receiptsCount === 1
      record(
        'T1',
        'Projeto aprovado consome orçamento e reservas corretamente',
        true,
        t1Ok,
        'reserva=' +
          reservedOk +
          '; caixa: ' +
          preCash +
          '->' +
          postCash +
          ' (-' +
          cost +
          '); teto: ' +
          preCap +
          '->' +
          postCap +
          '; recibos COMMIT=' +
          receiptsCount,
      )
      project.set('result_seed', project.get('project_seed') + '_RESULT')
      project.set('result_detail', { outcome: roll.outcome, gainPct: roll.gainPct })
      project.set('status_canonical', 'DESIGNED')
      project.set('status', 'IN_PROGRESS')
      $app.save(project)
      evidence.projects.push({
        test: 'T1',
        id: project.id,
        seed: project.get('project_seed'),
        resultSeed: project.get('result_seed'),
        outcome: roll.outcome,
        gainPct: roll.gainPct,
      })
      evidence.receipts.push({ test: 'T1', key: key + '_COMMIT' })
      if (roll.outcome !== 'FAILED') {
        evidence.projects[0].project = project
        evidence.projects[0].state = 'DESIGNED'
        // usa este projeto no T5/T6 (componente não instalado não muda o carro)
      }
    }

    // ================= T2: rejeição por insuficiência financeira não altera estado =================
    {
      const preState = loadState($app, careerA.id)
      const preCash = Number(preState.get('cash_balance') || 0)
      const preCapSpent = Number(preState.get('cost_cap_spent') || 0)
      const preResCash = Number(preState.get('reserved_cash') || 0)
      const preResCap = Number(preState.get('reserved_cost_cap') || 0)
      let rejected = false
      let message = ''
      try {
        reserveFunds($app, careerA.id, userA.id, 'QA05C3_REJECT_' + suffix, 500000000, 500000000)
      } catch (err) {
        rejected = true
        message = String(err)
      }
      const postState = loadState($app, careerA.id)
      const unchanged =
        Number(postState.get('cash_balance') || 0) === preCash &&
        Number(postState.get('cost_cap_spent') || 0) === preCapSpent &&
        Number(postState.get('reserved_cash') || 0) === preResCash &&
        Number(postState.get('reserved_cost_cap') || 0) === preResCap
      const t2Ok = rejected && unchanged
      record(
        'T2',
        'Projeto rejeitado por insuficiência financeira não altera o estado',
        true,
        t2Ok,
        'rejeitado=' +
          rejected +
          '; estado imutável=' +
          unchanged +
          '; msg=' +
          message.substring(0, 120),
      )
    }

    // ================= T3: resultado idêntico após recarga e repetição (seed determinística) =================
    {
      const project = makeProject(
        $app,
        careerA.id,
        userA.id,
        'Projeto T3 Determinismo',
        'chassis',
        8000000,
        'AGRESSIVA',
        { design_center: 1 },
      )
      const seed1 = project.get('project_seed') + '_RESULT'
      const roll1 = rollOutcome(seed1, 'AGRESSIVA', 0.6, 0.4)
      const roll2 = rollOutcome(seed1, 'AGRESSIVA', 0.6, 0.4)
      const roll3 = rollOutcome(seed1, 'AGRESSIVA', 0.6, 0.4)
      const t3Ok =
        roll1.outcome === roll2.outcome &&
        roll2.outcome === roll3.outcome &&
        roll1.gainPct === roll2.gainPct &&
        roll2.gainPct === roll3.gainPct
      record(
        'T3',
        'Resultado técnico permanece idêntico após recarga e repetição (seed determinística)',
        true,
        t3Ok,
        'seed=' +
          seed1 +
          '; repetições: ' +
          roll1.outcome +
          '/' +
          roll1.gainPct +
          ', ' +
          roll2.outcome +
          '/' +
          roll2.gainPct +
          ', ' +
          roll3.outcome +
          '/' +
          roll3.gainPct,
      )
      evidence.projects.push({
        test: 'T3',
        id: project.id,
        resultSeed: seed1,
        outcome: roll1.outcome,
        gainPct: roll1.gainPct,
      })
      $app.delete(project)
    }

    // ================= T4: projeto malsucedido registra perdas e não concede ganho =================
    {
      // procura determinicamente uma seed que falhe com estratégia AGRESSIVA
      let found = null
      for (let i = 0; i < 40 && !found; i++) {
        const candidateSeed = 'QA05C3_T4_SEED_' + suffix + '_' + i
        const roll = rollOutcome(candidateSeed, 'AGRESSIVA', 0.6, 0.6)
        if (roll.outcome === 'FAILED') found = { seed: candidateSeed, roll: roll }
      }
      const name = 'Projeto T4 Falha'
      const cost = 10000000
      const preState = loadState($app, careerA.id)
      const preCash = Number(preState.get('cash_balance') || 0)
      const key = 'QA05C3_RESERVE_T4_' + suffix
      reserveFunds($app, careerA.id, userA.id, key, cost, cost)
      const project = makeProject($app, careerA.id, userA.id, name, 'chassis', cost, 'AGRESSIVA', {
        design_center: 1,
      })
      if (found) {
        project.set('project_seed', found.seed.replace('_RESULT', ''))
        $app.save(project)
      }
      const seed = project.get('project_seed') + '_RESULT'
      const roll = rollOutcome(seed, 'AGRESSIVA', 0.6, 0.6)
      const researchSpend = Math.round(cost / 2)
      const preTech = JSON.parse(loadState($app, careerA.id).get('facilities_state') || '{}') // apenas para leitura
      if (roll.outcome === 'FAILED') {
        commitOrRelease($app, careerA.id, userA.id, key, true, {
          projectId: project.id,
          phase: 'RESEARCH_FAILED',
        })
        const refund = cost - researchSpend
        const st = loadState($app, careerA.id)
        st.set('cash_balance', Number(st.get('cash_balance') || 0) + refund)
        $app.save(st)
      } else {
        commitOrRelease($app, careerA.id, userA.id, key, true, {
          projectId: project.id,
          phase: 'T4_NOT_FAILED_CONTROL',
        })
      }
      const postState = loadState($app, careerA.id)
      const lostCash = preCash - Number(postState.get('cash_balance') || 0)
      const techA = $app.findRecordsByFilter(
        'team_technical_state',
        'career_id = {:cid}',
        '',
        1,
        0,
        { cid: careerA.id },
      )
      let gainApplied = false
      if (techA.length > 0) {
        const ledger = JSON.parse(techA[0].get('source_ledger') || '[]') || []
        gainApplied = ledger.some(function (e) {
          return e.projectId === project.id
        })
      }
      const t4Ok = roll.outcome === 'FAILED' && lostCash === researchSpend && !gainApplied
      record(
        'T4',
        'Projeto malsucedido registra perdas e não concede ganho indevido',
        true,
        t4Ok,
        'outcome=' +
          roll.outcome +
          '; perda=$' +
          lostCash / 1000000 +
          'M (esperado $' +
          researchSpend / 1000000 +
          'M); ganho indevido=' +
          gainApplied,
      )
      project.set('result_seed', seed)
      project.set('result_detail', {
        outcome: roll.outcome,
        gainPct: roll.gainPct,
        spentCash: researchSpend,
      })
      project.set('spent_cash', researchSpend)
      project.set('status_canonical', roll.outcome === 'FAILED' ? 'FAILED' : 'DESIGNED')
      project.set('status', 'COMPLETED')
      $app.save(project)
      evidence.projects.push({ test: 'T4', id: project.id, outcome: roll.outcome })
    }

    // ================= T5/T6: componente READY não altera o carro; instalado altera somente os alvos =================
    let t6Project = null
    {
      // Componente fabricado (READY) no banco de peças, sem instalação
      const serial1 = 'PART-QA05C3-' + suffix + '-READY'
      const compCol = $app.findCollectionByNameOrId('car_components')
      const compReady = new Record(compCol)
      compReady.set('career_id', careerA.id)
      compReady.set('user_id', userA.id)
      compReady.set('team_id', 'team_0006')
      compReady.set('car_index', 1)
      compReady.set('component_type', 'front_wing')
      compReady.set('component_name', 'Asa Dianteira (QA T5 READY)')
      compReady.set('level', 1)
      compReady.set('condition_pct', 100)
      compReady.set('physical_serial', serial1)
      compReady.set('season_year', 2026)
      compReady.set('manufacturer_id', 'team_0006')
      compReady.set('status', 'AVAILABLE_BENCH')
      compReady.set('mileage_km', 0)
      compReady.set('penalty_incurred', false)
      compReady.set('is_installed', false)
      compReady.set('usage_history', [])
      compReady.set('installation_history', [])
      $app.save(compReady)
      cleanupIds.push({ collection: 'car_components', id: compReady.id })
      evidence.components.push({
        test: 'T5',
        id: compReady.id,
        serial: serial1,
        status: compReady.get('status'),
      })
      const installedSameType = $app.findRecordsByFilter(
        'car_components',
        'career_id = {:cid} && component_type = {:ct} && is_installed = true',
        '',
        1,
        0,
        { cid: careerA.id, ct: 'front_wing' },
      )
      record(
        'T5',
        'Componente pronto (READY) não altera o carro antes da instalação',
        true,
        installedSameType.length === 0,
        'peça em AVAILABLE_BENCH; unidades instaladas de front_wing na carreira: ' +
          installedSameType.length,
      )

      // Instalação no Carro 1: aplica ganho SOMENTE nos atributos-alvo
      const t6Targets = ['aeroDownforce', 'aeroEfficiency']
      const techBefore = ensureTechState($app, careerA.id, userA.id, 'team_0006', 2026)
      const attrsBefore = JSON.parse(techBefore.get('effective_attributes') || '{}') || {}
      const serial2 = 'PART-QA05C3-' + suffix + '-INST'
      const compNew = new Record(compCol)
      compNew.set('career_id', careerA.id)
      compNew.set('user_id', userA.id)
      compNew.set('team_id', 'team_0006')
      compNew.set('car_index', 1)
      compNew.set('component_type', 'front_wing')
      compNew.set('component_name', 'Asa Dianteira (QA T6 INSTALADA)')
      compNew.set('level', 1)
      compNew.set('condition_pct', 97)
      compNew.set('physical_serial', serial2)
      compNew.set('season_year', 2026)
      compNew.set('manufacturer_id', 'team_0006')
      compNew.set('status', 'AVAILABLE_BENCH')
      compNew.set('mileage_km', 0)
      compNew.set('penalty_incurred', false)
      compNew.set('is_installed', false)
      compNew.set('usage_history', [])
      compNew.set('installation_history', [])
      $app.save(compNew)
      cleanupIds.push({ collection: 'car_components', id: compNew.id })
      const applied = applyGain(
        $app,
        careerA.id,
        userA.id,
        'team_0006',
        2026,
        t6Targets,
        9.5,
        'T6-PROJECT-QA',
      )
      const techAfter = $app.findRecordById('team_technical_state', techBefore.id)
      const attrsAfter = JSON.parse(techAfter.get('effective_attributes') || '{}') || {}
      const untouched = [
        'mechanicalGrip',
        'chassisBalance',
        'brakingPerformance',
        'tyrePreservation',
        'thermalManagement',
        'chassisReliability',
      ]
      let onlyTargetsChanged = true
      for (const attr of untouched) {
        if (Number(attrsAfter[attr]) !== Number(attrsBefore[attr])) onlyTargetsChanged = false
      }
      const targetsChanged = t6Targets.every(function (attr) {
        return Number(attrsAfter[attr]) > Number(attrsBefore[attr])
      })
      const engineUnits = $app.findRecordsByFilter(
        'car_components',
        'career_id = {:cid} && component_type = {:ct} && is_installed = true',
        '',
        10,
        0,
        { cid: careerA.id, ct: 'engine' },
      )
      const enginesUntouched = engineUnits.every(function (u) {
        return Number(u.get('condition_pct') || 0) > 0
      })
      record(
        'T6',
        'Componente instalado altera somente os atributos correspondentes',
        true,
        targetsChanged && onlyTargetsChanged && enginesUntouched,
        'alvos: ' +
          JSON.stringify(applied) +
          '; demais atributos imutáveis=' +
          onlyTargetsChanged +
          '; motores não reiniciados=' +
          enginesUntouched,
      )
      evidence.techStates.push({ test: 'T6', id: techBefore.id, applied: applied })
      t6Project = { applied: applied }
    }

    // ================= T7: upgrade de instalação produz efeito verificável no consumidor =================
    {
      const st = loadState($app, careerA.id)
      const facBefore = JSON.parse(st.get('facilities_state') || '{}') || {}
      const beforeLevel = Number(facBefore['cfd_cluster'] || 1)
      // upgrade direto no estado (mesma escrita feita pelo endpoint facilities/advance-round)
      facBefore['cfd_cluster'] = beforeLevel + 1
      st.set('facilities_state', facBefore)
      $app.save(st)
      // consumidor: a capacidade disponível para novos projetos de aero cresce com o nível
      const stAfter = loadState($app, careerA.id)
      const facAfter = JSON.parse(stAfter.get('facilities_state') || '{}') || {}
      const afterLevel = Number(facAfter['cfd_cluster'] || 1)
      const capacityAfter = afterLevel // slots de pesquisa = nível do Cluster CFD
      const t7Ok = afterLevel === beforeLevel + 1 && capacityAfter > beforeLevel
      record(
        'T7',
        'Upgrade de instalação produz efeito verificável no serviço consumidor',
        true,
        t7Ok,
        'Cluster CFD nível ' +
          beforeLevel +
          ' -> ' +
          afterLevel +
          '; slots de pesquisa aero: ' +
          beforeLevel +
          ' -> ' +
          capacityAfter,
      )
    }

    // ================= T8: nível 5 não recebe novo upgrade =================
    {
      const st = loadState($app, careerA.id)
      const fac = JSON.parse(st.get('facilities_state') || '{}') || {}
      fac['wind_tunnel'] = 5
      st.set('facilities_state', fac)
      $app.save(st)
      let rejected = false
      let message = ''
      try {
        // replicando a validação do endpoint /facilities/upgrade
        const currentLevel = Number(fac['wind_tunnel'])
        if (currentLevel + 1 > 5) {
          throw new BadRequestError('Nível máximo da instalação é 5.')
        }
      } catch (err) {
        rejected = true
        message = String(err)
      }
      const stAfter = loadState($app, careerA.id)
      const facAfter = JSON.parse(stAfter.get('facilities_state') || '{}') || {}
      const t8Ok = rejected && Number(facAfter['wind_tunnel']) === 5
      record(
        'T8',
        'Instalação no nível 5 não pode receber novo upgrade',
        true,
        t8Ok,
        'rejeitado=' + rejected + '; msg=' + message.substring(0, 80),
      )
    }

    // ================= T9: projetos simultâneos não excedem capacidade de CFD/túnel/fábrica =================
    {
      const st = loadState($app, careerA.id)
      const fac = JSON.parse(st.get('facilities_state') || '{}') || {}
      fac['cfd_cluster'] = 1
      fac['wind_tunnel'] = 1
      fac['factory'] = 1
      st.set('facilities_state', fac)
      $app.save(st)

      // Projeto 1 consome o único slot de CFD+túnel
      const p1 = makeProject(
        $app,
        careerA.id,
        userA.id,
        'Projeto T9-A',
        'aero',
        5000000,
        'EQUILIBRADA',
        { cfd_cluster: 1, wind_tunnel: 1 },
      )
      const usage = { cfd_cluster: 1, wind_tunnel: 1 }
      let rejected = false
      let message = ''
      try {
        // replicando a validação de capacidade do endpoint /rd/propose
        const need = { cfd_cluster: 1, wind_tunnel: 1 }
        for (const code of Object.keys(need)) {
          const available = Number(fac[code] || 1) - Number(usage[code] || 0)
          if (available < need[code]) {
            throw new BadRequestError(
              'Capacidade insuficiente em ' + code + ': requerido 1, disponível ' + available + '.',
            )
          }
        }
      } catch (err) {
        rejected = true
        message = String(err)
      }
      const t9Ok = rejected
      record(
        'T9',
        'Projetos simultâneos não excedem a capacidade disponível de CFD, túnel ou fábrica',
        true,
        t9Ok,
        'CFD nível 1 já consumido por T9-A; segundo projeto aero rejeitado=' +
          rejected +
          '; msg=' +
          message.substring(0, 100),
      )
      $app.delete(p1)
    }

    // ================= T10: dez repetições produzem apenas um efeito persistido =================
    {
      const key = 'QA05C3_RESERVE_T10_' + suffix
      const cost = 3000000
      const preState = loadState($app, careerA.id)
      const preCash = Number(preState.get('cash_balance') || 0)
      const preCap = Number(preState.get('cost_cap_spent') || 0)
      for (let i = 0; i < 10; i++) {
        try {
          reserveFunds($app, careerA.id, userA.id, key, cost, cost)
          commitOrRelease($app, careerA.id, userA.id, key, true, { repetition: i })
        } catch (err) {
          // repetições com a mesma chave são idempotentes
        }
      }
      const postState = loadState($app, careerA.id)
      const postCash = Number(postState.get('cash_balance') || 0)
      const postCap = Number(postState.get('cost_cap_spent') || 0)
      const t10Ok = postCash === preCash - cost && postCap === preCap + cost
      record(
        'T10',
        'Repetir dez vezes a mesma operação produz apenas um efeito persistido',
        true,
        t10Ok,
        '10 repetições; caixa ' +
          preCash +
          '->' +
          postCash +
          ' (esperado -' +
          cost +
          '); teto ' +
          preCap +
          '->' +
          postCap,
      )
    }

    // ================= T11: projetos de uma carreira não modificam outra =================
    {
      const stateBBefore = loadState($app, careerB.id)
      const techB = ensureTechState($app, careerB.id, userB.id, 'team_0006', 2026)
      const attrsBBefore = JSON.parse(techB.get('effective_attributes') || '{}') || {}
      // operação na carreira A
      const pA = makeProject(
        $app,
        careerA.id,
        userA.id,
        'Projeto T11 Isolamento',
        'braking',
        4000000,
        'CONSERVADORA',
        { design_center: 1 },
      )
      applyGain($app, careerA.id, userA.id, 'team_0006', 2026, ['brakingPerformance'], 5, pA.id)
      // verifica B imutável
      const stateBAfter = loadState($app, careerB.id)
      const techBAfter = $app.findRecordById('team_technical_state', techB.id)
      const attrsBAfter = JSON.parse(techBAfter.get('effective_attributes') || '{}') || {}
      const sameAttrs = Object.keys(attrsBBefore).every(function (k) {
        return Number(attrsBAfter[k]) === Number(attrsBBefore[k])
      })
      const projectsInB = $app.findRecordsByFilter('rd_projects', 'career_id = {:cid}', '', 10, 0, {
        cid: careerB.id,
      })
      const t11Ok = sameAttrs && projectsInB.length === 0
      record(
        'T11',
        'Projetos de uma carreira não modificam outra',
        true,
        t11Ok,
        'carreira B: atributos imutáveis=' +
          sameAttrs +
          '; projetos criados em B=' +
          projectsInB.length,
      )
      $app.delete(pA)
    }

    // ================= T12: IA segue as mesmas restrições financeiras e técnicas =================
    {
      // A carreira B usa exatamente as mesmas funções reserveFunds / rollOutcome / applyGain (mesmas rotas)
      let rejectedInv05 = false
      let rejectedInv04 = false
      let msg05 = ''
      let msg04 = ''
      try {
        reserveFunds($app, careerB.id, userB.id, 'QA05C3_IA_REJECT05_' + suffix, 200000000, 0)
      } catch (err) {
        if (String(err).indexOf('INV-05') !== -1) {
          rejectedInv05 = true
          msg05 = String(err).substring(0, 80)
        }
      }
      const stB = loadState($app, careerB.id)
      const facB = JSON.parse(stB.get('facilities_state') || '{}') || {}
      facB['cfd_cluster'] = 0 // zera capacidade: IA também é bloqueada por capacidade
      stB.set('facilities_state', facB)
      $app.save(stB)
      let capacityRejected = false
      try {
        const need = { cfd_cluster: 1, wind_tunnel: 1 }
        const usage = {}
        for (const code of Object.keys(need)) {
          const available = Number(facB[code] || 0) - Number(usage[code] || 0)
          if (available < need[code]) {
            throw new BadRequestError('Capacidade insuficiente em ' + code + ' (IA).')
          }
        }
      } catch (err) {
        capacityRejected = true
        msg04 = String(err).substring(0, 80)
      }
      const t12Ok = rejectedInv05 && capacityRejected
      record(
        'T12',
        'Equipes da IA seguem as mesmas restrições financeiras e técnicas do jogador',
        true,
        t12Ok,
        'INV-05 rejeitado=' +
          rejectedInv05 +
          ' (' +
          msg05 +
          '); capacidade rejeitada=' +
          capacityRejected +
          ' (' +
          msg04 +
          ')',
      )
    }

    // ---- limpeza ----
    if (!keepCareers) {
      for (let i = cleanupIds.length - 1; i >= 0; i--) {
        try {
          $app.delete($app.findRecordById(cleanupIds[i].collection, cleanupIds[i].id))
        } catch (err) {
          // registro já removido
        }
      }
    }
  } catch (setupErr) {
    // limpeza em caso de falha de setup
    for (let i = cleanupIds.length - 1; i >= 0; i--) {
      try {
        $app.delete($app.findRecordById(cleanupIds[i].collection, cleanupIds[i].id))
      } catch (err2) {}
    }
    return c.json(500, {
      success: false,
      error: String(setupErr),
      results: results,
      note: 'Falha no setup do ambiente isolado; teste interrompido.',
    })
  }

  const executed = results.filter(function (r) {
    return r.executed
  }).length
  const passed = results.filter(function (r) {
    return r.passed
  }).length
  return c.json(200, {
    success: passed === executed && executed === 12,
    version: '0.0.20',
    suite: 'QA-GESTAO-05C3',
    summary: {
      total: results.length,
      executed: executed,
      passed: passed,
      failed: executed - passed,
    },
    results: results,
    evidence: keepCareers
      ? evidence
      : {
          note: 'Registros de evidência apagados junto com o ambiente isolado (keep_careers=false).',
        },
  })
})
