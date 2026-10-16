// src/services/rdService.ts
// APEX GP Manager 2.0 - QA-GESTAO-05C3 (v0.0.18)
// Cliente de front-end para os endpoints do ciclo de P&D e das instalações.
// Toda regra de negócio é validada no servidor (pb_hooks); aqui apenas chamadas HTTP.

import pb from '../lib/pocketbase/client'
import type { RdCategory, RdRiskStrategy, RdStateCanonical } from '../data/rdConfig'

export interface RdProjectRecord {
  id: string
  career_id: string
  name: string
  category: RdCategory
  cost: number
  duration_rounds: number
  rounds_remaining: number
  status: string
  status_canonical: RdStateCanonical
  target_attributes: string
  risk_strategy: RdRiskStrategy
  project_seed: string
  result_seed: string
  result_rolled_at: string
  component_type: string
  component_name: string
  component_serial: string
  manufactured_component_id: string
  installed_component_id: string
  installed_car_index: string
  cancelled_reason: string
  spent_cash: number
  spend_cap_used: number
  released_cash: number
  released_cap: number
  progress_pct: number
  facility_allocations: Record<string, number>
  result_detail: {
    outcome?: string
    gainPct?: number
    facilityScore?: number
    investmentScore?: number
    spentCash?: number
    refunded?: number
    appliedGains?: Record<string, { from: number; to: number }>
  }
  state_history: { state: string; at: string; note: string }[]
  created: string
  updated: string
}

export interface FacilityUsageInfo {
  level: number
  used: number
  available: number
}

export interface RdStateResponse {
  success: boolean
  projects: RdProjectRecord[]
  facilities: Record<string, FacilityUsageInfo>
  effective_attributes: Record<string, number>
  reserved_cash: number
  reserved_cost_cap: number
}

export interface FacilityInfo {
  code: string
  name: string
  level: number
  maxLevel: number
  atMax: boolean
  nextUpgradeCost: number
  nextUpgradeRounds: number
  maintenanceAnnual: number
  consumer: string
  consumerLabel: string
  effect: string
  pendingIntegration: boolean
  inProgress: { id: string; toLevel: number; roundsRemaining: number } | null
}

export interface FacilitiesStateResponse {
  success: boolean
  facilities: FacilityInfo[]
}

async function callEndpoint<T>(
  method: 'POST' | 'GET',
  path: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const token = pb.authStore.token
  const baseUrl = pb.baseUrl.replace(/\/$/, '')
  const res = await fetch(`${baseUrl}${path}`, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: method === 'POST' ? JSON.stringify(payload || {}) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = (data as { message?: string }).message || `Erro ${res.status} em ${path}`
    throw new Error(message)
  }
  return data as T
}

