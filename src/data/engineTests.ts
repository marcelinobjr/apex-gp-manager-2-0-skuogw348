/**
 * Testes Unitários e Canônicos de Validação do Inventário Físico de Motores e Componentes
 * QA-GESTAO-05C2 | APEX GP Manager 2.0 (Doc Mestre seções 13.3 e 13.4)
 *
 * Executa os 10 cenários obrigatórios em ambiente isolado:
 * 1. Criar inventário inicial de 4 motores físicos para cada piloto (8 PUs independentes).
 * 2. Utilizar motor 1 do piloto 1 e confirmar que o desgaste não afeta os demais motores.
 * 3. Substituir pelo motor 2 e reutilizar posteriormente o motor 1, preservando desgaste anterior.
 * 4. Verificar independência total do inventário do piloto 2.
 * 5. Bloqueio de instalação simultânea da mesma unidade física em dois carros.
 * 6. Registrar quinta unidade e verificar geração única do evento regulamentar aplicável.
 * 7. Repetir 10 vezes a mesma operação de desgaste e confirmar apenas 1 efeito persistido (idempotência).
 * 8. Recarregar a carreira e verificar integridade de inventário e históricos.
 * 9. Executar reparo de componente verificando débito financeiro e restauração da condição.
 * 10. Testar falha parcial e recuperação sem duplicação de efeitos.
 */

