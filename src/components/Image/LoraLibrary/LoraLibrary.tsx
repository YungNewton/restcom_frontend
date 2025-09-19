// src/components/Image/LoraLibrary/LoraLibrary.tsx
import { useEffect, useMemo, useState } from 'react'
import styles from './LoraLibrary.module.css'
import {
  Search, Star, StarOff, Plus, X, Pencil, Trash2,
  Download, RefreshCcw, Grid, List, Info, ChevronLeft, ChevronRight
} from 'lucide-react'
import AddLoRa from './AddLoRa'

/** LoRA shape coming from backend */
export type Lora = {
  id: string
  name: string
  author?: string
  type?: 'image' | 'video' | 'audio' | 'text'
  previewUrl?: string
  sampleUrls?: string[]
  tags?: string[]
  downloads?: number
  favorites?: number
  sizeMB?: number
  createdAt?: string
  isFavorite?: boolean
  /** NEW: flag to distinguish user's LoRAs from defaults */
  isMine?: boolean
}

/** Component API — wire these to your backend */
export type LoraLibraryProps = {
  items?: Lora[] // dynamic data from backend
  isLoading?: boolean
  onRefresh?: () => void
  onAdd?: (payload: {
    name: string
    type: NonNullable<Lora['type']>
    file?: File
    url?: string
    tags: string[]
  }) => Promise<void> | void
  onToggleFavorite?: (id: string, next: boolean) => Promise<void> | void
  onRename?: (id: string, nextName: string) => Promise<void> | void
  onDelete?: (ids: string[]) => Promise<void> | void
  onDownload?: (id: string) => Promise<void> | void
  onOpenDetails?: (lora: Lora) => void
}

const mock: Lora[] = [
  {
    id: 'two-image-demo',
    name: 'Two Image Sample',
    author: '@demo',
    type: 'image',
    previewUrl:
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop',
    sampleUrls: [
      'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?q=80&w=1200&auto=format&fit=crop'
    ],
    tags: ['portrait', 'studio'],
    downloads: 42,
    favorites: 7,
    sizeMB: 64,
    createdAt: new Date().toISOString(),
    isFavorite: false,
    isMine: true
  },
  {
    id: 'restcom-style',
    name: 'Restcom Style',
    author: '@restcom',
    type: 'image',
    previewUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1200&auto=format&fit=crop',
    sampleUrls: [
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=1200&auto=format&fit=crop'
    ],
    tags: ['portrait', 'studio', 'cinematic'],
    downloads: 1253,
    favorites: 210,
    sizeMB: 128,
    createdAt: new Date(Date.now() - 86400 * 1000 * 4).toISOString(),
    isFavorite: true,
    isMine: true
  },
  {
    id: 'arch-lite',
    name: 'ArchViz Lite',
    author: '@blockcraft',
    type: 'image',
    previewUrl:
      'https://images.unsplash.com/photo-1501183638710-841dd1904471?q=80&w=1200&auto=format&fit=crop',
    tags: ['architecture', 'interior', 'minimal'],
    downloads: 842,
    favorites: 97,
    sizeMB: 64,
    createdAt: new Date(Date.now() - 86400 * 1000 * 9).toISOString(),
    isMine: false
  },
  {
    id: 'anime-ink',
    name: 'Anime Ink',
    author: '@graphica',
    type: 'image',
    previewUrl:
      'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=1200&auto=format&fit=crop',
    tags: ['anime', 'ink', 'stylized'],
    downloads: 1902,
    favorites: 355,
    sizeMB: 96,
    createdAt: new Date(Date.now() - 86400 * 1000 * 13).toISOString(),
    isFavorite: false,
    isMine: false
  }
]

function cn(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ')
}

function formatSizeMB(n?: number) {
  if (n === undefined || n === null) return '—'
  if (n < 1024) return `${n} MB`
  return `${(n / 1024).toFixed(2)} GB`
}

