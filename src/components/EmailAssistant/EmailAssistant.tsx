import { useEffect, useState, useRef } from 'react'
import { ChevronDown, ChevronUp, RefreshCcw, Copy, Mail, Send } from 'lucide-react'
import styles from './EmailAssistant.module.css'
import sparkleIcon from '../../assets/sparkle-icon.png'
import playIcon from '../../assets/play.png'
import uploadIcon from '../../assets/upload.png'
import { CircleStop } from 'lucide-react';
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const defaultPrompts = [
  "Create a discount promo email",
  "Generate a customer re-engagement message",
  "Write a newsletter for upcoming features",
  "Draft a holiday campaign message",
  "Compose a welcome email",
  "Suggest an upsell follow-up"
]

const EmailAssistant = () => {
  const [aiExpanded, setAiExpanded] = useState(true)
  const [prompts, setPrompts] = useState<string[]>([])
  const [askInput, setAskInput] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<any[]>([])
  const [controller, setController] = useState<AbortController | null>(null)

  const responseRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/emails/email-prompts/`)
        const data = await response.json()
        setPrompts(data.prompts.slice(0, 6))
      } catch (error) {
        console.error("Failed to fetch prompts:", error)
        setPrompts(defaultPrompts.slice(0, 4))
      }
    }

    fetchPrompts()
  }, [])

  const handleAsk = async () => {
    if (isTyping) {
      controller?.abort()
      setIsTyping(false)
      setAskInput('')
      return
    }
  
    if (!askInput.trim()) return
  
    const currentPrompt = askInput.trim()
    setAiResponse('')
    setIsTyping(true)
    setAskInput('AI is thinking')
  
    const dots = ['.', '..', '...']
    let dotIndex = 0
    const animateDots = setInterval(() => {
      setAskInput(`AI is thinking${dots[dotIndex % dots.length]}`)
      dotIndex++
    }, 500)
  
    const abortController = new AbortController()
    setController(abortController)
  
    try {
      const res = await fetch(`${API_BASE_URL}/emails/generate-ai-email/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentPrompt,
          history: conversationHistory
        }),
        signal: abortController.signal
      })
  
      const data = await res.json()
      const fullResponse = data.response || 'No response.'
  
      let index = -1
      const speed = 25
      const interval = setInterval(() => {
        if (index < fullResponse.length) {
          setAiResponse(prev => prev + fullResponse[index])
          index++
        } else {
          clearInterval(interval)
          clearInterval(animateDots)
          setIsTyping(false)
          setAskInput('')
        }
      }, speed)
  
      setConversationHistory(prev => {
        const updated = [
          ...prev,
          { role: 'user', content: currentPrompt },
          { role: 'assistant', content: fullResponse }
        ]
      
        const last10 = updated.slice(-10)
        return last10
      })      
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setAiResponse('Request cancelled.')
      } else if (error instanceof Error) {
        setAiResponse('Something went wrong: ' + error.message)
      } else {
        setAiResponse('Unknown error occurred.')
      }
    }     finally {
      clearInterval(animateDots)
      setIsTyping(false)
      setAskInput('')
      setController(null)
    }
  }  

  return (
    <div className={styles.wrapper}>
      <div className={styles.navWrapper}>
        <div className={styles.tabNav}>
          <button className={`${styles.tab} ${styles.active}`}>Email Assistant</button>
          <button className={styles.tab}>Voice & TTS</button>
          <button className={styles.tab}>Video Generator</button>
          <button className={styles.tab}>Image Generator</button>
        </div>
      </div>

      <div className={styles.contentRow}>
        <div className={styles.assistantPanel}>
          <div className={styles.aiSectionHeader}>
            <div className={styles.leftGroup}>
              <img src={sparkleIcon} alt="sparkle" className={styles.sparkleIcon} />
              <span className={styles.aiTitle}>Rest AI</span>
              <button onClick={() => setAiExpanded(!aiExpanded)} className={styles.toggleBtn}>
                {aiExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            <select className={styles.projectDropdown}>
              <option>Untitled project</option>
            </select>
          </div>

          {aiExpanded && (
            <div className={styles.aiCore}>
              <div className={styles.promptBar}>
                <input
                  type="text"
                  placeholder="Ask anything..."
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                />
                {isTyping ? (
                  <CircleStop
                    className={styles.playBtn}
                    color="#0073ff"
                    size={22}
                    onClick={handleAsk}
                  />
                ) : (
                  <img
                    src={playIcon}
                    className={styles.playBtn}
                    alt="send"
                    onClick={handleAsk}
                  />
                )}
              </div>

              <div className={styles.promptSuggestions}>
                {prompts.map((text, index) => (
                  <button key={index} onClick={() => setAskInput(text)}>
                    {text}
                  </button>
                ))}
              </div>

              <div className={styles.aiResponse} ref={responseRef}>
                <div className={styles.responseContent}>
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                    {aiResponse}
                  </ReactMarkdown>
                </div>
                <div className={styles.responseActions}>
                  <RefreshCcw size={20} className={styles.icon} />
                  <div className={styles.rightActions}>
                    <Copy size={20} className={styles.icon} />
                    <Mail size={20} className={styles.icon} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className={styles.emailFields}>
            <div className={styles.fieldGroup}>
              <label htmlFor="subject">Subject</label>
              <input type="text" id="subject" className={styles.subjectInput} placeholder="Enter subject" />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="message">Message</label>
              <textarea id="message" className={styles.messageInput} placeholder="Enter email content" rows={6} />
            </div>
          </div>
        </div>

        <div className={styles.sidePanel}>
          <div className={styles.attachmentBox}>
            <p className={styles.attachmentTitle}>Attachment</p>
            <div className={styles.uploadArea}>
              <img src={uploadIcon} alt="upload" className={styles.uploadIcon} />
              <p className={styles.fileHint}>.csv or .xlsx</p>
            </div>
            <button className={styles.uploadBtn}>Upload Recipients</button>
          </div>

          <button className={styles.sendBtn}>
            <Send size={16} />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default EmailAssistant
