import { useMemo, useRef, useState } from 'react'
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
  const controllerRef = useRef<AbortController | null>(null)
  const dotsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [lastPrompt, setLastPrompt] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)

  const promptCount = useMemo(() => countWords(prompt), [prompt])
  const negativeCount = useMemo(() => countWords(negative), [negative])

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

  const streamToState = async (
    res: Response,
    onChunk: (s: string) => void
  ) => {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder('utf-8')
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
  
      // Expecting SSE "data: {token: '...'}"
      const lines = chunk.split('\n').filter(l => l.trim().startsWith('data:'))
      if (lines.length) {
        for (const line of lines) {
          const data = line.replace('data: ', '').trim()
          if (data === '[DONE]') {
            reader.cancel?.()
            break
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.token) onChunk(parsed.token)
            else if (typeof parsed === 'string') onChunk(parsed)
          } catch {
            onChunk(data)
          }
        }
      } else {
        // fallback: raw append
        onChunk(chunk)
      }
    }
  }

  const handleRefinePrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Write a prompt first.')
      return
    }
    if (isRefining) return
  
    setIsRefining(true)
    // optionally keep original so user can undo if you add an undo later
    setPrompt('') // stream replaces it progressively
  
    try {
      const res = await fetch(`${API_BASE_URL}/images/refine-prompt/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // backend streams ONLY the refined prompt
        body: JSON.stringify({ prompt, stream: true }),
      })
      if (!res.ok || !res.body) {
        const t = await res.text()
        throw new Error(t || 'Failed to refine prompt')
      }
  
      await streamToState(res, (s) => {
        // progressively write refined prompt
        setPrompt(prev => (prev || '') + s)
      })
    } catch (e: any) {
      toast.error(e?.message || 'Refine failed')
    } finally {
      setIsRefining(false)
    }
  }
  
  // --- suggest negatives (uses image route) ---
  const handleSuggestWithAI = async () => {
    if (!prompt.trim()) {
      toast.error('Write a prompt first.')
      return
    }
    if (isSuggesting) return
  
    setIsSuggesting(true)
    setNegative('') // stream replaces it progressively
  
    try {
      const res = await fetch(`${API_BASE_URL}/images/suggest-negatives/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // backend streams ONLY a single comma-separated negatives line
        body: JSON.stringify({ prompt, stream: true }),
      })
      if (!res.ok || !res.body) {
        const t = await res.text()
        throw new Error(t || 'Failed to suggest negatives')
      }
  
      await streamToState(res, (s) => {
        setNegative(prev => (prev || '') + s)
      })
    } catch (e: any) {
      toast.error(e?.message || 'Suggestion failed')
    } finally {
      setIsSuggesting(false)
    }
  }

  const applyTemplate = (t: string) => setPrompt(t)

  // ——— Chat: identical “ask / cancel + streaming + animation” pattern ———
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
      controllerRef.current?.abort()
      return
    }
    if (!text.trim()) return
  
    setAiResponse('')
    setIsTyping(true)
    setLastPrompt(text)
    startThinkingAnimation()
  
    const ac = new AbortController()
    controllerRef.current = ac
  
    try {
      // ✅ IDENTICAL PAYLOAD SHAPE TO EMAIL ASSISTANT (+ keep your negative)
      const res = await fetch(`${API_BASE_URL}/emails/generate-ai-email/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          history: conversationHistory, // keep thread
          stream: true,                 // force SSE tokens like EmailAssistant
          negative,                     // fine if backend ignores it
        }),
        signal: ac.signal,
      })
  
      if (!res.ok || !res.body) {
        const errText = await res.text()
        throw new Error(errText || 'Request failed')
      }
  
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
  
      // local buffer to commit to history at the end (prevents race w/ state)
      let full = ''
  
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
  
        // Same SSE handling as EmailAssistant
        const lines = chunk
          .split('\n')
          .filter((line) => line.trim().startsWith('data:'))
  
        for (const line of lines) {
          const data = line.replace('data: ', '').trim()
          if (data === '[DONE]') {
            // stop streaming cleanly
            reader.cancel?.()
            break
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.token) {
              full += parsed.token
              setAiResponse((prev) => prev + parsed.token)
            } else if (typeof parsed === 'string') {
              full += parsed
              setAiResponse((prev) => prev + parsed)
            }
          } catch {
            // non-JSON chunk
            full += data
            setAiResponse((prev) => prev + data)
          }
        }
      }
  
      // ✅ commit to history like EmailAssistant
      setConversationHistory((prev) => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: full },
      ])
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setAiResponse((prev) => (prev || '') + '\n\n[Error receiving response]')
      }
    } finally {
      setIsTyping(false)
      controllerRef.current = null
      stopThinkingAnimation()
    }
  }  

  const handleChatAsk = () => {
    if (isTyping) {
      controllerRef.current?.abort()
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
            {/* Input + Send/Stop (identical behavior to Email Assistant) */}
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

            {/* Actions with tooltips (regen / copy / insert-to-prompt icon) */}
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

      {/* Tips (collapsible, TTS style) */}
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
