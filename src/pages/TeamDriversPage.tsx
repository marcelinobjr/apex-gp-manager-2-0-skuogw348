import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  FileSignature,
  ShieldAlert,
  Award,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Calendar,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
  Sparkles,
  ArrowRightLeft,
  XCircle,
  Clock,
  Briefcase,
} from 'lucide-react'
import { careerService, CareerRecord, CareerStateRecord } from '@/services/career'
import {
  driverMarketService,
  DriverMarketViewItem,
  DriverContractRecord,
  ContractRole,
  NegotiationStatus,
} from '@/services/driverMarketService'
import { drivers, teams, Driver } from '@/data/game'
import { assets, getDriverPortrait, DRIVER_PORTRAIT_PLACEHOLDER } from '@/lib/assets'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

export function TeamDriversPage() {
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [state, setState] = useState<CareerStateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'cockpits' | 'mercado' | 'historico' | 'futuros'>(
    'cockpits',
  )

  // Dados do Mercado
  const [marketItems, setMarketItems] = useState<DriverMarketViewItem[]>([])
  const [allContracts, setAllContracts] = useState<DriverContractRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'FREE_AGENT' | 'EXPIRING' | 'CONTRACTED'
  >('ALL')

  // Negociação / Ficha do Piloto
  const [selectedDriver, setSelectedDriver] = useState<DriverMarketViewItem | null>(null)
  const [negotiationOpen, setNegotiationOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [driverHistory, setDriverHistory] = useState<DriverContractRecord[]>([])

  // Parâmetros da Proposta
  const [targetSlot, setTargetSlot] = useState<ContractRole>('PRIMARY_1')
  const [startSeason, setStartSeason] = useState<number>(2026)
  const [durationYears, setDurationYears] = useState<number>(2)
  const [offeredSalary, setOfferedSalary] = useState<number>(10_000_000)
  const [offeredBonus, setOfferedBonus] = useState<number>(1_000_000)
  const [actionLoading, setActionLoading] = useState(false)

  // Resposta da negociação
  const [negotiationResult, setNegotiationResult] = useState<{
    status: NegotiationStatus
    message: string
    counterSalary?: number
    counterBonus?: number
  } | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const list = await careerService.listUserCareers()
      if (list.length > 0) {
        const c = list[0]
        setCareer(c)
        const s = await careerService.getCareerState(c.id)
        setState(s)

        // Inicializar contratos canônicos se necessário
        await driverMarketService.ensureCareerContractsInitialized(c)

        // Carregar visão do mercado
        const currentYear = c.current_year || 2026
        setStartSeason(currentYear)
        const market = await driverMarketService.getMarketOverview(c.id, currentYear)
        setMarketItems(market)

        // Carregar lista completa de contratos
        const contracts = await driverMarketService.listContracts(c.id)
        setAllContracts(contracts)
      }
    } catch {
      toast.error('Erro ao carregar dados do mercado de pilotos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtragem dos pilotos do mercado
  const filteredMarket = useMemo(() => {
    return marketItems.filter((item) => {
      const matchSearch =
        item.driver.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.driver.pais.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.currentTeam &&
          item.currentTeam.name.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchStatus = statusFilter === 'ALL' || item.marketStatus === statusFilter

      return matchSearch && matchStatus
    })
  }, [marketItems, searchQuery, statusFilter])

  // Contratos da equipe gerenciada
  const managedTeamContracts = useMemo(() => {
    if (!career) return []
    return allContracts.filter((c) => c.team_id === career.managed_team_id)
  }, [allContracts, career])

  const futureContracts = useMemo(() => {
    return allContracts.filter((c) => c.contract_status === 'FUTURE')
  }, [allContracts])

  if (loading || !career || !state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-mono text-muted-foreground">
          Sincronizando contratos da carreira...
        </p>
      </div>
    )
  }

  const d1 = drivers.find((d) => d.id === state.contracts_ledger?.driver1?.driverId)
  const d2 = drivers.find((d) => d.id === state.contracts_ledger?.driver2?.driverId)
  const c1 = state.contracts_ledger?.driver1
  const c2 = state.contracts_ledger?.driver2

  const openNegotiationModal = (item: DriverMarketViewItem, slotOverride?: ContractRole) => {
    setSelectedDriver(item)
    setTargetSlot(slotOverride || 'PRIMARY_1')
    setOfferedSalary(item.expectedSalary)
    setOfferedBonus(0)
    setDurationYears(2)
    setStartSeason(career.current_year || 2026)
    setNegotiationResult(null)
    setNegotiationOpen(true)
  }

  const openDriverHistoryModal = async (driverId: string) => {
    try {
      const hist = await driverMarketService.getDriverContractHistory(career.id, driverId)
      setDriverHistory(hist)
      setHistoryOpen(true)
    } catch {
      toast.error('Erro ao buscar histórico')
    }
  }

  const handleSubmitProposal = async () => {
    if (!selectedDriver) return
    try {
      setActionLoading(true)
      const res = await driverMarketService.submitProposal({
        careerId: career.id,
        driverId: selectedDriver.driver.id,
        teamId: career.managed_team_id,
        targetRole: targetSlot,
        targetStartSeason: startSeason,
        targetDurationYears: durationYears,
        offeredSalary,
        offeredBonus,
      })
      setNegotiationResult(res)

      if (res.status === 'ACCEPTED') {
        toast.success(`Proposta aceita por ${selectedDriver.driver.nome}! Pronto para assinatura.`)
      } else if (res.status === 'COUNTER_OFFER') {
        toast.info(`Contraproposta recebida de ${selectedDriver.driver.nome}.`)
      } else {
        toast.error(`Proposta rejeitada por ${selectedDriver.driver.nome}.`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha na negociação')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSignAcceptedContract = async () => {
    if (!selectedDriver) return
    try {
      setActionLoading(true)
      const finalSalary =
        negotiationResult?.counterSalary && negotiationResult.status === 'COUNTER_OFFER'
          ? negotiationResult.counterSalary
          : offeredSalary
      const finalBonus =
        negotiationResult?.counterBonus && negotiationResult.status === 'COUNTER_OFFER'
          ? negotiationResult.counterBonus
          : offeredBonus

      await driverMarketService.signContract({
        careerId: career.id,
        driverId: selectedDriver.driver.id,
        teamId: career.managed_team_id,
        role: targetSlot,
        startSeason,
        durationYears,
        salaryAnnual: finalSalary,
        signingBonus: finalBonus,
      })

      toast.success(
        startSeason > (career.current_year || 2026)
          ? `Contrato futuro firmado com ${selectedDriver.driver.nome} para a Temporada ${startSeason}!`
          : `Contrato firmado com ${selectedDriver.driver.nome} com sucesso!`,
      )
      setNegotiationOpen(false)
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha na assinatura do contrato.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleTerminateContract = async (contractId: string) => {
    if (!confirm('Deseja rescindir o contrato? A multa rescisória será debitada do caixa.')) return
    try {
      setActionLoading(true)
      await driverMarketService.terminateContract(contractId, 'RESCISAO_UNILATERAL_EQUIPE')
      toast.success('Contrato rescindido. Piloto agora é agente livre.')
      loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro na rescisão')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            to="/equipe"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Central da Equipe
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight">
              Pilotos & Mercado de Transferências
            </h1>
            <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
              Módulo 4.2 · QA-05C4
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de cockpits, contratos vigentes e futuros, negociações persistentes e histórico
            esportivo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Atualizar Mercado
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-card/70 border border-border/50">
          <TabsTrigger value="cockpits" className="gap-2">
            <Users className="w-4 h-4" /> Cockpits Vigentes
          </TabsTrigger>
          <TabsTrigger value="mercado" className="gap-2">
            <Briefcase className="w-4 h-4" /> Mercado de Pilotos ({marketItems.length})
          </TabsTrigger>
          <TabsTrigger value="futuros" className="gap-2">
            <Calendar className="w-4 h-4" /> Contratos Futuros ({futureContracts.length})
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <Clock className="w-4 h-4" /> Registro de Contratos
          </TabsTrigger>
        </TabsList>

        {/* ABA 1: COCKPITS VIGENTES */}
        <TabsContent value="cockpits" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cockpit 1 */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-border/40">
                <span className="text-xs font-mono uppercase px-2.5 py-1 rounded bg-primary/20 text-primary font-bold">
                  Cockpit Titular #1 · Carro 1
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  Temporada Atual: {career.current_year}
                </span>
              </div>

              <div className="flex items-center gap-5">
                <img
                  src={
                    d1 ? d1.imagem : getDriverPortrait(state.contracts_ledger?.driver1?.driverId)
                  }
                  alt={d1?.nome || 'Cockpit 1'}
                  className="w-20 h-20 rounded-xl object-cover border border-border/50 bg-black/40"
                  onError={(e) => {
                    e.currentTarget.src = DRIVER_PORTRAIT_PLACEHOLDER
                  }}
                />
                <div className="space-y-1">
                  <span className="text-xs font-mono text-primary">{d1?.pais}</span>
                  <h2 className="text-xl font-bold">{d1?.nome || 'Piloto Titular'}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-bold">
                      OV {d1?.overall}
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
                    Vigência Contratual
                  </span>
                  <span className="text-lg font-bold text-emerald-400">
                    {c1?.durationYears || 1} ano(s)
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setActiveTab('mercado')
                    setTargetSlot('PRIMARY_1')
                  }}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" /> Substituir Titular 1
                </Button>
                {d1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Histórico de Contratos"
                    onClick={() => openDriverHistoryModal(d1.id)}
                  >
                    <Clock className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Cockpit 2 */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-border/40">
                <span className="text-xs font-mono uppercase px-2.5 py-1 rounded bg-primary/20 text-primary font-bold">
                  Cockpit Titular #2 · Carro 2
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  Temporada Atual: {career.current_year}
                </span>
              </div>

              <div className="flex items-center gap-5">
                <img
                  src={
                    d2 ? d2.imagem : getDriverPortrait(state.contracts_ledger?.driver2?.driverId)
                  }
                  alt={d2?.nome || 'Cockpit 2'}
                  className="w-20 h-20 rounded-xl object-cover border border-border/50 bg-black/40"
                  onError={(e) => {
                    e.currentTarget.src = DRIVER_PORTRAIT_PLACEHOLDER
                  }}
                />
                <div className="space-y-1">
                  <span className="text-xs font-mono text-primary">{d2?.pais}</span>
                  <h2 className="text-xl font-bold">{d2?.nome || 'Segundo Piloto'}</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-bold">
                      OV {d2?.overall}
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
                    Vigência Contratual
                  </span>
                  <span className="text-lg font-bold text-emerald-400">
                    {c2?.durationYears || 1} ano(s)
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setActiveTab('mercado')
                    setTargetSlot('PRIMARY_2')
                  }}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" /> Substituir Titular 2
                </Button>
                {d2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Histórico de Contratos"
                    onClick={() => openDriverHistoryModal(d2.id)}
                  >
                    <Clock className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ABA 2: MERCADO DE PILOTOS */}
        <TabsContent value="mercado" className="space-y-4 mt-4">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/50 bg-card/40">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por piloto, país ou equipe atual..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-black/30 border-border/60"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Button
                variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('ALL')}
              >
                Todos
              </Button>
              <Button
                variant={statusFilter === 'FREE_AGENT' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('FREE_AGENT')}
              >
                Livres
              </Button>
              <Button
                variant={statusFilter === 'EXPIRING' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('EXPIRING')}
              >
                Expirando
              </Button>
              <Button
                variant={statusFilter === 'CONTRACTED' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('CONTRACTED')}
              >
                Sob Contrato
              </Button>
            </div>
          </div>

          {/* Grid de Pilotos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMarket.slice(0, 36).map((item) => {
              const statusBadgeColor =
                item.marketStatus === 'FREE_AGENT'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : item.marketStatus === 'EXPIRING'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : item.marketStatus === 'FUTURE_COMMITTED'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : 'bg-muted/40 text-muted-foreground border-border/40'

              const statusLabel =
                item.marketStatus === 'FREE_AGENT'
                  ? 'Agente Livre'
                  : item.marketStatus === 'EXPIRING'
                    ? 'Contrato Expirando'
                    : item.marketStatus === 'FUTURE_COMMITTED'
                      ? 'Vínculo Futuro Assinado'
                      : 'Sob Contrato'

              return (
                <div
                  key={item.driver.id}
                  className="p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-card/80 transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={item.driver.imagem || getDriverPortrait(item.driver.id)}
                      alt={item.driver.nome}
                      className="w-14 h-14 rounded-lg object-cover border border-border/60 bg-black/40 shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = DRIVER_PORTRAIT_PLACEHOLDER
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {item.driver.pais}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-1.5 ${statusBadgeColor}`}
                        >
                          {statusLabel}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-sm truncate text-white group-hover:text-primary transition-colors">
                        {item.driver.nome}
                      </h4>
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {item.currentTeam ? item.currentTeam.name : 'Sem Equipe'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-black/30 border border-border/30 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Overall</span>
                      <span className="text-sm font-bold text-foreground">
                        {item.driver.overall}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Expectativa</span>
                      <span className="text-xs font-bold text-foreground">
                        ${(item.expectedSalary / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Vigência</span>
                      <span className="text-xs font-bold text-foreground">
                        {item.contractRemainingYears > 0 ? `${item.contractRemainingYears}a` : '0'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => openNegotiationModal(item)}
                    >
                      <FileSignature className="w-3.5 h-3.5 mr-1" /> Negociar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => openDriverHistoryModal(item.driver.id)}
                    >
                      Histórico
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>

        {/* ABA 3: CONTRATOS FUTUROS */}
        <TabsContent value="futuros" className="space-y-4 mt-4">
          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-white">
                Transições e Contratos Futuros (Regra FIA 2026.1):
              </p>
              <p>
                Pilotos com contratos futuros continuam defendendo suas equipes atuais até o
                encerramento do ano corrente. Na virada anual de temporada, o vínculo transfere-se
                de forma atômica e o histórico esportivo permanece intacto.
              </p>
            </div>
          </div>

          {futureContracts.length === 0 ? (
            <div className="p-12 text-center rounded-xl border border-border/40 bg-card/30">
              <Calendar className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-bold">Nenhum contrato futuro registrado no momento.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ao negociar com um piloto, defina a temporada de início para o próximo ano para
                assinar um contrato futuro.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {futureContracts.map((fc) => {
                const drv = drivers.find((d) => d.id === fc.driver_id)
                const team = teams.find((t) => t.id === fc.team_id)
                return (
                  <div
                    key={fc.id}
                    className="p-5 rounded-xl border border-blue-500/40 bg-card/60 backdrop-blur space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-blue-400 border-blue-400/40">
                        Início: Temporada {fc.start_season}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        Duração: {fc.end_season - fc.start_season + 1} ano(s)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <img
                        src={drv ? drv.imagem : getDriverPortrait(fc.driver_id)}
                        alt={drv?.nome || fc.driver_id}
                        className="w-12 h-12 rounded-lg object-cover border border-border"
                      />
                      <div>
                        <h4 className="font-bold text-white">{drv?.nome || fc.driver_id}</h4>
                        <p className="text-xs font-mono text-muted-foreground">
                          Nova Equipe:{' '}
                          <strong className="text-foreground">{team?.nome || fc.team_id}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs font-mono">
                      <span>Salário Acordado:</span>
                      <strong className="text-emerald-400">
                        ${(fc.salary_annual / 1_000_000).toFixed(1)}M/ano
                      </strong>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ABA 4: HISTÓRICO DE CONTRATOS DA EQUIPE */}
        <TabsContent value="historico" className="space-y-4 mt-4">
          <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
            <table className="w-full text-xs font-mono text-left">
              <thead className="bg-black/40 text-muted-foreground border-b border-border/40">
                <tr>
                  <th className="p-3">Piloto</th>
                  <th className="p-3">Papel</th>
                  <th className="p-3">Período</th>
                  <th className="p-3">Salário Anual</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {managedTeamContracts.map((c) => {
                  const drv = drivers.find((d) => d.id === c.driver_id)
                  return (
                    <tr key={c.id} className="hover:bg-card/70 transition-colors">
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <img
                          src={drv ? drv.imagem : getDriverPortrait(c.driver_id)}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        {drv?.nome || c.driver_id}
                      </td>
                      <td className="p-3">{c.role}</td>
                      <td className="p-3">
                        {c.start_season} – {c.end_season}
                      </td>
                      <td className="p-3">${(c.salary_annual / 1_000_000).toFixed(1)}M</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {c.contract_status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        {c.contract_status === 'ACTIVE' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => handleTerminateContract(c.id)}
                          >
                            Rescindir
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL DE NEGOCIAÇÃO DE CONTRATO */}
      <Dialog open={negotiationOpen} onOpenChange={setNegotiationOpen}>
        <DialogContent className="max-w-xl technical-panel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" /> Negociação com{' '}
              {selectedDriver?.driver.nome}
            </DialogTitle>
            <DialogDescription>
              Ajuste as condições financeiras e desportivas para submeter à aprovação do piloto.
            </DialogDescription>
          </DialogHeader>

          {selectedDriver && (
            <div className="space-y-4 pt-2">
              {/* Card Resumo do Piloto */}
              <div className="p-3 rounded-xl bg-black/40 border border-border/50 flex items-center gap-4">
                <img
                  src={selectedDriver.driver.imagem || getDriverPortrait(selectedDriver.driver.id)}
                  alt={selectedDriver.driver.nome}
                  className="w-14 h-14 rounded-lg object-cover border border-border"
                />
                <div className="space-y-0.5">
                  <h4 className="font-bold text-white">{selectedDriver.driver.nome}</h4>
                  <p className="text-xs font-mono text-muted-foreground">
                    Overall {selectedDriver.driver.overall} · Equipe Atual:{' '}
                    {selectedDriver.currentTeam?.name || 'Livre'}
                  </p>
                  <p className="text-[11px] font-mono text-emerald-400">
                    Expectativa Salarial de Mercado: $
                    {(selectedDriver.expectedSalary / 1_000_000).toFixed(1)}M/ano
                  </p>
                </div>
              </div>

              {/* Formulário da Proposta */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div>
                  <label className="text-muted-foreground block mb-1">Vaga Proposta:</label>
                  <select
                    value={targetSlot}
                    onChange={(e) => setTargetSlot(e.target.value as ContractRole)}
                    className="w-full bg-black/50 border border-border/70 rounded-lg p-2 text-white"
                  >
                    <option value="PRIMARY_1">Titular (Cockpit #1)</option>
                    <option value="PRIMARY_2">Titular (Cockpit #2)</option>
                    <option value="RESERVE">Piloto de Reserva</option>
                  </select>
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1">Início da Vigência:</label>
                  <select
                    value={startSeason}
                    onChange={(e) => setStartSeason(Number(e.target.value))}
                    className="w-full bg-black/50 border border-border/70 rounded-lg p-2 text-white"
                  >
                    <option value={career.current_year}>
                      Temporada Atual ({career.current_year}) — Contrato Imediato
                    </option>
                    <option value={(career.current_year || 2026) + 1}>
                      Próxima Temporada ({(career.current_year || 2026) + 1}) — Contrato Futuro
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1">Duração do Vínculo:</label>
                  <select
                    value={durationYears}
                    onChange={(e) => setDurationYears(Number(e.target.value))}
                    className="w-full bg-black/50 border border-border/70 rounded-lg p-2 text-white"
                  >
                    <option value={1}>1 Ano</option>
                    <option value={2}>2 Anos</option>
                    <option value={3}>3 Anos</option>
                  </select>
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1">
                    Salário Anual Proposto ($):
                  </label>
                  <Input
                    type="number"
                    step="500000"
                    value={offeredSalary}
                    onChange={(e) => setOfferedSalary(Number(e.target.value))}
                    className="bg-black/50 border-border/70"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-muted-foreground block mb-1">
                    Bônus de Assinatura ($ - debitado do caixa):
                  </label>
                  <Input
                    type="number"
                    step="250000"
                    value={offeredBonus}
                    onChange={(e) => setOfferedBonus(Number(e.target.value))}
                    className="bg-black/50 border-border/70"
                  />
                </div>
              </div>

              {/* Feedback da Resposta do Piloto */}
              {negotiationResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono ${
                    negotiationResult.status === 'ACCEPTED'
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : negotiationResult.status === 'COUNTER_OFFER'
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                        : 'bg-destructive/10 border-destructive/40 text-destructive'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {negotiationResult.status === 'ACCEPTED' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                    {negotiationResult.status === 'ACCEPTED'
                      ? 'Proposta Aceita pelo Piloto'
                      : negotiationResult.status === 'COUNTER_OFFER'
                        ? 'Contraproposta do Piloto'
                        : 'Proposta Rejeitada'}
                  </div>
                  <p>{negotiationResult.message}</p>

                  {negotiationResult.counterSalary && (
                    <div className="mt-2 pt-2 border-t border-amber-500/30 flex justify-between font-bold">
                      <span>Exigência do Piloto:</span>
                      <span>${(negotiationResult.counterSalary / 1_000_000).toFixed(2)}M/ano</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <Button variant="ghost" onClick={() => setNegotiationOpen(false)}>
                  Cancelar
                </Button>

                {!negotiationResult || negotiationResult.status === 'REJECTED' ? (
                  <Button disabled={actionLoading} onClick={handleSubmitProposal}>
                    {actionLoading ? 'Avaliando Proposta...' : 'Enviar Proposta ao Piloto'}
                  </Button>
                ) : (
                  <Button
                    disabled={actionLoading}
                    onClick={handleSignAcceptedContract}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {actionLoading ? 'Processando Assinatura...' : 'Formalizar e Assinar Contrato'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE HISTÓRICO DO PILOTO */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg technical-panel">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Histórico Contratual
            </DialogTitle>
            <DialogDescription>
              Registro auditável e imutável de todos os contratos e vínculos do piloto na carreira.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
            {driverHistory.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground text-center py-6">
                Nenhum histórico registrado até o momento.
              </p>
            ) : (
              driverHistory.map((h) => {
                const team = teams.find((t) => t.id === h.team_id)
                return (
                  <div
                    key={h.id}
                    className="p-3 rounded-lg border border-border/40 bg-black/40 text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-white">{team?.nome || h.team_id}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {h.contract_status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground flex justify-between">
                      <span>
                        Período: {h.start_season} – {h.end_season}
                      </span>
                      <span>Salário: ${(h.salary_annual / 1_000_000).toFixed(1)}M/ano</span>
                    </div>
                    {h.termination_reason && (
                      <p className="text-amber-400 text-[11px] pt-1 border-t border-border/20">
                        Motivo do término: {h.termination_reason}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
