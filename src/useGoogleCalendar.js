// src/useGoogleCalendar.js
// Handles Google Calendar OAuth flow, token management, and sync operations.
//
// SETUP (one-time, see README):
//   1. Go to console.cloud.google.com → New Project
//   2. Enable "Google Calendar API"
//   3. OAuth consent screen → External → add your Gmail as test user
//   4. Credentials → OAuth 2.0 Client ID → Web application
//   5. Add redirect URI: https://YOUR-APP.vercel.app/oauth/callback
//   6. Copy Client ID → VITE_GOOGLE_CLIENT_ID in your .env
//   7. Copy Client Secret → GOOGLE_CLIENT_SECRET in Vercel dashboard

import { useState, useEffect, useCallback } from 'react'

const SCOPES = 'https://www.googleapis.com/auth/calendar'
const STORAGE_KEY = 'gcal_tokens'

function getTokens() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}
function saveTokens(t) { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)) }
function clearTokens() { localStorage.removeItem(STORAGE_KEY) }

async function gcalRequest(accessToken, method, path, body) {
  const res = await fetch('/api/gcal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, method, path, body }),
  })
  return res.json()
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('/api/gcal?action=refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  return res.json()
}

export function useGoogleCalendar() {
  const [tokens, setTokens] = useState(getTokens)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState('') // '', 'synced', 'error'
  const [calendarId, setCalendarId] = useState(
    () => localStorage.getItem('gcal_calendar_id') || 'primary'
  )

  const isConnected = !!tokens?.access_token

  // ── OAuth login ──────────────────────────────────────────────────────────
  const login = useCallback(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      alert('Google Client ID not configured. See README for setup instructions.')
      return
    }
    const redirectUri = `${window.location.origin}/oauth/callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setTokens(null)
    setSyncStatus('')
  }, [])

  // ── Handle OAuth callback ─────────────────────────────────────────────────
  // Call this from a /oauth/callback route or on mount if URL has ?code=
  const handleCallback = useCallback(async (code) => {
    try {
      const res = await fetch('/api/gcal?action=exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (data.access_token) {
        const tokenData = { ...data, obtained_at: Date.now() }
        saveTokens(tokenData)
        setTokens(tokenData)
        // Clean up URL
        window.history.replaceState({}, '', '/')
        return true
      }
    } catch (e) {
      console.error('OAuth callback error', e)
    }
    return false
  }, [])

  // ── Get valid access token (auto-refresh if expired) ─────────────────────
  const getValidToken = useCallback(async () => {
    if (!tokens) return null
    const expiresIn = tokens.expires_in || 3600
    const expiresAt = (tokens.obtained_at || 0) + expiresIn * 1000
    const isExpired = Date.now() > expiresAt - 60000 // refresh 1min early

    if (!isExpired) return tokens.access_token

    if (!tokens.refresh_token) {
      clearTokens()
      setTokens(null)
      return null
    }

    try {
      const refreshed = await refreshAccessToken(tokens.refresh_token)
      if (refreshed.access_token) {
        const updated = { ...tokens, ...refreshed, obtained_at: Date.now() }
        saveTokens(updated)
        setTokens(updated)
        return refreshed.access_token
      }
    } catch (e) {
      console.error('Token refresh failed', e)
    }
    clearTokens()
    setTokens(null)
    return null
  }, [tokens])

  // ── Push event to Google Calendar ────────────────────────────────────────
  const pushEvent = useCallback(async ({ title, date, startHour, endHour, color, description, eventId }) => {
    const token = await getValidToken()
    if (!token) return null

    const dateStr = date // 'YYYY-MM-DD'
    const startTime = hourToISO(dateStr, startHour)
    const endTime = hourToISO(dateStr, endHour)

    // colorId map: 1=lavender,2=sage,3=grape,4=flamingo,5=banana,6=tangerine,7=peacock,8=graphite,9=blueberry,10=basil,11=tomato
    const colorMap = { shift: '9', sleep: '8', job: '10', appt: '7', workout: '11', meal: '5', todo: '1' }

    const event = {
      summary: title,
      description: description || '',
      start: { dateTime: startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      colorId: colorMap[color] || '1',
      extendedProperties: {
        private: { comSchedulerSync: 'true', comEventType: color || 'todo' }
      }
    }

    if (eventId) {
      return gcalRequest(token, 'PUT', `/calendars/${calendarId}/events/${eventId}`, event)
    }
    return gcalRequest(token, 'POST', `/calendars/${calendarId}/events`, event)
  }, [getValidToken, calendarId])

  // ── Delete event from Google Calendar ───────────────────────────────────
  const deleteEvent = useCallback(async (eventId) => {
    const token = await getValidToken()
    if (!token || !eventId) return
    return gcalRequest(token, 'DELETE', `/calendars/${calendarId}/events/${eventId}`)
  }, [getValidToken, calendarId])

  // ── Full day sync: push shift, jobs, appts, tasks to Google Calendar ────
  const syncDay = useCallback(async ({ date, block, jobs, appts, tasks, commuteMin }) => {
    const token = await getValidToken()
    if (!token) return false

    setSyncing(true)
    setSyncStatus('')

    try {
      const pushes = []

      // Shift
      if (block && block.type !== 'off' && block.sh != null) {
        let sh = block.sh, eh = block.eh
        if (eh <= sh) eh += 24
        const commH = (commuteMin || 0) / 60
        pushes.push(pushEvent({
          title: block.type === 'day' ? '☀️ Day Shift — Mill' : '🌙 Night Shift — Mill',
          date, startHour: sh, endHour: eh,
          color: 'shift',
          description: `DuPont ${block.type} shift`
        }))
        if (commH > 0) {
          pushes.push(pushEvent({ title: '🚗 Commute to Mill', date, startHour: sh - commH, endHour: sh, color: 'shift', description: '' }))
          pushes.push(pushEvent({ title: '🚗 Commute Home', date, startHour: eh, endHour: eh + commH, color: 'shift', description: '' }))
        }
      }

      // Jobs
      for (const j of (jobs || [])) {
        const t = parseTimeStr(j.time)
        if (t == null) continue
        const durMap = { '30 min': 0.5, '45 min': 0.75, '1 hr': 1, '1.5 hr': 1.5, '2 hr': 2, '2.5 hr': 2.5, '3 hr': 3, '4 hr': 4, 'All day': 8 }
        const dur = durMap[j.duration] || 1.5
        pushes.push(pushEvent({
          title: `💼 ${j.name}${j.person ? ` — ${j.person}` : ''}`,
          date, startHour: t, endHour: t + dur,
          color: 'job',
          description: [j.contact, j.notes, j.income ? `Est. $${j.income}` : ''].filter(Boolean).join('\n')
        }))
      }

      // Appointments
      for (const a of (appts || [])) {
        const t = parseTimeStr(a.time)
        if (t == null) continue
        const durMap = { '30 min': 0.5, '45 min': 0.75, '1 hr': 1, '1.5 hr': 1.5, '2 hr': 2, '2.5 hr': 2.5, '3 hr': 3, '4 hr': 4, 'All day': 8 }
        const dur = durMap[a.duration] || 1
        pushes.push(pushEvent({
          title: `📅 ${a.title}${a.person ? ` — ${a.person}` : ''}`,
          date, startHour: t, endHour: t + dur,
          color: 'appt',
          description: [a.contact, a.location, a.notes].filter(Boolean).join('\n')
        }))
      }

      // Tasks (all-day events)
      for (const task of (tasks || [])) {
        if (!task.text) continue
        const token2 = await getValidToken()
        if (!token2) continue
        const event = {
          summary: `✅ ${task.text}`,
          start: { date },
          end: { date },
          colorId: task.priority === 'high' ? '11' : '1',
          extendedProperties: { private: { comSchedulerSync: 'true', comEventType: 'todo' } }
        }
        pushes.push(gcalRequest(token2, 'POST', `/calendars/${calendarId}/events`, event))
      }

      await Promise.all(pushes)
      setSyncStatus('synced')
      setTimeout(() => setSyncStatus(''), 3000)
      return true
    } catch (e) {
      console.error('Sync error', e)
      setSyncStatus('error')
      return false
    } finally {
      setSyncing(false)
    }
  }, [getValidToken, pushEvent, calendarId])

  // ── Handle OAuth code in URL on mount ────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) handleCallback(code)
  }, [handleCallback])

  return {
    isConnected,
    login,
    logout,
    syncDay,
    pushEvent,
    deleteEvent,
    syncing,
    syncStatus,
    calendarId,
    setCalendarId,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hourToISO(dateStr, hour) {
  const h = Math.floor(hour) % 24
  const m = Math.round((hour - Math.floor(hour)) * 60)
  const dayOffset = hour >= 24 ? 1 : 0
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + dayOffset)
  return `${d.toISOString().split('T')[0]}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function parseTimeStr(str) {
  if (!str) return null
  const m = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (!m) return null
  let h = parseInt(m[1])
  const min = m[2] ? parseInt(m[2]) : 0
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h + min / 60
}