function timeAgo(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (d <= 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  return `${m}mo ago`
}

type OwnerFilter = 'all' | 'mine' | 'default'
const MAX_USE = 3

export default function LoraLibrary({
  items,
  isLoading,
  onRefresh,
  onAdd,
  onToggleFavorite,
  onRename,
  onDelete,
  onDownload,
  onOpenDetails
}: LoraLibraryProps) {
  const data = items && items.length ? items : mock

  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [sort, setSort] = useState<'recent' | 'popular' | 'name'>('recent')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsItem, setDetailsItem] = useState<Lora | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [onlyFavs, setOnlyFavs] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')

  // optimistic favourites + pulse state
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({})
  const [favPulsing, setFavPulsing] = useState<Set<string>>(new Set())

  // gallery state (drawer only)
  const [galleryIndex, setGalleryIndex] = useState(0)

  const allTags = useMemo(() => {
    const s = new Set<string>()
    data.forEach(d => d.tags?.forEach(t => s.add(t)))
    return Array.from(s).sort()
  }, [data])

  const effectiveFav = (l: Lora) => (favOverrides[l.id] ?? !!l.isFavorite)

  const filtered = useMemo(() => {
    let out = [...data]
    if (query.trim()) {
      const q = query.toLowerCase()
      out = out.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          (i.author || '').toLowerCase().includes(q) ||
          (i.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }
    if (activeTags.length) {
      out = out.filter(i => activeTags.every(t => i.tags?.includes(t)))
    }
    if (onlyFavs) {
      out = out.filter(i => (favOverrides[i.id] ?? !!i.isFavorite))
    }
    if (ownerFilter === 'mine') {
      out = out.filter(i => !!i.isMine)
    } else if (ownerFilter === 'default') {
      out = out.filter(i => !i.isMine)
    }
    out.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'popular') return (b.favorites ?? 0) - (a.favorites ?? 0)
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      )
    })
    return out
  }, [data, query, activeTags, sort, onlyFavs, favOverrides, ownerFilter])

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleRefreshAndClear() {
    setActiveTags([]) // clear tag filters
    onRefresh?.()
  }

  function pulseFav(id: string) {
    setFavPulsing(prev => {
      const n = new Set(prev); n.add(id); return n
    })
    setTimeout(() => {
      setFavPulsing(prev => {
        const n = new Set(prev); n.delete(id); return n
      })
    }, 350)
  }

  // optimistic toggle
  async function handleFavorite(l: Lora) {
    const next = !effectiveFav(l)
    pulseFav(l.id)
    setFavOverrides(prev => ({ ...prev, [l.id]: next }))
    onToggleFavorite?.(l.id, next)
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function openDetails(l: Lora) {
    setDetailsItem(l)
    setGalleryIndex(0) // reset gallery to first image
    setDetailsOpen(true)
    onOpenDetails?.(l)
  }

  async function handleDelete(ids: string[]) {
    onDelete?.(ids)
    clearSelection()
  }

  // Use up to MAX_USE selected loras → /image
  function handleUseSelected() {
    const ids = Array.from(selected).slice(0, MAX_USE)
    try {
      sessionStorage.setItem('image.selectedLoras', JSON.stringify(ids))
    } catch {}
    window.location.href = '/image'
  }

  // Keyboard navigation in drawer
  useEffect(() => {
    if (!detailsOpen || !detailsItem) return
    const gallery = [
      ...(detailsItem.previewUrl ? [detailsItem.previewUrl] : []),
      ...(detailsItem.sampleUrls || [])
    ]
    const onKey = (e: KeyboardEvent) => {
      if (!gallery.length) return
      if (e.key === 'ArrowLeft') setGalleryIndex(i => (i + gallery.length - 1) % gallery.length)
      if (e.key === 'ArrowRight') setGalleryIndex(i => (i + 1) % gallery.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailsOpen, detailsItem])

  // helper to gather gallery URLs
  const galleryFor = (l: Lora) => ([
    ...(l.previewUrl ? [l.previewUrl] : []),
    ...(l.sampleUrls || [])
  ])

  return (
    <div className={styles.wrap} data-view={view}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>LoRA Library</h2>
          <div className={styles.subtitle}>Browse through our collection of LoRAs.</div>
        </div>
        <div className={styles.headerActions}>
          {/* Toggle with custom tooltip + centered icon */}
          <div
            className={styles.tooltipWrapper}
            data-tooltip={view === 'grid' ? 'List layout' : 'Grid layout'}
            aria-label={view === 'grid' ? 'Switch to list layout' : 'Switch to grid layout'}
          >
            <button
              className={styles.iconBtn}
              onClick={() => setView(v => (v === 'grid' ? 'list' : 'grid'))}
              type="button"
            >
              {view === 'grid' ? <List size={18} /> : <Grid size={18} />}
            </button>
          </div>

          <button className={styles.primaryBtn} onClick={() => setAddOpen(true)}>
            <Plus size={16} /> Add LoRA
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search className={styles.searchIcon} size={16} />
          <input
            className={styles.searchInput}
            placeholder="search name, tag, author…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.sortChips}>
          <button
            className={cn(styles.chip, sort === 'recent' && styles.chipActive)}
            onClick={() => setSort('recent')}
            type="button"
          >
            Recent
          </button>
          <button
            className={cn(styles.chip, sort === 'popular' && styles.chipActive)}
            onClick={() => setSort('popular')}
            type="button"
          >
            Popular
          </button>
          <button
            className={cn(styles.chip, sort === 'name' && styles.chipActive)}
            onClick={() => setSort('name')}
            type="button"
          >
            A–Z
          </button>

          <div
            className={styles.tooltipWrapper}
            data-tooltip={onlyFavs ? 'Showing favourites' : 'Show favourites'}
          >
            <button
              className={cn(styles.chip, onlyFavs && styles.chipActive)}
              onClick={() => setOnlyFavs(v => !v)}
              aria-pressed={onlyFavs}
              type="button"
            >
              <Star size={14} />
              <span>Favourites</span>
            </button>
          </div>

          {/* Owner filter chips */}
          <span className={styles.muted} style={{ opacity: .5, padding: '0 .25rem' }} aria-hidden="true">|</span>
          <button
            className={cn(styles.chip, ownerFilter === 'all' && styles.chipActive)}
            onClick={() => setOwnerFilter('all')}
            type="button"
          >
            All
          </button>
          <button
            className={cn(styles.chip, ownerFilter === 'mine' && styles.chipActive)}
            onClick={() => setOwnerFilter('mine')}
            type="button"
          >
            My LoRAs
          </button>
          <button
            className={cn(styles.chip, ownerFilter === 'default' && styles.chipActive)}
            onClick={() => setOwnerFilter('default')}
            type="button"
          >
            Defaults
          </button>
        </div>

        <div className={styles.tagsScroller}>
          {allTags.map(t => {
            const active = activeTags.includes(t)
            return (
              <button
                key={t}
                className={cn(styles.tagBtn, active && styles.tagBtnActive)}
                onClick={() =>
                  setActiveTags(prev =>
                    active ? prev.filter(x => x !== t) : [...prev, t]
                  )
                }
                type="button"
              >
                #{t}
              </button>
            )
          })}
        </div>

        <div className={styles.toolbarRight}>
          {selected.size > 0 ? (
            <>
              {/* Use button (up to 3) */}
              <button
                className={styles.primaryBtn}
                onClick={handleUseSelected}
                type="button"
                title={`Use up to ${MAX_USE} selected`}
              >
                Use ({Math.min(selected.size, MAX_USE)}/{MAX_USE})
              </button>

              <button
                className={styles.dangerBtn}
                onClick={() => handleDelete(Array.from(selected))}
                type="button"
              >
                <Trash2 size={16} /> Delete ({selected.size})
              </button>
              <button className={styles.secondaryBtn} onClick={clearSelection} type="button">
                Clear
              </button>
            </>
          ) : (
            // icon-only, low-attention, with tooltip, clears tags too
            <div
              className={styles.tooltipWrapper}
              data-tooltip="Refresh"
              aria-label="Refresh and clear all selected tags"
            >
              <button
                className={`${styles.iconBtn} ${styles.iconBtnGhost}`}
                onClick={handleRefreshAndClear}
                type="button"
              >
                <RefreshCcw size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={styles.contentWrap}>
        {isLoading ? (
          <div className={styles.loading}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <Info size={18} />
            <div>No LoRAs found. Try clearing filters or add a new one.</div>
          </div>
        ) : view === 'grid' ? (
          <div className={styles.grid}>
            {filtered.map(l => {
              const fav = effectiveFav(l)
              const gallery = galleryFor(l)
              const primary = gallery[0]

              return (
                <article
                  key={l.id}
                  className={cn(styles.card, selected.has(l.id) && styles.cardSelected)}
                >
                  <div className={styles.cardMedia} onClick={() => openDetails(l)}>
                    {primary ? (
                      <img src={primary} alt={l.name} />
                    ) : (
                      <div className={styles.noPreview}>No preview</div>
                    )}

                    <button
                      className={cn(
                        styles.favBtn,
                        fav && styles.favActive,
                        favPulsing.has(l.id) && styles.favPulse
                      )}
                      onClick={e => { e.stopPropagation(); handleFavorite(l); }}
                      title={fav ? 'Unfavorite' : 'Favorite'}
                      aria-label={fav ? 'Unfavorite' : 'Favorite'}
                    >
                      {fav ? (
                        <Star size={16} className={cn(styles.favIcon, styles.favIconFilled)} />
                      ) : (
                        <StarOff size={16} className={styles.favIcon} />
                      )}
                    </button>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardTitleRow}>
                      <h3
                        className={styles.cardTitle}
                        title={l.name}
                        onClick={() => openDetails(l)}
                      >
                        {l.name}
                      </h3>
                      <div className={styles.menu}>
                        <div
                          className={styles.tooltipWrapper}
                          data-tooltip={selected.has(l.id) ? 'Unselect' : 'Select'}
                        >
                          <button
                            className={styles.iconBtn}
                            onClick={() => toggleSelected(l.id)}
                            aria-pressed={selected.has(l.id)}
                            aria-label={selected.has(l.id) ? 'Unselect' : 'Select'}
                            type="button"
                          >
                            ✓
                          </button>
                        </div>

                        <div className={styles.tooltipWrapper} data-tooltip="Rename">
                          <button
                            className={styles.iconBtn}
                            onClick={() => promptRename(l, onRename)}
                            aria-label="Rename"
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                        </div>

                        <div className={styles.tooltipWrapper} data-tooltip="Download">
                          <button
                            className={styles.iconBtn}
                            onClick={() => onDownload?.(l.id)}
                            aria-label="Download"
                            type="button"
                          >
                            <Download size={16} />
                          </button>
                        </div>

                        <div className={styles.tooltipWrapper} data-tooltip="Delete">
                          <button
                            className={styles.iconBtnDanger}
                            onClick={() => handleDelete([l.id])}
                            aria-label="Delete"
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardMeta}>
                      <span className={styles.muted}>{l.author || 'Unknown'}</span>
                      <span className={styles.muted}>{formatSizeMB(l.sizeMB)}</span>
                    </div>

                    <div className={styles.tagsRow}>
                      {(l.tags || []).slice(0, 4).map(t => (
                        <span key={t} className={styles.tagChip}>#{t}</span>
                      ))}
                    </div>

                    <div className={styles.footerRow}>
                      <span className={styles.muted}>Added {timeAgo(l.createdAt)}</span>
                      {!!l.downloads && (
                        <span className={styles.muted}>{l.downloads} downloads</span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(l => {
              const fav = effectiveFav(l)
              const gallery = galleryFor(l)
              const primary = gallery[0]

              return (
                <article
                  key={l.id}
                  className={cn(styles.row, selected.has(l.id) && styles.cardSelected)}
                  onClick={() => openDetails(l)}
                >
                  <div className={styles.rowThumb}>
                    {primary ? (
                      <img src={primary} alt={l.name} />
                    ) : (
                      <div className={styles.noPreview}>No preview</div>
                    )}
                  </div>

                  <div className={styles.rowMain}>
                    <div className={styles.rowTop}>
                      <div className={styles.rowTitleWrap}>
                        <h3 className={styles.rowTitle}>{l.name}</h3>
                        <div className={styles.rowSub}>{l.author || 'Unknown'}</div>
                      </div>
                      <div
                        className={styles.rowActions}
                        onClick={e => e.stopPropagation()}
                      >
                        <div
                          className={styles.tooltipWrapper}
                          data-tooltip={selected.has(l.id) ? 'Unselect' : 'Select'}
                        >
                          <button
                            className={styles.iconBtn}
                            onClick={() => toggleSelected(l.id)}
                            aria-pressed={selected.has(l.id)}
                            aria-label={selected.has(l.id) ? 'Unselect' : 'Select'}
                            type="button"
                          >
                            ✓
                          </button>
                        </div>

                        <div
                          className={styles.tooltipWrapper}
                          data-tooltip={fav ? 'Unfavorite' : 'Favorite'}
                        >
                          <button
                            className={cn(
                              styles.iconBtn,
                              fav && styles.favActiveBtn,
                              favPulsing.has(l.id) && styles.favPulseBtn
                            )}
                            onClick={() => handleFavorite(l)}
                            aria-label={fav ? 'Unfavorite' : 'Favorite'}
                            type="button"
                          >
                            {fav ? (
                              <Star size={16} className={cn(styles.favIcon, styles.favIconFilled)} />
                            ) : (
                              <StarOff size={16} className={styles.favIcon} />
                            )}
                          </button>
                        </div>

                        <div className={styles.tooltipWrapper} data-tooltip="Rename">
                          <button
                            className={styles.iconBtn}
                            onClick={() => promptRename(l, onRename)}
                            aria-label="Rename"
                            type="button"
                          >
                            <Pencil size={16} />
                          </button>
                        </div>

                        <div className={styles.tooltipWrapper} data-tooltip="Download">
                          <button
                            className={styles.iconBtn}
                            onClick={() => onDownload?.(l.id)}
                            aria-label="Download"
                            type="button"
                          >
                            <Download size={16} />
                          </button>
                        </div>

                        <div className={styles.tooltipWrapper} data-tooltip="Delete">
                          <button
                            className={styles.iconBtnDanger}
                            onClick={() => handleDelete([l.id])}
                            aria-label="Delete"
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.rowBottom}>
                      <div className={styles.tagsRow}>
                        {(l.tags || []).slice(0, 6).map(t => (
                          <span key={t} className={styles.tagChip}>#{t}</span>
                        ))}
                      </div>
                      <div className={styles.rowMetaRight}>
                        <span className={styles.muted}>{formatSizeMB(l.sizeMB)}</span>
                        <span className={styles.muted}>Added {timeAgo(l.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* Details Drawer */}
      {detailsOpen && detailsItem && (
        <div className={styles.drawerBackdrop} onClick={() => setDetailsOpen(false)}>
          <div
            className={styles.drawer}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className={styles.drawerHeader}>
              <h3 className={styles.drawerTitle}>{detailsItem.name}</h3>
              <button className={styles.iconBtn} onClick={() => setDetailsOpen(false)} aria-label="Close" type="button">
                <X size={18} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              {/* --- Carousel media (arrows here only) --- */}
              <div className={styles.drawerMedia}>
                {(() => {
                  const gallery = [
                    ...(detailsItem.previewUrl ? [detailsItem.previewUrl] : []),
                    ...(detailsItem.sampleUrls || [])
                  ]
                  return gallery.length ? (
                    <div className={styles.carouselWrap}>
                      <img
                        key={gallery[galleryIndex]}
                        src={gallery[galleryIndex]}
                        alt={`${detailsItem.name} – ${galleryIndex + 1}/${gallery.length}`}
                        className={styles.carouselImg}
                      />

                      {gallery.length > 1 && (
                        <>
                          <div className={styles.tooltipWrapper} data-tooltip="Previous">
                            <button
                              className={`${styles.carouselBtn} ${styles.carouselBtnLeft}`}
                              onClick={() =>
                                setGalleryIndex(i => (i + gallery.length - 1) % gallery.length)
                              }
                              aria-label="Previous image"
                              type="button"
                            >
                              <ChevronLeft size={18} />
                            </button>
                          </div>

                          <div className={styles.tooltipWrapper} data-tooltip="Next">
                            <button
                              className={`${styles.carouselBtn} ${styles.carouselBtnRight}`}
                              onClick={() => setGalleryIndex(i => (i + 1) % gallery.length)}
                              aria-label="Next image"
                              type="button"
                            >
                              <ChevronRight size={18} />
                            </button>
                          </div>

                          <div className={styles.carouselCounter}>
                            {galleryIndex + 1} / {gallery.length}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className={styles.noPreview}>No preview</div>
                  )
                })()}
              </div>

              {/* Thumbnails */}
              {(() => {
                const gallery = [
                  ...(detailsItem.previewUrl ? [detailsItem.previewUrl] : []),
                  ...(detailsItem.sampleUrls || [])
                ]
                return gallery.length > 1 ? (
                  <div className={styles.thumbsRow}>
                    {gallery.map((u, i) => (
                      <button
                        key={u + i}
                        className={cn(styles.thumb, i === galleryIndex && styles.thumbActive)}
                        onClick={() => setGalleryIndex(i)}
                        type="button"
                        aria-label={`Show image ${i + 1}`}
                      >
                        <img src={u} alt={`thumb-${i + 1}`} />
                      </button>
                    ))}
                  </div>
                ) : null
              })()}

              <div className={styles.infoGrid}>
                <InfoStat label="Type" value={detailsItem.type || '—'} />
                <InfoStat label="Size" value={formatSizeMB(detailsItem.sizeMB)} />
                <InfoStat label="Favorites" value={String(detailsItem.favorites ?? 0)} />
                <InfoStat label="Downloads" value={String(detailsItem.downloads ?? 0)} />
                <InfoStat label="Added" value={timeAgo(detailsItem.createdAt)} />
                <InfoStat label="Author" value={detailsItem.author || '—'} />
              </div>

              <div className={styles.drawerTags}>
                {(detailsItem.tags || []).map(t => (
                  <span key={t} className={styles.tagChip}>#{t}</span>
                ))}
              </div>
            </div>

            <div className={styles.drawerFooter}>
              <button className={styles.secondaryBtn} onClick={() => promptRename(detailsItem, onRename)} type="button">
                <Pencil size={16} /> Rename
              </button>
              <button className={styles.secondaryBtn} onClick={() => onDownload?.(detailsItem.id)} type="button">
                <Download size={16} /> Download
              </button>
              <div className={styles.flexGrow} />
              {/* Drawer footer delete (icon-only with tooltip) */}
              <div className={styles.tooltipWrapper} data-tooltip="Delete">
                <button
                  className={styles.iconBtnDanger}
                  aria-label="Delete"
                  onClick={() => { handleDelete([detailsItem.id]); setDetailsOpen(false); }}
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal (external component) */}
      {addOpen && (
        <AddLoRa
          onClose={() => setAddOpen(false)}
          onSubmit={async payload => {
            await onAdd?.(payload)
            setAddOpen(false)
          }}
        />
      )}
    </div>
  )
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoCard}>
      <div className={styles.infoLabel}>{label}</div>
      <div className={styles.infoValue}>{value}</div>
    </div>
  )
}

function promptRename(
  l: Lora,
  onRename?: (id: string, name: string) => void | Promise<void>
) {
  if (!onRename) return
  const next = window.prompt('Rename LoRA', l.name)
  if (next == null) return
  onRename(l.id, next.trim() || l.name)
}
