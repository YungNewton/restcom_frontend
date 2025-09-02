// src/lib/setupAuthInterceptors.ts
import type { AxiosInstance, AxiosError } from 'axios'

type Options = {
  onUnauthorized: () => Promise<void> | void
}

export const setupAuthInterceptors = (
  client: AxiosInstance,
  { onUnauthorized }: Options
) => {
  const id = client.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
      const status = error.response?.status
      if (status === 401 || status === 419) {
        await onUnauthorized()
      }
      return Promise.reject(error)
    }
  )
  return () => client.interceptors.response.eject(id) // cleanup function
}
