// src/components/Image/TextToImage/TextToImage.tsx
import { useMemo, useRef, useState, useEffect } from 'react'
import type { GeneralSettingsState } from '../Right/Settings/Settings'
import {
  Sparkles, Info, ChevronDown, ChevronUp, CircleStop, Send, RefreshCcw, Copy, CornerDownLeft, Loader2
} from 'lucide-react'
import styles from './TextToImage.module.css'
import { toast } from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import axios from 'axios'
import {getAxiosErrorMessage } from '../../../lib/api'

type Props = {
  engineOnline: boolean
  settings?: GeneralSettingsState
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const ENGINE_BASE_URL = import.meta.env.VITE_IMAGE_ENGINE_API_BASE_URL // used only for “Start Image Engine” call

// ✅ Routes proxied by your backend (use `api` like VoiceCloning does)
const QUEUE_ROUTE = '/image/image/generate/'
const STATUS_ROUTE = (taskId: string) => `/image/image/task-status/${taskId}`

// ⚠️ These likely live on the engine service (not your main backend)
const START_ENGINE_ROUTE = '/images/start-runpod/'
const CANCEL_ROUTE = '/cancel-task/'

// ---------- utils ----------
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
  'Ultra-detailed portrait of an astronaut, soft rim light, 85mm lens look, hyperreal skin.',
  'Minimal isometric workspace, matte textures, subtle shadows, product hero lighting.',
  'Studio photo of a sneaker on acrylic with water droplets, high contrast, glossy.',
  'Cinematic city street at dusk, wet asphalt reflections, shallow depth of field.',
  'Pastel kawaii mascot character, clean vector style, sticker sheet aesthetic.',
  'Dark UI dashboard hero image, neon blue accents, depth, soft haze.',
  'Photoreal bowl of ramen, steam, moody lighting, 50mm f/1.8 aesthetic.',
  'Fantasy castle on cliff, volumetric god rays, painterly concept art.',
  'Brutalist architecture poster, bold typography, grain, Swiss grid.',
  'Editorial product lay-flat, soft gradient backdrop, diffused light.',
]