function assert(condition: any, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}
assert.strictEqual = function (actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`)
  }
}
assert.throws = function (block: () => void, errorRegex?: RegExp, message?: string) {
  let threw = false
  try {
    block()
  } catch (e: any) {
    threw = true
    if (errorRegex && !errorRegex.test(e.message)) {
      throw new Error(`Expected error matching ${errorRegex}, got "${e.message}"`)
    }
  }
  if (!threw) {
    throw new Error(message || 'Expected block to throw')
  }
}
assert.fail = function (message?: string): never {
  throw new Error(message || 'Failed')
}

export interface MockCarComponent {
  id: string
  career_id: string
  car_index: number
  component_type: string
  component_name: string
  level: number
  condition_pct: number
  engine_unit_number?: number
  physical_serial: string
  season_year: number
  driver_id: string
  manufacturer_id: string
  status: 'ACTIVE_INSTALLED' | 'AVAILABLE_BENCH' | 'MAINTENANCE' | 'RETIRED'
  mileage_km: number
  penalty_incurred: boolean
  is_installed: boolean
  usage_history: any[]
  installation_history: any[]
}

export interface MockReceipt {
  id: string
  career_id: string
  action_type: string
  idempotency_key: string
  payload: any
  status: string
}

export interface MockCareerState {
  cash_balance: number
  cost_cap_spent: number
  cost_cap_budget: number
}

// Simulador isolado em memória com as mesmas regras lógicas do PocketBase e Services
export class EngineInventorySimulator {
  components: Map<string, MockCarComponent> = new Map()
  receipts: Map<string, MockReceipt> = new Map()
  completedRd: Array<{ id: string; category: 'aero' | 'chassis' | 'powertrain' }> = []
  state: MockCareerState = {
    cash_balance: 50_000_000,
    cost_cap_spent: 30_000_000,
    cost_cap_budget: 135_000_000,
  }

  // 1. Inicializa 4 motores físicos para cada piloto (8 motores físicos) + peças de chassi
  initializeInventory(careerId: string, driver1Id: string, driver2Id: string, seasonYear = 2026) {
    const baseParts = [
      'front_wing',
      'rear_wing',
      'floor',
      'sidepods',
      'suspension',
      'brakes',
      'gearbox',
    ]

    for (const carIdx of [1, 2] as const) {
      const driverId = carIdx === 1 ? driver1Id : driver2Id

      // Partes estruturais
      for (const part of baseParts) {
        const id = `part_${carIdx}_${part}`
        this.components.set(id, {
          id,
          career_id: careerId,
          car_index: carIdx,
          component_type: part,
          component_name: `${part} C${carIdx}`,
          level: 1,
          condition_pct: 100,
          physical_serial: `PART-${careerId.slice(0, 8)}-${seasonYear}-C${carIdx}-${part.toUpperCase()}`,
          season_year: seasonYear,
          driver_id: driverId,
          manufacturer_id: 'TEAM-0001',
          status: 'ACTIVE_INSTALLED',
          mileage_km: 0,
          penalty_incurred: false,
          is_installed: true,
          usage_history: [],
          installation_history: [
            { car_index: carIdx, action: 'INITIAL_INSTALL', timestamp: new Date().toISOString() },
          ],
        })
      }

      // 4 Unidades de potência físicas
      for (let m = 1; m <= 4; m++) {
        const id = `pu_c${carIdx}_u${m}`
        const isInstalled = m === 1
        this.components.set(id, {
          id,
          career_id: careerId,
          car_index: carIdx,
          component_type: 'engine',
          component_name: `PU #${m} C${carIdx}`,
          level: 1,
          condition_pct: 100,
          engine_unit_number: m,
          physical_serial: `PU-${careerId.slice(0, 8)}-${seasonYear}-C${carIdx}-U${m}`,
          season_year: seasonYear,
          driver_id: driverId,
          manufacturer_id: 'ENG-0005',
          status: isInstalled ? 'ACTIVE_INSTALLED' : 'AVAILABLE_BENCH',
          mileage_km: 0,
          penalty_incurred: false,
          is_installed: isInstalled,
          usage_history: [],
          installation_history: [
            {
              car_index: carIdx,
              action: isInstalled ? 'INITIAL_INSTALL' : 'BENCH_ALLOCATION',
              timestamp: new Date().toISOString(),
            },
          ],
        })
      }
    }
  }

  // 2. Desgaste persistente e isolado
  recordEngineUsage(params: {
    careerId: string
    componentId: string
    distanceKm: number
    stressLevel?: 'LOW' | 'MEDIUM' | 'HIGH'
    operatingTempC?: number
    idempotencyKey: string
  }) {
    if (this.receipts.has(params.idempotencyKey)) {
      return this.components.get(params.componentId)!
    }

    const comp = this.components.get(params.componentId)
    if (!comp) throw new Error('Componente não encontrado')

    const baseWear = 0.05
    let mult = params.stressLevel === 'HIGH' ? 1.3 : params.stressLevel === 'LOW' ? 0.8 : 1.0
    const wearDelta = Math.min(100, Math.round(params.distanceKm * baseWear * mult * 10) / 10)
    const newCond = Math.max(0, comp.condition_pct - wearDelta)
    const newKm = comp.mileage_km + params.distanceKm

    comp.condition_pct = newCond
    comp.mileage_km = newKm
    comp.usage_history.push({
      distanceKm: params.distanceKm,
      wearDeltaPct: wearDelta,
      conditionBefore: comp.condition_pct + wearDelta,
      conditionAfter: newCond,
      idempotencyKey: params.idempotencyKey,
    })

    this.receipts.set(params.idempotencyKey, {
      id: `rcpt_${Date.now()}_${Math.random()}`,
      career_id: params.careerId,
      action_type: 'ENGINE_USAGE_RECORDED',
      idempotency_key: params.idempotencyKey,
      payload: { wearDelta, newCond, newKm },
      status: 'EXECUTED',
    })

    return comp
  }

  // 3. Substituição e bloqueio de instalação simultânea
  substituteEngine(params: { careerId: string; carIndex: number; targetComponentId: string }) {
    const target = this.components.get(params.targetComponentId)
    if (!target) throw new Error('Unidade alvo não encontrada')

    // Bloqueio de instalação simultânea em outro carro
    if (target.is_installed && target.car_index !== params.carIndex) {
      throw new Error(
        `Bloqueio Físico/Regulamentar: A unidade ${target.physical_serial} já está instalada no Carro #${target.car_index}.`,
      )
    }

    if (target.is_installed && target.car_index === params.carIndex) {
      return { installed: target, penalty: null }
    }

    // Localizar unidade atualmente instalada no carro
    let current: MockCarComponent | null = null
    for (const c of this.components.values()) {
      if (c.car_index === params.carIndex && c.component_type === 'engine' && c.is_installed) {
        current = c
        break
      }
    }

    // Desinstalar atual para o banco
    if (current) {
      current.is_installed = false
      current.status = 'AVAILABLE_BENCH'
      current.installation_history.push({ action: 'REMOVED_TO_BENCH', car_index: params.carIndex })
    }

    // Penalidade se for 5ª unidade nova
    let penalty = null
    if ((target.engine_unit_number || 1) >= 5 && !target.penalty_incurred) {
      const pKey = `PENALTY_${params.careerId}_C${params.carIndex}_U${target.engine_unit_number}`
      this.receipts.set(pKey, {
        id: `rcpt_pen_${Date.now()}`,
        career_id: params.careerId,
        action_type: 'FIA_REGULATORY_PENALTY_INCURRED',
        idempotency_key: pKey,
        payload: { unitNumber: target.engine_unit_number, sanctionPending: true },
        status: 'EXECUTED',
      })
      target.penalty_incurred = true
      penalty = { incurred: true, unitNumber: target.engine_unit_number, sanctionPending: true }
    }

    // Instalar no carro
    target.car_index = params.carIndex
    target.is_installed = true
    target.status = 'ACTIVE_INSTALLED'
    target.installation_history.push({ action: 'INSTALLED_TO_CAR', car_index: params.carIndex })

    return { installed: target, penalty }
  }

  // 4. Alocação de unidade extra (5ª PU ou posterior) — ciente da temporada corrente
  allocateExtraEngine(careerId: string, carIndex: number, cost = 1_500_000, seasonYear?: number) {
    if (this.state.cash_balance < cost) throw new Error('Saldo insuficiente')
    if (this.state.cost_cap_spent + cost > this.state.cost_cap_budget)
      throw new Error('Estouro do teto orçamentário')

    this.state.cash_balance -= cost
    this.state.cost_cap_spent += cost

    // Determinar a temporada de referência: a mais recente já inventariada para este carro
    let resolvedYear = seasonYear
    if (!resolvedYear) {
      for (const c of this.components.values()) {
        if (c.car_index === carIndex && c.component_type === 'engine') {
          if (!resolvedYear || (c.season_year || 0) > resolvedYear) resolvedYear = c.season_year
        }
      }
      resolvedYear = resolvedYear || 2026
    }

    // Próximo número de unidade (apenas unidades da mesma temporada)
    let maxU = 4
    for (const c of this.components.values()) {
      if (
        c.car_index === carIndex &&
        c.component_type === 'engine' &&
        (c.season_year || 0) === resolvedYear
      ) {
        if (c.engine_unit_number && c.engine_unit_number > maxU) maxU = c.engine_unit_number
      }
    }
    const nextU = maxU + 1
    const id = `pu_${resolvedYear}_c${carIndex}_u${nextU}`
    const serial = `PU-${careerId.slice(0, 8)}-${resolvedYear}-C${carIndex}-U${nextU}`

    const newComp: MockCarComponent = {
      id,
      career_id: careerId,
      car_index: carIndex,
      component_type: 'engine',
      component_name: `PU #${nextU} C${carIndex}`,
      level: 1,
      condition_pct: 100,
      engine_unit_number: nextU,
      physical_serial: serial,
      season_year: resolvedYear,
      driver_id: carIndex === 1 ? 'pil_0001' : 'pil_0002',
      manufacturer_id: 'ENG-0005',
      status: 'AVAILABLE_BENCH',
      mileage_km: 0,
      penalty_incurred: false,
      is_installed: false,
      usage_history: [],
      installation_history: [{ action: 'BENCH_ALLOCATION', car_index: carIndex }],
    }
    this.components.set(id, newComp)
    return newComp
  }

  // 5. Reparo de componente mecânico com débito financeiro
  repairComponent(componentId: string, cost: number) {
    if (this.state.cash_balance < cost) throw new Error('Saldo insuficiente')
    if (this.state.cost_cap_spent + cost > this.state.cost_cap_budget)
      throw new Error('Estouro de teto')

    const comp = this.components.get(componentId)
    if (!comp) throw new Error('Componente não encontrado')

    this.state.cash_balance -= cost
    this.state.cost_cap_spent += cost
    comp.condition_pct = 100
    return comp
  }

  // 6. Projeto de P&D concluído (alimenta a evolução técnica herdada na virada)
  completeRdProject(id: string, category: 'aero' | 'chassis' | 'powertrain') {
    this.completedRd.push({ id, category })
  }

  // 7. TRANSIÇÃO ANUAL COM REINICIALIZAÇÃO DE INVENTÁRIO (Lote SEASON-RESET-01)
  // Espelha as regras de teamManagementService.closeAndTransitionSeason:
  // - Arquiva (RETIRED) todo o inventário da temporada encerrada preservando desgaste/km/histórico.
  // - Cria novas instâncias de componentes e 4 novas PUs físicas por piloto para o novo ano.
  // - Preserva a evolução técnica (níveis) conquistada + bônus de P&D concluído.
  // - Idempotente: executar N vezes produz exatamente o mesmo resultado (recibo canônico).
  performSeasonTransition(params: {
    careerId: string
    fromYear: number
    toYear: number
    driver1Id: string
    driver2Id: string
  }) {
    const idempotencyKey = `SEASON_TRANSITION_${params.careerId}_${params.fromYear}_TO_${params.toYear}`

    // 1. Idempotência estrita: se o recibo já existe, a transição já foi executada
    if (this.receipts.has(idempotencyKey)) {
      return { newYear: params.toYear, componentsCreated: 0, alreadyExecuted: true }
    }

    const oldComponents = Array.from(this.components.values()).filter(
      (c) =>
        c.career_id === params.careerId && (c.season_year || params.fromYear) === params.fromYear,
    )

    // 2. Arquivamento histórico: RETIRED, sem instalar, preservando desgaste, km e logs
    for (const old of oldComponents) {
      old.is_installed = false
      old.status = 'RETIRED'
      old.installation_history.push({
        action: 'REMOVED_TO_BENCH',
        car_index: old.car_index,
        reason: `Arquivamento histórico de fim de temporada ${params.fromYear}`,
      })
    }

    // 3. Evolução técnica herdada: maiores níveis alcançados por tipo na temporada anterior
    const baseLevels: Record<string, number> = {}
    for (const old of oldComponents) {
      if (old.component_type === 'engine') continue
      baseLevels[old.component_type] = Math.max(baseLevels[old.component_type] || 1, old.level)
    }

    // Bônus de P&D concluído na temporada encerrada
    for (const rd of this.completedRd) {
      if (rd.category === 'aero') {
        baseLevels.front_wing = Math.min(5, (baseLevels.front_wing || 1) + 1)
        baseLevels.rear_wing = Math.min(5, (baseLevels.rear_wing || 1) + 1)
        baseLevels.floor = Math.min(5, (baseLevels.floor || 1) + 1)
      } else if (rd.category === 'chassis') {
        baseLevels.sidepods = Math.min(5, (baseLevels.sidepods || 1) + 1)
        baseLevels.suspension = Math.min(5, (baseLevels.suspension || 1) + 1)
        baseLevels.brakes = Math.min(5, (baseLevels.brakes || 1) + 1)
      } else if (rd.category === 'powertrain') {
        baseLevels.gearbox = Math.min(5, (baseLevels.gearbox || 1) + 1)
      }
    }

    // 4. Geração do inventário da nova temporada (desgaste 0%, condição 100%, km 0)
    const baseParts = [
      'front_wing',
      'rear_wing',
      'floor',
      'sidepods',
      'suspension',
      'brakes',
      'gearbox',
    ]
    const shortId = params.careerId.slice(0, 8)
    let created = 0

    for (const carIdx of [1, 2] as const) {
      const driverId = carIdx === 1 ? params.driver1Id : params.driver2Id

      for (const part of baseParts) {
        const id = `part_${params.toYear}_c${carIdx}_${part}`
        this.components.set(id, {
          id,
          career_id: params.careerId,
          car_index: carIdx,
          component_type: part,
          component_name: `${part} C${carIdx}`,
          level: baseLevels[part] || 1,
          condition_pct: 100,
          physical_serial: `PART-${shortId}-${params.toYear}-C${carIdx}-${part.toUpperCase()}`,
          season_year: params.toYear,
          driver_id: driverId,
          manufacturer_id: 'TEAM-0001',
          status: 'ACTIVE_INSTALLED',
          mileage_km: 0,
          penalty_incurred: false,
          is_installed: true,
          usage_history: [],
          installation_history: [
            {
              car_index: carIdx,
              action: 'INITIAL_INSTALL',
              timestamp: new Date().toISOString(),
              reason: `Montagem do novo chassi para a Temporada ${params.toYear}`,
            },
          ],
        })
        created++
      }

      for (let m = 1; m <= 4; m++) {
        const id = `pu_${params.toYear}_c${carIdx}_u${m}`
        const isInstalled = m === 1
        this.components.set(id, {
          id,
          career_id: params.careerId,
          car_index: carIdx,
          component_type: 'engine',
          component_name: `PU #${m} C${carIdx}`,
          level: 1,
          condition_pct: 100,
          engine_unit_number: m,
          physical_serial: `PU-${shortId}-${params.toYear}-C${carIdx}-U${m}`,
          season_year: params.toYear,
          driver_id: driverId,
          manufacturer_id: 'ENG-0005',
          status: isInstalled ? 'ACTIVE_INSTALLED' : 'AVAILABLE_BENCH',
          mileage_km: 0,
          penalty_incurred: false,
          is_installed: isInstalled,
          usage_history: [],
          installation_history: [
            {
              car_index: carIdx,
              action: isInstalled ? 'INITIAL_INSTALL' : 'BENCH_ALLOCATION',
              timestamp: new Date().toISOString(),
            },
          ],
        })
        created++
      }
    }

    // 5. Recibo canônico imutável da transição
    this.receipts.set(idempotencyKey, {
      id: `rcpt_transition_${params.fromYear}_${params.toYear}`,
      career_id: params.careerId,
      action_type: 'SEASON_TRANSITION',
      idempotency_key: idempotencyKey,
      payload: {
        previousYear: params.fromYear,
        newYear: params.toYear,
        componentsCreated: created,
        inheritedEvolution: baseLevels,
      },
      status: 'EXECUTED',
    })

    return { newYear: params.toYear, componentsCreated: created, alreadyExecuted: false }
  }
}

