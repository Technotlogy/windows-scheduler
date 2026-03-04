import { useState, useEffect, useRef } from 'react'
import { usePersist, exportData, importData } from './usePersist'
import { useGoogleCalendar } from './useGoogleCalendar'
import { parseEvent, autopopulateDay } from './claude'
import WorkoutPlanner from './WorkoutPlanner'

// ── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  day:'#eab308',night:'#3b82f6',off:'#22c55e',work:'#10b981',workout:'#ef4444',
  content:'#a855f7',meal:'#f59e0b',decompress:'#06b6d4',routine:'#f97316',
  todo:'#e879f9',overdue:'#f43f5e',followup:'#fb923c',streak:'#f59e0b',
  sleep:'#4c1d95',appt:'#38bdf8',
}
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DSHORT=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DFULL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const LOCS=['Home','Planet Fitness','BodyEvolution','AMP Fitness']
const EXERCISE_CATS=[
  {id:'push', label:'Push',    sub:'Chest · Triceps · Shoulders'},
  {id:'pull', label:'Pull',    sub:'Back · Biceps · Forearms'},
  {id:'legs', label:'Legs',    sub:''},
  {id:'cardio',label:'Cardio', sub:''},
  {id:'other', label:'Other',  sub:''},
]
const PRESET_EXERCISES={
  push:[
    'Bench Press','Incline DB Press','Decline Bench Press','DB Fly','Cable Fly',
    'Chest Dip','Overhead Press','Lateral Raise','Front Raise','Face Pull',
    'Tricep Pushdown','Skull Crusher','Close-Grip Bench','Dip','Cable Lateral Raise',
  ],
  pull:[
    'Pull-Up','Weighted Pull-Up','Lat Pulldown','Cable Row','Barbell Row',
    'DB Row','T-Bar Row','Deadlift','Romanian Deadlift','Shrug',
    'Barbell Curl','DB Curl','Hammer Curl','Preacher Curl','Reverse Curl','Incline DB Curl',
  ],
  legs:[
    'Squat','Leg Press','Romanian Deadlift','Leg Curl','Leg Extension',
    'Hip Thrust','Calf Raise','Lunges','Bulgarian Split Squat','Hack Squat',
    'Sumo Deadlift','Box Jump',
  ],
  cardio:[
    'Treadmill','Elliptical','Stair Master','Stationary Bike',
    'Jump Rope','Row Machine','Outdoor Run','Swim',
  ],
  other:[
    'Plank','Crunches','Cable Crunch','Hanging Leg Raise',
    'Russian Twist','Ab Wheel','Farmers Walk','Battle Ropes',
  ],
}
const STAGES=['idea','script','film','edit','published']
const STAGE_COLORS={idea:'#475569',script:'#7c3aed',film:'#dc2626',edit:'#d97706',published:'#16a34a'}
const STAGE_LABELS={idea:'💡 Idea',script:'✍ Script',film:'🎬 Film',edit:'✂ Edit',published:'✅ Published'}

