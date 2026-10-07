/**
 * ThemeProvider.jsx
 * Initializes and keeps the Tailwind dark mode class in sync with user preference and OS changes.
 */
import { useEffect } from 'react'
import { applyThemeToDom, useThemeStore } from '../store/themeStore'

const ThemeProvider = ({ children }) => {
  const { initialize } = useThemeStore()

  useEffect(() => {
    initialize()

    // Re-apply theme if the OS theme changes while in `system` mode.
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media?.addEventListener) return

    const handler = () => {
      const { theme } = useThemeStore.getState()
      if (theme === 'system') applyThemeToDom('system')
    }

    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [initialize])

  return children
}

export default ThemeProvider

