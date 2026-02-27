// api/sync.js — Vercel Serverless Function (Node.js runtime)
//
// Handles cloud backup of scheduler data to Vercel Blob.
//
// Endpoints:
//   GET  /api/sync          → fetch scheduler/data.json
//   POST /api/sync          → save  scheduler/data.json
//   GET  /api/sync?type=ics → fetch scheduler/calendar.ics
//   POST /api/sync?type=ics → save  scheduler/calendar.ics
//
// ── Access note ──────────────────────────────────────────────────────────────
// Currently using access:'public' because private blob delivery requires
// a full client-side auth flow (see Vercel docs: "Serving private blobs").
// To upgrade to private later:
//   1. Change access:'public' → access:'private' in put() call
//   2. Replace the GET handler with an authenticated get() + stream pattern:
//        import { get } from '@vercel/blob'
//        const result = await get(path, { access: 'private' })
//        res.send(result.stream)
//   3. Add auth middleware so only your app can call GET /api/sync
// ─────────────────────────────────────────────────────────────────────────────

import { put, list } from '@vercel/blob'

// Disable Vercel's automatic body parsing so we can read raw text/JSON/ICS
export const config = { api: { bodyParser: false } }

const PATHS = {
  json: 'scheduler/data.json',
  ics:  'scheduler/calendar.ics',
}
const CONTENT_TYPES = {
  json: 'application/json',
  ics:  'text/calendar',
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Blob not configured' })
  }

  const type        = req.query?.type === 'ics' ? 'ics' : 'json'
  const path        = PATHS[type]
  const contentType = CONTENT_TYPES[type]

  // ── GET: fetch the latest blob by prefix, return its content ───────────────
  if (req.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: path, limit: 1 })
      if (!blobs.length) {
        res.setHeader('Content-Type', contentType)
        return res.status(200).send(type === 'json' ? '{}' : '')
      }
      // Public blob — fetch directly from CDN URL (no auth needed)
      const r = await fetch(blobs[0].url, { cache: 'no-store' })
      res.setHeader('Content-Type', contentType)
      return res.status(200).send(await r.text())
    } catch {
      res.setHeader('Content-Type', contentType)
      return res.status(200).send(type === 'json' ? '{}' : '')
    }
  }

  // ── POST: read raw body, overwrite blob at fixed path ──────────────────────
  if (req.method === 'POST') {
    try {
      // Read raw body (works for both JSON and ICS since bodyParser is off)
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = Buffer.concat(chunks).toString()

      await put(path, body, {
        access: 'public',      // TODO: switch to 'private' once auth flow is in place
        contentType,
        addRandomSuffix: false, // keep path deterministic so each save overwrites
      })

      return res.status(200).json({ ok: true })
    } catch (e) {
      console.warn('[sync] PUT error:', e.message)
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(405).send('Method not allowed')
}
