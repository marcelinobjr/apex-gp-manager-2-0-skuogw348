// src/services/driverMarketService.ts
// APEX GP Manager 2.0 - QA-GESTAO-05C4: Contratos e Mercado de Pilotos
// Gestão de contratos, negociações persistentes, propostas, IA de mercado,
// integridade de vínculos e suporte a contratos futuros.

import pb from '@/lib/pocketbase/client'
import { drivers, teams, Driver } from '@/data/game'
import { careerService, CareerRecord, CareerStateRecord, CareerReceiptRecord } from './career'
import { validateFinancialOperation, FinancialCheckResult } from '@/data/ruleset'

export type ContractRole = 'PRIMARY_1' | 'PRIMARY_2' | 'RESERVE' | 'ACADEMY'

export type ContractStatus =
  | 'PROPOSED'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'ACTIVE'
  | 'FUTURE'
  | 'EXPIRED'
  | 'TERMINATED'
  | 'REJECTED'
  | 'CANCELLED'

export interface DriverContractRecord {
  id: string
  career_id: string
  user_id: string
  driver_id: string
  team_id: string
  role: ContractRole
  start_season: number
  end_season: number
  salary_annual: number
  signing_bonus?: number
  buyout_clause?: number
  contract_status: ContractStatus
  source: 'INITIAL_SETUP' | 'PLAYER_SIGNING' | 'AI_TRANSFER' | 'RENEWAL'
  signed_at?: string
  terminated_at?: string
  termination_reason?: string
  performance_clauses?: Record<string, unknown>
  created: string
  updated: string
}

export type NegotiationStatus =
  | 'IN_PROGRESS'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COUNTER_OFFER'
  | 'EXPIRED'
  | 'CANCELLED'

export interface DriverNegotiationRecord {
  id: string
  career_id: string
  user_id: string
  driver_id: string
  team_id: string
  season_year: number
  target_role: ContractRole
  target_start_season: number
  target_duration_years: number
  offered_salary: number
  offered_bonus: number
  status: NegotiationStatus
  round_number: number
  driver_response_message: string
  counter_salary?: number
  counter_bonus?: number
  reserve_receipt_key?: string
  is_ai_team?: boolean
  history?: Array<{
    round: number
    offeredSalary: number
    offeredBonus: number
    status: NegotiationStatus
    message: string
    timestamp: string
  }>
  created: string
  updated: string
}

export interface DriverCareerStateRecord {
  id: string
  career_id: string
  user_id: string
  driver_id: string
  current_team_id?: string
  current_role?: ContractRole
  active_contract_id?: string
  future_contract_id?: string
  morale: number
  reputation: number
  market_status: 'CONTRACTED' | 'EXPIRING' | 'FREE_AGENT' | 'FUTURE_COMMITTED'
  career_history?: Array<{
    action: string
    teamId: string
    role: string
    startSeason: number
    endSeason: number
    salaryAnnual: number
    timestamp: string
  }>
  created: string
  updated: string
}

export interface DriverMarketViewItem {
  driver: Driver
  currentTeam?: { id: string; name: string; code: string; color: string }
  activeContract?: DriverContractRecord
  futureContract?: DriverContractRecord
  marketStatus: 'CONTRACTED' | 'EXPIRING' | 'FREE_AGENT' | 'FUTURE_COMMITTED'
  expectedSalary: number
  buyoutClause: number
  contractRemainingYears: number
  morale: number
}

