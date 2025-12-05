// src/components/Image/Settings/GeneralSettings.tsx
import { useId, useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, HelpCircle } from 'lucide-react'
import styles from './Settings.module.css'

export type GeneralSettingsState = {
  width: number
  height: number
  steps: number
  cfg: number
  batch: number
  seed: string
  outFormat: 'png' | 'jpg' | 'webp'
}

type Props = {
  value: GeneralSettingsState
  onChange: (v: GeneralSettingsState) => void
}

function LabelWithTip({
  htmlFor,
  label,
  tip,
}: {
  htmlFor?: string
  label: string
  tip: string
}) {
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const activeRef = useRef(false)

  const place = () => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()

    const cx = r.left + r.width / 2
    const cyTop = r.top
    const cyBottom = r.bottom

    const gutter = 12
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Choose side with more room (prefer top if enough headroom)
    const hasTopRoom = cyTop > 64
    const side = hasTopRoom ? 'top' : 'bottom'
    el.dataset.side = side

    // Clamp X within viewport gutters
    const clampedX = Math.max(gutter, Math.min(vw - gutter, cx))
    const y = side === 'top' ? cyTop : cyBottom

    // Clamp Y just in case (rare)
    const clampedY = Math.max(0, Math.min(vh, y))

    el.style.setProperty('--tt-left', `${clampedX}px`)
    el.style.setProperty('--tt-top', `${clampedY}px`)
  }

  useEffect(() => {
    const onReflow = () => {
      if (activeRef.current) place()
    }
    window.addEventListener('resize', onReflow)
    // capture scroll on ancestors too
    window.addEventListener('scroll', onReflow, true)
    return () => {
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.labelRow}>
      <label htmlFor={htmlFor} className={styles.label}>{label}</label>
      <span
        ref={wrapRef}
        className={styles.tooltipWrapper}
        data-tooltip={tip}
        data-side="top"
        tabIndex={0}
        aria-label={tip}
        onMouseEnter={() => { activeRef.current = true; place() }}
        onMouseLeave={() => { activeRef.current = false }}
        onFocus={() => { activeRef.current = true; place() }}
        onBlur={() => { activeRef.current = false }}
      >
        <HelpCircle size={14} className={styles.helpIcon} />
      </span>
    </div>
  )
}

/** Reusable number input that lets users clear/type freely.
 *  Commits on blur or Enter, clamps to [min,max], and supports step. */
