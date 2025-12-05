import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { useLocation } from 'react-router-dom'

import Navbar from '../../../components/Dashboard/navbar/DashboardNav'
import Sidebar from '../../../components/Dashboard/sidebar/Sidebar'
import styles from '../../../components/Dashboard/Dashboard.module.css'

import LoraLibraryComponent, { type Lora } from '../../../components/Image/LoraLibrary/LoraLibrary'

const API_BASE = import.meta.env.VITE_API_BASE_URL

export default function LoraLibraryPage() {
  const location = useLocation()
  const [items, setItems] = useState<Lora[]>([])
  const [loading, setLoading] = useState(false)

  const fetchLoras = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get<Lora[]>(`${API_BASE}/loras/`)
      setItems(data || [])
    } catch {
      // optional: toast.error('Failed to load LoRAs')
    } finally {
      setLoading(false)
    }
  }, [])

  // const handleAdd = useCallback(
  //   async ({ name, type, file, url, tags }: { name: string; type: NonNullable<Lora['type']>; file?: File; url?: string; tags: string[] }) => {
  //     if (file) {
  //       const fd = new FormData()
  //       fd.append('name', name)
  //       fd.append('type', type)
  //       fd.append('tags', JSON.stringify(tags))
  //       fd.append('file', file)
  //       await axios.post(`${API_BASE}/loras/`, fd)
  //     } else {
  //       await axios.post(`${API_BASE}/loras/`, { name, type, url, tags })
  //     }
  //     await fetchLoras()
  //   },
  //   [fetchLoras]
  // )

  const handleToggleFavorite = useCallback(
    async (id: string, next: boolean) => {
      await axios.post(`${API_BASE}/loras/${id}/favorite/`, { favorite: next })
      setItems(prev => prev.map(l => (l.id === id ? { ...l, isFavorite: next } : l)))
    },
    []
  )

  const handleRename = useCallback(async (id: string, nextName: string) => {
    await axios.patch(`${API_BASE}/loras/${id}/`, { name: nextName })
    setItems(prev => prev.map(l => (l.id === id ? { ...l, name: nextName } : l)))
  }, [])

  const handleDelete = useCallback(
    async (ids: string[]) => {
      await Promise.all(ids.map(id => axios.delete(`${API_BASE}/loras/${id}/`)))
      await fetchLoras()
    },
    [fetchLoras]
  )

  const handleDownload = useCallback(async (id: string) => {
    const res = await axios.get(`${API_BASE}/loras/${id}/download/`, { responseType: 'blob' })
    const blobUrl = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `${id}.safetensors`
    a.click()
    URL.revokeObjectURL(blobUrl)
  }, [])

  useEffect(() => {
    fetchLoras()
  }, [fetchLoras])

  return (
    <div className={styles.dashboard}>
      <Navbar />
      <div className={styles.main}>
        <div className={styles.sidebarPane}>
          <Sidebar activePath={location.pathname} />
        </div>

        {/* CONTENT PANE centers a fixed-width libraryPane that never shrinks */}
        <div className={styles.contentPane}>
          <div className={styles.libraryPane}>
            <LoraLibraryComponent
              items={items}
              isLoading={loading}
              onRefresh={fetchLoras}
              // onAdd={handleAdd}
              onToggleFavorite={handleToggleFavorite}
              onRename={handleRename}
              onDelete={handleDelete}
              onDownload={handleDownload}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