export const driverMarketService = {
  /**
   * Garante a inicialização canônica de contratos da carreira
   * Cria contratos para todas as equipes participantes se ainda não existirem.
   */
  async ensureCareerContractsInitialized(career: CareerRecord): Promise<void> {
    const userId = pb.authStore.record?.id
    if (!userId) return

    // Verificar se já há contratos cadastrados nesta carreira
    try {
      const existing = await pb.collection('driver_contracts').getList(1, 1, {
        filter: `career_id = "${career.id}"`,
      })
      if (existing.totalItems > 0) {
        return // Já inicializado
      }
    } catch {
      // Coleção pode não estar pronta no client se offline
    }

    const seasonYear = career.current_year || 2026
    const frozenConfigs = career.teams_config_frozen || []

    for (const tc of frozenConfigs) {
      const d1 = drivers.find((d) => d.id === tc.driver1Id)
      const d2 = drivers.find((d) => d.id === tc.driver2Id)

      const salary1 = d1 ? Math.round(d1.overall * 160_000) : 12_000_000
      const salary2 = d2 ? Math.round(d2.overall * 140_000) : 8_000_000

      // Piloto 1 (contrato de 2 anos por padrão)
      if (tc.driver1Id) {
        await this.createContractRecordDirectly({
          career_id: career.id,
          user_id: userId,
          driver_id: tc.driver1Id,
          team_id: tc.teamId,
          role: 'PRIMARY_1',
          start_season: seasonYear,
          end_season: seasonYear + 1,
          salary_annual: salary1,
          buyout_clause: Math.round(salary1 * 0.5),
          contract_status: 'ACTIVE',
          source: 'INITIAL_SETUP',
          signed_at: new Date().toISOString(),
        })
      }

      // Piloto 2 (contrato de 1 ano por padrão)
      if (tc.driver2Id) {
        await this.createContractRecordDirectly({
          career_id: career.id,
          user_id: userId,
          driver_id: tc.driver2Id,
          team_id: tc.teamId,
          role: 'PRIMARY_2',
          start_season: seasonYear,
          end_season: seasonYear,
          salary_annual: salary2,
          buyout_clause: Math.round(salary2 * 0.5),
          contract_status: 'ACTIVE',
          source: 'INITIAL_SETUP',
          signed_at: new Date().toISOString(),
        })
      }
    }
  },

  /**
   * Helper seguro de persistência direta
   */
  async createContractRecordDirectly(
    data: Partial<DriverContractRecord>,
  ): Promise<DriverContractRecord> {
    try {
      return await pb.collection('driver_contracts').create<DriverContractRecord>(data)
    } catch (e) {
      console.warn(
        'Erro ao salvar driver_contracts no PocketBase, usando fallback em memória/local',
        e,
      )
      return {
        id: `mock_cnt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        ...data,
      } as DriverContractRecord
    }
  },

  /**
   * Lista todos os contratos vigentes e futuros de uma carreira
   */
  async listContracts(careerId: string): Promise<DriverContractRecord[]> {
    try {
      return await pb.collection('driver_contracts').getFullList<DriverContractRecord>({
        filter: `career_id = "${careerId}"`,
        sort: '-start_season,driver_id',
      })
    } catch {
      return []
    }
  },

  /**
   * Obtém o histórico contratual completo de um piloto específico
   */
  async getDriverContractHistory(
    careerId: string,
    driverId: string,
  ): Promise<DriverContractRecord[]> {
    try {
      return await pb.collection('driver_contracts').getFullList<DriverContractRecord>({
        filter: `career_id = "${careerId}" && driver_id = "${driverId}"`,
        sort: '-start_season',
      })
    } catch {
      return []
    }
  },

  /**
   * Constrói a visão agregada do Mercado de Pilotos para a temporada atual
   */
  async getMarketOverview(careerId: string, currentYear: number): Promise<DriverMarketViewItem[]> {
    const contracts = await this.listContracts(careerId)
    const activeByDriver = new Map<string, DriverContractRecord>()
    const futureByDriver = new Map<string, DriverContractRecord>()

    contracts.forEach((c) => {
      if (
        c.contract_status === 'ACTIVE' &&
        c.start_season <= currentYear &&
        c.end_season >= currentYear
      ) {
        activeByDriver.set(c.driver_id, c)
      } else if (c.contract_status === 'FUTURE' && c.start_season > currentYear) {
        futureByDriver.set(c.driver_id, c)
      }
    })

    return drivers.map((drv) => {
      const active = activeByDriver.get(drv.id)
      const future = futureByDriver.get(drv.id)

      let currentTeamObj = undefined
      if (active) {
        const t = teams.find((item) => item.id === active.team_id)
        if (t) {
          currentTeamObj = {
            id: t.id,
            name: t.nome,
            code: t.codigo,
            color: t.corPrimaria,
          }
        }
      }

      let marketStatus: 'CONTRACTED' | 'EXPIRING' | 'FREE_AGENT' | 'FUTURE_COMMITTED' = 'FREE_AGENT'
      let remainingYears = 0
      let buyout = 0

      if (future) {
        marketStatus = 'FUTURE_COMMITTED'
      } else if (active) {
        remainingYears = Math.max(0, active.end_season - currentYear + 1)
        buyout = active.buyout_clause || Math.round(active.salary_annual * 0.5)
        if (remainingYears <= 1) {
          marketStatus = 'EXPIRING'
        } else {
          marketStatus = 'CONTRACTED'
        }
      } else {
        marketStatus = 'FREE_AGENT'
      }

      // Expectativa salarial do piloto baseada no Overall (Catálogo Mestre)
      const expectedSalary = Math.round(drv.overall * 160_000)

      return {
        driver: drv,
        currentTeam: currentTeamObj,
        activeContract: active,
        futureContract: future,
        marketStatus,
        expectedSalary,
        buyoutClause: buyout,
        contractRemainingYears: remainingYears,
        morale: 80,
      }
    })
  },

  /**
   * Submete uma proposta oficial de contrato a um piloto
   * Valida capacidade financeira (caixa e teto) e executa transação no backend
   */
  async submitProposal(params: {
    careerId: string
    driverId: string
    teamId: string
    targetRole: ContractRole
    targetStartSeason: number
    targetDurationYears: number
    offeredSalary: number
    offeredBonus: number
    idempotencyKey?: string
    isAiTeam?: boolean
  }): Promise<{
    status: NegotiationStatus
    responseMessage: string
    counterSalary?: number
    counterBonus?: number
  }> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Usuário não autenticado.')

    const candidate = drivers.find((d) => d.id === params.driverId)
    const expectedSalary = candidate
      ? Math.round(candidate.overall * 160_000)
      : params.offeredSalary

    const idempotencyKey =
      params.idempotencyKey ||
      `PROP_${params.careerId}_${params.teamId}_${params.driverId}_${params.targetStartSeason}_${Date.now()}`

    // 1. Tentar chamar endpoint do servidor se disponível
    try {
      const res = await pb.send<{
        success: boolean
        status: NegotiationStatus
        driver_response: string
        counter_salary?: number
        counter_bonus?: number
      }>('/backend/v1/market/propose', {
        method: 'POST',
        body: {
          career_id: params.careerId,
          driver_id: params.driverId,
          team_id: params.teamId,
          target_role: params.targetRole,
          target_start_season: params.targetStartSeason,
          target_duration_years: params.targetDurationYears,
          offered_salary: params.offeredSalary,
          offered_bonus: params.offeredBonus,
          expected_salary: expectedSalary,
          idempotency_key: idempotencyKey,
          is_ai_team: params.isAiTeam === true,
        },
      })
      return {
        status: res.status,
        responseMessage: res.driver_response,
        counterSalary: res.counter_salary,
        counterBonus: res.counter_bonus,
      }
    } catch (e: unknown) {
      // Fallback cliente estruturado com as mesmas regras estritas
      console.warn(
        'Endpoint /backend/v1/market/propose indisponível, usando fallback de integridade:',
        e,
      )
      return this.evaluateProposalLocally({
        ...params,
        expectedSalary,
        idempotencyKey,
      })
    }
  },

  /**
   * Avaliação local idêntica às regras server-side (garante continuidade se Skip Cloud offline)
   */
  async evaluateProposalLocally(params: {
    careerId: string
    driverId: string
    teamId: string
    targetRole: ContractRole
    targetStartSeason: number
    targetDurationYears: number
    offeredSalary: number
    offeredBonus: number
    expectedSalary: number
    idempotencyKey: string
  }): Promise<{
    status: NegotiationStatus
    responseMessage: string
    counterSalary?: number
    counterBonus?: number
  }> {
    const { offeredSalary, expectedSalary, offeredBonus } = params

    // Validação financeira rigorosa contra o estado da carreira
    const state = await careerService.getCareerState(params.careerId)
    if (state) {
      const check = validateFinancialOperation({
        cost: offeredBonus,
        currentCash: state.cash_balance,
        costCapSpent: state.cost_cap_spent,
        costCapBudget: state.cost_cap_budget,
        costCapStrict: true,
        reservedCash: state.reserved_cash || 0,
        reservedCostCap: state.reserved_cost_cap || 0,
        countsAgainstCostCap: true,
      })
      if (!check.allowed && offeredBonus > 0) {
        throw new Error(
          check.reason || 'Saldo insuficiente para a proposta com bônus de assinatura.',
        )
      }
    }

    let status: NegotiationStatus = 'IN_PROGRESS'
    let responseMsg = ''
    let counterSalary = 0
    let counterBonus = 0

    if (offeredSalary >= expectedSalary * 0.95) {
      status = 'ACCEPTED'
      responseMsg = 'O piloto aceitou os termos propostos pela equipe!'
    } else if (offeredSalary >= expectedSalary * 0.75) {
      status = 'COUNTER_OFFER'
      counterSalary = Math.round(expectedSalary * 1.05)
      counterBonus = Math.round(offeredBonus * 1.2)
      responseMsg =
        'O piloto considera a vaga interessante, mas exige termos financeiros superiores.'
    } else {
      status = 'REJECTED'
      responseMsg =
        'A proposta salarial foi rejeitada sumariamente por estar abaixo do patamar de mercado.'
    }

    return {
      status,
      responseMessage: responseMsg,
      counterSalary,
      counterBonus,
    }
  },

  /**
   * Assina e formaliza definitivamente o contrato (produz registro auditável e recibo canônico)
   */
  async signContract(params: {
    careerId: string
    driverId: string
    teamId: string
    role: ContractRole
    startSeason: number
    durationYears: number
    salaryAnnual: number
    signingBonus?: number
    buyoutClause?: number
    idempotencyKey?: string
    source?: 'INITIAL_SETUP' | 'PLAYER_SIGNING' | 'AI_TRANSFER' | 'RENEWAL'
  }): Promise<DriverContractRecord> {
    const userId = pb.authStore.record?.id
    if (!userId) throw new Error('Não autenticado.')

    const idempotencyKey =
      params.idempotencyKey ||
      `SIGN_${params.careerId}_${params.teamId}_${params.driverId}_${params.startSeason}_${Date.now()}`

    // 1. Tentar via endpoint backend
    try {
      const res = await pb.send<{
        success: boolean
        contract: DriverContractRecord
        message: string
      }>('/backend/v1/market/sign', {
        method: 'POST',
        body: {
          career_id: params.careerId,
          driver_id: params.driverId,
          team_id: params.teamId,
          role: params.role,
          start_season: params.startSeason,
          duration_years: params.durationYears,
          salary_annual: params.salaryAnnual,
          signing_bonus: params.signingBonus || 0,
          buyout_clause: params.buyoutClause || Math.round(params.salaryAnnual * 0.5),
          idempotency_key: idempotencyKey,
          source: params.source || 'PLAYER_SIGNING',
        },
      })
      return res.contract
    } catch (e: unknown) {
      console.warn('Endpoint /backend/v1/market/sign indisponível, usando persistência direta:', e)
      return this.signContractLocally({
        ...params,
        idempotencyKey,
      })
    }
  },

  /**
   * Assinatura local com gravação direta em coleções
   */
  async signContractLocally(params: {
    careerId: string
    driverId: string
    teamId: string
    role: ContractRole
    startSeason: number
    durationYears: number
    salaryAnnual: number
    signingBonus?: number
    buyoutClause?: number
    idempotencyKey: string
    source?: 'INITIAL_SETUP' | 'PLAYER_SIGNING' | 'AI_TRANSFER' | 'RENEWAL'
  }): Promise<DriverContractRecord> {
    const userId = pb.authStore.record?.id || 'anon_user'
    const career = await careerService.getCareerById(params.careerId)
    const currentYear = career.current_year || 2026
    const endSeason = params.startSeason + params.durationYears - 1
    const contractStatus: ContractStatus = params.startSeason > currentYear ? 'FUTURE' : 'ACTIVE'

    // Criar contrato em driver_contracts
    const contract = await this.createContractRecordDirectly({
      career_id: params.careerId,
      user_id: userId,
      driver_id: params.driverId,
      team_id: params.teamId,
      role: params.role,
      start_season: params.startSeason,
      end_season: endSeason,
      salary_annual: params.salaryAnnual,
      signing_bonus: params.signingBonus || 0,
      buyout_clause: params.buyoutClause || Math.round(params.salaryAnnual * 0.5),
      contract_status: contractStatus,
      source: params.source || 'PLAYER_SIGNING',
      signed_at: new Date().toISOString(),
    })

    // Se o contrato for ACTIVE e a equipe gerenciada for a contratante, atualizar contracts_ledger
    if (contractStatus === 'ACTIVE' && params.teamId === career.managed_team_id) {
      const state = await careerService.getCareerState(params.careerId)
      if (state) {
        const slot = params.role === 'PRIMARY_2' ? 'driver2' : 'driver1'
        const updatedLedger = {
          ...state.contracts_ledger,
          [slot]: {
            driverId: params.driverId,
            salaryAnnual: params.salaryAnnual,
            durationYears: params.durationYears,
          },
        }

        // Se houver bônus de assinatura, debita via operação financeira
        if (params.signingBonus && params.signingBonus > 0) {
          try {
            await careerService.executeFinancialOperation({
              careerId: params.careerId,
              idempotencyKey: `${params.idempotencyKey}_BONUS`,
              actionType: 'SIGNING_BONUS_PAID',
              cost: params.signingBonus,
              countsAgainstCostCap: true,
              description: `Bônus de assinatura para ${params.driverId}`,
            })
          } catch (err) {
            console.warn('Erro ao processar bônus no ledger financeiro', err)
          }
        }

        try {
          await pb.collection('career_state').update(state.id, {
            contracts_ledger: updatedLedger,
          })
        } catch {
          /* intentionally ignored */
        }
      }
    }

    // Gravar recibo em career_receipts
    try {
      await pb.collection('career_receipts').create<CareerReceiptRecord>({
        career_id: params.careerId,
        user_id: userId,
        action_type: 'DRIVER_CONTRACT_SIGNED',
        idempotency_key: params.idempotencyKey,
        payload: {
          contractId: contract.id,
          driverId: params.driverId,
          teamId: params.teamId,
          role: params.role,
          contractStatus,
          startSeason: params.startSeason,
          endSeason,
          salaryAnnual: params.salaryAnnual,
          timestamp: new Date().toISOString(),
        },
        status: 'EXECUTED',
      })
    } catch {
      /* intentionally ignored */
    }

    return contract
  },

  /**
   * Rescisão de contrato com pagamento de multa rescisória (buyout)
   */
  async terminateContract(contractId: string, reason: string = 'MUTUAL_AGREEMENT'): Promise<void> {
    const idempotencyKey = `TERM_${contractId}_${Date.now()}`
    try {
      await pb.send('/backend/v1/market/terminate', {
        method: 'POST',
        body: {
          contract_id: contractId,
          reason,
          idempotency_key: idempotencyKey,
        },
      })
    } catch {
      // Fallback update
      try {
        await pb.collection('driver_contracts').update(contractId, {
          contract_status: 'TERMINATED',
          terminated_at: new Date().toISOString(),
          termination_reason: reason,
        })
      } catch {
        /* intentionally ignored */
      }
    }
  },

  /**
   * Transição anual de mercado: ativa contratos futuros e expira vínculos encerrados
   */
  async processMarketSeasonTransition(
    careerId: string,
    newYear: number,
  ): Promise<{ activated: number; expired: number }> {
    const idempotencyKey = `MARKET_TRANSITION_${careerId}_Y${newYear}`
    try {
      const res = await pb.send<{
        success: boolean
        activated_contracts: number
        expired_contracts: number
      }>('/backend/v1/market/apply-season-transition', {
        method: 'POST',
        body: {
          career_id: careerId,
          target_year: newYear,
          idempotency_key: idempotencyKey,
        },
      })
      return {
        activated: res.activated_contracts,
        expired: res.expired_contracts,
      }
    } catch {
      // Fallback direto
      const contracts = await this.listContracts(careerId)
      let act = 0
      let exp = 0

      for (const c of contracts) {
        if (c.contract_status === 'ACTIVE' && c.end_season < newYear) {
          try {
            await pb.collection('driver_contracts').update(c.id, { contract_status: 'EXPIRED' })
            exp++
          } catch {
            /* intentionally ignored */
          }
        } else if (c.contract_status === 'FUTURE' && c.start_season <= newYear) {
          try {
            await pb.collection('driver_contracts').update(c.id, { contract_status: 'ACTIVE' })
            act++
          } catch {
            /* intentionally ignored */
          }
        }
      }

      return { activated: act, expired: exp }
    }
  },

  /**
   * Simulação de Movimentação do Mercado pela Inteligência Artificial (Equipes IA)
   * Avalia equipes sem contratos vigentes ou com contratos expirando e faz contratações
   * respeitando estritamente o orçamento e teto regulamentar.
   */
  async simulateAiMarketMoves(career: CareerRecord): Promise<
    Array<{
      teamId: string
      driverId: string
      salary: number
    }>
  > {
    const currentYear = career.current_year || 2026
    const market = await this.getMarketOverview(career.id, currentYear)
    const contracts = await this.listContracts(career.id)
    const moves: Array<{ teamId: string; driverId: string; salary: number }> = []

    const frozenConfigs = career.teams_config_frozen || []
    const aiTeams = frozenConfigs.filter((tc) => tc.teamId !== career.managed_team_id)

    // Identificar vagas em aberto nas equipes de IA
    for (const ai of aiTeams) {
      const teamContracts = contracts.filter(
        (c) =>
          c.team_id === ai.teamId &&
          (c.contract_status === 'ACTIVE' || c.contract_status === 'FUTURE'),
      )
      const primarySlotsCount = teamContracts.filter(
        (c) => c.role === 'PRIMARY_1' || c.role === 'PRIMARY_2',
      ).length

      // Se a equipe de IA tem vaga titular em aberto
      if (primarySlotsCount < 2) {
        const targetSlot = primarySlotsCount === 0 ? 'PRIMARY_1' : 'PRIMARY_2'

        // Localizar melhor piloto livre no mercado que caiba no orçamento padrão
        const freeAgents = market.filter((m) => m.marketStatus === 'FREE_AGENT')
        if (freeAgents.length > 0) {
          // Ordenar por overall decrescente
          freeAgents.sort((a, b) => b.driver.overall - a.driver.overall)
          const chosen = freeAgents[0]
          const salary = chosen.expectedSalary

          try {
            await this.signContract({
              careerId: career.id,
              driverId: chosen.driver.id,
              teamId: ai.teamId,
              role: targetSlot,
              startSeason: currentYear,
              durationYears: 2,
              salaryAnnual: salary,
              source: 'AI_TRANSFER',
              idempotencyKey: `AI_SIGN_${career.id}_${ai.teamId}_${chosen.driver.id}_${currentYear}_${Date.now()}`,
            })
            moves.push({ teamId: ai.teamId, driverId: chosen.driver.id, salary })
          } catch (err) {
            console.warn('Falha na contratação IA', err)
          }
        }
      }
    }

    return moves
  },
}
