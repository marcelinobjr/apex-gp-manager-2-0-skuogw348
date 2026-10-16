import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Cpu,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  History,
  PlusCircle,
  RotateCw,
  Activity,
  Layers,
} from 'lucide-react'
import { careerService, CareerRecord, CareerStateRecord } from '@/services/career'
import {
  teamManagementService,
  CarComponentRecord,
  EngineSubstitutionResult,
} from '@/services/teamManagement'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function TeamCarPage() {
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [state, setState] = useState<CareerStateRecord | null>(null)
  const [components, setComponents] = useState<CarComponentRecord[]>([])
  const [activeCarTab, setActiveCarTab] = useState<1 | 2>(1)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [repairingId, setRepairingId] = useState<string | null>(null)
  const [substitutingId, setSubstitutingId] = useState<string | null>(null)
  const [allocatingExtra, setAllocatingExtra] = useState(false)
  const [selectedCompForHistory, setSelectedCompForHistory] = useState<CarComponentRecord | null>(
    null,
  )

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await careerService.listUserCareers()
      if (list.length > 0) {
        const c = list[0]
        setCareer(c)
        const s = await careerService.getCareerState(c.id)
        setState(s)
        const comps = await teamManagementService.getCarComponents(c.id)
        setComponents(comps)
        if (selectedYear === null) {
          setSelectedYear(c.current_year)
        }
      }
    } catch {
      toast.error('Erro ao carregar dados do carro')
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

  // Lista de anos com inventário registrado para seleção histórica
  const recordedYears = Array.from(
    new Set(components.map((c) => c.season_year || career.current_year)),
  ).sort((a, b) => b - a)
  if (recordedYears.length === 0) recordedYears.push(career.current_year)

  const activeYear = selectedYear ?? career.current_year
  const isHistoricYear = activeYear !== career.current_year

  const carComponents = components.filter(
    (c) => c.car_index === activeCarTab && (c.season_year || career.current_year) === activeYear,
  )
  const aeroAndChassis = carComponents.filter((c) => c.component_type !== 'engine')
  const enginesPool = carComponents.filter((c) => c.component_type === 'engine')
  const installedEngine = enginesPool.find((e) => e.is_installed)

  // Motores utilizados na temporada ativa (que já acumularam km ou histórico de pista)
  const usedEnginesCount = enginesPool.filter(
    (e) => (e.mileage_km || 0) > 0 || (e.usage_history && e.usage_history.length > 0),
  ).length
  const availableBenchCount = enginesPool.filter(
    (e) => e.status === 'AVAILABLE_BENCH' || (!e.is_installed && e.status !== 'RETIRED'),
  ).length

  const handleRepair = async (comp: CarComponentRecord) => {
    // Custo de revisão/manutenção proporcional ao desgaste (INV-04)
    const baseCost = comp.component_type === 'engine' ? 400_000 : 150_000
    const wearMultiplier = comp.component_type === 'engine' ? 35_000 : 15_000
    const cost = Math.round((100 - comp.condition_pct) * wearMultiplier + baseCost)

    try {
      setRepairingId(comp.id)
      await teamManagementService.repairComponent(comp.id, career.id, cost)
      toast.success(`${comp.component_name} revisado e restaurado para 100%!`)
      await loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha na manutenção da peça')
    } finally {
      setRepairingId(null)
    }
  }

  const handleSubstituteEngine = async (targetComp: CarComponentRecord) => {
    if (targetComp.is_installed) {
      toast.info('Esta unidade de potência já está instalada no carro atual.')
      return
    }

    try {
      setSubstitutingId(targetComp.id)
      const result: EngineSubstitutionResult = await teamManagementService.substituteEngineUnit({
        careerId: career.id,
        carIndex: activeCarTab,
        targetComponentId: targetComp.id,
        reason: `Substituição estratégica para sessão de pista`,
      })

      if (result.penaltyEvent?.incurred) {
        toast.warning(
          `Atenção FIA: Introdução da PU #${result.penaltyEvent.unitNumber} gerou evento de penalidade regulamentar! (${result.penaltyEvent.sanctionDescription})`,
          { duration: 8000 },
        )
      } else {
        toast.success(
          `PU #${targetComp.engine_unit_number} instalada com sucesso no Carro #${activeCarTab}!`,
        )
      }

      await loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao trocar motor')
    } finally {
      setSubstitutingId(null)
    }
  }

  const handleAllocateExtraEngine = async () => {
    try {
      setAllocatingExtra(true)
      const cost = 1_500_000 // Custo regulamentar de aquisição de PU extra
      const newUnit = await teamManagementService.allocateExtraEngineUnit({
        careerId: career.id,
        carIndex: activeCarTab,
        cost,
      })
      toast.success(
        `Nova PU #${newUnit.engine_unit_number} alocada no banco de reservas! (Custo: $1.5M debitado do teto/caixa)`,
      )
      await loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao alocar motor extra')
    } finally {
      setAllocatingExtra(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <Link
          to="/equipe"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Central da Equipe
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">Carro & Inventário Mecânico</h1>
        <p className="text-sm text-muted-foreground">
          Gestão de componentes aerodinâmicos, chassi, suspensão, freios, câmbio e do pool
          regulamentar de motores físicos por piloto (Doc Mestre 13.3 / 13.4).
        </p>
      </div>

      {/* Seletor Carro 1 / Carro 2 e Seletor de Temporada (Histórico vs Ativo) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveCarTab(1)}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeCarTab === 1
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40'
            }`}
          >
            <Cpu className="w-4 h-4" /> Carro #1 (Cockpit Piloto 1)
          </button>
          <button
            onClick={() => setActiveCarTab(2)}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeCarTab === 2
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                : 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40'
            }`}
          >
            <Cpu className="w-4 h-4" /> Carro #2 (Cockpit Piloto 2)
          </button>
        </div>

        {/* Seletor de Ano da Temporada */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">Temporada:</span>
          <div className="flex items-center gap-1.5 bg-card/60 p-1 rounded-xl border border-border/40">
            {recordedYears.map((yr) => (
              <button
                key={yr}
                onClick={() => setSelectedYear(yr)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  activeYear === yr
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {yr} {yr === career.current_year ? '(Atual)' : '(Histórico)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isHistoricYear && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-mono text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 shrink-0" />
            <span>
              <strong>Visualizando Inventário Histórico Arquivado ({activeYear}):</strong> Todas as
              peças e motores deste ano estão preservados com sua quilometragem e desgastes finais
              originais.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/40 text-amber-300 text-xs h-7"
            onClick={() => setSelectedYear(career.current_year)}
          >
            Voltar para {career.current_year} (Atual)
          </Button>
        </div>
      )}

      {/* Destaque da Unidade de Potência Montada no Carro */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> MOTOR ATIVO NO COCKPIT #{activeCarTab}
              </span>
              {installedEngine?.engine_unit_number && installedEngine.engine_unit_number >= 5 && (
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> PENALIDADE REGULAMENTAR FIA APLICADA
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black tracking-tight">
              {installedEngine ? installedEngine.component_name : 'Nenhum motor montado'}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground pt-1">
              <span>Serial Físico: {installedEngine?.physical_serial || '—'}</span>
              <span>•</span>
              <span>Quilometragem: {installedEngine?.mileage_km || 0} km</span>
              <span>•</span>
              <span>Temporada: {installedEngine?.season_year || 2026}</span>
            </div>
          </div>

          {installedEngine && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-xs font-mono text-muted-foreground block">
                  Integridade Atual
                </span>
                <span
                  className={`text-2xl font-black font-mono ${
                    installedEngine.condition_pct > 70
                      ? 'text-emerald-400'
                      : installedEngine.condition_pct > 40
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }`}
                >
                  {installedEngine.condition_pct}%
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedCompForHistory(installedEngine)}
              >
                <History className="w-4 h-4 mr-1.5" /> Telemetria & Histórico
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Pool Físico de Motores por Piloto (Doc Mestre 13.3) */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Gauge className="w-5 h-5 text-amber-400" /> Pool Físico de Motores — Piloto #
              {activeCarTab}
            </h2>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              4 unidades físicas iniciais por piloto no teto anual regulamentar. Trocas entre
              unidades alocadas preservam integralmente desgaste e quilometragem.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-card/60 px-3 py-1.5 rounded-xl border border-border/40 text-xs font-mono">
              <span>
                Utilizados em Pista:{' '}
                <strong className={usedEnginesCount >= 4 ? 'text-amber-400' : 'text-emerald-400'}>
                  {usedEnginesCount} / 4
                </strong>
              </span>
              <span>•</span>
              <span>
                Disponíveis no Banco:{' '}
                <strong className="text-foreground">{availableBenchCount}</strong>
              </span>
            </div>

            {!isHistoricYear && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                disabled={allocatingExtra}
                onClick={handleAllocateExtraEngine}
              >
                <PlusCircle className="w-4 h-4 mr-1.5" /> Adicionar 5ª PU Extra ($1.5M)
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {enginesPool.map((engComp) => {
            const isInstalled = engComp.is_installed
            const isFifthOrHigher = (engComp.engine_unit_number || 1) >= 5
            const repairCost = Math.round((100 - engComp.condition_pct) * 35_000 + 400_000)

            return (
              <div
                key={engComp.id}
                className={`rounded-xl border p-5 backdrop-blur flex flex-col justify-between space-y-4 transition-all ${
                  isInstalled
                    ? 'border-primary/60 bg-primary/10 shadow-lg shadow-primary/10'
                    : 'border-border/50 bg-card/40 hover:border-border'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                        isFifthOrHigher
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      PU #{engComp.engine_unit_number} {isFifthOrHigher && '(Extra)'}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        engComp.condition_pct > 70
                          ? 'text-emerald-400'
                          : engComp.condition_pct > 40
                            ? 'text-amber-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {engComp.condition_pct}%
                    </span>
                  </div>

                  <h4 className="font-bold text-sm mt-3">{engComp.component_name}</h4>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1 space-y-0.5">
                    <p className="truncate">Serial: {engComp.physical_serial || '—'}</p>
                    <p>Rodagem: {engComp.mileage_km || 0} km</p>
                    <p>
                      Estado:{' '}
                      <span className={isInstalled ? 'text-emerald-400 font-bold' : ''}>
                        {isInstalled ? 'Instalado no Carro' : 'Banco de Reserva'}
                      </span>
                    </p>
                  </div>

                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden mt-3">
                    <div
                      className={`h-full transition-all ${
                        engComp.condition_pct > 70
                          ? 'bg-emerald-500'
                          : engComp.condition_pct > 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                      }`}
                      style={{ width: `${engComp.condition_pct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-border/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                    <span>Revisão: ${(repairCost / 1_000_000).toFixed(2)}M</span>
                    <button
                      onClick={() => setSelectedCompForHistory(engComp)}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <History className="w-3 h-3" /> Ver logs
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      disabled={engComp.condition_pct >= 99 || repairingId === engComp.id}
                      onClick={() => handleRepair(engComp)}
                    >
                      {repairingId === engComp.id ? 'Revisando...' : 'Revisar PU'}
                    </Button>

                    {!isInstalled ? (
                      <Button
                        size="sm"
                        variant="default"
                        className="flex-1 text-xs"
                        disabled={substitutingId === engComp.id}
                        onClick={() => handleSubstituteEngine(engComp)}
                      >
                        <RotateCw className="w-3.5 h-3.5 mr-1" />
                        {substitutingId === engComp.id ? 'Trocando...' : 'Instalar'}
                      </Button>
                    ) : (
                      <span className="text-[11px] font-mono text-emerald-400 font-bold px-2 py-1 text-center flex-1">
                        Ativo
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Componentes Aerodinâmicos e Estruturais (Inventário Completo) */}
      <div className="space-y-4 pt-6 border-t border-border/40">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" /> Componentes do Chassi & Transmissão (Carro #
            {activeCarTab})
          </h2>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">
            Asas, assoalho, laterais, suspensão, freios de carbono e câmbio de 8 velocidades com
            desgaste físico persistente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aeroAndChassis.map((comp) => {
            const repairCost = Math.round((100 - comp.condition_pct) * 15_000 + 150_000)
            const isWorn = comp.condition_pct < 60
            return (
              <div
                key={comp.id}
                className="rounded-xl border border-border/50 bg-card/40 p-5 backdrop-blur flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                      Nível {comp.level}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        comp.condition_pct > 70
                          ? 'text-emerald-400'
                          : comp.condition_pct > 40
                            ? 'text-amber-400'
                            : 'text-rose-400'
                      }`}
                    >
                      {comp.condition_pct}% Integridade
                    </span>
                  </div>
                  <h3 className="font-bold text-base mt-2">{comp.component_name}</h3>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1">
                    Serial: {comp.physical_serial || '—'}
                  </div>

                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden mt-3">
                    <div
                      className={`h-full transition-all ${
                        comp.condition_pct > 70
                          ? 'bg-emerald-500'
                          : comp.condition_pct > 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                      }`}
                      style={{ width: `${comp.condition_pct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">
                    Custo: ${(repairCost / 1_000).toFixed(0)}k
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => setSelectedCompForHistory(comp)}
                    >
                      <History className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant={isWorn ? 'default' : 'outline'}
                      disabled={comp.condition_pct >= 99 || repairingId === comp.id}
                      onClick={() => handleRepair(comp)}
                    >
                      {repairingId === comp.id ? 'Revisando...' : 'Revisar / Reparar'}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal de Histórico de Instalação e Utilizações do Componente */}
      <Dialog
        open={!!selectedCompForHistory}
        onOpenChange={(open) => !open && setSelectedCompForHistory(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" /> Rastreabilidade & Histórico Físico
            </DialogTitle>
            <DialogDescription>
              {selectedCompForHistory?.component_name} — Serial:{' '}
              {selectedCompForHistory?.physical_serial || '—'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                <RotateCw className="w-4 h-4 text-amber-400" /> Movimentações e Instalações no
                Chassi
              </h4>
              {selectedCompForHistory?.installation_history &&
              selectedCompForHistory.installation_history.length > 0 ? (
                <div className="space-y-2 border rounded-xl p-3 bg-card/30">
                  {selectedCompForHistory.installation_history.map((evt, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono border-b border-border/30 last:border-b-0 pb-1.5 pt-1.5 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-foreground">{evt.action}</span> — Carro #
                        {evt.car_index}
                        {evt.reason && (
                          <span className="text-muted-foreground block text-[11px]">
                            {evt.reason}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(evt.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-muted-foreground">
                  Nenhuma movimentação registrada.
                </p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-bold flex items-center gap-1.5 mb-2">
                <Gauge className="w-4 h-4 text-emerald-400" /> Histórico de Sessões de Pista e
                Desgaste
              </h4>
              {selectedCompForHistory?.usage_history &&
              selectedCompForHistory.usage_history.length > 0 ? (
                <div className="space-y-2 border rounded-xl p-3 bg-card/30">
                  {selectedCompForHistory.usage_history.map((evt, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono border-b border-border/30 last:border-b-0 pb-1.5 pt-1.5 space-y-1"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-primary">
                          {evt.sessionType} {evt.round ? `• Etapa #${evt.round}` : ''}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(evt.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          Distância: {evt.distanceKm} km (Desgaste: -{evt.wearDeltaPct}%)
                        </span>
                        <span>
                          Integridade: {evt.conditionBeforePct}% → {evt.conditionAfterPct}%
                        </span>
                      </div>
                      {evt.mechanicalFault && (
                        <div className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {evt.mechanicalFault}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-mono text-muted-foreground">
                  Nenhuma sessão de pista registrada para este componente até o momento.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCompForHistory(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
