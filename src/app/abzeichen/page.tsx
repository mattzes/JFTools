"use client";

import { useState } from "react";
import { api, useApi, Person, personName } from "@/lib/api";
import { PageHeader, Spinner, Empty, Dialog, DatePicker, Th, fmtDate, useSort, sortRows } from "@/components/ui";
import { abzeichenVorschlag, alter, alterInDiesemJahr } from "@/lib/domain/alter";

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
  const [suche, setSuche] = useState("");
  const { sort, toggle } = useSort({ key: "name", dir: "asc" });

  if (!personen) return <Spinner />;

  const jahr = new Date().getFullYear();
  const jugendBasis = personen
    .filter((p) => p.aktiv && p.rolle === "jugendlich")
    .sort((a, b) => personName(a).localeCompare(personName(b), "de"));
  const jugend = sortRows(jugendBasis, sort, (p, key) => {
    if (key === "name") return personName(p);
    if (key === "jgalter") return p.geburtsdatum ? alterInDiesemJahr(p.geburtsdatum) : null;
    if (key === "alter") return p.geburtsdatum ? alter(p.geburtsdatum) : null;
    const b = BADGES.find((x) => x.id === key);
    if (!b) return null;
    const datum = p[b.dateKey];
    if (datum) return jahrOf(datum);
    return p[b.planKey] ?? abzeichenVorschlag(p, b.id);
  });
  const sel = selId != null ? personen.find((p) => p.id === selId) ?? null : null;
  const q = suche.trim().toLowerCase();
  const jugendGefiltert = q ? jugend.filter((p) => personName(p).toLowerCase().includes(q)) : jugend;

  async function patchPerson(id: number, body: Record<string, unknown>) {
    await api(`/personen/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    reload();
  }

  return (
    <>
      <PageHeader title="Abzeichen" sub="Übersicht & Planung — Zeile anklicken zum Eintragen oder Planen">
        <input
          className="input input-search"
          placeholder="Suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
      </PageHeader>

      {jugend.length === 0 ? (
        <Empty icon="ph-medal" text="Keine Jugendlichen" hint="Sobald Jugendliche angelegt sind, erscheinen hier ihre Abzeichen." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }} className="lg:px-6">
          {/* Desktop-Matrix */}
          <div className="hidden lg:block" style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <Th sortKey="name" sort={sort} onSort={toggle} style={{ minWidth: 160 }}>Name</Th>
                  <Th sortKey="jgalter" sort={sort} onSort={toggle} align="center" style={{ minWidth: 110 }}>Jahrg.-Alter</Th>
                  <Th sortKey="alter" sort={sort} onSort={toggle} align="center" style={{ minWidth: 110 }}>Aktuelles Alter</Th>
                  {BADGES.map((b) => (
                    <Th key={b.id} sortKey={b.id} sort={sort} onSort={toggle} align="center" style={{ minWidth: 150 }}>{b.label}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jugendGefiltert.map((p) => (
                  <tr key={p.id} onClick={() => setSelId(p.id)} style={{ cursor: "pointer" }} title="Eintragen / planen">
                    <td><span style={{ fontSize: 15, fontWeight: 500 }}>{personName(p)}</span></td>
                    <td style={{ textAlign: "center" }}>{p.geburtsdatum ? <span style={{ fontWeight: 500 }}>{alterInDiesemJahr(p.geburtsdatum)}</span> : <Dash />}</td>
                    <td style={{ textAlign: "center" }}>{p.geburtsdatum ? <span style={{ fontWeight: 500 }}>{alter(p.geburtsdatum)}</span> : <Dash />}</td>
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

          {/* Mobile: Verteilung nach Jahr (nur aktuelles & nächstes Jahr) — bei aktiver Suche ausgeblendet */}
          {!q && <JahresVerteilung jugend={jugend} jahr={jahr} />}

          {/* Mobile-Karten */}
          <div className="flex flex-col gap-4 lg:hidden">
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-neutral-400)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
              Jugendliche
            </div>
            {jugendGefiltert.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--color-neutral-500)", padding: "8px 2px" }}>Niemand gefunden.</div>
            ) : (
              jugendGefiltert.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelId(p.id)}
                  className="panel"
                  style={{ padding: "12px 14px", border: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit", width: "100%" }}
                >
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{personName(p)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)", marginBottom: 9 }}>
                    {p.geburtsdatum ? `Jahrgangsalter ${alterInDiesemJahr(p.geburtsdatum)} · Alter ${alter(p.geburtsdatum)}` : "kein Geburtsdatum"}
                  </div>
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
              ))
            )}
          </div>

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
    <Dialog title={`Abzeichen — ${personName(person)}`} onClose={onClose} fullscreenMobile>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px", padding: "10px 12px", background: "var(--color-bg)", borderRadius: 9, marginBottom: 4 }}>
        {([
          ["Geburtsdatum", person.geburtsdatum ? fmtDate(person.geburtsdatum) : "—"],
          ["Eintrittsdatum", person.eintrittsdatum ? fmtDate(person.eintrittsdatum) : "—"],
          ["Alter", person.geburtsdatum ? `${alter(person.geburtsdatum)}` : "—"],
          ["Jahrgangsalter", person.geburtsdatum ? `${alterInDiesemJahr(person.geburtsdatum)}` : "—"],
        ] as [string, string][]).map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 10.5, color: "var(--color-neutral-500)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
            <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>
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
  type Eintrag = { jahr: number; typ: Badge["typ"]; name: string; geplant: boolean };
  const eintraege: Eintrag[] = [];
  for (const p of jugend) {
    for (const b of BADGES) {
      if (p[b.dateKey]) continue; // erledigt
      const plan = p[b.planKey];
      const eff = plan ?? abzeichenVorschlag(p, b.id);
      if (eff != null) eintraege.push({ jahr: eff, typ: b.typ, name: personName(p), geplant: plan != null });
    }
  }
  const jahre = [jahr, jahr + 1].filter((y) => eintraege.some((e) => e.jahr === y));
  if (jahre.length === 0) return null;

  return (
    <div className="lg:hidden" style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-neutral-400)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
        Verteilung nach Jahr
      </div>
      <div className="grid grid-cols-1 gap-4" style={{ alignContent: "start" }}>
        {jahre.map((y) => {
          const jeType = BADGES.map((b) => ({ typ: b.typ, items: eintraege.filter((e) => e.jahr === y && e.typ === b.typ) })).filter((g) => g.items.length > 0);
          const total = jeType.reduce((a, g) => a + g.items.length, 0);
          return (
            <div key={y} className="panel" style={{ alignSelf: "start" }}>
              <div className="panel-h" style={{ justifyContent: "space-between" }}>
                <h4 style={{ fontSize: 17 }}>{y}{y === jahr ? " · dieses Jahr" : ""}</h4>
                <span className="ph-tag" style={{ background: "var(--color-accent-800)", color: "var(--color-accent-100)" }}>{total}</span>
              </div>
              {jeType.map((g) => {
                const geplant = g.items.filter((i) => i.geplant);
                const vorschlag = g.items.filter((i) => !i.geplant);
                return (
                  <div key={g.typ} style={{ padding: "11px 17px", borderTop: "1px solid var(--color-divider)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 500, marginBottom: 4 }}>
                      <i className="ph ph-medal" style={{ color: "var(--color-accent-300)" }} />
                      {g.typ}
                      <span style={{ marginLeft: "auto", color: "var(--color-neutral-500)", fontWeight: 400 }}>{g.items.length}</span>
                    </div>
                    {geplant.length > 0 && (
                      <div style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 2 }}>
                        <span style={{ color: "var(--color-accent-2-200)", fontWeight: 600 }}>Geplant: </span>
                        <span style={{ color: "var(--color-neutral-400)" }}>{geplant.map((i) => i.name).join(", ")}</span>
                      </div>
                    )}
                    {vorschlag.length > 0 && (
                      <div style={{ fontSize: 11.5, lineHeight: 1.5, marginTop: 2 }}>
                        <span style={{ color: "var(--color-neutral-500)", fontWeight: 600 }}>Vorschlag: </span>
                        <span style={{ color: "var(--color-neutral-500)", fontStyle: "italic" }}>{vorschlag.map((i) => i.name).join(", ")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
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
