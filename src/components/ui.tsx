"use client";

import { Planungsmodus } from "@/lib/domain/constants";

export function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  const init = name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {init}
    </span>
  );
}

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
