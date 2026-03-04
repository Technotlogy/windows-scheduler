// WorkoutPlanner.jsx

import { useState, useEffect, useRef } from 'react'
import { usePersist } from './usePersist'

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0f1e', surface: '#0f172a', border: '#1e293b',
  text: '#e2e8f0', muted: '#64748b', accent: '#38bdf8',
  push: '#ef4444', pull: '#3b82f6', legs: '#22c55e',
  core: '#f59e0b', cardio: '#a855f7', other: '#94a3b8',
  deload: '#06b6d4', success: '#4ade80', warn: '#f97316',
}
const CAT_COLORS = { push:C.push, pull:C.pull, legs:C.legs, core:C.core, cardio:C.cardio, other:C.other }

const CATEGORIES = [
  { id:'push',   label:'Push',   emoji:'💪' },
  { id:'pull',   label:'Pull',   emoji:'🏋' },
  { id:'legs',   label:'Legs',   emoji:'🦵' },
  { id:'core',   label:'Core',   emoji:'🎯' },
  { id:'cardio', label:'Cardio', emoji:'🏃' },
  { id:'other',  label:'Other',  emoji:'⚡' },
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

// ── Data model ────────────────────────────────────────────────────────────────
// Exercise.sets is now an array of per-set objects:
//   { plannedWeight: number|null, plannedReps: string, myorep: bool }
// Logged set: { weight, reps, rir, myoreps: number }

function makeSet(reps = 10) {
  return { plannedWeight: null, plannedReps: reps, myorep: null }
}

// Migrate old format (sets: number) → new format (sets: array)
// Also migrates: plannedReps string→number, myorep boolean→null/0
function migrateSets(ex) {
  if (Array.isArray(ex.sets)) return ex.sets.map(s => ({
    ...s,
    plannedReps: typeof s.plannedReps === 'string' ? parseMidReps(s.plannedReps) : (s.plannedReps ?? parseMidReps(ex.repRange)),
    myorep: typeof s.myorep === 'boolean' ? (s.myorep ? 0 : null) : s.myorep,
  }))
  return Array.from({ length: ex.sets || 3 }, () => makeSet(parseMidReps(ex.repRange || '8-12')))
}

function migrateTemplates(templates) {
  return (templates || []).map(t => ({
    ...t,
    exercises: (t.exercises || []).map(ex => ({
      ...ex,
      repRange: typeof ex.repRange === 'string' ? parseMidReps(ex.repRange) : (ex.repRange ?? 10),
      sets: migrateSets(ex),
    }))
  }))
}

const DEFAULT_TEMPLATES = [
  {
    id: 'push-a', name: 'Push A', categories: ['push'],
    exercises: [
      { id:'pa1', name:'Bench Press',      category:'push', repRange:'6-10',  notes:'',
        sets:[{plannedWeight:135,plannedReps:'6-10',myorep:false},{plannedWeight:155,plannedReps:'6-10',myorep:false},{plannedWeight:175,plannedReps:'6-10',myorep:false},{plannedWeight:185,plannedReps:'6-8',myorep:false}] },
      { id:'pa2', name:'Overhead Press',   category:'push', repRange:'8-12',  notes:'',
        sets:[{plannedWeight:null,plannedReps:'8-12',myorep:false},{plannedWeight:null,plannedReps:'8-12',myorep:false},{plannedWeight:null,plannedReps:'8-12',myorep:false}] },
      { id:'pa3', name:'Incline DB Press', category:'push', repRange:'10-15', notes:'',
        sets:[{plannedWeight:null,plannedReps:'10-15',myorep:false},{plannedWeight:null,plannedReps:'10-15',myorep:false},{plannedWeight:null,plannedReps:'10-15',myorep:false}] },
      { id:'pa4', name:'Lateral Raise',    category:'push', repRange:'15-20', notes:'Light, focus form',
        sets:[{plannedWeight:null,plannedReps:'15-20',myorep:true},{plannedWeight:null,plannedReps:'15-20',myorep:true},{plannedWeight:null,plannedReps:'15-20',myorep:true}] },
      { id:'pa5', name:'Tricep Pushdown',  category:'push', repRange:'12-15', notes:'',
        sets:[{plannedWeight:null,plannedReps:'12-15',myorep:false},{plannedWeight:null,plannedReps:'12-15',myorep:false},{plannedWeight:null,plannedReps:'12-15',myorep:false}] },
    ]
  },
  {
    id: 'pull-a', name: 'Pull A', categories: ['pull'],
    exercises: [
      { id:'pla1', name:'Pull-Up',      category:'pull', repRange:'6-10',  notes:'',
        sets:[makeSet('6-10'),makeSet('6-10'),makeSet('6-10'),makeSet('6-10')] },
      { id:'pla2', name:'Barbell Row',  category:'pull', repRange:'8-12',  notes:'',
        sets:[makeSet('8-12'),makeSet('8-12'),makeSet('8-12'),makeSet('8-12')] },
      { id:'pla3', name:'Lat Pulldown', category:'pull', repRange:'10-15', notes:'',
        sets:[makeSet('10-15'),makeSet('10-15'),makeSet('10-15')] },
      { id:'pla4', name:'Cable Row',    category:'pull', repRange:'12-15', notes:'',
        sets:[makeSet('12-15'),makeSet('12-15'),makeSet('12-15')] },
      { id:'pla5', name:'DB Curl',      category:'pull', repRange:'12-15', notes:'',
        sets:[{plannedWeight:null,plannedReps:'12-15',myorep:true},{plannedWeight:null,plannedReps:'12-15',myorep:true},{plannedWeight:null,plannedReps:'12-15',myorep:true}] },
    ]
  },
  {
    id: 'legs-a', name: 'Legs A', categories: ['legs'],
    exercises: [
      { id:'la1', name:'Squat',             category:'legs', repRange:'6-10',  notes:'',
        sets:[makeSet('6-10'),makeSet('6-10'),makeSet('6-10'),makeSet('6-10')] },
      { id:'la2', name:'Romanian Deadlift', category:'legs', repRange:'10-12', notes:'',
        sets:[makeSet('10-12'),makeSet('10-12'),makeSet('10-12')] },
      { id:'la3', name:'Leg Press',         category:'legs', repRange:'12-15', notes:'',
        sets:[makeSet('12-15'),makeSet('12-15'),makeSet('12-15')] },
      { id:'la4', name:'Leg Curl',          category:'legs', repRange:'12-15', notes:'',
        sets:[{plannedWeight:null,plannedReps:'12-15',myorep:true},{plannedWeight:null,plannedReps:'12-15',myorep:true},{plannedWeight:null,plannedReps:'12-15',myorep:true}] },
      { id:'la5', name:'Calf Raise',        category:'legs', repRange:'15-20', notes:'',
        sets:[makeSet('15-20'),makeSet('15-20'),makeSet('15-20'),makeSet('15-20')] },
    ]
  },
  {
    id: 'core-a', name: 'Core', categories: ['core'],
    exercises: [
      { id:'ca1', name:'Plank',             category:'core', repRange:'30-60s', notes:'Seconds',
        sets:[makeSet('30-60s'),makeSet('30-60s'),makeSet('30-60s')] },
      { id:'ca2', name:'Cable Crunch',      category:'core', repRange:'15-20',  notes:'',
        sets:[{plannedWeight:null,plannedReps:'15-20',myorep:true},{plannedWeight:null,plannedReps:'15-20',myorep:true},{plannedWeight:null,plannedReps:'15-20',myorep:true}] },
      { id:'ca3', name:'Hanging Leg Raise', category:'core', repRange:'10-15',  notes:'',
        sets:[makeSet('10-15'),makeSet('10-15'),makeSet('10-15')] },
    ]
  },
]

const makeDefaultProgram = () => ({
  id: uid(), name: 'PPL Hypertrophy Block',
  startDate: new Date().toISOString().slice(0,10),
  weeksTotal: 5, rirSchedule: [3,2,1,0,null], deloadWeeks: [5], deloadVolumeFactor: 0.6,
  weeklyPlan: {
    '1':{ Mon:'push-a', Tue:'pull-a', Wed:'legs-a', Thu:null, Fri:'push-a', Sat:'pull-a', Sun:null },
    '2':{ Mon:'push-a', Tue:'pull-a', Wed:'legs-a', Thu:null, Fri:'push-a', Sat:'pull-a', Sun:null },
    '3':{ Mon:'push-a', Tue:'pull-a', Wed:'legs-a', Thu:null, Fri:'push-a', Sat:'pull-a', Sun:null },
    '4':{ Mon:'push-a', Tue:'pull-a', Wed:'legs-a', Thu:null, Fri:'push-a', Sat:'pull-a', Sun:null },
    '5':{ Mon:'push-a', Tue:null,     Wed:'legs-a', Thu:null, Fri:'pull-a', Sat:null,     Sun:null },
  },
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2,10) }
function dkey(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`
}
function estimate1RM(weight, reps, rir=0) { return weight * (1+(reps+rir)/30) }
function weightFrom1RM(orm, tgtReps, tgtRir) { return orm / (1+(tgtReps+tgtRir)/30) }

function getProgramWeek(program, date) {
  if (!program?.startDate) return null
  const start = new Date(program.startDate); start.setHours(0,0,0,0)
  const d = new Date(date); d.setHours(0,0,0,0)
  const diff = Math.floor((d-start)/86400000)
  if (diff < 0) return null
  const week = Math.floor(diff/7)+1
  return week > program.weeksTotal ? null : week
}
function isDeloadWeek(program, wn) { return program?.deloadWeeks?.includes(wn) ?? false }
function getTargetRir(program, wn) {
  if (!program||!wn) return null
  if (isDeloadWeek(program,wn)) return null
  const v = program.rirSchedule?.[(wn-1) % (program.rirSchedule?.length||4)]
  return v==null ? null : v
}
function dateToDayKey(date) { return DAYS[((new Date(date).getDay())+6)%7] }
function getTodayTemplate(program, templates, date=new Date()) {
  if (!program) return null
  const wn = getProgramWeek(program,date); if (!wn) return null
  const id = program.weeklyPlan?.[String(wn)]?.[dateToDayKey(date)]
  return id ? (templates.find(t=>t.id===id)??null) : null
}
function parseMidReps(range) {
  if (!range) return 10
  if (typeof range === 'number') return range
  const p = range.split('-').map(s=>parseFloat(s)).filter(Boolean)
  return p.length===2 ? Math.round((p[0]+p[1])/2) : (p[0]||10)
}
function getBestSet(sessions, exName) {
  let best=null
  for (const s of sessions.slice(-10)) {
    const ex=(s.exercises||[]).find(e=>e.name===exName); if (!ex) continue
    for (const set of (ex.sets||[])) {
      if (!set.weight||!set.reps) continue
      const orm=estimate1RM(set.weight,set.reps,set.rir??0)
      if (!best||orm>best.orm) best={...set,orm,date:s.date}
    }
  }
  return best
}
function suggestWeight(exName, repRange, sessions, targetRir) {
  const best=getBestSet(sessions,exName); if (!best) return null
  const w=weightFrom1RM(best.orm,parseMidReps(repRange),targetRir??2)
  return Math.round(w/2.5)*2.5
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  card: (border=C.border) => ({ background:C.surface, border:`1px solid ${border}`, borderRadius:10, padding:'12px 14px', marginBottom:10 }),
  btn: (color=C.accent, fill=false) => ({
    background: fill?color:'transparent', border:`1px solid ${color}`,
    color: fill?(color===C.warn||color===C.success?'#000':'#fff'):color,
    borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:12, fontWeight:600, lineHeight:1.4,
  }),
  input: { background:'#1e293b', border:'1px solid #334155', borderRadius:6, color:C.text, padding:'6px 10px', fontSize:13, width:'100%', boxSizing:'border-box' },
  label: { fontSize:11, color:C.muted, marginBottom:3, display:'block' },
  row: { display:'flex', gap:8, alignItems:'center' },
  tag: (color) => ({ background:color+'22', color, borderRadius:4, padding:'1px 6px', fontSize:11, fontWeight:700, display:'inline-block' }),
}

function RirBadge({ rir }) {
  if (rir==null) return <span style={S.tag(C.deload)}>DELOAD</span>
  const clr=[C.push,C.warn,C.success,C.accent,C.muted][Math.min(rir,4)]
  return <span style={S.tag(clr)}>RIR {rir}</span>
}

// ── Session Logger ────────────────────────────────────────────────────────────
function SessionLogger({ template, targetRir, isDeload, deloadFactor, sessions, onSave, onCancel }) {
  const effCount = n => isDeload ? Math.max(1, Math.round(n*(deloadFactor||0.6))) : n

  const [logData, setLogData] = useState(() => ({
    exercises: template.exercises.map(ex => {
      const planSets = ex.sets.slice(0, effCount(ex.sets.length))
      return {
        name: ex.name, category: ex.category, exDef: ex,
        sets: planSets.map(ps => ({
          weight: ps.plannedWeight != null ? String(ps.plannedWeight) : '',
          reps: '',
          rir: String(targetRir ?? 2),
          myoreps: 0,
          plannedWeight: ps.plannedWeight,
          plannedReps: ps.plannedReps,
          isMyo: ps.myorep != null,
          plannedMyo: typeof ps.myorep === 'number' ? ps.myorep : 0,
        })),
      }
    }),
    notes: '',
  }))

  const [elapsed, setElapsed] = useState(0)
  // myorep inline input state: which set is open
  const [myoOpen, setMyoOpen] = useState(null) // {ei,si}
  const [myoVal, setMyoVal] = useState('3')

  useEffect(() => {
    const t = setInterval(() => setElapsed(e=>e+1), 60000)
    return () => clearInterval(t)
  }, [])

  function updSet(ei, si, field, val) {
    setLogData(d => ({
      ...d,
      exercises: d.exercises.map((ex,i) => i!==ei ? ex : {
        ...ex,
        sets: ex.sets.map((s,j) => j!==si ? s : { ...s, [field]:val })
      })
    }))
  }

  function addSet(ei) {
    setLogData(d => ({
      ...d,
      exercises: d.exercises.map((ex,i) => {
        if (i!==ei) return ex
        const prev = ex.sets.slice(-1)[0]||{}
        return { ...ex, sets: [...ex.sets, { weight:prev.weight||'', reps:'', rir:String(targetRir??2), myoreps:0, plannedWeight:null, plannedReps:ex.exDef?.repRange||'', isMyo:false }] }
      })
    }))
  }

  function removeSet(ei) {
    setLogData(d => ({
      ...d,
      exercises: d.exercises.map((ex,i) => i!==ei||ex.sets.length<=1 ? ex : { ...ex, sets:ex.sets.slice(0,-1) })
    }))
  }

  function commitMyo(ei, si) {
    updSet(ei, si, 'myoreps', Number(myoVal)||0)
    setMyoOpen(null)
  }

  function save() {
    onSave({
      id: uid(), date: dkey(new Date()),
      templateId: template.id, templateName: template.name,
      targetRir: targetRir??null, isDeload, duration: elapsed||1,
      exercises: logData.exercises.map(ex => ({
        name: ex.name, category: ex.category,
        sets: ex.sets
          .filter(s => s.weight!==''&&s.reps!=='')
          .map(s => ({ weight:Number(s.weight), reps:Number(s.reps), rir:Number(s.rir??targetRir??2), myoreps:s.myoreps||0 })),
      })),
      notes: logData.notes,
    })
  }

  return (
    <div>
      <div style={{ ...S.card(C.accent+'44'), marginBottom:12 }}>
        <div style={{ ...S.row, justifyContent:'space-between' }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16 }}>{template.name}</div>
            <div style={{ fontSize:11, color:C.muted }}>⏱ {elapsed>0?`${elapsed}m`:'<1m'} elapsed</div>
          </div>
          <div style={S.row}>
            {isDeload && <span style={S.tag(C.deload)}>DELOAD</span>}
            {targetRir!=null && <RirBadge rir={targetRir}/>}
          </div>
        </div>
      </div>

      {logData.exercises.map((ex, ei) => {
        const catColor = CAT_COLORS[ex.category]||C.muted
        const hasMyo = ex.sets.some(s=>s.isMyo)
        const suggested = suggestWeight(ex.name, ex.exDef?.repRange, sessions, targetRir)
        return (
          <div key={ex.name} style={{ ...S.card(catColor+'44'), marginBottom:10 }}>
            <div style={{ ...S.row, justifyContent:'space-between', marginBottom:8 }}>
              <div style={S.row}>
                <span style={{ fontWeight:700, fontSize:14 }}>{ex.name}</span>
                <span style={S.tag(catColor)}>{ex.category}</span>
                {hasMyo && <span style={S.tag(C.warn)}>⚡ myo</span>}
              </div>
              {suggested!=null && (
                <div style={{ fontSize:11, color:C.deload, textAlign:'right' }}>
                  Suggest <b>{suggested} lbs</b>
                  <div style={{ fontSize:10, color:C.muted }}>RIR {targetRir??'?'} · {ex.exDef?.repRange}</div>
                </div>
              )}
            </div>

            {/* Column headers */}
            <div style={{ display:'grid', gridTemplateColumns:'22px 1fr 1fr 54px 68px', gap:4, marginBottom:4 }}>
              <span style={S.label}>#</span>
              <span style={S.label}>Weight</span>
              <span style={S.label}>Reps</span>
              <span style={S.label}>RIR</span>
              <span style={S.label}>⚡ Myo</span>
            </div>

            {ex.sets.map((set, si) => {
              const isMyoOpen = myoOpen?.ei===ei && myoOpen?.si===si
              const plWt = set.plannedWeight
              const plRp = set.plannedReps || ex.exDef?.repRange || ''
              return (
                <div key={si} style={{ display:'grid', gridTemplateColumns:'22px 1fr 1fr 54px 68px', gap:4, marginBottom:5, alignItems:'center' }}>
                  <span style={{ fontSize:11, color: set.isMyo ? C.warn : C.muted, textAlign:'center', fontWeight: set.isMyo?700:400 }}>
                    {set.isMyo ? '⚡' : si+1}
                  </span>
                  <input type="number" step="2.5" style={S.input}
                    value={set.weight}
                    placeholder={plWt!=null ? String(plWt) : (suggested!=null ? String(suggested) : '')}
                    onChange={e => updSet(ei,si,'weight',e.target.value)} />
                  <input type="number" style={S.input}
                    value={set.reps} placeholder={plRp}
                    onChange={e => updSet(ei,si,'reps',e.target.value)} />
                  <select style={S.input} value={set.rir}
                    onChange={e => updSet(ei,si,'rir',e.target.value)}>
                    {[0,1,2,3,4,5].map(r=><option key={r} value={r}>{r}</option>)}
                  </select>

                  {/* Myo cell */}
                  {isMyoOpen ? (
                    <div style={{ display:'flex', gap:2 }}>
                      <input type="number" autoFocus min={1} max={50}
                        style={{ ...S.input, padding:'6px 4px', width:34 }}
                        value={myoVal} onChange={e=>setMyoVal(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter')commitMyo(ei,si); if(e.key==='Escape')setMyoOpen(null) }} />
                      <button onClick={()=>commitMyo(ei,si)}
                        style={{ ...S.btn(C.warn,true), padding:'4px 6px', fontSize:11 }}>✓</button>
                    </div>
                  ) : set.myoreps > 0 ? (
                    <div style={{ ...S.row, gap:3 }}>
                      <span style={S.tag(C.warn)}>⚡{set.myoreps}</span>
                      <button onClick={()=>updSet(ei,si,'myoreps',0)}
                        style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:13, padding:0 }}>×</button>
                    </div>
                  ) : (
                    <button onClick={()=>{ setMyoOpen({ei,si}); setMyoVal(set.plannedMyo>0 ? String(set.plannedMyo) : '') }}
                      style={{ ...S.btn(C.warn), fontSize:11, padding:'4px 6px' }}>+⚡</button>
                  )}
                </div>
              )
            })}

            <div style={{ ...S.row, marginTop:4 }}>
              <button onClick={()=>addSet(ei)} style={{ ...S.btn(C.muted), fontSize:11, padding:'2px 8px' }}>+ Set</button>
              {ex.sets.length>1 &&
                <button onClick={()=>removeSet(ei)} style={{ ...S.btn(C.push), fontSize:11, padding:'2px 8px' }}>− Set</button>}
            </div>
          </div>
        )
      })}

      <div style={{ ...S.card(), marginBottom:12 }}>
        <label style={S.label}>Session Notes</label>
        <textarea style={{ ...S.input, minHeight:56, resize:'vertical' }}
          value={logData.notes} placeholder="Energy, PRs, form notes…"
          onChange={e=>setLogData(d=>({...d,notes:e.target.value}))} />
      </div>

      <div style={S.row}>
        <button onClick={save} style={{ ...S.btn(C.success,true), flex:1, padding:'10px 0', fontSize:14 }}>
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

  const weekNum = program ? getProgramWeek(program,today) : null
  const isDeload = weekNum ? isDeloadWeek(program,weekNum) : false
  const targetRir = weekNum ? getTargetRir(program,weekNum) : null
  const deloadFactor = program?.deloadVolumeFactor??0.6

  const scheduledTmpl = program ? getTodayTemplate(program,templates,today) : null
  const activeTmpl = manualId ? templates.find(t=>t.id===manualId) : scheduledTmpl
  const todaySessions = sessions.filter(s=>s.date===dkey(today))

  if (logging && activeTmpl) {
    return (
      <SessionLogger
        template={activeTmpl} targetRir={targetRir}
        isDeload={isDeload} deloadFactor={deloadFactor}
        sessions={sessions}
        onSave={s=>{ onSessionSave(s); setLogging(false); setManualId(null) }}
        onCancel={()=>setLogging(false)}
      />
    )
  }

  return (
    <div>
      <div style={{ ...S.card(C.accent+'33'), marginBottom:12 }}>
        <div style={{ fontWeight:800, fontSize:18, marginBottom:6 }}>
          {today.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}
        </div>
        {weekNum ? (
          <div style={S.row}>
            <span style={{ fontSize:12, color:C.muted }}>{program.name} · Week {weekNum}/{program.weeksTotal}</span>
            {isDeload ? <span style={S.tag(C.deload)}>DELOAD</span> : <RirBadge rir={targetRir}/>}
          </div>
        ) : (
          <div style={{ fontSize:12, color:C.muted }}>
            {program?'Outside program date range':'No active program — set one up in Program tab'}
          </div>
        )}
      </div>

      {scheduledTmpl ? (
        <div style={S.card()}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>📅 Scheduled</div>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>{scheduledTmpl.name}</div>
          {scheduledTmpl.exercises.map(ex => {
            const planSets = isDeload
              ? ex.sets.slice(0, Math.max(1, Math.round(ex.sets.length*deloadFactor)))
              : ex.sets
            const catColor = CAT_COLORS[ex.category]||C.muted
            const hasMyo = planSets.some(s=>s.myorep != null)
            const weights = planSets.map(s=>s.plannedWeight).filter(Boolean)
            const wtLabel = weights.length===0 ? null
              : weights.every(w=>w===weights[0]) ? `${weights[0]} lbs`
              : `${weights[0]}→${weights[weights.length-1]} lbs`
            return (
              <div key={ex.id} style={{ ...S.row, padding:'5px 0', borderBottom:`1px solid ${C.border}`, gap:8 }}>
                <span style={{ ...S.tag(catColor), minWidth:44, textAlign:'center' }}>{ex.category}</span>
                <span style={{ flex:1, fontSize:13 }}>
                  {ex.name}{hasMyo&&<span style={{ ...S.tag(C.warn), marginLeft:4 }}>⚡</span>}
                </span>
                <span style={{ fontSize:11, color:C.muted }}>{planSets.length}×{ex.repRange}</span>
                {wtLabel && <span style={{ fontSize:11, color:C.deload, fontWeight:700 }}>{wtLabel}</span>}
              </div>
            )
          })}
          <button onClick={()=>{ setManualId(null); setLogging(true) }}
            style={{ ...S.btn(C.success,true), width:'100%', padding:10, fontSize:14, marginTop:12 }}>
            🏋 Start Workout
          </button>
        </div>
      ) : (
        <div style={{ ...S.card(), textAlign:'center', padding:24 }}>
          <div style={{ fontSize:32, marginBottom:8 }}>😴</div>
          <div style={{ color:C.muted }}>Rest day — nothing scheduled</div>
        </div>
      )}

      {templates.length>0 && (
        <div style={S.card()}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>Log a different workout:</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {templates.map(t=>(
              <button key={t.id} onClick={()=>{ setManualId(t.id); setLogging(true) }}
                style={S.btn(t.categories[0]?CAT_COLORS[t.categories[0]]:C.muted)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {todaySessions.length>0 && (
        <div>
          <div style={{ fontWeight:600, fontSize:13, color:C.muted, marginBottom:8 }}>Logged today</div>
          {todaySessions.map(s=>(
            <div key={s.id} style={S.card()}>
              <div style={{ ...S.row, justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontWeight:700 }}>{s.templateName}</div>
                  <div style={{ fontSize:11, color:C.muted }}>
                    {s.exercises.length} exercises · {s.exercises.reduce((t,e)=>t+(e.sets?.length||0),0)} sets · {s.duration}m
                  </div>
                </div>
                <div style={S.row}>
                  {s.isDeload&&<span style={S.tag(C.deload)}>DL</span>}
                  {s.targetRir!=null&&<RirBadge rir={s.targetRir}/>}
                </div>
              </div>
              {s.notes&&<div style={{ fontSize:12, color:C.text, marginTop:6, fontStyle:'italic' }}>{s.notes}</div>}
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
  const currentWeek = program ? getProgramWeek(program,today) : null

  function startEdit(base) { setForm(JSON.parse(JSON.stringify(base))); setEditing(true) }

  function setWeekRir(wi, val) {
    setForm(f => {
      const s=[...(f.rirSchedule||[])]
      while(s.length<=wi) s.push(2)
      s[wi] = val===''||val==null ? null : Number(val)
      return {...f, rirSchedule:s}
    })
  }
  function toggleDeload(wn) {
    setForm(f => {
      const dw=[...(f.deloadWeeks||[])]
      const i=dw.indexOf(wn); if(i>=0) dw.splice(i,1); else dw.push(wn)
      return {...f, deloadWeeks:dw}
    })
  }
  function setDayTmpl(wn, day, id) {
    setForm(f => ({ ...f, weeklyPlan:{ ...f.weeklyPlan, [String(wn)]:{ ...(f.weeklyPlan?.[String(wn)]||{}), [day]:id||null } } }))
  }

  if (editing && form) {
    return (
      <div>
        <div style={{ ...S.row, justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontWeight:700, fontSize:15, color:C.accent }}>Edit Program</div>
          <div style={S.row}>
            <button onClick={()=>{ setProgram(form); setEditing(false) }} style={S.btn(C.success,true)}>Save</button>
            <button onClick={()=>setEditing(false)} style={S.btn()}>Cancel</button>
          </div>
        </div>

        <div style={S.card()}>
          <div style={{ marginBottom:8 }}>
            <label style={S.label}>Program Name</label>
            <input style={S.input} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div><label style={S.label}>Start Date</label>
              <input type="date" style={S.input} value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} /></div>
            <div><label style={S.label}>Total Weeks</label>
              <input type="number" style={S.input} value={form.weeksTotal} min={1} max={20} onChange={e=>setForm(f=>({...f,weeksTotal:Number(e.target.value)}))} /></div>
          </div>
        </div>

        <div style={S.card()}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>RIR Schedule + Deload Weeks</div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>Lower RIR = harder. Deload weeks reduce volume.</div>
          {Array.from({length:form.weeksTotal},(_,wi)=>{
            const wn=wi+1, isDL=(form.deloadWeeks||[]).includes(wn), rir=form.rirSchedule?.[wi]
            return (
              <div key={wn} style={{ ...S.row, marginBottom:6, background:'#1a2235', borderRadius:6, padding:'6px 10px' }}>
                <div style={{ width:52, fontWeight:700, fontSize:12, color:isDL?C.deload:C.text }}>Wk {wn}</div>
                <div style={{ flex:1 }}>
                  {isDL ? <span style={S.tag(C.deload)}>DELOAD</span> : (
                    <div style={S.row}>
                      <span style={{ fontSize:11, color:C.muted }}>RIR:</span>
                      {[0,1,2,3,4].map(r=>(
                        <button key={r} onClick={()=>setWeekRir(wi,r)}
                          style={{ ...S.btn(r===rir?C.accent:C.muted+'88',r===rir), padding:'2px 7px', fontSize:12 }}>{r}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={()=>toggleDeload(wn)}
                  style={{ ...S.btn(isDL?C.deload:C.muted,isDL), fontSize:11, padding:'2px 7px' }}>
                  {isDL?'✓ Deload':'Deload'}
                </button>
              </div>
            )
          })}
        </div>

        <div style={S.card()}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>Deload Settings</div>
          <div style={S.row}>
            <span style={{ fontSize:12, color:C.muted }}>Volume factor:</span>
            <input type="number" step="0.05" min={0.3} max={0.9} style={{ ...S.input, width:70 }}
              value={form.deloadVolumeFactor??0.6} onChange={e=>setForm(f=>({...f,deloadVolumeFactor:Number(e.target.value)}))} />
            <span style={{ fontSize:11, color:C.muted }}>({Math.round((form.deloadVolumeFactor??0.6)*100)}% of sets)</span>
          </div>
        </div>

        <div style={S.card()}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Weekly Day Plan</div>
          {Array.from({length:form.weeksTotal},(_,wi)=>{
            const wn=wi+1, isDL=(form.deloadWeeks||[]).includes(wn)
            return (
              <div key={wn} style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:isDL?C.deload:C.text, marginBottom:4 }}>
                  Week {wn} {isDL?'— DELOAD':`— Target RIR ${form.rirSchedule?.[wi]??'?'}`}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
                  {DAYS.map(day=>(
                    <div key={day}>
                      <div style={{ fontSize:9, color:C.muted, textAlign:'center', marginBottom:2 }}>{day}</div>
                      <select value={form.weeklyPlan?.[String(wn)]?.[day]||''}
                        onChange={e=>setDayTmpl(wn,day,e.target.value)}
                        style={{ ...S.input, padding:'3px 2px', fontSize:9, textAlign:'center' }}>
                        <option value="">—</option>
                        {templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
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

  if (!program) {
    return (
      <div style={{ textAlign:'center', padding:40 }}>
        <div style={{ fontSize:48, marginBottom:12 }}>🗓️</div>
        <div style={{ color:C.muted, marginBottom:16 }}>No training program yet.</div>
        <button onClick={()=>startEdit(makeDefaultProgram())} style={S.btn(C.accent,true)}>Create Program</button>
      </div>
    )
  }

  const progress = currentWeek!=null ? Math.min(1,currentWeek/program.weeksTotal) : 0
  return (
    <div>
      <div style={{ ...S.card(C.accent+'44'), marginBottom:12 }}>
        <div style={{ ...S.row, justifyContent:'space-between', marginBottom:8 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:C.accent }}>{program.name}</div>
            <div style={{ fontSize:11, color:C.muted }}>Started {program.startDate} · {program.weeksTotal} weeks</div>
          </div>
          <button onClick={()=>startEdit(program)} style={S.btn()}>Edit</button>
        </div>
        <div style={{ background:'#1e293b', borderRadius:4, height:6, marginBottom:6 }}>
          <div style={{ background:C.accent, borderRadius:4, height:6, width:`${progress*100}%`, transition:'width .3s' }}/>
        </div>
        <div style={{ fontSize:12, color:C.muted }}>
          {currentWeek ? <>Week {currentWeek} of {program.weeksTotal}
            {isDeloadWeek(program,currentWeek)
              ? <span style={{ color:C.deload, marginLeft:8 }}>— DELOAD WEEK</span>
              : <span style={{ marginLeft:8 }}>— Target <RirBadge rir={getTargetRir(program,currentWeek)}/></span>}
          </> : 'No active week for today'}
        </div>
      </div>

      <div style={S.card()}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Program Overview</div>
        {Array.from({length:program.weeksTotal},(_,wi)=>{
          const wn=wi+1, isDL=isDeloadWeek(program,wn), rir=getTargetRir(program,wn)
          const isActive=wn===currentWeek, isPast=currentWeek!=null&&wn<currentWeek
          const dayNames=DAYS.filter(d=>program.weeklyPlan?.[String(wn)]?.[d]).map(d=>{
            const id=program.weeklyPlan[String(wn)][d]
            return templates.find(t=>t.id===id)?.name||d
          })
          return (
            <div key={wn} style={{ ...S.row, marginBottom:5, padding:'7px 10px', borderRadius:8,
              background:isActive?'#0e2a3a':isPast?'#0a1a0a':'#131e2e',
              border:`1px solid ${isActive?C.accent:isPast?'#22c55e44':C.border}` }}>
              <div style={{ width:52, fontWeight:700, fontSize:12, color:isActive?C.accent:isPast?C.success:C.muted }}>
                {isPast?'✓':isActive?'▶':' '} Wk {wn}
              </div>
              <div style={{ width:70 }}>{isDL?<span style={S.tag(C.deload)}>DELOAD</span>:<RirBadge rir={rir}/>}</div>
              <div style={{ flex:1, fontSize:10, color:C.muted }}>{dayNames.join(' · ')||'Rest'}</div>
            </div>
          )
        })}
      </div>
      <div style={{ textAlign:'center', marginTop:8 }}>
        <button onClick={()=>startEdit(makeDefaultProgram())} style={S.btn(C.muted)}>New Program</button>
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
  const [editingNameId, setEditingNameId] = useState(null) // inline name edit
  const [tmplMyoOpen, setTmplMyoOpen] = useState(null) // {exId, si} — which set's myo input is open
  const [tmplMyoVal, setTmplMyoVal] = useState('')

  const tmpl = templates.find(t=>t.id===selectedId)

  function createTemplate() {
    if (!newName.trim()) return
    const t = { id:uid(), name:newName.trim(), categories:newCats, exercises:[] }
    setTemplates(ts=>[...ts,t]); setSelectedId(t.id); setShowCreate(false); setNewName(''); setNewCats([])
  }

  function updExercise(exId, patch) {
    setTemplates(ts=>ts.map(t=>t.id!==selectedId?t:{
      ...t, exercises:t.exercises.map(e=>e.id!==exId?e:{...e,...patch})
    }))
  }

  function removeExercise(exId) {
    setTemplates(ts=>ts.map(t=>t.id!==selectedId?t:{...t,exercises:t.exercises.filter(e=>e.id!==exId)}))
  }

  // Per-set helpers
  function updTmplSet(exId, si, field, val) {
    setTemplates(ts=>ts.map(t=>t.id!==selectedId?t:{
      ...t, exercises:t.exercises.map(e=>e.id!==exId?e:{
        ...e, sets:e.sets.map((s,i)=>i!==si?s:{...s,[field]:val})
      })
    }))
  }
  function addTmplSet(exId) {
    setTemplates(ts=>ts.map(t=>t.id!==selectedId?t:{
      ...t, exercises:t.exercises.map(e=>{
        if(e.id!==exId) return e
        const last=e.sets.slice(-1)[0]||makeSet(e.repRange)
        return {...e, sets:[...e.sets, {...last}]}
      })
    }))
  }
  function removeTmplSet(exId) {
    setTemplates(ts=>ts.map(t=>t.id!==selectedId?t:{
      ...t, exercises:t.exercises.map(e=>e.id!==exId||e.sets.length<=1?e:{...e,sets:e.sets.slice(0,-1)})
    }))
  }

  function addExercise() {
    if (!addExForm?.name?.trim()) return
    const count = Number(addExForm.setsCount)||3
    const ex = {
      id:uid(), name:addExForm.name.trim(), category:addExForm.category||'other',
      repRange:Number(addExForm.repRange)||10, notes:addExForm.notes||'',
      sets: Array.from({length:count}, ()=>makeSet(Number(addExForm.repRange)||10)),
    }
    setTemplates(ts=>ts.map(t=>t.id!==selectedId?t:{...t,exercises:[...t.exercises,ex]}))
    setAddExForm(null)
  }

  function moveEx(exId, dir) {
    setTemplates(ts=>ts.map(t=>{
      if(t.id!==selectedId) return t
      const exs=[...t.exercises], i=exs.findIndex(e=>e.id===exId), j=i+dir
      if(j<0||j>=exs.length) return t
      ;[exs[i],exs[j]]=[exs[j],exs[i]]
      return {...t,exercises:exs}
    }))
  }

  // ── List view ──
  if (!selectedId) {
    return (
      <div>
        <div style={{ ...S.row, justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontWeight:700, fontSize:15 }}>Day Templates</div>
          <button onClick={()=>setShowCreate(true)} style={S.btn(C.accent,true)}>+ Template</button>
        </div>

        {showCreate && (
          <div style={{ ...S.card(C.accent), marginBottom:12 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>New Template</div>
            <input style={{ ...S.input, marginBottom:8 }} placeholder="Name (e.g. Push A, Upper Body…)"
              value={newName} onChange={e=>setNewName(e.target.value)} />
            <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>Categories:</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
              {CATEGORIES.map(c=>(
                <button key={c.id} onClick={()=>setNewCats(cs=>cs.includes(c.id)?cs.filter(x=>x!==c.id):[...cs,c.id])}
                  style={S.btn(CAT_COLORS[c.id],newCats.includes(c.id))}>{c.emoji} {c.label}</button>
              ))}
            </div>
            <div style={S.row}>
              <button onClick={createTemplate} style={S.btn(C.success,true)}>Create</button>
              <button onClick={()=>setShowCreate(false)} style={S.btn()}>Cancel</button>
            </div>
          </div>
        )}

        {templates.length===0&&!showCreate&&(
          <div style={{ textAlign:'center', padding:30, color:C.muted }}>No templates yet.</div>
        )}

        {templates.map(t=>(
          <div key={t.id} style={{ ...S.card(), cursor:'pointer' }} onClick={()=>setSelectedId(t.id)}>
            <div style={{ ...S.row, justifyContent:'space-between' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{t.name}</div>
                <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                  {t.exercises.length} exercises · {t.exercises.reduce((n,e)=>n+e.sets.length,0)} sets total
                  {t.categories.map(c=><span key={c} style={{ ...S.tag(CAT_COLORS[c]||C.muted), marginLeft:4 }}>{c}</span>)}
                  {t.exercises.some(e=>e.sets.some(s=>s.myorep != null))&&
                    <span style={{ ...S.tag(C.warn), marginLeft:4 }}>⚡ myo</span>}
                </div>
              </div>
              <div style={S.row}>
                <button onClick={e=>{e.stopPropagation();setTemplates(ts=>ts.filter(x=>x.id!==t.id))}}
                  style={{ ...S.btn(C.push), padding:'2px 7px', fontSize:11 }}>✕</button>
                <span style={{ color:C.muted, fontSize:18 }}>›</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!tmpl) { setSelectedId(null); return null }

  // ── Edit template ──
  return (
    <div>
      <div style={{ ...S.row, justifyContent:'space-between', marginBottom:12 }}>
        <button onClick={()=>{ setSelectedId(null); setEditingNameId(null) }} style={S.btn()}>← Back</button>
        <div style={{ fontWeight:700, fontSize:15 }}>{tmpl.name}</div>
        <div style={{ width:60 }}/>
      </div>

      {/* Template name */}
      <div style={{ ...S.card(), marginBottom:10 }}>
        <label style={S.label}>Template Name</label>
        <input style={S.input} value={tmpl.name}
          onChange={e=>setTemplates(ts=>ts.map(t=>t.id!==selectedId?t:{...t,name:e.target.value}))} />
      </div>

      {tmpl.exercises.map((ex, idx) => {
        const catColor = CAT_COLORS[ex.category]||C.muted
        const isEditingName = editingNameId===ex.id
        return (
          <div key={ex.id} style={{ ...S.card(catColor+'55'), marginBottom:10 }}>
            {/* Header: editable name + move/delete */}
            <div style={{ ...S.row, justifyContent:'space-between', marginBottom:10 }}>
              {isEditingName ? (
                <input autoFocus style={{ ...S.input, flex:1, marginRight:8, fontSize:14, fontWeight:700 }}
                  value={ex.name}
                  onChange={e=>updExercise(ex.id,{name:e.target.value})}
                  onBlur={()=>setEditingNameId(null)}
                  onKeyDown={e=>{ if(e.key==='Enter'||e.key==='Escape') setEditingNameId(null) }} />
              ) : (
                <div style={{ fontWeight:700, fontSize:14, cursor:'text', flex:1, display:'flex', alignItems:'center', gap:6 }}
                  onClick={()=>setEditingNameId(ex.id)} title="Click to edit name">
                  {ex.name}
                  <span style={{ fontSize:11, color:C.muted, fontWeight:400 }}>✎</span>
                </div>
              )}
              <div style={S.row}>
                <button onClick={()=>moveEx(ex.id,-1)} disabled={idx===0}
                  style={{ ...S.btn(C.muted), padding:'1px 6px', opacity:idx===0?0.35:1 }}>↑</button>
                <button onClick={()=>moveEx(ex.id,1)} disabled={idx===tmpl.exercises.length-1}
                  style={{ ...S.btn(C.muted), padding:'1px 6px', opacity:idx===tmpl.exercises.length-1?0.35:1 }}>↓</button>
                <button onClick={()=>removeExercise(ex.id)} style={{ ...S.btn(C.push), padding:'1px 6px' }}>✕</button>
              </div>
            </div>

            {/* Category + default rep range */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
              <div>
                <label style={S.label}>Category</label>
                <select style={S.input} value={ex.category} onChange={e=>updExercise(ex.id,{category:e.target.value})}>
                  {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={S.label}>Default Reps</label>
                <input type="number" style={S.input} value={ex.repRange??''} placeholder="10"
                  onChange={e=>updExercise(ex.id,{repRange:e.target.value===''?null:Number(e.target.value)})} />
              </div>
            </div>

            {/* Per-set planning */}
            <div>
              <div style={{ ...S.row, justifyContent:'space-between', marginBottom:6 }}>
                <label style={{ ...S.label, marginBottom:0 }}>Sets ({ex.sets.length})</label>
                <div style={S.row}>
                  <button onClick={()=>addTmplSet(ex.id)} style={{ ...S.btn(C.success), padding:'1px 8px', fontSize:11 }}>+ Set</button>
                  {ex.sets.length>1&&
                    <button onClick={()=>removeTmplSet(ex.id)} style={{ ...S.btn(C.push), padding:'1px 8px', fontSize:11 }}>− Set</button>}
                </div>
              </div>

              {/* Column headers */}
              <div style={{ display:'grid', gridTemplateColumns:'22px 1fr 1fr 50px', gap:4, marginBottom:4 }}>
                <span style={S.label}>#</span>
                <span style={S.label}>Planned Weight</span>
                <span style={S.label}>Reps</span>
                <span style={S.label}>⚡ Myo</span>
              </div>

              {ex.sets.map((set, si) => {
                const isTmplMyoOpen = tmplMyoOpen?.exId===ex.id && tmplMyoOpen?.si===si
                return (
                  <div key={si} style={{ display:'grid', gridTemplateColumns:'22px 1fr 1fr 50px', gap:4, marginBottom:4, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:C.muted, textAlign:'center' }}>{si+1}</span>
                    <input type="number" step="2.5" style={S.input}
                      value={set.plannedWeight??''} placeholder="—"
                      onChange={e=>updTmplSet(ex.id,si,'plannedWeight',e.target.value===''?null:Number(e.target.value))} />
                    <input type="number" style={S.input} value={set.plannedReps??''} placeholder={ex.repRange??'10'}
                      onChange={e=>updTmplSet(ex.id,si,'plannedReps',e.target.value===''?null:Number(e.target.value))} />
                    {isTmplMyoOpen ? (
                      <div style={{ display:'flex', gap:2 }}>
                        <input type="number" autoFocus min={0} max={50} placeholder="any"
                          style={{ ...S.input, padding:'6px 4px', width:34 }}
                          value={tmplMyoVal} onChange={e=>setTmplMyoVal(e.target.value)}
                          onKeyDown={e=>{ if(e.key==='Enter'){updTmplSet(ex.id,si,'myorep',tmplMyoVal===''?0:Number(tmplMyoVal));setTmplMyoOpen(null)} if(e.key==='Escape')setTmplMyoOpen(null) }} />
                        <button onClick={()=>{updTmplSet(ex.id,si,'myorep',tmplMyoVal===''?0:Number(tmplMyoVal));setTmplMyoOpen(null)}}
                          style={{ ...S.btn(C.warn,true), padding:'4px 5px', fontSize:11 }}>✓</button>
                      </div>
                    ) : set.myorep != null ? (
                      <div style={{ display:'flex', gap:2, alignItems:'center' }}>
                        <button onClick={()=>{setTmplMyoOpen({exId:ex.id,si});setTmplMyoVal(set.myorep>0?String(set.myorep):'')}}
                          style={{ ...S.btn(C.warn,true), padding:'3px 5px', fontSize:11 }}>
                          ⚡{set.myorep>0?set.myorep:''}
                        </button>
                        <button onClick={()=>updTmplSet(ex.id,si,'myorep',null)}
                          style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:13, padding:0 }}>×</button>
                      </div>
                    ) : (
                      <button onClick={()=>{setTmplMyoOpen({exId:ex.id,si});setTmplMyoVal('')}}
                        style={{ ...S.btn(C.muted), padding:'4px 5px', fontSize:13 }}
                        title="Mark as myo-rep set">⚡</button>
                    )}
                  </div>
                )
              })}
            </div>

            {ex.notes&&<div style={{ fontSize:11, color:C.muted, marginTop:8 }}>{ex.notes}</div>}
          </div>
        )
      })}

      {/* Add exercise */}
      {addExForm ? (
        <div style={S.card(C.success+'44')}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Add Exercise</div>
          <div style={{ marginBottom:8 }}>
            <label style={S.label}>Category</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {CATEGORIES.map(c=>(
                <button key={c.id} onClick={()=>setAddExForm(f=>({...f,category:c.id,name:''}))}
                  style={S.btn(CAT_COLORS[c.id],addExForm.category===c.id)}>{c.emoji} {c.label}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:8 }}>
            <label style={S.label}>Exercise</label>
            <select style={{ ...S.input, marginBottom:4 }} value=""
              onChange={e=>setAddExForm(f=>({...f,name:e.target.value}))}>
              <option value="">— pick preset —</option>
              {(PRESET_EXERCISES[addExForm.category||'other']||[]).map(n=>(
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <input style={S.input} placeholder="Or type custom name…"
              value={addExForm.name} onChange={e=>setAddExForm(f=>({...f,name:e.target.value}))} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 80px', gap:6, marginBottom:12 }}>
            <div><label style={S.label}>Reps</label>
              <input type="number" style={S.input} placeholder="10" value={addExForm.repRange||''}
                onChange={e=>setAddExForm(f=>({...f,repRange:e.target.value===''?'':Number(e.target.value)}))} /></div>
            <div><label style={S.label}>Notes</label>
              <input style={S.input} placeholder="optional" value={addExForm.notes||''}
                onChange={e=>setAddExForm(f=>({...f,notes:e.target.value}))} /></div>
            <div><label style={S.label}>Sets</label>
              <input type="number" style={S.input} value={addExForm.setsCount||3} min={1} max={10}
                onChange={e=>setAddExForm(f=>({...f,setsCount:e.target.value}))} /></div>
          </div>
          <div style={S.row}>
            <button onClick={addExercise} style={S.btn(C.success,true)}>Add</button>
            <button onClick={()=>setAddExForm(null)} style={S.btn()}>Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={()=>setAddExForm({category:'push',name:'',setsCount:3,repRange:10,notes:''})}
          style={{ ...S.btn(C.accent,true), width:'100%', padding:'10px 0', fontSize:13 }}>
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

  const prMap = {}
  for (const s of sessions) {
    for (const ex of (s.exercises||[])) {
      for (const set of (ex.sets||[])) {
        if (!set.weight||!set.reps) continue
        const orm = estimate1RM(set.weight,set.reps,set.rir??0)
        if (!prMap[ex.name]||orm>prMap[ex.name].orm)
          prMap[ex.name]={orm,weight:set.weight,reps:set.reps,rir:set.rir??0,date:s.date,cat:ex.category}
      }
    }
  }

  const sorted = [...sessions].sort((a,b)=>b.date.localeCompare(a.date))
  const sel = selectedId ? sessions.find(s=>s.id===selectedId) : null

  if (sel) {
    return (
      <div>
        <div style={{ ...S.row, justifyContent:'space-between', marginBottom:12 }}>
          <button onClick={()=>setSelectedId(null)} style={S.btn()}>← Back</button>
          <button onClick={()=>{ onDelete(sel.id); setSelectedId(null) }} style={S.btn(C.push)}>Delete</button>
        </div>
        <div style={{ ...S.card(C.accent+'33'), marginBottom:10 }}>
          <div style={{ fontWeight:800, fontSize:15 }}>{sel.templateName}</div>
          <div style={{ fontSize:11, color:C.muted }}>{sel.date} · {sel.duration}m</div>
          <div style={{ ...S.row, marginTop:4 }}>
            {sel.isDeload&&<span style={S.tag(C.deload)}>DELOAD</span>}
            {sel.targetRir!=null&&<RirBadge rir={sel.targetRir}/>}
          </div>
        </div>
        {(sel.exercises||[]).map((ex,i)=>{
          const catColor=CAT_COLORS[ex.category]||C.muted
          const topSet=ex.sets?.reduce((b,s)=>{
            if(!s.weight||!s.reps) return b
            const o=estimate1RM(s.weight,s.reps,s.rir??0)
            return (!b||o>b.orm)?{...s,orm:o}:b
          },null)
          return (
            <div key={i} style={S.card(catColor+'33')}>
              <div style={{ ...S.row, marginBottom:6, justifyContent:'space-between' }}>
                <div style={{ fontWeight:700 }}>{ex.name}</div>
                {topSet&&<span style={{ fontSize:11, color:C.warn }}>Top e1RM: {Math.round(topSet.orm)}lb</span>}
              </div>
              {(ex.sets||[]).map((s,si)=>(
                <div key={si} style={{ ...S.row, fontSize:12, marginBottom:3, flexWrap:'wrap', gap:4 }}>
                  <span style={{ color:C.muted, width:18 }}>{si+1}.</span>
                  <span style={{ fontWeight:700, color:catColor }}>{s.weight}lb</span>
                  <span style={{ color:C.muted }}>× {s.reps}</span>
                  <span style={S.tag(C.accent)}>RIR {s.rir}</span>
                  {s.myoreps>0&&<span style={S.tag(C.warn)}>+{s.myoreps} myo</span>}
                  <span style={{ fontSize:10, color:C.muted }}>e1RM {Math.round(estimate1RM(s.weight,s.reps,s.rir??0))}lb</span>
                </div>
              ))}
            </div>
          )
        })}
        {sel.notes&&<div style={S.card()}><div style={{ fontSize:12, fontStyle:'italic' }}>{sel.notes}</div></div>}
      </div>
    )
  }

  return (
    <div>
      <div style={{ ...S.row, justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontWeight:700, fontSize:15 }}>History</div>
        <button onClick={()=>setShowPRs(v=>!v)} style={S.btn(showPRs?C.warn:C.muted,showPRs)}>🏆 PRs</button>
      </div>

      {showPRs&&(
        <div style={{ ...S.card(), marginBottom:12 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Personal Records (est. 1RM)</div>
          {Object.keys(prMap).length===0&&<div style={{ fontSize:12, color:C.muted }}>No PRs yet.</div>}
          {Object.entries(prMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([name,pr])=>(
            <div key={name} style={{ ...S.row, padding:'5px 0', borderBottom:`1px solid ${C.border}`, fontSize:12, flexWrap:'wrap', gap:4 }}>
              <span style={{ ...S.tag(CAT_COLORS[pr.cat]||C.muted), minWidth:38 }}>{pr.cat}</span>
              <span style={{ flex:1, fontWeight:600 }}>{name}</span>
              <span style={{ color:C.warn, fontWeight:700 }}>{pr.weight}lb × {pr.reps}</span>
              <span style={S.tag(C.accent)}>e1RM {Math.round(pr.orm)}lb</span>
              <span style={{ fontSize:10, color:C.muted }}>{pr.date}</span>
            </div>
          ))}
        </div>
      )}

      {sorted.length===0&&(
        <div style={{ textAlign:'center', padding:40, color:C.muted }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📋</div>No workouts logged yet.
        </div>
      )}

      {sorted.map(s=>(
        <div key={s.id} style={{ ...S.card(), cursor:'pointer' }} onClick={()=>setSelectedId(s.id)}>
          <div style={{ ...S.row, justifyContent:'space-between' }}>
            <div>
              <div style={{ fontWeight:700 }}>{s.templateName}</div>
              <div style={{ fontSize:11, color:C.muted }}>
                {s.date} · {s.exercises?.length||0} exercises · {(s.exercises||[]).reduce((t,e)=>t+(e.sets?.length||0),0)} sets · {s.duration}m
              </div>
            </div>
            <div style={S.row}>
              {s.isDeload&&<span style={S.tag(C.deload)}>DL</span>}
              {s.targetRir!=null&&<RirBadge rir={s.targetRir}/>}
            </div>
          </div>
          {s.notes&&<div style={{ fontSize:11, color:C.muted, marginTop:4, fontStyle:'italic' }}>{s.notes.slice(0,80)}{s.notes.length>80?'…':''}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function WorkoutPlanner() {
  const [program,      setProgram]      = usePersist('wk_program',   null)
  const [rawTemplates, setTemplates]    = usePersist('wk_templates', DEFAULT_TEMPLATES)
  const [sessions,     setSessions]     = usePersist('wk_sessions',  [])
  const [tab, setTab] = useState('today')

  // Migrate old sets:number format → sets:array on load
  const templates = migrateTemplates(rawTemplates)

  function saveSession(s) { setSessions(ss=>[...ss,s]) }
  function deleteSession(id) { setSessions(ss=>ss.filter(s=>s.id!==id)) }

  const INNER_TABS = [['today','🏋','Today'],['program','📅','Program'],['templates','📋','Templates'],['history','📈','History']]

  return (
    <div style={{ paddingBottom:8 }}>
      <div style={{ display:'flex', gap:3, marginBottom:14, background:C.surface, borderRadius:10, padding:4 }}>
        {INNER_TABS.map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            flex:1, background:tab===id?'#1e293b':'transparent', border:'none', borderRadius:7,
            color:tab===id?C.accent:C.muted, padding:'7px 2px', fontSize:11, cursor:'pointer',
            fontWeight:tab===id?700:400, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
          }}>
            <span style={{ fontSize:18 }}>{icon}</span>{label}
          </button>
        ))}
      </div>

      {tab==='today'     && <TodayView     program={program} templates={templates} sessions={sessions} onSessionSave={saveSession}/>}
      {tab==='program'   && <ProgramView   program={program} setProgram={setProgram} templates={templates}/>}
      {tab==='templates' && <TemplatesView templates={templates} setTemplates={setTemplates}/>}
      {tab==='history'   && <HistoryView   sessions={sessions} onDelete={deleteSession}/>}
    </div>
  )
}