export default function TextToImage({ engineOnline, settings }: Props) {
  // prompt state
  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState('')
  const [showTips, setShowTips] = useState(false)

  // mini-chat state
  const [showChat, setShowChat] = useState(false)
  const [askInput, setAskInput] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [thinkingLabel, setThinkingLabel] = useState('')
  const dotsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [lastPrompt, setLastPrompt] = useState('')

  // AI helpers
  const [isRefining, setIsRefining] = useState(false)
  const [refinedDraft, setRefinedDraft] = useState('')
  const [isSuggesting, setIsSuggesting] = useState(false)

  // generation/polling state
  const [isGenerating, setIsGenerating] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const stopPollingRef = useRef(false)

  // websockets
  const wsChatRef = useRef<WebSocket | null>(null)
  const wsRefineRef = useRef<WebSocket | null>(null)
  const wsNegRef = useRef<WebSocket | null>(null)

  const promptWordCount = useMemo(() => countWords(prompt), [prompt])
  const negativeWordCount = useMemo(() => countWords(negative), [negative])
  const CHAR_SOFT_LIMIT = 1000
  const overLimit = prompt.length > CHAR_SOFT_LIMIT

  // state additions near the top
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const pollControllersRef = useRef<Record<string, AbortController>>({});

  // helper
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));


  const imagesRef = useRef<string[]>([]);
  useEffect(() => { imagesRef.current = images }, [images]);
  
  useEffect(() => {
    return () => {
      try { wsChatRef.current?.close() } catch {}
      try { wsRefineRef.current?.close() } catch {}
      try { wsNegRef.current?.close() } catch {}
      if (dotsTimerRef.current) clearInterval(dotsTimerRef.current)
  
      // NEW: abort all per-task poll controllers on unmount
      try { Object.values(pollControllersRef.current).forEach(c => c.abort()); } catch {}
      pollControllersRef.current = {};
  
      // revoke latest images
      revokeAll(imagesRef.current)
    }
  }, []);

  // Stop spinner when all done
  useEffect(() => {
    if (isGenerating && taskIds.length > 0 && completedCount >= taskIds.length) {
      setIsGenerating(false);
      setTaskIds([]);
    }
  }, [completedCount, taskIds.length, isGenerating]);

  // ---------------- ENGINE START (engine service) ----------------
  const handleStartEngine = async () => {
    if (!API_BASE_URL) {
      toast.error('API base URL not set')
      return
    }
    const t = toast.loading('Starting Image Engine...')
    try {
      const { data } = await axios.post(
        `${normalizeBase(API_BASE_URL)}${START_ENGINE_ROUTE}`
      )
      toast.dismiss(t)
      const status = data?.status
      if (['RUNNING', 'STARTING', 'REQUESTED'].includes(status)) toast.success('Image Engine is starting.')
      else if (status === 'HEALTHY') toast.success('Image Engine is already live.')
      else toast.error(`Engine status: ${status || 'Unknown'}`)
    } catch (err: any) {
      toast.dismiss(t)
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        (typeof getAxiosErrorMessage === 'function' ? getAxiosErrorMessage(err) : '') ||
        'Failed to start Image Engine.'
      toast.error(msg)
    }
  };  

  // ---------------- POLLING (mixed: fetch for content-type sniff) ----------------
  // NEW: poll a single task until it returns image/*, then fill its slot
  const pollSingle = async (id: string, slotIndex: number) => {
    try {
      while (!stopPollingRef.current) {
        const controller = new AbortController();
        pollControllersRef.current[id] = controller;

        const res = await fetch(`${normalizeBase(ENGINE_BASE_URL)}${STATUS_ROUTE(id)}`, {
          signal: controller.signal
        });

        const ct = (res.headers.get('content-type') || '').toLowerCase();

        // SUCCESS path: backend streams the image bytes
        if (res.ok && ct.startsWith('image/')) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);

          setImages(prev => {
            const next = [...prev];
            if (next[slotIndex]?.startsWith('blob:')) { try { URL.revokeObjectURL(next[slotIndex]); } catch {} }
            next[slotIndex] = url;           // <-- progressive fill
            return next;
          });

          delete pollControllersRef.current[id];
          setCompletedCount(c => c + 1);
          return; // done for this ID
        }

        // Otherwise parse JSON status
        let data: any = null;
        try { data = await res.json(); } catch {}

        if (data?.state === 'FAILURE') {
          toast.error(data?.error || `Task ${id} failed`);
          delete pollControllersRef.current[id];
          setCompletedCount(c => c + 1); // count it as finished (failed) so UI doesn't hang
          return;
        }

        // PENDING/STARTED/etc
        await delay(1200);
      }
    } catch (e: any) {
      // aborted or network error
      delete pollControllersRef.current[id];
      if (!stopPollingRef.current) toast.error(e?.message || `Task ${id} error`);
      setCompletedCount(c => c + 1);
    }
  };

  // ---------------- QUEUE GENERATION (main backend via `api`) ----------------
  // Modify handleGenerate
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!engineOnline) return toast.error('Engine offline. Start it first.');
    if (!API_BASE_URL) return toast.error('VITE_API_BASE_URL not set');

    setIsGenerating(true);
    setCompletedCount(0);
    setTaskIds([]);
    stopPollingRef.current = false;

    revokeAll(images);
    const batch = Number((settings as any)?.numImages ?? (settings as any)?.batch ?? 1);
    setImages(Array.from({ length: Math.max(1, batch) }, () => '')); // reserve slots

    // build form (as before) + num_images
    const w = settings?.width ?? 768;
    const h = settings?.height ?? 1024;
    const steps = settings?.steps ?? 28;
    const cfg = settings?.cfg ?? 4.0;
    const seedStr = (settings?.seed ?? '').toString().trim();
    const seed = seedStr === '' ? undefined : Number(seedStr);

    const form = new FormData();
    form.append('model', 'krea_dev');
    form.append('prompt', prompt.trim());
    form.append('negative_prompt', negative.trim());
    form.append('width', String(w));
    form.append('height', String(h));
    form.append('guidance_scale', String(cfg));
    form.append('num_inference_steps', String(steps));
    if (Number.isFinite(seed as number)) form.append('seed', String(seed));
    form.append('out_format', 'png');
    form.append('num_images', String(Math.max(1, batch))); // 👈 tell backend

    try {
      const res = await fetch(`${normalizeBase(ENGINE_BASE_URL)}${QUEUE_ROUTE}`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const data = await res.json();

      if (Array.isArray(data?.task_ids) && data.task_ids.length) {
        setTaskIds(data.task_ids);
        data.task_ids.forEach((tid: string, idx: number) => pollSingle(tid, idx));
      } else if (data?.task_id) {
        setTaskIds([data.task_id]);
        pollSingle(data.task_id, 0);
      } else {
        throw new Error('No task IDs returned');
      }
    } catch (e: any) {
      setIsGenerating(false);
      toast.error(e?.message || 'Failed to queue generation');
    }
  };


  // ---------------- CANCEL GENERATION (engine service) ----------------
  // Cancel: abort all polls
  const handleCancelGenerate = async () => {
    stopPollingRef.current = true;

    // cancel engine tasks if you keep the cancel route (optional)
    if (ENGINE_BASE_URL && taskIds.length) {
      for (const id of taskIds) {
        try {
          const fd = new FormData();
          fd.append('task_id', id);
          await fetch(`${normalizeBase(ENGINE_BASE_URL)}${CANCEL_ROUTE}`, { method: 'POST', body: fd });
        } catch {}
      }
    }

    try {
      Object.values(pollControllersRef.current).forEach(c => c.abort());
    } catch {}
    pollControllersRef.current = {};

    setIsGenerating(false);
    setTaskIds([]);
    setCompletedCount(0);
    toast('Generation cancelled.');
  };

  // ---------------- WebSocket helpers (unchanged, but proxied through your backend) ----------------
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

  const WS_PATHS = {
    chat: '/ws/emails/generate-ai/',
    refine: '/ws/images/refine-prompt/',
    negatives: '/ws/images/suggest-negatives/',
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

  // --- Refine Prompt (streams to refinedDraft) ---
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

  // --- Suggest Negatives (streams to negative) ---
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

  // ——— Chat WS ———
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

  // ---------------- UI ----------------
  return (
    <div className={styles.wrap}>
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
          placeholder="Describe the image you want…"
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
            <textarea className={`${styles.input} ${styles.textarea}`} value={refinedDraft} readOnly rows={4} />
          </div>
        )}

        {/* Collapsible Chat Panel */}
        {showChat && (
          <div id="promptChatPanel" className={styles.chatCard}>
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
              <button className={styles.chatSendBtn} onClick={handleChatAsk} type="button" title={isTyping ? 'Stop' : 'Send'}>
                {isTyping ? <CircleStop size={18} /> : <Send size={18} />}
              </button>
            </div>
            {isTyping && thinkingLabel && <div className={styles.chatThinking}>{thinkingLabel}</div>}

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
                  <button className={styles.chatIconBtn} onClick={handleRegenerate} disabled={isTyping || !lastPrompt}>
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
                  <button className={styles.chatIconBtnPrimary} onClick={handleApplyToPrompt} disabled={!aiResponse.trim()}>
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
          <>
            <button
              className={styles.primaryBtn}
              disabled={!prompt.trim() || isGenerating}
              onClick={handleGenerate}
              aria-disabled={!prompt.trim() || isGenerating}
            >
              {isGenerating ? <Loader2 className={styles.spinner} /> : <Sparkles size={16} />}
              {isGenerating ? 'Generating…' : 'Generate'}
            </button>
            {isGenerating && (
              <button className={styles.secondaryBtn} onClick={handleCancelGenerate} type="button">
                <CircleStop size={16} />
                Cancel
              </button>
            )}
          </>
        ) : (
          <button className={styles.primaryBtn} onClick={handleStartEngine} type="button">
            Start Image Engine
          </button>
        )}
      </div>

      {/* Results */}
      {images.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionHeader}>Results</h3>
          <div className={styles.gallery}>
            {images.map((src, i) => (
              <div className={styles.thumb} key={i}>
                <img src={src} alt={`Generated ${i + 1}`} />
                <a className={styles.downloadLink} href={src} download={`krea_${i + 1}.png`}>Download</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
