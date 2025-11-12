// src/components/Image/ImageToImage/ImageToImage.tsx
import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import type { GeneralSettingsState } from '../Right/Settings/Settings'
import {
  Sparkles, ChevronDown, ChevronUp, CircleStop, Send, RefreshCcw, Copy,
  CornerDownLeft, Upload, Trash, Loader2, X, ChevronLeft, ChevronRight, Download
} from 'lucide-react'
import styles from './ImageToImage.module.css'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type Props = {
  engineOnline: boolean
  settings?: GeneralSettingsState // optional; width/height/steps/cfg/batch/seed/outFormat if provided
}

type TaskMeta = {
  taskId: string
  seed?: number
  steps?: number
  cfg?: number
  width?: number
  height?: number
  format?: string
}

type Slot = {
  taskId: string
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE'
  url?: string
  meta: TaskMeta
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const ENGINE_BASE_URL = import.meta.env.VITE_IMAGE_KONTEXT_ENGINE_API_BASE_URL

const BRANCHES = ['krea', 'kontext', 'fill'] as const
type Branch = typeof BRANCHES[number]

// NOTE: If your backend uses a different route, update QUEUE_ROUTE_IMG2IMG.
// This mirrors TextToImage's routes.
const QUEUE_ROUTE_IMG2IMG = '/image/image/generate/'        // ← adjust if your API differs
const STATUS_ROUTE = (taskId: string) => `/image/image/task-status/${taskId}`
const CANCEL_ROUTE = '/image/image/cancel/'
const START_ENGINE_ROUTE = (b: Branch) => `/images/${b}/start-runpod/`

function normalizeBase(url?: string) {
  if (!url) return ''
  return url.replace(/\/+$/, '')
}
function revokeAll(urls: string[]) {
  urls.forEach(u => { try { if (u.startsWith('blob:')) URL.revokeObjectURL(u) } catch {} })
}

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0)
// const FLUX_PROMPT_GUIDE_TOKENS = 512

const PROMPT_TEMPLATES = [
  'Remove the background and replace with clean white studio backdrop.',
  'Swap the background for a modern office interior, natural daylight.',
  'Remove blemishes and smooth skin subtly; keep natural texture.',
  'Reduce noise and sharpen details; keep it realistic.',
  'Apply cinematic color grade with warm highlights.',
  'Even out lighting and fix overexposed areas.',
  'Center the product, straighten perspective, add soft shadow.',
  'Remove price tags and stickers from the product.',
  'Enhance eyes and even skin tone; preserve freckles and texture.',
  'Tame flyaway hairs; refine hair edges cleanly.',
  'Convert to monochrome with gentle film grain.',
  'Add shallow depth of field (background blur) for portraits.',
  'Remove unwanted objects or people from the background.',
  'Replace the sky with a vibrant sunset; keep realistic lighting.',
]

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
  const { seed, steps, cfg, width, height, format } = meta || {}

  const base = 768
  const scale = Math.min(1.6, Math.max(0.6, (width ?? base) / base))
  const maxW = Math.min(window.innerWidth * 0.92, (width ?? base) * scale)
  const maxH = Math.min(window.innerHeight * 0.88, (height ?? base) * scale)

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
        style={{ maxWidth: `${maxW}px`, maxHeight: `${maxH}px` }}
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
                <img src={url} alt="Edited" className={styles.modalImg} />
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

          {slots.length > 1 && (
            <div className={styles.thumbsRow} role="tablist" aria-label="Preview thumbnails">
              {slots.map((s, i) => (
                <button
                  key={s.taskId}
                  className={`${styles.thumb} ${i === safeIndex ? styles.thumbActive : ''}`}
                  onClick={() => setIndex(i)}
                  type="button"
                  role="tab"
                  aria-selected={i === safeIndex}
                  aria-label={`Show image ${i + 1} of ${slots.length}`}
                  disabled={!s.url}
                  title={s.url ? `Open ${i + 1}/${slots.length}` : 'Generating…'}
                >
                  {s.url ? (
                    <img src={s.url} alt={`thumbnail ${i + 1}`} />
                  ) : (
                    <div className={styles.thumbSkeleton} />
                  )}
                </button>
              ))}
            </div>
          )}

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
              <div className={styles.metaLabel}>Size</div>
              <div className={styles.metaValue}>
                {width && height ? `${width}×${height}` : '—'}
              </div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Format</div>
              <div className={styles.metaValue}>{(format || 'png').toUpperCase()}</div>
            </div>
          </div>
        </div>

        {url && (
          <div className={styles.modalFooter}>
            <a className={styles.primaryBtnSm} href={url} download={`krea_${seed ?? 'edit'}.${(format || 'png')}`}>
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ImageToImage({ engineOnline, settings }: Props) {
  // source image + preview
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // prompts
  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState('')

  // helpers / chat
  const [showChat, setShowChat] = useState(false)
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

  // preview
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number>(0)

  // sockets
  const wsChatRef = useRef<WebSocket | null>(null)
  const wsRefineRef = useRef<WebSocket | null>(null)
  const wsNegRef = useRef<WebSocket | null>(null)

  // controllers + revoke
  const pollControllersRef = useRef<Record<string, AbortController>>({})
  const urlsRef = useRef<string[]>([])
  useEffect(() => { urlsRef.current = slots.map(s => s.url || '').filter(Boolean) }, [slots])

  const promptWordCount = useMemo(() => countWords(prompt), [prompt])
  const negativeWordCount = useMemo(() => countWords(negative), [negative])
  const CHAR_SOFT_LIMIT = 1000
  const overLimit = prompt.length > CHAR_SOFT_LIMIT

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

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      revokeAll(urlsRef.current)
    }
  }, [previewUrl])

  /* stop spinner/cancel once ALL slots are terminal */
  useEffect(() => {
    if (!isGenerating || slots.length === 0) return
    const allDone = slots.every(s => s.status === 'SUCCESS' || s.status === 'FAILURE')
    if (allDone) {
      setIsGenerating(false)
      stopPollingRef.current = false
    }
  }, [slots, isGenerating])

  // engine
