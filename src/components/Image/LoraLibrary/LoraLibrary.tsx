// src/components/Image/LoraLibrary/LoraLibrary.tsx
import { useEffect, useMemo, useState } from 'react'
import styles from './LoraLibrary.module.css'
import {
  Search, Star, StarOff, Plus, X, Pencil, Trash2,
  Download, RefreshCcw, Grid, List, Info, ChevronLeft, ChevronRight
} from 'lucide-react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import AddLoRa, { type AddLoRaPayload } from './AddLoRa'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

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
  /** flag to distinguish user's LoRAs from defaults */
  isMine?: boolean
  trigger?: string
  recommendedStrength?: number | null
}

/** Component API — can be controlled externally, but self-wires to backend if not provided */
export type LoraLibraryProps = {
  items?: Lora[]
  isLoading?: boolean
  onRefresh?: () => Promise<void> | void
  onToggleFavorite?: (id: string, next: boolean) => Promise<void> | void
  onRename?: (id: string, nextName: string) => Promise<void> | void
  onDelete?: (ids: string[]) => Promise<void> | void
  onDownload?: (id: string) => Promise<void> | void
  onOpenDetails?: (lora: Lora) => void
}

function cn(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ')
}

function formatSizeMB(n?: number) {
  if (n === undefined || n === null || Number.isNaN(n)) return '—'
  if (n >= 1024) return `${(n / 1024).toFixed(2)} GB`
  if (n >= 10) return `${Math.round(n)} MB`
  return `${n.toFixed(1)} MB`
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

type Branch = 'krea' | 'kontext' | 'fill'
const BRANCHES: Branch[] = ['krea', 'kontext', 'fill']

const IMAGE_ENGINE_BASE_BY_BRANCH: Record<Branch, string | undefined> = {
  krea: import.meta.env.VITE_IMAGE_KREA_ENGINE_API_BASE_URL,
  kontext: import.meta.env.VITE_IMAGE_KONTEXT_ENGINE_API_BASE_URL,
  fill: import.meta.env.VITE_IMAGE_FILL_ENGINE_API_BASE_URL,
}

function getEngineBaseForBranch(branch: Branch): string | null {
  const raw = IMAGE_ENGINE_BASE_BY_BRANCH[branch]
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

function getErrorDetail(err: any): string | null {
  const d = err?.response?.data
  if (!d) return null
  if (typeof d === 'string') return d
  if (typeof d?.detail === 'string') return d.detail
  if (typeof d?.error === 'string') return d.error
  return null
}

function extractFilenameFromContentDisposition(cd?: string | null): string | null {
  if (!cd) return null
  const m = /filename\*?=(?:UTF-8'')?("?)([^";]+)\1/i.exec(cd)
  if (!m) return null
  try {
    return decodeURIComponent(m[2])
  } catch {
    return m[2]
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}

export default function LoraLibrary({
  items,
  isLoading,
  onRefresh,
  onToggleFavorite,
  onRename,
  onDelete,
  onDownload,
  onOpenDetails
}: LoraLibraryProps) {
  // Local backing store when parent does not pass `items`
  const [remoteItems, setRemoteItems] = useState<Lora[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const data = items ?? remoteItems
  const effectiveLoading = isLoading ?? loading

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

  // engine status per-branch
  const [engineOnlineByBranch, setEngineOnlineByBranch] = useState<Record<Branch, boolean>>({
    krea: false,
    kontext: false,
    fill: false,
  })

  const anyEngineOnline = Object.values(engineOnlineByBranch).some(Boolean)

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

  function startImageEngineKeepAlive() {
    if (!API_BASE_URL) return undefined

    const base = API_BASE_URL.replace(/\/+$/, '')
    let cancelled = false
    let timer: number | undefined
    let activeBranch: Branch | null = null

    async function detectOnlineBranch(): Promise<Branch | null> {
      for (const branch of BRANCHES) {
        try {
          const res = await fetch(`${base}/images/${branch}/runpod-status/`, {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          })
          if (!res.ok) continue
          const data = await res.json()
          if (data?.online) return branch
        } catch {
          // ignore
        }
      }
      return null
    }

    const tick = async () => {
      if (cancelled) return
      try {
        if (!activeBranch) {
          activeBranch = await detectOnlineBranch()
          if (!activeBranch) {
            if (!cancelled) timer = window.setTimeout(tick, 15_000) as unknown as number
            return
          }
        }

        const engineBase = getEngineBaseForBranch(activeBranch)
        if (!engineBase) {
          activeBranch = null
          if (!cancelled) timer = window.setTimeout(tick, 60_000) as unknown as number
          return
        }

        await fetch(`${engineBase}/image/poll-activity/`, {
          method: 'POST',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          keepalive: true,
        })
      } catch {
        activeBranch = null
      } finally {
        if (!cancelled) timer = window.setTimeout(tick, 60_000) as unknown as number
      }
    }

    tick()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }

  // -------- Backend wiring (defaults) --------

  async function fetchLoras() {
    if (items) return
    try {
      setLoading(true)
      setError(null)
      const res = await axios.get<Lora[]>(`${API_BASE_URL}/images/loras/`, {
        withCredentials: true
      })
      setRemoteItems(res.data)
    } catch (err) {
      console.error('Failed to load LoRAs', err)
      setError('Failed to load LoRAs')
      toast.error('Failed to load LoRAs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLoras()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function defaultRefresh() {
    await fetchLoras()
    toast.success('LoRAs refreshed')
  }

  async function defaultToggleFavorite(id: string, next: boolean) {
    try {
      await axios.post(
        `${API_BASE_URL}/images/loras/${id}/favorite/`,
        { is_favorite: next },
        { withCredentials: true }
      )
      toast.success(next ? 'Added to favourites' : 'Removed from favourites')
      fetchLoras()
    } catch (err) {
      console.error('Failed to toggle favorite', err)
      toast.error('Failed to update favourite')
    }
  }

  async function defaultRename(id: string, nextName: string) {
    try {
      await axios.patch(
        `${API_BASE_URL}/images/loras/${id}/`,
        { name: nextName },
        { withCredentials: true }
      )
      setRemoteItems(prev =>
        prev.map(l => (l.id === id ? { ...l, name: nextName } : l))
      )
      toast.success('LoRA renamed')
    } catch (err) {
      console.error('Failed to rename LoRA', err)
      toast.error('Failed to rename LoRA')
    }
  }

  async function defaultDelete(ids: string[]) {
    // ✅ gate like AddLoRa: if all engines offline, don't even try
    if (!anyEngineOnline) {
      toast.error('Image engine offline')
      return
    }

    const toastId = toast.loading(ids.length === 1 ? 'Deleting LoRA…' : 'Deleting LoRAs…')
    try {
      if (ids.length === 1) {
        await axios.delete(`${API_BASE_URL}/images/loras/${ids[0]}/`, {
          withCredentials: true
        })
      } else if (ids.length > 1) {
        await axios.post(
          `${API_BASE_URL}/images/loras/bulk-delete/`,
          { ids },
          { withCredentials: true }
        )
      }

      setRemoteItems(prev => prev.filter(l => !ids.includes(l.id)))
      toast.dismiss(toastId)
      toast.success(ids.length === 1 ? 'LoRA deleted' : 'LoRAs deleted')
    } catch (err: any) {
      console.error('Failed to delete LoRAs', err)
      toast.dismiss(toastId)

      const status = err?.response?.status
      const detail = getErrorDetail(err)

      if (status === 503) toast.error(detail || 'All image engines offline. Try again.')
      else if (status === 502) toast.error(detail || 'Engine refused delete. Check engine logs.')
      else toast.error(detail || 'Failed to delete LoRA(s)')
    }
  }

  async function defaultDownload(id: string) {
    // ✅ gate like AddLoRa: if all engines offline, don't even try
    if (!anyEngineOnline) {
      toast.error('Image engine offline')
      return
    }

    const toastId = toast.loading('Preparing download…')
    try {
      // ✅ backend streams file on POST /download/
      const res = await axios.post(
        `${API_BASE_URL}/images/loras/${id}/download/`,
        {},
        {
          withCredentials: true,
          responseType: 'blob',
          // important: allow axios to accept 200 only
          validateStatus: s => (s >= 200 && s < 300) || s === 502 || s === 503,
        }
      )

      if (res.status === 503) {
        toast.dismiss(toastId)
        toast.error('All image engines offline. Try again.')
        return
      }

      if (res.status === 502) {
        toast.dismiss(toastId)
        toast.error('Engine refused download. Check engine logs.')
        return
      }

      const cd = res.headers?.['content-disposition'] as string | undefined
      const filename = extractFilenameFromContentDisposition(cd) || `lora-${id}.safetensors`

      const blob = res.data as Blob
      downloadBlob(blob, filename)

      toast.dismiss(toastId)
      toast.success('Download started')
    } catch (err: any) {
      console.error('Failed to download LoRA', err)
      toast.dismiss(toastId)

      const status = err?.response?.status
      const detail = getErrorDetail(err)

      if (status === 503) toast.error(detail || 'All image engines offline. Try again.')
      else if (status === 502) toast.error(detail || 'Engine refused download. Check engine logs.')
      else toast.error(detail || 'Failed to download')
    }
  }

  // --- Wire AddLoRa modal upload/train views WITH TOASTS ---
  async function handleAddLoRaFromModal(payload: AddLoRaPayload): Promise<boolean> {
    if (!API_BASE_URL) {
      toast.error('API base URL not set')
      return false
    }

    const base = API_BASE_URL.replace(/\/+$/, '')

    const loadingMsg =
      payload.mode === 'upload'
        ? 'Uploading LoRA…'
        : 'Creating LoRA and starting training…'

    const successMsg =
      payload.mode === 'upload'
        ? 'LoRA uploaded successfully'
        : 'Training started for LoRA'

    const toastId = toast.loading(loadingMsg)
    const stopKeepAlive = startImageEngineKeepAlive()

    try {
      if (payload.mode === 'upload') {
        const form = new FormData()
        form.append('name', payload.name)
        form.append('type', payload.type)
        payload.tags.forEach(tg => form.append('tags', tg))
        form.append('file', payload.file, payload.file.name)
        payload.previews?.forEach(p => form.append('previews', p, p.name))

        if ((payload as any).trigger) form.append('trigger', String((payload as any).trigger))
        const rs = (payload as any).recommendedStrength
        if (rs !== undefined && rs !== null && String(rs).trim() !== '') {
          form.append('recommendedStrength', String(rs))
        }

        const res = await axios.post<Lora>(
          `${base}/images/loras/upload/`,
          form,
          {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        )

        const created = res.data
        setRemoteItems(prev => [created, ...prev])
      } else {
        const createRes = await axios.post<Lora>(
          `${base}/images/loras/`,
          {
            name: payload.name,
            type: payload.type,
            tags: payload.tags,
            trigger: payload.trigger,
            recommendedStrength: payload.recommendedStrength ?? null,
          },
          { withCredentials: true }
        )

        const created = createRes.data

        const trainForm = new FormData()
        if (payload.trigger) trainForm.append('trigger', payload.trigger)
        trainForm.append('repeat_per_image', String(payload.repeatPerImage))
        trainForm.append('max_epochs', String(payload.maxEpochs))
        trainForm.append('estimated_steps', String(payload.estimatedSteps))

        payload.images.forEach((img, idx) => {
          trainForm.append('images', img.file, img.file.name)
          if (img.caption) trainForm.append(`captions[${idx}]`, img.caption)
        })

        await axios.post(
          `${base}/images/loras/${created.id}/train/`,
          trainForm,
          {
            withCredentials: true,
            headers: { 'Content-Type': 'multipart/form-data' },
          }
        )

        setRemoteItems(prev => [created, ...prev])
      }

      toast.dismiss(toastId)
      toast.success(successMsg)
      return true
    } catch (err: any) {
      console.error('Failed to add/train LoRA', err)
      toast.dismiss(toastId)
      const fallback =
        payload.mode === 'upload'
          ? 'Failed to upload LoRA'
          : 'Failed to create/train LoRA'
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        fallback
      toast.error(msg)
      return false
    } finally {
      if (typeof stopKeepAlive === 'function') stopKeepAlive()
    }
  }

  // -------- Engine status polling (checks ALL branches) --------
  useEffect(() => {
    if (!API_BASE_URL) return

    const base = API_BASE_URL.replace(/\/+$/, '')
    let cancelled = false
    let tick: number | undefined
    const controller = new AbortController()

    const poll = async () => {
      try {
        const results = await Promise.all(
          BRANCHES.map(async (branch) => {
            try {
              const res = await fetch(`${base}/images/${branch}/runpod-status/`, {
                cache: 'no-store',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
              })
              if (!res.ok) throw new Error(String(res.status))
              const data = await res.json()
              return { branch, online: !!data?.online }
            } catch {
              return { branch, online: false }
            }
          })
        )

        if (!controller.signal.aborted) {
          setEngineOnlineByBranch(prev => {
            const next = { ...prev }
            for (const r of results) next[r.branch] = r.online
            return next
          })
        }
      } finally {
        if (!cancelled) tick = window.setTimeout(poll, 2500) as unknown as number
      }
    }

    poll()

    return () => {
      cancelled = true
      if (tick) window.clearTimeout(tick)
      controller.abort()
    }
  }, [])

  // -------- UI handlers --------

  function toggleSelected(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleRefreshAndClear() {
    setActiveTags([])
    if (onRefresh) {
      onRefresh()
      toast.success('LoRAs refreshed')
    } else {
      defaultRefresh()
    }
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

  async function handleFavorite(l: Lora) {
    const next = !effectiveFav(l)
    pulseFav(l.id)
    setFavOverrides(prev => ({ ...prev, [l.id]: next }))

    if (onToggleFavorite) await onToggleFavorite(l.id, next)
    else await defaultToggleFavorite(l.id, next)
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function openDetails(l: Lora) {
    setDetailsItem(l)
    setGalleryIndex(0)
    setDetailsOpen(true)
    onOpenDetails?.(l)
  }

  async function handleDelete(ids: string[]) {
    if (!anyEngineOnline) {
      toast.error('Image engine offline')
      return
    }

    if (onDelete) {
      await onDelete(ids)
      toast.success(ids.length === 1 ? 'LoRA deleted' : 'LoRAs deleted')
    } else {
      await defaultDelete(ids)
    }
    clearSelection()
  }

  async function handleDownload(id: string) {
    if (!anyEngineOnline) {
      toast.error('Image engine offline')
      return
    }

    if (onDownload) await onDownload(id)
    else await defaultDownload(id)
  }

  function handleUseSelected() {
    const ids = Array.from(selected).slice(0, MAX_USE)
    try {
      sessionStorage.setItem('image.selectedLoras', JSON.stringify(ids))
      toast.success('LoRAs applied to Image page')
    } catch {
      // ignore
    }
    window.location.href = '/image'
  }

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

  const galleryFor = (l: Lora) => {
    const all = [
      ...(l.previewUrl ? [l.previewUrl] : []),
      ...(l.sampleUrls || []),
    ]
    const seen = new Set<string>()
    return all.filter(url => {
      if (!url || seen.has(url)) return false
      seen.add(url)
      return true
    })
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.engineStatusInline} ${anyEngineOnline ? styles.onlineStatus : ''}`}>
        <span className={`${styles.statusDot} ${anyEngineOnline ? styles.online : styles.offline}`} />
        <span className={styles.engineStatusText}>
          Image engine {anyEngineOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className={styles.wrap} data-view={view}>
        <div className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>LoRA Library</h2>
            <div className={styles.subtitle}>Browse through our collection of LoRAs.</div>
          </div>
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

            <button className={styles.primaryBtn} onClick={() => setAddOpen(true)} type="button">
              <Plus size={16} /> Add LoRA
            </button>
          </div>
        </div>

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
            <button className={cn(styles.chip, sort === 'recent' && styles.chipActive)} onClick={() => setSort('recent')} type="button">
              Recent
            </button>
            <button className={cn(styles.chip, sort === 'popular' && styles.chipActive)} onClick={() => setSort('popular')} type="button">
              Popular
            </button>
            <button className={cn(styles.chip, sort === 'name' && styles.chipActive)} onClick={() => setSort('name')} type="button">
              A–Z
            </button>

            <div className={styles.tooltipWrapper} data-tooltip={onlyFavs ? 'Showing favourites' : 'Show favourites'}>
              <button className={cn(styles.chip, onlyFavs && styles.chipActive)} onClick={() => setOnlyFavs(v => !v)} aria-pressed={onlyFavs} type="button">
                <Star size={14} />
                <span>Favourites</span>
              </button>
            </div>

            <span className={styles.muted} style={{ opacity: .5, padding: '0 .25rem' }} aria-hidden="true">|</span>

            <button className={cn(styles.chip, ownerFilter === 'all' && styles.chipActive)} onClick={() => setOwnerFilter('all')} type="button">
              All
            </button>
            <button className={cn(styles.chip, ownerFilter === 'mine' && styles.chipActive)} onClick={() => setOwnerFilter('mine')} type="button">
              My LoRAs
            </button>
            <button className={cn(styles.chip, ownerFilter === 'default' && styles.chipActive)} onClick={() => setOwnerFilter('default')} type="button">
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
                    setActiveTags(prev => (active ? prev.filter(x => x !== t) : [...prev, t]))
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
                <button className={styles.primaryBtn} onClick={handleUseSelected} type="button" title={`Use up to ${MAX_USE} selected`}>
                  Use ({Math.min(selected.size, MAX_USE)}/{MAX_USE})
                </button>

                <button className={styles.dangerBtn} onClick={() => handleDelete(Array.from(selected))} type="button">
                  <Trash2 size={16} /> Delete ({selected.size})
                </button>

                <button className={styles.secondaryBtn} onClick={clearSelection} type="button">
                  Clear
                </button>
              </>
            ) : (
              <div className={styles.tooltipWrapper} data-tooltip="Refresh" aria-label="Refresh and clear all selected tags">
                <button className={`${styles.iconBtn} ${styles.iconBtnGhost}`} onClick={handleRefreshAndClear} type="button">
                  <RefreshCcw size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.contentWrap}>
          {effectiveLoading ? (
            <div className={styles.loading}>Loading…</div>
          ) : error ? (
            <div className={styles.empty}>
              <Info size={18} />
              <div>{error}</div>
            </div>
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
                  <article key={l.id} className={cn(styles.card, selected.has(l.id) && styles.cardSelected)}>
                    <div className={styles.cardMedia} onClick={() => openDetails(l)}>
                      {primary ? <img src={primary} alt={l.name} /> : <div className={styles.noPreview}>No preview</div>}

                      <button
                        className={cn(
                          styles.favBtn,
                          fav && styles.favActive,
                          favPulsing.has(l.id) && styles.favPulse
                        )}
                        onClick={e => { e.stopPropagation(); handleFavorite(l); }}
                        title={fav ? 'Unfavorite' : 'Favorite'}
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

                    <div className={styles.cardBody}>
                      <div className={styles.cardTitleRow}>
                        <h3 className={styles.cardTitle} title={l.name} onClick={() => openDetails(l)}>{l.name}</h3>

                        <div className={styles.menu}>
                          <div className={styles.tooltipWrapper} data-tooltip={selected.has(l.id) ? 'Unselect' : 'Select'}>
                            <button className={styles.iconBtn} onClick={() => toggleSelected(l.id)} aria-pressed={selected.has(l.id)} aria-label={selected.has(l.id) ? 'Unselect' : 'Select'} type="button">
                              ✓
                            </button>
                          </div>

                          <div className={styles.tooltipWrapper} data-tooltip="Rename">
                            <button className={styles.iconBtn} onClick={() => promptRename(l, onRename ?? defaultRename)} aria-label="Rename" type="button">
                              <Pencil size={16} />
                            </button>
                          </div>

                          <div className={styles.tooltipWrapper} data-tooltip="Download">
                            <button className={styles.iconBtn} onClick={() => handleDownload(l.id)} aria-label="Download" type="button">
                              <Download size={16} />
                            </button>
                          </div>

                          <div className={styles.tooltipWrapper} data-tooltip="Delete">
                            <button className={styles.iconBtnDanger} onClick={() => handleDelete([l.id])} aria-label="Delete" type="button">
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
                        {!!l.downloads && <span className={styles.muted}>{l.downloads} downloads</span>}
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
                  <article key={l.id} className={cn(styles.row, selected.has(l.id) && styles.cardSelected)} onClick={() => openDetails(l)}>
                    <div className={styles.rowThumb}>
                      {primary ? <img src={primary} alt={l.name} /> : <div className={styles.noPreview}>No preview</div>}
                    </div>

                    <div className={styles.rowMain}>
                      <div className={styles.rowTop}>
                        <div className={styles.rowTitleWrap}>
                          <h3 className={styles.rowTitle}>{l.name}</h3>
                          <div className={styles.rowSub}>{l.author || 'Unknown'}</div>
                        </div>

                        <div className={styles.rowActions} onClick={e => e.stopPropagation()}>
                          <div className={styles.tooltipWrapper} data-tooltip={selected.has(l.id) ? 'Unselect' : 'Select'}>
                            <button className={styles.iconBtn} onClick={() => toggleSelected(l.id)} aria-pressed={selected.has(l.id)} aria-label={selected.has(l.id) ? 'Unselect' : 'Select'} type="button">
                              ✓
                            </button>
                          </div>

                          <div className={styles.tooltipWrapper} data-tooltip={fav ? 'Unfavorite' : 'Favorite'}>
                            <button
                              className={cn(styles.iconBtn, fav && styles.favActiveBtn, favPulsing.has(l.id) && styles.favPulseBtn)}
                              onClick={() => handleFavorite(l)}
                              aria-label={fav ? 'Unfavorite' : 'Favorite'}
                              type="button"
                            >
                              {fav ? <Star size={16} className={cn(styles.favIcon, styles.favIconFilled)} /> : <StarOff size={16} className={styles.favIcon} />}
                            </button>
                          </div>

                          <div className={styles.tooltipWrapper} data-tooltip="Rename">
                            <button className={styles.iconBtn} onClick={() => promptRename(l, onRename ?? defaultRename)} aria-label="Rename" type="button">
                              <Pencil size={16} />
                            </button>
                          </div>

                          <div className={styles.tooltipWrapper} data-tooltip="Download">
                            <button className={styles.iconBtn} onClick={() => handleDownload(l.id)} aria-label="Download" type="button">
                              <Download size={16} />
                            </button>
                          </div>

                          <div className={styles.tooltipWrapper} data-tooltip="Delete">
                            <button className={styles.iconBtnDanger} onClick={() => handleDelete([l.id])} aria-label="Delete" type="button">
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

        {detailsOpen && detailsItem && (
          <div className={styles.drawerBackdrop} onClick={() => setDetailsOpen(false)}>
            <div className={styles.drawer} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className={styles.drawerHeader}>
                <h3 className={styles.drawerTitle}>{detailsItem.name}</h3>
                <button className={styles.iconBtn} onClick={() => setDetailsOpen(false)} aria-label="Close" type="button">
                  <X size={18} />
                </button>
              </div>

              <div className={styles.drawerBody}>
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
                                onClick={() => setGalleryIndex(i => (i + gallery.length - 1) % gallery.length)}
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
                  <InfoStat
                    label="Trigger"
                    value={(detailsItem.trigger?.trim() ? detailsItem.trigger : '—') as string}
                  />
                  <InfoStat
                    label="Strength"
                    value={
                      detailsItem.recommendedStrength === null ||
                      detailsItem.recommendedStrength === undefined
                        ? '—'
                        : String(detailsItem.recommendedStrength)
                    }
                  />
                </div>

                <div className={styles.drawerTags}>
                  {(detailsItem.tags || []).map(t => (
                    <span key={t} className={styles.tagChip}>#{t}</span>
                  ))}
                </div>
              </div>

              <div className={styles.drawerFooter}>
                <button className={styles.secondaryBtn} onClick={() => promptRename(detailsItem, onRename ?? defaultRename)} type="button">
                  <Pencil size={16} /> Rename
                </button>

                <button className={styles.secondaryBtn} onClick={() => handleDownload(detailsItem.id)} type="button">
                  <Download size={16} /> Download
                </button>

                <div className={styles.flexGrow} />

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

        {addOpen && (
          <AddLoRa
            onClose={() => setAddOpen(false)}
            onSubmit={async payload => {
              const ok = await handleAddLoRaFromModal(payload)
              if (ok) setAddOpen(false)
            }}
            branch="krea"
            engineOnline={engineOnlineByBranch.krea}
            onEngineOnlineChange={(branch, online) => {
              setEngineOnlineByBranch(prev => ({ ...prev, [branch]: online }))
            }}
          />
        )}
      </div>
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
