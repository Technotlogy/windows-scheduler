// WorkoutPlanner.jsx — Full-featured workout planner with progressive RIR,
// deload weeks, day templates (push/pull/legs/core/custom), weight planning,
// and myo-rep tracking.

import { useState, useEffect, useRef } from 'react'
import { usePersist } from './usePersist'

// ── Color scheme ──────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0f1e', surface: '#0f172a', border: '#1e293b',
  text: '#e2e8f0', muted: '#64748b', accent: '#38bdf8',
  push: '#ef4444', pull: '#3b82f6', legs: '#22c55e',
  core: '#f59e0b', cardio: '#a855f7', other: '#94a3b8',
  deload: '#06b6d4', success: '#4ade80', warn: '#f97316',
}

const CAT_COLORS = {
  push: C.push, pull: C.pull, legs: C.legs,
  core: C.core, cardio: C.cardio, other: C.other,
}

const CATEGORIES = [
  { id: 'push',   label: 'Push',   sub: 'Chest · Triceps · Shoulders', emoji: '💪' },
  { id: 'pull',   label: 'Pull',   sub: 'Back · Biceps · Forearms',    emoji: '🏋' },
  { id: 'legs',   label: 'Legs',   sub: 'Quads · Hams · Glutes',       emoji: '🦵' },
  { id: 'core',   label: 'Core',   sub: 'Abs · Obliques · Lower Back', emoji: '🎯' },
  { id: 'cardio', label: 'Cardio', sub: '',                             emoji: '🏃' },
  { id: 'other',  label: 'Other',  sub: '',                             emoji: '⚡' },
]

const PRESET_EXERCISES = {
  push: ['Bench Press','Incline DB Press','Decline Bench Press','DB Fly','Cable Fly',
         'Chest Dip','Overhead Press','Lateral Raise','Front Raise','Face Pull',
         'Tricep Pushdown','Skull Crusher','Close-Grip Bench','Cable Lateral Raise'],
  pull: ['Pull-Up','Weighted Pull-Up','Lat Pulldown','Cable Row','Barbell Row',
         'DB Row','T-Bar Row','Deadlift','Romanian Deadlift','Shrug',
         'Barbell Curl','DB Curl','Hammer Curl','Preacher Curl','Reverse Curl','Incline DB Curl'],
  legs: ['Squat','Leg Press','Romanian Deadlift','Leg Curl','Leg Extension',
         'Hip Thrust','Calf Raise','Lunges','Bulgarian Split Squat','Hack Squat','Sumo Deadlift'],
  core: ['Plank','Crunches','Cable Crunch','Hanging Leg Raise','Russian Twist',
         'Ab Wheel','Dead Bug','Pallof Press','Bicycle Crunch','V-Up'],
  cardio: ['Treadmill','Elliptical','Stair Master','Stationary Bike','Jump Rope','Row Machine'],
  other: ['Farmers Walk','Battle Ropes','Box Jump','Sled Push','Medicine Ball Slam'],
}

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// ── Default data ──────────────────────────────────────────────────────────────
const DEFAULT_TEMPLATES = [
  {
    id: 'push-a', name: 'Push A', categories: ['push'],
    exercises: [
      { id: 'pa1', name: 'Bench Press',       category: 'push', sets: 4, repRange: '6-10',  isMyorep: false, myoActReps: 15, myoMiniReps: 5, myoMiniSets: 3, notes: '' },
      { id: 'pa2', name: 'Overhead Press',    category: 'push', sets: 3, repRange: '8-12',  isMyorep: false, myoActReps: 15, myoMiniReps: 5, myoMiniSets: 3, notes: '' },
      { id: 'pa3', name: 'Incline DB Press',  category: 'push', sets: 3, repRange: '10-15', isMyorep: false, myoActReps: 15, myoMiniReps: 5, myoMiniSets: 3, notes: '' },
      { id: 'pa4', name: 'Lateral Raise',     category: 'push', sets: 3, repRange: '15-20', isMyorep: true,  myoActReps: 20, myoMiniReps: 5, myoMiniSets: 4, notes: 'Light, focus form' },
      { id: 'pa5', name: 'Tricep Pushdown',   category: 'push', sets: 3, repRange: '12-15', isMyorep: false, myoActReps: 15, myoMiniReps: 5, myoMiniSets: 3, notes: '' },
    ]
  },
  {
    id: 'pull-a', name: 'Pull A', categories: ['pull'],
    exercises: [
      { id: 'pla1', name: 'Pull-Up',         category: 'pull', sets: 4, repRange: '6-10',  isMyorep: false, myoActReps: 12, myoMiniReps: 4, myoMiniSets: 3, notes: '' },
      { id: 'pla2', name: 'Barbell Row',     category: 'pull', sets: 4, repRange: '8-12',  isMyorep: false, myoActReps: 15, myoMiniReps: 5, myoMiniSets: 3, notes: '' },
      { id: 'pla3', name: 'Lat Pulldown',    category: 'pull', sets: 3, repRange: '10-15', isMyorep: false, myoActReps: 15, myoMiniReps: 5, myoMiniSets: 3, notes: '' },
      { id: 'pla4', name: 'Cable Row',       category: 'pull', sets: 3, repRange: '12-15', isMyorep: false, myoActReps: 15, myoMiniReps: 5, myoMiniSets: 3, notes: '' },
      { id: 'pla5', name: 'DB Curl',         category: 'pull', sets: 3, repRange: '12-15', isMyorep: true,  myoActReps: 15, myoMiniReps: 5, myoMiniSets: 4, notes: '' },
    ]
  },
  {
    id: 'legs-a', name: 'Legs A', categories: ['legs'],
    exercises: [
      { id: 'la1', name: 'Squat',              category: 'legs', sets: 4, repRange: '6-10',  isMyorep: false, myoActReps: 12, myoMiniReps: 4, myoMiniSets: 3, notes: '' },
      { id: 'la2', name: 'Romanian Deadlift',  category: 'legs', sets: 3, repRange: '10-12', isMyorep: false, myoActReps: 15, myoMiniReps: 5, myoMiniSets: 3, notes: '' },
      { id: 'la3', name: 'Leg Press',          category: 'legs', sets: 3, repRange: '12-15', isMyorep: false, myoActReps: 15, myoMiniReps: 5, myoMiniSets: 3, notes: '' },
      { id: 'la4', name: 'Leg Curl',           category: 'legs', sets: 3, repRange: '12-15', isMyorep: true,  myoActReps: 15, myoMiniReps: 5, myoMiniSets: 4, notes: '' },
      { id: 'la5', name: 'Calf Raise',         category: 'legs', sets: 4, repRange: '15-20', isMyorep: false, myoActReps: 20, myoMiniReps: 5, myoMiniSets: 4, notes: '' },
    ]
  },
  {
    id: 'core-a', name: 'Core', categories: ['core'],
    exercises: [
      { id: 'ca1', name: 'Plank',              category: 'core', sets: 3, repRange: '30-60s', isMyorep: false, myoActReps: 0, myoMiniReps: 0, myoMiniSets: 0, notes: 'Seconds' },
      { id: 'ca2', name: 'Cable Crunch',       category: 'core', sets: 3, repRange: '15-20',  isMyorep: true,  myoActReps: 20, myoMiniReps: 5, myoMiniSets: 4, notes: '' },
      { id: 'ca3', name: 'Hanging Leg Raise',  category: 'core', sets: 3, repRange: '10-15',  isMyorep: false, myoActReps: 15, myoMiniReps: 5, myoMiniSets: 3, notes: '' },
    ]
  },
]