function NumberField({
  id,
  value,
  onCommit,
  min,
  max,
  step = 1,
  className,
}: {
  id: string
  value: number
  onCommit: (n: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null) // null = controlled by prop

  return (
    <input
      id={id}
      type="number"
      className={className}
      value={draft ?? String(value)}
      min={min}
      max={max}
      step={step}
      onFocus={() => setDraft(String(value))}
      onChange={(e) => setDraft(e.target.value)} // allow '' while typing
      onBlur={(e) => {
        const raw = e.target.value.trim()
        setDraft(null) // back to prop control
        if (raw === '') return // keep previous value
        let n = Number(raw)
        if (Number.isNaN(n)) return
        if (min != null) n = Math.max(min, n)
        if (max != null) n = Math.min(max, n)
        onCommit(n)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

export default function GeneralSettings({ value, onChange }: Props) {
  const set = <K extends keyof GeneralSettingsState>(k: K, v: GeneralSettingsState[K]) =>
    onChange({ ...value, [k]: v })

  // ids for a11y (unique per mount)
  const ids = {
    width: useId(),
    height: useId(),
    steps: useId(),
    cfg: useId(),
    batch: useId(),
    seed: useId(),
    outFormat: useId(),
  }

  // Output format dropdown
  const [showFormatDropdown, setShowFormatDropdown] = useState(false)
  const formatRef = useRef<HTMLDivElement | null>(null)
  const fileFormats: Array<GeneralSettingsState['outFormat']> = ['png', 'jpg', 'webp']

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (formatRef.current && !formatRef.current.contains(e.target as Node)) {
        setShowFormatDropdown(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <section className={styles.wrap}>
      {/* Row 1: Width / Height */}
      <div className={styles.pair}>
        <div className={styles.field}>
          <label htmlFor={ids.width} className={styles.label}>Width</label>
          <NumberField
            id={ids.width}
            className={styles.input}
            value={value.width}
            min={96}
            max={1536}
            step={16}
            onCommit={(n) => {
              const snapped = Math.round(n / 16) * 16
              set('width', Math.min(1536, Math.max(96, snapped)))
            }}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={ids.height} className={styles.label}>Height</label>
          <NumberField
            id={ids.height}
            className={styles.input}
            value={value.height}
            min={96}
            max={1536}
            step={16}
            onCommit={(n) => {
              const snapped = Math.round(n / 16) * 16
              set('height', Math.min(1536, Math.max(96, snapped)))
            }}
          />
        </div>
      </div>

      {/* Row 2: Steps / CFG */}
      <div className={styles.pair}>
        <div className={styles.field}>
          <LabelWithTip
            htmlFor={ids.steps}
            label="Steps"
            tip="More steps → more detail but slower; diminishing returns past ~30."
          />
          <NumberField
            id={ids.steps}
            className={styles.input}
            value={value.steps}
            min={6}
            max={60}
            step={1}
            onCommit={(n) => set('steps', n)}
          />
        </div>

        <div className={styles.field}>
          <LabelWithTip
            htmlFor={ids.cfg}
            label="CFG (Adherence)"
            tip="Higher values force closer adherence to the prompt (less creativity). Try 3–6."
          />
          <NumberField
            id={ids.cfg}
            className={styles.input}
            value={value.cfg}
            min={1}
            max={12}
            step={0.5}
            onCommit={(n) => set('cfg', n)}
          />
        </div>
      </div>

      {/* Row 3: Batch / Seed */}
      <div className={styles.pair}>
        <div className={styles.field}>
          <LabelWithTip
            htmlFor={ids.batch}
            label="Batch"
            tip="How many images to generate in one run."
          />
          <NumberField
            id={ids.batch}
            className={styles.input}
            value={value.batch}
            min={1}
            max={6}
            step={1}
            onCommit={(n) => set('batch', n)}
          />
        </div>

        <div className={styles.field}>
          <LabelWithTip
            htmlFor={ids.seed}
            label="Seed"
            tip="Use a fixed seed for repeatability. Empty or -1 = random each run."
          />
          <input
            id={ids.seed}
            className={styles.input}
            value={value.seed}
            onChange={(e) => set('seed', e.target.value)}
            placeholder="-1 or empty = random"
          />
        </div>
      </div>

      {/* Row 4: Output Format (custom dropdown styled like Voice Settings) */}
      <div className={styles.single}>
        <div className={styles.field} ref={formatRef}>
          <label htmlFor={ids.outFormat} className={styles.label}>Output Format</label>
          <div
            id={ids.outFormat}
            className={styles.selectPanel}
            role="button"
            aria-haspopup="listbox"
            aria-expanded={showFormatDropdown}
            onClick={() => setShowFormatDropdown((v) => !v)}
          >
            <div className={styles.selector}>
              <span className={styles.selectorText}>{value.outFormat.toUpperCase()}</span>
              <ChevronDown size={16} />
            </div>
            {showFormatDropdown && (
              <div className={styles.dropdown} role="listbox">
                {fileFormats.map((fmt) => {
                  const selected = fmt === value.outFormat
                  return (
                    <div
                      key={fmt}
                      role="option"
                      aria-selected={selected}
                      className={`${styles.dropdownItem} ${selected ? styles.selected : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        set('outFormat', fmt)
                        setShowFormatDropdown(false)
                      }}
                    >
                      <span>{fmt.toUpperCase()}</span>
                      {selected && <Check size={16} className={styles.checkIcon} />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
