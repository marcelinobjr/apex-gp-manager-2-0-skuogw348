import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Trophy,
  ArrowRight,
  RefreshCw,
  Flag,
  RotateCw,
  History,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { careerService, CareerRecord, CareerStateRecord } from '@/services/career'
import { teamManagementService, SeasonRecord, SeasonEventRecord } from '@/services/teamManagement'
import { circuits, teams, drivers } from '@/data/game'
import { assets } from '@/lib/assets'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function SeasonPage() {
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [state, setState] = useState<CareerStateRecord | null>(null)
  const [season, setSeason] = useState<SeasonRecord | null>(null)
  const [events, setEvents] = useState<SeasonEventRecord[]>([])
  const [activeTab, setActiveTab] = useState<'calendar' | 'standings' | 'transition'>('calendar')
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await careerService.listUserCareers()
      if (list.length > 0) {
        setCareer(list[0])
        const s = await careerService.getCareerState(list[0].id)
        setState(s)
        const { season: sn, events: evs } = await teamManagementService.ensureSeasonInitialized(
          list[0],
        )
        setSeason(sn)
        setEvents(evs)
      }
    } catch {
      toast.error('Erro ao carregar dados da temporada')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading || !career || !season) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const currentEvent = events.find((ev) => ev.round === season.current_round)

  // Simular corrida oficial (INV-01, INV-03)
  const handleAdvanceRound = async () => {
    if (!currentEvent || currentEvent.status === 'COMPLETED') {
      toast.info('Temporada já concluída ou sem rodada pendente.')
      return
    }
    try {
      setAdvancing(true)
      const res = await teamManagementService.advanceNextRound(career, season, currentEvent)
      setSeason(res.updatedSeason)
      toast.success(`GP Oficial #${currentEvent.round} concluído! Pontos creditados.`)
      await loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha na simulação oficial')
    } finally {
      setAdvancing(false)
    }
  }

  // Transição anual de temporada (INV-02)
  const handleSeasonTransition = async () => {
    try {
      setTransitioning(true)
      await teamManagementService.closeAndTransitionSeason(career, season)
      toast.success(
        `Temporada ${season.year} encerrada e imutabilizada! Ano ${season.year + 1} iniciado.`,
      )
      await loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha na transição anual')
    } finally {
      setTransitioning(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase text-primary font-bold">
            Módulo 5.x · Temporada Mundial
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Temporada {season.year}</h1>
          <p className="text-sm text-muted-foreground">
            Classificações derivadas estritamente do ledger canônico (INV-01/02) e calendário de 43
            circuitos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {season.status === 'COMPLETED' ? (
            <Button
              onClick={handleSeasonTransition}
              disabled={transitioning}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              {transitioning ? 'Processando Virada...' : `Iniciar Ano ${season.year + 1} (INV-02)`}
            </Button>
          ) : (
            <Button
              onClick={handleAdvanceRound}
              disabled={advancing || !currentEvent}
              className="font-bold shadow-lg shadow-primary/20"
            >
              <Flag className="w-4 h-4 mr-2" />
              {advancing ? 'Simulando GP...' : `Disputar GP #${season.current_round}`}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-border/40 pb-4">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'calendar'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
              : 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40'
          }`}
        >
          <Calendar className="w-4 h-4" /> Calendário ({events.length} GPs)
        </button>
        <button
          onClick={() => setActiveTab('standings')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeTab === 'standings'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
              : 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40'
          }`}
        >
          <Trophy className="w-4 h-4" /> Classificação Mundial
        </button>
      </div>

      {/* Visão de Calendário */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => {
              const circ = circuits.find((c) => c.id === ev.circuit_id)
              const isDone = ev.status === 'COMPLETED'
              const isCurrent = ev.round === season.current_round && !isDone
              const winnerDriver = isDone
                ? drivers.find((d) => d.id === ev.results?.raceWinnerDriverId)
                : null

              return (
                <div
                  key={ev.id}
                  className={`rounded-xl border p-5 backdrop-blur transition-all flex flex-col justify-between space-y-4 ${
                    isCurrent
                      ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10 ring-1 ring-primary/40'
                      : 'border-border/50 bg-card/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                        RODADA {String(ev.round).padStart(2, '0')}
                      </span>
                      {isDone ? (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Oficial
                        </span>
                      ) : isCurrent ? (
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary text-primary-foreground font-bold animate-pulse">
                          Próxima
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Agendada
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-4">
                      <div className="w-16 h-12 rounded-lg bg-black/60 border border-border/40 overflow-hidden flex items-center justify-center p-1 shrink-0">
                        <img
                          src={circ?.svgPath || circ?.imagem || assets.circuit(1)}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                          onError={(e) => {
                            e.currentTarget.src = assets.branding.cover
                          }}
                        />
                      </div>
                      <div>
                        <h3 className="font-bold text-base leading-snug">{ev.track_name}</h3>
                        <p className="text-xs font-mono text-muted-foreground">
                          {circ?.pais} · {circ?.voltas} voltas
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/30 text-xs font-mono">
                    {isDone ? (
                      <div className="text-emerald-400">
                        Vencedor: <strong>{winnerDriver?.nome || 'Piloto Vencedor'}</strong>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        Clima previsto: {ev.weather?.condition} · {ev.weather?.trackTempC}°C pista
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Visão de Classificação (Pontuação FIA Canônica INV-01) */}
      {activeTab === 'standings' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Construtores */}
          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" /> Mundial de Construtores
            </h3>
            <div className="space-y-2">
              {season.constructors_standings?.map((cs, idx) => {
                const isManaged = cs.teamId === career.managed_team_id
                return (
                  <div
                    key={cs.teamId}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs font-mono ${
                      isManaged
                        ? 'border-primary bg-primary/20 font-bold'
                        : 'border-border/30 bg-black/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-muted-foreground font-black">
                        {idx + 1}º
                      </span>
                      <div>
                        <p className="text-sm text-foreground">{cs.teamName}</p>
                        <span className="text-[11px] text-muted-foreground">{cs.teamCode}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-extrabold text-foreground">
                        {cs.points} pts
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {cs.wins} vitórias
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pilotos */}
          <div className="rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur space-y-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" /> Mundial de Pilotos
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {season.drivers_standings?.map((ds, idx) => (
                <div
                  key={ds.driverId}
                  className="p-3 rounded-xl border border-border/30 bg-black/40 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-muted-foreground font-black">
                      {idx + 1}º
                    </span>
                    <div>
                      <p className="text-sm font-bold text-foreground">{ds.driverName}</p>
                      <span className="text-[11px] text-muted-foreground">{ds.teamName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-foreground">
                      {ds.points} pts
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      {ds.wins} vitórias
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
