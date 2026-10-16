import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  PiggyBank,
  Receipt,
  TrendingUp,
} from 'lucide-react'
import {
  careerService,
  CareerRecord,
  CareerStateRecord,
  CareerReceiptRecord,
} from '@/services/career'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

export function TeamFinancesPage() {
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [state, setState] = useState<CareerStateRecord | null>(null)
  const [receipts, setReceipts] = useState<CareerReceiptRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await careerService.listUserCareers()
      if (list.length > 0) {
        setCareer(list[0])
        const s = await careerService.getCareerState(list[0].id)
        setState(s)

        // Carregar recibos de auditoria/idempotência
        const recs = await pb.collection('career_receipts').getFullList<CareerReceiptRecord>({
          filter: `career_id = "${list[0].id}"`,
          sort: '-created',
          batch: 20,
        })
        setReceipts(recs)
      }
    } catch {
      toast.error('Erro ao carregar finanças')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading || !career || !state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const costCapRemaining = Math.max(0, state.cost_cap_budget - state.cost_cap_spent)
  const costCapPct = Math.min(100, (state.cost_cap_spent / state.cost_cap_budget) * 100)

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <Link
          to="/equipe"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Central da Equipe
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">Finanças & Teto Regulamentar</h1>
        <p className="text-sm text-muted-foreground">
          Gestão do caixa da equipe, patrocínios anuais e controle rigoroso do teto de gastos
          (INV-04 / INV-05).
        </p>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-mono uppercase">Saldo em Caixa</span>
            <PiggyBank className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-emerald-400">
            ${(state.cash_balance / 1_000_000).toFixed(2)}M
          </p>
          <p className="text-[11px] font-mono text-muted-foreground">
            INV-05: Proteção financeira uniforme sem dinheiro mágico.
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-mono uppercase">
              Teto Regulamentar{' '}
              {career.rules_frozen?.rulesetVersion ? `(${career.rules_frozen.rulesetVersion})` : ''}
            </span>
            <ShieldAlert className="w-5 h-5 text-primary" />
          </div>
          <p className="text-3xl font-black text-foreground">
            ${(state.cost_cap_budget / 1_000_000).toFixed(0)}M
          </p>
          <p className="text-[11px] font-mono text-muted-foreground">
            Disponível no Teto: ${(costCapRemaining / 1_000_000).toFixed(1)}M (Congelado na
            Carreira)
          </p>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-mono uppercase">Patrocínios Anuais</span>
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-black text-amber-400">
            ${(state.sponsor_income_annual / 1_000_000).toFixed(1)}M/ano
          </p>
          <p className="text-[11px] font-mono text-muted-foreground">
            Receita garantida creditada na virada de temporada (INV-02).
          </p>
        </div>
      </div>

      {/* Reservas e Compromissos Financeiros */}
      {state.reserved_cash || state.reserved_cost_cap ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <ShieldAlert className="w-4 h-4" />
            <span>Compromissos e Reservas Retidas</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-muted-foreground">
            <div>
              Caixa Reservado (Salários/Contratos):{' '}
              <strong className="text-foreground">
                ${((state.reserved_cash || 0) / 1_000_000).toFixed(2)}M
              </strong>
              <span className="block text-[11px] text-amber-300">
                Caixa Efetivamente Disponível: $
                {((state.cash_balance - (state.reserved_cash || 0)) / 1_000_000).toFixed(2)}M
              </span>
            </div>
            <div>
              Teto Reservado:{' '}
              <strong className="text-foreground">
                ${((state.reserved_cost_cap || 0) / 1_000_000).toFixed(2)}M
              </strong>
              <span className="block text-[11px] text-amber-300">
                Margem Livre Efetiva: $
                {((costCapRemaining - (state.reserved_cost_cap || 0)) / 1_000_000).toFixed(2)}M
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Barra de Progresso do Teto Orçamentário */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur space-y-4">
        {' '}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Utilização do Teto de Gastos (Cost Cap Audit)</h3>
            <p className="text-xs text-muted-foreground font-mono">
              Regulamentação estrita INV-04: operações acima do limite são bloqueadas pelo sistema.
            </p>
          </div>
          <span className="text-sm font-mono font-bold text-foreground">
            {costCapPct.toFixed(1)}% consumido
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full transition-all ${
              costCapPct > 90 ? 'bg-rose-500' : costCapPct > 70 ? 'bg-amber-500' : 'bg-primary'
            }`}
            style={{ width: `${costCapPct}%` }}
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs font-mono">
          <div>
            <span className="text-muted-foreground block">Gasto Acumulado:</span>
            <strong className="text-foreground">
              ${(state.cost_cap_spent / 1_000_000).toFixed(2)}M
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground block">Margem Livre:</span>
            <strong className="text-foreground">
              ${(costCapRemaining / 1_000_000).toFixed(2)}M
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground block">Salário Piloto 1:</span>
            <strong className="text-foreground">
              ${((state.contracts_ledger?.driver1?.salaryAnnual || 0) / 1_000_000).toFixed(1)}M
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground block">Salário Piloto 2:</span>
            <strong className="text-foreground">
              ${((state.contracts_ledger?.driver2?.salaryAnnual || 0) / 1_000_000).toFixed(1)}M
            </strong>
          </div>
        </div>
      </div>

      {/* Livro-Razão / Recibos de Idempotência (Ledger) */}
      <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base">
              Livro-Razão de Auditoria e Recibos (career_receipts)
            </h3>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {receipts.length} recibos registrados
          </span>
        </div>

        <div className="space-y-2">
          {receipts.map((r) => (
            <div
              key={r.id}
              className="p-3 rounded-xl bg-black/40 border border-border/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono"
            >
              <div>
                <span className="px-2 py-0.5 rounded bg-primary/20 text-primary font-bold mr-2">
                  {r.action_type}
                </span>
                <span className="text-muted-foreground">{r.idempotency_key}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 font-bold">{r.status}</span>
                <span className="text-muted-foreground">
                  {new Date(r.created).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
