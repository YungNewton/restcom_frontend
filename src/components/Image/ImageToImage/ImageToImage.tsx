import { useMemo, useRef, useState, useEffect } from 'react'
import type { GeneralSettingsState } from '../Right/Settings/Settings'
import {
  Sparkles, Info, ChevronDown, ChevronUp, CircleStop, Send, RefreshCcw, Copy, CornerDownLeft, Upload, Trash
} from 'lucide-react'
import styles from './ImageToImage.module.css'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type Props = {
  engineOnline: boolean
  settings?: GeneralSettingsState // optional for now (handleGenerate paused)
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const WS_PATHS = {
  chat: '/ws/emails/generate-ai/',
  refine: '/ws/images/refine-edit-prompt/',   // ← new route
  negatives: '/ws/images/suggest-negatives/',
}

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0)
const FLUX_PROMPT_GUIDE_TOKENS = 512

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

export default function ImageToImage({ engineOnline }: Props) {
  // Single source image + preview URL
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState('')
  const [showTips, setShowTips] = useState(false)
  const [showChat, setShowChat] = useState(false)

  // mini-chat state (refinement chat)
  const [askInput, setAskInput] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [thinkingLabel, setThinkingLabel] = useState('') // decoupled from askInput
  const dotsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [lastPrompt, setLastPrompt] = useState('')

  const [isRefining, setIsRefining] = useState(false)
  const [refinedDraft, setRefinedDraft] = useState('') // stream refined text here

  const [isSuggesting, setIsSuggesting] = useState(false)

  // sockets
  const wsChatRef = useRef<WebSocket | null>(null)
  const wsRefineRef = useRef<WebSocket | null>(null)
  const wsNegRef = useRef<WebSocket | null>(null)

  const promptWordCount = useMemo(() => countWords(prompt), [prompt])
  const negativeWordCount = useMemo(() => countWords(negative), [negative])

  // utils
  function makeWsUrl(path: string) {
    try {
      const base = API_BASE_URL || window.location.origin
      const u = new URL(base)
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
      // join without losing existing base path
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

  // engine
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

  const handleGenerate = () => {
    if (!engineOnline || !prompt.trim() || !imageFile) return
    // paused for now – wire later (send prompt, negative, and imageFile)
  }

  // refine
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

  // negatives
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

  // chat
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
    setAiResponse('')
    setIsTyping(true)
    setLastPrompt(text)
    startThinkingAnimation()
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
    const text = askInput.trim()
    if (!text) return
    setAskInput('') // clear input after send
    sendChatPrompt(text)
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
    setPrompt(aiResponse.trim())
    toast.success('Inserted into Prompt')
  }

  const applyTemplate = (t: string) => setPrompt(t)

  // Single image upload handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 100 * 1024 * 1024) return toast.error(`"${f.name}" exceeds 50MB limit.`)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImageFile(f)
    setPreviewUrl(URL.createObjectURL(f))
  }
  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImageFile(null)
    setPreviewUrl(null)
  }

  const CHAR_SOFT_LIMIT = 1000
  const overLimit = prompt.length > CHAR_SOFT_LIMIT

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

        {/* Suggestion cards */}
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
            disabled={!prompt.trim() || !imageFile}
            onClick={handleGenerate}
            aria-disabled={!prompt.trim() || !imageFile}
          >
            <Sparkles size={16} />
            Generate
          </button>
        ) : (
          <button className={styles.primaryBtn} onClick={handleStartEngine} type="button">
            Start Image Engine
          </button>
        )}
      </div>
    </div>
  )
}
