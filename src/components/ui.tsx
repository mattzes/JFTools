"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Planungsmodus } from "@/lib/domain/constants";

// Farbwelt der Planungsmodi (aus den Mockups)
export const MODE_STYLE: Record<Planungsmodus, { bg: string; fg: string; icon: string; label: string }> = {
  keine: { bg: "var(--color-neutral-800)", fg: "var(--color-neutral-300)", icon: "ph-circle", label: "keine" },
  nur_gruppen: { bg: "var(--color-accent-2-800)", fg: "var(--color-accent-2-100)", icon: "ph-users-three", label: "nur_gruppen" },
  a_teil: { bg: "var(--color-accent-800)", fg: "var(--color-accent-100)", icon: "ph-list-numbers", label: "a_teil" },
  a_und_b_teil: { bg: "var(--color-accent)", fg: "#0d0e15", icon: "ph-flag-checkered", label: "a+b" },
};

export function ModeTag({ modus, short }: { modus: Planungsmodus; short?: boolean }) {
  const m = MODE_STYLE[modus];
  return (
    <span className="ph-tag" style={{ background: m.bg, color: m.fg }}>
      <i className={`${modus === "a_und_b_teil" ? "ph-bold" : "ph"} ${m.icon}`} />
      {!short && (modus === "a_und_b_teil" ? "a_und_b_teil" : m.label)}
    </span>
  );
}

export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog">
        <div style={{ display: "flex", alignItems: "center" }}>
          <div className="dialog-title">{title}</div>
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Schließen">
            <i className="ph ph-x" style={{ fontSize: 18 }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="topbar">
      <div style={{ marginRight: "auto" }}>
        <div style={{ font: "600 19px/1.1 var(--font-heading)" }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)", marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div style={{ display: "grid", placeItems: "center", padding: 60, color: "var(--color-neutral-500)" }}>
      <i className="ph ph-circle-notch" style={{ fontSize: 28, animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function Empty({ icon, text, hint }: { icon: string; text: string; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 48, color: "var(--color-neutral-500)", textAlign: "center" }}>
      <i className={`ph ${icon}`} style={{ fontSize: 34, color: "var(--color-neutral-600)" }} />
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-neutral-400)" }}>{text}</div>
      {hint && <div style={{ fontSize: 12 }}>{hint}</div>}
    </div>
  );
}

/* ── Datepicker im eigenen Design (ersetzt das native <input type="date">) ── */
const DP_WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const DP_MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const dpPad = (n: number) => String(n).padStart(2, "0");
const dpISO = (y: number, m: number, d: number) => `${y}-${dpPad(m + 1)}-${dpPad(d)}`;
function dpParse(v?: string | null): { y: number; m: number; d: number } | null {
  const mm = v ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  return mm ? { y: +mm[1], m: +mm[2] - 1, d: +mm[3] } : null;
}

export function DatePicker({
  value,
  onChange,
  className,
  placeholder = "TT.MM.JJJJ",
  clearable = true,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const todayISO = dpISO(now.getFullYear(), now.getMonth(), now.getDate());
  const [view, setView] = useState<{ y: number; m: number }>(() => {
    const s = dpParse(value);
    return s ? { y: s.y, m: s.m } : { y: now.getFullYear(), m: now.getMonth() };
  });

  // Beim Öffnen auf den gewählten Wert (bzw. heute) springen
  useEffect(() => {
    if (!open) return;
    const s = dpParse(value);
    const n = new Date();
    setView(s ? { y: s.y, m: s.m } : { y: n.getFullYear(), m: n.getMonth() });
  }, [open, value]);

  // Positionierung (fixed, mit Flip nach oben, wenn unten kein Platz ist)
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      if (!t) return;
      const ph = popRef.current?.offsetHeight ?? 320;
      const pw = popRef.current?.offsetWidth ?? 268;
      let top = t.bottom + 6;
      if (top + ph > window.innerHeight - 8) {
        top = t.top - ph - 6 >= 8 ? t.top - ph - 6 : Math.max(8, window.innerHeight - ph - 8);
      }
      const left = Math.max(8, Math.min(t.left, window.innerWidth - pw - 8));
      setPos({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // Schließen bei Klick außerhalb / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (popRef.current?.contains(n) || triggerRef.current?.contains(n)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const startWd = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Mo = 0
  const cells: { y: number; m: number; d: number; out: boolean }[] = [];
  for (let i = startWd; i > 0; i--) {
    const d = new Date(view.y, view.m, 1 - i);
    cells.push({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), out: true });
  }
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) cells.push({ y: view.y, m: view.m, d, out: false });
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const d = new Date(last.y, last.m, last.d + 1);
    cells.push({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), out: true });
  }

  const nowY = now.getFullYear();
  const minY = Math.min(nowY - 100, view.y);
  const maxY = Math.max(nowY + 20, view.y);
  const years: number[] = [];
  for (let y = maxY; y >= minY; y--) years.push(y);

  const shift = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`input dp-trigger${className ? ` ${className}` : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? undefined : "dp-ph"}>{value ? fmtDate(value) : placeholder}</span>
        <i className="ph ph-calendar-blank" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            className="dp-pop"
            role="dialog"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? "visible" : "hidden" }}
          >
            <div className="dp-head">
              <button type="button" className="dp-nav" onClick={() => shift(-1)} aria-label="Vorheriger Monat">
                <i className="ph ph-caret-left" />
              </button>
              <div className="dp-selects">
                <select
                  className="dp-sel"
                  value={view.m}
                  onChange={(e) => setView({ ...view, m: Number(e.target.value) })}
                  aria-label="Monat"
                >
                  {DP_MONTHS.map((mn, i) => (
                    <option key={mn} value={i}>{mn}</option>
                  ))}
                </select>
                <select
                  className="dp-sel"
                  value={view.y}
                  onChange={(e) => setView({ ...view, y: Number(e.target.value) })}
                  aria-label="Jahr"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button type="button" className="dp-nav" onClick={() => shift(1)} aria-label="Nächster Monat">
                <i className="ph ph-caret-right" />
              </button>
            </div>
            <div className="dp-grid">
              {DP_WEEKDAYS.map((w) => (
                <div key={w} className="dp-wd">{w}</div>
              ))}
              {cells.map((c) => {
                const iso = dpISO(c.y, c.m, c.d);
                return (
                  <button
                    key={iso}
                    type="button"
                    className="dp-day"
                    data-out={c.out}
                    data-today={iso === todayISO}
                    data-sel={iso === value}
                    onClick={() => pick(iso)}
                  >
                    {c.d}
                  </button>
                );
              })}
            </div>
            <div className="dp-foot">
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => pick(todayISO)}>
                Heute
              </button>
              {clearable && value && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12.5, color: "var(--danger)" }}
                  onClick={() => pick("")}
                >
                  Löschen
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function fmtDateShort(iso: string): { tag: string; mon: string } {
  const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const d = new Date(iso + "T00:00:00");
  return { tag: String(d.getDate()).padStart(2, "0"), mon: MON[d.getMonth()] };
}
