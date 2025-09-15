// src/components/Image/Settings/GeneralSettings.tsx
import { useId, useState } from 'react'
import styles from './Settings.module.css'

export type GeneralSettingsState = {
  width: number
  height: number
  steps: number
  cfg: number
  batch: number
  seed: string
}

type Props = {
  value: GeneralSettingsState
  onChange: (v: GeneralSettingsState) => void
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
  }

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
            min={256}
            max={1536}
            step={16}
            onCommit={(n) => {
              const snapped = Math.round(n / 16) * 16
              set('width', Math.min(1536, Math.max(256, snapped)))
            }}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={ids.height} className={styles.label}>Height</label>
          <NumberField
            id={ids.height}
            className={styles.input}
            value={value.height}
            min={256}
            max={1536}
            step={16}
            onCommit={(n) => {
              const snapped = Math.round(n / 16) * 16
              set('height', Math.min(1536, Math.max(256, snapped)))
            }}
          />
        </div>
      </div>

      {/* Row 2: Steps / CFG */}
      <div className={styles.pair}>
        <div className={styles.field}>
          <label htmlFor={ids.steps} className={styles.label}>Steps</label>
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
          <label htmlFor={ids.cfg} className={styles.label}>CFG</label>
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
          <label htmlFor={ids.batch} className={styles.label}>Batch</label>
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
          <label htmlFor={ids.seed} className={styles.label}>Seed</label>
          <input
            id={ids.seed}
            className={styles.input}
            value={value.seed}
            onChange={(e) => set('seed', e.target.value)}
            placeholder="-1 or empty = random"
          />
        </div>
      </div>
    </section>
  )
}
