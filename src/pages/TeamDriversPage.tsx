import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  FileSignature,
  ShieldAlert,
  Award,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { careerService, CareerRecord, CareerStateRecord } from '@/services/career'
import { teamManagementService } from '@/services/teamManagement'
import { drivers } from '@/data/game'
import { assets } from '@/lib/assets'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export function TeamDriversPage() {
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [state, setState] = useState<CareerStateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<'driver1' | 'driver2'>('driver1')
  const [targetDriverId, setTargetDriverId] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await careerService.listUserCareers()
      if (list.length > 0) {
        setCareer(list[0])
        const s = await careerService.getCareerState(list[0].id)
        setState(s)
      }
    } catch {
      toast.error('Erro ao carregar pilotos')
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

  const d1 = drivers.find((d) => d.id === state.contracts_ledger?.driver1?.driverId)
  const d2 = drivers.find((d) => d.id === state.contracts_ledger?.driver2?.driverId)

  const c1 = state.contracts_ledger?.driver1
  const c2 = state.contracts_ledger?.driver2

  const handleSignContract = async () => {
    if (!targetDriverId) return
    const candidate = drivers.find((d) => d.id === targetDriverId)
    if (!candidate) return

    // Cálculo canônico de salário baseado no overall (INV-04)
    const annualSalary = Math.round(candidate.overall * 160_000)

    try {
      setActionLoading(true)
      const updatedState = await teamManagementService.updateDriverContract(
        career.id,
        selectedSlot,
        targetDriverId,
        annualSalary,
        2, // Contrato padrão de 2 anos
      )
      setState(updatedState)
      toast.success(`Contrato firmado com ${candidate.nome} com sucesso!`)
      setDialogOpen(false)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha na assinatura do contrato')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/equipe"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Central da Equipe
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight">Pilotos & Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Gerenciamento de cockpits, renovações, rescisões e folha salarial (Módulo 4.2).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cockpit 1 */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border/40">
            <span className="text-xs font-mono uppercase px-2.5 py-1 rounded bg-primary/20 text-primary font-bold">
              Cockpit #1 · Carro 1
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              Vigência: {c1?.durationYears || 1} ano(s)
            </span>
          </div>

          <div className="flex items-center gap-5">
            <img
              src={d1?.imagem || assets.driver(1)}
              alt=""
              className="w-20 h-20 rounded-xl object-cover border border-border/50 bg-black/40"
              onError={(e) => {
                e.currentTarget.src = assets.branding.cover
              }}
            />
            <div className="space-y-1">
              <span className="text-xs font-mono text-primary">{d1?.pais}</span>
              <h2 className="text-xl font-bold">{d1?.nome || 'Piloto Titular'}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  Overall {d1?.overall}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  Ritmo: {d1?.ritmo} · Consistência: {d1?.consistencia}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-black/40 border border-border/30">
              <span className="text-[11px] font-mono uppercase text-muted-foreground block">
                Salário Anual
              </span>
              <span className="text-lg font-bold text-foreground">
                ${((c1?.salaryAnnual || 10_000_000) / 1_000_000).toFixed(1)}M
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-border/30">
              <span className="text-[11px] font-mono uppercase text-muted-foreground block">
                Cláusula de Rescisão
              </span>
              <span className="text-lg font-bold text-amber-400">
                ${(((c1?.salaryAnnual || 10_000_000) * 0.5) / 1_000_000).toFixed(1)}M
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSelectedSlot('driver1')
              setDialogOpen(true)
            }}
          >
            <FileSignature className="w-4 h-4 mr-2" /> Contratar / Substituir Piloto 1
          </Button>
        </div>

        {/* Cockpit 2 */}
        <div className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border/40">
            <span className="text-xs font-mono uppercase px-2.5 py-1 rounded bg-primary/20 text-primary font-bold">
              Cockpit #2 · Carro 2
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              Vigência: {c2?.durationYears || 1} ano(s)
            </span>
          </div>

          <div className="flex items-center gap-5">
            <img
              src={d2?.imagem || assets.driver(2)}
              alt=""
              className="w-20 h-20 rounded-xl object-cover border border-border/50 bg-black/40"
              onError={(e) => {
                e.currentTarget.src = assets.branding.cover
              }}
            />
            <div className="space-y-1">
              <span className="text-xs font-mono text-primary">{d2?.pais}</span>
              <h2 className="text-xl font-bold">{d2?.nome || 'Segundo Piloto'}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                  Overall {d2?.overall}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  Ritmo: {d2?.ritmo} · Consistência: {d2?.consistencia}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-black/40 border border-border/30">
              <span className="text-[11px] font-mono uppercase text-muted-foreground block">
                Salário Anual
              </span>
              <span className="text-lg font-bold text-foreground">
                ${((c2?.salaryAnnual || 8_000_000) / 1_000_000).toFixed(1)}M
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/40 border border-border/30">
              <span className="text-[11px] font-mono uppercase text-muted-foreground block">
                Cláusula de Rescisão
              </span>
              <span className="text-lg font-bold text-amber-400">
                ${(((c2?.salaryAnnual || 8_000_000) * 0.5) / 1_000_000).toFixed(1)}M
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSelectedSlot('driver2')
              setDialogOpen(true)
            }}
          >
            <FileSignature className="w-4 h-4 mr-2" /> Contratar / Substituir Piloto 2
          </Button>
        </div>
      </div>

      {/* Modal de Contratação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto technical-panel">
          <DialogHeader>
            <DialogTitle>
              Mercado de Pilotos — {selectedSlot === 'driver1' ? 'Carro 1' : 'Carro 2'}
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground font-mono">
            Selecione um piloto do catálogo oficial para negociar os termos de contrato.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {drivers.slice(0, 30).map((cand) => {
              const isSelected = targetDriverId === cand.id
              const estSalary = Math.round(cand.overall * 160_000)
              return (
                <div
                  key={cand.id}
                  onClick={() => setTargetDriverId(cand.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'border-border/50 bg-card/40 hover:border-border hover:bg-card/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={cand.imagem}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-border"
                      onError={(e) => {
                        e.currentTarget.src = assets.branding.cover
                      }}
                    />
                    <div>
                      <h4 className="text-sm font-bold">{cand.nome}</h4>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        OV: {cand.overall} · ${(estSalary / 1_000_000).toFixed(1)}M/ano
                      </p>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-primary" />}
                </div>
              )
            })}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!targetDriverId || actionLoading} onClick={handleSignContract}>
              {actionLoading ? 'Processando Contrato...' : 'Confirmar e Assinar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
