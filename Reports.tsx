import React, { useMemo, useState } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { State } from './types'

type Props = {
  state: State
  onPayout: (kidId: string, period: 'weekly'|'monthly', startISO: string, endISO: string, points: number) => void
}

export default function Reports({ state, onPayout }: Props) {
  const kids = state.kids
  const chores = state.chores

  // --- Filters (kid + date range) ---
  const today = new Date()
  const defaultStart = format(addDays(today, -30), 'yyyy-MM-dd')
  const defaultEnd   = format(today, 'yyyy-MM-dd')

  const [kidId, setKidId] = useState<string>('all')
  const [startISO, setStartISO] = useState(defaultStart)
  const [endISO, setEndISO] = useState(defaultEnd)

  const start = parseISO(startISO)
  const end   = parseISO(endISO)

  // Helper maps
  const choreById = useMemo(() => {
    const m = new Map<string, number>()
    for (const ch of chores) m.set(ch.id, ch.points)
    return m
  }, [chores])

  const kidName = (id: string) => kids.find(k => k.id === id)?.name || '—'

  // --- Reduce logs into the filtered window ---
  const adjFiltered = state.adjustments
    .filter(a => (kidId === 'all' || a.kidId === kidId) && between(parseISO(a.timestampISO), start, end))
    .sort((a,b) => b.timestampISO.localeCompare(a.timestampISO))

  const bonusFiltered = state.streakBonuses
    .filter(b => (kidId === 'all' || b.kidId === kidId) && between(parseISO(b.dateISO), start, end))
    .sort((a,b) => b.dateISO.localeCompare(a.dateISO))

  // Chore points earned (from completions) in window
  const completionPoints = useMemo(() => {
    const perKid: Record<string, number> = {}
    for (const c of state.completions) {
      if (!c.completed) continue
      const d = parseISO(c.date)
      if (!between(d, start, end)) continue
      if (kidId !== 'all' && c.kidId !== kidId) continue
      const pts = choreById.get(c.choreId) ?? 0
      perKid[c.kidId] = (perKid[c.kidId] || 0) + pts
    }
    return perKid
  }, [state.completions, startISO, endISO, kidId, choreById, start, end])

  // Manual adjustments totals in window
  const adjustmentsTotal: Record<string, number> = {}
  for (const a of adjFiltered) {
    adjustmentsTotal[a.kidId] = (adjustmentsTotal[a.kidId] || 0) + a.delta
  }

  // Bonus totals in window
  const bonusTotal: Record<string, number> = {}
  for (const b of bonusFiltered) {
    bonusTotal[b.kidId] = (bonusTotal[b.kidId] || 0) + b.points
  }

  // Build summary rows by kid
  const summaryRows = kids
    .filter(k => kidId === 'all' || k.id === kidId)
    .map(k => {
      const choresPts = completionPoints[k.id] || 0
      const adjPts = adjustmentsTotal[k.id] || 0
      const bonusPts = bonusTotal[k.id] || 0
      const net = choresPts + adjPts + bonusPts
      return { kid: k, choresPts, adjPts, bonusPts, net }
    })
    // show highest net first
    .sort((a,b) => b.net - a.net)

  // quick helpers
  function handleMarkPaid(rowKidId: string) {
    const net = summaryRows.find(r => r.kid.id === rowKidId)?.net || 0
    if (net <= 0) { alert('No points in this window.'); return }
    const period: 'weekly'|'monthly' = (window.prompt('Period label (weekly/monthly)?', 'weekly') as any) || 'weekly'
    onPayout(rowKidId, period, startISO, endISO, net)
    alert('Marked paid (record saved in payouts).')
  }

  return (
    <div>
      <h2>Reports</h2>

      {/* Filters */}
      <div className="card" style={{marginBottom: '10px'}}>
        <div className="row wrap" style={{gap:'10px'}}>
          <div className="row" style={{gap:6}}>
            <label>Kid</label>
            <select value={kidId} onChange={e=>setKidId(e.target.value)}>
              <option value="all">All kids</option>
              {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>

          <div className="row" style={{gap:6}}>
            <label>From</label>
            <input type="date" value={startISO} onChange={e=>setStartISO(e.target.value)} />
          </div>

          <div className="row" style={{gap:6}}>
            <label>To</label>
            <input type="date" value={endISO} onChange={e=>setEndISO(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="card" style={{marginBottom: '10px'}}>
        <h3>Summary by Kid</h3>
        <table className="rep">
          <thead>
          <tr>
            <th>Kid</th>
            <th>Chore points</th>
            <th>Adjustments</th>
            <th>Streak bonuses</th>
            <th>Net points</th>
            <th></th>
          </tr>
          </thead>
          <tbody>
          {summaryRows.length === 0 && (
            <tr><td colSpan={6} className="muted">No activity in this window.</td></tr>
          )}
          {summaryRows.map(r => (
            <tr key={r.kid.id}>
              <td>{r.kid.name}</td>
              <td>{r.choresPts}</td>
              <td>{fmtSigned(r.adjPts)}</td>
              <td>+{r.bonusPts}</td>
              <td><b>{r.net}</b></td>
              <td>
                <button className="small" onClick={()=>handleMarkPaid(r.kid.id)}>Mark Paid</button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>

      {/* Adjustments log */}
      <div className="card" style={{marginBottom:'10px'}}>
        <h3>Adjustments (reasons)</h3>
        <table className="rep">
          <thead>
          <tr>
            <th>When</th>
            <th>Kid</th>
            <th>Delta</th>
            <th>Reason</th>
          </tr>
          </thead>
          <tbody>
          {adjFiltered.length === 0 && (
            <tr><td colSpan={4} className="muted">No adjustments in this window.</td></tr>
          )}
          {adjFiltered.map(a => (
            <tr key={a.id}>
              <td>{fmtDateTime(a.timestampISO)}</td>
              <td>{kidName(a.kidId)}</td>
              <td>{fmtSigned(a.delta)}</td>
              <td>{a.reason || '—'}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>

      {/* Streak bonus log */}
      <div className="card">
        <h3>Streak Bonuses</h3>
        <table className="rep">
          <thead>
          <tr>
            <th>Date</th>
            <th>Kid</th>
            <th>Streak</th>
            <th>Points</th>
          </tr>
          </thead>
          <tbody>
          {bonusFiltered.length === 0 && (
            <tr><td colSpan={4} className="muted">No bonuses in this window.</td></tr>
          )}
          {bonusFiltered.map(b => (
            <tr key={b.id}>
              <td>{fmtDate(b.dateISO)}</td>
              <td>{kidName(b.kidId)}</td>
              <td>{b.streakLength} days</td>
              <td>+{b.points}</td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------- utils ------------- */

function between(d: Date, start: Date, end: Date) {
  const t = d.getTime()
  return t >= start.getTime() && t <= end.getTime()
}
function fmtDate(iso: string) {
  return format(parseISO(iso), 'EEE, MMM d')
}
function fmtDateTime(iso: string) {
  return format(parseISO(iso), 'MMM d, yyyy • h:mm a')
}
function fmtSigned(n: number) {
  if (n > 0) return `+${n}`
  if (n < 0) return `${n}`
  return '0'
}
