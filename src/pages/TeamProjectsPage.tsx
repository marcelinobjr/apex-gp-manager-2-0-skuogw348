import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { careerService, type CareerRecord } from '@/services/career'
import { rdService, type RdProjectRecord, type RdStateResponse } from '@/services/rdService'
import {
  RD_ATTRIBUTE_LABELS,
  RD_CATEGORY_LABELS,
  RD_CATEGORY_TARGETS,
  RD_FACILITY_COST,
  RD_OUTCOME_LABELS,
  RD_RISK_STRATEGIES,
  RD_STATE_LABELS,
  type RdCategory,
  type RdRiskStrategy,
  type RdStateCanonical,
} from '@/data/rdConfig'
interface TeamProjectsPageProps {
  career: CareerRecord | null
}

const CATEGORY_ORDER: RdCategory[] = [
  'aero',
  'chassis',
  'braking',
  'tyre',
  'thermal',
  'reliability',
]

function StateBadge({ state }: { state: RdStateCanonical }) {
  const colorMap: Record<RdStateCanonical, string> = {
    PROPOSED: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    RESERVED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    RESEARCHING: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    DESIGNED: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    MANUFACTURING: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    READY: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    INSTALLED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    FAILED: 'bg-red-500/15 text-red-300 border-red-500/30',
    CANCELLED: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  }
  return (
    <Badge variant="outline" className={colorMap[state] ?? ''}>
      {RD_STATE_LABELS[state] ?? state}
    </Badge>
  )
}

