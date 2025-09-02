import styles from '../Image.module.css'
import type { GeneralSettingsState } from '../Settings'
import { useEffect, useRef, useState } from 'react'

type Props = {
  engineOnline: boolean
  settings: GeneralSettingsState
}

export default function Inpaint({ engineOnline }: Props) {
  const [base, setBase] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [brush, setBrush] = useState(28)
  const [painting, setPainting] = useState(false)

  const onPick = (f: File | null) => {
    if (!f) { setBase(null); setPreview(null); return }
    setBase(f)
    setPreview(URL.createObjectURL(f))
  }

  useEffect(() => {
    if (!preview) return
    const img = new Image()
    img.onload = () => {
      const c = canvasRef.current
      if (!c) return
      c.width = img.width
      c.height = img.height
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, c.width, c.height) // black mask default
    }
    img.src = preview
  }, [preview])

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c) return
    const r = c.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * c.width
    const y = ((e.clientY - r.top) / r.height) * c.height
    const ctx = c.getContext('2d'); if (!ctx) return
    ctx.fillStyle = '#ffffff' // white = reveal/edit area
    ctx.beginPath(); ctx.arc(x, y, brush, 0, Math.PI * 2); ctx.fill()
  }

  return (
    <div className="space-y-3">
      <h3 className={styles.sectionHeader}>Base Image & Mask</h3>
      <label className={styles.uploadBox}>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onPick(e.target.files?.[0] || null)} />
        <div className={styles.uploadInner}>
          <p>Click to upload or drag & drop</p>
          <p className={styles.subText}>PNG/JPG up to 30MB</p>
        </div>
      </label>

      {preview && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/80">Brush</span>
            <input type="range" min={6} max={96} value={brush} onChange={e => setBrush(parseInt(e.target.value))} />
            <span className="text-xs text-zinc-400 w-10">{brush}px</span>
            <button
              className="ml-auto px-2 py-1 rounded border border-[#333] text-xs hover:bg-[#1a1a1a]"
              onClick={() => {
                const c = canvasRef.current; if (!c) return
                const ctx = c.getContext('2d'); if (!ctx) return
                ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, c.width, c.height)
              }}
            >
              Clear
            </button>
          </div>

          <div className="relative border border-[#333] rounded-md overflow-hidden">
            <img src={preview} className="w-full block" />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full touch-none"
              onPointerDown={(e) => { setPainting(true); (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId); draw(e) }}
              onPointerMove={(e) => painting && draw(e)}
              onPointerUp={(e) => { setPainting(false); (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId) }}
            />
          </div>
        </div>
      )}

      <div className={styles.actionRow}>
        <button className={styles.primaryBtn} disabled={!engineOnline || !base}>
          Inpaint
        </button>
      </div>
    </div>
  )
}
