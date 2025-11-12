// src/components/Inpaint/Inpaint.tsx
import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import type { GeneralSettingsState } from '../Right/Settings/Settings'
import {
  Sparkles, Info, ChevronDown, ChevronUp, CircleStop, Send, RefreshCcw, Copy,
  CornerDownLeft, Upload, Trash, Brush, Eraser, RotateCcw, Droplet,
  Loader2, X, ChevronLeft, ChevronRight, Download
} from 'lucide-react'
import styles from './Inpaint.module.css'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type Props = {
  engineOnline: boolean
  settings?: GeneralSettingsState // optional; steps/cfg/batch/seed/outFormat if provided
}

type TaskMeta = {
  taskId: string
  seed?: number
  steps?: number
  cfg?: number
  format?: string
}

type Slot = {
  taskId: string
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE'
  url?: string
  meta: TaskMeta
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const ENGINE_BASE_URL = import.meta.env.VITE_IMAGE_FILL_ENGINE_API_BASE_URL

const BRANCHES = ['krea', 'kontext', 'fill'] as const
type Branch = typeof BRANCHES[number]

// Backend routes (same “/image/…” stack you showed)
const QUEUE_ROUTE_INPAINT = '/image/image/generate/'
const STATUS_ROUTE = (taskId: string) => `/image/image/task-status/${taskId}`
const CANCEL_ROUTE = '/image/image/cancel/'
const START_ENGINE_ROUTE = (branch: Branch) => `/images/${branch}/start-runpod/`

function normalizeBase(url?: string) {
  if (!url) return ''
  return url.replace(/\/+$/, '')
}
function revokeAll(urls: string[]) {
  urls.forEach(u => { try { if (u.startsWith('blob:')) URL.revokeObjectURL(u) } catch {} })
}

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0)
const FLUX_PROMPT_GUIDE_TOKENS = 512

const PROMPT_TEMPLATES = [
  'Remove the background cleanly; keep edges of subject sharp.',
  'Replace the sky with overcast clouds; match scene color temperature.',
  'Erase the person on the left; fill with plausible background.',
  'Fix blemishes and flyaway hairs; preserve skin texture.',
]

type MaskColor = 'black' | 'gray' | 'white'