export function TeamProjectsPage({ career }: TeamProjectsPageProps) {
  const [data, setData] = useState<RdStateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [form, setForm] = useState<{
    name: string
    category: RdCategory
    costM: number
    rounds: number
    strategy: RdRiskStrategy
  }>({
    name: '',
    category: 'aero',
    costM: 8,
    rounds: 3,
    strategy: 'EQUILIBRADA',
  })
  const [installTarget, setInstallTarget] = useState<RdProjectRecord | null>(null)

  const refresh = useCallback(async () => {
    if (!career) return
    setLoading(true)
    try {
      const state = await rdService.getState(career.id)
      setData(state)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar o pipeline de P&D.')
    } finally {
      setLoading(false)
    }
  }, [career])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const projects = useMemo(() => data?.projects ?? [], [data])

  const activeProjects = projects.filter(
    (p) =>
      p.status_canonical !== 'INSTALLED' &&
      p.status_canonical !== 'FAILED' &&
      p.status_canonical !== 'CANCELLED',
  )

  const handlePropose = async () => {
    if (!career) return
    try {
      await rdService.propose(career.id, {
        name: form.name,
        category: form.category,
        cost: Math.round(form.costM * 1_000_000),
        duration_rounds: form.rounds,
        risk_strategy: form.strategy,
      })
      toast.success('Projeto proposto e orçamento reservado (INV-04/INV-05).')
      setProposeOpen(false)
      setForm({ name: '', category: 'aero', costM: 8, rounds: 3, strategy: 'EQUILIBRADA' })
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao propor o projeto.')
    }
  }

  const withBusy = async (projectId: string, action: () => Promise<void>) => {
    setBusyProjectId(projectId)
    try {
      await action()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na operação do projeto.')
    } finally {
      setBusyProjectId(null)
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Carregando pipeline de P&D…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Pesquisa &amp; Desenvolvimento</h2>
          <p className="text-sm text-muted-foreground">
            Ciclo completo: PROPOSED → RESERVED → RESEARCHING → DESIGNED → MANUFACTURING → READY →
            INSTALLED. Concluir a pesquisa <strong>não</strong> melhora o carro automaticamente: o
            ganho só vale após fabricação e instalação.
          </p>
        </div>
        <Button onClick={() => setProposeOpen(true)}>Novo projeto</Button>
      </div>

      {data && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Reservado (caixa / teto)</CardDescription>
              <CardTitle className="text-lg tabular-nums">
                ${((data.reserved_cash ?? 0) / 1e6).toFixed(2)}M / $
                {((data.reserved_cost_cap ?? 0) / 1e6).toFixed(2)}M
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Projetos ativos</CardDescription>
              <CardTitle className="text-lg">{activeProjects.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Notas efetivas da temporada</CardDescription>
              <CardTitle className="text-xs font-normal text-muted-foreground">
                {Object.entries(data.effective_attributes ?? {})
                  .slice(0, 4)
                  .map(
                    ([k, v]) =>
                      `${RD_ATTRIBUTE_LABELS[k as keyof typeof RD_ATTRIBUTE_LABELS] ?? k}: ${v}`,
                  )
                  .join(' · ')}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Separator />

      <Tabs defaultValue="ativos" className="w-full">
        <TabsList>
          <TabsTrigger value="ativos">Ativos ({activeProjects.length})</TabsTrigger>
          <TabsTrigger value="historico">
            Histórico ({projects.length - activeProjects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos" className="mt-4 space-y-3">
          {activeProjects.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum projeto ativo. Proponha um projeto de P&amp;D.
            </p>
          )}
          {activeProjects.map((project) => {
            const targets = JSON.parse(project.target_attributes || '[]') as string[]
            const detail = project.result_detail ?? {}
            const allocations = project.facility_allocations ?? {}
            return (
              <Card key={project.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <StateBadge state={project.status_canonical} />
                  </div>
                  <CardDescription>
                    {RD_CATEGORY_LABELS[project.category]} · alvos:{' '}
                    {targets
                      .map((t) => RD_ATTRIBUTE_LABELS[t as keyof typeof RD_ATTRIBUTE_LABELS] ?? t)
                      .join(', ')}{' '}
                    · {project.risk_strategy} · ${((project.cost ?? 0) / 1e6).toFixed(2)}M ·{' '}
                    {project.rounds_remaining}/{project.duration_rounds} rodadas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {project.status_canonical === 'RESEARCHING' && (
                    <Progress
                      value={Math.round(
                        ((project.duration_rounds - project.rounds_remaining) /
                          Math.max(1, project.duration_rounds)) *
                          100,
                      )}
                    />
                  )}
                  {detail.outcome && (
                    <p className="text-xs text-muted-foreground">
                      Resultado sorteado uma única vez:{' '}
                      <strong
                        className={
                          detail.outcome === 'FAILED' ? 'text-red-400' : 'text-emerald-400'
                        }
                      >
                        {RD_OUTCOME_LABELS[detail.outcome] ?? detail.outcome}
                      </strong>
                      {detail.gainPct
                        ? ` (+${detail.gainPct}% nos atributos-alvo, pendente de fabricação/instalação)`
                        : ''}
                      {detail.spentCash
                        ? ` · perda registrada: $${((detail.spentCash ?? 0) / 1e6).toFixed(2)}M`
                        : ''}
                    </p>
                  )}
                  {project.component_serial && (
                    <p className="text-xs text-muted-foreground">
                      Peça: {project.component_name} · serial{' '}
                      <code className="text-[10px]">{project.component_serial}</code>
                    </p>
                  )}
                  {Object.keys(allocations).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Capacidade consumida:{' '}
                      {Object.entries(allocations)
                        .filter(([, v]) => v > 0)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(' · ')}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {project.status_canonical === 'RESERVED' && (
                      <Button
                        size="sm"
                        disabled={busyProjectId === project.id}
                        onClick={() =>
                          withBusy(project.id, async () => {
                            await rdService.start(career!.id, project.id)
                            toast.success('Pesquisa iniciada.')
                            await refresh()
                          })
                        }
                      >
                        Iniciar pesquisa
                      </Button>
                    )}
                    {project.status_canonical === 'RESEARCHING' && (
                      <Button
                        size="sm"
                        disabled={busyProjectId === project.id}
                        onClick={() =>
                          withBusy(project.id, async () => {
                            const res = await rdService.completeResearch(career!.id, project.id)
                            toast.success(
                              `Sorte técnico realizado: ${RD_OUTCOME_LABELS[res.outcome] ?? res.outcome} (+${res.gain_pct}%).`,
                            )
                            await refresh()
                          })
                        }
                      >
                        Concluir pesquisa (sorte único)
                      </Button>
                    )}
                    {project.status_canonical === 'DESIGNED' && (
                      <Button
                        size="sm"
                        disabled={busyProjectId === project.id}
                        onClick={() =>
                          withBusy(project.id, async () => {
                            await rdService.startManufacturing(career!.id, project.id)
                            toast.success(
                              'Fabricação iniciada (consome Fábrica e Estrutura Industrial).',
                            )
                            await refresh()
                          })
                        }
                      >
                        Iniciar fabricação
                      </Button>
                    )}
                    {project.status_canonical === 'MANUFACTURING' && (
                      <Button
                        size="sm"
                        disabled={busyProjectId === project.id}
                        onClick={() =>
                          withBusy(project.id, async () => {
                            const res = await rdService.completeManufacturing(
                              career!.id,
                              project.id,
                            )
                            toast.success(`Componente pronto: ${res.serial}`)
                            await refresh()
                          })
                        }
                      >
                        Concluir fabricação
                      </Button>
                    )}
                    {project.status_canonical === 'READY' && (
                      <Button size="sm" onClick={() => setInstallTarget(project)}>
                        Instalar em carro
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyProjectId === project.id}
                      onClick={() =>
                        withBusy(project.id, async () => {
                          const res = await rdService.cancel(
                            career!.id,
                            project.id,
                            'Cancelado pelo gestor na tela de projetos',
                          )
                          toast.success(
                            res.spent_cash > 0
                              ? `Projeto cancelado. Despesa incorrida de $${(res.spent_cash / 1e6).toFixed(2)}M mantida no ledger.`
                              : 'Projeto cancelado. Reserva liberada integralmente.',
                          )
                          await refresh()
                        })
                      }
                    >
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-3">
          {projects.filter((p) => !activeProjects.includes(p)).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum projeto encerrado ainda.</p>
          )}
          {projects
            .filter((p) => !activeProjects.includes(p))
            .map((project) => (
              <Card key={project.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <StateBadge state={project.status_canonical} />
                  </div>
                  <CardDescription>
                    {RD_CATEGORY_LABELS[project.category]} · $
                    {((project.cost ?? 0) / 1e6).toFixed(2)}M ·
                    {project.spent_cash
                      ? ` despesa incorrida $${(project.spent_cash / 1e6).toFixed(2)}M`
                      : ''}
                    {project.released_cash
                      ? ` · estorno $${(project.released_cash / 1e6).toFixed(2)}M`
                      : ''}
                    {project.cancelled_reason ? ` · ${project.cancelled_reason}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">
                      Histórico de estados ({project.state_history?.length ?? 0})
                    </summary>
                    <ol className="mt-2 space-y-1">
                      {(project.state_history ?? []).map((h, i) => (
                        <li key={i}>
                          <span className="font-mono">{h.state}</span> — {h.note}{' '}
                          <span className="opacity-60">
                            ({new Date(h.at).toLocaleString('pt-BR')})
                          </span>
                        </li>
                      ))}
                    </ol>
                  </details>
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      {/* Diálogo: propor projeto */}
      <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo projeto de P&amp;D</DialogTitle>
            <DialogDescription>
              O orçamento será reservado (caixa e teto) e a capacidade das instalações consumida por
              rodada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="rd-name">Nome do projeto</Label>
              <Input
                id="rd-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex.: Asa dianteira de carga média"
              />
            </div>
            <div className="space-y-1">
              <Label>Área de engenharia</Label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORY_ORDER.map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    size="sm"
                    variant={form.category === cat ? 'default' : 'outline'}
                    onClick={() => setForm({ ...form, category: cat })}
                  >
                    {RD_CATEGORY_LABELS[cat]}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Afeta somente:{' '}
                {RD_CATEGORY_TARGETS[form.category].map((t) => RD_ATTRIBUTE_LABELS[t]).join(', ')} ·
                capacidade:{' '}
                {Object.entries(RD_FACILITY_COST[form.category])
                  .map(([k, v]) => `${k} (${v})`)
                  .join(', ')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rd-cost">Custo (US$ milhões)</Label>
                <Input
                  id="rd-cost"
                  type="number"
                  min={1}
                  max={40}
                  value={form.costM}
                  onChange={(e) => setForm({ ...form, costM: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rd-rounds">Duração (rodadas)</Label>
                <Input
                  id="rd-rounds"
                  type="number"
                  min={1}
                  max={24}
                  value={form.rounds}
                  onChange={(e) => setForm({ ...form, rounds: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Estratégia de risco</Label>
              <div className="grid grid-cols-3 gap-2">
                {RD_RISK_STRATEGIES.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={form.strategy === s.id ? 'default' : 'outline'}
                    onClick={() => setForm({ ...form, strategy: s.id })}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {RD_RISK_STRATEGIES.find((s) => s.id === form.strategy)?.description} Distribuições
                provisórias do ruleset (70/25/5), não homologadas.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProposeOpen(false)}>
              Voltar
            </Button>
            <Button
              disabled={form.name.trim().length < 2 || form.costM <= 0}
              onClick={() => void handlePropose()}
            >
              Reservar e criar projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: instalar componente */}
      <Dialog open={!!installTarget} onOpenChange={(open) => !open && setInstallTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Instalar componente</DialogTitle>
            <DialogDescription>
              {installTarget?.component_name} — o ganho técnico é aplicado{' '}
              <strong>uma única vez</strong>. A peça anterior será arquivada com o histórico
              preservado.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void withBusy(installTarget!.id, async () => {
                  await rdService.install(career!.id, installTarget!.id, 1)
                  toast.success('Componente instalado no Carro 1; ganho técnico aplicado.')
                  setInstallTarget(null)
                  await refresh()
                })
              }
            >
              Carro 1
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void withBusy(installTarget!.id, async () => {
                  await rdService.install(career!.id, installTarget!.id, 2)
                  toast.success('Componente instalado no Carro 2; ganho técnico aplicado.')
                  setInstallTarget(null)
                  await refresh()
                })
              }
            >
              Carro 2
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
