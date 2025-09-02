// src/components/TextToImage/TextToImage.tsx
import { useMemo, useRef, useState, useEffect } from 'react'
import type { GeneralSettingsState } from '../Settings'
import {
  Sparkles, Info, ChevronDown, ChevronUp, CircleStop, Send, RefreshCcw, Copy, CornerDownLeft
} from 'lucide-react'
import styles from './TextToImage.module.css'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type Props = {
  engineOnline: boolean
  settings: GeneralSettingsState
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// --- WS endpoints (adjust if your backend uses different paths) ---
const WS_PATHS = {
  chat: '/ws/emails/generate-ai/',
  refine: '/ws/images/refine-prompt/',
  negatives: '/ws/images/suggest-negatives/',
}

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).filter(Boolean).length : 0)
const FLUX_PROMPT_GUIDE_TOKENS = 512

const PROMPT_TEMPLATES = [
  "Ultra-detailed portrait of an astronaut, soft rim light, 85mm lens look, hyperreal skin.",
  "Minimal isometric workspace, matte textures, subtle shadows, product hero lighting.",
  "Studio photo of a sneaker on acrylic with water droplets, high contrast, glossy.",
  "Cinematic city street at dusk, wet asphalt reflections, shallow depth of field.",
  "Pastel kawaii mascot character, clean vector style, sticker sheet aesthetic.",
  "Dark UI dashboard hero image, neon blue accents, depth, soft haze.",
  "Photoreal bowl of ramen, steam, moody lighting, 50mm f/1.8 aesthetic.",
  "Fantasy castle on cliff, volumetric god rays, painterly concept art.",
  "Brutalist architecture poster, bold typography, grain, Swiss grid.",
  "Editorial product lay-flat, soft gradient backdrop, diffused light."
]

