import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Flame,
  Globe2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Trophy,
  UserCheck,
  Zap,
} from 'lucide-react'
import { teams, drivers, engines, managers } from '@/data/game'
import { careerService } from '@/services/career'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { toast } from 'sonner'

// Telas 3.1–3.10 consolidadas em 6 etapas claras:
// Etapa 1 (3.1-3.2): Nome & Ano Inicial
// Etapa 2 (3.3): Tipo de Universo (Fórmula Real, Grid Expandido, Personalizado)
// Etapa 3 (3.4-3.5): Seleção de Equipes & Escalação Pilotos/Motores
// Etapa 4 (3.6-3.7): Seleção do Arquétipo de Manager (6 arquétipos com bônus/penalidades)
// Etapa 5 (3.8-3.9): Escolha da Equipe Gerenciada & Força Individual (50% a 150%, passo 5%)
// Etapa 6 (3.10): Revisão Geral, Congelamento Regulamentar e Criação Canônica

export default function CreateCareerWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estado do formulário
  const [careerName, setCareerName] = useState('Minha Era na Fórmula')
  const [initialYear, setInitialYear] = useState(2026)
  const [universeType, setUniverseType] = useState<'f1_oficial' | 'grid_expandido' | 'livre'>(
    'f1_oficial',
  )

  // Equipes selecionadas (mínimo 10 equipes)
  const defaultSelectedTeams = teams.slice(0, 11).map((t) => t.id)
  const [selectedTeams, setSelectedTeams] = useState<string[]>(defaultSelectedTeams)

  // Escalação de cada equipe { teamId: { driver1Id, driver2Id, engineId } }
  const [lineups, setLineups] = useState<
    Record<string, { driver1Id: string; driver2Id: string; engineId: string }>
  >(() => {
    const init: Record<string, { driver1Id: string; driver2Id: string; engineId: string }> = {}
    teams.forEach((t, i) => {
      init[t.id] = {
        driver1Id: drivers[i * 2]?.id || drivers[0].id,
        driver2Id: drivers[i * 2 + 1]?.id || drivers[1].id,
        engineId: engines[i % engines.length]?.id || engines[0].id,
      }
    })
    return init
  })

  // Manager escolhido (mgr_0001 a mgr_0006)
  const [selectedManagerId, setSelectedManagerId] = useState<string>(managers[0].id)

  // Equipe gerenciada pelo usuário
  const [managedTeamId, setManagedTeamId] = useState<string>(teams[0].id)

  // Força individual (50% a 150%, passo de 5%)
  const [powerFactor, setPowerFactor] = useState<number>(100)

  // Handlers
  const handleToggleTeam = (teamId: string) => {
    if (selectedTeams.includes(teamId)) {
      if (selectedTeams.length <= 10) {
        toast.warning('O grid deve conter no mínimo 10 equipes participantes.')
        return
      }
      setSelectedTeams((prev) => prev.filter((id) => id !== teamId))
      if (managedTeamId === teamId) {
        const remaining = selectedTeams.filter((id) => id !== teamId)
        if (remaining.length > 0) setManagedTeamId(remaining[0])
      }
    } else {
      setSelectedTeams((prev) => [...prev, teamId])
    }
  }

  const handleUpdateLineup = (
    teamId: string,
    field: 'driver1Id' | 'driver2Id' | 'engineId',
    val: string,
  ) => {
    setLineups((prev) => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        [field]: val,
      },
    }))
  }

  const handleCreateCareer = async () => {
    if (!careerName.trim()) {
      toast.error('Informe o nome da carreira.')
      return
    }

    if (!selectedTeams.includes(managedTeamId)) {
      toast.error('A equipe gerenciada deve fazer parte do grid selecionado.')
      return
    }

    try {
      setIsSubmitting(true)
      const result = await careerService.createCareer({
        name: careerName.trim(),
        initialYear,
        universeType,
        managerArchetypeId: selectedManagerId,
        managedTeamId,
        managedTeamPowerFactor: powerFactor,
        selectedTeamIds: selectedTeams,
        lineups,
      })

      toast.success(
        `Carreira "${result.career.name}" criada com sucesso! Regulamento e grid congelados.`,
      )
      navigate('/painel')
    } catch (err) {
      console.error('Falha ao criar carreira:', err)
      toast.error(err instanceof Error ? err.message : 'Falha ao criar carreira.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentManager = managers.find((m) => m.id === selectedManagerId) || managers[0]
  const currentManagedTeam = teams.find((t) => t.id === managedTeamId) || teams[0]

  return (
    <div className="career-wizard-container max-w-6xl mx-auto px-4 py-8">
      {/* Header do Wizard */}
      <div className="wizard-header text-center mb-8">
        <p className="eyebrow tracking-widest text-primary font-semibold text-xs uppercase">
          APEX GP MANAGER 2.0 · MÓDULO 3.1–3.10
        </p>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-1 text-white">
          Criação de Carreira Canônica
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl mx-auto mt-2">
          Configure seu universo de competição. Todas as regras, escalações, baselines de
          construtores e o teto orçamentário serão congelados permanentemente na fundação desta
          temporada.
        </p>

        {/* Stepper Progress */}
        <div className="flex items-center justify-center gap-2 mt-6 overflow-x-auto pb-2">
          {[
            { num: 1, label: 'Identidade' },
            { num: 2, label: 'Universo' },
            { num: 3, label: 'Grid & Escalações' },
            { num: 4, label: 'Arquétipo de Manager' },
            { num: 5, label: 'Sua Equipe' },
            { num: 6, label: 'Revisão & Congelamento' },
          ].map((st) => (
            <div
              key={st.num}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                step === st.num
                  ? 'bg-primary text-primary-foreground border-primary'
                  : step > st.num
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-card/40 text-muted-foreground border-border/50'
              }`}
            >
              <span className="w-4 h-4 rounded-full flex items-center justify-center bg-black/30 text-[10px]">
                {st.num}
              </span>
              <span>{st.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo por Etapa */}
      <div className="wizard-card bg-card/60 backdrop-blur-md border border-border/70 rounded-2xl p-6 md:p-8 shadow-2xl">
        {/* ETAPA 1: Nome & Ano Inicial (Telas 3.1 & 3.2) */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="border-b border-border/40 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="text-primary w-5 h-5" /> 1. Nome da Carreira & Ano Inicial
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Defina o nome do seu projeto de carreira e o marco cronológico do início das
                operações esportivas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="careerName" className="text-sm font-semibold">
                  Nome da Carreira
                </Label>
                <Input
                  id="careerName"
                  value={careerName}
                  onChange={(e) => setCareerName(e.target.value)}
                  placeholder="Ex: Minha Jornada na Fórmula"
                  className="bg-black/40 border-border/60"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  Identificador que acompanhará todos os recibos e históricos da sua gestão.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="initialYear" className="text-sm font-semibold">
                  Ano de Início da Temporada
                </Label>
                <div className="flex gap-3">
                  {[2024, 2025, 2026].map((yr) => (
                    <Button
                      key={yr}
                      type="button"
                      variant={initialYear === yr ? 'default' : 'outline'}
                      className="flex-1 font-bold"
                      onClick={() => setInitialYear(yr)}
                    >
                      {yr}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  O ano inicial baliza o regulamento de motores, tetos orçamentários e contratos
                  vigentes.
                </p>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-white">
                  Invariantes Fundamentais Aplicados (INV-01 a INV-08):
                </p>
                <p>
                  O resultado oficial é único e determinístico com seed congelada. Nenhuma temporada
                  concluída poderá ser reescrita. O teto financeiro é bloqueante para
                  desenvolvimento sem autorização orçamentária.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 2: Tipo de Universo (Tela 3.3) */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="border-b border-border/40 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Globe2 className="text-primary w-5 h-5" /> 2. Formato do Universo Competitivo
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha o ecossistema de construtores que disputará o campeonato com você.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'f1_oficial',
                  title: 'Grid Clássico / Oficial',
                  badge: '11 Equipes',
                  desc: 'As 11 principais forças contemporâneas com baselines oficiais extraídos dos dados de telemetria.',
                  icon: Trophy,
                },
                {
                  id: 'grid_expandido',
                  title: 'Grid Expandido',
                  badge: '22 Equipes',
                  desc: 'Combina as construtoras atuais com marcas históricas renomadas (Porsche, Andretti, Toyota, Lotus).',
                  icon: Flame,
                },
                {
                  id: 'livre',
                  title: 'Universo Total APEX',
                  badge: '33 Equipes',
                  desc: 'Acesso pleno a todos os 33 construtores do catálogo oficial com máxima variedade de motores.',
                  icon: Sparkles,
                },
              ].map((opt) => {
                const Icon = opt.icon
                const isSelected = universeType === opt.id
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      setUniverseType(opt.id as typeof universeType)
                      if (opt.id === 'f1_oficial') {
                        setSelectedTeams(teams.slice(0, 11).map((t) => t.id))
                      } else if (opt.id === 'grid_expandido') {
                        setSelectedTeams(teams.slice(0, 22).map((t) => t.id))
                      } else {
                        setSelectedTeams(teams.map((t) => t.id))
                      }
                    }}
                    className={`cursor-pointer rounded-xl p-5 border transition-all ${
                      isSelected
                        ? 'bg-primary/15 border-primary shadow-lg shadow-primary/10'
                        : 'bg-black/30 border-border/50 hover:border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Icon className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                      <Badge variant={isSelected ? 'default' : 'secondary'}>{opt.badge}</Badge>
                    </div>
                    <h3 className="font-bold text-base text-white">{opt.title}</h3>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{opt.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ETAPA 3: Grid & Escalações (Telas 3.4 & 3.5) */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border-b border-border/40 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Cpu className="text-primary w-5 h-5" /> 3. Seleção de Equipes & Escalações de
                  Grid
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Selecione no mínimo 10 equipes participantes e configure os dois pilotos e o
                  fornecedor de motor para cada uma.
                </p>
              </div>
              <Badge variant="outline" className="text-sm font-semibold py-1 px-3 w-fit">
                {selectedTeams.length} / 33 Equipes Selecionadas
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
              {teams.map((team) => {
                const isSelected = selectedTeams.includes(team.id)
                const lineup = lineups[team.id]
                return (
                  <div
                    key={team.id}
                    className={`p-4 rounded-xl border transition-all text-xs ${
                      isSelected
                        ? 'bg-black/50 border-primary/60'
                        : 'bg-black/20 border-border/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={team.emblema}
                          alt={team.nome}
                          className="w-6 h-6 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        <span className="font-bold text-sm text-white">{team.nome}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {team.codigo}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleTeam(team.id)}
                        className="rounded border-border w-4 h-4 text-primary focus:ring-primary cursor-pointer"
                      />
                    </div>

                    {isSelected && lineup && (
                      <div className="space-y-2 mt-3 pt-2 border-t border-border/30">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">
                            Piloto 1:
                          </label>
                          <select
                            value={lineup.driver1Id}
                            onChange={(e) =>
                              handleUpdateLineup(team.id, 'driver1Id', e.target.value)
                            }
                            className="w-full bg-black/60 border border-border/50 rounded px-2 py-1 text-white text-xs"
                          >
                            {drivers.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.nome} (OVR {d.overall})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">
                            Piloto 2:
                          </label>
                          <select
                            value={lineup.driver2Id}
                            onChange={(e) =>
                              handleUpdateLineup(team.id, 'driver2Id', e.target.value)
                            }
                            className="w-full bg-black/60 border border-border/50 rounded px-2 py-1 text-white text-xs"
                          >
                            {drivers.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.nome} (OVR {d.overall})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">
                            Unidade de Potência:
                          </label>
                          <select
                            value={lineup.engineId}
                            onChange={(e) =>
                              handleUpdateLineup(team.id, 'engineId', e.target.value)
                            }
                            className="w-full bg-black/60 border border-border/50 rounded px-2 py-1 text-white text-xs"
                          >
                            {engines.map((eng) => (
                              <option key={eng.id} value={eng.id}>
                                {eng.nome} (Pot: {eng.potencia} | Con: {eng.confiabilidade})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ETAPA 4: Seleção do Arquétipo de Manager (Telas 3.6 & 3.7) */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="border-b border-border/40 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <UserCheck className="text-primary w-5 h-5" /> 4. Escolha do Arquétipo de Diretor de
                Equipe (Manager)
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Selecione uma das 6 personalidades de liderança. Cada arquétipo traz modificadores
                permanentes de perfil que influenciam finanças, P&D, negociações e moral.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {managers.map((mgr) => {
                const isSelected = selectedManagerId === mgr.id
                return (
                  <div
                    key={mgr.id}
                    onClick={() => setSelectedManagerId(mgr.id)}
                    className={`cursor-pointer rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-primary/15 border-primary shadow-xl shadow-primary/10'
                        : 'bg-black/30 border-border/50 hover:border-border'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={mgr.image}
                          alt={mgr.displayName}
                          className="w-14 h-14 rounded-full object-cover border-2 border-primary/40 shrink-0"
                          onError={(e) => {
                            e.currentTarget.src =
                              'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/logo_base_programa/Capa.jpg'
                          }}
                        />
                        <div>
                          <h3 className="font-extrabold text-base text-white">{mgr.displayName}</h3>
                          <Badge variant="outline" className="text-[10px] mt-0.5">
                            {mgr.role}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-xs italic text-primary/90 font-medium mb-3">
                        "{mgr.headlineQuote}"
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                        {mgr.profileText}
                      </p>

                      <div className="space-y-1.5 pt-2 border-t border-border/30">
                        <p className="text-[10px] font-semibold text-white uppercase tracking-wider">
                          Modificadores de Perfil:
                        </p>
                        {mgr.modifiers.map((mod, mi) => (
                          <div key={mi} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{mod.target}</span>
                            <span
                              className={`font-mono font-bold ${
                                mod.value > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {mod.value > 0 ? `+${mod.value}` : mod.value}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/20 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-white">Lema: </span>
                      {mgr.signature}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ETAPA 5: Sua Equipe & Força Individual (Telas 3.8 & 3.9) */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="border-b border-border/40 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="text-primary w-5 h-5" /> 5. Escolha da Sua Equipe & Força Inicial
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Indique qual equipe você comandará e ajuste o fator de força inicial de 50% a 150%
                (em passos de 5%).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Seleção da equipe */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Equipe que você comandará</Label>
                <select
                  value={managedTeamId}
                  onChange={(e) => setManagedTeamId(e.target.value)}
                  className="w-full bg-black/60 border border-border/60 rounded-xl px-4 py-3 text-white text-sm"
                >
                  {selectedTeams.map((tid) => {
                    const t = teams.find((item) => item.id === tid)
                    return (
                      <option key={tid} value={tid}>
                        {t?.nome} ({t?.codigo} - {t?.pais})
                      </option>
                    )
                  })}
                </select>

                {currentManagedTeam && (
                  <div className="p-4 rounded-xl bg-black/40 border border-border/40 mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={currentManagedTeam.imagem}
                        alt={currentManagedTeam.nome}
                        className="w-20 h-14 object-cover rounded-lg border border-border/40"
                      />
                      <div>
                        <h4 className="font-bold text-white text-base">
                          {currentManagedTeam.nome}
                        </h4>
                        <p className="text-xs text-muted-foreground">{currentManagedTeam.pais}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/30">
                      <div>
                        <span className="text-muted-foreground">Túnel de Vento:</span>{' '}
                        <strong className="text-white">
                          Nv. {currentManagedTeam.facilities.windTunnel}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fábrica:</span>{' '}
                        <strong className="text-white">
                          Nv. {currentManagedTeam.facilities.factory}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Downforce Base:</span>{' '}
                        <strong className="text-white">
                          {currentManagedTeam.carBaseline.aeroDownforce}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Confiabilidade:</span>{' '}
                        <strong className="text-white">
                          {currentManagedTeam.carBaseline.chassisReliability}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Slider de Força (50% a 150%, passo 5%) */}
              <div className="space-y-5 p-5 rounded-xl bg-black/40 border border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Fator de Força Inicial da Equipe</Label>
                  <span className="text-2xl font-black text-primary font-mono">{powerFactor}%</span>
                </div>

                <Slider
                  value={[powerFactor]}
                  min={50}
                  max={150}
                  step={5}
                  onValueChange={(val) => setPowerFactor(val[0])}
                  className="w-full cursor-pointer"
                />

                <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                  <span>50% (Desafio Extremo)</span>
                  <span>100% (Baseline Padrão)</span>
                  <span>150% (Potência Máxima)</span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  O fator de força escala o baseline mecânico e aerodinâmico inicial da equipe antes
                  do desenvolvimento na temporada. Todas as demais equipes do grid competirão em
                  seus baselines padronizados (100%).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 6: Revisão Geral & Congelamento (Tela 3.10) */}
        {step === 6 && (
          <div className="space-y-6">
            <div className="border-b border-border/40 pb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="text-emerald-400 w-5 h-5" /> 6. Revisão do Universo &
                Congelamento Regulamentar
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Confira os parâmetros finais. Ao confirmar, o sistema gerará a semente
                determinística mestre (INV-01), o livro-razão financeiro inicial e o congelamento
                das regras técnicas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl bg-black/40 border border-border/50 space-y-3">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider text-primary">
                  Sumário da Fundação
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Nome da Carreira:</span>
                    <strong className="text-white">{careerName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Ano de Início:</span>
                    <strong className="text-white">{initialYear}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Universo:</span>
                    <strong className="text-white capitalize">
                      {universeType.replace('_', ' ')}
                    </strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Total de Construtores:</span>
                    <strong className="text-white">{selectedTeams.length} equipes</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Equipe Gerenciada:</span>
                    <strong className="text-white">{currentManagedTeam.nome}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Força Individual:</span>
                    <strong className="text-primary font-mono">{powerFactor}%</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Arquétipo de Manager:</span>
                    <strong className="text-white">{currentManager.displayName}</strong>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-black/40 border border-border/50 space-y-3">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider text-primary">
                  Regulamento Congelado (INV-01 a INV-08)
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Teto Orçamentário (Cost Cap):</span>
                    <strong className="text-white font-mono">$135.000.000 / ano</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Proteção Financeira (INV-05):</span>
                    <strong className="text-emerald-400">Ativa (Sem dinheiro mágico)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Pontuação Canônica:</span>
                    <strong className="text-white">25-18-15-12-10-8-6-4-2-1</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/20">
                    <span className="text-muted-foreground">Ponto para Volta Mais Rápida:</span>
                    <strong className="text-white">Sim (no Top 10)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-muted-foreground">Determinismo de Corrida:</span>
                    <strong className="text-white font-mono">Seed Canônica Imutável</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
              Pronto para iniciar! Ao clicar em "Criar Carreira", o estado canônico será registrado
              no PocketBase e você poderá assumir as decisões esportivas e técnicas da sua equipe.
            </div>
          </div>
        )}

        {/* Barra de Navegação Inferior */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 1 || isSubmitting}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>

          {step < 6 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => Math.min(6, s + 1))}
              className="flex items-center gap-2 font-bold px-6"
            >
              Próximo <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleCreateCareer}
              className="flex items-center gap-2 font-black px-8 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Congelando & Criando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Criar Carreira Oficial
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
