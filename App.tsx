declare const require: any;
import React, { useMemo, useState, useEffect } from 'react';

// Your existing views (unchanged)
import BoardView from './BoardView';
import Reports from './Reports';

// Avatar picker you added
import AvatarPicker from './AvatarPicker';

// Try to use your existing storage helpers if present.
// If not, we fall back to localStorage so this file still works drop-in.
let storage: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  storage = require('./storage');
} catch (_) {
  storage = null;
}

type KidLike = {
  id: string;
  name: string;
  emoji?: string;
  avatar?: string; // NEW: we’ll save avatar strings here
  points?: number;
};

type StateLike = {
  kids: KidLike[];
  chores: any[];
  completions: any[];
  adjustments?: any[];
  bonuses?: any[];
  settings?: any;
};

// ------------ Helpers ------------
const LS_KEY = 'loop-state';

function loadState(): StateLike {
  if (storage?.load) return storage.load();
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    return {
      kids: [],
      chores: [],
      completions: [],
      adjustments: [],
      bonuses: [],
      settings: { hideCompletedOnBoard: false },
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return {
      kids: [],
      chores: [],
      completions: [],
      adjustments: [],
      bonuses: [],
      settings: { hideCompletedOnBoard: false },
    };
  }
}

function saveState(s: StateLike) {
  if (storage?.save) {
    storage.save(s);
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  }
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ------------ App ------------
export default function App() {
  // tabs: 'board' | 'calendar' | 'manage' | 'reports'
  const [tab, setTab] = useState<'board' | 'calendar' | 'manage' | 'reports'>('board');

  // app state
  const [state, setState] = useState<StateLike>(() => loadState());

  // persist on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // ---------------- Avatar picker state ----------------
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [editingKidId, setEditingKidId] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<string>('😀'); // default shown in picker

  const kidById = useMemo(
    () => new Map(state.kids.map((k) => [k.id, k])),
    [state.kids]
  );

  // open picker for an existing kid
  function handleOpenAvatarForKid(kidId: string) {
    const k = kidById.get(kidId);
    setPendingAvatar(k?.avatar || k?.emoji || '😀');
    setEditingKidId(kidId);
    setPickerOpen(true);
  }

  // open picker for “new kid” flow
  const [newKidName, setNewKidName] = useState('');
  const [newKidEmoji, setNewKidEmoji] = useState('😀'); // keep your existing emoji
  const [newKidAvatar, setNewKidAvatar] = useState<string | null>(null);
  function handleOpenAvatarForNewKid() {
    setPendingAvatar(newKidAvatar || newKidEmoji || '😀');
    setEditingKidId(null);
    setPickerOpen(true);
  }

  // when a value is picked in the modal
  function handleAvatarPicked(v: string) {
    if (editingKidId) {
      // update existing kid
      setState((s) => {
        const kids = s.kids.map((k) =>
          k.id === editingKidId ? { ...k, avatar: v } : k
        );
        return { ...s, kids };
      });
    } else {
      // just stash for the “Add” flow
      setNewKidAvatar(v);
    }
    setPickerOpen(false);
  }

  // ---------------- Manage: kids CRUD (basic) ----------------
  function handleAddKid() {
    const name = newKidName.trim();
    if (!name) return;

    const k: KidLike = {
      id: uid(),
      name,
      emoji: newKidEmoji || undefined,
      avatar: newKidAvatar || undefined, // save avatar if chosen
      points: 0,
    };

    setState((s) => ({ ...s, kids: [...s.kids, k] }));
    setNewKidName('');
    setNewKidEmoji('😀');
    setNewKidAvatar(null);
  }

  function handleDeleteKid(id: string) {
    setState((s) => ({
      ...s,
      kids: s.kids.filter((k) => k.id !== id),
      // scrub from related arrays if needed (leave as-is if you have logic elsewhere)
      completions: s.completions.filter((c: any) => c.kidId !== id),
      adjustments: (s.adjustments || []).filter((a: any) => a.kidId !== id),
    }));
  }

  // ----------------- Board callbacks (unchanged contracts) -----------------
  const handleToggleCompletion = (kidId: string, choreId: string, dateISO: string) => {
    // delegate to your existing reducer/effects if you have them.
    // For safety, we’ll do a simple toggle here if you have no reducer:
    setState((s) => {
      const key = `${kidId}|${choreId}|${dateISO}`;
      const exists = s.completions.some((c: any) => `${c.kidId}|${c.choreId}|${c.date}` === key);
      const completions = exists
        ? s.completions.filter((c: any) => `${c.kidId}|${c.choreId}|${c.date}` !== key)
        : [...s.completions, { kidId, choreId, date: dateISO }];

      return { ...s, completions };
    });
  };

  const handleToggleHideCompleted = () => {
    setState((s) => ({
      ...s,
      settings: {
        ...(s.settings || {}),
        hideCompletedOnBoard: !(s.settings?.hideCompletedOnBoard ?? false),
      },
    }));
  };

  // payout callback for Reports
  const handlePayout = (kidId: string) => {
    // add your payout logic here
    console.log('Mark paid for', kidId);
  };

  // ----------------- UI -----------------

  return (
    <div className="container">
      {/* Header */}
      <header className="appbar" style={{ background: '#BFEAD9', padding: 20, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '2.5rem', color: 'white', fontWeight: 'bold' }}>Loop</h1>
        <p style={{ margin: '6px 0 18px', fontSize: '1.1rem', color: 'white', fontWeight: 300, letterSpacing: '1px' }}>
          Do It. Earn It. Repeat It.
        </p>

        <nav className="tabs">
          <button className={tab === 'board' ? 'tab on' : 'tab'} onClick={() => setTab('board')}>Board</button>
          <button className={tab === 'calendar' ? 'tab on' : 'tab'} onClick={() => setTab('calendar')}>Calendar</button>
          <button className={tab === 'manage' ? 'tab on' : 'tab'} onClick={() => setTab('manage')}>Manage</button>
          <button className={tab === 'reports' ? 'tab on' : 'tab'} onClick={() => setTab('reports')}>Reports</button>
        </nav>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 1080, margin: '20px auto', padding: '0 16px' }}>
        {tab === 'board' && (
          <div className="card">
            <BoardView
              state={state as any}
              onToggle={handleToggleCompletion}
              onToggleHideCompleted={handleToggleHideCompleted}
            />
          </div>
        )}

        {tab === 'calendar' && (
          <div className="card">
            {/* Keep your existing Calendar view here if you have it.
                Placeholder (to keep app compiling): */}
            <div style={{ padding: 20, color: '#777' }}>Calendar view coming from your existing code.</div>
          </div>
        )}

        {tab === 'manage' && (
          <div className="grid-2">
            {/* Kids */}
            <section className="card">
              <h3>Kids</h3>

              {/* Add new */}
              <div className="row" style={{ gap: '.5rem', alignItems: 'center', marginBottom: 12 }}>
                <input
                  placeholder="Kid name"
                  value={newKidName}
                  onChange={(e) => setNewKidName(e.target.value)}
                />
                {/* Keep emoji if you want */}
                <input
                  style={{ width: 60, textAlign: 'center' }}
                  value={newKidEmoji}
                  onChange={(e) => setNewKidEmoji(e.target.value)}
                />
                <button className="secondary" onClick={handleOpenAvatarForNewKid}>
                  {newKidAvatar ? 'Avatar ✓' : 'Pick Avatar'}
                </button>
                <button onClick={handleAddKid}>Add</button>
              </div>

              {/* Existing kids */}
              {state.kids.length === 0 && (
                <div className="muted">No kids yet.</div>
              )}

              {state.kids.map((k) => (
                <div key={k.id} className="row space" style={{ alignItems: 'center', marginBottom: 8 }}>
                  <div className="left" style={{ gap: '.5rem' }}>
                    {/* Avatar or emoji bubble */}
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        background: '#f5f7fb',
                        border: '1px solid #e2e8f0',
                        fontSize: '1.2rem',
                      }}
                    >
                      {k.avatar || k.emoji || '😀'}
                    </div>
                    <strong>{k.name}</strong>
                  </div>

                  <div className="left" style={{ gap: '.5rem' }}>
                    <button className="secondary" onClick={() => handleOpenAvatarForKid(k.id)}>
                      Change Avatar
                    </button>
                    <button className="danger" onClick={() => handleDeleteKid(k.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </section>

            {/* Rewards (your existing block or placeholder) */}
            <section className="card">
              <h3>Rewards</h3>
              <div className="muted">Keep your existing rewards UI here.</div>
            </section>
          </div>
        )}

        {tab === 'reports' && (
          <div className="card">
            <Reports state={state as any} onPayout={handlePayout} />
          </div>
        )}
      </main>

      {/* ---------- Avatar Picker Modal ---------- */}
      <AvatarPicker
        isOpen={isPickerOpen}
        value={pendingAvatar}
        onChange={(v: string) => handleAvatarPicked(v)}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