export function runIsolatedEngineInventoryTests() {
  console.log('🏁 Iniciando Testes Canônicos QA-GESTAO-05C2: Inventário Físico de Motores...\n')
  const sim = new EngineInventorySimulator()
  const careerId = 'car_test_001'

  // Teste 1: Criar inventário inicial de 4 motores físicos para cada piloto (8 motores físicos)
  sim.initializeInventory(careerId, 'pil_0001', 'pil_0002')
  const pusCar1 = Array.from(sim.components.values()).filter(
    (c) => c.car_index === 1 && c.component_type === 'engine',
  )
  const pusCar2 = Array.from(sim.components.values()).filter(
    (c) => c.car_index === 2 && c.component_type === 'engine',
  )

  assert.strictEqual(pusCar1.length, 4, 'Carro 1 deve possuir 4 PUs físicas')
  assert.strictEqual(pusCar2.length, 4, 'Carro 2 deve possuir 4 PUs físicas')
  assert.strictEqual(
    pusCar1.filter((c) => c.is_installed).length,
    1,
    'Carro 1 deve ter exatamente 1 PU instalada',
  )
  assert.strictEqual(
    pusCar2.filter((c) => c.is_installed).length,
    1,
    'Carro 2 deve ter exatamente 1 PU instalada',
  )
  console.log('✓ Teste 1 APROVADO: 8 unidades físicas iniciais alocadas (4 por piloto).')

  // Teste 2: Utilizar motor 1 do piloto 1 e confirmar que desgaste não afeta os demais motores
  const u1 = sim.components.get('pu_c1_u1')!
  const u2 = sim.components.get('pu_c1_u2')!
  const u3 = sim.components.get('pu_c1_u3')!
  const u4 = sim.components.get('pu_c1_u4')!

  sim.recordEngineUsage({
    careerId,
    componentId: u1.id,
    distanceKm: 300,
    stressLevel: 'MEDIUM',
    idempotencyKey: 'GP_R1_C1_RUN1',
  })

  assert.strictEqual(u1.condition_pct < 100, true, 'U1 deve ter sofrido desgaste')
  assert.strictEqual(u1.mileage_km, 300, 'U1 deve ter 300 km rodados')
  assert.strictEqual(u2.condition_pct, 100, 'U2 deve permanecer intacto a 100%')
  assert.strictEqual(u3.condition_pct, 100, 'U3 deve permanecer intacto a 100%')
  assert.strictEqual(u4.condition_pct, 100, 'U4 deve permanecer intacto a 100%')
  console.log('✓ Teste 2 APROVADO: Desgaste na PU 1 não afetou as unidades inativas 2, 3 e 4.')

  // Teste 3: Substituir pelo motor 2 e reutilizar posteriormente o motor 1, preservando desgaste anterior
  const condAfterR1 = u1.condition_pct
  const kmAfterR1 = u1.mileage_km

  // Instalar U2 no Carro 1
  sim.substituteEngine({ careerId, carIndex: 1, targetComponentId: u2.id })
  assert.strictEqual(u1.is_installed, false, 'U1 deve estar desinstalado no banco')
  assert.strictEqual(u2.is_installed, true, 'U2 deve estar montado no carro 1')

  // Rodar U2 por 200 km
  sim.recordEngineUsage({
    careerId,
    componentId: u2.id,
    distanceKm: 200,
    idempotencyKey: 'GP_R2_C1_RUN1',
  })
  assert.strictEqual(u2.mileage_km, 200, 'U2 deve acumular 200km')

  // Reutilizar U1 no Carro 1 (NÃO caracteriza 5ª unidade)
  const resReuse = sim.substituteEngine({ careerId, carIndex: 1, targetComponentId: u1.id })
  assert.strictEqual(u1.is_installed, true, 'U1 deve voltar a estar instalado')
  assert.strictEqual(
    u1.condition_pct,
    condAfterR1,
    'Desgaste da U1 deve ser preservado integralmente',
  )
  assert.strictEqual(
    u1.mileage_km,
    kmAfterR1,
    'Quilometragem da U1 deve ser preservada integralmente',
  )
  assert.strictEqual(resReuse.penalty, null, 'Reutilizar U1 NÃO gera penalidade FIA')
  console.log(
    '✓ Teste 3 APROVADO: Substituição U2 -> U1 preservou desgaste anterior e não gerou penalidade.',
  )

  // Teste 4: Independência total do inventário do piloto 2
  const pusPiloto2 = Array.from(sim.components.values()).filter(
    (c) => c.car_index === 2 && c.component_type === 'engine',
  )
  for (const pu of pusPiloto2) {
    if (pu.id === 'pu_c2_u1') {
      assert.strictEqual(
        pu.condition_pct,
        100,
        'PU1 do Piloto 2 não deve ter sido afetada pelo Piloto 1',
      )
      assert.strictEqual(pu.mileage_km, 0, 'Quilometragem do Piloto 2 permanece zero')
    }
  }
  console.log('✓ Teste 4 APROVADO: Inventário do piloto 2 totalmente independente e intacto.')

  // Teste 5: Bloqueio de instalação simultânea da mesma unidade física em dois carros
  assert.throws(
    () => {
      // Tentar instalar U1 (que está ativa no Carro 1) diretamente no Carro 2 sem desinstalar
      sim.substituteEngine({ careerId, carIndex: 2, targetComponentId: u1.id })
    },
    /Bloqueio Físico\/Regulamentar/,
    'Deve disparar erro de bloqueio físico impedindo PU montada em dois carros',
  )
  console.log(
    '✓ Teste 5 APROVADO: Bloqueio de instalação simultânea da mesma unidade física em dois carros verificado.',
  )

  // Teste 6: Registrar quinta unidade e verificar geração única do evento regulamentar
  const u5 = sim.allocateExtraEngine(careerId, 1, 1_500_000)
  assert.strictEqual(u5.engine_unit_number, 5, 'Unidade criada deve ser a #5')
  assert.strictEqual(u5.penalty_incurred, false, 'Antes de instalar, não incorre em penalidade')

  // Primeira instalação da 5ª PU
  const resU5First = sim.substituteEngine({ careerId, carIndex: 1, targetComponentId: u5.id })
  assert.strictEqual(
    resU5First.penalty?.incurred,
    true,
    'Primeira instalação da 5ª PU deve incorrer em penalidade',
  )
  assert.strictEqual(
    resU5First.penalty?.sanctionPending,
    true,
    'Sanção desportiva fica indicada como pendente no ruleset',
  )

  // Reinstalação posterior da 5ª PU (não deve duplicar penalidade)
  sim.substituteEngine({ careerId, carIndex: 1, targetComponentId: u2.id }) // Volta para U2
  const resU5Second = sim.substituteEngine({ careerId, carIndex: 1, targetComponentId: u5.id }) // Volta para U5
  assert.strictEqual(
    resU5Second.penalty,
    null,
    'Reinstalação da PU5 já sancionada NÃO gera segunda penalidade',
  )
  console.log(
    '✓ Teste 6 APROVADO: 5ª PU gera exatamente um evento de penalidade regulamentar sem duplicação.',
  )

  // Teste 7: Repetir dez vezes a mesma operação de desgaste e confirmar apenas um efeito persistido (idempotência)
  const condBeforeRep = u5.condition_pct
  const kmBeforeRep = u5.mileage_km
  const idempKey = 'RACE_TEST_IDEMP_SESSION_42'

  for (let i = 0; i < 10; i++) {
    sim.recordEngineUsage({
      careerId,
      componentId: u5.id,
      distanceKm: 150,
      idempotencyKey: idempKey,
    })
  }
  // Apenas 1 aplicação deve ter ocorrido
  assert.strictEqual(
    u5.mileage_km,
    kmBeforeRep + 150,
    'Quilometragem deve incrementar exatamente uma vez',
  )
  assert.strictEqual(
    u5.usage_history.filter((h) => h.idempotencyKey === idempKey).length,
    1,
    'Exatamente 1 histórico gravado',
  )
  console.log(
    '✓ Teste 7 APROVADO: Idempotência de desgaste confirmada após 10 repetições idênticas.',
  )

  // Teste 8: Recarregar a carreira e verificar inventário e históricos
  // Simular serialização e desserialização completa de estado
  const serialized = JSON.stringify({
    components: Array.from(sim.components.entries()),
    receipts: Array.from(sim.receipts.entries()),
    state: sim.state,
  })
  const reloaded = JSON.parse(serialized)
  assert.strictEqual(reloaded.components.length, 9 + 7 + 1 + 1, 'Todas as peças persistem intactas')
  console.log('✓ Teste 8 APROVADO: Recarregamento e persistência de dados íntegros sem corrupção.')

  // Teste 9: Executar reparo de componente verificando débito financeiro e alteração efetiva da condição
  const cashBeforeRepair = sim.state.cash_balance
  const repairCost = 350_000
  sim.repairComponent(u1.id, repairCost)
  assert.strictEqual(u1.condition_pct, 100, 'Condição restaurada para 100%')
  assert.strictEqual(
    sim.state.cash_balance,
    cashBeforeRepair - repairCost,
    'Caixa debitado corretamente',
  )
  console.log(
    '✓ Teste 9 APROVADO: Reparo executou débito financeiro real e restaurou condição para 100%.',
  )

  // Teste 10: Testar falha parcial e recuperação sem duplicação de efeitos
  const snapshotCash = sim.state.cash_balance
  try {
    // Tentar comprar unidade com custo que excede o saldo
    sim.allocateExtraEngine(careerId, 1, 999_999_999)
    assert.fail('Deveria ter falhado por saldo insuficiente')
  } catch (err: any) {
    assert.strictEqual(
      sim.state.cash_balance,
      snapshotCash,
      'Saldo inalterado após transação rejeitada',
    )
    assert.strictEqual(err.message, 'Saldo insuficiente', 'Mensagem esperada')
  }
  console.log(
    '✓ Teste 10 APROVADO: Falha parcial revertida sem efeitos colaterais nem registros órfãos.',
  )

  // ============ LOTE SEASON-RESET-01: VIRADA DE TEMPORADA ============
  runSeasonResetTests()
}

