import { useEffect, useMemo, useState } from 'react'
import styles from './AddLoRa.module.css'
import { Upload, X, Trash2 } from 'lucide-react'

export type AddLoRaPayload =
  | {
      mode: 'upload'
      name: string
      type: 'image' | 'video' | 'audio' | 'text'
      file: File
      tags: string[]
    }
  | {
      mode: 'train'
      name: string
      type: 'image' | 'video' | 'audio' | 'text'
      trigger?: string
      repeatPerImage: number
      maxEpochs: number
      images: Array<{ file: File; caption?: string }>
      estimatedSteps: number
      tags: string[]
    }

type Props = {
  onClose: () => void
  onSubmit: (payload: AddLoRaPayload) => void | Promise<void>
}

type TrainImage = {
  id: string
  file: File
  url: string
  caption: string
}

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AddLoRa({ onClose, onSubmit }: Props) {
  const [tab, setTab] = useState<'upload' | 'train'>('upload')

  // Shared
  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Upload (single model file)
  const [file, setFile] = useState<File | undefined>()

  // Train
  const [trigger, setTrigger] = useState('')
  const [repeatPerImage, setRepeatPerImage] = useState<number>(10)
  const [maxEpochs, setMaxEpochs] = useState<number>(1)
  const [trainImages, setTrainImages] = useState<TrainImage[]>([])
  const estimatedSteps = useMemo(
    () => (trainImages.length ? trainImages.length * Math.max(1, repeatPerImage) * Math.max(1, maxEpochs) : 0),
    [trainImages.length, repeatPerImage, maxEpochs]
  )

  useEffect(() => () => trainImages.forEach(i => URL.revokeObjectURL(i.url)), [trainImages])

  // ------- Tags -------
  function addTag(v: string) {
    const t = v.trim()
    if (!t) return
    if (tags.includes(t)) return
    setTags(prev => [...prev, t])
    setTagInput('')
  }
  function removeTag(t: string) {
    setTags(prev => prev.filter(x => x !== t))
  }

  // ------- Upload: model file -------
  function onPickModelFile(list?: FileList | null) {
    if (!list || !list.length) return
    setFile(list[0])
  }
  function onDropModel(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0]
    if (f) setFile(f)
  }
  function clearModelFile() {
    setFile(undefined)
  }

  // ------- Train: images -------
  function onPickTrainFiles(files?: FileList | null) {
    if (!files || !files.length) return
    const next: TrainImage[] = Array.from(files).map(f => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2)}`,
      file: f,
      url: URL.createObjectURL(f),
      caption: ''
    }))
    setTrainImages(prev => [...prev, ...next])
  }
  function removeTrainImage(id: string) {
    setTrainImages(prev => {
      const it = prev.find(x => x.id === id)
      if (it) URL.revokeObjectURL(it.url)
      return prev.filter(x => x.id !== id)
    })
  }
  function clearTrainImages() {
    setTrainImages(prev => {
      prev.forEach(x => URL.revokeObjectURL(x.url))
      return []
    })
  }
  function onDropTrain(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    onPickTrainFiles(e.dataTransfer?.files)
  }

  // ------- Submit -------
  async function submit() {
    if (!name.trim()) return
    setSubmitting(true)
    try {
      if (tab === 'upload') {
        if (!file) return
        await onSubmit({
          mode: 'upload',
          name: name.trim(),
          type: 'image',
          file,
          tags
        })
      } else {
        if (trainImages.length === 0) return
        await onSubmit({
          mode: 'train',
          name: name.trim(),
          type: 'image',
          trigger: trigger.trim() || undefined,
          repeatPerImage: Math.max(1, repeatPerImage),
          maxEpochs: Math.max(1, maxEpochs),
          images: trainImages.map(i => ({ file: i.file, caption: i.caption.trim() || undefined })),
          estimatedSteps,
          tags
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Add a new LoRA</h3>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Close" type="button">
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* Tabs */}
          <div className={styles.tabSwitcher}>
            <button
              className={`${styles.tabBtn} ${tab === 'upload' ? styles.tabBtnActive : ''}`}
              onClick={() => setTab('upload')}
              type="button"
            >
              <Upload size={16} /> Upload
            </button>
            <button
              className={`${styles.tabBtn} ${tab === 'train' ? styles.tabBtnActive : ''}`}
              onClick={() => setTab('train')}
              type="button"
            >
              🧠 Train
            </button>
          </div>

          {/* Name */}
          <label className={styles.label}>Name</label>
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Realistic Portrait v3"
          />

          {/* Tags */}
          <label className={styles.label}>Tags</label>
          <div className={styles.tagAdder}>
            <input
              className={`${styles.input} ${styles.tagInput}`}
              placeholder="portrait, anime, indoor…"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
            />
            <button className={`${styles.secondaryBtn} ${styles.tagAddBtn}`} onClick={() => addTag(tagInput)} type="button">
              Add
            </button>
          </div>
          {tags.length > 0 && (
            <div className={styles.tagsRow}>
              {tags.map(t => (
                <span key={t} className={styles.tagChip} onClick={() => removeTag(t)}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* ---------- Upload tab (model file) ---------- */}
          {tab === 'upload' && (
            <div className={styles.uploadArea}>
              <label
                className={styles.uploadBox}
                onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                onDrop={onDropModel}
              >
                <input type="file" accept=".safetensors,.pt,.bin" hidden onChange={e => onPickModelFile(e.target.files)} />
                <div className={styles.uploadInner}>
                  <Upload size={20} />
                  <p>Click to upload or drag & drop</p>
                  <p className={styles.subText}>Model file (.safetensors, .pt, .bin)</p>
                </div>
              </label>

              {file && (
                <ul className={styles.fileCardList}>
                  <li className={styles.fileCard}>
                    <div className={styles.fileInfo}>
                      <div className={styles.fileName} title={file.name}>{file.name}</div>
                      <div className={styles.fileMeta}>{fmtSize(file.size)}</div>
                    </div>
                    <button className={styles.iconBtn} onClick={clearModelFile} aria-label="Remove file" type="button">
                      <Trash2 size={16} />
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}

          {/* ---------- Train tab (images) ---------- */}
          {tab === 'train' && (
            <div className={styles.trainGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Trigger word / sentence</label>
                <input
                  className={styles.input}
                  placeholder="e.g., 'restcom-style' or 'a portrait of @alex'"
                  value={trigger}
                  onChange={e => setTrigger(e.target.value)}
                />
                <div className={styles.muted}>Used in prompts to invoke the style or subject.</div>
              </div>

              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label className={styles.label}>Repeat trains per image</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    step={1}
                    value={repeatPerImage}
                    onChange={e => setRepeatPerImage(Number(e.target.value || 1))}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Max train epochs</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    step={1}
                    value={maxEpochs}
                    onChange={e => setMaxEpochs(Number(e.target.value || 1))}
                  />
                </div>
              </div>

              {/* Clickable + DnD */}
              <label
                className={styles.dropZone}
                onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
                onDrop={onDropTrain}
              >
                <input type="file" accept="image/*" multiple hidden onChange={e => onPickTrainFiles(e.target.files)} />
                <div className={styles.dropInner}>
                  <Upload size={18} />
                  <div>Click to upload or drag & drop</div>
                  <div className={styles.subText}>Images (JPG, PNG, WEBP)</div>
                </div>
              </label>

              {/* Cards */}
              {trainImages.length > 0 && (
                <>
                  <div className={styles.trainHeader}>
                    <span>{trainImages.length} image(s) selected</span>
                    <button className={styles.iconBtn} onClick={clearTrainImages} type="button" aria-label="Clear all">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className={styles.trainList}>
                    {trainImages.map(img => (
                      <div key={img.id} className={styles.trainItem}>
                        <img className={styles.trainThumb} src={img.url} alt="train" />
                        <div className={styles.trainMetaRow}>
                          <span className={styles.trainFilename} title={img.file.name}>{img.file.name}</span>
                          <span className={styles.trainFilesize}>{fmtSize(img.file.size)}</span>
                        </div>
                        <input
                          className={styles.trainCaption}
                          placeholder="Optional caption…"
                          value={img.caption}
                          onChange={e =>
                            setTrainImages(prev =>
                              prev.map(it => (it.id === img.id ? { ...it, caption: e.target.value } : it))
                            )
                          }
                        />
                        <button className={styles.iconBtn} onClick={() => removeTrainImage(img.id)} aria-label="Remove image" type="button">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className={styles.estimateRow} role="status" aria-live="polite">
                    <span className={styles.muted}>Estimated steps</span>
                    <span className={styles.stepsValue}>{estimatedSteps.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.secondaryBtn} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={styles.primaryBtn}
            onClick={submit}
            disabled={
              submitting ||
              !name.trim() ||
              (tab === 'upload' ? !file : trainImages.length === 0)
            }
            type="button"
          >
            {tab === 'upload' ? (submitting ? 'Adding…' : 'Add LoRA') : (submitting ? 'Starting…' : 'Start Training')}
          </button>
        </div>
      </div>
    </div>
  )
}
