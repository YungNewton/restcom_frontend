import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './DashboardHome.module.css'
import {
  Mail,
  Mic,
  Video,
  Shapes
} from 'lucide-react'

const DashboardHome = () => {
  const [date, setDate] = useState('')
  const [animatedText, setAnimatedText] = useState('')
  const indexRef = useRef(0)
  const message = 'Welcome back!'
  const navigate = useNavigate()

  useEffect(() => {
    const today = new Date()
    const formatted = today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })
    setDate(formatted)

    indexRef.current = 0
    const type = () => {
      if (indexRef.current <= message.length) {
        setAnimatedText(message.slice(0, indexRef.current))
        indexRef.current++
        setTimeout(type, 60)
      }
    }
    type()
  }, [])

  const tools = [
    {
      title: 'AI Email Assistant',
      icon: <Mail color="#0073FF" size={20} />,
      description: 'Send out mass emails with AI assistance',
      sub: 'Enables manual or AI-generated email messages and targeted or global send-outs',
      path: '/email-assistant',
    },
    {
      title: 'Voice Cloning & TTS',
      icon: <Mic color="#0073FF" size={20} />,
      description: 'text-to-speech engine.',
      sub: 'Converts PDF books or text into audio using cloned voices, enabling creation of audiobooks with personalized voice models. Also includes Speech to text.',
      path: '/voice',
    },
    {
      title: 'Video Generator',
      icon: <Video color="#0073FF" size={20} />,
      description: 'High quality video rendering model',
      sub: 'Enables users to create videos based on their ideas and inputs, potentially using AI-generated visuals and voiceovers.',
      path: '/video',
    },
    {
      title: 'Image Generator',
      icon: <Shapes color="#0073FF" size={20} />,
      description: 'Logo generator and image search tool.',
      sub: 'Enables manual or AI-generated email messages and targeted or global send-outs based on the scraped contact list.',
      path: '/logo',
    }
  ]

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <p className={styles.date}>{date}</p>
          <h1 className={styles.welcome}><span>{animatedText}</span></h1>
          <p className={styles.sub}>How can I help you today?</p>
        </div>

        {/* Tool Cards */}
        <div className={styles.cardGrid}>
          {tools.map((tool, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardTitle}>
                  {tool.icon}
                  <span>{tool.title}</span>
                </div>
                <p className={styles.cardDesc}>{tool.description}</p>
                <p className={styles.cardSub}>{tool.sub}</p>
              </div>
              <div className={styles.cardActions}>
                <button
                  className={styles.launch}
                  onClick={() => navigate(tool.path)}
                >
                  Launch Tool
                </button>
                <button className={styles.link}>How it works →</button>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statBox}>
            <p className={styles.statTitle}>Logos Generated</p>
            <h3 className={styles.statValue}>42 <span className={styles.green}>↑ 19.05%</span></h3>
          </div>
          <div className={styles.statBox}>
            <p className={styles.statTitle}>Voices Cloned</p>
            <h3 className={styles.statValue}>17 <span className={styles.green}>↑ 25.27%</span></h3>
          </div>
          <div className={styles.statBox}>
            <p className={styles.statTitle}>Emails Sent</p>
            <h3 className={styles.statValue}>09 <span className={styles.red}>↓ -44.02%</span></h3>
          </div>
          <div className={styles.statBox}>
            <p className={styles.statTitle}>Videos Rendered</p>
            <h3 className={styles.statValue}>22 <span className={styles.green}>↑ 19.06%</span></h3>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardHome
