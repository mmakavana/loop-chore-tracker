import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { addDays, format } from 'date-fns'
import { loadState, saveState } from './storage'
import { Kid, Reward, State, Chore } from './types'
import { isChoreDueOn, monthDays, nextMonth, prevMonth, toISO } from './utils'
import BoardView from './BoardView'
import Reports from './Reports'
import './style.css'

/* ---------- helpers for streak bonus ---------- */

function choresDueForKidOnDate(state: State, kidId: string, dateISO: string): Chore[] {
  return state.chores.filter(ch => ch.assignedKidIds.includes(kidId) && isChoreDueOn(ch, dateISO))
}
function isFullDayDone(state: State, kidId: string, dateISO: string): boolean {
  const due = choresDueForKidOnDate(state, kidId, dateISO)
  if (due.length === 0) return false
  return due.every(ch =>
    state.completions.some(c => c.kidId === kidId && c.choreId === ch.id && c.date === dateISO && c.completed)
  )
}
function consecutiveFullDaysEndingOn(state: State, kidId: string, dateISO: string): number {
  let n = 0
  let d = new Date(dateISO)
  while (true) {
    const iso = toISO(d)
    if (!isFullDayDone(state, kidId, iso)) break
    n++
    d = addDays(d, -1)
  }
  return n
}

/* ---------- actions ---------- */

