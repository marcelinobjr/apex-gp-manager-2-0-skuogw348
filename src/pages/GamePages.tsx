import { Link } from 'react-router-dom'
import { ArrowRight, Building2, CarFront, CircuitBoard, Gauge, Trophy, Users } from 'lucide-react'
import { circuits, drivers, engines, structures, teams } from '@/data/game'
import { useAuth } from '@/contexts/AuthContext'
import CatalogPage from '@/components/CatalogPage'
import type { CatalogEntry } from '@/components/CatalogPage'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function Dashboard() {
  const { user } = useAuth()
  const tiles = [
    ['Circuitos', circuits.length, circuits[20].imagem, '/circuitos', CircuitBoard],
    ['Equipes', teams.length, teams[2].imagem, '/equipes', CarFront],
    ['Pilotos', drivers.length, drivers[0].imagem, '/pilotos', Users],
    ['Motores', engines.length, engines[1].imagem, '/motores', Gauge],
    ['Estruturas', structures.length, structures[0].imagem, '/estruturas', Building2],
  ] as const
  return (
    <section className="dashboard">
      <div className="dash-welcome">
        <div>
          <p className="eyebrow">CENTRAL DA EQUIPE</p>
          <h1>
            Bem-vindo, <span>{user?.name}</span>
          </h1>
          <p>O grid está pronto. Escolha seu próximo movimento.</p>
        </div>
        <Avatar className="dash-avatar">
          <AvatarFallback>{user?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
      <div className="starting-lights dashboard-lights">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </div>
      <div className="summary-grid">
        {tiles.map(([title, count, image, href, Icon], index) => (
          <Link
            to={href}
            className="summary-card"
            style={{ animationDelay: `${index * 60}ms` }}
            key={title}
          >
            <img src={image} alt="" />
            <div />
            <Icon />
            <p>
              <strong>{count}</strong>
              <span>{title}</span>
            </p>
            <ArrowRight />
          </Link>
        ))}
      </div>
      <div className="highlight-heading">
        <div>
          <p className="eyebrow">DESTAQUES DO CALENDÁRIO</p>
          <h2>Próximos desafios</h2>
        </div>
        <Trophy />
      </div>
      <div className="circuit-highlights">
        {[circuits[20], circuits[12], circuits[15]].map((circuit, index) => (
          <Link to="/circuitos" key={circuit.id}>
            <img src={circuit.imagem} alt={circuit.nome} />
            <span>ETAPA {String(index + 1).padStart(2, '0')}</span>
            <h3>{circuit.nome}</h3>
            <p>
              {circuit.pais} · {circuit.voltas} voltas
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}

const circuitEntries: CatalogEntry[] = circuits.map((c) => ({
  id: c.id,
  title: c.nome,
  subtitle: c.pais,
  image: c.imagem,
  badge: c.codigoPais,
  stats: [
    { label: 'Extensão', value: `${c.extensaoKm} km` },
    { label: 'Voltas', value: c.voltas },
    { label: 'Tipo', value: c.tipo },
  ],
}))
const teamEntries: CatalogEntry[] = teams.map((t) => ({
  id: t.id,
  title: t.nome,
  subtitle: t.pais,
  image: t.imagem,
  badge: t.codigo,
  accent: t.corSecundaria,
  stats: [
    { label: 'Código', value: t.codigo },
    { label: 'País', value: t.pais },
    { label: 'Cor oficial', value: t.corPrimaria },
  ],
}))
const driverEntries: CatalogEntry[] = drivers
  .map((d) => ({
    id: d.id,
    title: d.nome,
    subtitle: d.equipe,
    image: d.imagem,
    badge: String(d.overall),
    stats: [
      { label: 'Overall', value: d.overall },
      { label: 'Ritmo', value: d.ritmo },
      { label: 'Consistência', value: d.consistencia },
      { label: 'Ultrapassagem', value: d.ultrapassagem },
      { label: 'País', value: d.pais },
    ],
  }))
  .sort((a, b) => Number(b.badge) - Number(a.badge))
const engineEntries: CatalogEntry[] = engines.map((e) => ({
  id: e.id,
  title: e.nome,
  subtitle: e.pais,
  image: e.imagem,
  badge: e.custo,
  stats: [
    { label: 'Potência', value: e.potencia },
    { label: 'Confiabilidade', value: e.confiabilidade },
    { label: 'Eficiência', value: e.eficiencia },
    { label: 'Potencial', value: e.potencial },
    { label: 'Custo', value: e.custo },
  ],
}))
const structureEntries: CatalogEntry[] = structures.map((s) => ({
  id: s.id,
  title: s.nome,
  subtitle: `Nível ${s.nivel}`,
  image: s.imagem,
  badge: `NV ${s.nivel}`,
  stats: [
    { label: 'Nível atual', value: s.nivel },
    { label: 'Efeito', value: s.efeito },
    { label: 'Status', value: 'Operacional' },
  ],
}))

export const CircuitsPage = () => (
  <CatalogPage
    eyebrow="CALENDÁRIO MUNDIAL"
    title="Circuitos"
    description="Explore todas as pistas do universo APEX."
    entries={circuitEntries}
    filters={[...new Set(circuits.map((c) => c.pais))]}
  />
)
export const TeamsPage = () => (
  <CatalogPage
    eyebrow="CONSTRUTORES"
    title="Equipes"
    description="Tradição, tecnologia e ambição em cada garagem."
    entries={teamEntries}
    filters={[...new Set(teams.map((t) => t.pais))]}
  />
)
export const DriversPage = () => (
  <CatalogPage
    eyebrow="MERCADO DE TALENTOS"
    title="Pilotos"
    description="Compare atributos e encontre a dupla ideal."
    entries={driverEntries}
    filters={[...new Set(drivers.map((d) => d.equipe))]}
  />
)
export const EnginesPage = () => (
  <CatalogPage
    eyebrow="UNIDADES DE POTÊNCIA"
    title="Motores"
    description="Potência e confiabilidade para cada filosofia de projeto."
    entries={engineEntries}
    filters={[...new Set(engines.map((e) => e.pais))]}
  />
)
export const StructuresPage = () => (
  <CatalogPage
    eyebrow="QG DA EQUIPE"
    title="Estruturas"
    description="Desenvolva a infraestrutura que sustenta suas vitórias."
    entries={structureEntries}
  />
)
