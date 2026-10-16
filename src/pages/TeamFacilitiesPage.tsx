import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  ArrowUpCircle,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react'
import { careerService, CareerRecord, CareerStateRecord } from '@/services/career'
import { teamManagementService } from '@/services/teamManagement'
import { structures } from '@/data/game'
import { assets } from '@/lib/assets'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function TeamFacilitiesPage() {
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [state, setState] = useState<CareerStateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgradingCode, setUpgradingCode] = useState<string | null>(null)

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
      toast.error('Erro ao carregar instalações')
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

  const facilitiesState = state.facilities_state || {}

  const costMap: Record<number, number> = {
    2: 4_000_000,
    3: 8_000_000,
    4: 15_000_000,
    5: 25_000_000,
  }

  const handleUpgrade = async (code: string, currentLevel: number) => {
    const nextLevel = currentLevel + 1
    if (nextLevel > 5) return

    try {
      setUpgradingCode(code)
      const updated = await teamManagementService.upgradeFacility(career.id, code, nextLevel)
      setState(updated)
      toast.success(
        `Instalação aprimorada para o Nível ${nextLevel}! Efeito consumido em tempo real.`,
      )
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha no aprimoramento da estrutura')
    } finally {
      setUpgradingCode(null)
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
          <h1 className="text-3xl font-extrabold tracking-tight">
            Instalações do QG (9 Estruturas)
          </h1>
          <p className="text-sm text-muted-foreground">
            Aprimoramento de Centro de Design, CFD, Túnel de Vento, Fábrica, Operações, Pit Stop,
            Simulador e Academia (INV-06).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {structures.map((struct) => {
          const currentLevel = (facilitiesState[struct.code] || struct.nivel || 1) as number
          const isMax = currentLevel >= 5
          const nextLevel = currentLevel + 1
          const upgradeCost = costMap[nextLevel] || 10_000_000
          const isUpgrading = upgradingCode === struct.code

          return (
            <div
              key={struct.id}
              className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="relative h-44 overflow-hidden bg-black/40">
                  <img
                    src={struct.imagem}
                    alt={struct.nome}
                    className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                    onError={(e) => {
                      e.currentTarget.src = assets.branding.cover
                    }}
                  />
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur border border-border/50 px-2.5 py-1 rounded-md text-xs font-mono font-bold text-primary">
                    NÍVEL {currentLevel} / 5
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <span className="text-[11px] font-mono text-muted-foreground uppercase">
                    {struct.code}
                  </span>
                  <h3 className="text-lg font-bold text-foreground leading-snug">{struct.nome}</h3>
                  <p className="text-xs text-muted-foreground">{struct.efeito}</p>
                </div>
              </div>

              <div className="p-5 pt-0 border-t border-border/30 mt-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase text-muted-foreground block">
                    {isMax ? 'Nível Máximo' : `Custo Nv.${nextLevel}`}
                  </span>
                  <span className="text-sm font-bold text-foreground font-mono">
                    {isMax ? 'Consolidado' : `$${(upgradeCost / 1_000_000).toFixed(0)}M`}
                  </span>
                </div>

                <Button
                  size="sm"
                  disabled={isMax || isUpgrading}
                  onClick={() => handleUpgrade(struct.code, currentLevel)}
                  className="font-bold"
                >
                  {isMax ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-400" /> Max
                    </>
                  ) : isUpgrading ? (
                    'Construindo...'
                  ) : (
                    <>
                      <ArrowUpCircle className="w-4 h-4 mr-1.5" /> Aprimorar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