type Action =
  | { type: 'ADD_KID'; name: string; color?: string; avatarEmoji?: string }
  | { type: 'ADJUST_POINTS_WITH_REASON'; kidId: string; delta: number; reason: string }
  | { type: 'UPDATE_SETTINGS'; dollarsPerPoint?: number; hideCompletedOnBoard?: boolean }
  | { type: 'ADD_CHORE'; chore: Omit<Chore,'id'|'streakByKid'|'order'> }
  | { type: 'DELETE_CHORE'; id: string }
  | { type: 'REORDER_CHORES'; orderedIds: string[] }
  | { type: 'TOGGLE_COMPLETE'; kidId: string; choreId: string; dateISO: string }
  | { type: 'ADD_REWARD'; reward: Omit<Reward,'id'> }
  | { type: 'REDEEM_REWARD'; kidId: string; rewardId: string }
  | { type: 'DELETE_REWARD'; id: string }
  | { type: 'PAYOUT'; kidId: string; period: 'weekly'|'monthly'; startISO: string; endISO: string; points: number }
  | { type: 'RESET_ALL' }
  | { type: 'REPLACE_ALL'; state: State };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_KID': {
      const pastelPool = ['#c9e4ff','#ffe0f2','#e6ffea','#fff3c9','#e7e0ff','#ffdacc']
      const pick = action.color || pastelPool[state.kids.length % pastelPool.length]
      const kid: Kid = { id: nanoid(), name: action.name.trim(), points: 0, color: pick, avatarEmoji: action.avatarEmoji || undefined }
      return { ...state, kids: [...state.kids, kid] }
    }

    case 'ADJUST_POINTS_WITH_REASON': {
      const { kidId, delta, reason } = action
      const kids = state.kids.map(k => k.id===kidId ? { ...k, points: Math.max(0, k.points + delta) } : k)
      const adjustments = [
        { id: nanoid(), kidId, delta, reason: reason.trim() || (delta>0?'+': '-') + 'adjust', timestampISO: new Date().toISOString() },
        ...state.adjustments
      ]
      return { ...state, kids, adjustments }
    }

    case 'UPDATE_SETTINGS': {
      const { dollarsPerPoint, hideCompletedOnBoard } = action
      return { ...state, settings: { ...state.settings,
        ...(dollarsPerPoint !== undefined ? { dollarsPerPoint } : {}),
        ...(hideCompletedOnBoard !== undefined ? { hideCompletedOnBoard } : {}) } }
    }

    case 'ADD_CHORE': {
      const maxOrder = state.chores.reduce((m,c)=>Math.max(m,c.order ?? 0), 0)
      const chore: Chore = { id: nanoid(), ...action.chore, streakByKid: {}, order: maxOrder + 1 }
      return { ...state, chores: [...state.chores, chore] }
    }

    case 'DELETE_CHORE': {
      const chores = state.chores.filter(c => c.id !== action.id)
      const completions = state.completions.filter(c => c.choreId !== action.id)
      return { ...state, chores, completions }
    }

    case 'REORDER_CHORES': {
      const orderMap = new Map<string, number>()
      action.orderedIds.forEach((id, i) => orderMap.set(id, i+1))
      const chores = state.chores
        .map(c => ({ ...c, order: orderMap.get(c.id) ?? c.order ?? 9999 }))
        .sort((a,b) => (a.order ?? 0) - (b.order ?? 0))
      return { ...state, chores }
    }

    case 'TOGGLE_COMPLETE': {
      const { kidId, choreId, dateISO } = action
      const idx = state.completions.findIndex(c => c.kidId === kidId && c.choreId === choreId && c.date === dateISO)
      const completions = [...state.completions]
      let completed = true

      if (idx >= 0) {
        const existing = completions[idx]
        completed = !existing.completed
        if (!completed) completions.splice(idx, 1)
        else completions[idx] = { ...existing, completed }
      } else {
        completions.push({ id: nanoid(), kidId, choreId, date: dateISO, completed: true })
      }

      // Points add/remove for the chore itself
      const chore = state.chores.find(c => c.id === choreId)!
      let kids = state.kids.map(k => {
        if (k.id !== kidId) return k
        const wasChecked = idx >= 0 && state.completions[idx].completed
        if (!wasChecked && completed) return { ...k, points: k.points + chore.points }
        if (wasChecked && !completed) return { ...k, points: Math.max(0, k.points - chore.points) }
        return k
      })

      // Update streakByKid for the chore
      const chores = state.chores.map(ch => {
        if (ch.id !== choreId) return ch
        const sbk = { ...(ch.streakByKid || {}) }
        const yISO = toISO(addDays(new Date(dateISO), -1))
        const didYesterday = state.completions.some(c => c.kidId === kidId && c.choreId === choreId && c.date === yISO && c.completed)
        if (completed) sbk[kidId] = didYesterday ? (sbk[kidId] || 0) + 1 : 1
        else sbk[kidId] = 0
        return { ...ch, streakByKid: sbk }
      })

      // --- 10-day-all-chores streak bonus ---
      // If today is a full-complete day, compute the consecutive run.
      // On 10/20/30... award +5 ONCE per day (tracked in streakBonuses).
      // If unchecking breaks it and a bonus existed for this day, revoke the +5.
      let streakBonuses = [...(state.streakBonuses || [])]
      const fullToday = isFullDayDone({ ...state, completions }, kidId, dateISO)
      const existingBonusForToday = streakBonuses.find(b => b.kidId===kidId && b.dateISO===dateISO)
      if (fullToday) {
        const run = consecutiveFullDaysEndingOn({ ...state, completions }, kidId, dateISO)
        if (run > 0 && run % 10 === 0 && !existingBonusForToday) {
          // award
          const points = 5
          const bonus = { id: nanoid(), kidId, dateISO, streakLength: run, points }
          streakBonuses = [bonus, ...streakBonuses]
          kids = kids.map(k => k.id===kidId ? { ...k, points: k.points + points } : k)
        }
      } else {
        // revoke if a bonus was granted for this date and now it's no longer a full day
        if (existingBonusForToday) {
          const points = existingBonusForToday.points
          streakBonuses = streakBonuses.filter(b => b.id !== existingBonusForToday.id)
          kids = kids.map(k => k.id===kidId ? { ...k, points: Math.max(0, k.points - points) } : k)
        }
      }

      return { ...state, kids, completions, chores, streakBonuses }
    }

    case 'ADD_REWARD': return { ...state, rewards: [...state.rewards, { id: nanoid(), ...action.reward }] }
    case 'DELETE_REWARD': return { ...state, rewards: state.rewards.filter(r => r.id !== action.id) }
    case 'REDEEM_REWARD': {
      // (left as-is)
      return state
    }

    case 'PAYOUT': {
      const dollars = +(action.points * state.settings.dollarsPerPoint).toFixed(2)
      const payout = { id: nanoid(), kidId: action.kidId, period: action.period, startISO: action.startISO, endISO: action.endISO, points: action.points, dollars, timestampISO: new Date().toISOString() }
      return { ...state, payouts: [payout, ...state.payouts] }
    }

    case 'RESET_ALL':
      return {
        kids: [], chores: [], rewards: [], completions: [], payouts: [],
        adjustments: [], streakBonuses: [],
        settings: { dollarsPerPoint: 0.1, hideCompletedOnBoard: true },
        version: 3
      }

    case 'REPLACE_ALL':
      return { version: 3, adjustments: [], streakBonuses: [], ...action.state } as State

    default: return state
  }
}

