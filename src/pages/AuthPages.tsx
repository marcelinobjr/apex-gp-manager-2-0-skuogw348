import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Eye, EyeOff, Gauge, Mail, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { assets } from '@/lib/assets'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Mode = 'login' | 'signup' | 'forgot' | 'reset'
interface Props {
  mode: Mode
}

const copy = {
  login: ['ENTRAR NO GRID', 'Acesse sua equipe e continue sua jornada.'],
  signup: ['CRIAR CONTA', 'Comece sua carreira como Team Principal.'],
  forgot: ['RECUPERAR SENHA', 'Enviaremos as instruções de recuperação.'],
  reset: ['NOVA SENHA', 'Defina uma nova senha segura para sua conta.'],
} as const

export function AuthPage({ mode }: Props) {
  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '' })
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))
  const strength = Math.min(
    4,
    [
      form.password.length >= 8,
      /[A-Z]/.test(form.password),
      /\d/.test(form.password),
      /[^A-Za-z0-9]/.test(form.password),
    ].filter(Boolean).length,
  )
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setErrors({})
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
        toast.success('Bem-vindo ao grid')
        navigate('/painel')
      }
      if (mode === 'signup') {
        await signup(form.name, form.email, form.password, form.passwordConfirm)
        toast.success('Conta criada. Verifique seu e-mail.')
        navigate('/login')
      }
      if (mode === 'forgot') {
        await pb.collection('users').requestPasswordReset(form.email)
        toast.success('Se o e-mail estiver cadastrado, as instruções serão enviadas.')
        navigate('/login')
      }
      if (mode === 'reset') {
        const token = search.get('token')
        if (!token) throw new Error('Token de recuperação ausente')
        await pb
          .collection('users')
          .confirmPasswordReset(token, form.password, form.passwordConfirm)
        toast.success('Senha alterada com sucesso')
        navigate('/login')
      }
    } catch (error) {
      const fieldErrors = extractFieldErrors(error)
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: getErrorMessage(error) })
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="auth-shell">
      <div
        className="auth-visual"
        style={{
          backgroundImage: `linear-gradient(180deg,rgba(5,7,10,.3),rgba(5,7,10,.88)),url(${assets.branding.cover})`,
        }}
      >
        <Link to="/">
          <img
            src={assets.branding.logoTransparent}
            onError={(e) => {
              e.currentTarget.src = assets.branding.logo
            }}
            alt="APEX GP Manager 2.0"
          />
        </Link>
        <div>
          <p className="eyebrow">APEX 2.0</p>
          <h2>
            SUA EQUIPE.
            <br />
            SUAS DECISÕES.
            <br />
            <span>SUA HISTÓRIA.</span>
          </h2>
          <p>Construa uma potência do automobilismo e conquiste o campeonato.</p>
        </div>
        <small>APEX GP MANAGER 2.0</small>
      </div>
      <main className="auth-form-wrap">
        <Link to="/" className="back-link">
          <ArrowLeft size={17} /> Voltar ao início
        </Link>
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-heading">
            <Gauge />
            <p className="eyebrow">ACESSO AO PADDOCK</p>
            <h1>{copy[mode][0]}</h1>
            <span>{copy[mode][1]}</span>
          </div>
          {errors.form && <p className="form-error">{errors.form}</p>}
          {mode === 'signup' && (
            <Field label="Nome" error={errors.name}>
              <Input
                autoComplete="name"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Seu nome de manager"
              />
            </Field>
          )}
          <Field label="E-mail" error={errors.email}>
            <Input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="manager@equipe.com"
            />
          </Field>
          {mode !== 'forgot' && (
            <Field label="Senha" error={errors.password}>
              <div className="password-input">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Mostrar senha"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </Field>
          )}
          {(mode === 'signup' || mode === 'reset') && (
            <>
              <div className="strength">
                <span>Força da senha</span>
                <div>
                  {[1, 2, 3, 4].map((level) => (
                    <i className={strength >= level ? 'active' : ''} key={level} />
                  ))}
                </div>
              </div>
              <Field label="Confirmar senha" error={errors.passwordConfirm}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={form.passwordConfirm}
                  onChange={(e) => set('passwordConfirm', e.target.value)}
                  placeholder="Repita a senha"
                />
              </Field>
            </>
          )}
          {mode === 'login' && (
            <div className="form-links">
              <label>
                <input type="checkbox" /> Lembrar de mim
              </label>
              <Link to="/forgot-password">Esqueci minha senha</Link>
            </div>
          )}
          <Button size="lg" disabled={loading} type="submit">
            {loading
              ? 'Processando...'
              : mode === 'login'
                ? 'Entrar'
                : mode === 'signup'
                  ? 'Criar conta'
                  : mode === 'forgot'
                    ? 'Enviar instruções'
                    : 'Alterar senha'}
          </Button>
          {mode === 'login' && (
            <p className="switch-auth">
              Novo no APEX? <Link to="/signup">Criar conta</Link>
            </p>
          )}
          {mode === 'signup' && (
            <p className="switch-auth">
              Já tem uma conta? <Link to="/login">Entrar</Link>
            </p>
          )}
        </form>
      </main>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="field">
      <Label>{label}</Label>
      {children}
      {error && <small>{error}</small>}
    </div>
  )
}

export function TokenPage({ type }: { type: 'verify' | 'email' }) {
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const confirm = async () => {
    setState('loading')
    try {
      const token = search.get('token')
      if (!token) throw new Error()
      if (type === 'verify') await pb.collection('users').confirmVerification(token)
      else await pb.collection('users').confirmEmailChange(token, '')
      pb.authStore.clear()
      setState('success')
      toast.success(type === 'verify' ? 'E-mail verificado' : 'E-mail alterado')
      setTimeout(() => navigate('/login'), 1600)
    } catch {
      setState('error')
    }
  }
  return (
    <div className="token-page">
      <div className="token-card">
        <ShieldCheck />
        <p className="eyebrow">APEX ID</p>
        <h1>{type === 'verify' ? 'Verificar e-mail' : 'Confirmar novo e-mail'}</h1>
        <p>
          {state === 'success'
            ? 'Tudo certo. Você será levado para o acesso.'
            : state === 'error'
              ? 'O link é inválido ou expirou.'
              : 'Confirme para proteger o acesso à sua equipe.'}
        </p>
        {state !== 'success' && (
          <Button onClick={confirm} disabled={state === 'loading'}>
            {state === 'loading' ? 'Confirmando...' : 'Confirmar agora'}
          </Button>
        )}
        <Link to="/login">
          <Mail size={16} /> Voltar ao login
        </Link>
      </div>
    </div>
  )
}
