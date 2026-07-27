"use client";

import { useState } from "react";
import { api, useApi, Person, personName } from "@/lib/api";
import { PageHeader, Spinner, Empty, Dialog, DatePicker, fmtDate } from "@/components/ui";
import { abzeichenVorschlag } from "@/lib/domain/alter";

const BADGES = [
  {
    id: "jfl1", label: "JFL1", typ: "Jugendflamme Stufe I", dateKey: "jugendflamme1", planKey: "jugendflamme1PlanJahr",
    bedingungen: [
      "Zielgruppe: mind. 1 Jahr in der Jugendfeuerwehr oder Vorerfahrung aus der Kinderfeuerwehr*",
      "Voraussetzungen: keine",
    ],
    fussnote: "*abhängig von den Länderangeboten in den Kinderfeuerwehren",
  },
  {
    id: "jfl2", label: "JFL2", typ: "Jugendflamme Stufe II", dateKey: "jugendflamme2", planKey: "jugendflamme2PlanJahr",
    bedingungen: [
      "Zielgruppe: ab 12 Jahren",
      "Voraussetzungen: Stufe I, frühestens 1 Jahr nach Erwerb",
    ],
    fussnote: null,
  },
  {
    id: "lsp", label: "LSP", typ: "Leistungsspange", dateKey: "leistungsspangeDatum", planKey: "leistungsspangePlanJahr",
    bedingungen: [
      "Zielgruppe: Jahrgangsalter 15–18",
      "Voraussetzungen: mind. 1 Jahr Mitglied in der Jugendfeuerwehr",
    ],
    fussnote: null,
  },
] as const;

type Badge = (typeof BADGES)[number];

function Dash() {
  return <span style={{ color: "var(--color-neutral-600)" }}>—</span>;
}

const doneStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 14, color: "var(--color-accent-300)", whiteSpace: "nowrap" };

