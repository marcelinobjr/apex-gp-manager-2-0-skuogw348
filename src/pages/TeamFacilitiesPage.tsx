import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Hammer, Loader2, ShieldAlert, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { careerService, type CareerRecord } from '@/services/career'
import { facilitiesService, type FacilityInfo } from '@/services/rdService'
import { toast } from 'sonner'

const CONSUMER_LABELS: Record<string, string> = {
  rd_pipeline: 'P&D (pipeline ativo)',
  race_engine: 'Race Engine',
  driver_academy_module: 'Módulo da Academia (futuro)',
}

export function TeamFacilitiesPage() {
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [facilities, setFacilities] = useState<FacilityInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [busyCode, setBusyCode] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const list = await careerService.listUserCareers()
      if (list.length === 0) {
        toast.error('Nenhuma carreira ativa encontrada')
        return
      }
      const current = list[0]
      setCareer(current)
      const res = await facilitiesService.getState(current.id)
      setFacilities(res.facilities)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar instalações')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleUpgrade = async (facility: FacilityInfo) => {
    if (!career) return
    setBusyCode(facility.code)
    try {
      await facilitiesService.upgrade(career.id, facility.code)
      toast.success(
        `Obra iniciada: ${facility.name} → nível ${facility.level + 1} (${facility.nextUpgradeRounds} rodadas). Caixa e teto reservados.`,
      )
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao iniciar a obra')
    } finally {
      setBusyCode(null)
    }
  }

  const handleCancelConstruction = async (facility: FacilityInfo) => {
    if (!career || !facility.inProgress) return
    setBusyCode(facility.code)
    try {
      await facilitiesService.cancel(career.id, facility.inProgress.id)
      toast.success('Obra cancelada e reserva liberada.')
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao cancelar a obra')
    } finally {
      setBusyCode(null)
    }
  }

  const handleAdvanceRound = async () => {
    if (!career) return
    setBusyCode('__all__')
    try {
      const res = await facilitiesService.advanceRound(career.id)
      if (res.completed.length > 0) {
        toast.success(
          `Obras concluídas: ${res.completed.map((c) => `${c.facilityCode} → nível ${c.level}`).join(', ')}.`,
        )
      } else {
        toast.info('Nenhuma obra concluída nesta virada; progresso avançado.')
      }
      await loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao avançar as obras')
    } finally {
      setBusyCode(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const constructions = facilities.filter((f) => f.inProgress)

  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <Link
          to="/equipe"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Central da Equipe
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">Instalações da Equipe</h1>
        <p className="text-sm text-muted-foreground">
          Nove instalações, níveis 1 a 5, custos progressivos e prazos de obra. Cada efeito aponta
          para o serviço que o consome — efeitos sem consumidor funcional estão marcados como
          PENDENTE DE INTEGRAÇÃO.
        </p>
      </div>

      {constructions.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <Hammer className="w-4 h-4" />
            <span>Obras em andamento ({constructions.length})</span>
          </div>
          {constructions.map((f) => (
            <div
              key={f.code}
              className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
            >
              <span>
                {f.name} → nível {f.inProgress.toLevel} · {f.inProgress.roundsRemaining} rodada(s)
                restante(s)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyCode === '__all__'}
                  onClick={() => void handleAdvanceRound()}
                >
                  <Wrench className="w-3.5 h-3.5 mr-1" /> Avançar rodada
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyCode === f.code}
                  onClick={() => void handleCancelConstruction(f)}
                >
                  Cancelar obra
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {facilities.map((f) => (
          <Card key={f.code} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{f.name}</CardTitle>
                  <CardDescription className="text-xs font-mono">
                    Nível {f.level}/5 · manutenção ${(f.maintenanceAnnual / 1e6).toFixed(1)}M/ano
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    variant="outline"
                    className={f.level >= 5 ? 'border-amber-500/40 text-amber-300' : ''}
                  >
                    {f.level >= 5
                      ? 'NÍVEL MÁXIMO'
                      : `Próx.: $${(f.nextUpgradeCost / 1e6).toFixed(1)}M · ${f.nextUpgradeRounds} rodadas`}
                  </Badge>
                  {f.pendingIntegration ? (
                    <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                      <ShieldAlert className="w-3 h-3 mr-1" /> PENDENTE DE INTEGRAÇÃO
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
                      EFEITO ATIVO
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col">
              <Progress value={(f.level / 5) * 100} />
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>
                  <span className="text-foreground font-semibold">Consumidor:</span>{' '}
                  {CONSUMER_LABELS[f.consumer] ?? f.consumer}
                </p>
                <p>{f.consumerLabel}</p>
                <p className="opacity-80">{f.effect}</p>
              </div>
              <div className="mt-auto pt-2">
                {f.inProgress ? (
                  <Button size="sm" variant="outline" className="w-full" disabled>
                    Obra em andamento (nível {f.inProgress.toLevel})
                  </Button>
                ) : f.atMax ? (
                  <Button size="sm" variant="outline" className="w-full" disabled>
                    Nível 5 — sem upgrades adicionais
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={busyCode === f.code}
                    onClick={() => void handleUpgrade(f)}
                  >
                    Investir no nível {f.level + 1}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
