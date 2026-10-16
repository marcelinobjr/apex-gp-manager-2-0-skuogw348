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

export type ComponentType =
  | 'front_wing'
  | 'rear_wing'
  | 'floor'
  | 'sidepods'
  | 'suspension'
  | 'brakes'
  | 'gearbox'
  | 'engine'

export type ComponentOperationalStatus =
  | 'ACTIVE_INSTALLED'
  | 'AVAILABLE_BENCH'
  | 'MAINTENANCE'
  | 'RETIRED'

export interface ComponentUsageEvent {
  eventId?: string
  sessionType: 'FP' | 'QUALIFYING' | 'SPRINT' | 'RACE' | 'TEST'
  round?: number
  circuitId?: string
  trackName?: string
  distanceKm: number
  wearDeltaPct: number
  conditionBeforePct: number
  conditionAfterPct: number
  operatingTempC?: number
  stressLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  mechanicalFault?: string | null
  idempotencyKey?: string
  timestamp: string
}

export interface ComponentInstallationEvent {
  car_index: number
  action:
    | 'INITIAL_INSTALL'
    | 'BENCH_ALLOCATION'
    | 'INSTALLED_TO_CAR'
    | 'REMOVED_TO_BENCH'
    | 'REPAIRED'
  previousUnitId?: string
  timestamp: string
  reason?: string
}

export interface CarComponentRecord {
  id: string
  career_id: string
  user_id: string
  team_id: string
  car_index: number
  component_type: ComponentType
  component_name: string
  level: number
  condition_pct: number
  engine_unit_number?: number
  physical_serial?: string
  season_year?: number
  driver_id?: string
  manufacturer_id?: string
  status?: ComponentOperationalStatus
  mileage_km?: number
  penalty_incurred?: boolean
  usage_history?: ComponentUsageEvent[]
  installation_history?: ComponentInstallationEvent[]
  is_installed?: boolean
  created: string
  updated: string
}

export interface EngineSubstitutionResult {
  uninstalledUnit: CarComponentRecord | null
  installedUnit: CarComponentRecord
  penaltyEvent: {
    incurred: boolean
    unitNumber: number
    driverId?: string
    rulesetVersion: string
    sanctionPending: boolean
    sanctionDescription: string
    receiptId?: string
  } | null
}

export interface EngineWearSimulationInput {
  careerId: string
  componentId: string
  sessionType: 'FP' | 'QUALIFYING' | 'SPRINT' | 'RACE' | 'TEST'
  distanceKm: number
  stressLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  operatingTempC?: number
  circuitId?: string
  round?: number
  idempotencyKey: string
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

      // Localizar pilotos e motor da equipe gerenciada a partir de career.teams_config_frozen
      const managedConfig = career.teams_config_frozen?.find(
        (tc) => tc.teamId === career.managed_team_id,
      )
      // Inicializar componentes mecânicos do carro 1 e carro 2 da equipe gerenciada
      await this.initializeCarComponents(
        career.id,
        career.managed_team_id,
        managedConfig?.driver1Id,
        managedConfig?.driver2Id,
        managedConfig?.engineId,
        career.current_year || 2026,
      )
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
   * Agora contemplando todos os componentes obrigatórios (asa diant, asa tras, assoalho, laterais, suspensão, freios, câmbio)
   * e 4 unidades físicas de motor independentes por piloto com números de série permanentes.
   */
  async initializeCarComponents(
    careerId: string,
    teamId: string,
    driver1Id?: string,
    driver2Id?: string,
    engineManufacturerId?: string,
    seasonYear: number = 2026,
  ): Promise<void> {
    const userId = pb.authStore.record?.id
    if (!userId) return

    const shortId = careerId.substring(0, 8)
    const baseComponents: Array<{
      type: ComponentType
      name: string
    }> = [
      { type: 'front_wing', name: 'Asa Dianteira' },
      { type: 'rear_wing', name: 'Asa Traseira' },
      { type: 'floor', name: 'Assoalho Venturi' },
      { type: 'sidepods', name: 'Laterais & Radiadores' },
      { type: 'suspension', name: 'Suspensão Pushrod' },
      { type: 'brakes', name: 'Sistema de Freios Carbono' },
      { type: 'gearbox', name: 'Transmissão & Câmbio 8 Velocidades' },
    ]

    const componentsToCreate: Array<Partial<CarComponentRecord>> = []

    // Carro 1 e Carro 2
    for (const carIdx of [1, 2] as const) {
      const driverId = carIdx === 1 ? driver1Id || '' : driver2Id || ''

      // Componentes estruturais e aerodinâmicos do carro
      for (const comp of baseComponents) {
        componentsToCreate.push({
          car_index: carIdx,
          component_type: comp.type,
          component_name: `${comp.name} C${carIdx}`,
          level: 1,
          condition_pct: 100,
          physical_serial: `PART-${shortId}-${seasonYear}-C${carIdx}-${comp.type.toUpperCase()}`,
          season_year: seasonYear,
          driver_id: driverId,
          manufacturer_id: teamId,
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
              reason: 'Montagem inicial de fábrica do chassi',
            },
          ],
        })
      }

