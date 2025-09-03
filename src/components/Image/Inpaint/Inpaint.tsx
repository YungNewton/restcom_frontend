// src/components/Inpaint/Inpaint.tsx
import { useMemo, useRef, useState, useEffect } from 'react'
import type { GeneralSettingsState } from '../Settings'
import {
  Sparkles, Info, ChevronDown, ChevronUp, CircleStop, Send, RefreshCcw, Copy,
  CornerDownLeft, Upload, Trash, Brush, Eraser, RotateCcw, Droplet
} from 'lucide-react'
import styles from './Inpaint.module.css'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type Props = {
  engineOnline: boolean
  settings?: GeneralSettingsState
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const WS_PATHS = {
  chat: '/ws/emails/generate-ai/',
  refine: '/ws/images/refine-edit-prompt/',
  negatives: '/ws/images/suggest-negatives/',
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

export default function Inpaint({ engineOnline }: Props) {
  // Reference image
  const [refFile, setRefFile] = useState<File | null>(null)
  const [refPreview, setRefPreview] = useState<string | null>(null)

  // Optional uploaded mask
  const [maskFile, setMaskFile] = useState<File | null>(null)
  const [maskPreview, setMaskPreview] = useState<string | null>(null)

  // Canvas mask
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawFrameRef = useRef<HTMLDivElement | null>(null) // where img+canvas live
  const [useCanvasMask, setUseCanvasMask] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(6)
  const [mode, setMode] = useState<'brush' | 'erase'>('brush')
  const [maskColor, setMaskColor] = useState<MaskColor>('white')

  // Track if canvas has strokes so we can persist to upload preview when switching
  const [isMaskDirty, setIsMaskDirty] = useState(false)

  // Prompting
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

  // sockets
  const wsChatRef = useRef<WebSocket | null>(null)
  const wsRefineRef = useRef<WebSocket | null>(null)
  const wsNegRef = useRef<WebSocket | null>(null)

  const promptWordCount = useMemo(() => countWords(prompt), [prompt])
  const negativeWordCount = useMemo(() => countWords(negative), [negative])

  const DEFAULT_FRAME_WIDTH = 420
  const MIN_FRAME_WIDTH = 320
  const MAX_FRAME_WIDTH = 900

  // --- utils ---
  function makeWsUrl(path: string) {
    try {
      const base = API_BASE_URL || window.location.origin
      const u = new URL(base)
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
      u.pathname = path
      return u.toString()
    } catch {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      return `${proto}://${location.host}${path}`
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

  // --- lifecycle cleanup ---
  useEffect(() => {
    return () => {
      try { wsChatRef.current?.close() } catch {}
      try { wsRefineRef.current?.close() } catch {}
      try { wsNegRef.current?.close() } catch {}
      if (dotsTimerRef.current) clearInterval(dotsTimerRef.current)
      if (refPreview?.startsWith('blob:')) URL.revokeObjectURL(refPreview)
      if (maskPreview?.startsWith('blob:')) URL.revokeObjectURL(maskPreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      // transparent mask initially
      ctx.clearRect(0, 0, w, h)
      setIsMaskDirty(false)
    }
    img.src = imgUrl
  }

  // Init whenever reference changes
  useEffect(() => {
    if (!refPreview) return
    requestAnimationFrame(() => initCanvasFromRef(refPreview))
  }, [refPreview])

  // Re-init when toggling back to Draw (hide/show keeps DOM mounted)
  useEffect(() => {
    if (useCanvasMask && refPreview) {
      requestAnimationFrame(() => initCanvasFromRef(refPreview))
    }
  }, [useCanvasMask, refPreview])

  // Re-init on frame resize (prevents lost sizing)
  useEffect(() => {
    const frame = drawFrameRef.current
    if (!frame || !refPreview) return
    const ro = new ResizeObserver(() => {
      if (useCanvasMask) initCanvasFromRef(refPreview)
    })
    ro.observe(frame)
    return () => ro.disconnect()
  }, [refPreview, useCanvasMask])

  // --- engine ---
  const handleStartEngine = async () => {
    toast.loading('Starting Image Engine...')
    try {
      const res = await axios.post(`${API_BASE_URL}/image/start-runpod/`)
      toast.dismiss()
      const status = res.data.status
      if (['RUNNING', 'STARTING', 'REQUESTED'].includes(status)) toast.success('Image Engine is starting.')
      else if (status === 'HEALTHY') toast.success('Image Engine is already live. Refresh if needed.')
      else toast.error(`Engine status: ${status || 'Unknown'}`)
    } catch {
      toast.dismiss()
      toast.error('Failed to start Image Engine.')
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

  const onPickMask = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 100 * 1024 * 1024) return toast.error(`"${f.name}" exceeds 100MB limit.`)
    if (maskPreview?.startsWith('blob:')) URL.revokeObjectURL(maskPreview)
    setMaskFile(f)
    const url = URL.createObjectURL(f)
    setMaskPreview(url)
    setUseCanvasMask(false)
    setIsMaskDirty(false)
  }

  const clearRef = () => {
    if (refPreview?.startsWith('blob:')) URL.revokeObjectURL(refPreview)
    setRefFile(null); setRefPreview(null)
    clearCanvas()
  }
  const clearMaskUpload = () => {
    if (maskPreview?.startsWith('blob:')) URL.revokeObjectURL(maskPreview)
    setMaskFile(null); setMaskPreview(null)
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
    if (!useCanvasMask) return
    setIsDrawing(true)
    const p = getPointerPos(e)
    drawAt(p.x, p.y)
  }
  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!useCanvasMask || !isDrawing) return
    const p = getPointerPos(e)
    drawAt(p.x, p.y)
  }
  const handleCanvasUp = () => setIsDrawing(false)

  const clearCanvas = () => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    setIsMaskDirty(false)
  }

  const exportCanvasMaskBlob = async (): Promise<Blob | null> => {
    const c = canvasRef.current
    if (!c) return null
    return await new Promise<Blob | null>((resolve) => c.toBlob(b => resolve(b), 'image/png'))
  }

  async function persistCanvasToUploadPreview() {
    if (!isMaskDirty || !canvasRef.current) return
    const blob = await exportCanvasMaskBlob()
    if (!blob) return
    if (maskPreview?.startsWith('blob:')) URL.revokeObjectURL(maskPreview)
    const file = new File([blob], 'mask-from-canvas.png', { type: 'image/png' })
    setMaskFile(file)
    const url = URL.createObjectURL(file)
    setMaskPreview(url)
  }

  const switchToUploadMask = async () => {
    await persistCanvasToUploadPreview()
    setUseCanvasMask(false)
  }
  const switchToCanvasMask = () => {
    setUseCanvasMask(true)
    if (maskPreview?.startsWith('blob:')) URL.revokeObjectURL(maskPreview)
    setMaskFile(null)
    setMaskPreview(null)
  }

  // --- generate (placeholder) ---
  const handleGenerate = async () => {
    if (!engineOnline || !prompt.trim() || !refFile) return
    try {
      let maskBlob: Blob | null = null
      if (useCanvasMask) {
        maskBlob = await exportCanvasMaskBlob()
      } else if (maskFile) {
        maskBlob = maskFile
      }

      if (!maskBlob) {
        toast.error('Provide a mask (draw one or upload).')
        return
      }

      // const fd = new FormData()
      // fd.append('prompt', prompt)
      // fd.append('negative', negative)
      // fd.append('image', refFile)
      // fd.append('mask', maskBlob, 'mask.png')
      // await axios.post(`${API_BASE_URL}/image/inpaint/`, fd)

      toast.success('Ready to inpaint (stubbed).')
    } catch (e: any) {
      toast.error(e?.message || 'Inpaint failed')
    }
  }

  // --- refine ---
  const handleRefinePrompt = async () => {
    if (!prompt.trim() || isRefining) return
    setIsRefining(true)
    setRefinedDraft('')
    try {
      const ws = await openSocket(WS_PATHS.refine, wsRefineRef)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'started') return
          if (msg.token) { setRefinedDraft(prev => (prev || '') + msg.token); return }
          if (msg.done) { setIsRefining(false); return }
          if (msg.error) { toast.error(String(msg.error)); setIsRefining(false) }
        } catch { setRefinedDraft(prev => (prev || '') + String(e.data || '')) }
      }
      ws.onclose = () => { if (isRefining) setIsRefining(false) }
      const payload = { prompt }
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
      else ws.addEventListener('open', () => ws.send(JSON.stringify(payload)), { once: true })
    } catch (err: any) {
      toast.error(err?.message || 'Refine failed')
      setIsRefining(false)
    }
  }

  // --- negatives ---
  const handleSuggestWithAI = async () => {
    if (!prompt.trim() || isSuggesting) return
    setIsSuggesting(true)
    setNegative('')
    try {
      const ws = await openSocket(WS_PATHS.negatives, wsNegRef)
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
        if (msg.event === 'started') return
          if (msg.token) { setNegative(prev => (prev || '') + msg.token); return }
          if (msg.done) { setIsSuggesting(false); return }
          if (msg.error) { toast.error(String(msg.error)); setIsSuggesting(false) }
        } catch { setNegative(prev => (prev || '') + String(e.data || '')) }
      }
      ws.onclose = () => { if (isSuggesting) setIsSuggesting(false) }
      const payload = { prompt }
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
      else ws.addEventListener('open', () => ws.send(JSON.stringify(payload)), { once: true })
    } catch (err: any) {
      toast.error(err?.message || 'Suggestion failed')
      setIsSuggesting(false)
    }
  }

  // --- chat ---
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

  const CHAR_SOFT_LIMIT = 1000
  const overLimit = prompt.length > CHAR_SOFT_LIMIT

  return (
    <div className={styles.wrap}>
      {/* Reference image */}
      <div className={styles.section}>
        <h3 className={styles.sectionHeader}>Reference Image</h3>
        <label className={styles.uploadBox}>
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

      {/* Mask section */}
      <div className={styles.section}>
        <div className={styles.labelRow}>
          <h3 className={styles.sectionHeader}>Mask</h3>
        <div className={styles.actionGroupLeft} style={{ gap: '0.5rem' }}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={switchToCanvasMask}
              aria-pressed={useCanvasMask}
              title="Draw mask on canvas"
            >
              Draw Mask
            </button>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={switchToUploadMask}
              aria-pressed={!useCanvasMask}
              title="Upload mask image"
            >
              Upload Mask
            </button>
          </div>
        </div>

        {/* --- BOTH PANES MOUNTED; we toggle with display --- */}

        {/* Draw (canvas) pane */}
        <div style={{ display: useCanvasMask ? 'block' : 'none' }}>
          {!refPreview ? (
            <div className={styles.infoMini}>Upload a reference image first to enable drawing.</div>
          ) : (
            <>
              {/* TOOLBAR */}
              <div className={`${styles.actionRowLeft} ${styles.toolbarRow}`}>
                {/* Brush */}
                <div className={styles.tooltipWrapper} data-tooltip="Brush (B)">
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
                <div className={styles.tooltipWrapper} data-tooltip="Eraser (E)">
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

                {/* Clear mask */}
                <div className={styles.tooltipWrapper} data-tooltip="Clear mask (Reset strokes)">
                  <button
                    className={styles.chatIconBtn}
                    onClick={clearCanvas}
                    type="button"
                    aria-label="Clear mask"
                    title="Clear mask"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>

                {/* Mask color */}
                <div className={styles.colorGroup}>
                  <span className={styles.colorLabel}>
                    <Droplet size={14} />
                    Color
                  </span>
                  <div className={styles.actionGroupLeft}>
                    <div className={styles.tooltipWrapper} data-tooltip="Mask color: Black (keep)">
                      <button
                        type="button"
                        className={`${styles.secondaryBtn} ${styles.chip}`}
                        aria-pressed={maskColor === 'black'}
                        onClick={() => setMaskColor('black')}
                        aria-label="Mask color black"
                        title="Mask color: Black (keep)"
                      >
                        Black
                      </button>
                    </div>

                    <div className={styles.tooltipWrapper} data-tooltip="Mask color: Gray (soft)">
                      <button
                        type="button"
                        className={`${styles.secondaryBtn} ${styles.chip}`}
                        aria-pressed={maskColor === 'gray'}
                        onClick={() => setMaskColor('gray')}
                        aria-label="Mask color gray"
                        title="Mask color: Gray (soft)"
                      >
                        Gray
                      </button>
                    </div>

                    <div className={styles.tooltipWrapper} data-tooltip="Mask color: White (edit)">
                      <button
                        type="button"
                        className={`${styles.secondaryBtn} ${styles.chip}`}
                        aria-pressed={maskColor === 'white'}
                        onClick={() => setMaskColor('white')}
                        aria-label="Mask color white"
                        title="Mask color: White (edit)"
                      >
                        White
                      </button>
                    </div>
                  </div>
                </div>

                {/* Brush size */}
                <div className={`${styles.brushGroup} ${styles.tooltipWrapper}`} data-tooltip="Brush size">
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
                {/* reference image under transparent canvas */}
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
                />
              </div>

              <div className={styles.infoMini} style={{ marginTop: '0.35rem' }}>
                White - edit, Black - keep, Gray - soft edit. Use Erase to remove strokes.
              </div>
            </>
          )}
        </div>

        {/* Upload pane (kept mounted, just hidden) */}
        <div style={{ display: useCanvasMask ? 'none' : 'block' }}>
          <label className={styles.uploadBox}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickMask} />
            {!maskPreview ? (
              <div className={styles.uploadInner}>
                <Upload size={24} />
                <p>Upload a mask</p>
                <p className={styles.subText}>White - edit, Black - keep, Gray - soft</p>
              </div>
            ) : (
              <div className={styles.previewWrap}>
                <img src={maskPreview} alt="mask" className={styles.previewImg} />
                <button type="button" className={styles.previewRemove} onClick={clearMaskUpload} title="Remove">
                  <Trash size={14} />
                </button>
              </div>
            )}
          </label>
        </div>
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
          placeholder="Describe what to change in the masked area…"
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
                placeholder="Ask anything… (e.g., replace logo, match lighting)"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleChatAsk()
                  }
                }}
                aria-label="Chat input"
                title="Type your request and press Enter"
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
                <div className={styles.tooltipWrapper} data-tooltip="Regenerate last answer">
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
                <div className={styles.tooltipWrapper} data-tooltip="Copy to clipboard">
                  <button className={styles.chatIconBtn} onClick={handleCopy} aria-label="Copy" title="Copy">
                    <Copy size={16} />
                  </button>
                </div>
                <div className={styles.tooltipWrapper} data-tooltip="Insert into Prompt">
                  <button
                    className={styles.chatIconBtnPrimary}
                    onClick={handleApplyToPrompt}
                    disabled={!aiResponse.trim()}
                    aria-label="Insert to Prompt"
                    title="Insert to Prompt"
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
          placeholder="Things to avoid (e.g., mismatched lighting, artifacts, blur)…"
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
            title={!prompt.trim() ? 'Enter a prompt first' : 'Suggest negatives with AI'}
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

      {/* Generate / Start */}
      <div className={styles.actionRow}>
        {engineOnline ? (
          <button
            className={styles.primaryBtn}
            disabled={!prompt.trim() || !refFile}
            onClick={handleGenerate}
            aria-disabled={!prompt.trim() || !refFile}
            title={!prompt.trim() || !refFile ? 'Upload an image and enter a prompt' : 'Generate inpaint'}
          >
            <Sparkles size={16} />
            Generate
          </button>
        ) : (
          <button className={styles.primaryBtn} onClick={handleStartEngine} type="button" title="Start image engine">
            Start Image Engine
          </button>
        )}
      </div>
    </div>
  )
}