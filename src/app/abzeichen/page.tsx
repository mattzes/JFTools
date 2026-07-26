"use client";

import { useState } from "react";
import { api, useApi, Person, personName } from "@/lib/api";
import { PageHeader, Spinner, Empty, Dialog, DatePicker, fmtDate } from "@/components/ui";
import { abzeichenVorschlag } from "@/lib/domain/alter";

const BADGES = [
  { id: "jfl1", label: "JFL1", typ: "Jugendflamme 1", dateKey: "jugendflamme1", planKey: "jugendflamme1PlanJahr" },
  { id: "jfl2", label: "JFL2", typ: "Jugendflamme 2", dateKey: "jugendflamme2", planKey: "jugendflamme2PlanJahr" },
  { id: "lsp", label: "LSP", typ: "Leistungsspange", dateKey: "leistungsspangeDatum", planKey: "leistungsspangePlanJahr" },
] as const;

type Badge = (typeof BADGES)[number];
type View = "uebersicht" | "planung";

function Dash() {
  return <span style={{ color: "var(--color-neutral-600)" }}>—</span>;
}

const doneStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--color-accent-300)", whiteSpace: "nowrap" };

export default function AbzeichenPage() {
  const { data: personen, reload } = useApi<Person[]>("/personen");
  const [view, setView] = useState<View>("uebersicht");
  const [erledigt, setErledigt] = useState<{ person: Person; badge: Badge } | null>(null);
  const [erledigtDatum, setErledigtDatum] = useState("");

  if (!personen) return <Spinner />;

  const jahr = new Date().getFullYear();
  const jugend = personen
    .filter((p) => p.aktiv && p.rolle === "jugendlich")
    .sort((a, b) => personName(a).localeCompare(personName(b), "de"));

  async function patchPerson(id: number, body: Record<string, unknown>) {
    await api(`/personen/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    reload();
  }

  function setPlan(p: Person, badge: Badge, planJahr: number | null) {
    patchPerson(p.id, { [badge.planKey]: planJahr });
  }

  function openErledigt(p: Person, badge: Badge) {
    const datum = p[badge.dateKey];
    const plan = p[badge.planKey];
    setErledigtDatum(datum ?? (plan != null ? `${plan}-05-15` : new Date().toISOString().slice(0, 10)));
    setErledigt({ person: p, badge });
  }
  function saveErledigt() {
    if (!erledigt || !erledigtDatum) return;
    patchPerson(erledigt.person.id, { [erledigt.badge.dateKey]: erledigtDatum, [erledigt.badge.planKey]: null });
    setErledigt(null);
  }
  function clearErledigt() {
    if (!erledigt) return;
    patchPerson(erledigt.person.id, { [erledigt.badge.dateKey]: null });
    setErledigt(null);
  }

  // KPIs (Übersicht): erledigt je Abzeichen + dieses Jahr geplant
  const doneCount = (b: Badge) => jugend.filter((p) => p[b.dateKey]).length;
  let plannedThisYear = 0;
  for (const p of jugend) {
    for (const b of BADGES) {
      if (p[b.dateKey]) continue;
      const eff = p[b.planKey] ?? abzeichenVorschlag(p, b.id);
      if (eff === jahr) plannedThisYear++;
    }
  }

  return (
    <>
      <PageHeader title="Abzeichen" sub="Übersicht & Planung — JFL1, JFL2, Leistungsspange">
        <div className="seg" style={{ fontSize: 12 }}>
          {([["uebersicht", "Übersicht"], ["planung", "Planung"]] as [View, string][]).map(([v, l]) => (
            <button key={v} className="seg-opt" data-on={view === v} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
      </PageHeader>

      {jugend.length === 0 ? (
        <Empty icon="ph-medal" text="Keine Jugendlichen" hint="Sobald Jugendliche angelegt sind, erscheinen hier ihre Abzeichen." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }} className="lg:px-6">
          {view === "uebersicht" && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ marginBottom: 16 }}>
              {BADGES.map((b) => (
                <div className="kpi" key={b.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 16, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
                      <i className="ph ph-medal" />
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--color-neutral-500)" }}>{b.label}</span>
                  </div>
                  <div className="kpi-n">{doneCount(b)}<span style={{ fontSize: 14, color: "var(--color-neutral-500)", fontWeight: 400 }}> / {jugend.length}</span></div>
                  <div className="kpi-l">erledigt</div>
                </div>
              ))}
              <div className="kpi">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 16, background: "var(--color-accent-2-800)", color: "var(--color-accent-2-100)" }}>
                    <i className="ph ph-calendar-check" />
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--color-neutral-500)" }}>{jahr}</span>
                </div>
                <div className="kpi-n">{plannedThisYear}</div>
                <div className="kpi-l">dieses Jahr geplant</div>
              </div>
            </div>
          )}

          {/* Desktop-Matrix */}
          <div className="hidden lg:block" style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Name</th>
                  {BADGES.map((b) => (
                    <th key={b.id} style={{ textAlign: "center", minWidth: 150 }}>{b.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jugend.map((p) => (
                  <tr key={p.id}>
                    <td><span style={{ fontSize: 12.5, fontWeight: 500 }}>{personName(p)}</span></td>
                    {BADGES.map((b) => (
                      <td key={b.id} style={{ textAlign: "center" }}>
                        <AbzeichenCell p={p} badge={b} editable={view === "planung"} jahr={jahr} onPlan={setPlan} onErledigt={openErledigt} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile-Karten */}
          <div className="flex flex-col gap-2 lg:hidden">
            {jugend.map((p) => (
              <div key={p.id} className="panel" style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 9 }}>{personName(p)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {BADGES.map((b) => (
                    <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 42, fontSize: 12, color: "var(--color-neutral-400)" }}>{b.label}</span>
                      <span style={{ marginLeft: "auto" }}>
                        <AbzeichenCell p={p} badge={b} editable={view === "planung"} jahr={jahr} onPlan={setPlan} onErledigt={openErledigt} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {view === "planung" && <JahresVerteilung jugend={jugend} jahr={jahr} />}
        </div>
      )}

      {erledigt && (
        <Dialog title={`${erledigt.badge.typ} — ${personName(erledigt.person)}`} onClose={() => setErledigt(null)}>
          <div className="field">
            <label>Datum der Abnahme</label>
            <DatePicker value={erledigtDatum} onChange={setErledigtDatum} clearable={false} />
          </div>
          <div className="dialog-actions">
            {erledigt.person[erledigt.badge.dateKey] && (
              <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={clearErledigt}>
                <i className="ph ph-trash" /> Erledigt entfernen
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setErledigt(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={saveErledigt} disabled={!erledigtDatum}>
              <i className="ph ph-check" /> Speichern
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function AbzeichenCell({
  p,
  badge,
  editable,
  jahr,
  onPlan,
  onErledigt,
}: {
  p: Person;
  badge: Badge;
  editable: boolean;
  jahr: number;
  onPlan: (p: Person, badge: Badge, jahr: number | null) => void;
  onErledigt: (p: Person, badge: Badge) => void;
}) {
  const datum = p[badge.dateKey];
  const plan = p[badge.planKey];
  const vorschlag = abzeichenVorschlag(p, badge.id);

  // Erledigt
  if (datum) {
    const inner = (
      <span style={doneStyle}>
        <i className="ph-fill ph-check-circle" style={{ fontSize: 15 }} />
        {fmtDate(datum)}
      </span>
    );
    return editable ? (
      <button onClick={() => onErledigt(p, badge)} title="Datum ändern / entfernen" style={{ background: "transparent", border: 0, cursor: "pointer", padding: 0 }}>
        {inner}
      </button>
    ) : (
      inner
    );
  }

  // Übersicht (read-only): geplant oder Vorschlag
  if (!editable) {
    if (plan != null) return <span className="ph-tag" style={{ background: "var(--color-accent-2-800)", color: "var(--color-accent-2-100)" }}>{plan}</span>;
    if (vorschlag != null) return <span style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>Vorschlag {vorschlag}</span>;
    return <Dash />;
  }

  // Planung (editierbar): Jahr-Dropdown + Erledigt-Häkchen
  const years = [...new Set([...range(jahr, jahr + 8), ...(plan != null ? [plan] : []), ...(vorschlag != null ? [vorschlag] : [])])].sort((a, b) => a - b);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <select
        className="input"
        value={plan != null ? String(plan) : ""}
        onChange={(e) => onPlan(p, badge, e.target.value === "" ? null : Number(e.target.value))}
        style={{ width: "auto", minHeight: 0, height: 30, padding: "2px 6px", fontSize: 12, color: plan != null ? "var(--color-accent-2-100)" : "var(--color-neutral-500)" }}
      >
        <option value="">{vorschlag != null ? `Vorschlag ${vorschlag}` : "—"}</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <button
        onClick={() => onErledigt(p, badge)}
        title="als erledigt eintragen"
        style={{ display: "inline-grid", placeItems: "center", width: 28, height: 28, borderRadius: 7, background: "transparent", border: 0, cursor: "pointer", color: "var(--color-neutral-400)", boxShadow: "inset 0 0 0 1px var(--color-neutral-700)" }}
      >
        <i className="ph ph-check" style={{ fontSize: 14 }} />
      </button>
    </span>
  );
}

function JahresVerteilung({ jugend, jahr }: { jugend: Person[]; jahr: number }) {
  type Eintrag = { jahr: number; typ: Badge["typ"]; name: string };
  const eintraege: Eintrag[] = [];
  for (const p of jugend) {
    for (const b of BADGES) {
      if (p[b.dateKey]) continue; // erledigt
      const eff = p[b.planKey] ?? abzeichenVorschlag(p, b.id);
      if (eff != null) eintraege.push({ jahr: eff, typ: b.typ, name: personName(p) });
    }
  }
  const jahre = [...new Set(eintraege.map((e) => e.jahr))].sort((a, b) => a - b).slice(0, 8);
  if (jahre.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-neutral-400)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
        Verteilung nach Jahr
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" style={{ alignContent: "start" }}>
        {jahre.map((y) => {
          const jeType = BADGES.map((b) => ({ typ: b.typ, items: eintraege.filter((e) => e.jahr === y && e.typ === b.typ) })).filter((g) => g.items.length > 0);
          const total = jeType.reduce((a, g) => a + g.items.length, 0);
          return (
            <div key={y} className="panel" style={{ alignSelf: "start" }}>
              <div className="panel-h" style={{ justifyContent: "space-between" }}>
                <h4 style={{ fontSize: 17 }}>{y}{y === jahr ? " · dieses Jahr" : ""}</h4>
                <span className="ph-tag" style={{ background: "var(--color-accent-800)", color: "var(--color-accent-100)" }}>{total}</span>
              </div>
              {jeType.map((g) => (
                <div key={g.typ} style={{ padding: "11px 17px", borderTop: "1px solid var(--color-divider)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 500, marginBottom: 4 }}>
                    <i className="ph ph-medal" style={{ color: "var(--color-accent-300)" }} />
                    {g.typ}
                    <span style={{ marginLeft: "auto", color: "var(--color-neutral-500)", fontWeight: 400 }}>{g.items.length}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)", lineHeight: 1.5 }}>
                    {g.items.map((i) => i.name).join(", ")}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let y = from; y <= to; y++) out.push(y);
  return out;
}
