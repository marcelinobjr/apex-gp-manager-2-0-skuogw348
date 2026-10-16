import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Menu, UserRound, X } from 'lucide-react'
import { assets } from '@/lib/assets'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

const navItems = [
  ['/painel', 'Painel'],
  ['/equipe', 'Minha Equipe'],
  ['/temporada', 'Temporada'],
  ['/circuitos', 'Circuitos'],
  ['/equipes', 'Equipes'],
  ['/pilotos', 'Pilotos'],
  ['/motores', 'Motores'],
  ['/estruturas', 'Estruturas'],
]
const authPaths = [
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/confirm-email-change',
]

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="APEX GP Manager 2.0">
      <img
        src={compact ? assets.branding.logoReduced : assets.branding.logoTransparent}
        onError={(event) => {
          event.currentTarget.src = assets.branding.logo
        }}
        alt="APEX GP Manager 2.0"
      />
    </Link>
  )
}

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const isLanding = location.pathname === '/'
  const isAuth = authPaths.includes(location.pathname)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => setMenuOpen(false), [location.pathname])
  if (isAuth)
    return (
      <main className="min-h-screen">
        <Outlet />
      </main>
    )

  const avatarUrl = user?.avatar
    ? pb.files.getURL(
        {
          id: user.id,
          collectionId: '_pb_users_auth_',
          collectionName: 'users',
          avatar: user.avatar,
        } as never,
        user.avatar,
        { thumb: '100x100' },
      )
    : undefined
  const requestEmailChange = async () => {
    try {
      await pb.collection('users').requestEmailChange(newEmail)
      toast.success('Confirmação enviada ao novo e-mail')
      setNewEmail('')
    } catch {
      toast.error('Não foi possível solicitar a alteração')
    }
  }

  return (
    <div className="app-shell">
      {!isLanding && (
        <div
          className="app-background"
          style={{
            backgroundImage: `linear-gradient(180deg,rgba(10,13,18,.95),rgba(10,13,18,.78),rgba(10,13,18,.96)),url(${assets.branding.background})`,
          }}
        />
      )}
      <header className={`navbar ${scrolled || !isLanding ? 'navbar-solid' : ''}`}>
        <div className="nav-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Navegação principal">
            {navItems.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="user-button">
                    <Avatar>
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span>{user.name}</span>
                    <ChevronDown size={15} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="dark-menu">
                  <DropdownMenuItem onSelect={() => navigate('/painel')}>
                    <UserRound size={16} />
                    Meu perfil
                  </DropdownMenuItem>
                  <Dialog>
                    <DialogTrigger asChild>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        Alterar e-mail
                      </DropdownMenuItem>
                    </DialogTrigger>
                    <DialogContent className="technical-panel">
                      <DialogHeader>
                        <DialogTitle>Alterar e-mail</DialogTitle>
                        <DialogDescription>
                          Enviaremos uma confirmação para o novo endereço.
                        </DialogDescription>
                      </DialogHeader>
                      <Label htmlFor="change-email">Novo e-mail</Label>
                      <Input
                        id="change-email"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                      <Button onClick={requestEmailChange}>Enviar confirmação</Button>
                    </DialogContent>
                  </Dialog>
                  <DropdownMenuItem
                    onSelect={() => {
                      logout()
                      navigate('/')
                    }}
                  >
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild size="sm">
                <Link to="/login">Entrar</Link>
              </Button>
            )}
            <button
              className="mobile-menu-button"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </button>
          </div>
        </div>
      </header>
      {menuOpen && (
        <div className="mobile-drawer">
          <button onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
            <X />
          </button>
          <Brand />
          {navItems.map(([to, label], index) => (
            <NavLink key={to} to={to} style={{ animationDelay: `${index * 60}ms` }}>
              {label}
            </NavLink>
          ))}
        </div>
      )}
      <main className={isLanding ? 'landing-main' : 'app-main'}>
        <Outlet />
      </main>
      {!isLanding && (
        <footer className="footer">
          <Brand compact />
          <span>APEX GP Manager 2.0 · {new Date().getFullYear()}</span>
        </footer>
      )}
    </div>
  )
}
