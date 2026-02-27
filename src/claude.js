// src/claude.js
// All Claude calls go through /api/claude (the Vercel edge function),
// which injects the API key server-side. Your key is never in the browser.

const MODEL = 'claude-sonnet-4-5'

export async function claudeCall({ system, userMessage, maxTokens = 1000 }) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Claude API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text || ''
  return text
}

// ── Quick Add: parse natural language into a structured event ───────────────
export async function parseEvent(text) {
  try {
    const raw = await claudeCall({
      system: `Parse natural language scheduling input. Today is ${new Date().toDateString()}. Return ONLY valid JSON:
{"title":"string","date":"YYYY-MM-DD or null","time":"H:MM AM/PM or null","type":"job|appointment|task|workout|meal|decompress","person":"string or null","contact":"string or null","location":"string or null","income":"number or null","notes":"string","priority":"high|normal","duration":"30 min|45 min|1 hr|1.5 hr|2 hr|2.5 hr|3 hr|4 hr|All day or null","travelTime":"5 min|10 min|15 min|20 min|30 min|45 min|1 hr|1.5 hr or null"}`,
      userMessage: text,
    })
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch (e) {
    console.error('parseEvent failed:', e)
    return null
  }
}

// ── Autopopulate: suggest schedule for open time slots ──────────────────────
export async function autopopulateDay({ block, openSlots, jobs, appts, tasks, wakeR, bedR, date }) {
  const DFULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const fmt12 = (h) => {
    if (h == null) return ''
    const hh = Math.floor(h) % 24
    const mm = Math.round((h - Math.floor(h)) * 60)
    const ap = hh >= 12 ? 'PM' : 'AM'
    const hr = hh % 12 === 0 ? 12 : hh % 12
    return `${hr}${mm > 0 ? `:${String(mm).padStart(2,'0')}` : ''}${ap}`
  }

  const dayName = DFULL[(date.getDay() + 6) % 7]
  const shiftLabel = block
    ? (block.type === 'off' ? 'Off day'
      : block.type === 'day' ? `Day shift ${fmt12(block.sh)}–${fmt12(block.eh)}`
      : `Night shift ${fmt12(block.sh)}–${fmt12(block.eh)}`)
    : 'Off day'

  const slotsDesc = openSlots.map(s => `${fmt12(s.start)}–${fmt12(s.end)} (${s.hrs} hr${s.hrs !== 1 ? 's' : ''})`).join(', ')
  const jobsDesc = jobs.map(j => `${j.name}${j.time ? ' at ' + j.time : ''}${j.duration ? ' (~' + j.duration + ')' : ''}${j.travelTime ? ' + ' + j.travelTime + ' travel' : ''}`).join('; ') || 'none'
  const apptsDesc = appts.map(a => `${a.title}${a.time ? ' at ' + a.time : ''}${a.duration ? ' (~' + a.duration + ')' : ''}${a.travelTime ? ' + ' + a.travelTime + ' travel' : ''}`).join('; ') || 'none'
  const tasksDesc = tasks.map(t => `${t.text}${t.duration ? ' (~' + t.duration + ')' : ''}`).join('; ') || 'none'

  try {
    const raw = await claudeCall({
      maxTokens: 1200,
      system: `You are a life scheduler assistant for Ethan, a 21-year-old DuPont shift mill worker who also runs handyman, vehicle repair, and furniture restoration side businesses. He is a volunteer EMT/firefighter, practices Stoicism, and is building a YouTube channel called "The Cost of Meaning".

Given the day's known schedule and open time slots, suggest a practical prioritized schedule that fills the open time. Return ONLY valid JSON array:
[{"time":"H:MM AM/PM","label":"string","type":"task|workout|meal|decompress|content|errand","duration":"string","notes":"string or null"}]

Be practical and respect:
- Travel times before/after jobs/appointments
- He needs decompression time on work days  
- Workout when energy is highest (after sleep on off/day days, before night shift)
- Meal prep batching makes sense on off days
- Keep responses to the actual open slots only`,
      userMessage: `Day: ${dayName}\nShift: ${shiftLabel}\nOpen slots: ${slotsDesc}\nSide jobs today: ${jobsDesc}\nAppointments today: ${apptsDesc}\nPending tasks: ${tasksDesc}\nWake routine: ${wakeR.join(', ')}\nBed routine: ${bedR.join(', ')}`,
    })
    return JSON.parse(raw.replace(/```json|```/g, '').trim())
  } catch {
    return null
  }
}
