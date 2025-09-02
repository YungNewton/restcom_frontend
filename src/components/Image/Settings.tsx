import styles from './Image.module.css'
import { useState } from 'react'

export type Lora = { id: string; name: string; scale: number }

export type GeneralSettingsState = {
  model: string
  sampler: string
  width: number
  height: number
  steps: number
  cfg: number
  batch: number
  seed: string
  loras: Lora[]
}

type Props = {
  value: GeneralSettingsState
  onChange: (v: GeneralSettingsState) => void
}

const models = [
  { id: 'flux-schnell', name: 'FLUX Schnell (fast)' },
  { id: 'flux-dev', name: 'FLUX Dev (quality)' },
  { id: 'sdxl', name: 'Stable Diffusion XL' },
]

const samplers = ['euler', 'euler_a', 'ddim', 'dpmpp_2m', 'dpmpp_sde']

export default function GeneralSettings({ value, onChange }: Props) {
  const [showModel, setShowModel] = useState(false)
  const [showSampler, setShowSampler] = useState(false)

  const set = <K extends keyof GeneralSettingsState>(k: K, v: GeneralSettingsState[K]) =>
    onChange({ ...value, [k]: v })

  const addLora = () =>
    onChange({ ...value, loras: [...value.loras, { id: `custom-${Date.now()}`, name: 'Custom LoRA', scale: 0.5 }] })

  const removeLora = (i: number) =>
    onChange({ ...value, loras: value.loras.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-3">
      <h3 className={styles.sectionHeader}>Settings</h3>

      {/* Model */}
      <div className={styles.section}>
        <label className={styles.label}>Model</label>
        <div className={styles.formatPanel} onClick={() => setShowModel(!showModel)}>
          <div className="flex items-center justify-between">
            <span className={styles.formatName}>{models.find(m => m.id === value.model)?.name || value.model}</span>
            <span>▾</span>
          </div>
          {showModel && (
            <div className={styles.formatDropdown}>
              {models.map(m => (
                <div
                  key={m.id}
                  className={styles.formatDropdownItem}
                  onClick={() => {
                    set('model', m.id)
                    setShowModel(false)
                  }}
                >
                  {m.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sampler */}
      <div className={styles.section}>
        <label className={styles.label}>Sampler</label>
        <div className={styles.formatPanel} onClick={() => setShowSampler(!showSampler)}>
          <div className="flex items-center justify-between">
            <span className={styles.formatName}>{value.sampler}</span>
            <span>▾</span>
          </div>
          {showSampler && (
            <div className={styles.formatDropdown}>
              {samplers.map(s => (
                <div
                  key={s}
                  className={styles.formatDropdownItem}
                  onClick={() => {
                    set('sampler', s)
                    setShowSampler(false)
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={styles.label}>Width</label>
          <input
            type="number"
            className={styles.input}
            value={value.width}
            onChange={e => set('width', parseInt(e.target.value || '0'))}
            min={256} max={1536} step={16}
          />
        </div>
        <div>
          <label className={styles.label}>Height</label>
          <input
            type="number"
            className={styles.input}
            value={value.height}
            onChange={e => set('height', parseInt(e.target.value || '0'))}
            min={256} max={1536} step={16}
          />
        </div>
        <div>
          <label className={styles.label}>Steps</label>
          <input
            type="number"
            className={styles.input}
            value={value.steps}
            onChange={e => set('steps', parseInt(e.target.value || '0'))}
            min={6} max={60}
          />
        </div>
        <div>
          <label className={styles.label}>CFG</label>
          <input
            type="number"
            className={styles.input}
            value={value.cfg}
            onChange={e => set('cfg', parseFloat(e.target.value || '0'))}
            min={1} max={12} step={0.5}
          />
        </div>
        <div>
          <label className={styles.label}>Batch</label>
          <input
            type="number"
            className={styles.input}
            value={value.batch}
            onChange={e => set('batch', parseInt(e.target.value || '0'))}
            min={1} max={6}
          />
        </div>
        <div>
          <label className={styles.label}>Seed</label>
          <input
            className={styles.input}
            value={value.seed}
            onChange={e => set('seed', e.target.value)}
            placeholder='-1 or empty = random'
          />
        </div>
      </div>

      {/* LoRAs */}
      <div className={styles.section}>
        <label className={styles.label}>LoRAs</label>
        <div className="space-y-2">
          {value.loras.map((l, i) => (
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2" key={l.id}>
              <span className="text-sm text-white/90">{l.name}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={l.scale}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  const next = [...value.loras]
                  next[i] = { ...next[i], scale: v }
                  set('loras', next)
                }}
              />
              <span className="text-xs text-zinc-400 w-10 text-right">{l.scale.toFixed(2)}</span>
              <button
                className="px-2 py-1 rounded border border-[#333] text-xs hover:bg-[#1a1a1a]"
                onClick={() => removeLora(i)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button onClick={addLora} className="px-3 py-1.5 rounded border border-[#333] text-sm hover:bg-[#1a1a1a]">
          Add LoRA
        </button>
      </div>
    </div>
  )
}
