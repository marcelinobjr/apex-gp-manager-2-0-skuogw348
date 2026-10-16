// src/data/rdConfig.ts
// APEX GP Manager 2.0 - QA-GESTAO-05C3 (v0.0.18)
// Configuração de front-end do ciclo de P&D (espelha as regras do hook rd_pipeline.js).
// A validação real acontece SEMPRE no servidor; aqui só há metadados de UI.

/** Áreas de engenharia e seus atributos-alvo (8 atributos técnicos canônicos). */
export type RdAttribute =
  | 'aeroDownforce' // Carga aerodinâmica
  | 'aeroEfficiency' // Eficiência aerodinâmica
  | 'mechanicalGrip' // Aderência mecânica
  | 'chassisBalance' // Equilíbrio do chassi
  | 'brakingPerformance' // Frenagem
  | 'tyrePreservation' // Preservação dos pneus
  | 'thermalManagement' // Gestão térmica
  | 'chassisReliability' // Confiabilidade do chassi

export type RdCategory = 'aero' | 'chassis' | 'braking' | 'tyre' | 'thermal' | 'reliability'

export const RD_ATTRIBUTE_LABELS: Record<RdAttribute, string> = {
  aeroDownforce: 'Carga aerodinâmica',
  aeroEfficiency: 'Eficiência aerodinâmica',
  mechanicalGrip: 'Aderência mecânica',
  chassisBalance: 'Equilíbrio do chassi',
  brakingPerformance: 'Frenagem',
  tyrePreservation: 'Preservação dos pneus',
  thermalManagement: 'Gestão térmica',
  chassisReliability: 'Confiabilidade do chassi',
}

/** Área -> atributos-alvo (a área NÃO altera atributos fora do seu escopo). */
export const RD_CATEGORY_TARGETS: Record<RdCategory, RdAttribute[]> = {
  aero: ['aeroDownforce', 'aeroEfficiency'],
  chassis: ['mechanicalGrip', 'chassisBalance'],
  braking: ['brakingPerformance'],
  tyre: ['tyrePreservation'],
  thermal: ['thermalManagement'],
  reliability: ['chassisReliability'],
}

export const RD_CATEGORY_LABELS: Record<RdCategory, string> = {
  aero: 'Aerodinâmica',
  chassis: 'Chassi',
  braking: 'Frenagem',
  tyre: 'Pneus',
  thermal: 'Gestão térmica',
  reliability: 'Confiabilidade',
}

/** Capacidade de instalações consumida por rodada de pesquisa, por área. */
export const RD_FACILITY_COST: Record<RdCategory, Partial<Record<string, number>>> = {
  aero: { cfd_cluster: 1, wind_tunnel: 1 },
  chassis: { design_center: 1 },
  braking: { design_center: 1, factory: 1 },
  tyre: { design_center: 1, wind_tunnel: 1 },
  thermal: { cfd_cluster: 1, factory: 1 },
  reliability: { design_center: 1, factory: 1 },
}

/** Estratégias de risco — distribuição 70/25/5 é parâmetro PROVISÓRIO do ruleset. */
export type RdRiskStrategy = 'CONSERVADORA' | 'EQUILIBRADA' | 'AGRESSIVA'

export const RD_RISK_STRATEGIES: {
  id: RdRiskStrategy
  label: string
  description: string
  provisionalDistribution: string
}[] = [
  {
    id: 'CONSERVADORA',
    label: 'Conservadora',
    description: 'Baixo risco de fracasso, ganhos menores e mais estáveis.',
    provisionalDistribution: '70% resultado normal / ganho reduzido',
  },
  {
    id: 'EQUILIBRADA',
    label: 'Equilibrada',
    description: 'Risco moderado com ganhos médios; 5% de chance de fracasso.',
    provisionalDistribution: '25% excelente / 70% normal / 5% fraco',
  },
  {
    id: 'AGRESSIVA',
    label: 'Agressiva',
    description: 'Alto risco: chance maior de fracasso, mas ganhos excelentes possíveis.',
    provisionalDistribution: '5% parâmetro provisório do ruleset — não homologado',
  },
]

/** Ciclo canônico de 8 estados (seção 13.5 do Doc Mestre v2.2). */
export type RdStateCanonical =
  | 'PROPOSED'
  | 'RESERVED'
  | 'RESEARCHING'
  | 'DESIGNED'
  | 'MANUFACTURING'
  | 'READY'
  | 'INSTALLED'
  | 'FAILED'
  | 'CANCELLED'

export const RD_STATE_LABELS: Record<RdStateCanonical, string> = {
  PROPOSED: 'Proposto',
  RESERVED: 'Reservado',
  RESEARCHING: 'Em pesquisa',
  DESIGNED: 'Projetado',
  MANUFACTURING: 'Em fabricação',
  READY: 'Pronto para instalação',
  INSTALLED: 'Instalado',
  FAILED: 'Malsucedido',
  CANCELLED: 'Cancelado',
}

export const RD_STATE_ORDER: RdStateCanonical[] = [
  'PROPOSED',
  'RESERVED',
  'RESEARCHING',
  'DESIGNED',
  'MANUFACTURING',
  'READY',
  'INSTALLED',
  'FAILED',
  'CANCELLED',
]

export const RD_OUTCOME_LABELS: Record<string, string> = {
  EXCELLENT: 'Excelente',
  NORMAL: 'Normal',
  POOR: 'Fraco',
  FAILED: 'Fracassado',
}
