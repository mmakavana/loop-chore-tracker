import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  /** Open/close the modal */
  isOpen: boolean;
  /** Currently chosen avatar (emoji), or null if none yet */
  value: string | null;
  /** Called when the user picks an emoji (closes modal automatically) */
  onChange: (value: string) => void;
  /** Called when the user cancels/closes without changing */
  onClose: () => void;
};

type TabKey = "faces" | "kids" | "animals";

const TABS: { key: TabKey; label: string }[] = [
  { key: "faces", label: "Faces" },
  { key: "kids", label: "Kids" },
  { key: "animals", label: "Animals" },
];

// 1) Friendly faces
const FACES = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🙂", "😊", "😍", "🤩",
  "😎", "🤓", "🤠", "🥳", "🤗", "😴", "😇", "😜", "😛", "😺",
];

// 2) “Kids” — 5 boy-ish and 5 girl-ish cartoon heads (varied skin tones)
const KIDS = [
  "👦🏻", "👦🏽", "👦🏿", "🧒🏼", "🧒🏾", // boys
  "👧🏻", "👧🏽", "👧🏿", "🧒🏻", "🧒🏽",  // girls/mix
];

// 3) Animals (pig, cow, panda, koala, cat, mouse, etc.)
const ANIMALS = [
  "🐷", "🐮", "🐼", "🐨", "🐱",
  "🐭", "🐰", "🐯", "🦊", "🐵",
];

const BANK: Record<TabKey, string[]> = {
  faces: FACES,
  kids: KIDS,
  animals: ANIMALS,
};

export default function AvatarPicker({ isOpen, value, onChange, onClose }: Props) {
  const [tab, setTab] = useState<TabKey>("faces");
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);

  // When opened, default tab to whatever contains the current value (nice UX)
  useEffect(() => {
    if (!isOpen) return;
    const found =
      (value && (Object.keys(BANK) as TabKey[]).find(k => BANK[k].includes(value))) || "faces";
    setTab(found);
  }, [isOpen, value]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isOpen, onClose]);

  // Focus first option when opened for keyboard users
  useEffect(() => {
    if (isOpen) {
      // small timeout so the element exists
      const t = setTimeout(() => firstButtonRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen, tab]);

  const setAndClose = (emoji: string) => {
    onChange(emoji);
  };

  const options = useMemo(() => BANK[tab], [tab]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Choose an avatar" style={styles.backdrop}>
      {/* Inline CSS (scoped via CSS variables) */}
      <style>{css}</style>

      <div className="ap-card" style={styles.card}>
        <header className="ap-header">
          <h3 className="ap-title">Choose an avatar</h3>
          <button className="ap-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>

        {/* Tabs */}
        <div className="ap-tabs" role="tablist" aria-label="Avatar categories">
          {TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`ap-tab ${tab === t.key ? "on" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="ap-grid">
          {options.map((e, i) => (
            <div key={e} className="ap-cell">
              <button
                ref={i === 0 ? firstButtonRef : null}
                className={`ap-emoji ${value === e ? "sel" : ""}`}
                aria-label={`Choose ${e}`}
                onClick={() => setAndClose(e)}
              >
                {e}
              </button>
            </div>
          ))}
        </div>

        <footer className="ap-footer">
          <button className="ap-btn" onClick={onClose}>Cancel</button>
          <button
            className="ap-btn ap-primary"
            onClick={() => (value ? onChange(value) : onClose())}
            title={value ? `Use ${value}` : "Close"}
          >
            {value ? "Use selected" : "Close"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ---------- Inline styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  card: {
    width: "min(680px, 92vw)",
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,.2)",
    padding: "14px 16px",
  },
};

/* ---------- CSS-in-TS (scoped by classnames) ---------- */

const css = `
  .ap-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 8px;
  }
  .ap-title { margin: 0; font-size: 1.1rem; }
  .ap-close {
    border: none; background: transparent; font-size: 1.5rem; line-height: 1;
    cursor: pointer; padding: 4px 8px; border-radius: 6px;
  }
  .ap-close:hover { background: #f3f4f6; }

  .ap-tabs { display: flex; gap: .5rem; padding: 8px 0 10px; }
  .ap-tab {
    border: 1px solid #d9e2ef; background: #f6fbff; color: #0b67d3;
    padding: 8px 10px; border-radius: 8px; cursor: pointer; font-weight: 600;
  }
  .ap-tab.on { background: #0b67d3; color: #fff; border-color: #0b67d3; }
  .ap-tab:focus { outline: 2px solid #0b67d3; outline-offset: 2px; }

  .ap-grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(38px, 1fr));
    gap: .5rem;
    padding: .25rem 0 0;
  }

  .ap-cell { display: flex; justify-content: center; }
  .ap-emoji {
    font-size: 1.75rem; line-height: 1; width: 42px; height: 42px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid #e8e8e8; border-radius: 10px; background: #fff; cursor: pointer;
    transition: box-shadow .15s ease, transform .02s ease;
  }
  .ap-emoji:hover { box-shadow: 0 0 0 2px #bbe3ff; }
  .ap-emoji.sel { box-shadow: 0 0 0 2px #0b67d3; }

  .ap-footer {
    margin-top: 12px; display: flex; justify-content: flex-end; gap: .5rem;
  }
  .ap-btn {
    border: 1px solid #d7d7d7; background: #fff; border-radius: 8px; padding: 8px 12px; cursor: pointer;
  }
  .ap-primary { background: #0b67d3; color: white; border-color: #0b67d3; }
`;