export default function AbzeichenPage() {
  const { data: personen, reload } = useApi<Person[]>("/personen");
  const [selId, setSelId] = useState<number | null>(null);

  if (!personen) return <Spinner />;

  const jahr = new Date().getFullYear();
  const jugend = personen
    .filter((p) => p.aktiv && p.rolle === "jugendlich")
    .sort((a, b) => personName(a).localeCompare(personName(b), "de"));
  const sel = selId != null ? personen.find((p) => p.id === selId) ?? null : null;

  async function patchPerson(id: number, body: Record<string, unknown>) {
    await api(`/personen/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    reload();
  }

  // KPIs
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
      <PageHeader title="Abzeichen" sub="Übersicht & Planung — Zeile anklicken zum Eintragen oder Planen" />

      {jugend.length === 0 ? (
        <Empty icon="ph-medal" text="Keine Jugendlichen" hint="Sobald Jugendliche angelegt sind, erscheinen hier ihre Abzeichen." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }} className="lg:px-6">
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
                  <tr key={p.id} onClick={() => setSelId(p.id)} style={{ cursor: "pointer" }} title="Eintragen / planen">
                    <td><span style={{ fontSize: 15, fontWeight: 500 }}>{personName(p)}</span></td>
                    {BADGES.map((b) => (
                      <td key={b.id} style={{ textAlign: "center" }}>
                        <AbzeichenCell p={p} badge={b} />
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
              <button
                key={p.id}
                onClick={() => setSelId(p.id)}
                className="panel"
                style={{ padding: "12px 14px", border: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit", width: "100%" }}
              >
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 9 }}>{personName(p)}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {BADGES.map((b) => (
                    <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 42, fontSize: 12, color: "var(--color-neutral-400)" }}>{b.label}</span>
                      <span style={{ marginLeft: "auto" }}>
                        <AbzeichenCell p={p} badge={b} />
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <JahresVerteilung jugend={jugend} jahr={jahr} />
        </div>
      )}

      {sel && <PersonDialog person={sel} onClose={() => setSelId(null)} onPatch={patchPerson} />}
    </>
  );
}

function AbzeichenCell({ p, badge }: { p: Person; badge: Badge }) {
  const datum = p[badge.dateKey];
  if (datum) {
    return (
      <span style={doneStyle}>
        <i className="ph-fill ph-check-circle" style={{ fontSize: 17 }} />
        {fmtDate(datum)}
      </span>
    );
  }
  const plan = p[badge.planKey];
  if (plan != null) return <span className="ph-tag" style={{ background: "var(--color-accent-2-800)", color: "var(--color-accent-2-100)" }}>{plan}</span>;
  const vorschlag = abzeichenVorschlag(p, badge.id);
  if (vorschlag != null) return <span style={{ fontSize: 13.5, color: "var(--color-neutral-500)" }}>Vorschlag {vorschlag}</span>;
  return <Dash />;
}

function PersonDialog({
  person,
  onClose,
  onPatch,
}: {
  person: Person;
  onClose: () => void;
  onPatch: (id: number, body: Record<string, unknown>) => void;
}) {
  return (
    <Dialog title={`Abzeichen — ${personName(person)}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {BADGES.map((b) => {
          const datum = person[b.dateKey];
          const plan = person[b.planKey];
          const vorschlag = abzeichenVorschlag(person, b.id);
          const years = [...new Set([...moeglicheJahre(person, b.id), ...(plan != null ? [plan] : [])])].sort((a, b) => a - b);
          return (
            <div key={b.id} style={{ borderTop: "1px solid var(--color-divider)", paddingTop: 13 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <i className="ph ph-medal" style={{ color: "var(--color-accent-300)" }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{b.typ}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)", lineHeight: 1.55, marginBottom: 10 }}>
                {b.bedingungen.map((line) => (
                  <div key={line}>{line}</div>
                ))}
                {b.fussnote && <div style={{ fontSize: 10.5, color: "var(--color-neutral-600)", marginTop: 2 }}>{b.fussnote}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label>Datum der Abnahme</label>
                  <DatePicker
                    value={datum ?? ""}
                    onChange={(v) => onPatch(person.id, v ? { [b.dateKey]: v, [b.planKey]: null } : { [b.dateKey]: null })}
                  />
                </div>
                <div className="field">
                  <label>Zieljahr planen</label>
                  <select
                    className="input"
                    value={plan != null ? String(plan) : ""}
                    disabled={!!datum}
                    onChange={(e) => onPatch(person.id, { [b.planKey]: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">{vorschlag != null ? `Vorschlag ${vorschlag}` : "—"}</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="dialog-actions">
        <button className="btn btn-secondary" onClick={onClose}>Schließen</button>
      </div>
    </Dialog>
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

function jahrOf(d: string | null): number | null {
  return d ? new Date(d).getFullYear() : null;
}

// Nur die tatsächlich möglichen Planungsjahre je Abzeichen (aus Eintritt,
// Geburtsdatum, JFL1-Datum). Vergangene Jahre werden nicht angeboten.
function moeglicheJahre(p: Person, id: Badge["id"]): number[] {
  const now = new Date().getFullYear();
  const geb = jahrOf(p.geburtsdatum);
  const ein = jahrOf(p.eintrittsdatum);
  const jfl1 = jahrOf(p.jugendflamme1) ?? p.jugendflamme1PlanJahr ?? null;

  let min = now;
  let max = now + 8;
  if (id === "jfl1") {
    // frühestens 1 Jahr nach Eintritt
    if (ein != null) min = Math.max(min, ein + 1);
    if (geb != null) max = geb + 18;
  } else if (id === "jfl2") {
    // ab 12 Jahren und frühestens 1 Jahr nach der Stufe I
    if (geb != null) min = Math.max(min, geb + 12);
    if (jfl1 != null) min = Math.max(min, jfl1 + 1);
    if (geb != null) max = geb + 18;
  } else {
    // LSP: Jahrgangsalter 15–18 und mind. 1 Jahr Mitglied
    if (geb != null) min = Math.max(min, geb + 15);
    if (ein != null) min = Math.max(min, ein + 1);
    if (geb != null) max = geb + 18;
  }
  if (max < min) max = min;
  return range(min, max);
}
