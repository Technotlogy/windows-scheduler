// src/usePersist.js
// Drop-in replacement for useState that persists to localStorage.
// All scheduler data survives page refreshes and PWA restarts.
// Changes are also debounced-synced to Vercel KV for cross-device restore.

import { useState, useEffect, useRef } from 'react'

// ── Cloud sync (debounced 2 s after last change) ──────────────────────────────
let _syncTimer = null

function _pushToCloud() {
  try {
    const data = exportData()
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {}) // fire-and-forget; silently ignore network failures
  } catch {}
}

function _scheduleSyncToCloud() {
  clearTimeout(_syncTimer)
  _syncTimer = setTimeout(_pushToCloud, 2000)
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePersist(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(`com_${key}`)
      return stored !== null ? JSON.parse(stored) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip writing on first render (we just read it)
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    try {
      localStorage.setItem(`com_${key}`, JSON.stringify(state))
      _scheduleSyncToCloud()
    } catch (e) {
      console.warn(`usePersist: failed to save ${key}`, e)
    }
  }, [key, state])

  return [state, setState]
}

// ── Bulk helpers ──────────────────────────────────────────────────────────────

// Export all data as a JSON blob (for backup / cloud sync)
export function exportData() {
  const data = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k.startsWith('com_')) {
      try { data[k.slice(4)] = JSON.parse(localStorage.getItem(k)) } catch {}
    }
  }
  return data
}

// Import a backup JSON blob (writes to localStorage)
export function importData(json) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json
    for (const [k, v] of Object.entries(data)) {
      localStorage.setItem(`com_${k}`, JSON.stringify(v))
    }
    return true
  } catch {
    return false
  }
}
