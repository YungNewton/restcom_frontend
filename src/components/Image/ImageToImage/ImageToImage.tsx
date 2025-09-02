import styles from '../Image.module.css'
import type { GeneralSettingsState } from '../Settings'
import { useState } from 'react'

type Props = {
  engineOnline: boolean
  settings: GeneralSettingsState
}

export default function ImageToImage({ engineOnline }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const onPick = (f: File | null) => {
    if (!f) { setFile(null); setPreview(null); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  return (
    <div className="space-y-3">
      <h3 className={styles.sectionHeader}>Init Image</h3>
      <label className={styles.uploadBox}>
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />
        <div className={styles.uploadInner}>
          <p>Click to upload or drag & drop</p>
          <p className={styles.subText}>Image files, max 30MB</p>
        </div>
      </label>
      {preview && <img src={preview} className="w-full rounded-md border border-[#333]" />}
      <div className={styles.actionRow}>
        <button className={styles.primaryBtn} disabled={!engineOnline || !file}>
          Transform
        </button>
      </div>
    </div>
  )
}
