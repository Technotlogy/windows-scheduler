// api/gcal.js — Vercel Edge Function for Google Calendar operations
// Handles OAuth token exchange and Calendar API proxying

export const config = { runtime: 'edge' }

const GCAL_BASE = 'https://www.googleapis.com/calendar/v3'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }

  try {
    // ── Token exchange (auth code → access + refresh tokens) ──
    if (action === 'exchange') {
      const { code } = await req.json()
      const params = new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      })
      const res = await fetch(TOKEN_URL, { method: 'POST', body: params })
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: corsHeaders })
    }

    // ── Refresh access token ──
    if (action === 'refresh') {
      const { refresh_token } = await req.json()
      const params = new URLSearchParams({
        refresh_token,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      })
      const res = await fetch(TOKEN_URL, { method: 'POST', body: params })
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: corsHeaders })
    }

    // ── Calendar API proxy ──
    // All other actions proxy directly to Google Calendar API
    const { accessToken, method, path, body } = await req.json()
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'No access token' }), { status: 401, headers: corsHeaders })
    }

    const res = await fetch(`${GCAL_BASE}${path}`, {
      method: method || 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), { status: res.status, headers: corsHeaders })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
}
