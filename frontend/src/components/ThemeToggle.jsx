/**
 * ThemeToggle.jsx
 * Small header control for switching between light and dark themes (with optional system mode).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const ThemeToggle = () => {
  const { theme, setTheme } = useThemeStore()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const active = useMemo(
    () => options.find((o) => o.value === theme) ?? options[2],
    [theme],
  )

  useEffect(() => {
    if (!open) return

    const onMouseDown = (e) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target)) setOpen(false)
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-900"
        aria-label="Theme"
        aria-expanded={open}
      >
        <active.icon className="h-5 w-5" />
      </button>

      {open && (
        <div className="dropdown-menu">
          {options.map((opt) => {
            const Icon = opt.icon
            const isActive = opt.value === theme
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTheme(opt.value)
                  setOpen(false)
                }}
                className={`dropdown-item w-full text-left flex items-center justify-between ${
                  isActive ? 'bg-gray-50 dark:bg-gray-800' : ''
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {opt.label}
                </span>
                {isActive && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Active</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ThemeToggle