/* ───────── Preview Modal (carousel over completed slots) ───────── */
function PreviewModal({
  open,
  onClose,
  slots,
  index,
  setIndex,
}: {
  open: boolean
  onClose: () => void
  slots: Slot[]
  index: number
  setIndex: (i: number) => void
}) {
  if (!open || !slots.length) return null

  const safeIndex = Math.min(Math.max(0, index), slots.length - 1)
  const slot = slots[safeIndex]
  const { url, meta } = slot || {}
  const { seed, steps, cfg, format } = meta || {}

  const go = useCallback((dir: number) => {
    setIndex((safeIndex + dir + slots.length) % slots.length)
  }, [safeIndex, setIndex, slots.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Preview</h3>
          <div className={styles.modalHeaderRight}>
            <span className={styles.modalCounter}>{safeIndex + 1} / {slots.length}</span>
            <button className={styles.iconBtn} onClick={onClose} aria-label="Close preview" type="button">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.modalImageWrap}>
            {url ? (
              <>
                <img src={url} alt="Inpainted" className={styles.modalImg} />
                {slots.length > 1 && (
                  <>
                    <button
                      className={`${styles.carouselBtn} ${styles.carouselBtnLeft}`}
                      onClick={() => go(-1)}
                      aria-label="Previous"
                      type="button"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      className={`${styles.carouselBtn} ${styles.carouselBtnRight}`}
                      onClick={() => go(1)}
                      aria-label="Next"
                      type="button"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className={styles.noPreview}>No image</div>
            )}
          </div>

          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Steps</div>
              <div className={styles.metaValue}>{steps ?? '—'}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>CFG</div>
              <div className={styles.metaValue}>{cfg ?? '—'}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Seed</div>
              <div className={styles.metaValue}>{seed ?? '—'}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Format</div>
              <div className={styles.metaValue}>{(format || 'png').toUpperCase()}</div>
            </div>
          </div>
        </div>

        {url && (
          <div className={styles.modalFooter}>
            <a className={styles.primaryBtnSm} href={url} download={`krea_inpaint_${seed ?? 'edit'}.${(format || 'png')}`}>
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Inpaint({ engineOnline, settings }: Props) {
  // Reference image
  const [refFile, setRefFile] = useState<File | null>(null)
  const [refPreview, setRefPreview] = useState<string | null>(null)

  // Canvas mask
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawFrameRef = useRef<HTMLDivElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(12)
  const [mode, setMode] = useState<'brush' | 'erase'>('brush')
  const [maskColor, setMaskColor] = useState<MaskColor>('white') // display-only for contrast

  const [isMaskDirty, setIsMaskDirty] = useState(false)

  // prompts
  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState('')
  const [showTips, setShowTips] = useState(false)
  const [showChat, setShowChat] = useState(false)

  // mini-chat state
  const [askInput, setAskInput] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [thinkingLabel, setThinkingLabel] = useState('')
  const dotsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [lastPrompt, setLastPrompt] = useState('')

  const [isRefining, setIsRefining] = useState(false)
  const [refinedDraft, setRefinedDraft] = useState('')
  const [isSuggesting, setIsSuggesting] = useState(false)

  // generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [slots, setSlots] = useState<Slot[]>([])
  const stopPollingRef = useRef(false)
  const pollControllersRef = useRef<Record<string, AbortController>>({})
  const urlsRef = useRef<string[]>([])
  useEffect(() => { urlsRef.current = slots.map(s => s.url || '').filter(Boolean) }, [slots])

  // preview
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number>(0)

  // sockets
  const wsChatRef = useRef<WebSocket | null>(null)
  const wsRefineRef = useRef<WebSocket | null>(null)
  const wsNegRef = useRef<WebSocket | null>(null)

  const promptWordCount = useMemo(() => countWords(prompt), [prompt])
  const negativeWordCount = useMemo(() => countWords(negative), [negative])
  const CHAR_SOFT_LIMIT = 1000
  const overLimit = prompt.length > CHAR_SOFT_LIMIT

  const DEFAULT_FRAME_WIDTH = 420
  const MIN_FRAME_WIDTH = 320
  const MAX_FRAME_WIDTH = 900

  // done slots (successful with urls)
  const doneSlots = useMemo(
    () => slots.filter(s => s.status === 'SUCCESS' && !!s.url),
    [slots]
  )

  // cleanup
  useEffect(() => {
    return () => {
      try { wsChatRef.current?.close() } catch {}
      try { wsRefineRef.current?.close() } catch {}
      try { wsNegRef.current?.close() } catch {}
      if (dotsTimerRef.current) clearInterval(dotsTimerRef.current)

      try { Object.values(pollControllersRef.current).forEach(c => c.abort()) } catch {}
      pollControllersRef.current = {}

      if (refPreview?.startsWith('blob:')) URL.revokeObjectURL(refPreview)
      revokeAll(urlsRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* stop spinner/cancel once ALL slots are terminal */
  useEffect(() => {
    if (!isGenerating || slots.length === 0) return
    const allDone = slots.every(s => s.status === 'SUCCESS' || s.status === 'FAILURE')
    if (allDone) {
      setIsGenerating(false)
      stopPollingRef.current = false
    }
  }, [slots, isGenerating])

  // --- utils ---
  function makeWsUrl(path: string) {
    try {
      const base = API_BASE_URL || window.location.origin
      const u = new URL(base)
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
      const basePath = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname
      const relPath  = path.startsWith('/') ? path : `/${path}`
      u.pathname = `${basePath}${relPath}`
      return u.toString()
    } catch {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const relPath = path.startsWith('/') ? path : `/${path}`
      return `${proto}://${location.host}${relPath}`
    }
  }

  function openSocket(path: string, ref: React.MutableRefObject<WebSocket | null>): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      if (ref.current && ref.current.readyState === WebSocket.OPEN) return resolve(ref.current)
      if (ref.current) { try { ref.current.close() } catch {} }
      const ws = new WebSocket(makeWsUrl(path))
      ref.current = ws
      ws.onopen = () => resolve(ws)
      ws.onerror = (ev) => { console.error('WebSocket error:', ev); reject(new Error('WebSocket error')) }
    })
  }

  // --- canvas init/sizing ---
  const initCanvasFromRef = (imgUrl: string) => {
    const canvas = canvasRef.current
    const frame = drawFrameRef.current
    if (!canvas || !frame) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      const maxW = frame.clientWidth || 560
      const scale = Math.min(1, maxW / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      canvas.width = w
      canvas.height = h
      ctx.clearRect(0, 0, w, h) // transparent start
      setIsMaskDirty(false)
    }
    img.src = imgUrl
  }

  useEffect(() => {
    if (!refPreview) return
    requestAnimationFrame(() => initCanvasFromRef(refPreview))
  }, [refPreview])

  useEffect(() => {
    const frame = drawFrameRef.current
    if (!frame || !refPreview) return
    const ro = new ResizeObserver(() => initCanvasFromRef(refPreview))
    ro.observe(frame)
    return () => ro.disconnect()
  }, [refPreview])

  // Touch support
  const pointerFromTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const t = e.touches[0]
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(canvas.width, ((t.clientX - rect.left) / rect.width) * canvas.width)),
      y: Math.max(0, Math.min(canvas.height, ((t.clientY - rect.top) / rect.height) * canvas.height)),
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /INPUT|TEXTAREA/.test(target.tagName)) return
      if (e.key.toLowerCase() === 'b') setMode('brush')
      if (e.key.toLowerCase() === 'e') setMode('erase')
      if (e.key === '[') setBrushSize((s) => Math.max(2, s - 2))
      if (e.key === ']') setBrushSize((s) => Math.min(100, s + 2))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Drag & drop ref image
  const onDropRef = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    if (f.size > 100 * 1024 * 1024) return toast.error(`"${f.name}" exceeds 100MB limit.`)
    if (refPreview?.startsWith('blob:')) URL.revokeObjectURL(refPreview)
    setRefFile(f)
    setRefPreview(URL.createObjectURL(f))
  }

  // --- engine ---
  // ENGINE START — start only the fill branch
const handleStartEngine = async () => {
  if (!API_BASE_URL) {
    toast.error('API base URL not set')
    return
  }
  const t = toast.loading('Starting Inpaint engine…')
  try {
    const { data } = await axios.post(
      `${normalizeBase(API_BASE_URL)}${START_ENGINE_ROUTE('fill')}`
    )
    toast.dismiss(t)
    const s = data?.status
    if (['RUNNING', 'STARTING', 'REQUESTED'].includes(String(s))) {
      toast.success('Inpaint Engine is starting.')
    } else if (s === 'HEALTHY') {
      toast.success('Inpaint Engine is already live.')
    } else {
      toast.error(`Engine status: ${s || 'Unknown'}`)
    }
  } catch (err: any) {
    toast.dismiss(t)
    const msg =
      err?.response?.data?.error ||
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      'Failed to start Inpaint engine.'
    toast.error(msg)
  }
}

  // --- uploads ---
  const onPickRef = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 100 * 1024 * 1024) return toast.error(`"${f.name}" exceeds 100MB limit.`)
    if (refPreview?.startsWith('blob:')) URL.revokeObjectURL(refPreview)
    setRefFile(f)
    const url = URL.createObjectURL(f)
    setRefPreview(url)
  }

  const clearRef = () => {
    if (refPreview?.startsWith('blob:')) URL.revokeObjectURL(refPreview)
    setRefFile(null); setRefPreview(null)
    clearCanvas()
  }

  // --- canvas helpers ---
  const getPointerPos = (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(canvas.width, ((e.clientX - rect.left) / rect.width) * canvas.width)),
      y: Math.max(0, Math.min(canvas.height, ((e.clientY - rect.top) / rect.height) * canvas.height)),
    }
  }

  const drawAt = (x: number, y: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    if (mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
      setIsMaskDirty(true)
      return
    }

    ctx.globalCompositeOperation = 'source-over'
    // display color only; we binarize on export
    let fill = '#ffffff'
    if (maskColor === 'black') fill = '#000000'
    else if (maskColor === 'gray') fill = '#808080'
    ctx.fillStyle = fill
    ctx.beginPath()
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
    setIsMaskDirty(true)
  }

  const handleCanvasDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const p = getPointerPos(e)
    drawAt(p.x, p.y)
  }
  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const p = getPointerPos(e)
    drawAt(p.x, p.y)
  }
  const handleCanvasUp = () => setIsDrawing(false)

  // Touch events
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(true)
    const p = pointerFromTouch(e)
    drawAt(p.x, p.y)
  }
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()
    const p = pointerFromTouch(e)
    drawAt(p.x, p.y)
  }
  const handleTouchEnd = () => setIsDrawing(false)

  const clearCanvas = () => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    setIsMaskDirty(false)
  }