export default function TextToImage({ engineOnline }: Props) {
  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState('')
  const [showTips, setShowTips] = useState(false)
  const [showChat, setShowChat] = useState(false)

  // mini-chat state (mirrors Email Assistant behavior)
  const [askInput, setAskInput] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const dotsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [lastPrompt, setLastPrompt] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)

  // three dedicated sockets (chat / refine / negatives)
  const wsChatRef = useRef<WebSocket | null>(null)
  const wsRefineRef = useRef<WebSocket | null>(null)
  const wsNegRef = useRef<WebSocket | null>(null)

  const promptCount = useMemo(() => countWords(prompt), [prompt])
  const negativeCount = useMemo(() => countWords(negative), [negative])

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
      // reuse if already open
      if (ref.current && ref.current.readyState === WebSocket.OPEN) {
        return resolve(ref.current)
      }
      // close stale
      if (ref.current) {
        try { ref.current.close() } catch {}
      }
      const ws = new WebSocket(makeWsUrl(path))
      ref.current = ws

      ws.onopen = () => resolve(ws)
      ws.onerror = (ev) => {
        console.error('WebSocket error:', ev)
        reject(new Error('WebSocket error'))
      }
      // caller sets .onmessage / .onclose as needed
    })
  }

  // cleanup on unmount
  useEffect(() => {
    return () => {
      try { wsChatRef.current?.close() } catch {}
      try { wsRefineRef.current?.close() } catch {}
      try { wsNegRef.current?.close() } catch {}
    }
  }, [])

  const handleStartEngine = async () => {
    toast.loading('Starting Image Engine...')
    try {
      const res = await axios.post(`${API_BASE_URL}/voice/start-runpod/`)
      toast.dismiss()
      const status = res.data.status
      if (['RUNNING', 'STARTING', 'REQUESTED'].includes(status)) toast.success('Image Engine is starting.')
      else if (status === 'HEALTHY') toast.success('Image Engine is already live. Refresh if needed.')
      else toast.error(`Engine status: ${status || 'Unknown'}`)
    } catch (err) {
      toast.dismiss()
      toast.error('Failed to start Image Engine.')
    }
  }

  const handleGenerate = () => {
    if (!engineOnline || !prompt.trim()) return
    // TODO: POST { prompt, negative, ...settings } to your image endpoint
  }

  // --- WS versions for Refine + Negatives ---

  const handleRefinePrompt = async () => {
    if (!prompt.trim() || isRefining) return
    setIsRefining(true)
    const original = prompt
    setPrompt('') // stream refined version progressively

    try {
      const ws = await openSocket(WS_PATHS.refine, wsRefineRef)

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'started') return
          if (msg.token) {
            setPrompt(prev => (prev || '') + msg.token)
            return
          }
          if (msg.done) {
            setIsRefining(false)
            return
          }
          if (msg.error) {
            toast.error(String(msg.error))
            setIsRefining(false)
          }
        } catch {
          // fallback: append raw
          setPrompt(prev => (prev || '') + String(e.data || ''))
        }
      }

      ws.onclose = (_ev) => {
        if (isRefining) setIsRefining(false)
      }

      // send job
      const payload = { prompt: original }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload))
      } else {
        ws.addEventListener('open', () => ws.send(JSON.stringify(payload)), { once: true })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Refine failed')
      setIsRefining(false)
    }
  }

  const handleSuggestWithAI = async () => {
    if (!prompt.trim() || isSuggesting) return
    setIsSuggesting(true)
    setNegative('') // stream negatives progressively

    try {
      const ws = await openSocket(WS_PATHS.negatives, wsNegRef)

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.event === 'started') return
          if (msg.token) {
            setNegative(prev => (prev || '') + msg.token)
            return
          }
          if (msg.done) {
            setIsSuggesting(false)
            return
          }
          if (msg.error) {
            toast.error(String(msg.error))
            setIsSuggesting(false)
          }
        } catch {
          setNegative(prev => (prev || '') + String(e.data || ''))
        }
      }

      ws.onclose = () => {
        if (isSuggesting) setIsSuggesting(false)
      }

      const payload = { prompt }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload))
      } else {
        ws.addEventListener('open', () => ws.send(JSON.stringify(payload)), { once: true })
      }
    } catch (err: any) {
      toast.error(err?.message || 'Suggestion failed')
      setIsSuggesting(false)
    }
  }

  // ——— Chat: WS version (reuses /ws/emails/generate-ai/) ———

  const startThinkingAnimation = () => {
    let i = 0
    setAskInput('AI is thinking')
    dotsTimerRef.current = setInterval(() => {
      const dots = ['.', '..', '...']
      setAskInput(`AI is thinking${dots[i % dots.length]}`)
      i++
    }, 500)
  }
  const stopThinkingAnimation = () => {
    if (dotsTimerRef.current) {
      clearInterval(dotsTimerRef.current)
      dotsTimerRef.current = null
    }
    setAskInput('')
  }

  const sendChatPrompt = async (text: string) => {
    if (isTyping) {
      try { wsChatRef.current?.close(4001, 'client cancel') } catch {}
      return
    }
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

          if (msg.token) {
            full += msg.token
            setAiResponse(prev => prev + msg.token)
            return
          }
          if (msg.done) {
            setIsTyping(false)
            stopThinkingAnimation()
            setConversationHistory(prev => [
              ...prev,
              { role: 'user', content: text },
              { role: 'assistant', content: full },
            ])
            return
          }
          if (msg.error) {
            setIsTyping(false)
            stopThinkingAnimation()
            toast.error(String(msg.error))
          }
        } catch (err) {
          // non-JSON chunk
          const s = String(e.data || '')
          full += s
          setAiResponse(prev => prev + s)
        }
      }

      ws.onerror = () => {
        setIsTyping(false)
        stopThinkingAnimation()
        toast.error('WebSocket error')
      }

      ws.onclose = (_ev) => {
        // if closed early without done, leave whatever we got
        if (isTyping) {
          setIsTyping(false)
          stopThinkingAnimation()
        }
      }

      const payload = {
        prompt: text,
        history: conversationHistory || [],
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload))
      } else {
        ws.addEventListener('open', () => ws.send(JSON.stringify(payload)), { once: true })
      }
    } catch (e: any) {
      setIsTyping(false)
      stopThinkingAnimation()
      toast.error(e?.message || 'Failed to start chat')
    }
  }

  const handleChatAsk = () => {
    if (isTyping) {
      try { wsChatRef.current?.close(4001, 'client cancel') } catch {}
      return
    }
    if (!askInput.trim()) return
    sendChatPrompt(askInput.trim())
  }

  const handleRegenerate = () => {
    if (!lastPrompt || isTyping) return
    sendChatPrompt(lastPrompt)
  }

  const handleCopy = async () => {
    if (!aiResponse) return
    try {
      await navigator.clipboard.writeText(aiResponse)
      toast.success('Copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  const handleApplyToPrompt = () => {
    if (!aiResponse.trim()) return
    setPrompt(aiResponse.trim())
    toast.success('Inserted into Prompt')
  }

  const applyTemplate = (t: string) => setPrompt(t)

  return (
    <div className={styles.wrap}>
      {/* Prompt */}
      <div className={styles.section}>
        <div className={styles.labelRow}>
          <h3 className={styles.sectionHeader}>Prompt</h3>
          <span className={styles.counter} aria-live="polite">
            {promptCount} tokens
          </span>
        </div>

        <textarea
          className={`${styles.input} ${styles.textarea}`}
          placeholder="Describe the image you want…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
        />

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

        {/* Collapsible Chat Panel */}
        {showChat && (
          <div id="promptChatPanel" className={styles.chatCard}>
            {/* Input + Send/Stop */}
            <div className={styles.chatPromptBar}>
              <input
                type="text"
                placeholder="Ask anything… (e.g., make it cinematic, one subject, 85mm)"
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleChatAsk()
                  }
                }}
              />
              <button className={styles.chatSendBtn} onClick={handleChatAsk} type="button">
                {isTyping ? <CircleStop size={18} /> : <Send size={18} />}
              </button>
            </div>

            {/* Response box */}
            <div className={styles.chatResponseBox}>
              <div className={styles.chatResponseText}>
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                  {aiResponse}
                </ReactMarkdown>
              </div>
            </div>

            {/* Actions */}
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
            {negativeCount} tokens
          </span>
        </div>

        <textarea
          className={`${styles.input} ${styles.textarea}`}
          placeholder="Things to avoid (e.g., blur, extra fingers, text)…"
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

      {/* Tips (collapsible) */}
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
            disabled={!prompt.trim()}
            onClick={handleGenerate}
            aria-disabled={!prompt.trim()}
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
