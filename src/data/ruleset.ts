/**
 * Sistema Canônico de Regulamento Versionado (Ruleset) - APEX GP Manager 2.0
 * Conforme Documento Mestre v2.2 (MBJ, 15/10/2026) e Lote QA-GESTAO-05B
 *
 * Princípios de Design:
 * 1. Regulamentos são versionados (ex: '2026.1_PROVISIONAL').
 * 2. Cada carreira ao ser criada (/carreira/nova) recebe um snapshot congelado
 *    de suas regras (FrozenRules) gravado em 'careers.rules_frozen'.
 * 3. O teto orçamentário anual (financialCapAmount) provisório é mantido em US$ 135 milhões
 *    até aprovação explícita do usuário.
 * 4. Carreiras já existentes e em andamento NUNCA têm seus limites retroativamente
 *    ou silenciosamente alterados: o motor e a UI consultam o snapshot congelado da carreira
 *    ou career_state.cost_cap_budget.
 * 5. Validação independente de Teto Regulamentar (INV-04) e Caixa Disponível (INV-05).
 */

export interface VersionedRuleset {
  version: string
  codeName: string
  effectiveYear: number
  description: string
  financialCapAmount: number // Teto regulamentar anual em USD (ex: 135_000_000)
  financialCapStrict: boolean // INV-04: bloqueio estrito contra ultrapassagem
  scoringSystem: string // Canônico: '25-18-15-12-10-8-6-4-2-1'
  pointsForFastestLap: boolean // Ponto extra no Top 10
  engineFreeze: boolean // Congelamento técnico de motores
  freeToPlayDoesNotAlterPhysics: boolean // INV-07: integridade física
  minWeightKg: number // Peso mínimo homologado do chassi
  isProvisional: boolean // Flag de aprovação provisória pendente
}

/**
 * Catálogo Canônico de Regulamentos Versionados
 * O valor de US$ 135.000.000 é centralizado aqui e mantido provisório.
 */
export const OFFICIAL_RULESETS: Record<string, VersionedRuleset> = {
  '2026.1_PROVISIONAL': {
    version: '2026.1_PROVISIONAL',
    codeName: 'FIA APEX World Championship 2026 (Provisório)',
    effectiveYear: 2026,
    description:
      'Regulamento Financeiro, Técnico e Desportivo Canônico 2026. Teto de US$ 135M mantido provisório até homologação final.',
    financialCapAmount: 135_000_000, // US$ 135 milhões canônico mantido provisório
    financialCapStrict: true,
    scoringSystem: '25-18-15-12-10-8-6-4-2-1',
    pointsForFastestLap: true,
    engineFreeze: false,
    freeToPlayDoesNotAlterPhysics: true,
    minWeightKg: 798,
    isProvisional: true,
  },
}

/**
 * Regulamento padrão em vigor para novas carreiras
 */
export const CURRENT_DEFAULT_RULESET_ID = '2026.1_PROVISIONAL'

export function getDefaultRuleset(): VersionedRuleset {
  return OFFICIAL_RULESETS[CURRENT_DEFAULT_RULESET_ID]
}

/**
 * Obtém regras versionadas pelo ID ou fallback para o padrão
 */
export function getRulesetByVersion(version?: string): VersionedRuleset {
  if (version && OFFICIAL_RULESETS[version]) {
    return OFFICIAL_RULESETS[version]
  }
  return getDefaultRuleset()
}

/**
 * Snapshot congelado a ser gravado em `careers.rules_frozen`
 */
export interface FrozenRulesSnapshot {
  rulesetVersion: string
  financialCapAmount: number
  financialCapStrict: boolean
  scoringSystem: string
  pointsForFastestLap: boolean
  engineFreeze: boolean
  freeToPlayDoesNotAlterPhysics: boolean
  minWeightKg: number
  frozenAt?: string
}

/**
 * Cria snapshot congelado a partir de um ruleset versionado para gravar na carreira
 */
export function createFrozenRulesSnapshot(
  ruleset: VersionedRuleset = getDefaultRuleset(),
): FrozenRulesSnapshot {
  return {
    rulesetVersion: ruleset.version,
    financialCapAmount: ruleset.financialCapAmount,
    financialCapStrict: ruleset.financialCapStrict,
    scoringSystem: ruleset.scoringSystem,
    pointsForFastestLap: ruleset.pointsForFastestLap,
    engineFreeze: ruleset.engineFreeze,
    freeToPlayDoesNotAlterPhysics: ruleset.freeToPlayDoesNotAlterPhysics,
    minWeightKg: ruleset.minWeightKg,
    frozenAt: new Date().toISOString(),
  }
}

/**
 * Formata valor monetário de milhões de dólares (ex: $135M ou $135.000.000)
 */
export function formatCurrencyMillions(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(0)}M`
}

export function formatCurrencyFull(amount: number): string {
  return `$${amount.toLocaleString('pt-BR')} / ano`
}

/**
 * Validação financeira dupla e independente:
 * 1. Disponibilidade de Caixa (INV-05: sem dinheiro mágico)
 * 2. Teto de Gastos Regulamentar Anual (INV-04: bloqueio de teto orçamentário)
 */
export interface FinancialCheckResult {
  allowed: boolean
  reason?: string
  cashCheck: {
    passed: boolean
    required: number
    available: number
  }
  costCapCheck: {
    passed: boolean
    cost: number
    spent: number
    capBudget: number
    projectedSpent: number
    isCapStrict: boolean
  }
}

export function validateFinancialOperation(params: {
  cost: number
  currentCash: number
  costCapSpent: number
  costCapBudget: number
  costCapStrict?: boolean
}): FinancialCheckResult {
  const { cost, currentCash, costCapSpent, costCapBudget, costCapStrict = true } = params

  const cashPassed = currentCash >= cost
  const projectedSpent = costCapSpent + cost
  const capPassed = !costCapStrict || projectedSpent <= costCapBudget

  let reason: string | undefined
  if (!cashPassed) {
    reason = `Saldo em caixa insuficiente: requer $${(cost / 1_000_000).toFixed(2)}M, disponível $${(
      currentCash / 1_000_000
    ).toFixed(2)}M.`
  } else if (!capPassed) {
    reason = `Bloqueio de Teto de Gastos (INV-04): a operação totalizaria $${(
      projectedSpent / 1_000_000
    ).toFixed(2)}M, excedendo o teto anual de $${(costCapBudget / 1_000_000).toFixed(0)}M.`
  }

  return {
    allowed: cashPassed && capPassed,
    reason,
    cashCheck: {
      passed: cashPassed,
      required: cost,
      available: currentCash,
    },
    costCapCheck: {
      passed: capPassed,
      cost,
      spent: costCapSpent,
      capBudget: costCapBudget,
      projectedSpent,
      isCapStrict: costCapStrict,
    },
  }
}