// ENGINE START — start only the kontext branch
const handleStartEngine = async () => {
  if (!API_BASE_URL) {
    toast.error('API base URL not set')
    return
  }
  const t = toast.loading('Starting Img to Img engine…')
  try {
    const { data } = await axios.post(
      `${normalizeBase(API_BASE_URL)}${START_ENGINE_ROUTE('kontext')}`
    )
    toast.dismiss(t)
    const s = String(data?.status || '')
    if (['RUNNING', 'STARTING', 'REQUESTED'].includes(s)) {
      toast.success('Img to Img engine is starting.')
    } else if (s === 'HEALTHY') {
      toast.success('Image engine is already live.')
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
      'Failed to start Img to Img engine.'
    toast.error(msg)
  }
}

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

  // POLL SINGLE
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

        // Gracefully handle JSON status or empty
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

  // QUEUE
  const handleGenerate = async () => {
    // toggle → Cancel
    if (isGenerating) {
      handleCancelGenerate()
      return
    }

    if (!prompt.trim()) return
    if (!engineOnline) return toast.error('Engine offline. Start it first.')
    if (!API_BASE_URL && !ENGINE_BASE_URL) return toast.error('API base URL not set')
    if (!imageFile) return toast.error('Please upload a source image.')

    setIsGenerating(true)
    stopPollingRef.current = false

    revokeAll(urlsRef.current)
    setSlots([])

    // Prefer explicit settings if provided
    const w = settings?.width
    const h = settings?.height
    const steps = settings?.steps ?? 28
    const cfg = settings?.cfg ?? 4.0
    const batch = Math.max(1, Number((settings as any)?.numImages ?? (settings as any)?.batch ?? 1))
    const format = (settings as any)?.outFormat ?? 'png'
    const seedStr = (settings?.seed ?? '').toString().trim()
    const seed = seedStr === '' ? undefined : Number(seedStr)

    const form = new FormData()
    form.append('model', 'kontext')
    form.append('prompt', prompt.trim())
    form.append('negative_prompt', negative.trim())
    if (w) form.append('width', String(w))
    if (h) form.append('height', String(h))
    form.append('guidance_scale', String(cfg))
    form.append('num_inference_steps', String(steps))
    if (Number.isFinite(seed as number)) form.append('seed', String(seed))
    form.append('out_format', format)
    form.append('num_images', String(batch))
    form.append('image', imageFile, imageFile.name)

    try {
      const res = await fetch(`${normalizeBase(ENGINE_BASE_URL)}${QUEUE_ROUTE_IMG2IMG}`, {
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
              width: w,
              height: h,
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
          width: w,
          height: h,
          format,
        }
        setSlots([{ taskId: m.taskId, status: 'PENDING', url: undefined, meta: m }])
        pollSingle(m.taskId, 0)
      } else {
        throw new Error('No task IDs returned')
      }
    } catch (e: any) {
      setIsGenerating(false)
      toast.error(e?.message || 'Failed to queue edit')
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

  // refine
  const WS_PATHS = {
    chat: '/ws/emails/generate-ai/',
    refine: '/ws/images/refine-edit-prompt/',   // ← edit-focused refinement
    negatives: '/ws/images/suggest-negatives/',
  }

  const makeWsUrl = (path: string) => {
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

  // chat
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
  const handleRegenerate = () => {
    if (!lastPrompt || isTyping) return
    sendChatPrompt(lastPrompt)
  }
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

  // Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 100 * 1024 * 1024) return toast.error(`"${f.name}" exceeds 100MB limit.`)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImageFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }
  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImageFile(null)
    setPreviewUrl(null)
  }

  // Download all (single or zip)
  const handleDownloadAll = async () => {
    const done = slots.filter(s => s.status === 'SUCCESS' && s.url)
    if (done.length === 0) return

    if (done.length === 1) {
      const s = done[0]
      const a = document.createElement('a')
      a.href = s.url!
      const nameSeed = s.meta.seed ?? 'edit'
      a.download = `krea_${nameSeed}.${(s.meta.format || 'png')}`
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
        zip.file(`krea_${seedName}.${ext}`, blob)
        idx++
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `krea_img2img_${Date.now()}.zip`
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
        a.download = `krea_${nameSeed}.${(s.meta.format || 'png')}`
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
    }
  }

  // UI
  return (
    <div className={styles.wrap}>
      {/* Source Image */}
      <div className={styles.section}>
        <h3 className={styles.sectionHeader}>Source Image</h3>
        <label className={styles.uploadBox}>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          {!previewUrl ? (
            <div className={styles.uploadInner}>
              <Upload size={24} />
              <p>Click to upload or drag & drop</p>
              <p className={styles.subText}>Single image, up to 100MB</p>
            </div>
          ) : (
            <div className={styles.previewWrap}>
              <img src={previewUrl} alt="source" className={styles.previewImg} />
              <button type="button" className={styles.previewRemove} onClick={clearImage} title="Remove">
                <Trash size={14} />
              </button>
            </div>
          )}
        </label>
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
          placeholder="Describe the transformation you want…"
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
                <button onClick={() => setRefinedDraft('')} className={styles.secondaryBtn}>
                  Discard
                </button>
                <button
                  onClick={() => { setPrompt(refinedDraft.trim()); setRefinedDraft('') }}
                  className={styles.primaryBtnSm}
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
                placeholder="Ask anything… (e.g., keep composition, change style)"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleChatAsk()
                  }
                }}
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
              <div className={styles.left}>
                <div className={styles.tooltipWrapper} data-tooltip="Regenerate">
                  <button
                    className={styles.chatIconBtn}
                    onClick={handleRegenerate}
                    disabled={isTyping || !lastPrompt}
                  >
                    <RefreshCcw size={16} />
                  </button>
                </div>
              </div>
              <div className={styles.right}>
                <div className={styles.tooltipWrapper} data-tooltip="Copy">
                  <button className={styles.chatIconBtn} onClick={handleCopy}>
                    <Copy size={16} />
                  </button>
                </div>
                <div className={styles.tooltipWrapper} data-tooltip="Insert to Prompt">
                  <button
                    className={styles.chatIconBtnPrimary}
                    onClick={handleApplyToPrompt}
                    disabled={!aiResponse.trim()}
                  >
                    <CornerDownLeft size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suggestions */}
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
          placeholder="Things to avoid (e.g., artifacts, text overlays, blur)…"
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
            title={!prompt.trim() ? 'Enter a prompt first' : 'Suggest negatives'}
          >
            {isSuggesting ? (<span className={styles.spinnerMini} />) : (<Sparkles size={16} />)}
            {isSuggesting ? 'Suggesting…' : 'Suggest with AI'}
          </button>
        </div>
      </div>

      {/* Generate / Start (single toggle button) */}
      <div className={styles.actionRow}>
        {engineOnline ? (
          <button
            className={styles.primaryBtn}
            disabled={!prompt.trim() || !imageFile}
            onClick={handleGenerate}
            aria-disabled={!prompt.trim() || !imageFile}
            type="button"
            title={isGenerating ? 'Cancel' : 'Generate'}
          >
            {isGenerating ? <Loader2 className={styles.spinner} /> : <Sparkles size={16} />}
            {isGenerating ? 'Cancel' : 'Generate'}
          </button>
        ) : (
          <button className={styles.primaryBtn} onClick={handleStartEngine} type="button">
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
