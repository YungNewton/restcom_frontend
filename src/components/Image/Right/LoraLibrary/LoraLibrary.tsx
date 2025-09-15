import { useMemo, useState, useEffect, useRef } from 'react'
import styles from './LoraLibrary.module.css'
import { Search, Star, Grid, List, Info, X, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'

export type Lora = {
  id: string
  name: string
  tags?: string[]
  previewUrl?: string
  sampleUrls?: string[]   // <-- new
  isFavorite?: boolean
  createdAt?: string
  favorites?: number
  isMine?: boolean
}

type Props = {
  onOpenDetails?: (lora: Lora) => void
  onSelectedChange?: (selected: Array<{ id: string; strength: number }>) => void
}

const mock: Lora[] = [
  {
    id: 'restcom-style',
    name: 'Restcom Style',
    tags: ['portrait', 'studio', 'cinematic'],
    previewUrl:
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1200&auto=format&fit=crop',
    isFavorite: true,
    favorites: 210,
    isMine: true,
    createdAt: new Date(Date.now() - 86400 * 1000 * 4).toISOString()
  },
  {
    id: 'arch-lite',
    name: 'ArchViz Lite',
    tags: ['architecture', 'interior', 'minimal'],
    previewUrl:
      'https://images.unsplash.com/photo-1501183638710-841dd1904471?q=80&w=1200&auto=format&fit=crop',
    favorites: 97,
    isMine: false,
    createdAt: new Date(Date.now() - 86400 * 1000 * 9).toISOString()
  },
  {
    id: 'anime-ink',
    name: 'Anime Ink',
    tags: ['anime', 'ink', 'stylized'],
    previewUrl:
      'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=1200&auto=format&fit=crop',
    sampleUrls: [
      'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?q=80&w=1200&auto=format&fit=crop'
    ],
    isFavorite: false,
    favorites: 355,
    isMine: false,
    createdAt: new Date(Date.now() - 86400 * 1000 * 13).toISOString()
  }
]

function cn(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ')
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
const MAX_SELECTED = 3

export default function LoraLibrary({ onOpenDetails, onSelectedChange }: Props) {
  const data = mock

  // view / filters / sort
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'name' | 'popular'>('recent')
  const [onlyFavs, setOnlyFavs] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all')

  // details
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsItem, setDetailsItem] = useState<Lora | null>(null)

  // selection (id -> strength 0..1)
  const [selected, setSelected] = useState<Record<string, number>>({})
  const selectedCount = Object.keys(selected).length
  const limitReached = selectedCount >= MAX_SELECTED
  const [galleryIndex, setGalleryIndex] = useState(0)

  // hydrate once from sessionStorage if the user came from the main library "Use" button
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true

    const raw = sessionStorage.getItem('image.selectedLoras')
    if (!raw) return

    try {
      const incoming = JSON.parse(raw) as string[] | null
      if (!Array.isArray(incoming) || incoming.length === 0) return

      const available = new Set(data.map(d => d.id))
      setSelected(prev => {
        const next: Record<string, number> = { ...prev }
        for (const id of incoming) {
          if (Object.keys(next).length >= MAX_SELECTED) break
          if (!available.has(id)) continue
          if (next[id] === undefined) next[id] = 0.5
        }
        onSelectedChange?.(
          Object.entries(next).map(([id, strength]) => ({ id, strength }))
        )
        return next
      })

      // clear after consuming so we don't rehydrate on later visits
      sessionStorage.removeItem('image.selectedLoras')
      toast.success('Loaded selected LoRAs from library')
    } catch {
      // ignore parse errors silently
    }
  }, [data, onSelectedChange])

  const filtered = useMemo(() => {
    let out = [...data]
    if (query.trim()) {
      const q = query.toLowerCase()
      out = out.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          (i.tags || []).some(t => t.toLowerCase().includes(q))
      )
    }
    if (onlyFavs) out = out.filter(i => !!i.isFavorite)
    if (ownerFilter === 'mine') out = out.filter(i => i.isMine)
    if (ownerFilter === 'default') out = out.filter(i => !i.isMine)

    out.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'popular') return (b.favorites ?? 0) - (a.favorites ?? 0)
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      )
    })
    return out
  }, [data, query, onlyFavs, sort, ownerFilter])

  function isSelected(id: string) {
    return selected[id] !== undefined
  }

  function toggleSelect(l: Lora) {
    setSelected(prev => {
      const already = prev[l.id] !== undefined
      if (!already && Object.keys(prev).length >= MAX_SELECTED) {
        toast.error(`You can select up to ${MAX_SELECTED} LoRAs.`)
        return prev
      }
      const next = { ...prev }
      if (already) delete next[l.id]
      else next[l.id] = 0.5
      onSelectedChange?.(Object.entries(next).map(([id, strength]) => ({ id, strength })))
      return next
    })
  }

  function setStrength(id: string, v: number) {
    setSelected(prev => {
      const next = { ...prev, [id]: v }
      onSelectedChange?.(Object.entries(next).map(([lid, strength]) => ({ id: lid, strength })))
      return next
    })
  }

  // when opening details
  function openDetails(l: Lora) {
    setDetailsItem(l)
    setGalleryIndex(0)           // <-- reset to first image
    setDetailsOpen(true)
    onOpenDetails?.(l)
  }

  useEffect(() => {
    if (!detailsOpen || !detailsItem) return
    const gallery = [
      ...(detailsItem.previewUrl ? [detailsItem.previewUrl] : []),
      ...(detailsItem.sampleUrls || [])
    ]
    const onKey = (e: KeyboardEvent) => {
      if (!gallery.length) return
      if (e.key === 'ArrowLeft')  setGalleryIndex(i => (i + gallery.length - 1) % gallery.length)
      if (e.key === 'ArrowRight') setGalleryIndex(i => (i + 1) % gallery.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailsOpen, detailsItem])  

  return (
    <section className={styles.wrap} aria-label="LoRA Picker">
      {/* Manage link */}
      <div className={styles.headerRow}>
        <a href="/image/lora-lib" className={styles.secondaryBtn}>
          Manage LoRAs →
        </a>

        {/* View toggle */}
        <div className={styles.headerActions}>
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
        </div>
      </div>

      {/* Strength banner (single label for all selected) */}
      {selectedCount > 0 && (
        <div className={styles.selectedBanner} aria-live="polite">
          <span className={styles.strengthHelp}>
            Adjust LoRA strength — default values are optimal.
          </span>
          <span className={styles.selectedCount}>
            {selectedCount}/{MAX_SELECTED} selected
          </span>
        </div>
      )}

      {/* Selected tray */}
      {selectedCount > 0 && (
        <div className={styles.selectedTray}>
          {Object.keys(selected).map(id => {
            const l = data.find(d => d.id === id)
            if (!l) return null
            const strength = selected[id]
            return (
              <div key={id} className={styles.selectedPill}>
                <div className={styles.selectedInfo}>
                  <img
                    className={styles.selectedThumb}
                    src={l.previewUrl}
                    alt={l.name}
                  />
                  <span className={styles.selectedName}>{l.name}</span>
                </div>

                {/* just controls here; label is shown once above */}
                <div className={styles.strengthControls}>
                  <input
                    className={styles.selectedRange}
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={strength}
                    onChange={e => setStrength(id, parseFloat(e.target.value))}
                  />
                  <span className={styles.selectedVal}>{strength.toFixed(2)}</span>
                </div>

                <button
                  className={styles.iconBtn}
                  onClick={() => toggleSelect(l)}
                  aria-label="Remove from selection"
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search className={styles.searchIcon} size={16} />
          <input
            className={styles.searchInput}
            placeholder="search name or tag…"
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

          {/* Owner filter */}
          <span className={styles.chipsDivider} aria-hidden="true">|</span>
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

        {limitReached && (
          <div className={styles.limitNote} role="status">
            Selection limit reached ({selectedCount}/{MAX_SELECTED}). Unselect one to add another.
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.contentWrap}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <Info size={18} />
            <span>No LoRAs found. Try a different search.</span>
          </div>
        ) : view === 'grid' ? (
          <div className={styles.grid}>
            {filtered.map(l => {
              const sel = isSelected(l.id)
              const disableSelect = !sel && limitReached
              return (
                <article
                  key={l.id}
                  className={cn(styles.card, sel && styles.cardSelected)}
                >
                  <div className={styles.cardMedia} onClick={() => openDetails(l)}>
                    {l.previewUrl ? (
                      <img src={l.previewUrl} alt={l.name} />
                    ) : (
                      <div className={styles.noPreview}>No preview</div>
                    )}
                    {sel && (
                      <div className={styles.selectedBadge}>
                        <Check size={14} />
                      </div>
                    )}
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
                          data-tooltip={
                            sel ? 'Unselect' : (disableSelect ? `Limit ${MAX_SELECTED} reached` : 'Select')
                          }
                        >
                          <button
                            className={styles.iconBtn}
                            onClick={() => toggleSelect(l)}
                            aria-pressed={sel}
                            aria-label={sel ? 'Unselect' : 'Select'}
                            type="button"
                            disabled={disableSelect}
                          >
                            {sel ? '✓' : '+'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.tagsRow}>
                      {(l.tags || []).slice(0, 4).map(t => (
                        <span key={t} className={styles.tagChip}>#{t}</span>
                      ))}
                    </div>

                    <div className={styles.footerRow}>
                      <span className={styles.muted}>Added {timeAgo(l.createdAt)}</span>
                      {!!l.favorites && (
                        <span className={styles.muted}>{l.favorites} favs</span>
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
              const sel = isSelected(l.id)
              const disableSelect = !sel && limitReached
              return (
                <article
                  key={l.id}
                  className={cn(styles.row, sel && styles.cardSelected)}
                  onClick={() => openDetails(l)}
                >
                  <div className={styles.rowThumb}>
                    {l.previewUrl ? (
                      <img src={l.previewUrl} alt={l.name} />
                    ) : (
                      <div className={styles.noPreview}>No preview</div>
                    )}
                  </div>

                  <div className={styles.rowMain}>
                    <div className={styles.rowTop}>
                      <div className={styles.rowTitleWrap}>
                        <h3 className={styles.rowTitle}>{l.name}</h3>
                        <div className={styles.rowSub}>
                          {(l.tags || []).map(t => `#${t}`).join(' ')}
                        </div>
                      </div>
                      <div
                        className={styles.rowActions}
                        onClick={e => e.stopPropagation()}
                      >
                        <div
                          className={styles.tooltipWrapper}
                          data-tooltip={
                            sel ? 'Unselect' : (disableSelect ? `Limit ${MAX_SELECTED} reached` : 'Select')
                          }
                        >
                          <button
                            className={styles.iconBtn}
                            onClick={() => toggleSelect(l)}
                            aria-pressed={sel}
                            aria-label={sel ? 'Unselect' : 'Select'}
                            type="button"
                            disabled={disableSelect}
                          >
                            {sel ? '✓' : '+'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.rowBottom}>
                      <div className={styles.rowMetaRight}>
                        <span className={styles.muted}>Added {timeAgo(l.createdAt)}</span>
                        {!!l.favorites && (
                          <span className={styles.muted}>{l.favorites} favs</span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* Details (read-only, select only) */}
      {detailsOpen && detailsItem && (
      <div className={styles.drawerBackdrop} onClick={() => setDetailsOpen(false)}>
        <div className={styles.drawer} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className={styles.drawerHeader}>
            <h3 className={styles.drawerTitle}>{detailsItem.name}</h3>
            <button className={styles.iconBtn} onClick={() => setDetailsOpen(false)} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className={styles.drawerBody}>
            {/* --- Carousel media (preview + sampleUrls) --- */}
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
                        <button
                          className={`${styles.carouselBtn} ${styles.carouselBtnLeft}`}
                          onClick={() => setGalleryIndex(i => (i + gallery.length - 1) % gallery.length)}
                          aria-label="Previous image"
                          type="button"
                        >
                          <ChevronLeft size={18} />
                        </button>

                        <button
                          className={`${styles.carouselBtn} ${styles.carouselBtnRight}`}
                          onClick={() => setGalleryIndex(i => (i + 1) % gallery.length)}
                          aria-label="Next image"
                          type="button"
                        >
                          <ChevronRight size={18} />
                        </button>

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

            {/* Thumbnails (if multiple) */}
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
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>Added</div>
                  <div className={styles.infoValue}>{timeAgo(detailsItem.createdAt)}</div>
                </div>
                <div className={styles.infoCard}>
                  <div className={styles.infoLabel}>Favourites</div>
                  <div className={styles.infoValue}>{detailsItem.favorites ?? 0}</div>
                </div>
              </div>

              {(detailsItem.tags?.length ?? 0) > 0 && (
                <div className={styles.drawerTags}>
                  {detailsItem.tags!.map(t => (
                    <span key={t} className={styles.tagChip}>#{t}</span>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.drawerFooter}>
              {isSelected(detailsItem.id) ? (
                <>
                  <div className={styles.strengthGroup}>
                    <span className={styles.strengthHelp}>
                      Adjust LoRA strength — default values are optimal.
                    </span>
                    <div className={styles.strengthControls}>
                      <input
                        className={styles.selectedRange}
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={selected[detailsItem.id]}
                        onChange={e => setStrength(detailsItem.id, parseFloat(e.target.value))}
                      />
                      <span className={styles.selectedVal}>
                        {selected[detailsItem.id].toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.flexGrow} />
                  <button
                    className={styles.secondaryBtn}
                    onClick={() => toggleSelect(detailsItem)}
                    type="button"
                  >
                    Unselect
                  </button>
                </>
              ) : (
                <button
                  className={styles.primaryBtn}
                  onClick={() => toggleSelect(detailsItem)}
                  type="button"
                  disabled={limitReached}
                  title={limitReached ? `Limit ${MAX_SELECTED} reached` : undefined}
                >
                  Select for use
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
