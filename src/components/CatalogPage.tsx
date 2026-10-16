import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export interface CatalogEntry {
  id: string
  title: string
  subtitle: string
  image: string
  badge?: string
  accent?: string
  stats: { label: string; value: string | number }[]
}

interface Props {
  eyebrow: string
  title: string
  description: string
  entries: CatalogEntry[]
  filters?: string[]
}
export default function CatalogPage({ eyebrow, title, description, entries, filters = [] }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [selected, setSelected] = useState<CatalogEntry | null>(null)
  const shown = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.title.toLowerCase().includes(query.toLowerCase()) &&
          (filter === 'Todos' || entry.subtitle === filter),
      ),
    [entries, filter, query],
  )
  return (
    <section className="catalog-page">
      <header className="page-header">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="catalog-toolbar">
        <label>
          <Search size={18} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar em ${title.toLowerCase()}...`}
          />
          {query && (
            <button onClick={() => setQuery('')}>
              <X size={16} />
            </button>
          )}
        </label>
        {filters.length > 0 && (
          <div className="filter-chips">
            <SlidersHorizontal size={16} />
            {['Todos', ...filters].map((item) => (
              <button
                onClick={() => setFilter(item)}
                className={filter === item ? 'active' : ''}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
        )}
        <Badge variant="outline">{shown.length} registros</Badge>
      </div>
      <div className="catalog-grid">
        {shown.map((entry, index) => (
          <button
            className="catalog-card"
            style={
              {
                animationDelay: `${Math.min(index, 12) * 60}ms`,
                '--accent': entry.accent ?? '#E10600',
              } as React.CSSProperties
            }
            onClick={() => setSelected(entry)}
            key={entry.id}
          >
            <div className="card-media">
              <img
                src={entry.image}
                alt={entry.title}
                onError={(e) => {
                  e.currentTarget.src =
                    'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/logo_base_programa/Capa.jpg'
                }}
              />
              {entry.badge && <span>{entry.badge}</span>}
            </div>
            <div className="card-body">
              <p>{entry.subtitle}</p>
              <h2>{entry.title}</h2>
              <div className="mini-stats">
                {entry.stats.slice(0, 3).map((stat) => (
                  <span key={stat.label}>
                    <small>{stat.label}</small>
                    <strong>{stat.value}</strong>
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
      {shown.length === 0 && (
        <div className="empty-result">Nenhum registro encontrado para esta busca.</div>
      )}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <SheetTitle>{selected?.title}</SheetTitle>
            <SheetDescription>{selected?.subtitle}</SheetDescription>
          </SheetHeader>
          {selected && (
            <>
              <img
                className="detail-image"
                src={selected.image}
                alt={selected.title}
                onError={(e) => {
                  e.currentTarget.src =
                    'https://raw.githubusercontent.com/marcelinobjr/apex-gp-manager-2-0-skuogw348/main/logo_base_programa/Capa.jpg'
                }}
              />
              <div className="detail-stats">
                {selected.stats.map((stat) => (
                  <div key={stat.label}>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div>
              <Button onClick={() => setSelected(null)} variant="outline">
                Fechar ficha
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  )
}
