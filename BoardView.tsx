import React, { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Chore, State } from './types'
import { isChoreDueOn, toISO } from './utils'

export default function BoardView({
  state,
  onToggle,
  onToggleHideCompleted,
}: {
  state: State
  onToggle: (kidId: string, choreId: string, dateISO: string) => void
  onToggleHideCompleted: () => void
}) {
  const todayISO = toISO(new Date())
  const [dateISO, setDateISO] = useState(todayISO)

  const data = useMemo(() => {
    const map: Record<string, Chore[]> = {}
    for (const kid of state.kids) {
      map[kid.id] = state.chores.filter(
        (ch) => ch.assignedKidIds.includes(kid.id) && isChoreDueOn(ch, dateISO)
      )
    }
    return map
  }, [state.kids, state.chores, dateISO])

  const isCompleted = (choreId: string, kidId: string) =>
    state.completions.some(
      (c) => c.choreId === choreId && c.kidId === kidId && c.date === dateISO && c.completed
    )

  return (
    <div className="board">
      <div className="board-toolbar">
        <div className="row">
          <label className="lbl">Date</label>
          <input type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
        </div>
        <div className="row">
          <label className="lbl">Hide completed</label>
          <input
            type="checkbox"
            checked={state.settings.hideCompletedOnBoard}
            onChange={onToggleHideCompleted}
          />
        </div>
        <div className="muted small">{format(new Date(dateISO), 'EEEE, MMM d')}</div>
      </div>

      <div className="columns">
        {state.kids.map((kid) => (
          <div
            className="column"
            key={kid.id}
            style={{ background: (kid.color ?? '#e8efff') + '33' }}
          >
            <div className="col-header">
              <div className="avatar" style={{ background: kid.color ?? '#6ea8fe' }}>
                {initials(kid.name)}
              </div>
              <div className="col-title">
                <div className="name">{kid.name}</div>
                <div className="muted small">Points: {kid.points}</div>
              </div>
            </div>

            <div className="cards">
              {(!data[kid.id] || data[kid.id].length === 0) && (
                <div className="muted small">No chores due</div>
              )}

              {data[kid.id]?.map((ch) => {
                const done = isCompleted(ch.id, kid.id)
                if (state.settings.hideCompletedOnBoard && done) return null
                return (
                  <label key={ch.id} className={`card ${done ? 'done' : ''}`}>
                    <div className="row space">
                      <div className="left">
                        <div className="icon">🧹</div>
                        <div className="title">{ch.title}</div>
                      </div>
                      <div className="points">+{ch.points}</div>
                    </div>

                    <div className="sub muted small">{scheduleLabel(ch)}</div>

                    <div className="row">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => onToggle(kid.id, ch.id, dateISO)}
                      />
                      <span className="muted small">
                        {done ? 'Completed' : 'Mark complete'}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function scheduleLabel(ch: Chore) {
  if (ch.schedule.type === 'daily') return 'Daily'
  if (ch.schedule.type === 'weekly') {
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `Weekly · ${ch.schedule.daysOfWeek.map((d) => map[d]).join(', ')}`
  }
  return `Custom dates`
}

function initials(n: string) {
  return n
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

