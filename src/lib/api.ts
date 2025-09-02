// src/lib/api.ts
import axios from 'axios'
import type { AxiosError, AxiosInstance } from 'axios'

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: { Accept: 'application/json' },
})

export const getAxiosErrorMessage = (err: unknown) => {
  const e = err as AxiosError<any>
  return (
    e.response?.data?.detail ||
    e.response?.data?.message ||
    e.message ||
    'Request failed'
  )
}