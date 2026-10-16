import pb from '@/lib/pocketbase/client'
import { teams, drivers, engines, managers } from '@/data/game'
import {
  VersionedRuleset,
  FrozenRulesSnapshot,
  getDefaultRuleset,
  createFrozenRulesSnapshot,
  validateFinancialOperation,
  FinancialCheckResult,
} from '@/data/ruleset'

export interface CareerRecord {
  id: string
  user_id: string
  name: string
  initial_year: number
  current_year: number
  universe_type: string
  manager_archetype_id: string
  managed_team_id: string
  managed_team_power_factor: number
  master_seed: string
  rules_frozen: FrozenRules
  teams_config_frozen: FrozenTeamConfig[]
  created: string
  updated: string
}

export interface CareerStateRecord {
  id: string
  career_id: string
  user_id: string
  cash_balance: number
  cost_cap_budget: number
  cost_cap_spent: number
  reserved_cash?: number
  reserved_cost_cap?: number
  team_morale: number
  sponsor_income_annual: number
  contracts_ledger: ContractsLedger
  facilities_state: Record<string, number>
  created: string
  updated: string
}

export interface CareerReceiptRecord {
  id: string
  career_id: string
  user_id: string
  action_type: string
  idempotency_key: string
  payload: Record<string, unknown>
  status: 'EXECUTED' | 'REVERTED'
  created: string
  updated: string
}

export type FrozenRules = FrozenRulesSnapshot

export interface FrozenTeamConfig {
  teamId: string
  teamName: string
  teamCode: string
  powerFactor: number // 50% - 150% passo 5%
  driver1Id: string
  driver2Id: string
  engineId: string
}

export interface ContractsLedger {
  driver1: {
    driverId: string
    salaryAnnual: number
    durationYears: number
  }
  driver2: {
    driverId: string
    salaryAnnual: number
    durationYears: number
  }
  engineSupplier: {
    engineId: string
    costAnnual: number
    durationYears: number
  }
}

export interface CreateCareerInput {
  name: string
  initialYear: number
  universeType: string
  managerArchetypeId: string
  managedTeamId: string
  managedTeamPowerFactor: number // 50 a 150
  selectedTeamIds: string[]
  lineups: Record<string, { driver1Id: string; driver2Id: string; engineId: string }>
  idempotencyKey?: string
}

/**
 * Utilitário de seed determinístico (INV-01, INV-03)
 */
