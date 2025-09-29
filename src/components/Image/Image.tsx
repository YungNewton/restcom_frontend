// src/components/Image/Image.tsx
import { useEffect, useRef, useState } from 'react'
import NavTabs from '../NavTabs/NavTabs'
import styles from './Image.module.css'
import { toast } from 'react-hot-toast'
import TextToImage from './TextToImage/TextToImage'
import ImageToImage from './ImageToImage/ImageToImage'
import Inpaint from './Inpaint/Inpaint'
import GeneralSettings, { type GeneralSettingsState } from './Right/Settings/Settings'
import LoraLibrary from './Right/LoraLibrary/LoraLibrary'

const API_BASE = import.meta.env.VITE_API_BASE_URL

type ActiveTab = 't2i' | 'i2i' | 'inpaint'
type RightTab = 'settings' | 'loraLibrary'
const MAX_SELECTED = 3

const Image = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('t2i')
  const [engineOnline, setEngineOnline] = useState(false)

  // Track selected LoRAs from the right-side library (id + strength)
  const [activeLoras, setActiveLoras] = useState<Array<{ id: string; strength: number }>>([])
  const selectedLoraCount = activeLoras.length

  // Right panel tabs (Settings | LoRA Library)
  const [activeRightTab, setActiveRightTab] = useState<RightTab>('settings')
  const tabsRef = {
    settings: useRef<HTMLButtonElement>(null),
    loraLibrary: useRef<HTMLButtonElement>(null),
  }
  const [indicatorLeft, setIndicatorLeft] = useState('0px')
  const [indicatorWidth, setIndicatorWidth] = useState('0px')

  useEffect(() => {
    const ref = tabsRef[activeRightTab]
    if (ref.current) {
      setIndicatorLeft(ref.current.offsetLeft + 'px')
      setIndicatorWidth(ref.current.offsetWidth + 'px')
    }
  }, [activeRightTab])

  // Shared settings used by all branches
  const [settings, setSettings] = useState<GeneralSettingsState>({
    width: 768,
    height: 1024,
    steps: 28,
    cfg: 4.0,
    batch: 1,
    seed: '',
    outFormat: 'png',
  })

  useEffect(() => {
    // Reuse voice SSE for now; swap if an /image/status/stream exists
    const es = new EventSource(`${API_BASE}/image/status/stream`)
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

  // If we came from the main LoRA Library's "Use" button, open the LoRA tab
  useEffect(() => {
    if (sessionStorage.getItem('image.selectedLoras')) {
      setActiveRightTab('loraLibrary')
    }
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
          <span>Image Engine {engineOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className={styles.columns}>
        <div className={`${styles.left} ${styles.panel}`}>
          {activeTab === 't2i' && (
            <TextToImage
              engineOnline={engineOnline}
              settings={settings}
              // TODO: plumb activeLoras into generation payload when ready
            />
          )}
          {activeTab === 'i2i' && (
            <ImageToImage
              engineOnline={engineOnline}
              settings={settings}
              // TODO: use activeLoras here
            />
          )}
          {activeTab === 'inpaint' && (
            <Inpaint
              engineOnline={engineOnline}
              settings={settings}
              // TODO: use activeLoras here
            />
          )}
        </div>

        <div className={`${styles.right} ${styles.panel}`}>
          {/* Right-side tabs: Settings | LoRA Library */}
          <div className={styles.tabs}>
            <button
              ref={tabsRef.settings}
              className={activeRightTab === 'settings' ? styles.active : ''}
              onClick={() => setActiveRightTab('settings')}
              type="button"
            >
              Settings
            </button>
            <button
              ref={tabsRef.loraLibrary}
              className={activeRightTab === 'loraLibrary' ? styles.active : ''}
              onClick={() => setActiveRightTab('loraLibrary')}
              type="button"
            >
              LoRA Library{selectedLoraCount > 0 ? ` (${selectedLoraCount}/${MAX_SELECTED})` : ''}
            </button>
            <div
              className={styles.tabIndicator}
              style={{ left: indicatorLeft, width: indicatorWidth }}
            />
          </div>

          {activeRightTab === 'settings' ? (
            <GeneralSettings value={settings} onChange={setSettings} />
          ) : (
            // Capture selection changes from the right-side LoRA Library
            <LoraLibrary onSelectedChange={setActiveLoras} />
          )}
        </div>
      </div>
    </div>
  )
}

export default Image
