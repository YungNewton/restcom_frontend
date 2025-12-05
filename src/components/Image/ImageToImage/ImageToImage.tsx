// src/components/Image/ImageToImage/ImageToImage.tsx
import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import type { GeneralSettingsState } from '../Right/Settings/Settings'
import type { Slot } from '../Image'
import {
  Sparkles, ChevronDown, ChevronUp, CircleStop, Send, RefreshCcw, Copy,
  CornerDownLeft, Upload, Trash, Loader2, X, ChevronLeft, ChevronRight, Download
} from 'lucide-react'
import styles from './ImageToImage.module.css'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { getAxiosErrorMessage } from '../../../lib/api'

type Branch = 'krea' | 'kontext' | 'fill'

type Props = {
  engineOnline: boolean
  settings?: GeneralSettingsState
  onEngineOnlineChange?: (branch: Branch, online: boolean) => void

  // NEW: parent-controlled generation state
  slots: Slot[]
  isGenerating: boolean
  onGenerate: (args: { prompt: string; negative: string; imageFile: File }) => void
  onCancel: () => void
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

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

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0)

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

  const go = useCallback(
    (dir: number) => {
      setIndex((safeIndex + dir + slots.length) % slots.length)
    },
    [safeIndex, setIndex, slots.length]
  )

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

export default function ImageToImage({
  engineOnline,
  // settings, // currently unused but kept for parity / future
  onEngineOnlineChange,
  slots,
  isGenerating,
  onGenerate,
  onCancel,
}: Props) {
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

  // preview modal state
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

  // only completed slots for preview / download
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
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  // ENGINE START — kontext branch only
  const handleStartEngine = async () => {
    if (!API_BASE_URL) {
      toast.error('API base URL not set')
      return
    }
    const t = toast.loading('Starting Img to Img engine…')
    try {
      const { data } = await axios.post(
        `${API_BASE_URL.replace(/\/+$/, '')}/images/kontext/start-runpod/`
      )
      toast.dismiss(t)
      const s = String(data?.status || '')
      if (['RUNNING', 'STARTING', 'REQUESTED'].includes(s)) {
        toast.success('Img to Img engine is starting.')
      } else if (s === 'HEALTHY') {
        toast.success('Image engine is already live.')
        onEngineOnlineChange?.('kontext', true)
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
        (typeof getAxiosErrorMessage === 'function' ? getAxiosErrorMessage(err) : '') ||
        'Failed to start Img to Img engine.'
      toast.error(msg)
    }
  }

  // WebSocket helpers (same pattern as TextToImage)
  const WS_PATHS = {
    chat: '/ws/emails/generate-ai/',
    refine: '/ws/images/refine-edit-prompt/',
    negatives: '/ws/images/suggest-negatives/',
  }

  const makeWsUrl = (path: string) => {
    try {
      const base = API_BASE_URL || window.location.origin
      const u = new URL(base)
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
      const basePath = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname
      const relPath = path.startsWith('/') ? path : `/${path}`
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

  const startThinkingAnimation = () => {
    let i = 0
    setThinkingLabel('AI is thinking')
    dotsTimerRef.current = setInterval(() => {
      const dots = ['.', '..', '...']
      setThinkingLabel(`AI is thinking${dots[i % dots.length]}`)
      i++
    }, 500)
  }
  const stopThinkingAnimation = () => {
    if (dotsTimerRef.current) { clearInterval(dotsTimerRef.current); dotsTimerRef.current = null }
    setThinkingLabel('')
  }

  // refine
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

  // Download all (single or zip) — works off parent slots
  const handleDownloadAll = async () => {
    const done = doneSlots
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
              if (isGenerating) {
                onCancel()
              } else if (imageFile && prompt.trim()) {
                onGenerate({ prompt: prompt.trim(), negative: negative.trim(), imageFile })
              }
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
              <textarea
                className={styles.chatPromptInput}
                placeholder="Ask anything… (e.g., keep composition, change style)"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                rows={2}
                onKeyDown={(e) => {
                  // Enter = send, Shift+Enter = newline
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
          // Disable ONLY when we’re not generating and can’t generate.
          disabled={!isGenerating && (!prompt.trim() || !imageFile)}
          aria-disabled={!isGenerating && (!prompt.trim() || !imageFile)}
          onClick={() => {
            if (isGenerating) {
              onCancel()
              return
            }
            if (!imageFile || !prompt.trim()) return
            onGenerate({ prompt: prompt.trim(), negative: negative.trim(), imageFile })
          }}
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
            const cancelled = s.status === 'CANCELLED'

            const ariaLabel = s.url
              ? 'Open preview'
              : failed
                ? 'Failed'
                : cancelled
                  ? 'Cancelled'
                  : 'Generating…'

            return (
              <div
                key={s.taskId}
                className={`
                  ${styles.resultCell}
                  ${isLive ? styles.live : ''}
                  ${failed ? styles.failed : ''}
                  ${cancelled ? styles.cancelled : ''}
                `}
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
                aria-label={ariaLabel}
              >
                {!s.url && !failed && !cancelled && (
                  <div className={styles.activeBg}>
                    <div className={styles.pulse} />
                  </div>
                )}

                {failed && <div className={styles.failedNote}>Failed</div>}
                {cancelled && <div className={styles.cancelledNote}>Cancelled</div>}

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

      {/* Preview modal over completed images */}
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
