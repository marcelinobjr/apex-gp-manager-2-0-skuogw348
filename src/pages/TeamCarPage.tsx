import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wrench, ShieldAlert, ArrowLeft, RefreshCw, Cpu, Gauge, Zap } from 'lucide-react'
import { careerService, CareerRecord, CareerStateRecord } from '@/services/career'
import { teamManagementService, CarComponentRecord } from '@/services/teamManagement'
import { assets } from '@/lib/assets'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function TeamCarPage() {
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [state, setState] = useState<CareerStateRecord | null>(null)
  const [components, setComponents] = useState<CarComponentRecord[]>([])
  const [activeCarTab, setActiveCarTab] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(true)
  const [repairingId, setRepairingId] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await careerService.listUserCareers()
      if (list.length > 0) {
        setCareer(list[0])
        const s = await careerService.getCareerState(list[0].id)
        setState(s)
        const comps = await teamManagementService.getCarComponents(list[0].id)
        setComponents(comps)
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

  const carComponents = components.filter((c) => c.car_index === activeCarTab)
  const aeroAndChassis = carComponents.filter((c) => c.component_type !== 'engine')
  const enginesPool = carComponents.filter((c) => c.component_type === 'engine')

  const handleRepair = async (comp: CarComponentRecord) => {
    // Custo de revisão/manutenção proporcional ao desgaste (INV-04)
    const cost = Math.round((100 - comp.condition_pct) * 15_000 + 150_000)

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
          Gestão de componentes aerodinâmicos, chassi, suspensão e alocação dos 4 motores físicos
          por piloto (Módulo 4.3).
        </p>
      </div>

      {/* Seletor Carro 1 / Carro 2 */}
      <div className="flex items-center gap-3 border-b border-border/40 pb-4">
        <button
          onClick={() => setActiveCarTab(1)}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeCarTab === 1
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
              : 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40'
          }`}
        >
          <Cpu className="w-4 h-4" /> Carro #1 (Cockpit 1)
        </button>
        <button
          onClick={() => setActiveCarTab(2)}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
            activeCarTab === 2
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
              : 'bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground border border-border/40'
          }`}
        >
          <Cpu className="w-4 h-4" /> Carro #2 (Cockpit 2)
        </button>
      </div>

      {/* Componentes Aerodinâmicos e Estruturais */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary" /> Componentes Aerodinâmicos e Chassi
        </h2>
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
            )
          })}
        </div>
      </div>

      {/* Pool de 4 Motores Físicos Alocados por Piloto (Documento Mestre) */}
      <div className="space-y-4 pt-4 border-t border-border/40">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Gauge className="w-5 h-5 text-amber-400" /> Pool Regulamentar de Motores (4 Unidades
            Físicas)
          </h2>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Conforme Documento Mestre v2.2: cada piloto dispõe de 4 unidades de potência físicas no
            teto anual regulamentar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {enginesPool.map((engComp) => {
            const repairCost = Math.round((100 - engComp.condition_pct) * 35_000 + 400_000)
            return (
              <div
                key={engComp.id}
                className="rounded-xl border border-border/50 bg-card/40 p-5 backdrop-blur flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      PU #{engComp.engine_unit_number}
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

                <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">
                    ${(repairCost / 1_000_000).toFixed(2)}M
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={engComp.condition_pct >= 99 || repairingId === engComp.id}
                    onClick={() => handleRepair(engComp)}
                  >
                    Revisar PU
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
