/**
 * themeStore.js
 * Lightweight UI theme state (light/dark/system) with persistence.
 * Applies/removes the `dark` class on the document root for Tailwind dark mode.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const THEME_STORAGE_KEY = 'theme-storage-v1'

const getSystemPrefersDark = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
}

const applyThemeToDom = (theme) => {
  if (typeof document === 'undefined') return

  const isDark = theme === 'dark' || (theme === 'system' && getSystemPrefersDark())
  document.documentElement.classList.toggle('dark', isDark)
}

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'system', // 'light' | 'dark' | 'system'

      setTheme: (theme) => {
        set({ theme })
        applyThemeToDom(theme)
      },

      initialize: () => {
        applyThemeToDom(get().theme)
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
)

export { useThemeStore, applyThemeToDom }

