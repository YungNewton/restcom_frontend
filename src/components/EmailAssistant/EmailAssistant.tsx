import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCcw, Copy, Mail, Send } from 'lucide-react'
import styles from './EmailAssistant.module.css'
import sparkleIcon from '../../assets/sparkle-icon.png'
import playIcon from '../../assets/play.png'
import uploadIcon from '../../assets/upload.png'

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

  useEffect(() => {
    const fetchPrompts = async () => {
      try {
        // const response = await fetch('/api/prompts')
        // const data = await response.json()
        // setPrompts(data.prompts)

        throw new Error()
      } catch {
        setPrompts(defaultPrompts.slice(0, 4))
      }
    }

    fetchPrompts()
  }, [])

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
                <input type="text" placeholder="Ask anything..." />
                <img src={playIcon} className={styles.playBtn} alt="send" />
              </div>

              <div className={styles.promptSuggestions}>
                {prompts.map((text, index) => (
                  <button key={index}>{text}</button>
                ))}
              </div>

              <div className={styles.aiResponse}>
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
              <input
                type="text"
                id="subject"
                className={styles.subjectInput}
                placeholder="Enter subject"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                className={styles.messageInput}
                placeholder="Enter email content"
                rows={6}
              />
            </div>
          </div>
        </div>

        {/* Upload Side Panel */}
        <div className={styles.sidePanel}>
        <div className={styles.attachmentBox}>
            <p className={styles.attachmentTitle}>Attachment</p>
            <div className={styles.uploadArea}>
            <img src={uploadIcon} alt="upload" className={styles.uploadIcon} />
            <p className={styles.fileHint}>.csv or .xlsx</p>
            </div>
            <button className={styles.uploadBtn}>Upload Recipient</button>
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