const makeDefaultProgram = () => ({
  id: uid(),
  name: 'PPL Hypertrophy Block',
  startDate: new Date().toISOString().slice(0, 10),
  weeksTotal: 5,
  rirSchedule: [3, 2, 1, 0, null], // null = deload week (overridden by deloadWeeks)
  deloadWeeks: [5],                  // 1-indexed week numbers
  deloadVolumeFactor: 0.6,
  weeklyPlan: {
    '1': { Mon: 'push-a', Tue: 'pull-a', Wed: 'legs-a', Thu: null, Fri: 'push-a', Sat: 'pull-a', Sun: null },
    '2': { Mon: 'push-a', Tue: 'pull-a', Wed: 'legs-a', Thu: null, Fri: 'push-a', Sat: 'pull-a', Sun: null },
    '3': { Mon: 'push-a', Tue: 'pull-a', Wed: 'legs-a', Thu: null, Fri: 'push-a', Sat: 'pull-a', Sun: null },
    '4': { Mon: 'push-a', Tue: 'pull-a', Wed: 'legs-a', Thu: null, Fri: 'push-a', Sat: 'pull-a', Sun: null },
    '5': { Mon: 'push-a', Tue: null,     Wed: 'legs-a', Thu: null, Fri: 'pull-a', Sat: null,     Sun: null },
  },
})