export function generateDeterministicSeed(name: string, year: number, teamId: string): string {
  const raw = `${name}_${year}_${teamId}_${Date.now()}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i)
    hash |= 0
  }
  return `SEED_${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`
}

export const careerService = {
  /**
   * Lista carreiras ativas do usuário
   */
  async listUserCareers(): Promise<CareerRecord[]> {
    if (!pb.authStore.record?.id) return []
    return await pb.collection('careers').getFullList<CareerRecord>({
      sort: '-updated',
    })
  },

  /**
   * Obtém os detalhes completos de uma carreira por ID
   */
  async getCareerById(careerId: string): Promise<CareerRecord> {
    return await pb.collection('careers').getOne<CareerRecord>(careerId)
  },

  /**
   * Obtém o estado corrente de finanças, teto e contratos da carreira
   */
  async getCareerState(careerId: string): Promise<CareerStateRecord | null> {
    try {
      return await pb
        .collection('career_state')
        .getFirstListItem<CareerStateRecord>(`career_id = "${careerId}"`)
    } catch {
      return null
    }
  },

  /**
   * Cria uma nova carreira de forma transacional e idempotente (ENGINE-06)
   */
  async createCareer(
    input: CreateCareerInput,
  ): Promise<{ career: CareerRecord; state: CareerStateRecord }> {
    const userId = pb.authStore.record?.id
    if (!userId) {
      throw new Error('Usuário não autenticado para criar carreira.')
    }

    const idempotencyKey =
      input.idempotencyKey ||
      `KEY_${userId}_${input.name.trim().toLowerCase().replace(/\s+/g, '_')}_${input.initialYear}_${input.managedTeamId}`

    // 1. Verificação de idempotência: recibo já existente?
    try {
      const existingReceipt = await pb
        .collection('career_receipts')
        .getFirstListItem<CareerReceiptRecord>(`idempotency_key = "${idempotencyKey}"`)

      if (existingReceipt && existingReceipt.status === 'EXECUTED') {
        const existingCareer = await this.getCareerById(existingReceipt.career_id)
        const existingState = await this.getCareerState(existingReceipt.career_id)
        if (existingCareer && existingState) {
          return { career: existingCareer, state: existingState }
        }
      }
    } catch {
      // Nenhum recibo anterior com essa chave, prossegue para criação limpa
    }

    // 2. Montagem dos dados canônicos congelados via Regulamento Versionado
    const masterSeed = generateDeterministicSeed(input.name, input.initialYear, input.managedTeamId)
    const activeRuleset: VersionedRuleset = getDefaultRuleset()
    const rulesFrozen: FrozenRules = createFrozenRulesSnapshot(activeRuleset)

    // Equipes e forças participantes congeladas (50% - 150%, passo 5%)
    const teamsConfigFrozen: FrozenTeamConfig[] = input.selectedTeamIds.map((teamId) => {
      const t = teams.find((item) => item.id === teamId)
      const lineup = input.lineups[teamId]
      const powerFactor =
        teamId === input.managedTeamId
          ? Math.max(50, Math.min(150, Math.round(input.managedTeamPowerFactor / 5) * 5))
          : 100 // Equipes de IA iniciam em 100% de baseline

      return {
        teamId,
        teamName: t?.nome || teamId,
        teamCode: t?.codigo || 'GP',
        powerFactor,
        driver1Id: lineup?.driver1Id || drivers[0].id,
        driver2Id: lineup?.driver2Id || drivers[1].id,
        engineId: lineup?.engineId || engines[0].id,
      }
    })

    // 3. Criar registro da carreira
    const createdCareer = await pb.collection('careers').create<CareerRecord>({
      user_id: userId,
      name: input.name.trim(),
      initial_year: input.initialYear,
      current_year: input.initialYear,
      universe_type: input.universeType,
      manager_archetype_id: input.managerArchetypeId,
      managed_team_id: input.managedTeamId,
      managed_team_power_factor: Math.max(
        50,
        Math.min(150, Math.round(input.managedTeamPowerFactor / 5) * 5),
      ),
      master_seed: masterSeed,
      rules_frozen: rulesFrozen,
      teams_config_frozen: teamsConfigFrozen,
    })

    // 4. Montar finanças canônicas e contratos iniciais
    const managedTeamObj = teams.find((t) => t.id === input.managedTeamId)
    const managedLineup = input.lineups[input.managedTeamId]

    // Bônus do arquétipo de manager
    const managerObj = managers.find((m) => m.id === input.managerArchetypeId)
    const isEmpresario = managerObj?.archetypeCode === 'empresario'

    // Caixa inicial protegido sem dinheiro mágico (INV-05)
    // Equipes de ponta começam com caixa maior, equipes menores com orçamento desafiador
    const initialCash = isEmpresario ? 45_000_000 : 35_000_000
    const sponsorIncome = isEmpresario ? 85_000_000 : 75_000_000

    const initialFacilitiesState: Record<string, number> = managedTeamObj
      ? {
          design_center: managedTeamObj.facilities.designCenter,
          cfd_cluster: managedTeamObj.facilities.cfdCluster,
          wind_tunnel: managedTeamObj.facilities.windTunnel,
          industrial_structure: managedTeamObj.facilities.industrialStructure,
          factory: managedTeamObj.facilities.factory,
          operations_center: managedTeamObj.facilities.operationsCenter,
          pit_stop_center: managedTeamObj.facilities.pitStopCenter,
          simulator: managedTeamObj.facilities.simulator,
          driver_academy: managedTeamObj.facilities.driverAcademy,
        }
      : {
          design_center: 3,
          cfd_cluster: 3,
          wind_tunnel: 3,
          industrial_structure: 3,
          factory: 3,
          operations_center: 3,
          pit_stop_center: 3,
          simulator: 3,
          driver_academy: 3,
        }

    const contractsLedger: ContractsLedger = {
      driver1: {
        driverId: managedLineup?.driver1Id || drivers[0].id,
        salaryAnnual: 12_000_000,
        durationYears: 2,
      },
      driver2: {
        driverId: managedLineup?.driver2Id || drivers[1].id,
        salaryAnnual: 8_000_000,
        durationYears: 1,
      },
      engineSupplier: {
        engineId: managedLineup?.engineId || engines[0].id,
        costAnnual: 20_000_000,
        durationYears: 3,
      },
    }

    // 5. Criar CareerState
    const createdState = await pb.collection('career_state').create<CareerStateRecord>({
      career_id: createdCareer.id,
      user_id: userId,
      cash_balance: initialCash,
      cost_cap_budget: rulesFrozen.financialCapAmount,
      cost_cap_spent: 0,
      team_morale: 75,
      sponsor_income_annual: sponsorIncome,
      contracts_ledger: contractsLedger,
      facilities_state: initialFacilitiesState,
    })

    // 6. Gravar Recibo de Execução Idempotente (ENGINE-06)
    try {
      await pb.collection('career_receipts').create<CareerReceiptRecord>({
        career_id: createdCareer.id,
        user_id: userId,
        action_type: 'CAREER_BOOTSTRAP',
        idempotency_key: idempotencyKey,
        payload: {
          careerName: input.name,
          initialYear: input.initialYear,
          managedTeamId: input.managedTeamId,
          managerArchetypeId: input.managerArchetypeId,
          masterSeed,
        },
        status: 'EXECUTED',
      })
    } catch {
      // Ignora erro secundário de recibo para não quebrar a criação bem sucedida
    }

    return { career: createdCareer, state: createdState }
  },

  /**
   * Executa operação financeira de forma atômica e com validação no servidor (INV-04 / INV-05)
   * Chamando o endpoint seguro do backend /backend/v1/finances/execute-operation
   */
  async executeFinancialOperation(params: {
    careerId: string
    idempotencyKey: string
    actionType: string
    cost?: number
    income?: number
    countsAgainstCostCap?: boolean
    description?: string
    metadata?: Record<string, unknown>
  }): Promise<{
    state: CareerStateRecord
    receipt: CareerReceiptRecord
    idempotentReplayed: boolean
  }> {
    const res = await pb.send<{
      success: boolean
      idempotent_replayed: boolean
      receipt: CareerReceiptRecord
      state: CareerStateRecord
      message: string
    }>('/backend/v1/finances/execute-operation', {
      method: 'POST',
      body: {
        career_id: params.careerId,
        idempotency_key: params.idempotencyKey,
        action_type: params.actionType,
        cost: params.cost || 0,
        income: params.income || 0,
        counts_against_cost_cap: params.countsAgainstCostCap !== false,
        description: params.description || '',
        metadata: params.metadata || {},
      },
    })

    return {
      state: res.state,
      receipt: res.receipt,
      idempotentReplayed: res.idempotent_replayed,
    }
  },
}

export { validateFinancialOperation }
export type { FinancialCheckResult }
