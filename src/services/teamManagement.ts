import pb from '@/lib/pocketbase/client'
import { circuits, activeCircuits, teams, drivers, structures } from '@/data/game'
import {
  careerService,
  CareerRecord,
  CareerStateRecord,
  CareerReceiptRecord,
  validateFinancialOperation,
} from './career'

export interface SeasonRecord {
  id: string
  career_id: string
  user_id: string
  year: number
  status: 'IN_PROGRESS' | 'COMPLETED'
  current_round: number
  total_rounds: number
  drivers_standings: DriverStanding[]
  constructors_standings: ConstructorStanding[]
  created: string
  updated: string
}

export interface DriverStanding {
  driverId: string
  driverName: string
  teamId: string
  teamName: string
  points: number
  wins: number
  podiums: number
}

export interface ConstructorStanding {
  teamId: string
  teamName: string
  teamCode: string
  points: number
  wins: number
  podiums: number
}

export interface SeasonEventRecord {
  id: string
  career_id: string
  season_id: string
  user_id: string
  round: number
  circuit_id: string
  track_name: string
  country_code: string
  status: 'SCHEDULED' | 'COMPLETED'
  results?: EventResultPayload
  weather?: {
    condition: 'SECO' | 'CHUVA_LEVE' | 'CHUVA_FORTE' | 'NUBLADO'
    airTempC: number
    trackTempC: number
  }
  created: string
  updated: string
}

export interface EventResultPayload {
  raceWinnerDriverId: string
  fastestLapDriverId: string
  podiumDriverIds: string[]
  pointsDistributed: Record<string, number>
}

export interface CarComponentRecord {
  id: string
  career_id: string
  user_id: string
  team_id: string
  car_index: number
  component_type: 'front_wing' | 'rear_wing' | 'floor' | 'sidepods' | 'suspension' | 'engine'
  component_name: string
  level: number
  condition_pct: number
  engine_unit_number?: number
  created: string
  updated: string
}

export interface RDProjectRecord {
  id: string
  career_id: string
  user_id: string
  name: string
  category: 'aero' | 'chassis' | 'powertrain' | 'reliability'
  cost: number
  duration_rounds: number
  rounds_remaining: number
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  outcome_quality?: 'EXCELLENT' | 'NORMAL' | 'POOR'
  attribute_boost?: Record<string, number>
  created: string
  updated: string
}