export const rdService = {
  /** Visão completa do pipeline de P&D da carreira. */
  getState(careerId: string): Promise<RdStateResponse> {
    return callEndpoint<RdStateResponse>(
      'GET',
      `/backend/v1/rd/state?career_id=${encodeURIComponent(careerId)}`,
    )
  },

  /** PROPOSED -> RESERVED: define projeto e reserva orçamento (INV-04/INV-05). */
  propose(
    careerId: string,
    input: {
      name: string
      category: RdCategory
      cost: number
      duration_rounds: number
      risk_strategy: RdRiskStrategy
    },
  ): Promise<{ success: boolean; project: RdProjectRecord; reserve_key: string }> {
    return callEndpoint('POST', '/backend/v1/rd/propose', { career_id: careerId, ...input })
  },

  /** RESERVED -> RESEARCHING. */
  start(
    careerId: string,
    projectId: string,
  ): Promise<{ success: boolean; project: RdProjectRecord }> {
    return callEndpoint('POST', '/backend/v1/rd/start', {
      career_id: careerId,
      project_id: projectId,
    })
  },

  /** RESEARCHING -> DESIGNED | FAILED: sorte técnico único (seed determinística). */
  completeResearch(
    careerId: string,
    projectId: string,
  ): Promise<{
    success: boolean
    project: RdProjectRecord
    outcome: string
    gain_pct: number
    already_rolled?: boolean
  }> {
    return callEndpoint('POST', '/backend/v1/rd/complete-research', {
      career_id: careerId,
      project_id: projectId,
    })
  },

  /** DESIGNED -> MANUFACTURING: consome Fábrica e Estrutura Industrial. */
  startManufacturing(
    careerId: string,
    projectId: string,
  ): Promise<{ success: boolean; project: RdProjectRecord }> {
    return callEndpoint('POST', '/backend/v1/rd/start-manufacturing', {
      career_id: careerId,
      project_id: projectId,
    })
  },

  /** MANUFACTURING -> READY: cria o componente físico no inventário (car_components). */
  completeManufacturing(
    careerId: string,
    projectId: string,
  ): Promise<{
    success: boolean
    project: RdProjectRecord
    component_id: string
    serial: string
    already_manufactured?: boolean
  }> {
    return callEndpoint('POST', '/backend/v1/rd/complete-manufacturing', {
      career_id: careerId,
      project_id: projectId,
    })
  },

  /** READY -> INSTALLED: aplica o ganho técnico UMA única vez no carro escolhido. */
  install(
    careerId: string,
    projectId: string,
    carIndex: 1 | 2,
  ): Promise<{ success: boolean; project: RdProjectRecord }> {
    return callEndpoint('POST', '/backend/v1/rd/install', {
      career_id: careerId,
      project_id: projectId,
      car_index: carIndex,
    })
  },

  /** Estado ativo -> CANCELLED: trata despesas incorridas e libera reservas. */
  cancel(
    careerId: string,
    projectId: string,
    reason: string,
  ): Promise<{ success: boolean; project: RdProjectRecord; spent_cash: number }> {
    return callEndpoint('POST', '/backend/v1/rd/cancel', {
      career_id: careerId,
      project_id: projectId,
      reason,
    })
  },
}

export const facilitiesService = {
  /** Matriz completa das 9 instalações, com consumidores e obras em andamento. */
  getState(careerId: string): Promise<FacilitiesStateResponse> {
    return callEndpoint<FacilitiesStateResponse>(
      'GET',
      `/backend/v1/facilities/state?career_id=${encodeURIComponent(careerId)}`,
    )
  },

  /** Inicia um upgrade de instalação (reserva caixa e teto; obra CONSTRUCTION). */
  upgrade(
    careerId: string,
    facilityCode: string,
  ): Promise<{ success: boolean; project: unknown; reserve_key: string; target_level: number }> {
    return callEndpoint('POST', '/backend/v1/facilities/upgrade', {
      career_id: careerId,
      facility_code: facilityCode,
    })
  },

  /** Avança obras na virada de rodada (confirma despesa e aplica o nível). */
  advanceRound(careerId: string): Promise<{
    success: boolean
    completed: { facilityCode: string; level: number }[]
    remaining_constructions: number
  }> {
    return callEndpoint('POST', '/backend/v1/facilities/advance-round', { career_id: careerId })
  },

  /** Cancela uma obra em andamento e libera a reserva. */
  cancel(careerId: string, projectId: string): Promise<{ success: boolean; project: unknown }> {
    return callEndpoint('POST', '/backend/v1/facilities/cancel', {
      career_id: careerId,
      project_id: projectId,
    })
  },
}

/** Resultado da suíte de aceitação executada no servidor (POST /backend/v1/qa/05c3). */
export interface QaSuiteResult {
  success: boolean
  version: string
  suite: string
  summary: { total: number; executed: number; passed: number; failed: number }
  results: { id: string; name: string; executed: boolean; passed: boolean; detail: string }[]
  evidence: unknown
  error?: string
  note?: string
}

/** Executa a suíte de aceite do 05C3 no servidor (ambiente isolado, apaga-se ao final). */
export function runQaSuite(): Promise<QaSuiteResult> {
  return callEndpoint<QaSuiteResult>('POST', '/backend/v1/qa/05c3', { keep_careers: false })
}
