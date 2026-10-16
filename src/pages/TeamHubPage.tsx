import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Trophy,
  Users,
  Wrench,
  Lightbulb,
  Building2,
  DollarSign,
  Calendar,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingUp,
  RefreshCw,
} from 'lucide-react'
import { careerService, CareerRecord, CareerStateRecord } from '@/services/career'
import {
  teamManagementService,
  SeasonRecord,
  SeasonEventRecord,
  CarComponentRecord,
  RDProjectRecord,
} from '@/services/teamManagement'
import { teams, drivers, circuits, engines } from '@/data/game'
import { assets } from '@/lib/assets'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function TeamHubPage() {
  const navigate = useNavigate()
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [state, setState] = useState<CareerStateRecord | null>(null)
  const [season, setSeason] = useState<SeasonRecord | null>(null)
  const [events, setEvents] = useState<SeasonEventRecord[]>([])
  const [components, setComponents] = useState<CarComponentRecord[]>([])
  const [rdProjects, setRdProjects] = useState<RDProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await careerService.listUserCareers()
      if (list.length === 0) {
        navigate('/carreira/nova')
        return
      }
      const activeCareer = list[0]
      setCareer(activeCareer)

      const activeState = await careerService.getCareerState(activeCareer.id)
      setState(activeState)

      const { season: s, events: evs } =
        await teamManagementService.ensureSeasonInitialized(activeCareer)
      setSeason(s)
      setEvents(evs)

      const comps = await teamManagementService.getCarComponents(activeCareer.id)
      setComponents(comps)

      const projs = await teamManagementService.getRDProjects(activeCareer.id)
      setRdProjects(projs)
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao carregar dados da equipe')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading || !career || !state || !season) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-mono">
          Carregando telemetria e dados canônicos da equipe...
        </p>
      </div>
    )
  }

  const managedTeam = teams.find((t) => t.id === career.managed_team_id)
  const d1 = drivers.find((d) => d.id === state.contracts_ledger?.driver1?.driverId)
  const d2 = drivers.find((d) => d.id === state.contracts_ledger?.driver2?.driverId)
  const eng = engines.find((e) => e.id === state.contracts_ledger?.engineSupplier?.engineId)

  // Próximo evento
  const currentEvent = events.find((ev) => ev.round === season.current_round) || events[0]
  const currentCircuit = circuits.find((c) => c.id === currentEvent?.circuit_id)

  // Posição no campeonato
  const teamStanding = season.constructors_standings?.find(
    (cs) => cs.teamId === career.managed_team_id,
  )
  const teamPosition =
    (season.constructors_standings?.findIndex((cs) => cs.teamId === career.managed_team_id) ?? -1) +
    1

  // Média de condição das peças
  const avgCondition =
    components.length > 0
      ? Math.round(components.reduce((acc, c) => acc + c.condition_pct, 0) / components.length)
      : 100

  // Disputar / avançar rodada (INV-01, INV-03)
  const handleAdvanceRound = async () => {
    if (!currentEvent || currentEvent.status === 'COMPLETED') {
      toast.info('Temporada encerrada ou sem etapa pendente.')
      return
    }
    try {
      setAdvancing(true)
      const res = await teamManagementService.advanceNextRound(career, season, currentEvent)
      toast.success(`Rodada ${currentEvent.round} concluída! Resultado oficial registrado.`)
      setSeason(res.updatedSeason)
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha na simulação oficial'
      toast.error(msg)
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Banner Superior da Equipe */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-r from-card/90 via-card/50 to-background p-6 md:p-8 backdrop-blur shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <img
              src={managedTeam?.emblema || assets.branding.logo}
              alt=""
              className="w-16 h-16 rounded-xl border border-border/50 object-cover bg-black/40 p-1"
              onError={(e) => {
                e.currentTarget.src = assets.branding.cover
              }}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono tracking-widest text-primary font-semibold">
                  Carreira {career.current_year} · {career.name}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-primary/20 text-primary border border-primary/30">
                  {career.universe_type}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1 text-foreground flex items-center gap-3">
                {managedTeam?.nome || 'Minha Equipe'}
                <span className="text-sm font-mono px-2.5 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border">
                  {managedTeam?.codigo || 'GP'}
                </span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Motor: {eng?.nome || 'Unidade Canônica'} · Força Regulamentar:{' '}
                {career.managed_team_power_factor}%
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-black/40 border border-border/40 rounded-xl px-4 py-2 text-right">
              <span className="text-[11px] font-mono uppercase text-muted-foreground block">
                Posição Mundial
              </span>
              <span className="text-2xl font-black text-amber-400">
                {teamPosition > 0 ? `${teamPosition}º` : '-'}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({teamStanding?.points || 0} pts)
                </span>
              </span>
            </div>
            <div className="bg-black/40 border border-border/40 rounded-xl px-4 py-2 text-right">
              <span className="text-[11px] font-mono uppercase text-muted-foreground block">
                Moral da Equipe
              </span>
              <span className="text-2xl font-black text-emerald-400 flex items-center gap-1">
                <Flame className="w-5 h-5 text-emerald-400 animate-pulse" />
                {state.team_morale}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Atalhos de Gestão (Módulo 4.x & 5.x) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link
          to="/equipe/pilotos"
          className="group p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-card/90 hover:border-primary/50 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-muted-foreground group-hover:text-primary">
            <Users className="w-5 h-5" />
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-mono text-muted-foreground uppercase">Módulo 4.2</p>
            <h3 className="font-bold text-sm text-foreground">Pilotos & Contratos</h3>
          </div>
        </Link>

        <Link
          to="/equipe/carro"
          className="group p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-card/90 hover:border-primary/50 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-muted-foreground group-hover:text-primary">
            <Wrench className="w-5 h-5" />
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-mono text-muted-foreground uppercase">Módulo 4.3</p>
            <h3 className="font-bold text-sm text-foreground">Carro & Desgaste</h3>
          </div>
        </Link>

        <Link
          to="/equipe/projetos"
          className="group p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-card/90 hover:border-primary/50 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-muted-foreground group-hover:text-primary">
            <Lightbulb className="w-5 h-5" />
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-mono text-muted-foreground uppercase">Módulo 4.4</p>
            <h3 className="font-bold text-sm text-foreground">P&D / Projetos</h3>
          </div>
        </Link>

        <Link
          to="/equipe/instalacoes"
          className="group p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-card/90 hover:border-primary/50 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-muted-foreground group-hover:text-primary">
            <Building2 className="w-5 h-5" />
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-mono text-muted-foreground uppercase">9 Estruturas</p>
            <h3 className="font-bold text-sm text-foreground">Instalações QG</h3>
          </div>
        </Link>

        <Link
          to="/equipe/financas"
          className="group p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-card/90 hover:border-primary/50 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-muted-foreground group-hover:text-primary">
            <DollarSign className="w-5 h-5" />
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-mono text-muted-foreground uppercase">INV-04</p>
            <h3 className="font-bold text-sm text-foreground">Finanças & Teto</h3>
          </div>
        </Link>

        <Link
          to="/temporada"
          className="group p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-card/90 hover:border-primary/50 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-muted-foreground group-hover:text-primary">
            <Calendar className="w-5 h-5" />
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="mt-4">
            <p className="text-xs font-mono text-muted-foreground uppercase">Módulo 5.x</p>
            <h3 className="font-bold text-sm text-foreground">Temporada & GP</h3>
          </div>
        </Link>
      </div>

      {/* Grid Central: Próximo GP e Status Operacional */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel do Próximo GP */}
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-lg">Próximo Desafio Oficial</h2>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-primary/10 text-primary border border-primary/20">
                ETAPA {season.current_round} DE {season.total_rounds}
              </span>
            </div>

            <div className="mt-6 flex flex-col md:flex-row items-center gap-6">
              <div className="relative w-full md:w-48 h-32 rounded-xl overflow-hidden border border-border/50 bg-black/60 flex items-center justify-center p-2">
                {currentCircuit?.svgPath ? (
                  <img
                    src={currentCircuit.svgPath}
                    alt={currentCircuit.nome}
                    className="max-h-full max-w-full object-contain filter drop-shadow"
                    onError={(e) => {
                      e.currentTarget.src = currentCircuit.imagem || assets.branding.cover
                    }}
                  />
                ) : (
                  <img
                    src={currentCircuit?.imagem || assets.circuit(1)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              <div className="flex-1 space-y-2">
                <h3 className="text-2xl font-extrabold text-foreground">
                  {currentEvent?.track_name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {currentCircuit?.pais} · {currentCircuit?.extensaoKm} km ·{' '}
                  {currentCircuit?.voltas} voltas
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border">
                    Clima: {currentEvent?.weather?.condition || 'SECO'}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border">
                    Ar: {currentEvent?.weather?.airTempC || 24}°C · Pista:{' '}
                    {currentEvent?.weather?.trackTempC || 34}°C
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground font-mono">
              INV-01: Simulação oficial idempotente. Um lançamento canônico por sessão.
            </p>
            <Button
              onClick={handleAdvanceRound}
              disabled={advancing || season.status === 'COMPLETED'}
              className="w-full sm:w-auto font-bold px-6 shadow-lg shadow-primary/20"
            >
              {advancing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Processando Corrida...
                </>
              ) : (
                <>Disputar Sessão Oficial #{season.current_round}</>
              )}
            </Button>
          </div>
        </div>

        {/* Resumo Rápido da Garagem */}
        <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" /> Condição do Carro
            </h3>
            <span className="text-xs font-mono font-bold text-emerald-400">{avgCondition}%</span>
          </div>

          {/* Dupla de pilotos */}
          <div className="space-y-3">
            <p className="text-xs uppercase font-mono text-muted-foreground">Dupla de Pilotos</p>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-border/30">
              <div className="flex items-center gap-3">
                <img
                  src={d1?.imagem || assets.driver(1)}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover border border-border/50"
                  onError={(e) => {
                    e.currentTarget.src = assets.branding.cover
                  }}
                />
                <div>
                  <p className="text-sm font-bold leading-none">{d1?.nome || 'Piloto 1'}</p>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Salário: $
                    {((state.contracts_ledger?.driver1?.salaryAnnual || 0) / 1_000_000).toFixed(1)}
                    M/ano
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">
                OV {d1?.overall || 80}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-border/30">
              <div className="flex items-center gap-3">
                <img
                  src={d2?.imagem || assets.driver(2)}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover border border-border/50"
                  onError={(e) => {
                    e.currentTarget.src = assets.branding.cover
                  }}
                />
                <div>
                  <p className="text-sm font-bold leading-none">{d2?.nome || 'Piloto 2'}</p>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Salário: $
                    {((state.contracts_ledger?.driver2?.salaryAnnual || 0) / 1_000_000).toFixed(1)}
                    M/ano
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/20 text-primary font-bold">
                OV {d2?.overall || 75}
              </span>
            </div>
          </div>

          {/* Teto de Gastos / Caixa */}
          <div className="space-y-2 pt-2 border-t border-border/30">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted-foreground">Teto de Gastos (INV-04)</span>
              <span className="font-bold text-foreground">
                ${(state.cost_cap_spent / 1_000_000).toFixed(1)}M / $
                {(state.cost_cap_budget / 1_000_000).toFixed(0)}M
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full transition-all ${
                  state.cost_cap_spent / state.cost_cap_budget > 0.9
                    ? 'bg-rose-500'
                    : state.cost_cap_spent / state.cost_cap_budget > 0.75
                      ? 'bg-amber-500'
                      : 'bg-primary'
                }`}
                style={{
                  width: `${Math.min(100, (state.cost_cap_spent / state.cost_cap_budget) * 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono pt-1">
              <span className="text-muted-foreground">Caixa Disponível</span>
              <span className="font-bold text-emerald-400">
                ${(state.cash_balance / 1_000_000).toFixed(2)}M
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
