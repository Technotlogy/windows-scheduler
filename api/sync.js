// api/sync.js — Vercel Edge Function
// Cloud backup for scheduler data using Vercel Blob REST API directly.
// No package imports = no Node.js module conflicts with other edge functions.
// GET  /api/sync  → returns the stored data blob
// POST /api/sync  → saves the data blob

export const config = { runtime: 'edge' }

const BLOB_API = 'https://blob.vercel-storage.com'
const PATH = 'scheduler/data.json'
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...CORS,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'Blob not configured' }), {
      status: 500,
      headers: CORS,
    })
  }

  const auth = { Authorization: `Bearer ${token}`, 'x-api-version': '7' }

  if (req.method === 'GET') {
    try {
      const r = await fetch(`${BLOB_API}?prefix=${encodeURIComponent(PATH)}&limit=1`, { headers: auth })
      const { blobs } = await r.json()
      if (!blobs?.length) return new Response('{}', { headers: CORS })
      const data = await fetch(blobs[0].url, { cache: 'no-store' })
      return new Response(await data.text(), { headers: CORS })
    } catch {
      return new Response('{}', { headers: CORS })
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.text()
      await fetch(`${BLOB_API}/${PATH}`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json', 'x-add-random-suffix': '0' },
        body,
      })
      return new Response(JSON.stringify({ ok: true }), { headers: CORS })
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: CORS,
      })
    }
  }

  return new Response('Method not allowed', { status: 405 })
}
