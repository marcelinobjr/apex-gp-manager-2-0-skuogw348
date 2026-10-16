// Wrapper que carrega a carreira ativa e repassa à página de projetos de P&D.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { careerService, type CareerRecord } from '@/services/career'
import { TeamProjectsPage } from '@/pages/TeamProjectsPage'
import { toast } from 'sonner'

export function TeamProjectsPageWrapper() {
  const [career, setCareer] = useState<CareerRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const list = await careerService.listUserCareers()
        if (!cancelled) {
          if (list.length === 0) {
            toast.error('Nenhuma carreira ativa encontrada.')
          } else {
            setCareer(list[0])
          }
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Erro ao carregar a carreira.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!career) {
    return (
      <p className="text-sm text-muted-foreground">Crie uma carreira para acessar o P&amp;D.</p>
    )
  }

  return <TeamProjectsPage career={career} />
}