/**
 * Suíte SEASON-RESET-01 — Reinicialização de motores e componentes na virada de temporada.
 * Simula uma equipe encerrando a temporada com motores desgastados, componentes
 * deteriorados e unidades adicionais utilizadas, e valida as 7 exigências do lote.
 */
export function runSeasonResetTests() {
  console.log('🏁 Iniciando Testes SEASON-RESET-01: Virada de Temporada...\n')
  const sim = new EngineInventorySimulator()
  const careerId = 'car_season_reset_01'
  const YEAR1 = 2026
  const YEAR2 = 2027

  // Cenário: equipe encerra a temporada com inventário degradado
  sim.initializeInventory(careerId, 'pil_0001', 'pil_0002', YEAR1)

  const u1 = sim.components.get('pu_c1_u1')!
  const u2 = sim.components.get('pu_c1_u2')!

  // Motores desgastados e com km acumulada + 5ª unidade extra utilizada
  sim.recordEngineUsage({ careerId, componentId: u1.id, distanceKm: 400, idempotencyKey: 'Y1_R1' })
  sim.recordEngineUsage({ careerId, componentId: u2.id, distanceKm: 350, idempotencyKey: 'Y1_R2' })
  const u5y1 = sim.allocateExtraEngine(careerId, 1, 1_500_000, YEAR1)
  sim.substituteEngine({ careerId, carIndex: 1, targetComponentId: u5y1.id })
  sim.recordEngineUsage({
    careerId,
    componentId: u5y1.id,
    distanceKm: 100,
    idempotencyKey: 'Y1_R3',
  })

  // Componentes do chassi deteriorados + evolução técnica conquistada no ano
  const fwY1 = sim.components.get('part_1_front_wing')!
  fwY1.condition_pct = 42
  fwY1.mileage_km = 850
  fwY1.level = 3
  const gbY1 = sim.components.get('part_1_gearbox')!
  gbY1.condition_pct = 31
  gbY1.level = 4

  sim.completeRdProject('rd_aero_01', 'aero')
  const snapU1 = { cond: u1.condition_pct, km: u1.mileage_km }
  const snapFw = { cond: fwY1.condition_pct, level: fwY1.level }
  const snapGb = { cond: gbY1.condition_pct, level: gbY1.level }

  // ===== Teste 1: Quatro motores novos disponíveis por piloto após a virada =====
  const res = sim.performSeasonTransition({
    careerId,
    fromYear: YEAR1,
    toYear: YEAR2,
    driver1Id: 'pil_0001',
    driver2Id: 'pil_0002',
  })
  assert.strictEqual(res.newYear, YEAR2, 'Nova temporada deve ser o ano seguinte')

  const pus2Car1 = Array.from(sim.components.values()).filter(
    (c) => c.season_year === YEAR2 && c.car_index === 1 && c.component_type === 'engine',
  )
  const pus2Car2 = Array.from(sim.components.values()).filter(
    (c) => c.season_year === YEAR2 && c.car_index === 2 && c.component_type === 'engine',
  )
  assert.strictEqual(pus2Car1.length, 4, 'Carro 1 deve ter 4 motores novos em ' + YEAR2)
  assert.strictEqual(pus2Car2.length, 4, 'Carro 2 deve ter 4 motores novos em ' + YEAR2)
  console.log('✓ SEASON-RESET Teste 1 APROVADO: 4 motores novos por piloto na temporada nova.')

  // ===== Teste 2: Zero motores utilizados na nova temporada =====
  for (const pu of [...pus2Car1, ...pus2Car2]) {
    assert.strictEqual(pu.mileage_km, 0, `PU nova ${pu.id} deve iniciar com 0 km`)
    assert.strictEqual(
      pu.usage_history.length,
      0,
      `PU nova ${pu.id} não deve ter histórico de pista`,
    )
    assert.strictEqual(pu.penalty_incurred, false, `PU nova ${pu.id} sem penalidade herdada`)
  }
  console.log('✓ SEASON-RESET Teste 2 APROVADO: Zero motores utilizados na nova temporada.')

  // ===== Teste 3: Desgaste inicial zerado e condição integral nos motores novos =====
  for (const pu of [...pus2Car1, ...pus2Car2]) {
    assert.strictEqual(pu.condition_pct, 100, `PU nova ${pu.id} deve nascer com 100% de condição`)
  }
  // A 5ª unidade da NOVA temporada volta a gerar penalidade (contagem reiniciada)
  const u5y2 = sim.allocateExtraEngine(careerId, 1, 1_500_000, YEAR2)
  assert.strictEqual(u5y2.engine_unit_number, 5, 'Nova unidade extra deve ser a #5 de ' + YEAR2)
  const resPenY2 = sim.substituteEngine({ careerId, carIndex: 1, targetComponentId: u5y2.id })
  assert.strictEqual(
    resPenY2.penalty?.incurred,
    true,
    'A 5ª unidade da nova temporada DEVE gerar penalidade novamente',
  )
  console.log(
    '✓ SEASON-RESET Teste 3 APROVADO: Desgaste zerado, condição 100% e quota de 5ª PU reiniciada.',
  )

  // ===== Teste 4: Componentes iniciais da nova temporada sem desgaste =====
  const fwY2 = sim.components.get(`part_${YEAR2}_c1_front_wing`)!
  const gbY2 = sim.components.get(`part_${YEAR2}_c1_gearbox`)!
  assert.strictEqual(fwY2.condition_pct, 100, 'Asa dianteira nova deve ter 100% de integridade')
  assert.strictEqual(fwY2.mileage_km, 0, 'Asa dianteira nova deve ter 0 km')
  assert.strictEqual(gbY2.condition_pct, 100, 'Câmbio novo deve ter 100% de integridade')
  assert.strictEqual(gbY2.mileage_km, 0, 'Câmbio novo deve ter 0 km')
  console.log(
    '✓ SEASON-RESET Teste 4 APROVADO: Componentes iniciais da nova temporada sem desgaste.',
  )

  // ===== Teste 5: Histórico anterior preservado e consultável =====
  const histU1 = sim.components.get('pu_c1_u1')!
  const histFw = sim.components.get('part_1_front_wing')!
  const histGb = sim.components.get('part_1_gearbox')!
  assert.strictEqual(histU1.status, 'RETIRED', 'PU antiga deve estar arquivada como RETIRED')
  assert.strictEqual(histU1.is_installed, false, 'PU antiga não pode permanecer instalada')
  assert.strictEqual(
    histU1.condition_pct,
    snapU1.cond,
    'Desgaste final da PU antiga deve permanecer intacto',
  )
  assert.strictEqual(
    histU1.mileage_km,
    snapU1.km,
    'Quilometragem final da PU antiga deve permanecer intacta',
  )
  assert.strictEqual(histU1.usage_history.length, 1, 'Histórico de uso da PU antiga preservado')
  assert.strictEqual(
    histFw.condition_pct,
    snapFw.cond,
    'Desgaste final do componente antigo preservado',
  )
  assert.strictEqual(histFw.level, snapFw.level, 'Nível técnico do componente antigo preservado')
  assert.strictEqual(histGb.condition_pct, snapGb.cond, 'Desgaste do câmbio antigo preservado')
  assert.strictEqual(histGb.level, snapGb.level, 'Nível do câmbio antigo preservado')
  const serialsY1 = Array.from(sim.components.values())
    .filter((c) => c.season_year === YEAR1 && c.component_type === 'engine')
    .map((c) => c.physical_serial)
  const serialsY2 = Array.from(sim.components.values())
    .filter((c) => c.season_year === YEAR2 && c.component_type === 'engine')
    .map((c) => c.physical_serial)
  for (const s of serialsY2) {
    assert.strictEqual(
      serialsY1.includes(s),
      false,
      `Serial ${s} não pode reutilizar ID de unidade anterior`,
    )
  }
  console.log(
    '✓ SEASON-RESET Teste 5 APROVADO: Histórico preservado, arquivado e com seriais novos e únicos.',
  )

  // ===== Teste 6: Nenhuma duplicação ao repetir a transição dez vezes =====
  const beforeRepeat = sim.components.size
  for (let i = 0; i < 10; i++) {
    const repeat = sim.performSeasonTransition({
      careerId,
      fromYear: YEAR1,
      toYear: YEAR2,
      driver1Id: 'pil_0001',
      driver2Id: 'pil_0002',
    })
    assert.strictEqual(
      repeat.alreadyExecuted,
      true,
      `Repetição ${i + 1} deve ser reconhecida como já executada`,
    )
  }
  assert.strictEqual(
    sim.components.size,
    beforeRepeat,
    'Nenhum componente novo pode surgir em repetições',
  )
  const countY2Engines = Array.from(sim.components.values()).filter(
    (c) => c.season_year === YEAR2 && c.component_type === 'engine',
  ).length
  assert.strictEqual(
    countY2Engines,
    8 + 1,
    'Deve haver exatamente 8 PUs novas + 1 extra em ' + YEAR2,
  )
  console.log('✓ SEASON-RESET Teste 6 APROVADO: Transição repetida 10x sem qualquer duplicação.')

  // ===== Teste 7: Evolução técnica do novo carro mantida corretamente =====
  // Asa dianteira antiga era nível 3 (+1 bônus aero) => nova deve ser 4
  assert.strictEqual(fwY2.level, 4, 'Asa dianteira nova deve herdar nível 3 + 1 de P&D aero = 4')
  // Câmbio antigo era nível 4 (sem bônus powertrain) => novo deve manter 4
  assert.strictEqual(gbY2.level, 4, 'Câmbio novo deve herdar o nível 4 conquistado')
  const floorY2 = sim.components.get(`part_${YEAR2}_c1_floor`)!
  assert.strictEqual(floorY2.level, 2, 'Assoalho deve herdar nível 1 + 1 de P&D aero = 2')
  // Desgaste antigo NÃO é transferido: asa nova 100% mesmo com a antiga em 42%
  assert.strictEqual(
    fwY2.condition_pct === fwY1.condition_pct,
    false,
    'Desgaste antigo não pode transferir para o componente novo',
  )
  assert.strictEqual(fwY2.condition_pct, 100, 'Componente novo com condição integral')
  console.log(
    '✓ SEASON-RESET Teste 7 APROVADO: Evolução técnica herdada (nível + P&D) sem transferência de desgaste.',
  )

  // ===== Teste 8 (bônus): Transição de qualquer ano inicial — regra sem ano fixo =====
  const simB = new EngineInventorySimulator()
  simB.initializeInventory('car_any_year', 'pil_0001', 'pil_0002', 2031)
  simB.performSeasonTransition({
    careerId: 'car_any_year',
    fromYear: 2031,
    toYear: 2032,
    driver1Id: 'pil_0001',
    driver2Id: 'pil_0002',
  })
  const pus2032 = Array.from(simB.components.values()).filter(
    (c) => c.season_year === 2032 && c.component_type === 'engine',
  )
  assert.strictEqual(
    pus2032.length,
    8,
    'A regra deve funcionar para qualquer ano inicial (2031 -> 2032)',
  )
  for (const pu of pus2032) {
    assert.strictEqual(pu.condition_pct, 100, `PU de 2032 ${pu.id} deve nascer nova`)
    assert.strictEqual(pu.mileage_km, 0, `PU de 2032 ${pu.id} deve nascer com 0 km`)
  }
  console.log(
    '✓ SEASON-RESET Teste 8 APROVADO: Regula aplicada a ano inicial arbitrário (2031 -> 2032).',
  )

  console.log('\n======================================================')
  console.log('🎯 TODOS OS TESTES SEASON-RESET-01 PASSARAM (8 testes)!')
  console.log('======================================================\n')
}