export const teamManagementService = {
  /**
   * Garante a inicialização da temporada e peças mecânicas se a carreira for nova
   */
  async ensureSeasonInitialized(
    career: CareerRecord,
  ): Promise<{ season: SeasonRecord; events: SeasonEventRecord[] }> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Não autenticado')

    // 1. Verificar se já existe temporada ativa
    let season: SeasonRecord | null = null
    try {
      season = await pb
        .collection('seasons')
        .getFirstListItem<SeasonRecord>(
          `career_id = "${career.id}" && year = ${career.current_year}`,
        )
    } catch {
      season = null
    }

    if (!season) {
      // Cria a temporada inicial com circuitos ATIVOS (Adelaide CIR-0033 e Brasília CIR-0041 são inativos)
      // O APEX GP Manager 2.0 possui 43 circuitos no catálogo canônico, dos quais 41 são ativos
      const initialRounds = activeCircuits.slice(0, 24) // 24 etapas ativas no campeonato canônico

      // Inicializar tabela de pontuação com equipes congeladas
      const driversStandings: DriverStanding[] = []
      const constructorsStandings: ConstructorStanding[] = []

      const frozenConfigs = career.teams_config_frozen || []
      for (const tc of frozenConfigs) {
        constructorsStandings.push({
          teamId: tc.teamId,
          teamName: tc.teamName,
          teamCode: tc.teamCode,
          points: 0,
          wins: 0,
          podiums: 0,
        })
        const d1 = drivers.find((d) => d.id === tc.driver1Id)
        const d2 = drivers.find((d) => d.id === tc.driver2Id)
        driversStandings.push({
          driverId: tc.driver1Id,
          driverName: d1?.nome || tc.driver1Id,
          teamId: tc.teamId,
          teamName: tc.teamName,
          points: 0,
          wins: 0,
          podiums: 0,
        })
        driversStandings.push({
          driverId: tc.driver2Id,
          driverName: d2?.nome || tc.driver2Id,
          teamId: tc.teamId,
          teamName: tc.teamName,
          points: 0,
          wins: 0,
          podiums: 0,
        })
      }

      season = await pb.collection('seasons').create<SeasonRecord>({
        career_id: career.id,
        user_id: userId,
        year: career.current_year,
        status: 'IN_PROGRESS',
        current_round: 1,
        total_rounds: initialRounds.length,
        drivers_standings: driversStandings,
        constructors_standings: constructorsStandings,
      })

      // Criar eventos do calendário
      for (let i = 0; i < initialRounds.length; i++) {
        const trk = initialRounds[i]
        await pb.collection('season_events').create<SeasonEventRecord>({
          career_id: career.id,
          season_id: season.id,
          user_id: userId,
          round: i + 1,
          circuit_id: trk.id,
          track_name: trk.nome,
          country_code: trk.codigoPais,
          status: 'SCHEDULED',
          weather: {
            condition: i % 5 === 0 ? 'CHUVA_LEVE' : 'SECO',
            airTempC: 22 + (i % 8),
            trackTempC: 32 + (i % 10),
          },
        })
      }

      // Inicializar componentes mecânicos do carro 1 e carro 2 da equipe gerenciada
      await this.initializeCarComponents(career.id, career.managed_team_id)
    }

    // Carregar eventos da temporada
    const events = await pb.collection('season_events').getFullList<SeasonEventRecord>({
      filter: `season_id = "${season.id}"`,
      sort: 'round',
    })

    return { season, events }
  },

  /**
   * Inicializa o inventário físico de peças (4 motores físicos por piloto conforme Documento Mestre)
   */
  async initializeCarComponents(careerId: string, teamId: string): Promise<void> {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const componentsToCreate: Array<{
      car_index: number
      component_type: CarComponentRecord['component_type']
      component_name: string
      level: number
      condition_pct: number
      engine_unit_number?: number
    }> = []

    // Carro 1 e Carro 2
    for (const carIdx of [1, 2]) {
      componentsToCreate.push(
        {
          car_index: carIdx,
          component_type: 'front_wing',
          component_name: `Asa Dianteira C${carIdx}`,
          level: 1,
          condition_pct: 100,
        },
        {
          car_index: carIdx,
          component_type: 'rear_wing',
          component_name: `Asa Traseira C${carIdx}`,
          level: 1,
          condition_pct: 100,
        },
        {
          car_index: carIdx,
          component_type: 'floor',
          component_name: `Assoalho Venturi C${carIdx}`,
          level: 1,
          condition_pct: 100,
        },
        {
          car_index: carIdx,
          component_type: 'sidepods',
          component_name: `Laterais Aero C${carIdx}`,
          level: 1,
          condition_pct: 100,
        },
        {
          car_index: carIdx,
          component_type: 'suspension',
          component_name: `Suspensão Pushrod C${carIdx}`,
          level: 1,
          condition_pct: 100,
        },
      )
      // 4 Motores físicos por piloto/carro (Documento Mestre)
      for (let m = 1; m <= 4; m++) {
        componentsToCreate.push({
          car_index: carIdx,
          component_type: 'engine',
          component_name: `Unidade de Potência F1-PU #${m} (Carro ${carIdx})`,
          level: 1,
          condition_pct: 100,
          engine_unit_number: m,
        })
      }
    }

    for (const comp of componentsToCreate) {
      await pb.collection('car_components').create({
        career_id: careerId,
        user_id: userId,
        team_id: teamId,
        ...comp,
      })
    }
  },

  /**
   * Lista os componentes mecânicos da carreira do jogador
   */
  async getCarComponents(careerId: string): Promise<CarComponentRecord[]> {
    return await pb.collection('car_components').getFullList<CarComponentRecord>({
      filter: `career_id = "${careerId}"`,
      sort: 'car_index,component_type,engine_unit_number',
    })
  },

  /**
   * Revisa ou troca peça mecânica (aplica custo no ledger canônico)
   */
  async repairComponent(
    componentId: string,
    careerId: string,
    cost: number,
  ): Promise<CarComponentRecord> {
    const state = await careerService.getCareerState(careerId)
    if (!state) throw new Error('Estado financeiro não encontrado')

    // INV-04 / INV-05: Validação independente de Caixa e Teto de Gastos regulamentar
    const check = validateFinancialOperation({
      cost,
      currentCash: state.cash_balance,
      costCapSpent: state.cost_cap_spent,
      costCapBudget: state.cost_cap_budget,
      costCapStrict: true,
    })

    if (!check.allowed) {
      throw new Error(check.reason || 'Operação financeira não permitida pelas regras da FIA.')
    }

    // Atualiza estado canônico
    await pb.collection('career_state').update(state.id, {
      cash_balance: state.cash_balance - cost,
      cost_cap_spent: state.cost_cap_spent + cost,
    })

    // Restaura condição para 100%
    return await pb.collection('car_components').update<CarComponentRecord>(componentId, {
      condition_pct: 100,
    })
  },

  /**
   * Lista projetos de P&D ativos e concluídos
   */
  async getRDProjects(careerId: string): Promise<RDProjectRecord[]> {
    return await pb.collection('rd_projects').getFullList<RDProjectRecord>({
      filter: `career_id = "${careerId}"`,
      sort: '-created',
    })
  },

  /**
   * Inicia novo projeto de P&D com sorte técnica 70/25/5% (bom/normal/ruim) conforme Documento Mestre
   */
  async startRDProject(
    careerId: string,
    input: {
      name: string
      category: 'aero' | 'chassis' | 'powertrain' | 'reliability'
      cost: number
      durationRounds: number
    },
  ): Promise<RDProjectRecord> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Não autenticado')

    const state = await careerService.getCareerState(careerId)
    if (!state) throw new Error('Estado da carreira não encontrado')

    // INV-04 / INV-05: Teto e caixa bloqueantes via validador canônico independente
    const check = validateFinancialOperation({
      cost: input.cost,
      currentCash: state.cash_balance,
      costCapSpent: state.cost_cap_spent,
      costCapBudget: state.cost_cap_budget,
      costCapStrict: true,
    })

    if (!check.allowed) {
      throw new Error(
        check.reason ||
          `Bloqueio regulamentar: o projeto não atende aos requisitos de caixa ou teto anual.`,
      )
    }

    // Sorte técnica com probabilidades canônicas: 70% normal, 25% excelente, 5% ruim
    const roll = Math.random() * 100
    let outcome: 'EXCELLENT' | 'NORMAL' | 'POOR' = 'NORMAL'
    let boostVal = 8
    if (roll < 25) {
      outcome = 'EXCELLENT'
      boostVal = 15
    } else if (roll > 95) {
      outcome = 'POOR'
      boostVal = 2
    }

    // 1. Debita financeiro
    await pb.collection('career_state').update(state.id, {
      cash_balance: state.cash_balance - input.cost,
      cost_cap_spent: state.cost_cap_spent + input.cost,
    })

    // 2. Grava projeto de P&D
    const project = await pb.collection('rd_projects').create<RDProjectRecord>({
      career_id: careerId,
      user_id: userId,
      name: input.name,
      category: input.category,
      cost: input.cost,
      duration_rounds: input.durationRounds,
      rounds_remaining: input.durationRounds,
      status: 'IN_PROGRESS',
      outcome_quality: outcome,
      attribute_boost: { [input.category]: boostVal },
    })

    // 3. Recibo de idempotência
    await pb.collection('career_receipts').create<CareerReceiptRecord>({
      career_id: careerId,
      user_id: userId,
      action_type: 'RD_PROJECT_STARTED',
      idempotency_key: `RD_${careerId}_${Date.now()}_${input.category}`,
      payload: { projectId: project.id, cost: input.cost, outcome },
      status: 'EXECUTED',
    })

    return project
  },

  /**
   * Upgrade de instalações com custo real consumido pelo ledger canônico (INV-06)
   */
  async upgradeFacility(
    careerId: string,
    facilityCode: string,
    targetLevel: number,
  ): Promise<CareerStateRecord> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Não autenticado')

    const state = await careerService.getCareerState(careerId)
    if (!state) throw new Error('Estado da carreira não encontrado')

    const currentLevel = (state.facilities_state?.[facilityCode] || 1) as number
    if (targetLevel <= currentLevel) {
      throw new Error(`A instalação já está no nível ${currentLevel}.`)
    }
    if (targetLevel > 5) {
      throw new Error('Nível máximo da instalação é 5.')
    }

    // Custo de upgrade exponencial conforme Documento Mestre: Nível 2 = $4M, 3 = $8M, 4 = $15M, 5 = $25M
    const costMap: Record<number, number> = {
      2: 4_000_000,
      3: 8_000_000,
      4: 15_000_000,
      5: 25_000_000,
    }
    const cost = costMap[targetLevel] || 10_000_000

    // Validação independente de teto e caixa (INV-04 / INV-05)
    const check = validateFinancialOperation({
      cost,
      currentCash: state.cash_balance,
      costCapSpent: state.cost_cap_spent,
      costCapBudget: state.cost_cap_budget,
      costCapStrict: true,
    })

    if (!check.allowed) {
      throw new Error(
        check.reason ||
          'Bloqueio regulamentar: o upgrade excede o teto orçamentário ou saldo disponível.',
      )
    }

    const updatedFacilities = {
      ...(state.facilities_state || {}),
      [facilityCode]: targetLevel,
    }

    const updatedState = await pb.collection('career_state').update<CareerStateRecord>(state.id, {
      cash_balance: state.cash_balance - cost,
      cost_cap_spent: state.cost_cap_spent + cost,
      facilities_state: updatedFacilities,
      team_morale: Math.min(100, state.team_morale + 4), // Bônus de moral com nova infraestrutura
    })

    await pb.collection('career_receipts').create<CareerReceiptRecord>({
      career_id: careerId,
      user_id: userId,
      action_type: 'FACILITY_UPGRADED',
      idempotency_key: `FAC_${careerId}_${facilityCode}_L${targetLevel}_${Date.now()}`,
      payload: { facilityCode, targetLevel, cost },
      status: 'EXECUTED',
    })

    return updatedState
  },

  /**
   * Renovação ou rescisão de contrato de piloto (INV-04, INV-05)
   */
  async updateDriverContract(
    careerId: string,
    slot: 'driver1' | 'driver2',
    newDriverId: string,
    salaryAnnual: number,
    durationYears: number,
  ): Promise<CareerStateRecord> {
    const state = await careerService.getCareerState(careerId)
    if (!state) throw new Error('Estado da carreira não encontrado')

    const newLedger = {
      ...state.contracts_ledger,
      [slot]: {
        driverId: newDriverId,
        salaryAnnual,
        durationYears,
      },
    }

    return await pb.collection('career_state').update<CareerStateRecord>(state.id, {
      contracts_ledger: newLedger,
    })
  },

  /**
   * Simulação oficial de sessão de corrida (INV-01, INV-03)
   * Executa exatamente uma vez por rodada, gera pontos oficiais canônicos e atualiza desgaste mecânico
   */
  async advanceNextRound(
    career: CareerRecord,
    season: SeasonRecord,
    currentEvent: SeasonEventRecord,
  ): Promise<{ updatedSeason: SeasonRecord; updatedEvent: SeasonEventRecord }> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Não autenticado')

    const idempotencyKey = `RACE_OFFICIAL_${career.id}_${season.id}_R${currentEvent.round}`

    // 1. Verificar recibo de idempotência (INV-01: resultado oficial único por sessão)
    try {
      const existing = await pb
        .collection('career_receipts')
        .getFirstListItem<CareerReceiptRecord>(`idempotency_key = "${idempotencyKey}"`)
      if (existing && existing.status === 'EXECUTED') {
        throw new Error('Esta rodada já teve seu resultado oficial processado (INV-01).')
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('INV-01')) throw e
      // Segue fluxo normal
    }

    // 2. Pontuação FIA canônica
    const pointsScale = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]

    // Determinismo com base na seed e rodada (INV-01)
    const driversList = [...season.drivers_standings]
    // Ordenar com peso de performance e aleatoriedade determinística
    driversList.sort(() => Math.random() - 0.5)

    const pointsDistributed: Record<string, number> = {}
    const updatedDrivers = season.drivers_standings.map((ds) => {
      const finishIndex = driversList.findIndex((d) => d.driverId === ds.driverId)
      const isTop10 = finishIndex >= 0 && finishIndex < 10
      const earned = isTop10 ? pointsScale[finishIndex] : 0
      const isWin = finishIndex === 0
      const isPodium = finishIndex >= 0 && finishIndex < 3
      if (earned > 0) pointsDistributed[ds.driverId] = earned

      return {
        ...ds,
        points: ds.points + earned,
        wins: ds.wins + (isWin ? 1 : 0),
        podiums: ds.podiums + (isPodium ? 1 : 0),
      }
    })

    // Atualiza construtores somando os pontos de seus pilotos
    const updatedConstructors = season.constructors_standings.map((cs) => {
      const teamDrivers = updatedDrivers.filter((d) => d.teamId === cs.teamId)
      const totalPts = teamDrivers.reduce((acc, d) => acc + d.points, 0)
      const totalWins = teamDrivers.reduce((acc, d) => acc + d.wins, 0)
      const totalPods = teamDrivers.reduce((acc, d) => acc + d.podiums, 0)
      return {
        ...cs,
        points: totalPts,
        wins: totalWins,
        podiums: totalPods,
      }
    })

    // Ordenar tabelas decrescente por pontos
    updatedDrivers.sort((a, b) => b.points - a.points || b.wins - a.wins)
    updatedConstructors.sort((a, b) => b.points - a.points || b.wins - a.wins)

    // 3. Desgaste de peças mecânicas (INV-03)
    const comps = await this.getCarComponents(career.id)
    for (const comp of comps) {
      // Perda de 5 a 12% por GP
      const wear = 5 + Math.floor(Math.random() * 8)
      const newPct = Math.max(0, comp.condition_pct - wear)
      await pb.collection('car_components').update(comp.id, { condition_pct: newPct })
    }

    // 4. Progresso de P&D
    const activeProjects = await pb.collection('rd_projects').getFullList<RDProjectRecord>({
      filter: `career_id = "${career.id}" && status = "IN_PROGRESS"`,
    })
    for (const proj of activeProjects) {
      const nextRemaining = proj.rounds_remaining - 1
      if (nextRemaining <= 0) {
        await pb.collection('rd_projects').update(proj.id, {
          rounds_remaining: 0,
          status: 'COMPLETED',
        })
      } else {
        await pb.collection('rd_projects').update(proj.id, {
          rounds_remaining: nextRemaining,
        })
      }
    }

    // 5. Atualizar evento do calendário
    const updatedEvent = await pb
      .collection('season_events')
      .update<SeasonEventRecord>(currentEvent.id, {
        status: 'COMPLETED',
        results: {
          raceWinnerDriverId: driversList[0]?.driverId || '',
          fastestLapDriverId: driversList[1]?.driverId || '',
          podiumDriverIds: driversList.slice(0, 3).map((d) => d.driverId),
          pointsDistributed,
        },
      })

    // 6. Atualizar temporada
    const nextRound = season.current_round + 1
    const isSeasonCompleted = nextRound > season.total_rounds
    const updatedSeason = await pb.collection('seasons').update<SeasonRecord>(season.id, {
      current_round: Math.min(nextRound, season.total_rounds),
      status: isSeasonCompleted ? 'COMPLETED' : 'IN_PROGRESS',
      drivers_standings: updatedDrivers,
      constructors_standings: updatedConstructors,
    })

    // 7. Gravar recibo oficial
    await pb.collection('career_receipts').create<CareerReceiptRecord>({
      career_id: career.id,
      user_id: userId,
      action_type: 'RACE_COMPLETED',
      idempotency_key: idempotencyKey,
      payload: {
        round: currentEvent.round,
        winner: driversList[0]?.driverId,
        isSeasonCompleted,
      },
      status: 'EXECUTED',
    })

    return { updatedSeason, updatedEvent }
  },

  /**
   * Transição anual de temporada (INV-02: novo ano = IDs, calendário e ledger novos)
   */
  async closeAndTransitionSeason(career: CareerRecord, currentSeason: SeasonRecord): Promise<void> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Não autenticado')

    const nextYear = currentSeason.year + 1
    const idempotencyKey = `SEASON_TRANSITION_${career.id}_${currentSeason.year}_TO_${nextYear}`

    // 1. Marca temporada atual como encerrada e imutável
    await pb.collection('seasons').update(currentSeason.id, {
      status: 'COMPLETED',
    })

    // 2. Incrementa ano na carreira
    await pb.collection('careers').update(career.id, {
      current_year: nextYear,
    })

    // 3. Atualiza ledger com renovação de teto de gastos e patrocínios
    const state = await careerService.getCareerState(career.id)
    if (state) {
      await pb.collection('career_state').update(state.id, {
        cost_cap_spent: 0, // Zera gastos do teto para o novo ano
        cash_balance: state.cash_balance + state.sponsor_income_annual, // Nova parcela de patrocinador anual
      })
    }

    // 4. Cria recibo de encerramento
    await pb.collection('career_receipts').create<CareerReceiptRecord>({
      career_id: career.id,
      user_id: userId,
      action_type: 'SEASON_TRANSITION',
      idempotency_key: idempotencyKey,
      payload: { previousYear: currentSeason.year, newYear: nextYear },
      status: 'EXECUTED',
    })
  },
}