const DEF_SLEEP={day:{start:22,dur:7},night:{start:9,dur:7},off:{start:23,dur:8}}
const DEF_CYCLE=[
  {label:'Day Shift',type:'day',days:4,sh:8,eh:20},
  {label:'Off',type:'off',days:1,sh:null,eh:null},
  {label:'Night Shift',type:'night',days:4,sh:20,eh:8},
  {label:'Off',type:'off',days:3,sh:null,eh:null},
]
const DEF_WAKE=['Delay nicotine 60–90 min','Hydrate','Review daily schedule','Light stretch']
const DEF_BED=['Wind down — no screens','Philosophical reading',"Review tomorrow's plan",'Stop nicotine 2–3 hrs before sleep']

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt12(h){
  if(h==null)return''
  const hh=Math.floor(h)%24,mm=Math.round((h-Math.floor(h))*60)
  const ap=hh>=12?'PM':'AM',hr=hh%12===0?12:hh%12
  return`${hr}${mm>0?`:${String(mm).padStart(2,'0')}`:''} ${ap}`
}
function dkey(d){const x=new Date(d);return`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function sameDay(a,b){return dkey(a)===dkey(b)}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r}
function sowk(d){const r=new Date(d);r.setDate(r.getDate()-((r.getDay()+6)%7));r.setHours(0,0,0,0);return r}
function weekDates(base,off){const mon=addDays(sowk(base),off*7);return Array.from({length:7},(_,i)=>addDays(mon,i))}
function monthDates(y,m){const first=new Date(y,m,1);const pad=(first.getDay()+6)%7;return Array.from({length:42},(_,i)=>addDays(addDays(first,-pad),i))}
function parseTime(str){
  if(!str)return null
  const m=str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if(!m)return null
  let h=parseInt(m[1]);const min=m[2]?parseInt(m[2]):0,ap=m[3].toLowerCase()
  if(ap==='pm'&&h!==12)h+=12;if(ap==='am'&&h===12)h=0
  return h+min/60
}

function getDayBlock(cycle,start,date,offset=0){
  const s=new Date(start);s.setHours(0,0,0,0)
  const d=new Date(date);d.setHours(0,0,0,0)
  const diff=Math.round((d-s)/86400000)
  const tot=cycle.reduce((a,b)=>a+b.days,0)
  if(!tot)return null
  // Use ((n%m)+m)%m so negative diffs (dates before cycleStart) wrap correctly
  let pos=((diff+offset)%tot+tot)%tot,acc=0
  for(const b of cycle){if(pos<acc+b.days)return b;acc+=b.days}
  return cycle[cycle.length-1]||null
}
function inShutdown(sd,date){
  if(!sd.active||!sd.start)return false
  const d=new Date(date);d.setHours(0,0,0,0)
  const s=new Date(sd.start);s.setHours(0,0,0,0)
  if(d<s)return false
  if(sd.end){const e=new Date(sd.end);e.setHours(0,0,0,0);if(d>e)return false}
  return true
}
function effBlock(cycle,start,sd,date,offset=0){
  if(inShutdown(sd,date))return{type:sd.type,label:`Shutdown ${sd.type==='day'?'Days':'Nights'}`,sh:sd.type==='day'?8:20,eh:sd.type==='day'?20:8,isSD:true}
  return getDayBlock(cycle,start,date,offset)
}
function suggestDay(cycle,start,sd,jobs,tasks,nb,offset=0){
  const from=nb?new Date(nb):new Date();from.setHours(0,0,0,0)
  let best=null,bs=Infinity
  for(let i=0;i<21;i++){
    const d=addDays(from,i),b=effBlock(cycle,start,sd,d,offset)
    if(!b||b.type!=='off')continue
    const load=(jobs[dkey(d)]||[]).length+tasks.filter(t=>t.date===dkey(d)).length
    if(load<bs){bs=load;best=d}
  }
  return best
}

const DUR_MAP={'30 min':0.5,'45 min':0.75,'1 hr':1,'1.5 hr':1.5,'2 hr':2,'2.5 hr':2.5,'3 hr':3,'4 hr':4,'All day':8}
const TRAVEL_MAP={'5 min':5/60,'10 min':10/60,'15 min':0.25,'20 min':1/3,'30 min':0.5,'45 min':0.75,'1 hr':1,'1.5 hr':1.5}

function buildTimeline(block,sleepSettings,appts,jobs,workouts,meals,wakeR,bedR,k,commuteMin=60){
  const blocks=[],type=block?.type||'off',sleep=sleepSettings[type]||DEF_SLEEP[type]
  if(block&&block.type!=='off'&&block.sh!=null){
    let sh=block.sh,eh=block.eh
    if(eh<=sh)eh+=24
    const commH=(commuteMin||0)/60
    if(commH>0){
      blocks.push({start:sh-commH,end:sh,label:'🚗 Commute to Mill',color:'#0a1208',textColor:'#4ade80',border:'#166534',type:'travel'})
      blocks.push({start:eh,end:eh+commH,label:'🚗 Commute Home',color:'#0a1208',textColor:'#4ade80',border:'#166534',type:'travel'})
    }
    blocks.push({start:sh,end:eh,label:block.type==='day'?'☀ Day Shift':'🌙 Night Shift',color:block.type==='day'?COLORS.day:COLORS.night,textColor:block.type==='day'?'#1a1a00':'#fff',type:'shift'})
  }
  let slStart=sleep.start
  if(slStart<8)slStart+=24
  const slEndN=slStart+sleep.dur
  blocks.push({start:slStart,end:slEndN,label:'💤 Est. Sleep',color:'#1e1035',textColor:'#a78bfa',border:'#4c1d95',type:'sleep'})
  const wakeStart=slEndN,wakeEnd=wakeStart+0.75
  if(wakeR.length>0)blocks.push({start:wakeStart,end:wakeEnd,label:`☀ Wake Routine (${wakeR.length} steps)`,color:'#1c1008',textColor:COLORS.routine,border:COLORS.routine,type:'routine'})
  const bedEnd=slStart,bedStart=slStart-1
  if(bedR.length>0&&bedStart>=8)blocks.push({start:bedStart,end:bedEnd,label:`🌙 Bed Routine (${bedR.length} steps)`,color:'#1c1008',textColor:COLORS.routine,border:COLORS.routine,type:'routine'})
  ;(appts[k]||[]).forEach(a=>{
    const t=parseTime(a.time);if(t==null)return
    let ts=t<8?t+24:t,dur=DUR_MAP[a.duration]??1,travel=TRAVEL_MAP[a.travelTime]??0
    if(travel>0){blocks.push({start:ts,end:ts+travel,label:`🚗 → ${a.title}`,color:'#051520',textColor:'#7dd3fc',border:'#0369a1',type:'travel'});ts+=travel}
    blocks.push({start:ts,end:ts+dur,label:`📅 ${a.title}${a.person?` — ${a.person}`:''}`,color:'#0c2233',textColor:COLORS.appt,border:COLORS.appt,type:'appt'})
    if(travel>0)blocks.push({start:ts+dur,end:ts+dur+travel,label:`🚗 ← ${a.title}`,color:'#051520',textColor:'#7dd3fc',border:'#0369a1',type:'travel'})
  })
  ;(jobs[k]||[]).forEach(j=>{
    const t=parseTime(j.time);if(t==null)return
    let ts=t<8?t+24:t,dur=DUR_MAP[j.duration]??1.5,travel=TRAVEL_MAP[j.travelTime]??0
    if(travel>0){blocks.push({start:ts,end:ts+travel,label:`🚗 → ${j.name}`,color:'#0a1208',textColor:'#4ade80',border:'#166534',type:'travel'});ts+=travel}
    blocks.push({start:ts,end:ts+dur,label:`💼 ${j.name}${j.person?` — ${j.person}`:''}`,color:'#0a1f17',textColor:COLORS.work,border:COLORS.work,type:'job'})
    if(travel>0)blocks.push({start:ts+dur,end:ts+dur+travel,label:`🚗 ← ${j.name}`,color:'#0a1208',textColor:'#4ade80',border:'#166534',type:'travel'})
  })
  if(workouts[k]){
    // Place workout after the later of: wake routine end, or shift end (to avoid overlap)
    const shiftEnd=block&&block.type!=='off'&&block.eh!=null?(block.eh<=block.sh?block.eh+24:block.eh)+((commuteMin||0)/60):8
    const wkStart=Math.max(wakeEnd,shiftEnd)+0.25
    blocks.push({start:wkStart,end:wkStart+1.5,label:'🏋 Workout',color:'#1a0a0a',textColor:COLORS.workout,border:COLORS.workout,type:'workout'})
  }
  if(meals[k]){
    const shiftEnd=block&&block.type!=='off'&&block.eh!=null?(block.eh<=block.sh?block.eh+24:block.eh)+((commuteMin||0)/60):8
    const mpBase=Math.max(wakeEnd,shiftEnd)
    const mpStart=mpBase+(workouts[k]?2:0.5)
    blocks.push({start:mpStart,end:mpStart+1,label:'🍽 Meal Prep',color:'#1a1000',textColor:COLORS.meal,border:COLORS.meal,type:'meal'})
  }
  return blocks.map(b=>({...b,start:Math.max(8,b.start),end:Math.min(32,b.end)})).filter(b=>b.end>b.start).sort((a,b)=>a.start-b.start)
}

function fillGaps(blocks,dayStart=8,dayEnd=32){
  const result=[],sorted=[...blocks].sort((a,b)=>a.start-b.start)
  let cursor=dayStart
  sorted.forEach(b=>{
    if(b.start>cursor+0.25)result.push({start:cursor,end:b.start,type:'open',label:'Open',hrs:+(b.start-cursor).toFixed(1)})
    result.push(b);cursor=Math.max(cursor,b.end)
  })
  if(cursor<dayEnd-0.25)result.push({start:cursor,end:dayEnd,type:'open',label:'Open',hrs:+(dayEnd-cursor).toFixed(1)})
  return result
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S={
  app:{background:'#0a0f1e',minHeight:'100vh',color:'#e2e8f0',fontFamily:'system-ui,sans-serif',padding:'12px 16px 80px'},
  card:(c)=>({background:'#0f172a',borderRadius:10,padding:14,borderLeft:`3px solid ${c}`}),
  inp:{background:'#1e293b',border:'1px solid #334155',borderRadius:6,padding:'8px 10px',color:'#e2e8f0',width:'100%',fontSize:13,boxSizing:'border-box'},
  bp:{background:'#3b82f6',color:'#fff',border:'none',borderRadius:6,padding:'8px 14px',cursor:'pointer',fontWeight:600,fontSize:13},
  bs:{background:'#334155',color:'#e2e8f0',border:'none',borderRadius:6,padding:'6px 10px',cursor:'pointer',fontSize:13},
  bg:{background:'transparent',color:'#64748b',border:'none',cursor:'pointer',fontSize:12,padding:'2px 6px'},
  ov:{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:999},
  mo:{background:'#1e293b',borderRadius:'16px 16px 0 0',padding:'20px 20px 32px',width:'100%',maxWidth:640,maxHeight:'90vh',overflowY:'auto'},
}

// ── Dev Console ───────────────────────────────────────────────────────────────
const LOG_COLORS={log:'#94a3b8',info:'#38bdf8',warn:'#fbbf24',error:'#f87171'}
const LOG_PREFIX={log:'›',info:'ℹ',warn:'⚠',error:'✕'}

function DevConsole(){
  const [open,setOpen]=useState(false)
  const [logs,setLogs]=useState([])
  const bottomRef=useRef(null)

  useEffect(()=>{
    const orig={log:console.log,info:console.info,warn:console.warn,error:console.error}
    const wrap=(type)=>(...args)=>{
      orig[type](...args)
      const msg=args.map(a=>{
        if(a instanceof Error)return`${a.message}${a.stack?'\n'+a.stack:''}`
        if(typeof a==='object'&&a!==null){try{return JSON.stringify(a)}catch{return String(a)}}
        return String(a)
      }).join(' ')
      setLogs(prev=>[...prev.slice(-400),{id:Date.now()+Math.random(),type,msg,time:new Date().toLocaleTimeString('en-US',{hour12:false})}])
    }
    console.log=wrap('log');console.info=wrap('info');console.warn=wrap('warn');console.error=wrap('error')
    return()=>{console.log=orig.log;console.info=orig.info;console.warn=orig.warn;console.error=orig.error}
  },[])

  useEffect(()=>{if(open)bottomRef.current?.scrollIntoView({behavior:'smooth'})},[logs,open])

  const W=300
  return(
    <>
      {/* Slide-in panel */}
      <div style={{position:'fixed',top:0,left:0,bottom:0,width:W,background:'#070d1a',borderRight:'1px solid #1e293b',zIndex:9999,display:'flex',flexDirection:'column',fontFamily:'monospace',fontSize:11,transform:open?'translateX(0)':'translateX(-100%)',transition:'transform 0.2s ease'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',borderBottom:'1px solid #1e293b',background:'#0f172a',flexShrink:0}}>
          <span style={{color:'#38bdf8',fontWeight:700,fontSize:12}}>⌨ Console</span>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setLogs([])} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:11,padding:'2px 6px'}}>clear</button>
            <button onClick={()=>setOpen(false)} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:14,padding:'2px 6px',lineHeight:1}}>✕</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
          {logs.length===0&&<div style={{color:'#334155',padding:'10px 12px'}}>No logs yet.</div>}
          {logs.map(e=>(
            <div key={e.id} style={{padding:'3px 10px',borderBottom:'1px solid #0a0f1e',display:'flex',gap:6,alignItems:'flex-start',color:LOG_COLORS[e.type]}}>
              <span style={{opacity:0.4,flexShrink:0,fontSize:10,marginTop:1,whiteSpace:'nowrap'}}>{e.time}</span>
              <span style={{flexShrink:0}}>{LOG_PREFIX[e.type]}</span>
              <span style={{wordBreak:'break-word',whiteSpace:'pre-wrap'}}>{e.msg}</span>
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>
      </div>

      {/* Toggle tab — always on left edge */}
      <button onClick={()=>setOpen(o=>!o)} style={{position:'fixed',left:open?W:0,top:'50%',transform:'translateY(-50%)',background:'#1e293b',border:'1px solid #334155',borderLeft:open?'1px solid #334155':'none',borderRadius:'0 6px 6px 0',color:'#64748b',padding:'10px 4px',cursor:'pointer',zIndex:10000,fontSize:9,writingMode:'vertical-rl',transition:'left 0.2s ease',letterSpacing:1}}>
        {open?'◀ close':'console ▶'}
      </button>
    </>
  )
}

// ── Stable top-level components (outside App to prevent focus loss) ──────────

function QuickBar({quickTxt,setQuickTxt,quickAdd,quickLoad,quickFb}){
  return(
    <div style={{background:'#0f172a',borderRadius:10,padding:12,marginBottom:14,border:'1px solid #1e3a5f'}}>
      <div style={{fontSize:12,color:'#38bdf8',fontWeight:600,marginBottom:6}}>⚡ Quick Add — just tell me what's happening</div>
      <div style={{display:'flex',gap:8}}>
        <input value={quickTxt} onChange={e=>setQuickTxt(e.target.value)} onKeyDown={e=>e.key==='Enter'&&quickAdd()}
          placeholder='e.g. "Tomorrow stop by Ms. Jackson at 4pm for a quote"'
          style={{...S.inp,flex:1}} disabled={quickLoad}/>
        <button onClick={quickAdd} disabled={quickLoad} style={{...S.bp,minWidth:60,background:quickLoad?'#1e3a5f':'#3b82f6'}}>{quickLoad?'...':'Add'}</button>
      </div>
      {quickFb&&<div style={{fontSize:12,color:'#22c55e',marginTop:5}}>{quickFb}</div>}
    </div>
  )
}

// ── Stable modal components (outside App to prevent focus loss) ───────────────

function TaskEditorModalInner({newTask,setNewTask,doAddTask,onClose}){
  return(
    <div style={S.ov}><div style={S.mo}>
      <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>✅ Add Task</div>
      <input placeholder="What needs doing?" value={newTask.text} onChange={e=>setNewTask(p=>({...p,text:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&doAddTask()} style={{...S.inp,marginBottom:10}} autoFocus/>
      <div style={{marginBottom:10}}>
        <label style={{fontSize:12,color:'#94a3b8'}}>Type</label>
        <div style={{display:'flex',gap:6,marginTop:5,flexWrap:'wrap'}}>
          {[['today','Today only'],['specific','Specific date'],['followup','Follow-up'],['recurring','Recurring']].map(([v,l])=>(
            <button key={v} onClick={()=>setNewTask(p=>({...p,type:v}))} style={{...S.bs,background:newTask.type===v?'#3b82f6':'#1e293b',color:newTask.type===v?'#fff':'#94a3b8'}}>{l}</button>
          ))}
        </div>
      </div>
      {newTask.type==='specific'&&<div style={{marginBottom:10}}><label style={{fontSize:12,color:'#94a3b8'}}>Date</label><input type="date" value={newTask.date} onChange={e=>setNewTask(p=>({...p,date:e.target.value}))} style={{...S.inp,marginTop:4}}/></div>}
      {newTask.type==='followup'&&<div style={{marginBottom:10}}><label style={{fontSize:12,color:'#94a3b8'}}>Not before</label><input type="date" value={newTask.notBefore} onChange={e=>setNewTask(p=>({...p,notBefore:e.target.value}))} style={{...S.inp,marginTop:4}}/><div style={{fontSize:11,color:'#64748b',marginTop:4}}>I'll find the lightest off-day.</div></div>}
      {newTask.type==='recurring'&&(
        <div style={{marginBottom:10}}>
          <div style={{display:'flex',gap:6,marginBottom:8}}>
            {['daily','weekly'].map(v=><button key={v} onClick={()=>setNewTask(p=>({...p,recur:v}))} style={{...S.bs,background:newTask.recur===v?'#3b82f6':'#1e293b',color:newTask.recur===v?'#fff':'#94a3b8'}}>{v}</button>)}
          </div>
          {newTask.recur==='weekly'&&<div style={{display:'flex',gap:4,flexWrap:'wrap'}}>{DSHORT.map((d,i)=><button key={i} onClick={()=>setNewTask(p=>({...p,recurDays:p.recurDays.includes(i)?p.recurDays.filter(x=>x!==i):[...p.recurDays,i]}))} style={{...S.bs,padding:'4px 8px',background:newTask.recurDays.includes(i)?'#3b82f6':'#1e293b',color:newTask.recurDays.includes(i)?'#fff':'#94a3b8'}}>{d}</button>)}</div>}
        </div>
      )}
      <div style={{marginBottom:10}}>
        <label style={{fontSize:12,color:'#94a3b8'}}>Approx. Duration</label>
        <select value={newTask.duration||''} onChange={e=>setNewTask(p=>({...p,duration:e.target.value}))} style={{...S.inp,marginTop:4}}>
          <option value="">Unknown</option>
          {['15 min','30 min','45 min','1 hr','1.5 hr','2 hr','2.5 hr','3 hr','4 hr','All day'].map(d=><option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div style={{marginBottom:14}}>
        <label style={{fontSize:12,color:'#94a3b8'}}>Priority</label>
        <div style={{display:'flex',gap:6,marginTop:5}}>
          {['normal','high'].map(v=><button key={v} onClick={()=>setNewTask(p=>({...p,priority:v}))} style={{...S.bs,background:newTask.priority===v?(v==='high'?'#7f1d1d':'#1e3a5f'):'#1e293b',color:newTask.priority===v?'#fff':'#94a3b8'}}>{v==='high'?'🔴 High':'Normal'}</button>)}
        </div>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button onClick={doAddTask} style={S.bp}>Add Task</button>
        <button onClick={onClose} style={S.bs}>Cancel</button>
      </div>
    </div></div>
  )
}

function JobApptModalInner({modal,setModal,saveModal}){
  if(!modal)return null
  const isJob=modal.type==='job',isAppt=modal.type==='appointment'
  return(
    <div style={S.ov}><div style={S.mo}>
      <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>{isJob?'💼 Add Side Job':isAppt?'📅 Add Appointment':modal.type==='meal'?'🍽 Meal Prep':'🌊 Decompression'}</div>
      {(isJob||isAppt)?(
        <>
          <input placeholder={isJob?'Job type / description':'Title'} value={modal.data[isJob?'name':'title']||''} onChange={e=>setModal(p=>({...p,data:{...p.data,[isJob?'name':'title']:e.target.value}}))} style={{...S.inp,marginBottom:8}} autoFocus/>
          <input placeholder="Time (e.g. 4:00 PM)" value={modal.data.time||''} onChange={e=>setModal(p=>({...p,data:{...p.data,time:e.target.value}}))} style={{...S.inp,marginBottom:8}}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div>
              <label style={{fontSize:11,color:'#94a3b8'}}>Approx. Duration</label>
              <select value={modal.data.duration||''} onChange={e=>setModal(p=>({...p,data:{...p.data,duration:e.target.value}}))} style={{...S.inp,marginTop:3}}>
                <option value="">Unknown</option>
                {['30 min','45 min','1 hr','1.5 hr','2 hr','2.5 hr','3 hr','4 hr','All day'].map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,color:'#94a3b8'}}>One-way Travel</label>
              <select value={modal.data.travelTime||''} onChange={e=>setModal(p=>({...p,data:{...p.data,travelTime:e.target.value}}))} style={{...S.inp,marginTop:3}}>
                <option value="">None / N/A</option>
                {['5 min','10 min','15 min','20 min','30 min','45 min','1 hr','1.5 hr'].map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <input placeholder="Contact name" value={modal.data.person||''} onChange={e=>setModal(p=>({...p,data:{...p.data,person:e.target.value}}))} style={{...S.inp,marginBottom:8}}/>
          <input placeholder="Phone" value={modal.data.contact||''} onChange={e=>setModal(p=>({...p,data:{...p.data,contact:e.target.value}}))} style={{...S.inp,marginBottom:8}}/>
          {isAppt&&<input placeholder="Location" value={modal.data.location||''} onChange={e=>setModal(p=>({...p,data:{...p.data,location:e.target.value}}))} style={{...S.inp,marginBottom:8}}/>}
          {isJob&&<input placeholder="Est. income ($)" type="number" value={modal.data.income||''} onChange={e=>setModal(p=>({...p,data:{...p.data,income:e.target.value}}))} style={{...S.inp,marginBottom:8}}/>}
          <textarea placeholder="Notes" value={modal.data.notes||''} onChange={e=>setModal(p=>({...p,data:{...p.data,notes:e.target.value}}))} style={{...S.inp,height:60,resize:'vertical'}}/>
        </>
      ):(
        <textarea placeholder="Details..." value={modal.data.text||''} onChange={e=>setModal(p=>({...p,data:{...p.data,text:e.target.value}}))} style={{...S.inp,height:100,resize:'vertical'}}/>
      )}
      <div style={{display:'flex',gap:8,marginTop:10}}>
        <button onClick={saveModal} style={S.bp}>Save</button>
        <button onClick={()=>setModal(null)} style={S.bs}>Cancel</button>
      </div>
    </div></div>
  )
}

// ── Fitness helpers (module-level so they're stable across re-renders) ────────
// Per-gym colour map reused in modal + overview
const CAT_COLORS={push:COLORS.day,pull:COLORS.night,legs:COLORS.off,cardio:COLORS.appt,other:COLORS.content}

// Returns {weight, reps, date, loc} for the heaviest logged set of an exercise
function bestLiftEntry(ex,loc,lifts){
  let best=null
  lifts.filter(s=>!loc||loc==='All'||s.location===loc)
    .forEach(s=>s.lifts.forEach(l=>{
      if(l.name&&l.name.toLowerCase()===ex.toLowerCase()&&Number(l.weight)>(best?.weight||0))
        best={weight:Number(l.weight),reps:Number(l.reps)||0,date:s.date,loc:s.location}
    }))
  return best
}

// Map an exercise name back to its category (for legacy sessions without category field)
function exCategory(name){
  for(const[cat,list]of Object.entries(PRESET_EXERCISES))
    if(list.some(e=>e.toLowerCase()===name.toLowerCase()))return cat
  return 'other'
}

// ── WorkoutModal (module-level to prevent remount-on-keystroke focus loss) ────
// When a component is defined *inside* App, React sees a new function reference
// on every App re-render, causing full unmount → remount → focus loss.
// Keeping it here gives it a stable identity across renders.
function WorkoutModal({wf,setWf,saveSession,setShowWorkout,lifts}){
  const [openCat,setOpenCat]=useState('push')
  const added=new Set(wf.lifts.map(l=>l.name).filter(Boolean))
  function addExercise(name,cat){
    if(added.has(name))return
    setWf(p=>({...p,lifts:[...p.lifts,{name,category:cat,sets:'',reps:'',weight:'',duration:'',distance:''}]}))
  }
  function upd(i,field,val){setWf(p=>({...p,lifts:p.lifts.map((x,j)=>j===i?{...x,[field]:val}:x)}))}
  return(
    <div style={S.ov}><div style={S.mo}>
      <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>🏋 Log Workout Session</div>
      {/* Date + Location */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
        <div><label style={{fontSize:12,color:'#94a3b8'}}>Date</label><input type="date" value={wf.date} onChange={e=>setWf(p=>({...p,date:e.target.value}))} style={{...S.inp,marginTop:4}}/></div>
        <div><label style={{fontSize:12,color:'#94a3b8'}}>Location</label><select value={wf.location} onChange={e=>setWf(p=>({...p,location:e.target.value}))} style={{...S.inp,marginTop:4}}>{LOCS.map(l=><option key={l} value={l}>{l}</option>)}</select></div>
      </div>
      {/* 5 vertically stacked accordion categories */}
      <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:14}}>
        {EXERCISE_CATS.map(c=>{
          const isOpen=openCat===c.id,cc=CAT_COLORS[c.id]
          const catCount=wf.lifts.filter(l=>l.category===c.id).length
          return(
            <div key={c.id} style={{borderRadius:8,overflow:'hidden',border:`1px solid ${isOpen?cc:'#1e293b'}`}}>
              <button onClick={()=>setOpenCat(isOpen?null:c.id)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',background:isOpen?'#0f172a':'#1e293b',border:'none',cursor:'pointer',textAlign:'left'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontWeight:700,fontSize:13,color:isOpen?cc:'#e2e8f0'}}>{c.label}</span>
                  {c.sub&&<span style={{fontSize:11,color:'#64748b'}}>{c.sub}</span>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {catCount>0&&<span style={{fontSize:11,color:cc,fontWeight:700}}>{catCount} added</span>}
                  <span style={{color:'#64748b',fontSize:12}}>{isOpen?'▲':'▼'}</span>
                </div>
              </button>
              {isOpen&&(
                <div style={{background:'#0a0f1e',padding:'8px 10px',display:'flex',flexWrap:'wrap',gap:5}}>
                  {PRESET_EXERCISES[c.id].map(name=>{
                    const pr=bestLiftEntry(name,wf.location,lifts),isAdded=added.has(name)
                    return(
                      <button key={name} onClick={()=>addExercise(name,c.id)}
                        style={{padding:'5px 9px',borderRadius:5,border:'none',fontSize:11,cursor:isAdded?'default':'pointer',whiteSpace:'nowrap',
                          background:isAdded?'#14532d':'#1e293b',color:isAdded?'#4ade80':'#cbd5e1'}}>
                        {name}
                        {pr&&!isAdded&&<span style={{color:'#fbbf24',marginLeft:4,fontSize:10}}>·{pr.weight}×{pr.reps}</span>}
                        {isAdded&&<span style={{marginLeft:4,fontSize:10}}>✓</span>}
                      </button>
                    )
                  })}
                  <button onClick={()=>addExercise('',c.id)} style={{padding:'5px 9px',borderRadius:5,border:'1px dashed #334155',fontSize:11,cursor:'pointer',background:'transparent',color:'#64748b'}}>+ Custom</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* Session exercises */}
      {wf.lifts.length===0
        ?<div style={{color:'#475569',fontSize:12,textAlign:'center',padding:'8px 0 12px'}}>Expand a category and tap exercises to add them</div>
        :<div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:'#64748b',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>This Session</div>
          {wf.lifts.map((lft,i)=>{
            const isCardio=lft.category==='cardio'
            const pr=lft.name?bestLiftEntry(lft.name,wf.location,lifts):null
            const cc=CAT_COLORS[lft.category]||COLORS.content
            return(
              <div key={i} style={{background:'#0a0f1e',borderRadius:8,padding:'8px 10px',marginBottom:6,borderLeft:`3px solid ${cc}`}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                  {lft.name
                    ?<div style={{flex:1,fontWeight:600,fontSize:12,color:'#e2e8f0'}}>
                        {lft.name}
                        {pr&&<span style={{fontSize:10,color:'#fbbf24',marginLeft:7,fontWeight:400}}>PR: {pr.weight}lb × {pr.reps}reps</span>}
                      </div>
                    :<input placeholder="Exercise name" autoFocus value={lft.name} onChange={e=>upd(i,'name',e.target.value)} style={{...S.inp,flex:1,fontSize:12}}/>
                  }
                  <button onClick={()=>setWf(p=>({...p,lifts:p.lifts.filter((_,j)=>j!==i)}))} style={{...S.bs,background:'#7f1d1d',padding:'3px 8px',fontSize:11}}>✕</button>
                </div>
                {isCardio
                  ?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:5}}><input placeholder="Duration" type="number" value={lft.duration} onChange={e=>upd(i,'duration',e.target.value)} style={{...S.inp,fontSize:11}}/><span style={{fontSize:10,color:'#64748b',whiteSpace:'nowrap'}}>min</span></div>
                      <div style={{display:'flex',alignItems:'center',gap:5}}><input placeholder="Distance" type="number" step="0.01" value={lft.distance} onChange={e=>upd(i,'distance',e.target.value)} style={{...S.inp,fontSize:11}}/><span style={{fontSize:10,color:'#64748b',whiteSpace:'nowrap'}}>mi</span></div>
                    </div>
                  :<div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:5}}><input placeholder="3" type="number" value={lft.sets} onChange={e=>upd(i,'sets',e.target.value)} style={{...S.inp,fontSize:11}}/><span style={{fontSize:10,color:'#64748b'}}>sets</span></div>
                      <div style={{display:'flex',alignItems:'center',gap:5}}><input placeholder="8" type="number" value={lft.reps} onChange={e=>upd(i,'reps',e.target.value)} style={{...S.inp,fontSize:11}}/><span style={{fontSize:10,color:'#64748b'}}>reps</span></div>
                      <div style={{display:'flex',alignItems:'center',gap:5}}><input placeholder="0" type="number" value={lft.weight} onChange={e=>upd(i,'weight',e.target.value)} style={{...S.inp,fontSize:11}}/><span style={{fontSize:10,color:'#64748b'}}>lbs</span></div>
                    </div>
                }
              </div>
            )
          })}
        </div>
      }
      <textarea placeholder="Session notes..." value={wf.notes} onChange={e=>setWf(p=>({...p,notes:e.target.value}))} style={{...S.inp,height:50,resize:'vertical',marginBottom:12}}/>
      <div style={{display:'flex',gap:8}}>
        <button onClick={saveSession} style={S.bp}>Save Session</button>
        <button onClick={()=>setShowWorkout(false)} style={S.bs}>Cancel</button>
      </div>
    </div></div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState('daily')
  const [wkOff,setWkOff]=useState(0)
  const [selDay,setSelDay]=useState(new Date())
  const [mv,setMv]=useState({y:new Date().getFullYear(),m:new Date().getMonth()})

  // Persisted state (survives refresh / PWA restart)
  const [cycleStart,setCycleStart]=usePersist('cycleStart',()=>{const d=new Date();d.setHours(0,0,0,0);return d.toISOString().split('T')[0]})
  const [cycleOffset,setCycleOffset]=usePersist('cycleOffset',0)  // which day of cycle the start date falls on
  const [cycle,setCycle]=usePersist('cycle',DEF_CYCLE)
  const [commuteMin,setCommuteMin]=usePersist('commuteMin',60)
  const [sd,setSd]=usePersist('sd',{active:false,type:'night',start:'',end:''})
  const [sleepSettings,setSleepSettings]=usePersist('sleepSettings',DEF_SLEEP)
  const [jobs,setJobs]=usePersist('jobs',{})
  const [appts,setAppts]=usePersist('appts',{})
  const [meals,setMeals]=usePersist('meals',{})
  const [decomp,setDecomp]=usePersist('decomp',{})
  const [nutLog,setNutLog]=usePersist('nutLog',{})
  const [nutGoals,setNutGoals]=usePersist('nutGoals',{calories:2800,protein:200,carbs:300,fat:80})
  const [lifts,setLifts]=usePersist('lifts',[])
  const [pipeline,setPipeline]=usePersist('pipeline',[{id:1,title:'Stoicism Under Pressure',stage:'idea'},{id:2,title:'The DuPont Life',stage:'script'}])
  const [wakeR,setWakeR]=usePersist('wakeR',DEF_WAKE)
  const [bedR,setBedR]=usePersist('bedR',DEF_BED)
  const [rchecks,setRchecks]=usePersist('rchecks',{})
  const [tasks,setTasks]=usePersist('tasks',[
    {id:1,text:'Do the dishes',type:'recurring',recur:'daily',date:null,done:{},priority:'normal'},
    {id:2,text:'Call doctor re: respiratory',type:'followup',date:null,notBefore:'',done:{},priority:'high'},
  ])

  // Drag-and-drop refs for reordering jobs / appointments within a day
  const jobDragFrom=useRef(null),jobDragTo=useRef(null)
  const apptDragFrom=useRef(null),apptDragTo=useRef(null)
  const [jobDragOverIdx,setJobDragOverIdx]=useState(null)
  const [apptDragOverIdx,setApptDragOverIdx]=useState(null)

  // Ephemeral UI state
  const [modal,setModal]=useState(null)
  const [showCycle,setShowCycle]=useState(false)
  const [showSD,setShowSD]=useState(false)
  const [showRout,setShowRout]=useState(false)
  const [showTask,setShowTask]=useState(false)
  const [showWorkout,setShowWorkout]=useState(false)
  const [showNutGoals,setShowNutGoals]=useState(false)
  const [showSleepSettings,setShowSleepSettings]=useState(false)
  const [showSettings,setShowSettings]=useState(false)
  const [suggest,setSuggest]=useState(null)
  const [quickTxt,setQuickTxt]=useState('')
  const [quickLoad,setQuickLoad]=useState(false)
  const [quickFb,setQuickFb]=useState('')
  const [newTask,setNewTask]=useState({text:'',type:'today',date:'',notBefore:'',recur:'daily',recurDays:[],priority:'normal',duration:''})
  const [routNewItem,setRoutNewItem]=useState({wake:'',bed:''})
  const [wf,setWf]=useState({date:dkey(new Date()),location:'Home',lifts:[],notes:''})
  const [nf,setNf]=useState({calories:'',protein:'',carbs:'',fat:''})
  const [trendEx,setTrendEx]=useState('')
  const [trendLoc,setTrendLoc]=useState('All')
  const [pipeInput,setPipeInput]=useState('')
  const [expandedOpen,setExpandedOpen]=useState({})
  const [autoSuggestions,setAutoSuggestions]=useState({})
  const [autoLoading,setAutoLoading]=useState(false)

  // Google Calendar
  const gcal=useGoogleCalendar()

  // Cloud restore: if localStorage is empty (new device / cleared cache),
  // pull the last synced snapshot from Vercel Blob and reload to apply it.
  useEffect(()=>{
    const localKeys=Object.keys(exportData()).length
    console.log(`[sync] local data: ${localKeys} keys`)
    if(localKeys>0){console.log('[sync] local present, skipping restore');return}
    console.log('[sync] no local data — fetching from cloud…')
    fetch('/api/sync')
      .then(r=>r.json())
      .then(data=>{
        const cloudKeys=Object.keys(data).length
        console.log(`[sync] cloud data: ${cloudKeys} keys`)
        if(cloudKeys>0){console.log('[sync] restoring from cloud…');importData(data);window.location.reload()}
        else console.log('[sync] cloud is also empty')
      })
      .catch(e=>console.warn('[sync] restore failed:',e.message))
  },[])

  function streak(items,type){
    let s=0,d=new Date();d.setHours(0,0,0,0)
    for(let i=0;i<365;i++){
      const k=dkey(d)
    if(!items.length||!items.every((_,idx)=>rchecks[`${k}-${type}-${idx}`]))break
      s++;d=addDays(d,-1)
    }
    return s
  }
  const wakeStreak=streak(wakeR,'wake'),bedStreak=streak(bedR,'bed')

  async function quickAdd(){
    if(!quickTxt.trim())return
    setQuickLoad(true);setQuickFb('')
    const p=await parseEvent(quickTxt)
    if(!p){setQuickFb("Couldn't parse. Try again.");setQuickLoad(false);setTimeout(()=>setQuickFb(''),4000);return}
    const td=p.date?new Date(p.date+'T12:00:00'):new Date()
    const k=dkey(td)
    if(p.type==='job')setJobs(prev=>({...prev,[k]:[...(prev[k]||[]),{id:Date.now(),name:p.title,person:p.person||'',contact:p.contact||'',income:p.income||'',time:p.time||'',notes:p.notes||'',duration:p.duration||'',travelTime:p.travelTime||''}]}))
    else if(p.type==='appointment')setAppts(prev=>({...prev,[k]:[...(prev[k]||[]),{id:Date.now(),title:p.title,time:p.time||'',person:p.person||'',contact:p.contact||'',location:p.location||'',notes:p.notes||'',duration:p.duration||'',travelTime:p.travelTime||''}]}))
    else if(p.type==='meal')setMeals(prev=>({...prev,[k]:p.notes||p.title}))
    else if(p.type==='decompress')setDecomp(prev=>({...prev,[k]:p.notes||p.title}))
    else setTasks(prev=>[...prev,{id:Date.now(),text:p.title,type:p.date?'specific':'today',date:p.date?k:null,done:{},priority:p.priority||'normal',duration:p.duration||''}])
    const ds=p.date?td.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}):'today'
    setQuickFb(`✓ Added "${p.title}" on ${ds}`)
    setQuickTxt('');setQuickLoad(false)
    setTimeout(()=>setQuickFb(''),4000)
  }

  function tasksForDay(date){
    const k=dkey(date),tod=new Date();tod.setHours(0,0,0,0)
    const d=new Date(date);d.setHours(0,0,0,0)
    return tasks.filter(t=>{
      if(t.type==='today')return sameDay(d,tod)
      if(t.type==='specific'||t.type==='followup')return t.date===k
      if(t.type==='recurring'){
        if(t.recur==='daily')return true
        if(t.recur==='weekly')return t.recurDays&&t.recurDays.includes((d.getDay()+6)%7)
      }
      return false
    })
  }
  function isOD(t){
    const tod=new Date();tod.setHours(0,0,0,0)
    if((t.type==='specific'||t.type==='followup')&&t.date){
      const pts=t.date.split('-').map(Number)
      const dt=new Date(pts[0],pts[1]-1,pts[2])
      return dt<tod&&!t.done[t.date]
    }
    return false
  }
  function toggleDone(id,date){const k=dkey(date);setTasks(p=>p.map(t=>t.id===id?{...t,done:{...t.done,[k]:!t.done[k]}}:t))}
  function doAddTask(){
    if(!newTask.text.trim())return
    const t={...newTask,id:Date.now(),done:{}}
    if(t.type==='followup'){setSuggest({task:t,day:suggestDay(cycle,cycleStart,sd,jobs,tasks,t.notBefore,cycleOffset)});setShowTask(false);return}
    setTasks(p=>[...p,t])
    setNewTask({text:'',type:'today',date:'',notBefore:'',recur:'daily',recurDays:[],priority:'normal',duration:''})
    setShowTask(false)
  }
  function weekAlerts(){
    const tod=new Date();tod.setHours(0,0,0,0);const we=addDays(tod,7)
    return tasks.filter(t=>{
      if(isOD(t))return true
      if((t.type==='followup'||t.type==='specific')&&t.date){
        const pts=t.date.split('-').map(Number),dt=new Date(pts[0],pts[1]-1,pts[2])
        return dt>=tod&&dt<=we&&!t.done[t.date]
      }
      return false
    }).map(t=>({t,type:isOD(t)?'overdue':t.type==='followup'?'followup':'upcoming'}))
  }
  function saveSession(){
    setLifts(p=>[...p,{id:Date.now(),date:wf.date,location:wf.location,lifts:wf.lifts.filter(l=>l.name),notes:wf.notes}])
    setShowWorkout(false)
    setWf({date:dkey(new Date()),location:'Home',lifts:[],notes:''})
  }
  function allExercises(){return[...new Set(lifts.flatMap(s=>s.lifts.map(l=>l.name)).filter(Boolean))]}
  function saveModal(){
    const k=dkey(modal.day)
    if(modal.type==='job')setJobs(p=>({...p,[k]:[...(p[k]||[]),{...modal.data,id:Date.now()}]}))
    else if(modal.type==='appointment')setAppts(p=>({...p,[k]:[...(p[k]||[]),{...modal.data,id:Date.now()}]}))
    else if(modal.type==='meal')setMeals(p=>({...p,[k]:modal.data.text}))
    else if(modal.type==='decompress')setDecomp(p=>({...p,[k]:modal.data.text}))
    setModal(null)
  }
  async function runAutopopulate(date){
    const k=dkey(date),block=effBlock(cycle,cycleStart,sd,date,cycleOffset)
    const tlBlocks=buildTimeline(block,sleepSettings,appts,jobs,{[k]:lifts.some(s=>s.date===k)?true:null},meals,wakeR,bedR,k,commuteMin)
    const openSlots=fillGaps(tlBlocks).filter(b=>b.type==='open')
    if(!openSlots.length)return
    setAutoLoading(true)
    const result=await autopopulateDay({block,openSlots,jobs:jobs[k]||[],appts:appts[k]||[],tasks:tasksForDay(date),wakeR,bedR,date})
    if(result)setAutoSuggestions(p=>({...p,[k]:result}))
    setAutoLoading(false)
  }

  const allRevenue=Object.values(jobs).flat().reduce((s,j)=>s+(Number(j.income)||0),0)
  const odCount=tasks.filter(isOD).length

  // ── Google Calendar sync for selected day ─────────────────────────────────
  async function syncDayToGcal(date){
    const k=dkey(date),block=effBlock(cycle,cycleStart,sd,date,cycleOffset)
    await gcal.syncDay({
      date:k,block,
      jobs:jobs[k]||[],
      appts:appts[k]||[],
      tasks:tasksForDay(date),
      commuteMin,
    })
  }

  // QuickBar is defined at module level (below) to prevent focus loss on re-render

  // ── Timeline ──────────────────────────────────────────────────────────────
  function DailyTimeline({date}){
    const k=dkey(date),block=effBlock(cycle,cycleStart,sd,date,cycleOffset)
    const tlBlocks=buildTimeline(block,sleepSettings,appts,jobs,{[k]:lifts.some(s=>s.date===k)?true:null},meals,wakeR,bedR,k,commuteMin)
    const withGaps=fillGaps(tlBlocks)
    const suggestions=autoSuggestions[k]||[]
    const SUG_COLORS={task:COLORS.todo,workout:COLORS.workout,meal:COLORS.meal,decompress:COLORS.decompress,content:COLORS.content,errand:COLORS.appt}
    return(
      <div style={{...S.card(COLORS.appt)}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
          <div style={{fontWeight:700,fontSize:13,color:COLORS.appt}}>🗓 Daily Schedule</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button onClick={()=>runAutopopulate(date)} disabled={autoLoading} style={{...S.bp,fontSize:11,padding:'3px 10px',background:autoLoading?'#1e3a5f':'#7c3aed',minWidth:110}}>{autoLoading?'⏳ Thinking...':'✨ Autopopulate'}</button>
            {gcal.isConnected&&(
              <button onClick={()=>syncDayToGcal(date)} disabled={gcal.syncing} style={{...S.bp,fontSize:11,padding:'3px 10px',background:gcal.syncing?'#1e3a5f':gcal.syncStatus==='synced'?'#166534':gcal.syncStatus==='error'?'#7f1d1d':'#0369a1'}}>
                {gcal.syncing?'⏳ Syncing...':gcal.syncStatus==='synced'?'✓ Synced':gcal.syncStatus==='error'?'✗ Error':'📅 → GCal'}
              </button>
            )}
            <button onClick={()=>setShowSleepSettings(true)} style={{...S.bs,fontSize:11,padding:'3px 8px'}}>💤</button>
          </div>
        </div>
        <div style={{fontSize:11,color:'#475569',marginBottom:8}}>8:00 AM → 8:00 AM next day</div>
        {suggestions.length>0&&(
          <div style={{background:'#130a2a',border:'1px solid #7c3aed',borderRadius:8,padding:10,marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <div style={{fontSize:12,color:'#a78bfa',fontWeight:700}}>✨ AI-Suggested Schedule</div>
              <button onClick={()=>setAutoSuggestions(p=>({...p,[k]:[]}))} style={{...S.bg,fontSize:11}}>Clear</button>
            </div>
            {suggestions.map((s,i)=>{
              const c=SUG_COLORS[s.type]||'#64748b'
              return(
                <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'5px 0',borderBottom:i<suggestions.length-1?'1px solid #1e1035':'none'}}>
                  <span style={{fontSize:11,color:'#7c3aed',minWidth:60,marginTop:1}}>{s.time}</span>
                  <div style={{flex:1}}>
                    <span style={{fontSize:12,color:c,fontWeight:600}}>{s.label}</span>
                    {s.duration&&<span style={{fontSize:10,color:'#475569',marginLeft:6}}>~{s.duration}</span>}
                    {s.notes&&<div style={{fontSize:11,color:'#64748b',marginTop:1}}>{s.notes}</div>}
                  </div>
                  <button onClick={()=>{
                    const k2=dkey(date)
                    if(s.type==='task'||s.type==='errand')setTasks(p=>[...p,{id:Date.now(),text:s.label,type:'specific',date:k2,done:{},priority:'normal',duration:s.duration||''}])
                    else if(s.type==='meal')setMeals(p=>({...p,[k2]:s.label+(s.notes?' — '+s.notes:'')}))
                    else if(s.type==='decompress')setDecomp(p=>({...p,[k2]:s.label+(s.notes?' — '+s.notes:'')}))
                    else if(s.type==='workout')setShowWorkout(true)
                    else if(s.type==='content')setTasks(p=>[...p,{id:Date.now(),text:'📹 '+s.label,type:'specific',date:k2,done:{},priority:'normal',duration:s.duration||''}])
                    setAutoSuggestions(p=>({...p,[k]:p[k].filter((_,j)=>j!==i)}))
                  }} style={{...S.bs,fontSize:10,padding:'2px 8px',background:'#1e1035',color:'#a78bfa',border:'1px solid #7c3aed',whiteSpace:'nowrap'}}>+ Add</button>
                </div>
              )
            })}
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',gap:3}}>
          {withGaps.map((b,i)=>{
            const key=`${k}-${i}`,hrs=+(b.end-b.start).toFixed(1)
            if(b.type==='open'){
              const expanded=expandedOpen[key]
              return(
                <div key={i}>
                  <div onClick={()=>setExpandedOpen(p=>({...p,[key]:!p[key]}))} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',background:'#0a0f1e',borderRadius:6,cursor:'pointer',border:'1px dashed #1e3a5f'}}>
                    <span style={{color:'#22c55e',fontSize:12}}>{expanded?'▾':'▸'}</span>
                    <span style={{fontSize:12,color:'#475569',flex:1}}>🟢 Open — {hrs} hr{hrs!==1?'s':''}</span>
                    <span style={{fontSize:11,color:'#334155'}}>{fmt12(b.start)} – {fmt12(b.end)}</span>
                  </div>
                  {expanded&&(
                    <div style={{background:'#070c18',borderRadius:'0 0 6px 6px',padding:'6px 12px',marginTop:-3,border:'1px dashed #1e3a5f',borderTop:'none'}}>
                      {Array.from({length:Math.ceil(hrs)},(_,hi)=>{
                        const h=b.start+hi;if(h>=b.end)return null
                        return(<div key={hi} style={{display:'flex',gap:8,alignItems:'center',padding:'2px 0',borderBottom:'1px solid #0f172a'}}><span style={{fontSize:11,color:'#334155',minWidth:50}}>{fmt12(h)}</span><span style={{fontSize:11,color:'#1e3a5f'}}>—</span></div>)
                      })}
                    </div>
                  )}
                </div>
              )
            }
            return(
              <div key={i} style={{display:'flex',alignItems:'stretch',gap:6}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',minWidth:42}}>
                  <span style={{fontSize:10,color:'#475569',whiteSpace:'nowrap'}}>{fmt12(b.start)}</span>
                  <div style={{flex:1,width:2,background:b.border||b.color,opacity:0.4,minHeight:8}}/>
                </div>
                <div style={{flex:1,background:b.color,border:`1px solid ${b.border||b.color}`,borderRadius:7,padding:'6px 10px',marginBottom:1}}>
                  <div style={{fontWeight:600,fontSize:12,color:b.textColor||'#e2e8f0'}}>{b.label}</div>
                  <div style={{fontSize:10,color:b.textColor?b.textColor+'99':'#64748b',marginTop:1}}>{fmt12(b.start)} – {fmt12(b.end)} · {hrs} hr{hrs!==1?'s':''}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── SBadge ────────────────────────────────────────────────────────────────
  function SBadge({b}){
    if(!b)return null
    const c=b.type==='off'?COLORS.off:b.type==='day'?COLORS.day:COLORS.night
    const lbl=b.type==='off'?'OFF':b.type==='day'?`☀ ${fmt12(b.sh)}–${fmt12(b.eh)}`:`🌙 ${fmt12(b.sh)}–${fmt12(b.eh)}`
    return<span style={{background:c,color:b.type==='day'?'#1a1a00':'#fff',borderRadius:4,padding:'1px 7px',fontSize:11,fontWeight:700}}>{lbl}{b.isSD?' 🔧':''}</span>
  }

  // ── Daily View ────────────────────────────────────────────────────────────
  function DailyView(){
    const date=selDay,k=dkey(date),block=effBlock(cycle,cycleStart,sd,date,cycleOffset)
    const isToday=sameDay(date,new Date()),dtasks=tasksForDay(date)
    const hi=dtasks.filter(t=>t.priority==='high'),lo=dtasks.filter(t=>t.priority!=='high')
    const nut=nutLog[k]||{},daySessions=lifts.filter(s=>s.date===k)
    return(
      <div>
        {inShutdown(sd,date)&&<div style={{background:'#431407',border:'1px solid #f97316',borderRadius:8,padding:'10px 14px',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><span style={{color:'#f97316',fontWeight:700}}>🔧 SHUTDOWN — </span><span style={{fontSize:13,color:'#fed7aa'}}>{sd.type==='day'?'Day (8a–8p)':'Night (8p–8a)'}{sd.end?` · Ends ${new Date(sd.end).toLocaleDateString()}`:' · Until further notice'}</span></div><button onClick={()=>setSd(p=>({...p,active:false}))} style={{...S.bs,fontSize:11,background:'#7c2d12'}}>End</button></div>}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
          <button onClick={()=>setSelDay(d=>addDays(d,-1))} style={S.bs}>‹</button>
          <span style={{fontWeight:700,fontSize:16}}>{DFULL[(date.getDay()+6)%7]}, {MONTHS[date.getMonth()]} {date.getDate()}{isToday?' · Today':''}</span>
          <button onClick={()=>setSelDay(d=>addDays(d,1))} style={S.bs}>›</button>
          <button onClick={()=>setSelDay(new Date())} style={{...S.bs,marginLeft:4}}>Today</button>
          <SBadge b={block}/>
        </div>

        {/* Tasks */}
        <div style={{...S.card(COLORS.todo),marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:13,color:COLORS.todo}}>✅ General Tasks</div>
            <button onClick={()=>setShowTask(true)} style={{...S.bs,fontSize:11,padding:'3px 8px'}}>+ Add</button>
          </div>
          {dtasks.length===0&&<div style={{color:'#64748b',fontSize:13}}>Clear day.</div>}
          {hi.length>0&&<div style={{fontSize:11,color:COLORS.overdue,fontWeight:700,marginBottom:4}}>▲ HIGH PRIORITY</div>}
          {[...hi,...lo].map(t=>{
            const done=!!(t.done&&t.done[k])
            return(
              <label key={t.id} style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:6,cursor:'pointer'}}>
                <input type="checkbox" checked={done} onChange={()=>toggleDone(t.id,date)} style={{marginTop:2}}/>
                <div style={{flex:1}}>
                  <span style={{fontSize:13,textDecoration:done?'line-through':'none',color:done?'#64748b':t.priority==='high'?COLORS.overdue:'#e2e8f0'}}>{t.text}</span>
                  {t.duration&&<span style={{fontSize:10,color:'#475569',marginLeft:6}}>⏱{t.duration}</span>}
                  {t.type==='recurring'&&<span style={{fontSize:10,color:'#475569',marginLeft:6}}>↻{t.recur}</span>}
                </div>
                <button onClick={e=>{e.preventDefault();setTasks(p=>p.filter(x=>x.id!==t.id))}} style={S.bg}>✕</button>
              </label>
            )
          })}
        </div>

        {/* Appointments + Jobs */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <div style={S.card(COLORS.appt)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:13,color:COLORS.appt}}>📅 Appointments</div>
              <button onClick={()=>setModal({type:'appointment',day:date,data:{}})} style={{...S.bs,fontSize:11,padding:'3px 8px'}}>+ Add</button>
            </div>
            {(appts[k]||[]).length===0&&<div style={{color:'#64748b',fontSize:13}}>None</div>}
            {(appts[k]||[]).map((a,idx)=>(
              <div key={a.id}
                draggable
                onDragStart={()=>{apptDragFrom.current=idx;apptDragTo.current=idx}}
                onDragEnter={()=>{apptDragTo.current=idx;setApptDragOverIdx(idx)}}
                onDragOver={e=>e.preventDefault()}
                onDragLeave={()=>setApptDragOverIdx(null)}
                onDragEnd={()=>{
                  const from=apptDragFrom.current,to=apptDragTo.current
                  if(from!==null&&to!==null&&from!==to)setAppts(p=>{const arr=[...(p[k]||[])];const[m]=arr.splice(from,1);arr.splice(to,0,m);return{...p,[k]:arr}})
                  apptDragFrom.current=null;apptDragTo.current=null;setApptDragOverIdx(null)
                }}
                style={{background:'#1e293b',borderRadius:6,padding:'6px 8px',marginBottom:5,fontSize:12,cursor:'grab',outline:apptDragOverIdx===idx?'2px dashed '+COLORS.appt:'none'}}>
                <div style={{fontWeight:700}}>{a.time&&<span style={{color:COLORS.appt,marginRight:5}}>{a.time}</span>}{a.title}</div>
                {a.person&&<div style={{color:'#94a3b8'}}>{a.person}{a.contact&&` · ${a.contact}`}</div>}
                {(a.duration||a.travelTime)&&<div style={{color:'#475569',fontSize:11}}>{a.duration&&`⏱ ${a.duration}`}{a.duration&&a.travelTime&&' · '}{a.travelTime&&`🚗 ${a.travelTime} each way`}</div>}
              </div>
            ))}
          </div>
          <div style={S.card(COLORS.work)}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:13,color:COLORS.work}}>💼 Side Jobs</div>
              <button onClick={()=>setModal({type:'job',day:date,data:{}})} style={{...S.bs,fontSize:11,padding:'3px 8px'}}>+ Add</button>
            </div>
            {(jobs[k]||[]).length===0&&<div style={{color:'#64748b',fontSize:13}}>None</div>}
            {(jobs[k]||[]).map((j,idx)=>(
              <div key={j.id}
                draggable
                onDragStart={()=>{jobDragFrom.current=idx;jobDragTo.current=idx}}
                onDragEnter={()=>{jobDragTo.current=idx;setJobDragOverIdx(idx)}}
                onDragOver={e=>e.preventDefault()}
                onDragLeave={()=>setJobDragOverIdx(null)}
                onDragEnd={()=>{
                  const from=jobDragFrom.current,to=jobDragTo.current
                  if(from!==null&&to!==null&&from!==to)setJobs(p=>{const arr=[...(p[k]||[])];const[m]=arr.splice(from,1);arr.splice(to,0,m);return{...p,[k]:arr}})
                  jobDragFrom.current=null;jobDragTo.current=null;setJobDragOverIdx(null)
                }}
                style={{background:'#1e293b',borderRadius:6,padding:'6px 8px',marginBottom:5,fontSize:12,cursor:'grab',outline:jobDragOverIdx===idx?'2px dashed '+COLORS.work:'none'}}>
                <div style={{fontWeight:700}}>{j.time&&<span style={{color:COLORS.work,marginRight:5}}>{j.time}</span>}{j.name}</div>
                <div style={{color:'#94a3b8'}}>{j.person}{j.contact&&` · ${j.contact}`}</div>
                {(j.duration||j.travelTime)&&<div style={{color:'#475569',fontSize:11}}>{j.duration&&`⏱ ${j.duration}`}{j.duration&&j.travelTime&&' · '}{j.travelTime&&`🚗 ${j.travelTime} each way`}</div>}
                {j.income&&<div style={{color:COLORS.work}}>Est. ${j.income}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Workout Overview */}
        <div style={{...S.card(COLORS.workout),marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:13,color:COLORS.workout}}>🏋 Workouts</div>
            <button onClick={()=>{setWf(p=>({...p,date:k}));setShowWorkout(true)}} style={{...S.bs,fontSize:11,padding:'3px 8px'}}>+ Log</button>
          </div>
          {daySessions.length===0
            ?<div style={{color:'#64748b',fontSize:13}}>No sessions logged.</div>
            :daySessions.map((s,si)=>(
              <div key={si} style={{background:'#1e293b',borderRadius:6,padding:'7px 10px',marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  <span style={{background:COLORS.workout+'33',color:COLORS.workout,borderRadius:4,padding:'1px 8px',fontSize:11,fontWeight:700}}>{s.location}</span>
                  {s.notes&&<span style={{fontSize:11,color:'#64748b'}}>{s.notes}</span>}
                </div>
                {(s.lifts||[]).length===0
                  ?<div style={{color:'#475569',fontSize:12}}>No exercises recorded.</div>
                  :<div style={{display:'flex',flexDirection:'column',gap:3}}>
                    {(s.lifts||[]).map((l,li)=>{
                      const cat=exCategory(l.name||'')
                      const catColor=CAT_COLORS[cat]||COLORS.workout
                      return(
                        <div key={li} style={{display:'flex',alignItems:'center',gap:8,fontSize:12}}>
                          <span style={{width:8,height:8,borderRadius:2,background:catColor,display:'inline-block',flexShrink:0}}/>
                          <span style={{color:'#e2e8f0',flex:1}}>{l.name||'—'}</span>
                          {cat==='cardio'
                            ?<span style={{color:'#94a3b8',fontSize:11}}>
                                {l.duration?`${l.duration} min`:''}
                                {l.duration&&l.distance?' · ':''}
                                {l.distance?`${l.distance} mi`:''}
                              </span>
                            :<span style={{color:'#94a3b8',fontSize:11}}>
                                {l.sets?`${l.sets}×`:''}
                                {l.reps?`${l.reps} reps`:''}
                                {l.weight?` · ${l.weight} lb`:''}
                              </span>
                          }
                        </div>
                      )
                    })}
                  </div>
                }
              </div>
            ))
          }
        </div>

        {/* Wake + Bed routines */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          {[['☀ Wake',wakeR,'wake'],['🌙 Bed',bedR,'bed']].map(([title,list,type])=>(
            <div key={type} style={S.card(COLORS.routine)}>
              <div style={{fontWeight:700,fontSize:13,color:COLORS.routine,marginBottom:8}}>{title} {type==='wake'&&wakeStreak>0&&<span style={{fontSize:12,color:COLORS.streak}}>🔥{wakeStreak}</span>}{type==='bed'&&bedStreak>0&&<span style={{fontSize:12,color:COLORS.streak}}>🔥{bedStreak}</span>}</div>
              {list.map((item,idx)=>{
                const ck=`${k}-${type}-${idx}`
                return(<label key={idx} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,cursor:'pointer',fontSize:13}}><input type="checkbox" checked={!!rchecks[ck]} onChange={()=>setRchecks(p=>({...p,[ck]:!p[ck]}))}/><span style={{textDecoration:rchecks[ck]?'line-through':'none',color:rchecks[ck]?'#64748b':'#e2e8f0'}}>{item}</span></label>)
              })}
            </div>
          ))}
        </div>

        {/* Nutrition */}
        <div style={{...S.card(COLORS.meal),marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:13,color:COLORS.meal}}>🥗 Nutrition</div>
            <button onClick={()=>{setNf(nutLog[k]||{});setModal({type:'nutrition',day:date,data:{}})}} style={{...S.bs,fontSize:11,padding:'3px 8px'}}>Log</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:6}}>
            {[['Cal','calories','kcal'],['Pro','protein','g'],['Carb','carbs','g'],['Fat','fat','g']].map(([lbl,fld,unit])=>{
              const act=Number(nutLog[k]?.[fld])||0,goal=nutGoals[fld],pct=Math.min(100,Math.round(act/goal*100))
              return(<div key={fld} style={{background:'#0f172a',borderRadius:6,padding:'6px 8px',textAlign:'center'}}>
                <div style={{fontSize:10,color:'#64748b'}}>{lbl}</div>
                <div style={{fontSize:14,fontWeight:700,color:pct>=100?'#22c55e':COLORS.meal}}>{act||'—'}</div>
                <div style={{fontSize:9,color:'#475569'}}>{unit} / {goal}</div>
                <div style={{height:3,background:'#1e293b',borderRadius:2,marginTop:3}}><div style={{height:'100%',width:`${pct}%`,background:pct>=100?'#22c55e':COLORS.meal,borderRadius:2}}/></div>
              </div>)
            })}
          </div>
        </div>

        {/* Timeline */}
        <DailyTimeline date={date}/>
      </div>
    )
  }

  // ── Weekly View ────────────────────────────────────────────────────────────
  function WeeklyView(){
    const dates=weekDates(new Date(),wkOff)
    const alerts=weekAlerts()
    return(
      <div>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
          <button onClick={()=>setWkOff(p=>p-1)} style={S.bs}>‹</button>
          <span style={{fontWeight:700,fontSize:15}}>{MONTHS[dates[0].getMonth()]} {dates[0].getDate()} – {MONTHS[dates[6].getMonth()]} {dates[6].getDate()}</span>
          <button onClick={()=>setWkOff(p=>p+1)} style={S.bs}>›</button>
          <button onClick={()=>setWkOff(0)} style={{...S.bs,marginLeft:4}}>This week</button>
        </div>
        {alerts.length>0&&(
          <div style={{background:'#1a0a0a',border:'1px solid #7f1d1d',borderRadius:8,padding:'10px 14px',marginBottom:14}}>
            <div style={{fontSize:12,color:COLORS.overdue,fontWeight:700,marginBottom:6}}>⚠ Alerts this week</div>
            {alerts.map(({t,type},i)=>(
              <div key={i} style={{fontSize:12,color:type==='overdue'?COLORS.overdue:type==='followup'?COLORS.followup:'#94a3b8',marginBottom:3}}>
                {type==='overdue'?'🔴':type==='followup'?'↩':'📌'} {t.text}{t.date&&` — ${t.date}`}
              </div>
            ))}
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4}}>
          {dates.map((date,i)=>{
            const k=dkey(date),isToday=sameDay(date,new Date()),block=effBlock(cycle,cycleStart,sd,date,cycleOffset)
            const dt=tasksForDay(date),hasOD=dt.some(t=>isOD(t))
            const bc=block?.type==='off'?COLORS.off:block?.type==='day'?COLORS.day:COLORS.night
            return(
              <div key={i} onClick={()=>{setSelDay(date);setTab('daily')}}
                style={{background:isToday?'#1e293b':'#0f172a',borderRadius:8,padding:'8px 6px',cursor:'pointer',border:isToday?'1px solid #38bdf8':hasOD?'1px solid #f43f5e':'1px solid #1e293b',minHeight:90}}>
                <div style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?'#38bdf8':'#94a3b8',marginBottom:4}}>{DSHORT[i]}<br/><span style={{fontSize:13,color:'#e2e8f0'}}>{date.getDate()}</span></div>
                <SBadge b={block}/>
                <div style={{marginTop:4,display:'flex',gap:3,flexWrap:'wrap'}}>
                  {(jobs[k]||[]).length>0&&<span style={{width:6,height:6,borderRadius:'50%',background:COLORS.work,display:'inline-block'}}/>}
                  {(appts[k]||[]).length>0&&<span style={{width:6,height:6,borderRadius:'50%',background:COLORS.appt,display:'inline-block'}}/>}
                  {dt.length>0&&<span style={{width:6,height:6,borderRadius:'50%',background:hasOD?COLORS.overdue:COLORS.todo,display:'inline-block'}}/>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Monthly View ───────────────────────────────────────────────────────────
  function MonthlyView(){
    const today=new Date(),dates=monthDates(mv.y,mv.m)
    return(
      <div>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
          <button onClick={()=>setMv(p=>p.m===0?{y:p.y-1,m:11}:{...p,m:p.m-1})} style={S.bs}>‹</button>
          <span style={{fontWeight:700,fontSize:15}}>{MONTHS[mv.m]} {mv.y}</span>
          <button onClick={()=>setMv(p=>p.m===11?{y:p.y+1,m:0}:{...p,m:p.m+1})} style={S.bs}>›</button>
          <button onClick={()=>setMv({y:today.getFullYear(),m:today.getMonth()})} style={{...S.bs,marginLeft:4}}>Today</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
          {DSHORT.map(d=><div key={d} style={{textAlign:'center',fontSize:11,color:'#64748b',padding:'4px 0'}}>{d}</div>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
          {dates.map((date,i)=>{
            const inM=date.getMonth()===mv.m,isToday=sameDay(date,today)
            const block=effBlock(cycle,cycleStart,sd,date,cycleOffset),k=dkey(date)
            const dt=tasksForDay(date),hasOD=dt.some(t=>isOD(t))
            const dc=inShutdown(sd,date)?'#f97316':block?.type==='day'?COLORS.day:block?.type==='night'?COLORS.night:COLORS.off
            return(
              <div key={i} onClick={()=>{if(inM){setSelDay(date);setTab('daily')}}}
                style={{background:isToday?'#1e293b':inM?'#0f172a':'#070c18',borderRadius:6,padding:'5px 3px',minHeight:56,cursor:inM?'pointer':'default',border:isToday?'1px solid #38bdf8':hasOD?'1px solid #f43f5e':'1px solid transparent',opacity:inM?1:0.35}}>
                <div style={{fontWeight:isToday?700:400,fontSize:12,textAlign:'center',marginBottom:2,color:isToday?'#38bdf8':'#e2e8f0'}}>{date.getDate()}</div>
                <div style={{display:'flex',justifyContent:'center',marginBottom:2}}><span style={{width:7,height:7,borderRadius:'50%',background:dc,display:'inline-block'}}/></div>
                <div style={{display:'flex',flexWrap:'wrap',gap:2,justifyContent:'center'}}>
                  {(jobs[k]||[]).length>0&&<span style={{width:4,height:4,borderRadius:'50%',background:COLORS.work,display:'inline-block'}}/>}
                  {(appts[k]||[]).length>0&&<span style={{width:4,height:4,borderRadius:'50%',background:COLORS.appt,display:'inline-block'}}/>}
                  {dt.length>0&&<span style={{width:4,height:4,borderRadius:'50%',background:hasOD?COLORS.overdue:COLORS.todo,display:'inline-block'}}/>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Trends View ────────────────────────────────────────────────────────────
  function TrendsView(){
    const [trendCat,setTrendCat]=useState('push')
    const exList=allExercises()
    // Exercises to show in table: presets for this category that have been logged,
    // plus any custom exercises logged under this category
    const catExercises=[
      ...PRESET_EXERCISES[trendCat].filter(n=>exList.includes(n)),
      ...exList.filter(n=>!Object.values(PRESET_EXERCISES).flat().includes(n)&&exCategory(n)===trendCat),
    ]
    // Bar chart data for selected exercise
    const chartEx=trendEx||(exList[0]||'')
    const filtered=lifts.filter(s=>trendLoc==='All'||s.location===trendLoc)
      .flatMap(s=>s.lifts.filter(l=>l.name===chartEx).map(l=>({...l,date:s.date,location:s.location})))
      .sort((a,b)=>a.date>b.date?1:-1)
    const maxW=Math.max(...filtered.map(l=>Number(l.weight)||0),1)
    const locColors=[COLORS.off,COLORS.day,COLORS.content,COLORS.appt]
    return(
      <div>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:16}}>📈 Strength Trends</div>
          <button onClick={()=>{setWf({date:dkey(new Date()),location:'Home',lifts:[],notes:''});setShowWorkout(true)}} style={{...S.bp,fontSize:12,padding:'6px 14px'}}>🏋 Log Workout</button>
        </div>

        {/* Horizontal category tabs — same layout as the input modal */}
        <div style={{display:'flex',gap:4,marginBottom:14}}>
          {EXERCISE_CATS.map(c=>{
            const isActive=trendCat===c.id,cc=CAT_COLORS[c.id]
            const logged=PRESET_EXERCISES[c.id].filter(n=>exList.includes(n)).length
            return(
              <button key={c.id} onClick={()=>setTrendCat(c.id)} style={{flex:'1 1 0',minWidth:0,padding:'7px 4px',borderRadius:7,border:'none',cursor:'pointer',textAlign:'center',lineHeight:1.3,
                background:isActive?'#0f172a':'#1e293b',color:isActive?cc:'#94a3b8',
                outline:isActive?`2px solid ${cc}`:'none',fontWeight:700,fontSize:11}}>
                <div>{c.label}</div>
                {c.sub&&<div style={{fontSize:8,fontWeight:400,opacity:0.75,marginTop:1}}>{c.sub}</div>}
                {logged>0&&<div style={{fontSize:9,color:isActive?cc:'#475569',marginTop:2}}>{logged} logged</div>}
              </button>
            )
          })}
        </div>

        {/* PR table — one row per exercise, one column per gym */}
        {catExercises.length===0
          ?<div style={{color:'#64748b',fontSize:13,textAlign:'center',padding:'24px 0',background:'#0f172a',borderRadius:10}}>
              No {EXERCISE_CATS.find(c=>c.id===trendCat)?.label} exercises logged yet.<br/>
              <span style={{fontSize:11}}>Log a session to see PRs here.</span>
            </div>
          :<div style={{background:'#0f172a',borderRadius:10,overflow:'hidden',marginBottom:16}}>
            {/* Column headers */}
            <div style={{display:'grid',gridTemplateColumns:`2fr ${LOCS.map(()=>'1fr').join(' ')}`,gap:2,padding:'7px 12px',background:'#0a0f1e',borderBottom:'1px solid #1e293b'}}>
              <div style={{fontSize:10,color:'#64748b',fontWeight:700}}>Exercise</div>
              {LOCS.map(loc=><div key={loc} style={{fontSize:10,color:'#64748b',fontWeight:700,textAlign:'center'}}>{loc.split(' ')[0]}</div>)}
            </div>
            {catExercises.map((name,i)=>(
              <div key={name} onClick={()=>{setTrendEx(name);setTrendLoc('All')}}
                style={{display:'grid',gridTemplateColumns:`2fr ${LOCS.map(()=>'1fr').join(' ')}`,gap:2,padding:'8px 12px',cursor:'pointer',
                  background:trendEx===name?'#172033':i%2===0?'#0f172a':'#111827',
                  borderLeft:trendEx===name?`3px solid ${CAT_COLORS[trendCat]}`:'3px solid transparent'}}>
                <div style={{fontSize:12,fontWeight:600,color:trendEx===name?CAT_COLORS[trendCat]:'#e2e8f0'}}>{name}</div>
                {LOCS.map(loc=>{
                  const pr=bestLiftEntry(name,loc,lifts)
                  return(
                    <div key={loc} style={{textAlign:'center',fontSize:11}}>
                      {pr
                        ?<span><span style={{fontWeight:700,color:COLORS.workout}}>{pr.weight}</span>{pr.reps>0&&<span style={{color:'#64748b',fontSize:10}}>×{pr.reps}</span>}</span>
                        :<span style={{color:'#334155'}}>—</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        }

        {/* Bar chart for clicked exercise */}
        {trendEx&&filtered.length>0&&(
          <div style={{background:'#0f172a',borderRadius:10,padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap',gap:6}}>
              <div style={{fontSize:13,fontWeight:700,color:'#e2e8f0'}}>{trendEx}</div>
              <select value={trendLoc} onChange={e=>setTrendLoc(e.target.value)} style={{...S.inp,width:'auto',fontSize:11,padding:'4px 8px'}}>
                <option value="All">All Gyms</option>
                {LOCS.map(l=><option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:3,alignItems:'flex-end',height:100}}>
              {filtered.slice(-20).map((l,i)=>{
                const h=Math.max(4,Math.round((Number(l.weight)/maxW)*90))
                const lc=locColors[LOCS.indexOf(l.location)]||COLORS.workout
                return(
                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                    <div style={{fontSize:8,color:'#64748b'}}>{l.weight}</div>
                    <div title={`${l.weight}lb × ${l.reps} reps — ${l.date}`} style={{width:'100%',height:h,background:lc,borderRadius:'2px 2px 0 0'}}/>
                    <div style={{fontSize:7,color:'#475569',transform:'rotate(-45deg)',transformOrigin:'top left',marginTop:2,whiteSpace:'nowrap'}}>{(l.date||'').slice(5)}</div>
                  </div>
                )
              })}
            </div>
            {/* Gym colour legend */}
            <div style={{display:'flex',gap:10,marginTop:10,flexWrap:'wrap'}}>
              {LOCS.map((loc,i)=>(
                <div key={loc} style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'#94a3b8'}}>
                  <div style={{width:8,height:8,borderRadius:2,background:locColors[i]||COLORS.workout}}/>
                  {loc}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Content View ───────────────────────────────────────────────────────────
  function ContentView(){
    return(
      <div>
        <div style={{fontWeight:700,fontSize:16,marginBottom:12}}>📹 YouTube Content Pipeline</div>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <input value={pipeInput} onChange={e=>setPipeInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&pipeInput){setPipeline(p=>[...p,{id:Date.now(),title:pipeInput,stage:'idea'}]);setPipeInput('')}}} placeholder="New video idea..." style={S.inp}/>
          <button onClick={()=>{if(pipeInput){setPipeline(p=>[...p,{id:Date.now(),title:pipeInput,stage:'idea'}]);setPipeInput('')}}} style={S.bp}>Add</button>
        </div>
        <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:8}}>
          {STAGES.map(stage=>(
            <div key={stage} style={{background:'#0f172a',borderRadius:10,padding:10,minWidth:140,flex:'0 0 140px'}}>
              <div style={{fontWeight:700,fontSize:12,color:STAGE_COLORS[stage],marginBottom:8}}>{STAGE_LABELS[stage]}</div>
              {pipeline.filter(v=>v.stage===stage).map(v=>(
                <div key={v.id} style={{background:'#1e293b',borderRadius:6,padding:'6px 8px',marginBottom:6,fontSize:12}}>
                  <div style={{marginBottom:4}}>{v.title}</div>
                  <div style={{display:'flex',gap:4}}>
                    {stage!=='published'&&<button onClick={()=>setPipeline(p=>p.map(x=>{if(x.id!==v.id)return x;const ni=STAGES.indexOf(x.stage)+1;return{...x,stage:ni<STAGES.length?STAGES[ni]:x.stage}}))} style={{...S.bs,fontSize:10,padding:'2px 6px',background:STAGE_COLORS[stage]}}>→</button>}
                    <button onClick={()=>setPipeline(p=>p.filter(x=>x.id!==v.id))} style={{...S.bs,fontSize:10,padding:'2px 6px',background:'#374151'}}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Modals ─────────────────────────────────────────────────────────────────
  function TaskEditorModal(){return<TaskEditorModalInner newTask={newTask} setNewTask={setNewTask} doAddTask={doAddTask} onClose={()=>setShowTask(false)}/>}

  function ModalBox(){
    if(!modal)return null
    if(modal.type==='nutrition'){
      return(
        <div style={S.ov}><div style={S.mo}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>🥗 Log Nutrition</div>
          {[['Calories','calories'],['Protein (g)','protein'],['Carbs (g)','carbs'],['Fat (g)','fat']].map(([lbl,fld])=>(
            <div key={fld} style={{marginBottom:10}}><label style={{fontSize:12,color:'#94a3b8'}}>{lbl}</label><input type="number" value={nf[fld]||''} onChange={e=>setNf(p=>({...p,[fld]:e.target.value}))} style={{...S.inp,marginTop:4}}/><div style={{fontSize:11,color:'#475569',marginTop:2}}>Goal: {nutGoals[fld]}</div></div>
          ))}
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{setNutLog(p=>({...p,[dkey(modal.day)]:nf}));setModal(null)}} style={S.bp}>Save</button>
            <button onClick={()=>setShowNutGoals(true)} style={S.bs}>Edit Goals</button>
            <button onClick={()=>setModal(null)} style={S.bs}>Cancel</button>
          </div>
        </div></div>
      )
    }
    return<JobApptModalInner modal={modal} setModal={setModal} saveModal={saveModal}/>
  }

  function SleepSettingsModal(){
    const [local,setLocal]=useState({...sleepSettings})
    return(
      <div style={S.ov}><div style={S.mo}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>💤 Sleep Settings</div>
        <div style={{fontSize:13,color:'#94a3b8',marginBottom:16}}>Configure estimated sleep window per shift type.</div>
        {[['day','☀ Day Shift'],['night','🌙 Night Shift'],['off','🟢 Off Day']].map(([type,label])=>(
          <div key={type} style={{background:'#0f172a',borderRadius:8,padding:12,marginBottom:10}}>
            <div style={{fontWeight:600,fontSize:13,marginBottom:8,color:type==='day'?COLORS.day:type==='night'?COLORS.night:COLORS.off}}>{label}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div><label style={{fontSize:12,color:'#94a3b8'}}>Sleep start (24hr)</label><input type="number" min={0} max={23} value={local[type].start} onChange={e=>setLocal(p=>({...p,[type]:{...p[type],start:Number(e.target.value)}}))} style={{...S.inp,marginTop:4}}/><div style={{fontSize:11,color:'#475569',marginTop:2}}>{fmt12(local[type].start)}</div></div>
              <div><label style={{fontSize:12,color:'#94a3b8'}}>Duration (hrs)</label><input type="number" min={4} max={12} step={0.5} value={local[type].dur} onChange={e=>setLocal(p=>({...p,[type]:{...p[type],dur:Number(e.target.value)}}))} style={{...S.inp,marginTop:4}}/><div style={{fontSize:11,color:'#475569',marginTop:2}}>Wakes ~{fmt12((local[type].start+local[type].dur)%24)}</div></div>
            </div>
          </div>
        ))}
        <div style={{display:'flex',gap:8,marginTop:4}}>
          <button onClick={()=>{setSleepSettings(local);setShowSleepSettings(false)}} style={S.bp}>Save</button>
          <button onClick={()=>setShowSleepSettings(false)} style={S.bs}>Cancel</button>
        </div>
      </div></div>
    )
  }

  function NutGoalsModal(){
    const [loc,setLoc]=useState({...nutGoals})
    return(
      <div style={S.ov}><div style={S.mo}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>🎯 Nutrition Goals</div>
        {[['Daily Calories','calories'],['Protein (g)','protein'],['Carbs (g)','carbs'],['Fat (g)','fat']].map(([lbl,fld])=>(
          <div key={fld} style={{marginBottom:10}}><label style={{fontSize:12,color:'#94a3b8'}}>{lbl}</label><input type="number" value={loc[fld]} onChange={e=>setLoc(p=>({...p,[fld]:Number(e.target.value)}))} style={{...S.inp,marginTop:4}}/></div>
        ))}
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{setNutGoals(loc);setShowNutGoals(false)}} style={S.bp}>Save</button>
          <button onClick={()=>setShowNutGoals(false)} style={S.bs}>Cancel</button>
        </div>
      </div></div>
    )
  }

  function RoutineEditor(){
    return(
      <div style={S.ov}><div style={S.mo}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:12}}>📋 Edit Routines</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {[['☀ Wake',wakeR,setWakeR,'wake'],['🌙 Bed',bedR,setBedR,'bed']].map(([title,list,setList,key])=>(
            <div key={key}>
              <div style={{fontWeight:600,marginBottom:8}}>{title}</div>
              {list.map((item,i)=>(
                <div key={i} style={{display:'flex',gap:6,marginBottom:6}}>
                  <input value={item} onChange={e=>setList(p=>p.map((x,j)=>j===i?e.target.value:x))} style={{...S.inp,flex:1,fontSize:12}}/>
                  <button onClick={()=>setList(p=>p.filter((_,j)=>j!==i))} style={{...S.bs,background:'#7f1d1d'}}>✕</button>
                </div>
              ))}
              <div style={{display:'flex',gap:6}}>
                <input value={routNewItem[key]} onChange={e=>setRoutNewItem(p=>({...p,[key]:e.target.value}))} placeholder="Add item..." style={{...S.inp,flex:1,fontSize:12}}/>
                <button onClick={()=>{if(routNewItem[key]){setList(p=>[...p,routNewItem[key]]);setRoutNewItem(p=>({...p,[key]:''}));}}} style={S.bp}>+</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={()=>setShowRout(false)} style={{...S.bp,marginTop:16}}>Done</button>
      </div></div>
    )
  }

  function SDEditor(){
    return(
      <div style={S.ov}><div style={S.mo}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>🔧 Shutdown Mode</div>
        <div style={{fontSize:13,color:'#94a3b8',marginBottom:16}}>Overrides your cycle. DuPont resumes automatically after.</div>
        <div style={{marginBottom:10}}>
          <label style={{fontSize:12,color:'#94a3b8'}}>Type</label>
          <div style={{display:'flex',gap:8,marginTop:6}}>
            {['day','night'].map(t=><button key={t} onClick={()=>setSd(p=>({...p,type:t}))} style={{...S.bs,flex:1,background:sd.type===t?(t==='day'?COLORS.day:COLORS.night):'#1e293b',color:sd.type===t?(t==='day'?'#000':'#fff'):'#e2e8f0',fontWeight:sd.type===t?700:400}}>{t==='day'?'☀ Days (8a–8p)':'🌙 Nights (8p–8a)'}</button>)}
          </div>
        </div>
        <div style={{marginBottom:10}}><label style={{fontSize:12,color:'#94a3b8'}}>Start</label><input type="date" value={sd.start} onChange={e=>setSd(p=>({...p,start:e.target.value}))} style={{...S.inp,marginTop:4}}/></div>
        <div style={{marginBottom:16}}><label style={{fontSize:12,color:'#94a3b8'}}>End <span style={{color:'#475569'}}>(blank = until further notice)</span></label><input type="date" value={sd.end} onChange={e=>setSd(p=>({...p,end:e.target.value}))} style={{...S.inp,marginTop:4}}/></div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{setSd(p=>({...p,active:true}));setShowSD(false)}} style={{...S.bp,background:'#ea580c'}}>Activate</button>
          {sd.active&&<button onClick={()=>{setSd(p=>({...p,active:false}));setShowSD(false)}} style={{...S.bs,background:'#7c2d12'}}>End Shutdown</button>}
          <button onClick={()=>setShowSD(false)} style={S.bs}>Cancel</button>
        </div>
      </div></div>
    )
  }

  function CycleEditor(){
    const [lc,setLc]=useState(cycle.map(b=>({...b})))
    const [ls,setLs]=useState(cycleStart)
    const [lCommute,setLCommute]=useState(commuteMin)
    const [lOffset,setLOffset]=useState(cycleOffset)
    function upd(i,f,v){setLc(p=>p.map((b,idx)=>idx===i?{...b,[f]:['days','sh','eh'].includes(f)?(v===''?null:Number(v)):v}:b))}
    // Build a flat list of every day in the current cycle draft for the offset picker
    function cycleOptions(){
      const opts=[];let pos=0
      lc.forEach(b=>{
        const n=Math.max(1,b.days||1)
        for(let i=0;i<n;i++){
          const lbl=n===1?b.label:`${b.label} — day ${i+1} of ${n}`
          opts.push(<option key={pos} value={pos}>{`Day ${pos+1}: ${lbl}`}</option>)
          pos++
        }
      })
      return opts
    }
    return(
      <div style={S.ov}><div style={S.mo}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:12}}>⚙ DuPont Cycle Editor</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <div><label style={{fontSize:12,color:'#94a3b8'}}>Cycle Start Date</label><input type="date" value={ls} onChange={e=>setLs(e.target.value)} style={{...S.inp,marginTop:4}}/></div>
          <div>
            <label style={{fontSize:12,color:'#94a3b8'}}>🚗 Mill Commute (each way)</label>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:4}}>
              <input type="number" min={0} max={180} value={lCommute} onChange={e=>setLCommute(Number(e.target.value))} style={{...S.inp,width:80}}/>
              <span style={{fontSize:13,color:'#94a3b8'}}>min</span>
              {lCommute>0&&<span style={{fontSize:11,color:'#4ade80'}}>({(lCommute/60).toFixed(1)} hr)</span>}
            </div>
            <div style={{fontSize:11,color:'#475569',marginTop:3}}>Shown on timeline before &amp; after each shift</div>
          </div>
        </div>
        {/* Cycle offset: which day of the cycle the start date represents */}
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,color:'#94a3b8'}}>📍 On the start date, I'm on…</label>
          <select value={lOffset} onChange={e=>setLOffset(Number(e.target.value))} style={{...S.inp,marginTop:4,width:'100%'}}>
            {cycleOptions()}
          </select>
          <div style={{fontSize:11,color:'#475569',marginTop:3}}>Use this if your cycle was already in progress when you set the start date — e.g. you were already on day 3 of Night Shift</div>
        </div>
        {lc.map((b,i)=>(
          <div key={i} style={{background:'#0f172a',borderRadius:8,padding:10,marginBottom:8}}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
              <input value={b.label} onChange={e=>upd(i,'label',e.target.value)} style={{...S.inp,width:110}}/>
              <select value={b.type} onChange={e=>upd(i,'type',e.target.value)} style={{...S.inp,width:80}}>{['day','night','off'].map(t=><option key={t} value={t}>{t}</option>)}</select>
              <input type="number" value={b.days} onChange={e=>upd(i,'days',e.target.value)} style={{...S.inp,width:55}} min={1}/>
              {b.type!=='off'&&<><input type="number" value={b.sh??''} onChange={e=>upd(i,'sh',e.target.value)} style={{...S.inp,width:60}} placeholder="Start"/><input type="number" value={b.eh??''} onChange={e=>upd(i,'eh',e.target.value)} style={{...S.inp,width:60}} placeholder="End"/></>}
              <button onClick={()=>setLc(p=>p.filter((_,j)=>j!==i))} style={{...S.bs,background:'#7f1d1d'}}>✕</button>
            </div>
          </div>
        ))}
        <button onClick={()=>setLc(p=>[...p,{label:'New Block',type:'off',days:1,sh:null,eh:null}])} style={{...S.bs,marginBottom:12}}>+ Add Block</button>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{setCycle(lc);setCycleStart(ls);setCommuteMin(lCommute);setCycleOffset(lOffset);setShowCycle(false)}} style={S.bp}>Save</button>
          <button onClick={()=>setShowCycle(false)} style={S.bs}>Cancel</button>
        </div>
      </div></div>
    )
  }

  function SuggestModal(){
    const [ovDate,setOvDate]=useState(''),[mode,setMode]=useState('suggest')
    if(!suggest)return null
    const{task,day}=suggest
    return(
      <div style={S.ov}><div style={S.mo}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>📅 Schedule Follow-up</div>
        <div style={{fontSize:13,color:'#94a3b8',marginBottom:14}}>Task: <span style={{color:'#e2e8f0',fontWeight:600}}>{task.text}</span></div>
        {day&&<div style={{background:'#0f172a',borderRadius:8,padding:12,marginBottom:14}}><div style={{fontSize:12,color:'#94a3b8',marginBottom:4}}>📌 Suggested:</div><div style={{fontWeight:700,fontSize:15}}>{DFULL[(day.getDay()+6)%7]}, {MONTHS[day.getMonth()]} {day.getDate()}</div></div>}
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          {day&&<button onClick={()=>{setTasks(p=>[...p,{...task,date:dkey(day)}]);setSuggest(null)}} style={S.bp}>✓ Looks good</button>}
          <button onClick={()=>setMode('override')} style={S.bs}>Pick different day</button>
          <button onClick={()=>setSuggest(null)} style={S.bs}>Cancel</button>
        </div>
        {(mode==='override'||!day)&&<div><input type="date" value={ovDate} onChange={e=>setOvDate(e.target.value)} style={{...S.inp,marginBottom:8}}/><button onClick={()=>{if(ovDate){const[y,m,d]=ovDate.split('-').map(Number);setTasks(p=>[...p,{...task,date:dkey(new Date(y,m-1,d))}]);setSuggest(null)}}} style={S.bp}>Schedule It</button></div>}
      </div></div>
    )
  }

  // ── Settings Panel (backup/restore + Google Calendar) ────────────────────
  function SettingsPanel(){
    function doExport(){
      const data=exportData()
      const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a')
      a.href=url;a.download=`com-scheduler-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click();URL.revokeObjectURL(url)
    }
    function doImport(e){
      const file=e.target.files?.[0]
      if(!file)return
      const reader=new FileReader()
      reader.onload=ev=>{
        if(importData(ev.target.result))window.location.reload()
        else alert('Import failed — invalid backup file')
      }
      reader.readAsText(file)
    }
    return(
      <div style={S.ov}><div style={S.mo}>
        <div style={{fontWeight:700,fontSize:16,marginBottom:16}}>⚙ Settings</div>

        {/* Google Calendar */}
        <div style={{background:'#0f172a',borderRadius:8,padding:14,marginBottom:16}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:8,color:'#4ade80'}}>📅 Google Calendar</div>
          {gcal.isConnected?(
            <>
              <div style={{fontSize:13,color:'#22c55e',marginBottom:10}}>✓ Connected</div>
              <div style={{fontSize:12,color:'#94a3b8',marginBottom:8}}>Push your daily schedule to Google Calendar. Your phone's native calendar app will show shifts, jobs, and tasks.</div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>syncDayToGcal(selDay)} style={{...S.bp,background:'#0369a1'}}>Sync Today → GCal</button>
                <button onClick={gcal.logout} style={{...S.bs,background:'#7f1d1d'}}>Disconnect</button>
              </div>
            </>
          ):(
            <>
              <div style={{fontSize:12,color:'#94a3b8',marginBottom:12}}>Connect Google Calendar to see your shifts, jobs, and tasks in your phone's native calendar app. Requires a one-time Google sign-in.</div>
              <button onClick={gcal.login} style={{...S.bp,background:'#0369a1',width:'100%'}}>🔗 Connect Google Calendar</button>
              <div style={{fontSize:11,color:'#475569',marginTop:8}}>⚠ You must add VITE_GOOGLE_CLIENT_ID to your .env first. See README.</div>
            </>
          )}
        </div>

        {/* Backup / Restore */}
        <div style={{background:'#0f172a',borderRadius:8,padding:14,marginBottom:16}}>
          <div style={{fontWeight:600,fontSize:14,marginBottom:8,color:'#f59e0b'}}>💾 Backup & Restore</div>
          <div style={{fontSize:12,color:'#94a3b8',marginBottom:10}}>All data lives in your browser's localStorage. Export a backup before clearing browser data.</div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <button onClick={doExport} style={{...S.bs,color:'#f59e0b',border:'1px solid #f59e0b'}}>⬇ Export JSON</button>
            <label style={{...S.bs,cursor:'pointer'}}>⬆ Import JSON<input type="file" accept=".json" onChange={doImport} style={{display:'none'}}/></label>
          </div>
        </div>

        <button onClick={()=>setShowSettings(false)} style={{...S.bp,width:'100%'}}>Done</button>
      </div></div>
    )
  }

  // ── Bottom nav tabs ────────────────────────────────────────────────────────
  const TABS=[['daily','📆','Daily'],['weekly','📅','Weekly'],['monthly','🗓','Monthly'],['trends','📈','Trends'],['gym','🏋','Gym'],['content','📹','Content']]

  return(
    <div style={S.app}>
      <div style={{maxWidth:720,margin:'0 auto'}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:8}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'#38bdf8'}}>The Cost of Meaning</div>
            <div style={{fontSize:12,color:'#64748b'}}>Life Scheduler</div>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button onClick={()=>setShowTask(true)} style={{...S.bs,color:COLORS.todo,border:`1px solid ${COLORS.todo}`}}>✅</button>
            <button onClick={()=>setShowSD(true)} style={{...S.bs,color:sd.active?'#f97316':'#e2e8f0',border:sd.active?'1px solid #f97316':'none'}}>🔧</button>
            <button onClick={()=>setShowRout(true)} style={S.bs}>📋</button>
            <button onClick={()=>setShowCycle(true)} style={S.bs}>⚙</button>
            <button onClick={()=>setShowSettings(true)} style={S.bs}>⋯</button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{background:'#0f172a',borderRadius:8,padding:'8px 14px',marginBottom:14,display:'flex',gap:16,fontSize:13,flexWrap:'wrap',alignItems:'center'}}>
          <span><span style={{color:'#64748b'}}>Income: </span><span style={{color:COLORS.work,fontWeight:700}}>${allRevenue.toLocaleString()}</span></span>
          <span><span style={{color:'#64748b'}}>Tasks: </span><span style={{color:COLORS.todo,fontWeight:700}}>{tasks.length}</span></span>
          {odCount>0&&<span style={{color:COLORS.overdue,fontWeight:700}}>⚠ {odCount} overdue</span>}
          <span><span style={{color:'#64748b'}}>Wake: </span><span style={{color:COLORS.streak,fontWeight:700}}>🔥 {wakeStreak}</span></span>
          <span><span style={{color:'#64748b'}}>Bed: </span><span style={{color:COLORS.streak,fontWeight:700}}>🔥 {bedStreak}</span></span>
          {gcal.isConnected&&<span style={{color:'#4ade80',fontSize:12}}>📅 GCal linked</span>}
          {sd.active&&<span style={{color:'#f97316',fontWeight:700}}>🔧 Shutdown</span>}
        </div>

        {/* Tab content */}
        {tab==='daily'&&<QuickBar quickTxt={quickTxt} setQuickTxt={setQuickTxt} quickAdd={quickAdd} quickLoad={quickLoad} quickFb={quickFb}/>}
        {tab==='daily'&&<DailyView/>}
        {tab==='weekly'&&<WeeklyView/>}
        {tab==='monthly'&&<MonthlyView/>}
        {tab==='trends'&&<TrendsView/>}
        {tab==='content'&&<ContentView/>}
        {tab==='gym'&&<WorkoutPlanner/>}
      </div>

      {/* Bottom nav (mobile-style) */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,background:'#0f172a',borderTop:'1px solid #1e293b',display:'flex',justifyContent:'space-around',padding:'8px 0 calc(8px + env(safe-area-inset-bottom))',zIndex:100}}>
        {TABS.map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{background:'transparent',border:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:2,padding:'4px 8px',color:tab===id?'#38bdf8':'#64748b',fontSize:10,fontWeight:tab===id?700:400}}>
            <span style={{fontSize:20}}>{icon}</span>{label}
          </button>
        ))}
      </div>

      {/* Modals */}
      {showCycle&&<CycleEditor/>}
      {showSD&&<SDEditor/>}
      {showRout&&<RoutineEditor/>}
      {showTask&&<TaskEditorModal/>}
      {showWorkout&&<WorkoutModal wf={wf} setWf={setWf} saveSession={saveSession} setShowWorkout={setShowWorkout} lifts={lifts}/>}
      {showNutGoals&&<NutGoalsModal/>}
      {showSleepSettings&&<SleepSettingsModal/>}
      {showSettings&&<SettingsPanel/>}
      {suggest&&<SuggestModal/>}
      <ModalBox/>
      <DevConsole/>
    </div>
  )
}
