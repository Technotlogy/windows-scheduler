// api/sync.js — Vercel Edge Function
// Cloud backup using Vercel Blob REST API (no package imports).
//
// JSON save-state:
//   GET  /api/sync          → returns scheduler/data.json
//   POST /api/sync          → saves  scheduler/data.json
//
// ICS calendar export:
//   GET  /api/sync?type=ics → returns scheduler/calendar.ics
//   POST /api/sync?type=ics → saves  scheduler/calendar.ics

export const config = { runtime: 'edge' }

const BLOB_API = 'https://blob.vercel-storage.com'
const PATHS = { json: 'scheduler/data.json', ics: 'scheduler/calendar.ics' }
const CONTENT_TYPES = { json: 'application/json', ics: 'text/calendar' }
const CORS = { 'Access-Control-Allow-Origin': '*' }

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    })
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'Blob not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const type = new URL(req.url).searchParams.get('type') === 'ics' ? 'ics' : 'json'
  const path = PATHS[type]
  const contentType = CONTENT_TYPES[type]
  const auth = { Authorization: `Bearer ${token}`, 'x-api-version': '7' }

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${BLOB_API}?prefix=${encodeURIComponent(path)}&limit=1`, { headers: auth })
      const { blobs } = await r.json()
      if (!blobs?.length) return new Response(type === 'json' ? '{}' : '', { headers: { ...CORS, 'Content-Type': contentType } })
      const data = await fetch(`${BLOB_API}/download?url=${encodeURIComponent(blobs[0].url)}`, { headers: auth, cache: 'no-store' })
      return new Response(await data.text(), { headers: { ...CORS, 'Content-Type': contentType } })
    } catch {
      return new Response(type === 'json' ? '{}' : '', { headers: { ...CORS, 'Content-Type': contentType } })
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.text()

      // Delete any existing blobs at this prefix before writing — private stores
      // don't support x-add-random-suffix:0 (that implies public CDN access), so
      // each PUT gets a random suffix and we clean up stale ones ourselves.
      const listR = await fetch(`${BLOB_API}?prefix=${encodeURIComponent(path)}&limit=10`, { headers: auth })
      const { blobs: old } = await listR.json()
      if (old?.length) {
        await fetch(BLOB_API, {
          method: 'DELETE',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: old.map(b => b.url) }),
        })
      }

      const r = await fetch(`${BLOB_API}/${path}`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': contentType },
        body,
      })
      if (!r.ok) {
        const err = await r.text()
        console.warn(`[sync] blob PUT failed ${r.status}:`, err)
        return new Response(JSON.stringify({ error: err }), { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }
  }

  return new Response('Method not allowed', { status: 405 })
}
