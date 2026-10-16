import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, CarFront, CircuitBoard, Gauge, Users } from 'lucide-react'
import { assets } from '@/lib/assets'
import { circuits, drivers, engines, structures, teams } from '@/data/game'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

const modules = [
  {
    title: 'Circuitos',
    count: `${circuits.length} circuitos`,
    image: circuits[20].imagem,
    href: '/circuitos',
    icon: CircuitBoard,
  },
  {
    title: 'Equipes',
    count: `${teams.length} equipes`,
    image: teams[2].imagem,
    href: '/equipes',
    icon: CarFront,
  },
  {
    title: 'Pilotos',
    count: `${drivers.length} pilotos`,
    image: drivers[0].imagem,
    href: '/pilotos',
    icon: Users,
  },
  {
    title: 'Motores',
    count: `${engines.length} motores`,
    image: engines[1].imagem,
    href: '/motores',
    icon: Gauge,
  },
  {
    title: 'Estruturas',
    count: `${structures.length} estruturas`,
    image: structures[0].imagem,
    href: '/estruturas',
    icon: Building2,
  },
]

export default function Index() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const openModule = (href: string) => navigate(user ? href : '/login')
  return (
    <>
      <section
        className="hero"
        style={{
          backgroundImage: `linear-gradient(90deg,rgba(4,6,9,.9),rgba(4,6,9,.42),rgba(4,6,9,.78)),url(${assets.branding.cover})`,
        }}
      >
        <div className="speed-lines" />
        <div className="hero-copy">
          <div className="starting-lights">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} style={{ animationDelay: `${i * 140}ms` }} />
            ))}
          </div>
          <p className="eyebrow">SIMULADOR DE GESTÃO · APEX 2.0</p>
          <img
            className="hero-logo"
            src={assets.branding.logoTransparent}
            onError={(e) => {
              e.currentTarget.src = assets.branding.logo
            }}
            alt="APEX GP Manager 2.0"
          />
          <h1>
            Construa uma equipe.
            <br />
            <span>Domine o grid.</span>
          </h1>
          <p>Assuma o comando, contrate talentos e transforme cada decisão em performance.</p>
          <div className="hero-buttons">
            <Button asChild variant="outline" size="lg">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild size="lg">
              <Link to="/signup">
                Criar conta <ArrowRight size={18} />
              </Link>
            </Button>
          </div>
        </div>
        <div className="hero-stat">
          <strong>43</strong>
          <span>
            pistas ao redor
            <br />
            do mundo
          </span>
        </div>
        <div className="scroll-hint">
          ROLE PARA EXPLORAR <span>↓</span>
        </div>
      </section>
      <section className="modules-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BASE DE DADOS OFICIAL</p>
            <h2>O MUNDO APEX</h2>
          </div>
          <p>Todos os elementos para construir sua história no automobilismo.</p>
        </div>
        <div className="module-grid">
          {modules.map((item, index) => (
            <button
              onClick={() => openModule(item.href)}
              className="module-card stagger-card"
              style={{ animationDelay: `${index * 60}ms` }}
              key={item.title}
            >
              <img
                src={item.image}
                alt=""
                onError={(e) => {
                  e.currentTarget.src =
                    'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/logo_base_programa/Capa.jpg'
                }}
              />
              <div className="module-overlay" />
              <div className="module-icon">
                <item.icon />
              </div>
              <div className="module-info">
                <span>{item.count}</span>
                <h3>{item.title}</h3>
                <p>
                  Explorar módulo <ArrowRight size={14} />
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="crest-strip">
        <p className="eyebrow">EQUIPES LENDÁRIAS · NOVOS DESAFIANTES</p>
        <div className="crest-marquee">
          {teams.slice(0, 20).map((team, index) => (
            <img
              src={team.emblema}
              onError={(e) => {
                e.currentTarget.src = team.imagem
              }}
              alt={team.nome}
              key={team.id}
              style={{ animationDelay: `${index * 40}ms` }}
            />
          ))}
        </div>
      </section>
      <section className="final-cta">
        <img
          src={assets.branding.logoReduced}
          onError={(e) => {
            e.currentTarget.src = assets.branding.logo
          }}
          alt=""
        />
        <div>
          <p className="eyebrow">O GRID ESTÁ ESPERANDO</p>
          <h2>Pronto para assumir a equipe?</h2>
        </div>
        <Button asChild size="lg">
          <Link to="/signup">
            Criar conta <ArrowRight size={18} />
          </Link>
        </Button>
      </section>
    </>
  )
}
