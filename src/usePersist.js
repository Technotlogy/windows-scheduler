// src/usePersist.js
// Drop-in replacement for useState that persists to localStorage.
// All scheduler data survives page refreshes and PWA restarts.
// Changes are debounced-synced to Vercel Blob; a 5-min interval catches anything missed.
// exportData() drives both the JSON save-state and the ICS calendar export.

import { useState, useEffect, useRef } from 'react'

// ── ICS calendar export ───────────────────────────────────────────────────────
const DUR_MIN = {'30 min':30,'45 min':45,'1 hr':60,'1.5 hr':90,'2 hr':120,'2.5 hr':150,'3 hr':180,'4 hr':240,'All day':480}

function _parseTime(str) {
  if (!str) return null
  const m = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (!m) return null
  let h = parseInt(m[1])
  const min = m[2] ? parseInt(m[2]) : 0
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return { h, min }
}

function _dtStamps(dateKey, timeStr, durStr) {
  const base = dateKey.replace(/-/g, '')
  const t = _parseTime(timeStr)
  if (!t) return { start: `${base}`, end: `${base}`, allDay: true }
  const durMins = DUR_MIN[durStr] || 60
  const startMins = t.h * 60 + t.min
  const endMins = startMins + durMins
  const pad = n => String(n).padStart(2, '0')
  const fmt = (totalMins) => `${base}T${pad(Math.floor(totalMins/60)%24)}${pad(totalMins%60)}00`
  return { start: fmt(startMins), end: fmt(endMins), allDay: false }
}

function _esc(str) { return (str || '').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n') }

export function generateICS(data) {
  const stamp = new Date().toISOString().replace(/[-:.]/g,'').slice(0,15) + 'Z'
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Cost of Meaning Scheduler//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH']

  const addEvent = (uid, summary, dateKey, timeStr, durStr, desc) => {
    const { start, end, allDay } = _dtStamps(dateKey, timeStr, durStr)
    lines.push('BEGIN:VEVENT', `UID:${uid}@com-scheduler`)
    if (allDay) { lines.push(`DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`) }
    else         { lines.push(`DTSTART:${start}`, `DTEND:${end}`) }
    lines.push(`SUMMARY:${_esc(summary)}`)
    if (desc) lines.push(`DESCRIPTION:${_esc(desc)}`)
    lines.push(`DTSTAMP:${stamp}`, 'END:VEVENT')
  }

  for (const [date, jobs] of Object.entries(data.jobs || {}))
    for (const j of jobs)
      addEvent(`job-${j.id}`, `💼 ${j.name}`, date, j.time, j.duration,
        [j.person, j.notes].filter(Boolean).join(' | '))

  for (const [date, appts] of Object.entries(data.appts || {}))
    for (const a of appts)
      addEvent(`appt-${a.id}`, `📅 ${a.title}`, date, a.time, a.duration,
        [a.person, a.location, a.notes].filter(Boolean).join(' | '))

  for (const t of (data.tasks || []))
    if (t.date)
      addEvent(`task-${t.id}`, `✅ ${t.text}`, t.date, null, t.duration, '')

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// ── Cloud sync ────────────────────────────────────────────────────────────────
let _syncTimer = null

async function _pushToCloud() {
  const data = exportData()
  const keys = Object.keys(data).length
  console.log(`[sync] pushing ${keys} keys to cloud…`)

  // JSON save-state (driven by exportData)
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (result.ok) console.log('[sync] ✓ JSON saved')
    else console.warn('[sync] JSON save failed:', JSON.stringify(result))
  } catch (e) { console.warn('[sync] JSON error:', e.message) }

  // ICS calendar export (same data, different format)
  try {
    const ics = generateICS(data)
    const res = await fetch('/api/sync?type=ics', {
      method: 'POST',
      headers: { 'Content-Type': 'text/calendar' },
      body: ics,
    })
    const result = await res.json()
    if (result.ok) console.log('[sync] ✓ ICS saved')
    else console.warn('[sync] ICS save failed:', JSON.stringify(result))
  } catch (e) { console.warn('[sync] ICS error:', e.message) }
}

function _scheduleSyncToCloud() {
  clearTimeout(_syncTimer)
  _syncTimer = setTimeout(_pushToCloud, 2000)
}

// Periodic sync every 5 minutes — catches anything the debounce might miss
setInterval(_pushToCloud, 5 * 60 * 1000)

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
    if (isFirstRender.current) { isFirstRender.current = false; return }
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