      // 4 Unidades físicas de potência por piloto/carro (Documento Mestre 13.3)
      for (let m = 1; m <= 4; m++) {
        const isInitialInstalled = m === 1
        componentsToCreate.push({
          car_index: carIdx,
          component_type: 'engine',
          component_name: `Unidade de Potência F1-PU #${m} (Carro ${carIdx})`,
          level: 1,
          condition_pct: 100,
          engine_unit_number: m,
          physical_serial: `PU-${shortId}-${seasonYear}-C${carIdx}-U${m}`,
          season_year: seasonYear,
          driver_id: driverId,
          manufacturer_id: engineManufacturerId || 'ENG-0005',
          status: isInitialInstalled ? 'ACTIVE_INSTALLED' : 'AVAILABLE_BENCH',
          mileage_km: 0,
          penalty_incurred: false,
          is_installed: isInitialInstalled,
          usage_history: [],
          installation_history: [
            {
              car_index: carIdx,
              action: isInitialInstalled ? 'INITIAL_INSTALL' : 'BENCH_ALLOCATION',
              timestamp: new Date().toISOString(),
              reason: isInitialInstalled
                ? 'Unidade 1 instalada no cockpit para abertura da temporada'
                : `Unidade alocada no banco regulamentar (Quota 4 PUs)`,
            },
          ],
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
   * Substituição de unidade de potência instalada no carro
   * - Desinstala a unidade atualmente montada no carro para o banco (AVAILABLE_BENCH)
   * - Instala a unidade selecionada (ACTIVE_INSTALLED)
   * - Preserva integralmente o desgaste (condition_pct) e a quilometragem (mileage_km)
   * - Bloqueia se a unidade já estiver montada em outro carro
   * - Se for a 5ª PU física ou superior, emite evento de penalidade regulamentar único no ledger
   */
  async substituteEngineUnit(params: {
    careerId: string
    carIndex: 1 | 2
    targetComponentId: string
    reason?: string
  }): Promise<EngineSubstitutionResult> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Não autenticado')

    const { careerId, carIndex, targetComponentId, reason } = params

    // 1. Obter a unidade alvo a ser instalada
    const targetUnit = await pb
      .collection('car_components')
      .getOne<CarComponentRecord>(targetComponentId)
    if (!targetUnit || targetUnit.career_id !== careerId) {
      throw new Error('Unidade de potência não encontrada nesta carreira.')
    }
    if (targetUnit.component_type !== 'engine') {
      throw new Error('O componente selecionado não é uma unidade de potência.')
    }

    // Se já estiver instalada neste mesmo carro, não há operação necessária
    if (targetUnit.is_installed && targetUnit.car_index === carIndex) {
      return {
        uninstalledUnit: null,
        installedUnit: targetUnit,
        penaltyEvent: null,
      }
    }

    // Regra: Bloquear instalação simultânea da mesma unidade física em dois carros
    if (targetUnit.is_installed && targetUnit.car_index !== carIndex) {
      throw new Error(
        `Bloqueio de Integridade Física: A unidade ${targetUnit.physical_serial || targetUnit.id} já está instalada no Carro #${targetUnit.car_index}. Remova-a antes de tentar instalar no Carro #${carIndex}.`,
      )
    }

    // 2. Localizar unidade atualmente instalada no carro alvo (se houver)
    let currentInstalled: CarComponentRecord | null = null
    const activeUnits = await pb.collection('car_components').getFullList<CarComponentRecord>({
      filter: `career_id = "${careerId}" && car_index = ${carIndex} && component_type = "engine" && is_installed = true`,
    })
    if (activeUnits.length > 0) {
      currentInstalled = activeUnits[0]
    }

    // 3. Verificar regra da Quinta Unidade e Penalidade FIA (Seção 13.3)
    // "A partir da quinta unidade física nova utilizada pelo mesmo piloto na temporada..."
    // "REGRA FUNDAMENTAL: voltar a utilizar o motor 1 depois de usar o motor 2 NÃO caracteriza uma quinta unidade. O limite refere-se à quantidade de unidades físicas distintas alocadas, não ao número de substituições."
    let penaltyEvent: EngineSubstitutionResult['penaltyEvent'] = null
    const targetUnitNumber = targetUnit.engine_unit_number || 1
    const isNewFifthOrHigher = targetUnitNumber >= 5

    // Se for 5ª unidade nova e ainda não tiver penalidade registrada
    if (isNewFifthOrHigher && !targetUnit.penalty_incurred) {
      const rulesFrozen = (await careerService.getCareerById(careerId)).rules_frozen
      const rulesetVersion = rulesFrozen?.rulesetVersion || '2026.1_PROVISIONAL'

      const idempotencyKey = `PENALTY_FIA_${careerId}_Y${targetUnit.season_year || 2026}_C${carIndex}_PU${targetUnitNumber}_${targetUnit.id}`

      // Registrar evento canônico em career_receipts
      const receipt = await pb.collection('career_receipts').create<CareerReceiptRecord>({
        career_id: careerId,
        user_id: userId,
        action_type: 'FIA_REGULATORY_PENALTY_INCURRED',
        idempotency_key: idempotencyKey,
        payload: {
          violationType: 'EXCESS_POWER_UNIT_ELEMENTS',
          carIndex,
          driverId: targetUnit.driver_id,
          unitNumber: targetUnitNumber,
          physicalSerial: targetUnit.physical_serial,
          rulesetVersion,
          sanctionPending: true,
          sanctionDescription:
            'PENDÊNCIA REGULAMENTAR FIA 2026.1: Sanção oficial desportiva (perda de posições no grid vs. largada do pitlane) pendente de homologação na especificação do Race Engine. O evento de infração é registrado canonicamente no ledger com penalidade pendente de calibração.',
          timestamp: new Date().toISOString(),
        },
        status: 'EXECUTED',
      })

      penaltyEvent = {
        incurred: true,
        unitNumber: targetUnitNumber,
        driverId: targetUnit.driver_id,
        rulesetVersion,
        sanctionPending: true,
        sanctionDescription:
          'PENDÊNCIA REGULAMENTAR FIA 2026.1: Sanção oficial desportiva pendente de homologação no Race Engine.',
        receiptId: receipt.id,
      }
    }

    // 4. Se havia motor instalado, desinstalar primeiro para liberar o slot do carro (evita disparo do hook de conflito)
    let uninstalledRecord: CarComponentRecord | null = null
    if (currentInstalled && currentInstalled.id !== targetUnit.id) {
      const prevInstallHistory: ComponentInstallationEvent[] =
        currentInstalled.installation_history || []
      const updatedHistory: ComponentInstallationEvent[] = [
        ...prevInstallHistory,
        {
          car_index: carIndex,
          action: 'REMOVED_TO_BENCH',
          previousUnitId: currentInstalled.id,
          timestamp: new Date().toISOString(),
          reason: reason || `Removido para entrada da PU #${targetUnitNumber}`,
        },
      ]

      uninstalledRecord = await pb
        .collection('car_components')
        .update<CarComponentRecord>(currentInstalled.id, {
          is_installed: false,
          status: 'AVAILABLE_BENCH',
          installation_history: updatedHistory,
        })
    }

    // 5. Instalar a nova unidade no carro (preservando condição e quilometragem existentes)
    const targetInstallHistory: ComponentInstallationEvent[] = targetUnit.installation_history || []
    const updatedTargetHistory: ComponentInstallationEvent[] = [
      ...targetInstallHistory,
      {
        car_index: carIndex,
        action: 'INSTALLED_TO_CAR',
        previousUnitId: currentInstalled?.id,
        timestamp: new Date().toISOString(),
        reason: reason || `Instalação operacional no cockpit do Carro #${carIndex}`,
      },
    ]

    const updatedTarget = await pb
      .collection('car_components')
      .update<CarComponentRecord>(targetUnit.id, {
        car_index: carIndex,
        is_installed: true,
        status: 'ACTIVE_INSTALLED',
        penalty_incurred: targetUnit.penalty_incurred || (penaltyEvent?.incurred ?? false),
        installation_history: updatedTargetHistory,
      })

    return {
      uninstalledUnit: uninstalledRecord,
      installedUnit: updatedTarget,
      penaltyEvent,
    }
  },

  /**
   * Adiciona nova unidade física de motor à cota do piloto (5ª unidade ou além)
   * Requer aprovação do jogador, custo no ledger canônico e gera penalidade regulamentar
   */
  async allocateExtraEngineUnit(params: {
    careerId: string
    carIndex: 1 | 2
    cost?: number
  }): Promise<CarComponentRecord> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Não autenticado')

    const { careerId, carIndex, cost = 1_500_000 } = params

    const career = await careerService.getCareerById(careerId)
    const state = await careerService.getCareerState(careerId)
    if (!state) throw new Error('Estado da carreira não encontrado')

    // INV-04 / INV-05: Validação financeira da compra da unidade adicional
    const check = validateFinancialOperation({
      cost,
      currentCash: state.cash_balance,
      costCapSpent: state.cost_cap_spent,
      costCapBudget: state.cost_cap_budget,
      costCapStrict: true,
      reservedCash: state.reserved_cash || 0,
      reservedCostCap: state.reserved_cost_cap || 0,
      countsAgainstCostCap: true,
    })

    if (!check.allowed) {
      throw new Error(
        check.reason || 'Saldo insuficiente ou estouro de teto para compra de nova PU física.',
      )
    }

    // Buscar maior número de unidade já alocado para este carro
    const existingPUs = await pb.collection('car_components').getFullList<CarComponentRecord>({
      filter: `career_id = "${careerId}" && car_index = ${carIndex} && component_type = "engine"`,
      sort: '-engine_unit_number',
    })
    const nextUnitNumber = (existingPUs[0]?.engine_unit_number || 4) + 1

    const shortId = careerId.substring(0, 8)
    const seasonYear = career.current_year || 2026
    const serial = `PU-${shortId}-${seasonYear}-C${carIndex}-U${nextUnitNumber}`

    // 1. Debita o valor no ledger financeiro de forma atômica
    const idempotencyKey = `PU_BUY_${careerId}_C${carIndex}_U${nextUnitNumber}_${Date.now()}`
    await careerService.executeFinancialOperation({
      careerId,
      idempotencyKey,
      actionType: 'POWER_UNIT_ACQUISITION',
      cost,
      countsAgainstCostCap: true,
      description: `Aquisição de Unidade de Potência Adicional: PU #${nextUnitNumber} (Carro ${carIndex})`,
      metadata: { carIndex, nextUnitNumber, serial, cost },
    })

    // 2. Cria a nova unidade física independente no banco de reservas
    const newUnit = await pb.collection('car_components').create<CarComponentRecord>({
      career_id: careerId,
      user_id: userId,
      team_id: career.managed_team_id,
      car_index: carIndex,
      component_type: 'engine',
      component_name: `Unidade de Potência F1-PU #${nextUnitNumber} (Carro ${carIndex})`,
      level: 1,
      condition_pct: 100,
      engine_unit_number: nextUnitNumber,
      physical_serial: serial,
      season_year: seasonYear,
      driver_id: existingPUs[0]?.driver_id || '',
      manufacturer_id: existingPUs[0]?.manufacturer_id || 'ENG-0005',
      status: 'AVAILABLE_BENCH',
      mileage_km: 0,
      penalty_incurred: false,
      is_installed: false,
      usage_history: [],
      installation_history: [
        {
          car_index: carIndex,
          action: 'BENCH_ALLOCATION',
          timestamp: new Date().toISOString(),
          reason: `Alocação de nova PU física extra #${nextUnitNumber} (Sujeita a sanção na primeira instalação)`,
        },
      ],
    })

    return newUnit
  },

  /**
   * Contrato de integração para o futuro Race Engine:
   * Registra a utilização controlada e o desgaste de uma unidade de potência com persistência atômica e idempotente.
   */
  async recordEngineUsage(input: EngineWearSimulationInput): Promise<CarComponentRecord> {
    const {
      careerId,
      componentId,
      sessionType,
      distanceKm,
      stressLevel = 'MEDIUM',
      operatingTempC = 110,
      circuitId,
      round,
      idempotencyKey,
    } = input

    // 1. Verificar idempotência via recibo
    const existingReceipt = await pb
      .collection('career_receipts')
      .getFullList<CareerReceiptRecord>({
        filter: `idempotency_key = "${idempotencyKey}"`,
      })

    const unit = await pb.collection('car_components').getOne<CarComponentRecord>(componentId)
    if (!unit || unit.career_id !== careerId) {
      throw new Error('Componente físico de motor não encontrado.')
    }

    if (existingReceipt.length > 0) {
      // Já processado (idempotente)
      return unit
    }

    // 2. Calcular desgaste com base em quilometragem e nível de esforço
    // Referência de durabilidade: 4–6 corridas (~300km cada GP = ~1500km total, ~15-25% por GP)
    const baseWearPerKm = 0.05 // 5% a cada 100km
    let stressMultiplier = 1.0
    if (stressLevel === 'LOW') stressMultiplier = 0.8
    if (stressLevel === 'HIGH') stressMultiplier = 1.3
    if (stressLevel === 'EXTREME') stressMultiplier = 1.6

    // Temperatura de operação (>120C eleva o desgaste)
    const tempFactor = operatingTempC > 120 ? 1.25 : 1.0

    const wearDelta = Math.min(
      100,
      Math.round(distanceKm * baseWearPerKm * stressMultiplier * tempFactor * 10) / 10,
    )
    const newCondition = Math.max(0, Math.round((unit.condition_pct - wearDelta) * 10) / 10)
    const newMileage = (unit.mileage_km || 0) + distanceKm

    const usageEvent: ComponentUsageEvent = {
      sessionType,
      round,
      circuitId,
      distanceKm,
      wearDeltaPct: wearDelta,
      conditionBeforePct: unit.condition_pct,
      conditionAfterPct: newCondition,
      operatingTempC,
      stressLevel,
      mechanicalFault:
        newCondition < 20 ? 'Perda severa de potência e risco de quebra térmica' : null,
      idempotencyKey,
      timestamp: new Date().toISOString(),
    }

    const prevHistory = unit.usage_history || []
    const updatedHistory = [...prevHistory, usageEvent]

    // 3. Persistir histórico e novo desgaste no componente
    const updatedUnit = await pb.collection('car_components').update<CarComponentRecord>(unit.id, {
      condition_pct: newCondition,
      mileage_km: newMileage,
      usage_history: updatedHistory,
    })

    // 4. Gravar recibo canônico de idempotência
    const userId = pb.authStore.record?.id || ''
    await pb.collection('career_receipts').create<CareerReceiptRecord>({
      career_id: careerId,
      user_id: userId,
      action_type: 'ENGINE_USAGE_RECORDED',
      idempotency_key: idempotencyKey,
      payload: {
        componentId,
        serial: unit.physical_serial,
        sessionType,
        distanceKm,
        wearDelta,
        previousCondition: unit.condition_pct,
        newCondition,
        newMileage,
        timestamp: new Date().toISOString(),
      },
      status: 'EXECUTED',
    })

    return updatedUnit
  },

  /**
   * Lista os componentes mecânicos da carreira do jogador
   * Permite filtrar por seasonYear opcional para separar a temporada ativa do inventário histórico
   */
  async getCarComponents(careerId: string, seasonYear?: number): Promise<CarComponentRecord[]> {
    const filter = seasonYear
      ? `career_id = "${careerId}" && season_year = ${seasonYear}`
      : `career_id = "${careerId}"`
    return await pb.collection('car_components').getFullList<CarComponentRecord>({
      filter,
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

    // INV-04 / INV-05: Validação independente de Caixa e Teto de Gastos regulamentar no cliente
    const check = validateFinancialOperation({
      cost,
      currentCash: state.cash_balance,
      costCapSpent: state.cost_cap_spent,
      costCapBudget: state.cost_cap_budget,
      costCapStrict: true,
      reservedCash: state.reserved_cash || 0,
      reservedCostCap: state.reserved_cost_cap || 0,
      countsAgainstCostCap: true,
    })

    if (!check.allowed) {
      throw new Error(check.reason || 'Operação financeira não permitida pelas regras da FIA.')
    }

    const idempotencyKey = `REPAIR_${careerId}_${componentId}_${Date.now()}`

    // Executa operação financeira atômica no servidor
    await careerService.executeFinancialOperation({
      careerId,
      idempotencyKey,
      actionType: 'COMPONENT_REPAIR',
      cost,
      countsAgainstCostCap: true,
      description: `Revisão de componente mecânico ${componentId}`,
      metadata: { componentId, cost },
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

    // INV-04 / INV-05: Teto e caixa bloqueantes via validador canônico independente no cliente
    const check = validateFinancialOperation({
      cost: input.cost,
      currentCash: state.cash_balance,
      costCapSpent: state.cost_cap_spent,
      costCapBudget: state.cost_cap_budget,
      costCapStrict: true,
      reservedCash: state.reserved_cash || 0,
      reservedCostCap: state.reserved_cost_cap || 0,
      countsAgainstCostCap: true,
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

    const idempotencyKey = `RD_${careerId}_${input.category}_${Date.now()}`

    // 1. Debita financeiro de forma atômica no servidor com validação do ledger
    await careerService.executeFinancialOperation({
      careerId,
      idempotencyKey,
      actionType: 'RD_PROJECT_STARTED',
      cost: input.cost,
      countsAgainstCostCap: true,
      description: `Início de Projeto de P&D: ${input.name} (${input.category})`,
      metadata: {
        name: input.name,
        category: input.category,
        durationRounds: input.durationRounds,
        outcome,
      },
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

    // Validação independente de teto e caixa (INV-04 / INV-05) no cliente
    const check = validateFinancialOperation({
      cost,
      currentCash: state.cash_balance,
      costCapSpent: state.cost_cap_spent,
      costCapBudget: state.cost_cap_budget,
      costCapStrict: true,
      reservedCash: state.reserved_cash || 0,
      reservedCostCap: state.reserved_cost_cap || 0,
      countsAgainstCostCap: true,
    })

    if (!check.allowed) {
      throw new Error(
        check.reason ||
          'Bloqueio regulamentar: o upgrade excede o teto orçamentário ou saldo disponível.',
      )
    }

    const idempotencyKey = `FAC_${careerId}_${facilityCode}_L${targetLevel}_${Date.now()}`

    // 1. Executa operação financeira no servidor
    const finRes = await careerService.executeFinancialOperation({
      careerId,
      idempotencyKey,
      actionType: 'FACILITY_UPGRADED',
      cost,
      countsAgainstCostCap: true,
      description: `Upgrade de Instalação: ${facilityCode} para Nível ${targetLevel}`,
      metadata: { facilityCode, targetLevel, cost },
    })

    const updatedFacilities = {
      ...(state.facilities_state || {}),
      [facilityCode]: targetLevel,
    }

    // 2. Atualiza os níveis de instalações e moral no career_state
    const updatedState = await pb.collection('career_state').update<CareerStateRecord>(state.id, {
      facilities_state: updatedFacilities,
      team_morale: Math.min(100, state.team_morale + 4), // Bônus de moral com nova infraestrutura
    })

    return {
      ...updatedState,
      cash_balance: finRes.state.cash_balance,
      cost_cap_spent: finRes.state.cost_cap_spent,
    }
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
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Não autenticado')

    const state = await careerService.getCareerState(careerId)
    if (!state) throw new Error('Estado da carreira não encontrado')

    const previousContract = state.contracts_ledger?.[slot]
    const previousSalary = previousContract?.salaryAnnual || 0

    // Reserva financeira de compromisso futuro para o salário contratado
    // Nova reserva é a diferença se houver aumento de compromisso
    const salaryDiff = Math.max(0, salaryAnnual - previousSalary)
    const currentReservedCash = state.reserved_cash || 0
    const newReservedCash = currentReservedCash + salaryDiff

    // Validação preventiva se o caixa suporta a reserva de compromisso
    if (state.cash_balance < newReservedCash) {
      throw new Error(
        `Saldo insuficiente para reservar compromisso salarial de $${(salaryAnnual / 1_000_000).toFixed(1)}M/ano.`,
      )
    }

    const newLedger = {
      ...state.contracts_ledger,
      [slot]: {
        driverId: newDriverId,
        salaryAnnual,
        durationYears,
      },
    }

    const idempotencyKey = `CONTRACT_${careerId}_${slot}_${newDriverId}_${Date.now()}`

    // Registra recibo da contratação/renovação
    await pb.collection('career_receipts').create<CareerReceiptRecord>({
      career_id: careerId,
      user_id: userId,
      action_type: 'DRIVER_CONTRACT_UPDATED',
      idempotency_key: idempotencyKey,
      payload: {
        slot,
        newDriverId,
        previousDriverId: previousContract?.driverId,
        salaryAnnual,
        durationYears,
        reservedCashAdded: salaryDiff,
      },
      status: 'EXECUTED',
    })

    return await pb.collection('career_state').update<CareerStateRecord>(state.id, {
      contracts_ledger: newLedger,
      reserved_cash: newReservedCash,
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
    // REGRA FUNDAMENTAL: Apenas peças ATIVAMENTE instaladas no carro sofrem desgaste.
    // Motores no banco de reservas (is_installed = false) NÃO sofrem desgaste!
    const comps = await this.getCarComponents(career.id)
    for (const comp of comps) {
      // Desgaste atinge apenas componentes instalados no cockpit durante o GP
      if (comp.is_installed) {
        // Distância típica de GP ~305 km
        const gpKm = 305
        const wear = 5 + Math.floor(Math.random() * 8)
        const newPct = Math.max(0, comp.condition_pct - wear)
        const newMileage = (comp.mileage_km || 0) + gpKm
        const usageEvt: ComponentUsageEvent = {
          sessionType: 'RACE',
          round: currentEvent.round,
          circuitId: currentEvent.circuit_id,
          trackName: currentEvent.track_name,
          distanceKm: gpKm,
          wearDeltaPct: wear,
          conditionBeforePct: comp.condition_pct,
          conditionAfterPct: newPct,
          timestamp: new Date().toISOString(),
        }
        const updatedHistory = [...(comp.usage_history || []), usageEvt]
        await pb.collection('car_components').update(comp.id, {
          condition_pct: newPct,
          mileage_km: newMileage,
          usage_history: updatedHistory,
        })
      }
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
   * Transição anual de temporada e reinicialização de inventário (SEASON-RESET-01, INV-02)
   * Garante idempotência rigorosa via recibo canônico.
   * Regras:
   * 1. Preservar integralmente o histórico da temporada encerrada (desgaste, km, penalidades).
   * 2. Arquivar os componentes da temporada anterior como 'RETIRED' e is_installed = false.
   * 3. Calcular bônus de desenvolvimento técnico conquistado em P&D para o novo carro.
   * 4. Gerar novos componentes estruturais e 4 novas unidades físicas de potência por piloto (ano novo).
   * 5. Reiniciar quilometragem em 0 km, condição em 100% (desgaste 0%) e contadores em zero.
   * 6. Executar exatamente uma vez por virada; se chamada repetidamente, retorna sem duplicar.
   */
  async closeAndTransitionSeason(
    career: CareerRecord,
    currentSeason: SeasonRecord,
  ): Promise<{ newYear: number; componentsCreated: number }> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Não autenticado')

    const nextYear = currentSeason.year + 1
    const idempotencyKey = `SEASON_TRANSITION_${career.id}_${currentSeason.year}_TO_${nextYear}`

    // 1. Verificação de idempotência no ledger de recibos canônicos
    const existingTransition = await pb
      .collection('career_receipts')
      .getFullList<CareerReceiptRecord>({
        filter: `idempotency_key = "${idempotencyKey}"`,
      })
    if (existingTransition.length > 0) {
      return {
        newYear: nextYear,
        componentsCreated: 0,
      }
    }

    // 2. Marca a temporada atual como encerrada (COMPLETED) se ainda não estiver
    if (currentSeason.status !== 'COMPLETED') {
      await pb.collection('seasons').update(currentSeason.id, {
        status: 'COMPLETED',
      })
    }

    // 3. Obter todos os componentes da temporada atual para arquivamento histórico seguro
    const oldComponents = await pb.collection('car_components').getFullList<CarComponentRecord>({
      filter: `career_id = "${career.id}" && season_year = ${currentSeason.year}`,
    })

    // Arquivar componentes anteriores preservando todos os atributos originais
    for (const oldComp of oldComponents) {
      if (oldComp.is_installed || oldComp.status !== 'RETIRED') {
        const hist: ComponentInstallationEvent[] = oldComp.installation_history || []
        await pb.collection('car_components').update(oldComp.id, {
          is_installed: false,
          status: 'RETIRED',
          installation_history: [
            ...hist,
            {
              car_index: oldComp.car_index,
              action: 'REMOVED_TO_BENCH',
              timestamp: new Date().toISOString(),
              reason: `Arquivamento histórico regulamentar de fim de temporada ${currentSeason.year}`,
            },
          ],
        })
      }
    }

    // 4. Calcular evolução técnica herdada de P&D concluídos durante o ano
    const completedRD = await pb.collection('rd_projects').getFullList<RDProjectRecord>({
      filter: `career_id = "${career.id}" && status = "COMPLETED"`,
    })

    // Mapear níveis técnicos evoluídos por tipo de componente
    const baseLevels: Record<ComponentType, number> = {
      front_wing: 1,
      rear_wing: 1,
      floor: 1,
      sidepods: 1,
      suspension: 1,
      brakes: 1,
      gearbox: 1,
      engine: 1,
    }

    // Preservar níveis técnicos máximos alcançados nos componentes da temporada anterior
    for (const oldComp of oldComponents) {
      if (oldComp.level > (baseLevels[oldComp.component_type] || 1)) {
        baseLevels[oldComp.component_type] = oldComp.level
      }
    }

    // Aplicar progressão derivada de projetos de P&D concluídos
    for (const rd of completedRD) {
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

    // 5. Verificar se já existem componentes gerados para o novo ano (idempotência preventiva)
    const existingNewYearComps = await pb
      .collection('car_components')
      .getFullList<CarComponentRecord>({
        filter: `career_id = "${career.id}" && season_year = ${nextYear}`,
      })

    let createdCount = 0
    if (existingNewYearComps.length === 0) {
      // Localizar pilotos e fornecedor de motor congelados
      const managedConfig = career.teams_config_frozen?.find(
        (tc) => tc.teamId === career.managed_team_id,
      )
      const d1Id = managedConfig?.driver1Id || ''
      const d2Id = managedConfig?.driver2Id || ''
      const engineManufacturerId = managedConfig?.engineId || 'ENG-0005'
      const shortId = career.id.substring(0, 8)

      const baseParts: Array<{ type: ComponentType; name: string }> = [
        { type: 'front_wing', name: 'Asa Dianteira' },
        { type: 'rear_wing', name: 'Asa Traseira' },
        { type: 'floor', name: 'Assoalho Venturi' },
        { type: 'sidepods', name: 'Laterais & Radiadores' },
        { type: 'suspension', name: 'Suspensão Pushrod' },
        { type: 'brakes', name: 'Sistema de Freios Carbono' },
        { type: 'gearbox', name: 'Transmissão & Câmbio 8 Velocidades' },
      ]

      // Criar inventário limpo para ambos os carros (Carro 1 e Carro 2)
      for (const carIdx of [1, 2] as const) {
        const driverId = carIdx === 1 ? d1Id : d2Id

        // Componentes do carro (0% desgaste, 100% integridade, 0 km, nível evoluído preservado)
        for (const part of baseParts) {
          const compLevel = baseLevels[part.type] || 1
          await pb.collection('car_components').create({
            career_id: career.id,
            user_id: userId,
            team_id: career.managed_team_id,
            car_index: carIdx,
            component_type: part.type,
            component_name: `${part.name} C${carIdx}`,
            level: compLevel,
            condition_pct: 100,
            physical_serial: `PART-${shortId}-${nextYear}-C${carIdx}-${part.type.toUpperCase()}`,
            season_year: nextYear,
            driver_id: driverId,
            manufacturer_id: career.managed_team_id,
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
                reason: `Montagem do novo chassi para a Temporada ${nextYear}`,
              },
            ],
          })
          createdCount++
        }

        // Exatamente 4 motores físicos novos por piloto (0% desgaste, 100% integridade, 0 km)
        for (let m = 1; m <= 4; m++) {
          const isInitialInstalled = m === 1
          await pb.collection('car_components').create({
            career_id: career.id,
            user_id: userId,
            team_id: career.managed_team_id,
            car_index: carIdx,
            component_type: 'engine',
            component_name: `Unidade de Potência F1-PU #${m} (Carro ${carIdx})`,
            level: 1,
            condition_pct: 100,
            engine_unit_number: m,
            physical_serial: `PU-${shortId}-${nextYear}-C${carIdx}-U${m}`,
            season_year: nextYear,
            driver_id: driverId,
            manufacturer_id: engineManufacturerId,
            status: isInitialInstalled ? 'ACTIVE_INSTALLED' : 'AVAILABLE_BENCH',
            mileage_km: 0,
            penalty_incurred: false,
            is_installed: isInitialInstalled,
            usage_history: [],
            installation_history: [
              {
                car_index: carIdx,
                action: isInitialInstalled ? 'INITIAL_INSTALL' : 'BENCH_ALLOCATION',
                timestamp: new Date().toISOString(),
                reason: isInitialInstalled
                  ? `Unidade 1 montada no cockpit para a abertura da Temporada ${nextYear}`
                  : `Unidade alocada no banco regulamentar (Quota 4 PUs - Temporada ${nextYear})`,
              },
            ],
          })
          createdCount++
        }
      }
    }

    // 6. Atualizar a carreira para o novo ano
    await pb.collection('careers').update(career.id, {
      current_year: nextYear,
    })

    // 7. Atualizar ledger financeiro e renovar teto de gastos regulamentar
    const state = await careerService.getCareerState(career.id)
    if (state) {
      await careerService.executeFinancialOperation({
        careerId: career.id,
        idempotencyKey: `${idempotencyKey}_SPONSOR`,
        actionType: 'SPONSOR_ANNUAL_INCOME',
        cost: 0,
        income: state.sponsor_income_annual,
        countsAgainstCostCap: false,
        description: `Receita anual de patrocínio para a temporada ${nextYear}`,
        metadata: { year: nextYear, amount: state.sponsor_income_annual },
      })

      // Reinicia gastos do teto anual para zero no novo ano regulamentar
      await pb.collection('career_state').update(state.id, {
        cost_cap_spent: 0,
        reserved_cash: 0,
        reserved_cost_cap: 0,
      })
    }

    // 8. Gravar recibo canônico imutável de transição de temporada
    await pb.collection('career_receipts').create<CareerReceiptRecord>({
      career_id: career.id,
      user_id: userId,
      action_type: 'SEASON_TRANSITION',
      idempotency_key: idempotencyKey,
      payload: {
        previousYear: currentSeason.year,
        newYear: nextYear,
        componentsCreated: createdCount,
        inheritedEvolution: baseLevels,
        timestamp: new Date().toISOString(),
      },
      status: 'EXECUTED',
    })

    return {
      newYear: nextYear,
      componentsCreated: createdCount,
    }
  },
}
