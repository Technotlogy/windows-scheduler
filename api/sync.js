// api/sync.js — Vercel Serverless Function (Node.js runtime)
// Uses @vercel/blob with access:'private' — the correct approach for private stores.
//
// GET  /api/sync          → returns scheduler/data.json
// POST /api/sync          → saves  scheduler/data.json
// GET  /api/sync?type=ics → returns scheduler/calendar.ics
// POST /api/sync?type=ics → saves  scheduler/calendar.ics

import { put, get } from '@vercel/blob'

export const config = { api: { bodyParser: false } }

const PATHS = { json: 'scheduler/data.json', ics: 'scheduler/calendar.ics' }
const CONTENT_TYPES = { json: 'application/json', ics: 'text/calendar' }

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

  const type = req.query?.type === 'ics' ? 'ics' : 'json'
  const path = PATHS[type]
  const contentType = CONTENT_TYPES[type]

  if (req.method === 'GET') {
    try {
      const result = await get(path, { access: 'private' })
      if (!result || result.statusCode !== 200) {
        res.setHeader('Content-Type', contentType)
        return res.status(200).send(type === 'json' ? '{}' : '')
      }
      const chunks = []
      for await (const chunk of result.stream) chunks.push(Buffer.from(chunk))
      res.setHeader('Content-Type', contentType)
      return res.status(200).send(Buffer.concat(chunks))
    } catch {
      res.setHeader('Content-Type', contentType)
      return res.status(200).send(type === 'json' ? '{}' : '')
    }
  }

  if (req.method === 'POST') {
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const body = Buffer.concat(chunks).toString()

      await put(path, body, {
        access: 'private',
        contentType,
        addRandomSuffix: false,
      })
      return res.status(200).json({ ok: true })
    } catch (e) {
      console.warn('[sync] error:', e.message)
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(405).send('Method not allowed')
}
