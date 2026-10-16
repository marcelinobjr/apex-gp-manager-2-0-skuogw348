import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Lightbulb,
  Rocket,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { careerService, CareerRecord, CareerStateRecord } from '@/services/career'
import { teamManagementService, RDProjectRecord } from '@/services/teamManagement'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function TeamProjectsPage() {
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [state, setState] = useState<CareerStateRecord | null>(null)
  const [projects, setProjects] = useState<RDProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Formulário de novo projeto
  const [projectName, setProjectName] = useState('Novo Pacote Aerodinâmico')
  const [category, setCategory] = useState<'aero' | 'chassis' | 'powertrain' | 'reliability'>(
    'aero',
  )
  const [costMillions, setCostMillions] = useState(6.5)
  const [durationRounds, setDurationRounds] = useState(3)

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await careerService.listUserCareers()
      if (list.length > 0) {
        setCareer(list[0])
        const s = await careerService.getCareerState(list[0].id)
        setState(s)
        const projs = await teamManagementService.getRDProjects(list[0].id)
        setProjects(projs)
      }
    } catch {
      toast.error('Erro ao carregar projetos de P&D')
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

  const handleCreateProject = async () => {
    try {
      setCreating(true)
      const costBytes = Math.round(costMillions * 1_000_000)
      const proj = await teamManagementService.startRDProject(career.id, {
        name: projectName,
        category,
        cost: costBytes,
        durationRounds,
      })
      toast.success(`Projeto "${proj.name}" iniciado no departamento de P&D!`)
      setDialogOpen(false)
      await loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao iniciar projeto')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/equipe"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Central da Equipe
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Pesquisa & Desenvolvimento (P&D)
          </h1>
          <p className="text-sm text-muted-foreground">
            Evolução técnica do carro com sorte técnica calibrada em 70/25/5% (bom/normal/ruim)
            conforme Documento Mestre.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="font-bold">
          <Rocket className="w-4 h-4 mr-2" /> Iniciar Novo Projeto
        </Button>
      </div>

      {/* Caixa Informativa de Sorte Técnica (Documento Mestre) */}
      <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-xs font-mono text-muted-foreground flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-primary shrink-0" />
        <span>
          <strong>Regulamento Técnico INV-06:</strong> Cada projeto consome orçamento do Teto
          Regulamentar Anual ($
          {((state?.cost_cap_budget || 135_000_000) / 1_000_000).toFixed(0)}M) e possui distribuição
          canônica: 70% resultado Normal (+8%), 25% Excelente (+15%), 5% Ruim (+2%).
        </span>
      </div>

      {/* Lista de Projetos */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" /> Projetos da Temporada
        </h2>

        {projects.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-border/60 bg-card/20 space-y-3">
            <Lightbulb className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum projeto de P&D em desenvolvimento.
            </p>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              Criar Primeiro Projeto
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const isFinished = proj.status === 'COMPLETED'
              return (
                <div
                  key={proj.id}
                  className="rounded-xl border border-border/50 bg-card/40 p-5 backdrop-blur flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-semibold">
                        {proj.category}
                      </span>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          isFinished
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-primary/20 text-primary'
                        }`}
                      >
                        {isFinished ? 'Concluído' : `${proj.rounds_remaining} GP(s) restante(s)`}
                      </span>
                    </div>
                    <h3 className="font-bold text-base mt-2">{proj.name}</h3>
                    <p className="text-xs font-mono text-muted-foreground mt-1">
                      Custo: ${(proj.cost / 1_000_000).toFixed(1)}M · Duração:{' '}
                      {proj.duration_rounds} rodadas
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">
                      Qualidade:{' '}
                      <strong className="text-foreground">
                        {proj.outcome_quality === 'EXCELLENT'
                          ? 'Excelente (+15%)'
                          : proj.outcome_quality === 'POOR'
                            ? 'Ruim (+2%)'
                            : 'Normal (+8%)'}
                      </strong>
                    </span>
                    {isFinished ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Clock className="w-5 h-5 text-primary animate-pulse" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Criação de Projeto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md technical-panel">
          <DialogHeader>
            <DialogTitle>Iniciar Projeto de P&D</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="proj-name">Nome do Projeto</Label>
              <Input
                id="proj-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proj-cat">Área de Engenharia</Label>
              <select
                id="proj-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm"
              >
                <option value="aero">Aerodinâmica (Downforce / Eficiência)</option>
                <option value="chassis">Chassi & Suspensão (Grip Mecânico)</option>
                <option value="powertrain">Powertrain (Potência / Resfriamento)</option>
                <option value="reliability">Confiabilidade de Componentes</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="proj-cost">Custo (Milhões $)</Label>
                <Input
                  id="proj-cost"
                  type="number"
                  step="0.5"
                  min="1"
                  max="30"
                  value={costMillions}
                  onChange={(e) => setCostMillions(parseFloat(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proj-dur">Duração (Etapas)</Label>
                <Input
                  id="proj-dur"
                  type="number"
                  min="1"
                  max="10"
                  value={durationRounds}
                  onChange={(e) => setDurationRounds(parseInt(e.target.value, 10) || 1)}
                />
              </div>
            </div>

            <p className="text-[11px] font-mono text-muted-foreground">
              O custo de ${costMillions}M será debitado do caixa e contabilizado no teto anual
              regulamentar (INV-04).
            </p>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={creating} onClick={handleCreateProject}>
              {creating ? 'Iniciando...' : 'Aprovar Orçamento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
