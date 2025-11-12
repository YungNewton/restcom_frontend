// src/components/Image/Image.tsx
import { useEffect, useRef, useState, useTransition } from 'react'
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

const TAB_TO_BRANCH: Record<ActiveTab, 'krea' | 'kontext' | 'fill'> = {
  t2i: 'krea',
  i2i: 'kontext',
  inpaint: 'fill',
}

const BRANCH_TO_ENGINE_LABEL: Record<'krea' | 'kontext' | 'fill', string> = {
  krea: 'Image engine',
  kontext: 'Img-to-Img engine',
  fill: 'Inpaint engine',
}

const Image = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('t2i')
  const [isPending, startTransition] = useTransition()

  // Keep per-branch online state so switching tabs feels instant (no flicker)
  const [onlineByBranch, setOnlineByBranch] = useState<Record<'krea' | 'kontext' | 'fill', boolean>>({
    krea: false,
    kontext: false,
    fill: false,
  })
  const branch = TAB_TO_BRANCH[activeTab]
  const engineOnline = onlineByBranch[branch]

  // Remember previous online state per-branch to control toast transitions
  const prevOnlineRef = useRef<Record<'krea' | 'kontext' | 'fill', boolean>>({
    krea: false,
    kontext: false,
    fill: false,
  })

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

  // Faster-feeling tab switch + robust polling:
  // - Abort in-flight fetch immediately on tab change (no stale updates)
  // - Cache per-branch online state so the badge/UX updates instantly
  // - Fire toast with friendly engine names when branch goes from offline -> online
  useEffect(() => {
    if (!API_BASE) return

    const base = API_BASE.replace(/\/+$/, '')
    const controller = new AbortController()
    let cancelled = false
    let tick: number | undefined

    const poll = async () => {
      try {
        const res = await fetch(`${base}/images/${branch}/runpod-status/`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        const isOnline = !!data?.online

        // update per-branch online state without clobbering others
        setOnlineByBranch(prev => {
          if (prev[branch] === isOnline) return prev
          const next = { ...prev, [branch]: isOnline }
          return next
        })

        // toast only on transition offline -> online for THIS branch
        const wasOnline = prevOnlineRef.current[branch]
        if (!wasOnline && isOnline) {
          const label = BRANCH_TO_ENGINE_LABEL[branch]
          toast.success(`${label} is live.`)
        }
        prevOnlineRef.current[branch] = isOnline
      } catch (err) {
        // treat as offline only if not aborted
        if (!controller.signal.aborted) {
          setOnlineByBranch(prev => {
            if (prev[branch] === false) return prev
            const next = { ...prev, [branch]: false }
            return next
          })
          prevOnlineRef.current[branch] = false
        }
      } finally {
        if (!cancelled) {
          tick = window.setTimeout(poll, 2500) as unknown as number
        }
      }
    }

    // immediate poll on tab change for snappier feedback
    poll()

    return () => {
      cancelled = true
      if (tick) window.clearTimeout(tick)
      controller.abort()
    }
  }, [branch, API_BASE])

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
            onClick={() => startTransition(() => setActiveTab('t2i'))}
            disabled={isPending}
            type="button"
          >
            Text to Image
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'i2i' ? styles.active : ''}`}
            onClick={() => startTransition(() => setActiveTab('i2i'))}
            disabled={isPending}
            type="button"
          >
            Image to Image
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'inpaint' ? styles.active : ''}`}
            onClick={() => startTransition(() => setActiveTab('inpaint'))}
            disabled={isPending}
            type="button"
          >
            Inpaint
          </button>
        </div>

        <div className={`${styles.engineStatus} ${engineOnline ? styles.onlineStatus : ''}`}>
          <div className={`${styles.statusDot} ${engineOnline ? styles.online : styles.offline}`}></div>
          <span>
            {
              // dynamic label to match the active tab
              `${BRANCH_TO_ENGINE_LABEL[branch]} ${engineOnline ? 'Online' : 'Offline'}`
            }
          </span>
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