// ── Pure helpers ──────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10) }
function dkey(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`
}

// Epley 1RM: weight × (1 + effectiveReps/30) where effectiveReps = reps + rir
function estimate1RM(weight, reps, rir = 0) {
  return weight * (1 + (reps + rir) / 30)
}
function weightFrom1RM(orm, targetReps, targetRir) {
  return orm / (1 + (targetReps + targetRir) / 30)
}

function getProgramWeek(program, date) {
  if (!program?.startDate) return null
  const start = new Date(program.startDate); start.setHours(0,0,0,0)
  const d = new Date(date); d.setHours(0,0,0,0)
  const diff = Math.floor((d - start) / 86400000)
  if (diff < 0) return null
  const week = Math.floor(diff / 7) + 1
  return week > program.weeksTotal ? null : week
}

function isDeloadWeek(program, weekNum) {
  return program?.deloadWeeks?.includes(weekNum) ?? false
}

function getTargetRir(program, weekNum) {
  if (!program || !weekNum) return null
  if (isDeloadWeek(program, weekNum)) return null
  const idx = (weekNum - 1) % (program.rirSchedule?.length || 4)
  const v = program.rirSchedule?.[idx]
  return v == null ? null : v
}

// JS Sunday=0; convert to Mon=0 index
function dateToDayKey(date) {
  return DAYS[((new Date(date).getDay()) + 6) % 7]
}

function getTodayTemplate(program, templates, date = new Date()) {
  if (!program) return null
  const wn = getProgramWeek(program, date)
  if (!wn) return null
  const tmplId = program.weeklyPlan?.[String(wn)]?.[dateToDayKey(date)]
  return tmplId ? (templates.find(t => t.id === tmplId) ?? null) : null
}

function parseMidReps(range) {
  if (!range) return 10
  const parts = range.split('-').map(s => parseFloat(s)).filter(Boolean)
  return parts.length === 2 ? Math.round((parts[0]+parts[1])/2) : (parts[0] || 10)
}

function getBestSet(sessions, exerciseName) {
  let best = null
  for (const s of sessions.slice(-10)) {
    const ex = (s.exercises || []).find(e => e.name === exerciseName)
    if (!ex) continue
    for (const set of (ex.sets || [])) {
      if (!set.weight || !set.reps) continue
      const orm = estimate1RM(set.weight, set.reps, set.rir ?? 0)
      if (!best || orm > best.orm) best = { ...set, orm, date: s.date }
    }
  }
  return best
}

function suggestWeight(exerciseName, repRange, sessions, targetRir) {
  const best = getBestSet(sessions, exerciseName)
  if (!best) return null
  const tgtReps = parseMidReps(repRange)
  const w = weightFrom1RM(best.orm, tgtReps, targetRir ?? 2)
  return Math.round(w / 2.5) * 2.5
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const S = {
  card: (border = C.border) => ({
    background: C.surface, border: `1px solid ${border}`,
    borderRadius: 10, padding: '12px 14px', marginBottom: 10,
  }),
  btn: (color = C.accent, fill = false) => ({
    background: fill ? color : 'transparent',
    border: `1px solid ${color}`,
    color: fill ? (color === C.warn || color === C.success ? '#000' : '#fff') : color,
    borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, lineHeight: 1.4,
  }),
  input: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
    color: C.text, padding: '6px 10px', fontSize: 13, width: '100%',
    boxSizing: 'border-box',
  },
  label: { fontSize: 11, color: C.muted, marginBottom: 3, display: 'block' },
  row: { display: 'flex', gap: 8, alignItems: 'center' },
  tag: (color) => ({
    background: color + '22', color, borderRadius: 4,
    padding: '1px 6px', fontSize: 11, fontWeight: 700, display: 'inline-block',
  }),
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function RirBadge({ rir }) {
  if (rir == null) return <span style={S.tag(C.deload)}>DELOAD</span>
  const clr = [C.push, C.warn, C.success, C.accent, C.muted][Math.min(rir, 4)]
  return <span style={S.tag(clr)}>RIR {rir}</span>
}

function SectionHeader({ title, right }) {
  return (
    <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{title}</div>
      {right}
    </div>
  )
}

// ── Myo-Rep Tracker ───────────────────────────────────────────────────────────
function MyorepTracker({ exDef, data, onChange }) {
  const [miniInput, setMiniInput] = useState(String(exDef.myoMiniReps || 5))
  const [restSec, setRestSec] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => () => clearInterval(timerRef.current), [])

  const d = data || { activationWeight: '', activationReps: exDef.myoActReps || 15, miniSets: [] }

  function startRest() {
    clearInterval(timerRef.current)
    setRestSec(30)
    timerRef.current = setInterval(() => {
      setRestSec(s => {
        if (s <= 1) { clearInterval(timerRef.current); return 0 }
        return s - 1
      })
    }, 1000)
  }

  function addMini() {
    const reps = parseInt(miniInput) || exDef.myoMiniReps || 5
    onChange({ ...d, miniSets: [...(d.miniSets || []), { reps }] })
    startRest()
  }

  function removeMini(i) {
    const ms = [...(d.miniSets || [])]
    ms.splice(i, 1)
    onChange({ ...d, miniSets: ms })
  }

  const totalReps = (Number(d.activationReps) || 0) + (d.miniSets || []).reduce((s, m) => s + (m.reps || 0), 0)
  const done = (d.miniSets || []).length >= (exDef.myoMiniSets || 3)

  return (
    <div style={{ background: '#1a1200', border: `1px solid ${C.warn}55`, borderRadius: 8, padding: 10, marginTop: 6 }}>
      <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={S.tag(C.warn)}>⚡ MYO-REPS</span>
        <span style={{ fontSize: 11, color: C.muted }}>
          {totalReps} total reps · {(d.miniSets||[]).length}/{exDef.myoMiniSets} mini-sets
        </span>
      </div>

      {/* Activation set */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div>
          <label style={S.label}>Activation Weight (lbs)</label>
          <input type="number" step="2.5" style={S.input} value={d.activationWeight}
            onChange={e => onChange({ ...d, activationWeight: e.target.value })} />
        </div>
        <div>
          <label style={S.label}>Activation Reps (target {exDef.myoActReps})</label>
          <input type="number" style={S.input} value={d.activationReps}
            onChange={e => onChange({ ...d, activationReps: Number(e.target.value) })} />
        </div>
      </div>

      {/* Mini-sets log */}
      {(d.miniSets||[]).length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={S.label}>Mini-Sets (target {exDef.myoMiniReps} reps each)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(d.miniSets||[]).map((ms, i) => (
              <div key={i} style={{ ...S.row, background: '#1e293b', borderRadius: 4, padding: '3px 8px', gap: 4 }}>
                <span style={{ fontSize: 13, color: ms.reps >= (exDef.myoMiniReps||5) ? C.success : C.warn, fontWeight: 700 }}>
                  {ms.reps}
                </span>
                <button onClick={() => removeMini(i)}
                  style={{ background:'none', border:'none', color: C.push, cursor:'pointer', padding: 0, fontSize: 11 }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add mini-set / rest timer */}
      {!done ? (
        <div style={S.row}>
          {restSec > 0 ? (
            <div style={{ ...S.tag(C.deload), fontSize: 14, padding: '6px 14px' }}>⏱ Rest: {restSec}s</div>
          ) : (
            <>
              <input type="number" style={{ ...S.input, width: 70 }} value={miniInput}
                onChange={e => setMiniInput(e.target.value)} min={1} max={20} />
              <button onClick={addMini} style={S.btn(C.warn, true)}>+ Mini-Set</button>
              <button onClick={startRest} style={S.btn(C.deload)}>Rest 30s</button>
            </>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.success, fontWeight: 700 }}>
          ✓ All {exDef.myoMiniSets} mini-sets complete! ({totalReps} total reps)
        </div>
      )}
    </div>
  )
}

// ── Session Logger ────────────────────────────────────────────────────────────
function SessionLogger({ template, targetRir, isDeload, deloadFactor, sessions, onSave, onCancel }) {
  const effSets = n => isDeload ? Math.max(1, Math.round(n * (deloadFactor || 0.6))) : n

  const [logData, setLogData] = useState(() => ({
    exercises: template.exercises.map(ex => ({
      name: ex.name, category: ex.category, isMyorep: ex.isMyorep, exDef: ex,
      sets: Array.from({ length: effSets(ex.sets) }, () => ({
        weight: '', reps: '', rir: String(targetRir ?? 2),
      })),
      myorepData: ex.isMyorep ? { activationWeight: '', activationReps: ex.myoActReps, miniSets: [] } : null,
    })),
    notes: '',
  }))

  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 60000)
    return () => clearInterval(t)
  }, [])

  function updSet(ei, si, field, val) {
    setLogData(d => {
      const exs = d.exercises.map((ex, i) => {
        if (i !== ei) return ex
        const sets = ex.sets.map((s, j) => j !== si ? s : { ...s, [field]: val })
        return { ...ex, sets }
      })
      return { ...d, exercises: exs }
    })
  }

  function addSet(ei) {
    setLogData(d => {
      const exs = d.exercises.map((ex, i) => {
        if (i !== ei) return ex
        const prev = ex.sets.slice(-1)[0] || {}
        return { ...ex, sets: [...ex.sets, { weight: prev.weight||'', reps: prev.reps||'', rir: String(targetRir??2) }] }
      })
      return { ...d, exercises: exs }
    })
  }

  function removeSet(ei) {
    setLogData(d => {
      const exs = d.exercises.map((ex, i) => {
        if (i !== ei || ex.sets.length <= 1) return ex
        return { ...ex, sets: ex.sets.slice(0, -1) }
      })
      return { ...d, exercises: exs }
    })
  }

  function updMyo(ei, data) {
    setLogData(d => ({
      ...d,
      exercises: d.exercises.map((ex, i) => i !== ei ? ex : { ...ex, myorepData: data })
    }))
  }

  function save() {
    const session = {
      id: uid(), date: dkey(new Date()),
      templateId: template.id, templateName: template.name,
      targetRir: targetRir ?? null, isDeload, duration: elapsed || 1,
      exercises: logData.exercises.map(ex => ({
        name: ex.name, category: ex.category, isMyorep: ex.isMyorep,
        sets: ex.sets
          .filter(s => s.weight !== '' && s.reps !== '')
          .map(s => ({ weight: Number(s.weight), reps: Number(s.reps), rir: Number(s.rir ?? targetRir ?? 2) })),
        myorepData: ex.myorepData,
      })),
      notes: logData.notes,
    }
    onSave(session)
  }

  const elapsedStr = elapsed > 0 ? `${elapsed}m` : '<1m'

  return (
    <div>
      {/* Session header */}
      <div style={{ ...S.card(C.accent + '44'), marginBottom: 12 }}>
        <div style={{ ...S.row, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{template.name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>⏱ {elapsedStr} elapsed</div>
          </div>
          <div style={S.row}>
            {isDeload && <span style={S.tag(C.deload)}>DELOAD</span>}
            {targetRir != null && <RirBadge rir={targetRir} />}
          </div>
        </div>
      </div>

      {logData.exercises.map((ex, ei) => {
        const catColor = CAT_COLORS[ex.category] || C.muted
        const suggested = suggestWeight(ex.name, ex.exDef?.repRange, sessions, targetRir)
        return (
          <div key={ex.name} style={{ ...S.card(catColor + '44'), marginBottom: 10 }}>
            <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={S.row}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{ex.name}</span>
                <span style={S.tag(catColor)}>{ex.category}</span>
                {ex.isMyorep && <span style={S.tag(C.warn)}>⚡ Myo</span>}
              </div>
              {suggested != null && (
                <div style={{ fontSize: 11, color: C.deload }}>
                  Suggest: <b>{suggested} lbs</b>
                  <div style={{ fontSize: 10, color: C.muted }}>@ {ex.exDef?.repRange} · RIR {targetRir ?? '?'}</div>
                </div>
              )}
            </div>

            {!ex.isMyorep && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'28px 1fr 1fr 1fr', gap:4, marginBottom:4 }}>
                  <span style={S.label}>#</span>
                  <span style={S.label}>Weight (lbs)</span>
                  <span style={S.label}>Reps</span>
                  <span style={S.label}>RIR</span>
                </div>
                {ex.sets.map((set, si) => (
                  <div key={si} style={{ display:'grid', gridTemplateColumns:'28px 1fr 1fr 1fr', gap:4, marginBottom:4, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:C.muted, textAlign:'center' }}>{si+1}</span>
                    <input type="number" step="2.5" style={S.input}
                      value={set.weight} placeholder={suggested != null ? String(suggested) : ''}
                      onChange={e => updSet(ei, si, 'weight', e.target.value)} />
                    <input type="number" style={S.input}
                      value={set.reps} placeholder={ex.exDef?.repRange || '10'}
                      onChange={e => updSet(ei, si, 'reps', e.target.value)} />
                    <select style={S.input} value={set.rir}
                      onChange={e => updSet(ei, si, 'rir', e.target.value)}>
                      {[0,1,2,3,4,5].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ ...S.row, marginTop:4 }}>
                  <button onClick={() => addSet(ei)} style={{ ...S.btn(C.muted), fontSize:11, padding:'2px 8px' }}>+ Set</button>
                  {ex.sets.length > 1 &&
                    <button onClick={() => removeSet(ei)} style={{ ...S.btn(C.push), fontSize:11, padding:'2px 8px' }}>− Set</button>}
                </div>
              </>
            )}

            {ex.isMyorep && (
              <MyorepTracker exDef={ex.exDef} data={ex.myorepData} onChange={d => updMyo(ei, d)} />
            )}
          </div>
        )
      })}

      <div style={{ ...S.card(), marginBottom: 12 }}>
        <label style={S.label}>Session Notes</label>
        <textarea style={{ ...S.input, minHeight:60, resize:'vertical' }}
          value={logData.notes} placeholder="Energy, PRs, form notes…"
          onChange={e => setLogData(d => ({ ...d, notes: e.target.value }))} />
      </div>

      <div style={S.row}>
        <button onClick={save} style={{ ...S.btn(C.success, true), flex:1, padding:'10px 0', fontSize:14 }}>
          ✓ Complete Workout
        </button>
        <button onClick={onCancel} style={S.btn()}>Cancel</button>
      </div>
    </div>
  )
}

// ── Today View ────────────────────────────────────────────────────────────────
function TodayView({ program, templates, sessions, onSessionSave }) {
  const today = new Date()
  const [logging, setLogging] = useState(false)
  const [manualId, setManualId] = useState(null)

  const weekNum = program ? getProgramWeek(program, today) : null
  const isDeload = weekNum ? isDeloadWeek(program, weekNum) : false
  const targetRir = weekNum ? getTargetRir(program, weekNum) : null
  const deloadFactor = program?.deloadVolumeFactor ?? 0.6

  const scheduledTmpl = program ? getTodayTemplate(program, templates, today) : null
  const activeTmpl = manualId ? templates.find(t => t.id === manualId) : scheduledTmpl

  const todaySessions = sessions.filter(s => s.date === dkey(today))

  if (logging && activeTmpl) {
    return (
      <SessionLogger
        template={activeTmpl} targetRir={targetRir}
        isDeload={isDeload} deloadFactor={deloadFactor}
        sessions={sessions}
        onSave={s => { onSessionSave(s); setLogging(false); setManualId(null) }}
        onCancel={() => setLogging(false)}
      />
    )
  }

  return (
    <div>
      {/* Date + week status */}
      <div style={{ ...S.card(C.accent + '33'), marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>
          {today.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })}
        </div>
        {weekNum ? (
          <div style={S.row}>
            <span style={{ fontSize: 12, color: C.muted }}>{program.name} · Week {weekNum}/{program.weeksTotal}</span>
            {isDeload ? <span style={S.tag(C.deload)}>DELOAD</span> : <RirBadge rir={targetRir} />}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.muted }}>
            {program ? 'Outside program date range' : 'No active program — set one up in Program tab'}
          </div>
        )}
      </div>

      {/* Scheduled workout card */}
      {scheduledTmpl ? (
        <div style={S.card()}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>📅 Scheduled</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{scheduledTmpl.name}</div>
          {scheduledTmpl.exercises.map(ex => {
            const sets = isDeload ? Math.max(1, Math.round(ex.sets * deloadFactor)) : ex.sets
            const sug = suggestWeight(ex.name, ex.repRange, sessions, targetRir)
            return (
              <div key={ex.id} style={{ ...S.row, padding:'5px 0', borderBottom:`1px solid ${C.border}`, gap:8 }}>
                <span style={{ ...S.tag(CAT_COLORS[ex.category]||C.muted), minWidth:44, textAlign:'center' }}>{ex.category}</span>
                <span style={{ flex:1, fontSize:13 }}>
                  {ex.name} {ex.isMyorep && <span style={S.tag(C.warn)}>⚡</span>}
                </span>
                <span style={{ fontSize:11, color:C.muted }}>{sets}×{ex.repRange}</span>
                {sug != null && <span style={{ fontSize:11, color:C.deload, fontWeight:700 }}>{sug}lb</span>}
              </div>
            )
          })}
          <button onClick={() => { setManualId(null); setLogging(true) }}
            style={{ ...S.btn(C.success, true), width:'100%', padding:10, fontSize:14, marginTop:12 }}>
            🏋 Start Workout
          </button>
        </div>
      ) : (
        <div style={{ ...S.card(), textAlign:'center', padding:24 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>😴</div>
          <div style={{ color:C.muted }}>Rest day — nothing scheduled</div>
        </div>
      )}

      {/* Manual template picker */}
      {templates.length > 0 && (
        <div style={S.card()}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Log a different workout:</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {templates.map(t => (
              <button key={t.id} onClick={() => { setManualId(t.id); setLogging(true) }}
                style={S.btn(t.categories[0] ? CAT_COLORS[t.categories[0]] : C.muted)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Today's logged sessions */}
      {todaySessions.length > 0 && (
        <div>
          <div style={{ fontWeight:600, fontSize:13, color:C.muted, marginBottom:8 }}>Logged today</div>
          {todaySessions.map(s => (
            <div key={s.id} style={S.card()}>
              <div style={{ ...S.row, justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontWeight:700 }}>{s.templateName}</div>
                  <div style={{ fontSize:11, color:C.muted }}>
                    {s.exercises.length} exercises · {s.exercises.reduce((t,e) => t+(e.sets?.length||0), 0)} sets · {s.duration}m
                  </div>
                </div>
                <div style={S.row}>
                  {s.isDeload && <span style={S.tag(C.deload)}>DL</span>}
                  {s.targetRir != null && <RirBadge rir={s.targetRir} />}
                </div>
              </div>
              {s.notes && <div style={{ fontSize:12, color:C.text, marginTop:6, fontStyle:'italic' }}>{s.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Program View ──────────────────────────────────────────────────────────────
function ProgramView({ program, setProgram, templates }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)

  const today = new Date()
  const currentWeek = program ? getProgramWeek(program, today) : null

  function startEdit(base) {
    setForm(JSON.parse(JSON.stringify(base)))
    setEditing(true)
  }

  function setWeekRir(wi, val) {
    setForm(f => {
      const s = [...(f.rirSchedule||[])]
      while (s.length <= wi) s.push(2)
      s[wi] = val === '' || val == null ? null : Number(val)
      return { ...f, rirSchedule: s }
    })
  }

  function toggleDeload(wn) {
    setForm(f => {
      const dw = [...(f.deloadWeeks||[])]
      const i = dw.indexOf(wn)
      if (i >= 0) dw.splice(i,1); else dw.push(wn)
      return { ...f, deloadWeeks: dw }
    })
  }

  function setDayTmpl(wn, day, id) {
    setForm(f => ({
      ...f,
      weeklyPlan: {
        ...f.weeklyPlan,
        [String(wn)]: { ...(f.weeklyPlan?.[String(wn)]||{}), [day]: id || null }
      }
    }))
  }

  if (editing && form) {
    return (
      <div>
        <div style={{ ...S.row, justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontWeight:700, fontSize:15, color:C.accent }}>Edit Program</div>
          <div style={S.row}>
            <button onClick={() => { setProgram(form); setEditing(false) }}
              style={S.btn(C.success, true)}>Save</button>
            <button onClick={() => setEditing(false)} style={S.btn()}>Cancel</button>
          </div>
        </div>

        {/* Name & dates */}
        <div style={S.card()}>
          <div style={{ marginBottom:8 }}>
            <label style={S.label}>Program Name</label>
            <input style={S.input} value={form.name}
              onChange={e => setForm(f => ({...f, name:e.target.value}))} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <label style={S.label}>Start Date</label>
              <input type="date" style={S.input} value={form.startDate}
                onChange={e => setForm(f => ({...f, startDate:e.target.value}))} />
            </div>
            <div>
              <label style={S.label}>Total Weeks</label>
              <input type="number" style={S.input} value={form.weeksTotal} min={1} max={20}
                onChange={e => setForm(f => ({...f, weeksTotal:Number(e.target.value)}))} />
            </div>
          </div>
        </div>

        {/* RIR schedule */}
        <div style={S.card()}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>RIR Schedule + Deload Weeks</div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>
            Lower RIR = harder effort. Deload weeks auto-reduce volume by the factor below.
          </div>
          {Array.from({length: form.weeksTotal}, (_,wi) => {
            const wn = wi+1
            const isDeload = (form.deloadWeeks||[]).includes(wn)
            const rir = form.rirSchedule?.[wi]
            return (
              <div key={wn} style={{ ...S.row, marginBottom:6, background:'#1a2235', borderRadius:6, padding:'6px 10px' }}>
                <div style={{ width:56, fontWeight:700, fontSize:12, color: isDeload ? C.deload : C.text }}>
                  Wk {wn}
                </div>
                <div style={{ flex:1 }}>
                  {isDeload ? (
                    <span style={S.tag(C.deload)}>DELOAD — reduced volume</span>
                  ) : (
                    <div style={S.row}>
                      <span style={{ fontSize:11, color:C.muted }}>RIR:</span>
                      {[0,1,2,3,4].map(r => (
                        <button key={r} onClick={() => setWeekRir(wi, r)}
                          style={{ ...S.btn(r===rir ? C.accent : C.muted+'88', r===rir), padding:'2px 7px', fontSize:12 }}>
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => toggleDeload(wn)}
                  style={{ ...S.btn(isDeload ? C.deload : C.muted, isDeload), fontSize:11, padding:'2px 7px' }}>
                  {isDeload ? '✓ Deload' : 'Deload'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Deload volume factor */}
        <div style={S.card()}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Deload Settings</div>
          <div style={S.row}>
            <span style={{ fontSize:12, color:C.muted }}>Volume factor on deload weeks:</span>
            <input type="number" step="0.05" min={0.3} max={0.9} style={{ ...S.input, width:70 }}
              value={form.deloadVolumeFactor ?? 0.6}
              onChange={e => setForm(f => ({...f, deloadVolumeFactor:Number(e.target.value)}))} />
            <span style={{ fontSize:11, color:C.muted }}>
              ({Math.round((form.deloadVolumeFactor??0.6)*100)}% of normal sets)
            </span>
          </div>
        </div>

        {/* Weekly day plan */}
        <div style={S.card()}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Weekly Day Plan</div>
          {Array.from({length: form.weeksTotal}, (_,wi) => {
            const wn = wi+1
            const isDeload = (form.deloadWeeks||[]).includes(wn)
            const rir = isDeload ? null : (form.rirSchedule?.[wi] ?? '?')
            return (
              <div key={wn} style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color: isDeload ? C.deload : C.text, marginBottom:4 }}>
                  Week {wn} {isDeload ? '— DELOAD' : `— Target RIR ${rir}`}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                  {DAYS.map(day => (
                    <div key={day}>
                      <div style={{ fontSize:9, color:C.muted, textAlign:'center', marginBottom:2 }}>{day}</div>
                      <select
                        value={form.weeklyPlan?.[String(wn)]?.[day] || ''}
                        onChange={e => setDayTmpl(wn, day, e.target.value)}
                        style={{ ...S.input, padding:'3px 2px', fontSize:9, textAlign:'center' }}>
                        <option value="">—</option>
                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Overview mode ──
  if (!program) {
    return (
      <div style={{ textAlign:'center', padding:40 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🗓️</div>
        <div style={{ color:C.muted, marginBottom:16 }}>No training program yet.</div>
        <button onClick={() => startEdit(makeDefaultProgram())} style={S.btn(C.accent, true)}>
          Create Program
        </button>
      </div>
    )
  }

  const progress = currentWeek != null ? Math.min(1, currentWeek / program.weeksTotal) : 0

  return (
    <div>
      {/* Active program banner */}
      <div style={{ ...S.card(C.accent + '44'), marginBottom:12 }}>
        <div style={{ ...S.row, justifyContent:'space-between', marginBottom:8 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:C.accent }}>{program.name}</div>
            <div style={{ fontSize:11, color:C.muted }}>
              Started {program.startDate} · {program.weeksTotal} weeks
            </div>
          </div>
          <button onClick={() => startEdit(program)} style={S.btn()}>Edit</button>
        </div>
        <div style={{ background:'#1e293b', borderRadius:4, height:6, marginBottom:6 }}>
          <div style={{ background:C.accent, borderRadius:4, height:6, width:`${progress*100}%`, transition:'width .3s' }} />
        </div>
        <div style={{ fontSize:12, color:C.muted }}>
          {currentWeek ? (
            <>
              Week {currentWeek} of {program.weeksTotal}
              {isDeloadWeek(program, currentWeek)
                ? <span style={{ color:C.deload, marginLeft:8 }}>— DELOAD WEEK</span>
                : <span style={{ marginLeft:8 }}>— Target <RirBadge rir={getTargetRir(program,currentWeek)} /></span>}
            </>
          ) : 'No active week for today'}
        </div>
      </div>

      {/* Week grid */}
      <div style={S.card()}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Program Overview</div>
        {Array.from({length: program.weeksTotal}, (_,wi) => {
          const wn = wi+1
          const isDeload = isDeloadWeek(program, wn)
          const rir = getTargetRir(program, wn)
          const isActive = wn === currentWeek
          const isPast = currentWeek != null && wn < currentWeek
          const dayNames = DAYS
            .filter(d => program.weeklyPlan?.[String(wn)]?.[d])
            .map(d => {
              const id = program.weeklyPlan[String(wn)][d]
              return templates.find(t => t.id === id)?.name || d
            })
          return (
            <div key={wn} style={{
              ...S.row, marginBottom:5, padding:'7px 10px', borderRadius:8,
              background: isActive ? '#0e2a3a' : isPast ? '#0a1a0a' : '#131e2e',
              border:`1px solid ${isActive ? C.accent : isPast ? '#22c55e44' : C.border}`,
            }}>
              <div style={{ width:52, fontWeight:700, fontSize:12, color: isActive ? C.accent : isPast ? C.success : C.muted }}>
                {isPast ? '✓' : isActive ? '▶' : ' '} Wk {wn}
              </div>
              <div style={{ width:70 }}>
                {isDeload ? <span style={S.tag(C.deload)}>DELOAD</span> : <RirBadge rir={rir} />}
              </div>
              <div style={{ flex:1, fontSize:10, color:C.muted }}>
                {dayNames.join(' · ') || 'Rest'}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ textAlign:'center', marginTop:8 }}>
        <button onClick={() => startEdit(makeDefaultProgram())} style={S.btn(C.muted)}>
          New Program
        </button>
      </div>
    </div>
  )
}

// ── Templates View ────────────────────────────────────────────────────────────
function TemplatesView({ templates, setTemplates }) {
  const [selectedId, setSelectedId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCats, setNewCats] = useState([])
  const [addExForm, setAddExForm] = useState(null)

  const tmpl = templates.find(t => t.id === selectedId)

  function createTemplate() {
    if (!newName.trim()) return
    const t = { id: uid(), name: newName.trim(), categories: newCats, exercises: [] }
    setTemplates(ts => [...ts, t])
    setSelectedId(t.id)
    setShowCreate(false)
    setNewName('')
    setNewCats([])
  }

  function updExercise(exId, patch) {
    setTemplates(ts => ts.map(t => t.id !== selectedId ? t : {
      ...t, exercises: t.exercises.map(e => e.id !== exId ? e : { ...e, ...patch })
    }))
  }

  function removeExercise(exId) {
    setTemplates(ts => ts.map(t => t.id !== selectedId ? t : {
      ...t, exercises: t.exercises.filter(e => e.id !== exId)
    }))
  }

  function addExercise() {
    if (!addExForm?.name?.trim()) return
    const ex = {
      id: uid(), name: addExForm.name.trim(),
      category: addExForm.category || 'other',
      sets: Number(addExForm.sets) || 3,
      repRange: addExForm.repRange || '8-12',
      isMyorep: !!addExForm.isMyorep,
      myoActReps:  Number(addExForm.myoActReps)  || 15,
      myoMiniReps: Number(addExForm.myoMiniReps) || 5,
      myoMiniSets: Number(addExForm.myoMiniSets) || 3,
      notes: addExForm.notes || '',
    }
    setTemplates(ts => ts.map(t => t.id !== selectedId ? t : { ...t, exercises: [...t.exercises, ex] }))
    setAddExForm(null)
  }

  function moveEx(exId, dir) {
    setTemplates(ts => ts.map(t => {
      if (t.id !== selectedId) return t
      const exs = [...t.exercises]
      const i = exs.findIndex(e => e.id === exId)
      const j = i + dir
      if (j < 0 || j >= exs.length) return t
      ;[exs[i], exs[j]] = [exs[j], exs[i]]
      return { ...t, exercises: exs }
    }))
  }

  // — List view —
  if (!selectedId) {
    return (
      <div>
        <SectionHeader title="Day Templates"
          right={<button onClick={() => setShowCreate(true)} style={S.btn(C.accent, true)}>+ Template</button>} />

        {showCreate && (
          <div style={{ ...S.card(C.accent), marginBottom:12 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>New Template</div>
            <input style={{ ...S.input, marginBottom:8 }} placeholder="Name (e.g. Push A, Upper Body…)"
              value={newName} onChange={e => setNewName(e.target.value)} />
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Categories (optional):</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
              {CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setNewCats(cs => cs.includes(c.id) ? cs.filter(x=>x!==c.id) : [...cs,c.id])}
                  style={S.btn(CAT_COLORS[c.id], newCats.includes(c.id))}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            <div style={S.row}>
              <button onClick={createTemplate} style={S.btn(C.success, true)}>Create</button>
              <button onClick={() => setShowCreate(false)} style={S.btn()}>Cancel</button>
            </div>
          </div>
        )}

        {templates.length === 0 && !showCreate && (
          <div style={{ textAlign:'center', padding:30, color:C.muted }}>
            No templates yet. Create your first one!
          </div>
        )}

        {templates.map(t => (
          <div key={t.id} style={{ ...S.card(), cursor:'pointer' }} onClick={() => setSelectedId(t.id)}>
            <div style={{ ...S.row, justifyContent:'space-between' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{t.name}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                  {t.exercises.length} exercises
                  {t.categories.map(c => (
                    <span key={c} style={{ ...S.tag(CAT_COLORS[c]||C.muted), marginLeft:4 }}>{c}</span>
                  ))}
                  {t.exercises.filter(e=>e.isMyorep).length > 0 &&
                    <span style={{ ...S.tag(C.warn), marginLeft:4 }}>
                      ⚡ {t.exercises.filter(e=>e.isMyorep).length} myo
                    </span>}
                </div>
              </div>
              <div style={S.row}>
                <button onClick={e => { e.stopPropagation(); setTemplates(ts => ts.filter(x=>x.id!==t.id)) }}
                  style={{ ...S.btn(C.push), padding:'2px 7px', fontSize:11 }}>✕</button>
                <span style={{ color:C.muted, fontSize:18 }}>›</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // — Edit single template —
  if (!tmpl) { setSelectedId(null); return null }

  return (
    <div>
      <div style={{ ...S.row, justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={() => setSelectedId(null)} style={S.btn()}>← Back</button>
        <div style={{ fontWeight:700, fontSize:15 }}>{tmpl.name}</div>
        <div style={{ width:60 }} />
      </div>

      {/* Name edit */}
      <div style={{ ...S.card(), marginBottom:10 }}>
        <label style={S.label}>Template Name</label>
        <input style={S.input} value={tmpl.name}
          onChange={e => setTemplates(ts => ts.map(t => t.id !== selectedId ? t : { ...t, name:e.target.value }))} />
      </div>

      {/* Exercise list */}
      {tmpl.exercises.map((ex, idx) => {
        const catColor = CAT_COLORS[ex.category] || C.muted
        return (
          <div key={ex.id} style={{ ...S.card(catColor+'55'), marginBottom:10 }}>
            <div style={{ ...S.row, justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ fontWeight:700, fontSize:13 }}>{ex.name}</div>
              <div style={S.row}>
                <button onClick={() => moveEx(ex.id,-1)} disabled={idx===0}
                  style={{ ...S.btn(C.muted), padding:'1px 6px', opacity: idx===0?.4:1 }}>↑</button>
                <button onClick={() => moveEx(ex.id,1)} disabled={idx===tmpl.exercises.length-1}
                  style={{ ...S.btn(C.muted), padding:'1px 6px', opacity: idx===tmpl.exercises.length-1?.4:1 }}>↓</button>
                <button onClick={() => removeExercise(ex.id)} style={{ ...S.btn(C.push), padding:'1px 6px' }}>✕</button>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:8 }}>
              <div>
                <label style={S.label}>Sets</label>
                <input type="number" style={S.input} value={ex.sets} min={1} max={20}
                  onChange={e => updExercise(ex.id, { sets: Number(e.target.value) })} />
              </div>
              <div>
                <label style={S.label}>Rep Range</label>
                <input style={S.input} value={ex.repRange} placeholder="8-12"
                  onChange={e => updExercise(ex.id, { repRange: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Category</label>
                <select style={S.input} value={ex.category}
                  onChange={e => updExercise(ex.id, { category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>

            {/* Myo-rep toggle */}
            <button onClick={() => updExercise(ex.id, { isMyorep: !ex.isMyorep })}
              style={{ ...S.btn(ex.isMyorep ? C.warn : C.muted, ex.isMyorep), marginBottom: ex.isMyorep ? 8 : 0 }}>
              ⚡ {ex.isMyorep ? 'Myo-Reps ON' : 'Myo-Reps'}
            </button>

            {ex.isMyorep && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                <div>
                  <label style={S.label}>Activation Reps</label>
                  <input type="number" style={S.input} value={ex.myoActReps} min={5} max={30}
                    onChange={e => updExercise(ex.id, { myoActReps: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={S.label}>Mini-Set Reps</label>
                  <input type="number" style={S.input} value={ex.myoMiniReps} min={2} max={10}
                    onChange={e => updExercise(ex.id, { myoMiniReps: Number(e.target.value) })} />
                </div>
                <div>
                  <label style={S.label}>Target Mini-Sets</label>
                  <input type="number" style={S.input} value={ex.myoMiniSets} min={1} max={10}
                    onChange={e => updExercise(ex.id, { myoMiniSets: Number(e.target.value) })} />
                </div>
              </div>
            )}

            {ex.notes && <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>{ex.notes}</div>}
          </div>
        )
      })}

      {/* Add exercise */}
      {addExForm ? (
        <div style={{ ...S.card(C.success+'44') }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Add Exercise</div>

          <div style={{ marginBottom:8 }}>
            <label style={S.label}>Category</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {CATEGORIES.map(c => (
                <button key={c.id}
                  onClick={() => setAddExForm(f => ({ ...f, category:c.id, name:'' }))}
                  style={S.btn(CAT_COLORS[c.id], addExForm.category===c.id)}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom:8 }}>
            <label style={S.label}>Exercise</label>
            <select style={{ ...S.input, marginBottom:4 }} value=""
              onChange={e => setAddExForm(f => ({ ...f, name:e.target.value }))}>
              <option value="">— pick preset —</option>
              {(PRESET_EXERCISES[addExForm.category||'other']||[]).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <input style={S.input} placeholder="Or type custom name…"
              value={addExForm.name} onChange={e => setAddExForm(f => ({ ...f, name:e.target.value }))} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
            <div>
              <label style={S.label}>Sets</label>
              <input type="number" style={S.input} value={addExForm.sets||3} min={1} max={20}
                onChange={e => setAddExForm(f => ({ ...f, sets:e.target.value }))} />
            </div>
            <div>
              <label style={S.label}>Rep Range</label>
              <input style={S.input} placeholder="8-12" value={addExForm.repRange||''}
                onChange={e => setAddExForm(f => ({ ...f, repRange:e.target.value }))} />
            </div>
          </div>

          <div style={{ marginBottom: addExForm.isMyorep ? 8 : 12 }}>
            <button onClick={() => setAddExForm(f => ({ ...f, isMyorep:!f.isMyorep }))}
              style={S.btn(addExForm.isMyorep ? C.warn : C.muted, addExForm.isMyorep)}>
              ⚡ {addExForm.isMyorep ? 'Myo-Reps ON' : 'Myo-Reps'}
            </button>
          </div>

          {addExForm.isMyorep && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:12 }}>
              <div>
                <label style={S.label}>Activation</label>
                <input type="number" style={S.input} value={addExForm.myoActReps||15}
                  onChange={e => setAddExForm(f => ({ ...f, myoActReps:e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Mini Reps</label>
                <input type="number" style={S.input} value={addExForm.myoMiniReps||5}
                  onChange={e => setAddExForm(f => ({ ...f, myoMiniReps:e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Mini Sets</label>
                <input type="number" style={S.input} value={addExForm.myoMiniSets||3}
                  onChange={e => setAddExForm(f => ({ ...f, myoMiniSets:e.target.value }))} />
              </div>
            </div>
          )}

          <div style={S.row}>
            <button onClick={addExercise} style={S.btn(C.success, true)}>Add</button>
            <button onClick={() => setAddExForm(null)} style={S.btn()}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddExForm({ category:'push', name:'', sets:3, repRange:'8-12', isMyorep:false, myoActReps:15, myoMiniReps:5, myoMiniSets:3, notes:'' })}
          style={{ ...S.btn(C.accent, true), width:'100%', padding:'10px 0', fontSize:13 }}>
          + Add Exercise
        </button>
      )}
    </div>
  )
}

// ── History View ──────────────────────────────────────────────────────────────
function HistoryView({ sessions, onDelete }) {
  const [selectedId, setSelectedId] = useState(null)
  const [showPRs, setShowPRs] = useState(false)

  // Build PR map (best estimated 1RM per exercise)
  const prMap = {}
  for (const s of sessions) {
    for (const ex of (s.exercises||[])) {
      for (const set of (ex.sets||[])) {
        if (!set.weight || !set.reps) continue
        const orm = estimate1RM(set.weight, set.reps, set.rir??0)
        if (!prMap[ex.name] || orm > prMap[ex.name].orm) {
          prMap[ex.name] = { orm, weight:set.weight, reps:set.reps, rir:set.rir??0, date:s.date, cat:ex.category }
        }
      }
    }
  }

  const sorted = [...sessions].sort((a,b) => b.date.localeCompare(a.date))
  const sel = selectedId ? sessions.find(s=>s.id===selectedId) : null

  if (sel) {
    return (
      <div>
        <div style={{ ...S.row, justifyContent:'space-between', marginBottom:12 }}>
          <button onClick={() => setSelectedId(null)} style={S.btn()}>← Back</button>
          <button onClick={() => { onDelete(sel.id); setSelectedId(null) }}
            style={S.btn(C.push)}>Delete</button>
        </div>
        <div style={{ ...S.card(C.accent+'33'), marginBottom:10 }}>
          <div style={{ fontWeight:800, fontSize:15 }}>{sel.templateName}</div>
          <div style={{ fontSize:11, color:C.muted }}>{sel.date} · {sel.duration}m</div>
          <div style={{ ...S.row, marginTop:4 }}>
            {sel.isDeload && <span style={S.tag(C.deload)}>DELOAD</span>}
            {sel.targetRir != null && <RirBadge rir={sel.targetRir} />}
          </div>
        </div>
        {(sel.exercises||[]).map((ex,i) => {
          const catColor = CAT_COLORS[ex.category] || C.muted
          const topSet = ex.sets?.reduce((b,s) => {
            if (!s.weight||!s.reps) return b
            const o = estimate1RM(s.weight,s.reps,s.rir??0)
            return (!b || o>b.orm) ? {...s,orm:o} : b
          }, null)
          return (
            <div key={i} style={S.card(catColor+'33')}>
              <div style={{ ...S.row, marginBottom:6, justifyContent:'space-between' }}>
                <div style={{ fontWeight:700 }}>
                  {ex.name} {ex.isMyorep && <span style={S.tag(C.warn)}>⚡ Myo</span>}
                </div>
                {topSet && (
                  <span style={{ fontSize:11, color:C.warn }}>
                    Top e1RM: {Math.round(topSet.orm)}lb
                  </span>
                )}
              </div>
              {!ex.isMyorep && (ex.sets||[]).map((s,si) => (
                <div key={si} style={{ ...S.row, fontSize:12, marginBottom:2 }}>
                  <span style={{ color:C.muted, width:20 }}>{si+1}.</span>
                  <span style={{ fontWeight:700, color:catColor }}>{s.weight}lb</span>
                  <span style={{ color:C.muted }}>× {s.reps} reps</span>
                  <span style={S.tag(C.accent)}>RIR {s.rir}</span>
                  <span style={{ fontSize:10, color:C.muted }}>
                    e1RM {Math.round(estimate1RM(s.weight,s.reps,s.rir??0))}lb
                  </span>
                </div>
              ))}
              {ex.isMyorep && ex.myorepData && (
                <div style={{ fontSize:12 }}>
                  <div>Activation: <b>{ex.myorepData.activationWeight}lb × {ex.myorepData.activationReps}</b></div>
                  {(ex.myorepData.miniSets||[]).length > 0 && (
                    <div style={{ color:C.muted, marginTop:2 }}>
                      Mini-sets: {ex.myorepData.miniSets.map(m=>m.reps).join(' | ')} reps
                      ({ex.myorepData.miniSets.reduce((s,m)=>s+(m.reps||0),0)} total)
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {sel.notes && (
          <div style={S.card()}>
            <div style={{ fontSize:12, fontStyle:'italic', color:C.text }}>{sel.notes}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ ...S.row, justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontWeight:700, fontSize:15 }}>History</div>
        <button onClick={() => setShowPRs(v=>!v)} style={S.btn(showPRs ? C.warn : C.muted, showPRs)}>
          🏆 PRs
        </button>
      </div>

      {showPRs && (
        <div style={{ ...S.card(), marginBottom:12 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Personal Records (est. 1RM)</div>
          {Object.keys(prMap).length === 0 && (
            <div style={{ fontSize:12, color:C.muted }}>No PRs logged yet.</div>
          )}
          {Object.entries(prMap)
            .sort((a,b) => a[0].localeCompare(b[0]))
            .map(([name, pr]) => (
              <div key={name} style={{ ...S.row, padding:'5px 0', borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
                <span style={{ ...S.tag(CAT_COLORS[pr.cat]||C.muted), minWidth:38 }}>{pr.cat}</span>
                <span style={{ flex:1, fontWeight:600 }}>{name}</span>
                <span style={{ color:C.warn, fontWeight:700 }}>{pr.weight}lb × {pr.reps}</span>
                <span style={{ ...S.tag(C.accent), marginLeft:4 }}>e1RM {Math.round(pr.orm)}lb</span>
                <span style={{ fontSize:10, color:C.muted, marginLeft:4 }}>{pr.date}</span>
              </div>
            ))}
        </div>
      )}

      {sorted.length === 0 && (
        <div style={{ textAlign:'center', padding:40, color:C.muted }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📋</div>
          No workouts logged yet.
        </div>
      )}

      {sorted.map(s => (
        <div key={s.id} style={{ ...S.card(), cursor:'pointer' }} onClick={() => setSelectedId(s.id)}>
          <div style={{ ...S.row, justifyContent:'space-between' }}>
            <div>
              <div style={{ fontWeight:700 }}>{s.templateName}</div>
              <div style={{ fontSize:11, color:C.muted }}>
                {s.date} · {s.exercises?.length||0} exercises · {' '}
                {(s.exercises||[]).reduce((t,e)=>t+(e.sets?.length||0),0)} sets · {s.duration}m
              </div>
            </div>
            <div style={S.row}>
              {s.isDeload && <span style={S.tag(C.deload)}>DL</span>}
              {s.targetRir != null && <RirBadge rir={s.targetRir} />}
            </div>
          </div>
          {s.notes && (
            <div style={{ fontSize:11, color:C.muted, marginTop:4, fontStyle:'italic' }}>
              {s.notes.slice(0,80)}{s.notes.length>80?'…':''}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Root: WorkoutPlanner ──────────────────────────────────────────────────────
export default function WorkoutPlanner() {
  const [program,   setProgram]   = usePersist('wk_program',   null)
  const [templates, setTemplates] = usePersist('wk_templates', DEFAULT_TEMPLATES)
  const [sessions,  setSessions]  = usePersist('wk_sessions',  [])
  const [tab, setTab] = useState('today')

  function saveSession(s) { setSessions(ss => [...ss, s]) }
  function deleteSession(id) { setSessions(ss => ss.filter(s => s.id !== id)) }

  const INNER_TABS = [
    ['today',     '🏋', 'Today'],
    ['program',   '📅', 'Program'],
    ['templates', '📋', 'Templates'],
    ['history',   '📈', 'History'],
  ]

  return (
    <div style={{ paddingBottom: 8 }}>
      {/* Inner tab bar */}
      <div style={{ display:'flex', gap:3, marginBottom:14, background:C.surface, borderRadius:10, padding:4 }}>
        {INNER_TABS.map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex:1, background: tab===id ? '#1e293b' : 'transparent',
            border:'none', borderRadius:7,
            color: tab===id ? C.accent : C.muted,
            padding:'7px 2px', fontSize:11, cursor:'pointer',
            fontWeight: tab===id ? 700 : 400,
            display:'flex', flexDirection:'column', alignItems:'center', gap:2,
          }}>
            <span style={{ fontSize:18 }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <TodayView
          program={program} templates={templates}
          sessions={sessions} onSessionSave={saveSession}
        />
      )}
      {tab === 'program' && (
        <ProgramView program={program} setProgram={setProgram} templates={templates} />
      )}
      {tab === 'templates' && (
        <TemplatesView templates={templates} setTemplates={setTemplates} />
      )}
      {tab === 'history' && (
        <HistoryView sessions={sessions} onDelete={deleteSession} />
      )}
    </div>
  )
}
