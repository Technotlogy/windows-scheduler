// api/sync.js — Vercel Edge Function
// Cloud backup for scheduler data using Vercel Blob.
// GET  /api/sync  → returns the stored data blob
// POST /api/sync  → saves the data blob

import { put, list } from '@vercel/blob'

export const config = { runtime: 'edge' }

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

  if (req.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: PATH, limit: 1 })
      if (blobs.length === 0) return new Response('{}', { headers: CORS })
      const r = await fetch(blobs[0].url, { cache: 'no-store' })
      const text = await r.text()
      return new Response(text, { headers: CORS })
    } catch {
      return new Response('{}', { headers: CORS })
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.text()
      await put(PATH, body, {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'application/json',
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