// Replace isAllBlack with alpha-based check
  const hasAnyPaint = (imgData: ImageData) => {
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) return true // any visible pixel = painted
    }
    return false
  }

  const exportBinaryMaskBlob = async (): Promise<Blob | null> => {
    const src = canvasRef.current
    if (!src) return null
  
    const w = src.width
    const h = src.height
    const srcCtx = src.getContext('2d')
    if (!srcCtx) return null
  
    const img = srcCtx.getImageData(0, 0, w, h)
    const data = img.data
  
    // If nothing drawn → bail (alpha-based)
    if (!hasAnyPaint(img)) return null
  
    // Binarize: any painted (alpha>0) → white; else → black
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]
      if (a > 0) {
        data[i + 0] = 255
        data[i + 1] = 255
        data[i + 2] = 255
        data[i + 3] = 255
      } else {
        data[i + 0] = 0
        data[i + 1] = 0
        data[i + 2] = 0
        data[i + 3] = 255
      }
    }
  
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const offCtx = off.getContext('2d')
    if (!offCtx) return null
    offCtx.putImageData(img, 0, 0)
  
    return await new Promise<Blob | null>((resolve) =>
      off.toBlob((b) => resolve(b), 'image/png')
    )
  }  

  // --- polling ---
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

  const pollSingle = async (taskId: string, slotIndex: number) => {
    try {
      while (!stopPollingRef.current) {
        const controller = new AbortController()
        pollControllersRef.current[taskId] = controller

        const res = await fetch(`${normalizeBase(ENGINE_BASE_URL)}${STATUS_ROUTE(taskId)}`, {
          signal: controller.signal,
        })

        const ct = (res.headers.get('content-type') || '').toLowerCase()

        if (res.ok && ct.startsWith('image/')) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          setSlots(prev => {
            const next = [...prev]
            const old = next[slotIndex]?.url
            if (old?.startsWith('blob:')) { try { URL.revokeObjectURL(old) } catch {} }
            next[slotIndex] = { ...next[slotIndex], status: 'SUCCESS', url }
            return next
          })
          delete pollControllersRef.current[taskId]
          return
        }

        // Maybe JSON status or empty
        let data: any = null
        try { data = await res.json() } catch {}

        if (data?.state === 'FAILURE') {
          toast.error(data?.error || `Task ${taskId} failed`)
          setSlots(prev => {
            const next = [...prev]
            next[slotIndex] = { ...next[slotIndex], status: 'FAILURE' }
            return next
          })
          delete pollControllersRef.current[taskId]
          return
        }

        setSlots(prev => {
          const next = [...prev]
          if (next[slotIndex]?.status === 'PENDING') {
            next[slotIndex] = { ...next[slotIndex], status: 'RUNNING' }
          }
          return next
        })

        await delay(1200)
      }
    } catch (e: any) {
      delete pollControllersRef.current[taskId]
      if (!stopPollingRef.current) toast.error(e?.message || `Task ${taskId} error`)
      setSlots(prev => {
        const next = [...prev]
        next[slotIndex] = { ...next[slotIndex], status: 'FAILURE' }
        return next
      })
    }
  }

  // --- generate/cancel ---
  const handleGenerate = async () => {
    // toggle → Cancel
    if (isGenerating) {
      handleCancelGenerate()
      return
    }

    if (!prompt.trim()) return
    if (!engineOnline) return toast.error('Engine offline. Start it first.')
    if (!API_BASE_URL && !ENGINE_BASE_URL) return toast.error('API base URL not set')
    if (!refFile) return toast.error('Please upload a reference image.')
    if (!isMaskDirty) return toast.error('Draw over what you want edited.')

    // Build mask
    const maskBlob = await exportBinaryMaskBlob()
    if (!maskBlob) {
      toast.error('Draw over what you want edited.')
      return
    }

    setIsGenerating(true)
    stopPollingRef.current = false

    revokeAll(urlsRef.current)
    setSlots([])

    // Prefer explicit settings if provided
    const steps = settings?.steps ?? 26
    const cfg = settings?.cfg ?? 3.0
    const batch = Math.max(1, Number((settings as any)?.numImages ?? (settings as any)?.batch ?? 1))
    const format = (settings as any)?.outFormat ?? 'png'
    const seedStr = (settings?.seed ?? '').toString().trim()
    const seed = seedStr === '' ? undefined : Number(seedStr)

    const form = new FormData()
    form.append('model', 'fill')
    form.append('prompt', prompt.trim())
    form.append('negative_prompt', (negative || '').trim())
    form.append('guidance_scale', String(cfg))
    form.append('num_inference_steps', String(steps))
    if (Number.isFinite(seed as number)) form.append('seed', String(seed))
    form.append('out_format', format)
    form.append('num_images', String(batch))
    form.append('image', refFile, refFile.name)
    form.append('mask', new File([maskBlob], 'mask.png', { type: 'image/png' }))

    try {
      const res = await fetch(`${normalizeBase(ENGINE_BASE_URL)}${QUEUE_ROUTE_INPAINT}`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `HTTP ${res.status}`)
      }
      const data = await res.json()

      if (Array.isArray(data?.task_ids) && data.task_ids.length) {
        const metas: TaskMeta[] =
          (Array.isArray(data?.tasks) ? data.tasks : data.task_ids.map((tid: string) => ({ task_id: tid })))
            .map((t: any, i: number) => ({
              taskId: t?.task_id || data.task_ids[i],
              seed: typeof t?.seed === 'number' ? t.seed : (seed as number | undefined),
              steps: typeof t?.num_inference_steps === 'number' ? t.num_inference_steps : steps,
              cfg: typeof t?.guidance_scale === 'number' ? t.guidance_scale : cfg,
              format,
            }))

        const initialSlots: Slot[] = metas.map(m => ({ taskId: m.taskId, status: 'PENDING', url: undefined, meta: m }))
        setSlots(initialSlots)
        metas.forEach((m, idx) => pollSingle(m.taskId, idx))
      } else if (data?.task_id) {
        const m: TaskMeta = {
          taskId: data.task_id,
          seed: typeof data?.seed === 'number' ? data.seed : (seed as number | undefined),
          steps: typeof data?.num_inference_steps === 'number' ? data.num_inference_steps : steps,
          cfg: typeof data?.guidance_scale === 'number' ? data.guidance_scale : cfg,
          format,
        }
        setSlots([{ taskId: m.taskId, status: 'PENDING', url: undefined, meta: m }])
        pollSingle(m.taskId, 0)
      } else {
        throw new Error('No task IDs returned')
      }
    } catch (e: any) {
      setIsGenerating(false)
      toast.error(e?.message || 'Failed to queue inpaint')
    }
  }

  // CANCEL
  const handleCancelGenerate = async () => {
    // stop local polling immediately
    stopPollingRef.current = true

    // tell server to hard-cancel each in-flight task (ultimate cancel route)
    if (ENGINE_BASE_URL && slots.length) {
      for (const s of slots) {
        try {
          const fd = new FormData()
          fd.append('task_id', s.taskId)
          fd.append('hard_kill', 'true') // use SIGKILL path on server
          await fetch(`${normalizeBase(ENGINE_BASE_URL)}${CANCEL_ROUTE}`, {
            method: 'POST',
            body: fd,
          })
        } catch {
          /* best-effort */
        }
      }
    }

    // abort all client polls
    try { Object.values(pollControllersRef.current).forEach(c => c.abort()) } catch {}
    pollControllersRef.current = {}

    setIsGenerating(false)
    toast('Generation cancelled.')
  }

  // --- refine ---
  const WS_PATHS = {
    chat: '/ws/emails/generate-ai/',
    refine: '/ws/images/refine-edit-prompt/',
    negatives: '/ws/images/suggest-negatives/',
  }

  const startThinkingAnimation = () => {
    let i = 0
    setThinkingLabel('AI is thinking')
    dotsTimerRef.current = setInterval(() => {
      const dots = ['.', '..', '...']
      setThinkingLabel(`AI is thinking${dots[i % dots.length]}`); i++
    }, 500)
  }
  const stopThinkingAnimation = () => {
    if (dotsTimerRef.current) { clearInterval(dotsTimerRef.current); dotsTimerRef.current = null }
    setThinkingLabel('')
  }

  const handleRefinePrompt = async () => {
    if (!prompt.trim() || isRefining) return
    setIsRefining(true); setRefinedDraft('')
    try {
      const ws = await openSocket(WS_PATHS.refine, wsRefineRef)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'started') return
          if (msg.token) { setRefinedDraft(prev => (prev || '') + msg.token); return }
          if (msg.done) { setIsRefining(false); return }
          if (msg.error) { toast.error(String(msg.error)); setIsRefining(false) }
        } catch {
          setRefinedDraft(prev => (prev || '') + String(e.data || ''))
        }
      }
      ws.onclose = () => { if (isRefining) setIsRefining(false) }
      const payload = { prompt }
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
      else ws.addEventListener('open', () => ws.send(JSON.stringify(payload)), { once: true })
    } catch (err: any) {
      toast.error(err?.message || 'Refine failed'); setIsRefining(false)
    }
  }

  const handleSuggestWithAI = async () => {
    if (!prompt.trim() || isSuggesting) return
    setIsSuggesting(true); setNegative('')
    try {
      const ws = await openSocket(WS_PATHS.negatives, wsNegRef)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'started') return
          if (msg.token) { setNegative(prev => (prev || '') + msg.token); return }
          if (msg.done) { setIsSuggesting(false); return }
          if (msg.error) { toast.error(String(msg.error)); setIsSuggesting(false) }
        } catch {
          setNegative(prev => (prev || '') + String(e.data || ''))
        }
      }
      ws.onclose = () => { if (isSuggesting) setIsSuggesting(false) }
      const payload = { prompt }
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
      else ws.addEventListener('open', () => ws.send(JSON.stringify(payload)), { once: true })
    } catch (err: any) {
      toast.error(err?.message || 'Suggestion failed'); setIsSuggesting(false)
    }
  }

  // --- chat ---
  const sendChatPrompt = async (text: string) => {
    if (isTyping) { try { wsChatRef.current?.close(4001, 'client cancel') } catch {}; return }
    if (!text.trim()) return
    setAiResponse(''); setIsTyping(true); setLastPrompt(text); startThinkingAnimation()
    let full = ''
    try {
      const ws = await openSocket(WS_PATHS.chat, wsChatRef)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'started') return
          if (msg.token) { full += msg.token; setAiResponse(prev => prev + msg.token); return }
          if (msg.done) {
            setIsTyping(false); stopThinkingAnimation()
            setConversationHistory(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: full }])
            return
          }
          if (msg.error) { setIsTyping(false); stopThinkingAnimation(); toast.error(String(msg.error)) }
        } catch {
          const s = String(e.data || ''); full += s; setAiResponse(prev => prev + s)
        }
      }
      ws.onerror = () => { setIsTyping(false); stopThinkingAnimation(); toast.error('WebSocket error') }
      ws.onclose = () => { if (isTyping) { setIsTyping(false); stopThinkingAnimation() } }
      const payload = { prompt: text, history: conversationHistory || [] }
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
      else ws.addEventListener('open', () => ws.send(JSON.stringify(payload)), { once: true })
    } catch (e: any) {
      setIsTyping(false); stopThinkingAnimation(); toast.error(e?.message || 'Failed to start chat')
    }
  }

  const handleChatAsk = () => {
    if (isTyping) { try { wsChatRef.current?.close(4001, 'client cancel') } catch {}; return }
    const text = askInput.trim(); if (!text) return
    setAskInput(''); sendChatPrompt(text)
  }
  const handleRegenerate = () => { if (!lastPrompt || isTyping) return; sendChatPrompt(lastPrompt) }
  const handleCopy = async () => {
    if (!aiResponse) return
    try { await navigator.clipboard.writeText(aiResponse); toast.success('Copied') }
    catch { toast.error('Copy failed') }
  }
  const handleApplyToPrompt = () => {
    if (!aiResponse.trim()) return
    setPrompt(aiResponse.trim()); toast.success('Inserted into Prompt')
  }
  const applyTemplate = (t: string) => setPrompt(t)

  // Download all (single or zip)
  const handleDownloadAll = async () => {
    const done = slots.filter(s => s.status === 'SUCCESS' && s.url)
    if (done.length === 0) return

    if (done.length === 1) {
      const s = done[0]
      const a = document.createElement('a')
      a.href = s.url!
      const nameSeed = s.meta.seed ?? 'edit'
      a.download = `krea_inpaint_${nameSeed}.${(s.meta.format || 'png')}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    }

    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      let idx = 1
      for (const s of done) {
        const resp = await fetch(s.url!)
        const blob = await resp.blob()
        const seedName = s.meta.seed ?? idx
        const ext = (s.meta.format || 'png')
        zip.file(`krea_inpaint_${seedName}.${ext}`, blob)
        idx++
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `krea_inpaint_${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error('Zip failed; downloading individually.')
      for (const s of done) {
        const a = document.createElement('a')
        a.href = s.url!
        const nameSeed = s.meta.seed ?? 'edit'
        a.download = `krea_inpaint_${nameSeed}.${(s.meta.format || 'png')}`
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
    }
  }

  return (
    <div className={styles.wrap}>
      {/* Reference image */}
      <div className={styles.section}>
        <h3 className={styles.sectionHeader}>Reference Image</h3>
        <label
          className={styles.uploadBox}
          onDragOver={(e) => { e.preventDefault() }}
          onDrop={onDropRef}
        >
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickRef} />
          {!refPreview ? (
            <div className={styles.uploadInner}>
              <Upload size={24} />
              <p>Click to upload or drag & drop</p>
              <p className={styles.subText}>Single image, up to 100MB</p>
            </div>
          ) : (
            <div className={styles.previewWrap}>
              <img src={refPreview} alt="reference" className={styles.previewImg} />
              <button type="button" className={styles.previewRemove} onClick={clearRef} title="Remove">
                <Trash size={14} />
              </button>
            </div>
          )}
        </label>
      </div>

      {/* Mask (Canvas) */}
      <div className={styles.section}>
        <div className={styles.labelRow}>
          <h3 className={styles.sectionHeader}>Mask (Draw on Image)</h3>
        </div>

        {!refPreview ? (
          <div className={styles.infoMini}>Upload a reference image first.</div>
        ) : (
          <>
            {/* TOOLBAR */}
            <div className={`${styles.actionRowLeft} ${styles.toolbarRow}`}>
              {/* Brush */}
              <div className={styles.tooltipWrapper} data-tooltip="Brush">
                <button
                  className={styles.chatIconBtn}
                  aria-pressed={mode === 'brush'}
                  onClick={() => setMode('brush')}
                  type="button"
                  aria-label="Brush"
                  title="Brush"
                >
                  <Brush size={16} />
                </button>
              </div>

              {/* Eraser */}
              <div className={styles.tooltipWrapper} data-tooltip="Eraser">
                <button
                  className={styles.chatIconBtn}
                  aria-pressed={mode === 'erase'}
                  onClick={() => setMode('erase')}
                  type="button"
                  aria-label="Eraser"
                  title="Eraser"
                >
                  <Eraser size={16} />
                </button>
              </div>

              {/* Clear */}
              <div className={styles.tooltipWrapper} data-tooltip="Clear">
                <button
                  className={styles.chatIconBtn}
                  onClick={clearCanvas}
                  type="button"
                  aria-label="Clear"
                  title="Clear"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              {/* Mask color (display-only) */}
              <div className={styles.colorGroup}>
                <span className={styles.colorLabel}>
                  <Droplet size={14} />
                  Color
                </span>
                <div className={styles.actionGroupLeft}>
                  <div className={styles.tooltipWrapper} data-tooltip="Choose a color">
                    <button
                      type="button"
                      className={`${styles.secondaryBtn} ${styles.chip}`}
                      aria-pressed={maskColor === 'black'}
                      onClick={() => setMaskColor('black')}
                      aria-label="Black"
                      title="Black"
                    >
                      Black
                    </button>
                  </div>

                  <div className={styles.tooltipWrapper} data-tooltip="Choose a color">
                    <button
                      type="button"
                      className={`${styles.secondaryBtn} ${styles.chip}`}
                      aria-pressed={maskColor === 'gray'}
                      onClick={() => setMaskColor('gray')}
                      aria-label="Gray"
                      title="Gray"
                    >
                      Gray
                    </button>
                  </div>

                  <div className={styles.tooltipWrapper} data-tooltip="Choose a color">
                    <button
                      type="button"
                      className={`${styles.secondaryBtn} ${styles.chip}`}
                      aria-pressed={maskColor === 'white'}
                      onClick={() => setMaskColor('white')}
                      aria-label="White"
                      title="White"
                    >
                      White
                    </button>
                  </div>
                </div>
              </div>

              {/* Brush size */}
              <div className={`${styles.brushGroup} ${styles.tooltipWrapper}`} data-tooltip="Size">
                <label className={styles.brushLabel} htmlFor="brush-size">Brush: {brushSize}px</label>
                <input
                  id="brush-size"
                  className={styles.brushRange}
                  type="range"
                  min={2}
                  max={100}
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                  style={{ ['--fill' as any]: `${((brushSize - 2) / (100 - 2)) * 100}%` }}
                  aria-label="Brush size"
                  title="Brush size"
                />
              </div>
            </div>

            <div
              ref={drawFrameRef}
              className={styles.resizableFrame}
              style={{
                position: 'relative',
                marginTop: '0.5rem',
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #333',
                width: `${DEFAULT_FRAME_WIDTH}px`,
                maxWidth: '100%',
                ['--min-w' as any]: `${MIN_FRAME_WIDTH}px`,
                ['--max-w' as any]: `${MAX_FRAME_WIDTH}px`,
              }}
            >
              <img
                src={refPreview}
                alt=""
                style={{ display: 'block', width: '100%', userSelect: 'none', pointerEvents: 'none' }}
              />
              <canvas
                ref={canvasRef}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'crosshair' }}
                onMouseDown={handleCanvasDown}
                onMouseMove={handleCanvasMove}
                onMouseUp={handleCanvasUp}
                onMouseLeave={handleCanvasUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            </div>

            <div className={styles.infoMini} style={{ marginTop: '0.35rem' }}>
              Draw over what you want edited. We’ll export a binary mask automatically.
            </div>
          </>
        )}
      </div>

      {/* Prompt */}
      <div className={styles.section}>
        <div className={styles.labelRow}>
          <h3 className={styles.sectionHeader}>Prompt</h3>
          <span className={styles.counter} aria-live="polite">
            {promptWordCount} words
          </span>
        </div>

        <textarea
          className={`${styles.input} ${styles.textarea}`}
          placeholder="Describe what to change…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              handleGenerate()
            }
          }}
        />
        {overLimit && (
          <div className={styles.softWarn}>
            Long prompts may truncate—consider trimming for FLUX (dev).
          </div>
        )}

        {/* Refine + Chat toggle row */}
        <div className={styles.actionRowSplit}>
          <div className={styles.actionGroupLeft}>
            <button
              className={styles.magicBtn}
              onClick={handleRefinePrompt}
              type="button"
              disabled={isRefining || !prompt.trim()}
              aria-disabled={isRefining || !prompt.trim()}
              title={!prompt.trim() ? 'Enter a prompt first' : 'Refine with AI'}
            >
              {isRefining ? (<span className={styles.spinnerMini} />) : (<Sparkles size={16} />)}
              {isRefining ? 'Refining…' : 'Refine Prompt with AI'}
            </button>

            <button
              className={styles.chatToggleBtn}
              type="button"
              onClick={() => setShowChat((s) => !s)}
              aria-expanded={showChat}
              aria-controls="promptChatPanel"
              title="Open chat refinement panel"
            >
              {showChat ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Chat instead
            </button>
          </div>
          <div />
        </div>

        {/* Refined preview */}
        {!!refinedDraft && !isRefining && (
          <div className={styles.refinePreview}>
            <div className={styles.previewHeader}>
              <span>Refined preview</span>
              <div className={styles.previewActions}>
                <button onClick={() => setRefinedDraft('')} className={styles.secondaryBtn} title="Discard refined text">
                  Discard
                </button>
                <button
                  onClick={() => { setPrompt(refinedDraft.trim()); setRefinedDraft('') }}
                  className={styles.primaryBtnSm}
                  title="Apply refined text to Prompt"
                >
                  Apply to Prompt
                </button>
              </div>
            </div>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              value={refinedDraft}
              readOnly
              rows={4}
            />
          </div>
        )}

        {/* Chat Panel */}
        {showChat && (
          <div id="promptChatPanel" className={styles.chatCard}>
            <div className={styles.chatPromptBar}>
              <input
                type="text"
                placeholder="Ask anything…"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleChatAsk()
                  }
                }}
                aria-label="Chat input"
                title="Type and press Enter"
              />
              <button className={styles.chatSendBtn} onClick={handleChatAsk} type="button" title={isTyping ? 'Stop' : 'Send'}>
                {isTyping ? <CircleStop size={18} /> : <Send size={18} />}
              </button>
            </div>
            {isTyping && thinkingLabel && (
              <div className={styles.chatThinking}>{thinkingLabel}</div>
            )}

            <div className={styles.chatResponseBox}>
              <div className={styles.chatResponseText} aria-live="polite">
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                  {aiResponse}
                </ReactMarkdown>
              </div>
            </div>

            <div className={styles.chatActions}>
              <div className="left">
                <div className={styles.tooltipWrapper} data-tooltip="Regenerate">
                  <button
                    className={styles.chatIconBtn}
                    onClick={handleRegenerate}
                    disabled={isTyping || !lastPrompt}
                    aria-label="Regenerate"
                    title="Regenerate"
                  >
                    <RefreshCcw size={16} />
                  </button>
                </div>
              </div>
              <div className="right">
                <div className={styles.tooltipWrapper} data-tooltip="Copy">
                  <button className={styles.chatIconBtn} onClick={handleCopy} aria-label="Copy" title="Copy">
                    <Copy size={16} />
                  </button>
                </div>
                <div className={styles.tooltipWrapper} data-tooltip="Insert">
                  <button
                    className={styles.chatIconBtnPrimary}
                    onClick={handleApplyToPrompt}
                    disabled={!aiResponse.trim()}
                    aria-label="Insert to Prompt"
                    title="Insert"
                  >
                    <CornerDownLeft size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Templates */}
        <div className={styles.sampleBar}>
          {PROMPT_TEMPLATES.map((p, idx) => (
            <button key={idx} className={styles.sampleBtn} title={p} onClick={() => applyTemplate(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Negative Prompt */}
      <div className={styles.section}>
        <div className={styles.labelRow}>
          <h3 className={styles.sectionHeader}>Negative Prompt</h3>
          <span className={styles.counter} aria-live="polite">
            {negativeWordCount} words
          </span>
        </div>

        <textarea
          className={`${styles.input} ${styles.textarea}`}
          placeholder="Things to avoid…"
          value={negative}
          onChange={(e) => setNegative(e.target.value)}
          rows={4}
        />

        <div className={styles.actionRowLeft}>
          <button
            className={styles.magicBtn}
            onClick={handleSuggestWithAI}
            type="button"
            disabled={isSuggesting || !prompt.trim()}
            aria-disabled={isSuggesting || !prompt.trim()}
            title={!prompt.trim() ? 'Enter a prompt first' : 'Suggest with AI'}
          >
            {isSuggesting ? (<span className={styles.spinnerMini} />) : (<Sparkles size={16} />)}
            {isSuggesting ? 'Suggesting…' : 'Suggest with AI'}
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className={styles.infoBox}>
        <div className={styles.infoHeader} onClick={() => setShowTips(!showTips)}>
          <Info size={20} />
          <span>Tips for Better Output</span>
          <ChevronDown size={18} className={showTips ? styles.rotated : ''} />
        </div>
        {showTips && (
          <div className={styles.tipList}>
            <p><strong>Front-load key details.</strong> Early tokens carry more weight.</p>
            <p><strong>Mind length/truncation.</strong> For FLUX (dev) use <code>~{FLUX_PROMPT_GUIDE_TOKENS} tokens</code> as a practical cap.</p>
            <p><strong>Hallucination happens.</strong> Reduce conflicting styles, add negatives.</p>
            <p><strong>Seeds = repeatability.</strong> Same seed + settings ≈ similar composition.</p>
            <p><strong>Steps tradeoff.</strong> More steps → detail, slower; diminishing returns.</p>
            <p><strong>Negatives as guardrails.</strong> Short, targeted negatives help.</p>
          </div>
        )}
      </div>

      {/* Generate / Start (single toggle button) */}
      <div className={styles.actionRow}>
        {engineOnline ? (
          <button
            className={styles.primaryBtn}
            disabled={!prompt.trim() || !refFile}
            onClick={handleGenerate}
            aria-disabled={!prompt.trim() || !refFile}
            type="button"
            title={isGenerating ? 'Cancel' : 'Generate'}
          >
            {isGenerating ? <Loader2 className={styles.spinner} /> : <Sparkles size={16} />}
            {isGenerating ? 'Cancel' : 'Generate'}
          </button>
        ) : (
          <button className={styles.primaryBtn} onClick={handleStartEngine} type="button" title="Start image engine">
            Start Image Engine
          </button>
        )}
      </div>

      {/* Results */}
      {slots.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionHeader}>Results</h3>

          <div className={styles.resultGrid}>
            {slots.map((s) => {
              const isLive = s.status === 'PENDING' || s.status === 'RUNNING'
              const failed = s.status === 'FAILURE'
              return (
                <div
                  key={s.taskId}
                  className={`${styles.resultCell} ${isLive ? styles.live : ''} ${failed ? styles.failed : ''}`}
                  onClick={() => {
                    if (!s.url) return
                    const doneIdx = doneSlots.findIndex(ds => ds.taskId === s.taskId)
                    if (doneIdx >= 0) {
                      setPreviewIndex(doneIdx)
                      setPreviewOpen(true)
                    }
                  }}
                  role="button"
                  aria-busy={isLive}
                  aria-label={s.url ? 'Open preview' : (failed ? 'Failed' : 'Generating…')}
                >
                  {!s.url && !failed && (
                    <div className={styles.activeBg}>
                      <div className={styles.pulse} />
                    </div>
                  )}
                  {failed && <div className={styles.failedNote}>Failed</div>}
                  {s.url && <img src={s.url} className={styles.resultImg} alt="Result" />}
                </div>
              )
            })}
          </div>

          {doneSlots.length > 0 && (
            <div className={styles.downloadBox}>
              <a
                href="#"
                className={styles.downloadLink}
                onClick={(e) => { e.preventDefault(); handleDownloadAll(); }}
              >
                <Download size={16} />
                Download{doneSlots.length > 1 ? ' all (.zip)' : ''}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Preview modal (carousel over only completed images) */}
      <PreviewModal
        open={previewOpen && doneSlots.length > 0}
        onClose={() => setPreviewOpen(false)}
        slots={doneSlots}
        index={Math.min(Math.max(0, previewIndex), Math.max(0, doneSlots.length - 1))}
        setIndex={setPreviewIndex}
      />
    </div>
  )
}
