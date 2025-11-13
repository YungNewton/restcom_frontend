// src/components/Image/Image.tsx
import { useEffect, useRef, useState, useTransition, useCallback } from 'react'
import NavTabs from '../NavTabs/NavTabs'
import styles from './Image.module.css'
import { toast } from 'react-hot-toast'
import TextToImage from './TextToImage/TextToImage'
import ImageToImage from './ImageToImage/ImageToImage'
import Inpaint from './Inpaint/Inpaint'
import GeneralSettings, { type GeneralSettingsState } from './Right/Settings/Settings'
import LoraLibrary from './Right/LoraLibrary/LoraLibrary'

const API_BASE = import.meta.env.VITE_API_BASE_URL
const KREA_ENGINE_BASE = import.meta.env.VITE_IMAGE_KREA_ENGINE_API_BASE_URL
const KONTEXT_ENGINE_BASE = import.meta.env.VITE_IMAGE_KONTEXT_ENGINE_API_BASE_URL
const FILL_ENGINE_BASE = import.meta.env.VITE_IMAGE_FILL_ENGINE_API_BASE_URL

type ActiveTab = 't2i' | 'i2i' | 'inpaint'
type RightTab = 'settings' | 'loraLibrary'

const MAX_SELECTED = 3

type Branch = 'krea' | 'kontext' | 'fill'

const TAB_TO_BRANCH: Record<ActiveTab, Branch> = {
  t2i: 'krea',
  i2i: 'kontext',
  inpaint: 'fill',
}

const BRANCH_TO_ENGINE_LABEL: Record<Branch, string> = {
  krea: 'Image engine',
  kontext: 'Img-to-Img engine',
  fill: 'Inpaint engine',
}

const ENGINE_BASE_BY_BRANCH: Record<Branch, string | undefined> = {
  krea: KREA_ENGINE_BASE,
  kontext: KONTEXT_ENGINE_BASE,
  fill: FILL_ENGINE_BASE,
}

const QUEUE_ROUTE = '/image/image/generate/'
const STATUS_ROUTE = (taskId: string) => `/image/image/task-status/${taskId}`
const CANCEL_ROUTE = '/image/image/cancel/'

type TaskMeta = {
  taskId: string
  seed?: number
  steps?: number
  cfg?: number
  width?: number
  height?: number
  format?: string
}

type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE'

export type Slot = {
  branch: Branch
  taskId: string
  status: TaskStatus
  url?: string
  meta: TaskMeta
}

function normalizeBase(url?: string) {
  if (!url) return ''
  return url.replace(/\/+$/, '')
}

const Image = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('t2i')
  const [isPending, startTransition] = useTransition()

  const branch: Branch = TAB_TO_BRANCH[activeTab]

  // Keep per-branch online state so switching tabs feels instant (no flicker)
  const [onlineByBranch, setOnlineByBranch] = useState<Record<Branch, boolean>>({
    krea: false,
    kontext: false,
    fill: false,
  })
  const engineOnline = onlineByBranch[branch]

  // Allow children to flip a branch online/offline immediately (e.g., after start)
  const setBranchOnline = useCallback((b: Branch, online: boolean) => {
    setOnlineByBranch(prev => (prev[b] === online ? prev : { ...prev, [b]: online }))
    prevOnlineRef.current[b] = online
  }, [])

  // Remember previous online state per-branch to control toast transitions
  const prevOnlineRef = useRef<Record<Branch, boolean>>({
    krea: false,
    kontext: false,
    fill: false,
  })

  // Track selected LoRAs from the right-side library (id + strength)
  const [activeLoras, setActiveLoras] = useState<Array<{ id: string; strength: number }>>([])
  const selectedLoraCount = activeLoras.length

  // Right panel tabs (Settings | LoRA Library)
  const [activeRightTab, setActiveRightTab] = useState<RightTab>('settings')
  const tabsRef = {
    settings: useRef<HTMLButtonElement>(null),
    loraLibrary: useRef<HTMLButtonElement>(null),
  }
  const [indicatorLeft, setIndicatorLeft] = useState('0px')
  const [indicatorWidth, setIndicatorWidth] = useState('0px')

  useEffect(() => {
    const ref = tabsRef[activeRightTab]
    if (ref.current) {
      setIndicatorLeft(ref.current.offsetLeft + 'px')
      setIndicatorWidth(ref.current.offsetWidth + 'px')
    }
  }, [activeRightTab])

  // Shared settings used by all branches
  const [settings, setSettings] = useState<GeneralSettingsState>({
    width: 768,
    height: 1024,
    steps: 28,
    cfg: 4.0,
    batch: 1,
    seed: '',
    outFormat: 'png',
  })

  /* ───────── Central task store ───────── */

  const [slotsByBranch, setSlotsByBranch] = useState<Record<Branch, Slot[]>>({
    krea: [],
    kontext: [],
    fill: [],
  })

  const [isGeneratingByBranch, setIsGeneratingByBranch] = useState<Record<Branch, boolean>>({
    krea: false,
    kontext: false,
    fill: false,
  })

  // Per-task abort controllers (for polling)
  const pollControllersRef = useRef<Record<string, AbortController>>({})
  // Per-task stop flags
  const stopPollingRef = useRef<Record<string, boolean>>({})
  // Track blob URLs for cleanup
  const blobUrlsRef = useRef<Set<string>>(new Set())

  // Cleanup on unmount – abort polling + revoke blobs
  useEffect(() => {
    return () => {
      Object.values(pollControllersRef.current).forEach(c => {
        try { c.abort() } catch {}
      })
      pollControllersRef.current = {}

      blobUrlsRef.current.forEach(url => {
        try { URL.revokeObjectURL(url) } catch {}
      })
      blobUrlsRef.current.clear()
    }
  }, [])

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

  const getEngineBase = (b: Branch): string => {
    const raw = ENGINE_BASE_BY_BRANCH[b]
    return normalizeBase(raw)
  }

  // Poll a single task (survives tab switches because it lives here)
  const pollSingle = useCallback(
    async (b: Branch, taskId: string) => {
      const base = getEngineBase(b)
      if (!base) {
        toast.error(`Engine base URL not set for ${b}`)
        return
      }

      const key = taskId

      try {
        while (!stopPollingRef.current[key]) {
          const controller = new AbortController()
          pollControllersRef.current[key] = controller

          const res = await fetch(`${base}${STATUS_ROUTE(taskId)}`, {
            signal: controller.signal,
          })

          const ct = (res.headers.get('content-type') || '').toLowerCase()

          // image ready
          if (res.ok && ct.startsWith('image/')) {
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            blobUrlsRef.current.add(url)

            setSlotsByBranch(prev => {
              const next = { ...prev }
              const slots = [...next[b]]
              const idx = slots.findIndex(s => s.taskId === taskId)
              if (idx !== -1) {
                const old = slots[idx].url
                if (old && old.startsWith('blob:')) {
                  try {
                    URL.revokeObjectURL(old)
                    blobUrlsRef.current.delete(old)
                  } catch {}
                }
                slots[idx] = { ...slots[idx], status: 'SUCCESS', url }
              }
              next[b] = slots
              return next
            })

            delete pollControllersRef.current[key]
            stopPollingRef.current[key] = true
            return
          }

          let data: any = null
          try { data = await res.json() } catch {}

          if (data?.state === 'FAILURE') {
            toast.error(data?.error || `Task ${taskId} failed`)
            setSlotsByBranch(prev => {
              const next = { ...prev }
              const slots = [...next[b]]
              const idx = slots.findIndex(s => s.taskId === taskId)
              if (idx !== -1) {
                slots[idx] = { ...slots[idx], status: 'FAILURE' }
              }
              next[b] = slots
              return next
            })
            delete pollControllersRef.current[key]
            stopPollingRef.current[key] = true
            return
          }

          // bump to RUNNING once we get a non-failure response
          setSlotsByBranch(prev => {
            const next = { ...prev }
            const slots = [...next[b]]
            const idx = slots.findIndex(s => s.taskId === taskId)
            if (idx !== -1 && slots[idx].status === 'PENDING') {
              slots[idx] = { ...slots[idx], status: 'RUNNING' }
            }
            next[b] = slots
            return next
          })

          await delay(1200)
        }
      } catch (e: any) {
        delete pollControllersRef.current[key]
        if (!stopPollingRef.current[key]) {
          toast.error(e?.message || `Task ${taskId} error`)
          setSlotsByBranch(prev => {
            const next = { ...prev }
            const slots = [...next[b]]
            const idx = slots.findIndex(s => s.taskId === taskId)
            if (idx !== -1) {
              slots[idx] = { ...slots[idx], status: 'FAILURE' }
            }
            next[b] = slots
            return next
          })
        }
      }
    },
    []
  )

  type QueueArgs = {
    branch: Branch
    prompt: string
    negative: string
    settings: GeneralSettingsState
  }

  const handleQueueGeneration = useCallback(
    async ({ branch: b, prompt, negative, settings }: QueueArgs) => {
      if (!prompt.trim()) return

      if (!onlineByBranch[b]) {
        toast.error('Engine offline. Start it first.')
        return
      }

      const base = getEngineBase(b)
      if (!base) {
        toast.error(`Engine base URL not set for ${b}`)
        return
      }

      const w = settings.width ?? 768
      const h = settings.height ?? 1024
      const steps = settings.steps ?? 28
      const cfg = settings.cfg ?? 4.0
      const batch = Math.max(1, Number((settings as any).numImages ?? (settings as any).batch ?? 1))
      const format = (settings as any).outFormat ?? 'png'
      const seedStr = (settings.seed ?? '').toString().trim()
      const seed = seedStr === '' ? undefined : Number(seedStr)

      const form = new FormData()
      // If you end up with different models per branch, change this switch:
      form.append('model', b === 'krea' ? 'krea_dev' : 'krea_dev')
      form.append('prompt', prompt.trim())
      form.append('negative_prompt', negative.trim())
      form.append('width', String(w))
      form.append('height', String(h))
      form.append('guidance_scale', String(cfg))
      form.append('num_inference_steps', String(steps))
      if (Number.isFinite(seed as number)) form.append('seed', String(seed))
      form.append('out_format', format)
      form.append('num_images', String(batch))

      setIsGeneratingByBranch(prev => ({ ...prev, [b]: true }))

      // clear previous slots for this branch (and revoke blobs)
      setSlotsByBranch(prev => {
        const next = { ...prev }
        next[b].forEach(slot => {
          if (slot.url && slot.url.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(slot.url)
              blobUrlsRef.current.delete(slot.url)
            } catch {}
          }
        })
        next[b] = []
        return next
      })

      try {
        const res = await fetch(`${base}${QUEUE_ROUTE}`, {
          method: 'POST',
          body: form,
        })
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(txt || `HTTP ${res.status}`)
        }
        const data = await res.json()

        let metas: TaskMeta[] = []

        if (Array.isArray(data?.task_ids) && data.task_ids.length) {
          metas = (Array.isArray(data?.tasks) ? data.tasks : data.task_ids.map((tid: string) => ({ task_id: tid })))
            .map((t: any, i: number) => ({
              taskId: t?.task_id || data.task_ids[i],
              seed: typeof t?.seed === 'number' ? t.seed : (seed as number | undefined),
              steps: typeof t?.num_inference_steps === 'number' ? t.num_inference_steps : steps,
              cfg: typeof t?.guidance_scale === 'number' ? t.guidance_scale : cfg,
              width: w,
              height: h,
              format,
            }))
        } else if (data?.task_id) {
          metas = [{
            taskId: data.task_id,
            seed: typeof data?.seed === 'number' ? data.seed : (seed as number | undefined),
            steps: typeof data?.num_inference_steps === 'number' ? data.num_inference_steps : steps,
            cfg: typeof data?.guidance_scale === 'number' ? data.guidance_scale : cfg,
            width: w,
            height: h,
            format,
          }]
        } else {
          throw new Error('No task IDs returned')
        }

        setSlotsByBranch(prev => {
          const next = { ...prev }
          next[b] = metas.map(m => ({
            branch: b,
            taskId: m.taskId,
            status: 'PENDING',
            url: undefined,
            meta: m,
          }))
          return next
        })

        // start polling each one
        metas.forEach(m => {
          stopPollingRef.current[m.taskId] = false
          void pollSingle(b, m.taskId)
        })
      } catch (e: any) {
        setIsGeneratingByBranch(prev => ({ ...prev, [b]: false }))
        toast.error(e?.message || 'Failed to queue generation')
      }
    },
    [onlineByBranch, pollSingle]
  )

  const handleCancelBranch = useCallback(
    (b: Branch) => {
      const slots = slotsByBranch[b]
      if (!slots.length) return

      // stop local polling
      slots.forEach(s => {
        stopPollingRef.current[s.taskId] = true
        const c = pollControllersRef.current[s.taskId]
        if (c) {
          try { c.abort() } catch {}
        }
        delete pollControllersRef.current[s.taskId]
      })

      setIsGeneratingByBranch(prev => ({ ...prev, [b]: false }))

      // tell backend to hard-cancel
      const base = getEngineBase(b)
      if (base) {
        const reqs = slots.map(s => {
          const fd = new FormData()
          fd.append('task_id', s.taskId)
          fd.append('hard_kill', 'true')
          return fetch(`${base}${CANCEL_ROUTE}`, { method: 'POST', body: fd }).catch(() => null)
        })
        void Promise.allSettled(reqs)
      }
    },
    [slotsByBranch]
  )

  // When all slots for a branch are terminal, drop its "generating" flag
  useEffect(() => {
    (['krea', 'kontext', 'fill'] as Branch[]).forEach(b => {
      const slots = slotsByBranch[b]
      const anyGenerating = isGeneratingByBranch[b]
      if (!anyGenerating) return
      if (!slots.length) {
        setIsGeneratingByBranch(prev => (prev[b] ? { ...prev, [b]: false } : prev))
        return
      }
      const allDone = slots.every(s => s.status === 'SUCCESS' || s.status === 'FAILURE')
      if (allDone) {
        setIsGeneratingByBranch(prev => (prev[b] ? { ...prev, [b]: false } : prev))
      }
    })
  }, [slotsByBranch, isGeneratingByBranch])

  /* ───────── Engine status polling (unchanged, still via API_BASE) ───────── */

  useEffect(() => {
    if (!API_BASE) return

    const base = API_BASE.replace(/\/+$/, '')
    const controller = new AbortController()
    let cancelled = false
    let tick: number | undefined

    const poll = async () => {
      try {
        const res = await fetch(`${base}/images/${branch}/runpod-status/`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        const isOnline = !!data?.online

        // update per-branch online state without clobbering others
        setOnlineByBranch(prev => {
          if (prev[branch] === isOnline) return prev
          const next = { ...prev, [branch]: isOnline }
          return next
        })

        // toast only on transition offline -> online for THIS branch
        const wasOnline = prevOnlineRef.current[branch]
        if (!wasOnline && isOnline) {
          const label = BRANCH_TO_ENGINE_LABEL[branch]
          toast.success(`${label} is live.`)
        }
        prevOnlineRef.current[branch] = isOnline
      } catch (err) {
        // treat as offline only if not aborted
        if (!controller.signal.aborted) {
          setOnlineByBranch(prev => {
            if (prev[branch] === false) return prev
            const next = { ...prev, [branch]: false }
            return next
          })
          prevOnlineRef.current[branch] = false
        }
      } finally {
        if (!cancelled) {
          tick = window.setTimeout(poll, 2500) as unknown as number
        }
      }
    }

    // immediate poll on tab change for snappier feedback
    poll()

    return () => {
      cancelled = true
      if (tick) window.clearTimeout(tick)
      controller.abort()
    }
  }, [branch, API_BASE])

  // If we came from the main LoRA Library's "Use" button, open the LoRA tab
  useEffect(() => {
    if (sessionStorage.getItem('image.selectedLoras')) {
      setActiveRightTab('loraLibrary')
    }
  }, [])

  const branchSlots = slotsByBranch[branch]
  const isGenerating = isGeneratingByBranch[branch]

  return (
    <div className={styles.wrapper}>
      <NavTabs />

      <div className={styles.tabNavRow}>
        <div className={styles.tabNav}>
          <button
            className={`${styles.tab} ${activeTab === 't2i' ? styles.active : ''}`}
            onClick={() => startTransition(() => setActiveTab('t2i'))}
            disabled={isPending}
            type="button"
          >
            Text to Image
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'i2i' ? styles.active : ''}`}
            onClick={() => startTransition(() => setActiveTab('i2i'))}
            disabled={isPending}
            type="button"
          >
            Image to Image
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'inpaint' ? styles.active : ''}`}
            onClick={() => startTransition(() => setActiveTab('inpaint'))}
            disabled={isPending}
            type="button"
          >
            Inpaint
          </button>
        </div>

        <div className={`${styles.engineStatus} ${engineOnline ? styles.onlineStatus : ''}`}>
          <div className={`${styles.statusDot} ${engineOnline ? styles.online : styles.offline}`}></div>
          <span>
            {`${BRANCH_TO_ENGINE_LABEL[branch]} ${engineOnline ? 'Online' : 'Offline'}`}
          </span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className={styles.columns}>
        <div className={`${styles.left} ${styles.panel}`}>
          {activeTab === 't2i' && (
            <TextToImage
              engineOnline={engineOnline}
              settings={settings}
              onEngineOnlineChange={setBranchOnline}
              // NEW: task tracking from parent
              slots={branchSlots}
              isGenerating={isGenerating}
              onGenerate={({ prompt, negative }) =>
                handleQueueGeneration({ branch, prompt, negative, settings })
              }
              onCancel={() => handleCancelBranch(branch)}
            />
          )}
          {activeTab === 'i2i' && (
            <ImageToImage
              engineOnline={engineOnline}
              settings={settings}
              onEngineOnlineChange={setBranchOnline}
              // TODO: when you refactor ImageToImage, pass the same task props here
              // slots={branchSlotsForKontext}
              // isGenerating={isGeneratingByBranch.kontext}
              // onGenerate={...}
              // onCancel={...}
            />
          )}
          {activeTab === 'inpaint' && (
            <Inpaint
              engineOnline={engineOnline}
              settings={settings}
              onEngineOnlineChange={setBranchOnline}
              // TODO: same idea for Inpaint
            />
          )}
        </div>

        <div className={`${styles.right} ${styles.panel}`}>
          {/* Right-side tabs: Settings | LoRA Library */}
          <div className={styles.tabs}>
            <button
              ref={tabsRef.settings}
              className={activeRightTab === 'settings' ? styles.active : ''}
              onClick={() => setActiveRightTab('settings')}
              type="button"
            >
              Settings
            </button>
            <button
              ref={tabsRef.loraLibrary}
              className={activeRightTab === 'loraLibrary' ? styles.active : ''}
              onClick={() => setActiveRightTab('loraLibrary')}
              type="button"
            >
              LoRA Library{selectedLoraCount > 0 ? ` (${selectedLoraCount}/${MAX_SELECTED})` : ''}
            </button>
            <div
              className={styles.tabIndicator}
              style={{ left: indicatorLeft, width: indicatorWidth }}
            />
          </div>

          {activeRightTab === 'settings' ? (
            <GeneralSettings value={settings} onChange={setSettings} />
          ) : (
            // Capture selection changes from the right-side LoRA Library
            <LoraLibrary onSelectedChange={setActiveLoras} />
          )}
        </div>
      </div>
    </div>
  )
}

export default Image