function usePersistentState() {
  const [state, dispatch] = useReducer(reducer, undefined as any, () => {
    const s = loadState()
    // ensure new arrays exist for older backups
    return { adjustments: [], streakBonuses: [], ...s }
  })
  useEffect(() => { saveState(state) }, [state])
  return [state, dispatch] as const
}

/* ---------- App ---------- */

export default function App() {
  const [state, dispatch] = usePersistentState()
  const [tab, setTab] = useState<'board'|'calendar'|'manage'|'reports'>('board')
  const fileRef = useRef<HTMLInputElement>(null)

  const today = new Date()
  const [ym, setYM] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const days = monthDays(ym.y, ym.m)

  const [selectedKidId, setSelectedKidId] = useState<string | null>(state.kids[0]?.id ?? null)
  useEffect(() => { if (!selectedKidId && state.kids[0]) setSelectedKidId(state.kids[0].id) }, [state.kids, selectedKidId])
  const selectedKid = state.kids.find(k => k.id === selectedKidId) || null

  const dueByDay = useMemo(() => {
    const map: Record<string, Chore[]> = {}
    for (const d of days) {
      const iso = format(d, 'yyyy-MM-dd')
      map[iso] = state.chores
        .filter(ch => selectedKid && ch.assignedKidIds.includes(selectedKid.id) && isChoreDueOn(ch, iso))
        .sort((a,b)=> (a.order ?? 0) - (b.order ?? 0))
    }
    return map
  }, [days, state.chores, selectedKid])

  function handleBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `loop-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }
  function handleRestoreClick() { fileRef.current?.click() }
  function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { const json = JSON.parse(String(reader.result)); if (confirm('Replace ALL current data with this backup?')) dispatch({ type: 'REPLACE_ALL', state: json as State }) }
      catch { alert('That file doesn’t look like a valid backup.') }
      finally { e.target.value = '' }
    }; reader.readAsText(file);
  }

  const isCompleted = (choreId: string, dateISO: string, kidId: string) =>
    state.completions.some(c => c.choreId === choreId && c.date === dateISO && c.kidId === kidId && c.completed)

  // DnD for chores
  const [dragId, setDragId] = useState<string | null>(null)
  function onDragStart(e: React.DragEvent, id: string) { setDragId(id); e.dataTransfer.effectAllowed = 'move' }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragId || dragId === targetId) return
    const ids = state.chores.slice().sort((a,b)=> (a.order ?? 0)-(b.order ?? 0)).map(c=>c.id)
    const from = ids.indexOf(dragId); const to = ids.indexOf(targetId)
    ids.splice(to, 0, ids.splice(from,1)[0])
    dispatch({ type: 'REORDER_CHORES', orderedIds: ids })
    setDragId(null)
  }

  // adjustment helper (asks for reason)
  function adjustWithReason(kidId: string, delta: number) {
    const promptMsg = delta >= 0 ? `Reason for +${delta} points?` : `Reason for ${delta} points?`
    const reason = window.prompt(promptMsg, delta >= 0 ? 'Bonus/Helping out' : 'Behavior deduction')
    if (reason === null) return
    dispatch({ type: 'ADJUST_POINTS_WITH_REASON', kidId, delta, reason: reason.trim() })
  }

  return (
    <div className="container">
      <header className="appbar">
        <h1>Loop</h1>
        <p>Do It. Earn It. Repeat It.</p>
        <nav className="tabs">
          <button className={tab==='board'?'tab on':'tab'} onClick={()=>setTab('board')}>Board</button>
          <button className={tab==='calendar'?'tab on':'tab'} onClick={()=>setTab('calendar')}>Calendar</button>
          <button className={tab==='manage'?'tab on':'tab'} onClick={()=>setTab('manage')}>Manage</button>
          <button className={tab==='reports'?'tab on':'tab'} onClick={()=>setTab('reports')}>Reports</button>
        </nav>
      </header>

      {tab==='board' && (
        <div className="card">
          <BoardView
            state={state}
            onToggle={(kidId, choreId, dateISO)=>dispatch({type:'TOGGLE_COMPLETE', kidId, choreId, dateISO})}
            onToggleHideCompleted={()=>dispatch({type:'UPDATE_SETTINGS', hideCompletedOnBoard: !state.settings.hideCompletedOnBoard})}
          />
        </div>
      )}

      {tab==='calendar' && (
        <div className="card">
          <h2>Calendar</h2>
          <div className="row">
            <label className="lbl">Kid</label>
            <select value={selectedKidId ?? ''} onChange={e=>setSelectedKidId(e.target.value)}>
              <option value="" disabled>Pick a kid</option>
              {state.kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
            <button className="tab" onClick={() => setYM(prevMonth(ym.y, ym.m))}>◀</button>
            <div>{format(new Date(ym.y, ym.m, 1), 'MMMM yyyy')}</div>
            <button className="tab" onClick={() => setYM(nextMonth(ym.y, ym.m))}>▶</button>
          </div>

          {!selectedKid && <p className="muted">Add/select a kid.</p>}
          {selectedKid && (
            <div className="calendar">
              <div className="weekhead">
                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="dow">{d}</div>)}
              </div>
              <div className="monthgrid">
                {days.map(d => {
                  const iso = format(d, 'yyyy-MM-dd')
                  const chores = dueByDay[iso] || []
                  const doneFor = (choreId: string) => isCompleted(choreId, iso, selectedKid.id)
                  return (
                    <div className="daycell" key={iso}>
                      <div className="date">{format(d, 'd')}</div>
                      <div className="list">
                        {chores.length === 0 && <div className="muted small">—</div>}
                        {chores.map(ch => {
                          const done = doneFor(ch.id)
                          return (
                            <label className={`chip ${done ? 'done' : ''}`} key={ch.id}>
                              <span>
                                <input
                                  type="checkbox"
                                  checked={done}
                                  onChange={() => dispatch({ type: 'TOGGLE_COMPLETE', kidId: selectedKid.id, choreId: ch.id, dateISO: iso })}
                                />
                                {ch.title}
                              </span>
                              <span className="points">+{ch.points}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab==='manage' && (
        <>
          <div className="manage-columns">
            {/* Kids */}
            <div className="card">
              <h2>Kids</h2>
              <AddKid onAdd={(name,color,emoji) => dispatch({ type: 'ADD_KID', name, color, avatarEmoji: emoji })} />
              <ul className="listy">
                {state.kids.map(k => (
                  <li key={k.id} className="kid-row">
                    <div className="kid-head">
                      <div className="avatar" style={{background:k.color||'#6ea8fe'}}>{k.avatarEmoji || k.name[0]}</div>
                      <div><b>{k.name}</b> · {k.points} pts</div>
                    </div>
                    <div className="kid-points-buttons">
                      {/* Add with reason */}
                      <button className="small" onClick={()=>adjustWithReason(k.id, +1)}>+1</button>
                      <button className="small" onClick={()=>adjustWithReason(k.id, +5)}>+5</button>
                      <button className="small" onClick={()=>adjustWithReason(k.id, +10)}>+10</button>
                      <button className="small" onClick={()=>adjustWithReason(k.id, +20)}>+20</button>
                      {/* Deduct with reason */}
                      <button className="small" onClick={()=>adjustWithReason(k.id, -1)}>−1</button>
                      <button className="small" onClick={()=>adjustWithReason(k.id, -5)}>−5</button>
                      <button className="small" onClick={()=>adjustWithReason(k.id, -10)}>−10</button>
                      <button className="small" onClick={()=>adjustWithReason(k.id, -20)}>−20</button>
                    </div>
                  </li>
                ))}
                {state.kids.length===0 && <li className="muted">Add your first kid.</li>}
              </ul>
            </div>

            {/* Chores (DnD) */}
            <div className="card">
              <h2>Chores (drag to reorder)</h2>
              <AddChore kids={state.kids} onAdd={(ch) => dispatch({ type: 'ADD_CHORE', chore: ch })} />
              <ul className="listy">
                {state.chores.slice().sort((a,b)=> (a.order ?? 0)-(b.order ?? 0)).map(ch => (
                  <li key={ch.id}
                      draggable
                      onDragStart={(e)=>onDragStart(e,ch.id)}
                      onDragOver={onDragOver}
                      onDrop={(e)=>onDrop(e,ch.id)}
                      className={dragId===ch.id ? 'dragging' : ''}>
                    <div className="drag-handle">⋮⋮</div>
                    <div style={{flex:1}}>
                      <div><b>{ch.title}</b> · {ch.points} pts · {scheduleLabel(ch)}</div>
                      <div className="muted small">to: {ch.assignedKidIds.map(id => state.kids.find(k => k.id===id)?.name).join(', ') || '—'}</div>
                    </div>
                    <button className="danger small" onClick={() => dispatch({ type: 'DELETE_CHORE', id: ch.id })}>Delete</button>
                  </li>
                ))}
                {state.chores.length===0 && <li className="muted">No chores yet.</li>}
              </ul>
            </div>
          </div>

          {/* Rewards */}
          <div className="card">
            <h2>Rewards</h2>
            <AddReward onAdd={(r) => dispatch({ type: 'ADD_REWARD', reward: r })} />
            <ul className="listy">
              {state.rewards.map(r => (<li key={r.id}><div><b>{r.title}</b> · {r.cost} pts</div></li>))}
              {state.rewards.length===0 && <li className="muted">No rewards yet.</li>}
            </ul>
          </div>
        </>
      )}

      {tab==='reports' && (
        <Reports
          state={state}
          onPayout={(kidId, period, startISO, endISO, points)=>
            dispatch({type:'PAYOUT', kidId, period, startISO, endISO, points})
          }
        />
      )}

      <div className="footer row" style={{margin:'12px 0', gap:'8px'}}>
        <button className="small" onClick={handleBackup}>Backup (JSON)</button>
        <button className="small" onClick={handleRestoreClick}>Restore…</button>
        <input ref={fileRef} type="file" accept="application/json" style={{display:'none'}} onChange={handleRestoreFile}/>
        <button className="danger small" onClick={()=>{ if (confirm('Reset everything?')) dispatch({type:'RESET_ALL'})}}>Reset All</button>
      </div>
    </div>
  )
}

/* ------- forms ------- */

function AddKid({ onAdd }: { onAdd: (name: string, color?: string, emoji?: string)=>void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#c9e4ff')
  const [emoji, setEmoji] = useState('')

  return (
    <form
      className="row wrap kid-form"
      onSubmit={e => {
        e.preventDefault()
        if (!name.trim()) return
        onAdd(name, color, emoji.trim() || undefined)
        setName(''); setEmoji('')
      }}
    >
      <input placeholder="Kid name" value={name} onChange={e=>setName(e.target.value)} />
      <input type="color" value={color} onChange={e=>setColor(e.target.value)} title="Column color"/>
      <input placeholder="Emoji (🙂⚽🎨)" value={emoji} onChange={e=>setEmoji(e.target.value)} style={{width:110}} />
      <button type="submit">Add</button>
    </form>
  )
}

function AddChore({ kids, onAdd }: { kids: Kid[]; onAdd: (ch: Omit<Chore,'id'|'streakByKid'|'order'>)=>void }) {
  const [title, setTitle] = useState('')
  const [points, setPoints] = useState(5)
  const [scheduleType, setScheduleType] = useState<'daily'|'weekly'|'custom'>('daily')
  const [daysOfWeek, setDOW] = useState<number[]>([])
  const [customDates, setCustomDates] = useState<string>('')
  const [assigned, setAssigned] = useState<string[]>([])

  function toggleDOW(d: number) { setDOW(prev => prev.includes(d) ? prev.filter(x => x!==d) : [...prev, d]) }

  return (
    <form className="col gap" onSubmit={e => {
      e.preventDefault()
      if (!title.trim() || points <= 0 || assigned.length===0) return
      const schedule =
        scheduleType === 'daily' ? { type: 'daily' as const } :
        scheduleType === 'weekly' ? { type: 'weekly' as const, daysOfWeek } :
        { type: 'custom' as const, dates: customDates.split(',').map(s => s.trim()).filter(Boolean) }
      onAdd({ title: title.trim(), points, schedule, assignedKidIds: assigned })
      setTitle(''); setPoints(5); setScheduleType('daily'); setDOW([]); setCustomDates(''); setAssigned([])
    }}>
      <div className="row">
        <input placeholder="Chore (e.g., Dishes)" value={title} onChange={e=>setTitle(e.target.value)} />
        <input type="number" min={1} style={{width:80}} value={points} onChange={e=>setPoints(parseInt(e.target.value||'0',10))} />
        <select value={scheduleType} onChange={e=>setScheduleType(e.target.value as any)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="custom">Custom dates</option>
        </select>
      </div>
      {scheduleType==='weekly' && (
        <div className="row wrap">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
            <label key={d} className={`pill ${daysOfWeek.includes(i)?'on':''}`}>
              <input type="checkbox" checked={daysOfWeek.includes(i)} onChange={()=>toggleDOW(i)} />
              {d}
            </label>
          ))}
        </div>
      )}
      {scheduleType==='custom' && (
        <input placeholder="YYYY-MM-DD, YYYY-MM-DD, ..." value={customDates} onChange={e=>setCustomDates(e.target.value)} />
      )}
      <div className="row wrap">
        {kids.map(k => (
          <label key={k.id} className={`pill ${assigned.includes(k.id)?'on':''}`}>
            <input type="checkbox" checked={assigned.includes(k.id)} onChange={()=>{
              setAssigned(prev => prev.includes(k.id) ? prev.filter(x=>x!==k.id) : [...prev, k.id])
            }} />
            {k.name}
          </label>
        ))}
      </div>
      <button type="submit">Add Chore</button>
    </form>
  )
}

function AddReward({ onAdd }: { onAdd: (r: Omit<Reward,'id'>)=>void }) {
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState(20)
  return (
    <form className="row" onSubmit={e=>{
      e.preventDefault()
      if (!title.trim() || cost<=0) return
      onAdd({ title: title.trim(), cost })
      setTitle(''); setCost(20)
    }}>
      <input placeholder="Reward (e.g., 1 hr screen time)" value={title} onChange={e=>setTitle(e.target.value)} />
      <input type="number" min={1} style={{width:110}} value={cost} onChange={e=>setCost(parseInt(e.target.value||'0',10))} />
      <button type="submit">Add</button>
    </form>
  )
}

function scheduleLabel(ch: Chore) {
  if (ch.schedule.type==='daily') return 'Daily'
  if (ch.schedule.type==='weekly') {
    const map = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    return `Weekly: ${ch.schedule.daysOfWeek.map(d=>map[d]).join(', ')}`
  }
  return `Custom: ${ch.schedule.dates.length} dates`
}
