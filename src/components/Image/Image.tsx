import { useEffect, useState } from 'react'
import NavTabs from '../NavTabs/NavTabs'
import styles from './Image.module.css'
import { toast } from 'react-hot-toast'
import TextToImage from './TextToImage/TextToImage'
import ImageToImage from './ImageToImage/ImageToImage'
import Inpaint from './Inpaint/Inpaint'
import GeneralSettings, { type GeneralSettingsState } from './Settings'

const API_BASE = import.meta.env.VITE_API_BASE_URL

type ActiveTab = 't2i' | 'i2i' | 'inpaint'

const Image = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('t2i')
  const [engineOnline, setEngineOnline] = useState(false)

  // Shared settings used by all branches
  const [settings, setSettings] = useState<GeneralSettingsState>({
    model: 'flux-schnell',
    sampler: 'dpmpp_2m',
    width: 768,
    height: 1024,
    steps: 28,
    cfg: 4.0,
    batch: 1,
    seed: '',
    loras: [{ id: 'restcom-style', name: 'Restcom Style', scale: 0.6 }],
  })

  useEffect(() => {
    // Reuse voice SSE for now; swap if an /image/status/stream exists
    const es = new EventSource(`${API_BASE}/voice/status/stream`)
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const isOnline = !!data.online
        setEngineOnline(isOnline)
        if (isOnline) toast.success('AI Engine is live.')
      } catch (e) {
        console.error('SSE parse error:', e)
      }
    }
    es.onerror = () => {
      es.close()
      setEngineOnline(false)
    }
    return () => es.close()
  }, [])

  return (
    <div className={styles.wrapper}>
      <NavTabs />

      <div className={styles.tabNavRow}>
        <div className={styles.tabNav}>
          <button
            className={`${styles.tab} ${activeTab === 't2i' ? styles.active : ''}`}
            onClick={() => setActiveTab('t2i')}
          >
            Text to Image
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'i2i' ? styles.active : ''}`}
            onClick={() => setActiveTab('i2i')}
          >
            Image to Image
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'inpaint' ? styles.active : ''}`}
            onClick={() => setActiveTab('inpaint')}
          >
            Inpaint
          </button>
        </div>

        <div className={`${styles.engineStatus} ${engineOnline ? styles.onlineStatus : ''}`}>
          <div className={`${styles.statusDot} ${engineOnline ? styles.online : styles.offline}`}></div>
          <span>AI Engine {engineOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className={styles.columns}>
        <div className={`${styles.left} ${styles.panel}`}>
          {activeTab === 't2i' && (
            <TextToImage
              engineOnline={engineOnline}
              settings={settings}
            />
          )}
          {activeTab === 'i2i' && (
            <ImageToImage
              engineOnline={engineOnline}
              settings={settings}
            />
          )}
          {activeTab === 'inpaint' && (
            <Inpaint
              engineOnline={engineOnline}
              settings={settings}
            />
          )}
        </div>

        <div className={`${styles.right} ${styles.panel}`}>
          <GeneralSettings value={settings} onChange={setSettings} />
        </div>
      </div>
    </div>
  )
}

export default Image
