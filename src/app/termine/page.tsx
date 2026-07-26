"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { api, useApi, Person, Termin, Verfuegbarkeit, personName } from "@/lib/api";
import { DatePicker, Dialog, Empty, ModeTag, PageHeader, Spinner, fmtDate, fmtDateShort } from "@/components/ui";
import { PLANUNGSMODI, ZIELGRUPPEN, Planungsmodus, Zielgruppe } from "@/lib/domain/constants";

const STATUS_CELL = {
  ja: { icon: "ph-check", c: "var(--color-accent-300)", bg: "var(--color-accent-900)" },
  nein: { icon: "ph-x", c: "var(--danger)", bg: "rgba(232,110,110,.14)" },
  offen: { icon: "ph-minus", c: "var(--color-neutral-600)", bg: "transparent" },
} as const;

// Abhak-Buttons im Termin-Dialog (Ja / Nein / offen)
const SEG_BTN = { display: "inline-grid", placeItems: "center", width: 34, height: 30, borderRadius: 8, fontSize: 13, border: 0, cursor: "pointer" } as const;
const SEG_OFF = { background: "var(--color-neutral-800)", color: "var(--color-neutral-600)" } as const;
const SEG_ON: Record<Verfuegbarkeit["status"], CSSProperties> = {
  ja: { background: "var(--color-accent-900)", color: "var(--color-accent-200)" },
  nein: { background: "rgba(232,110,110,.2)", color: "var(--danger)" },
  offen: { background: "var(--color-neutral-700)", color: "var(--color-neutral-100)" },
};

const MODUS_LABEL: Record<Planungsmodus, string> = {
  keine: "keine — nur Verfügbarkeit",
  nur_gruppen: "Nur Gruppen — freie Einteilung",
  a_teil: "A-Teil",
  a_und_b_teil: "A und B-Teil",
};

const ZIEL_LABEL: Record<Zielgruppe, string> = {
  alle: "alle",
  nur_betreuer: "nur Betreuer",
  nur_jugendliche: "nur Jugendliche",
};

type TerminForm = {
  id?: number;
  titel: string;
  datumVon: string;
  datumBis: string;
  planungsmodus: Planungsmodus;
  zielgruppe: Zielgruppe;
  ort: string;
};

const EMPTY: TerminForm = { titel: "", datumVon: "", datumBis: "", planungsmodus: "keine", zielgruppe: "alle", ort: "" };

export default function TerminePage() {
  const { data: personen } = useApi<Person[]>("/personen");
  const { data: termine, reload } = useApi<Termin[]>("/termine");
  const { data: verf, reload: reloadVerf } = useApi<Verfuegbarkeit[]>("/verfuegbarkeiten");
  const [ansicht, setAnsicht] = useState<"matrix" | "liste">("matrix");
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<TerminForm | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const cellMap = useMemo(() => {
    const m = new Map<string, Verfuegbarkeit["status"]>();
    verf?.forEach((v) => m.set(`${v.personId}:${v.terminId}`, v.status));
    return m;
  }, [verf]);

  if (!personen || !termine || !verf) return <Spinner />;

  const aktive = personen.filter((p) => p.aktiv);
  function zielPersonen(t: Termin) {
    return t.zielgruppe === "nur_betreuer"
      ? aktive.filter((p) => p.rolle === "betreuer")
      : t.zielgruppe === "nur_jugendliche"
        ? aktive.filter((p) => p.rolle === "jugendlich")
        : aktive;
  }

  async function setCell(personId: number, terminId: number, status: Verfuegbarkeit["status"]) {
    await api("/verfuegbarkeiten", { method: "PUT", body: JSON.stringify({ personId, terminId, status }) });
    reloadVerf();
  }

  function cycle(personId: number, terminId: number) {
    const cur = cellMap.get(`${personId}:${terminId}`) ?? "offen";
    const next = cur === "offen" ? "ja" : cur === "ja" ? "nein" : "offen";
    setCell(personId, terminId, next);
  }

  async function save() {
    if (!form) return;
    setFehler(null);
    const payload = {
      titel: form.titel.trim(),
      datumVon: form.datumVon,
      datumBis: form.datumBis || null,
      planungsmodus: form.planungsmodus,
      zielgruppe: form.zielgruppe,
      ort: form.ort || null,
    };
    try {
      if (form.id) await api(`/termine/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/termine", { method: "POST", body: JSON.stringify(payload) });
      setForm(null);
      reload();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <PageHeader title="Termine & Verfügbarkeit" sub={`Saison ${new Date().getFullYear()} · Ja / Nein / offen`}>
        {ansicht === "matrix" && (
          <button
            className={`hidden lg:inline-flex btn ${editMode ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setEditMode((v) => !v)}
          >
            <i className={`ph ${editMode ? "ph-check" : "ph-pencil-simple"}`} />
            {editMode ? "Bearbeiten fertig" : "Anwesenheiten bearbeiten"}
          </button>
        )}
        <div className="seg hidden lg:inline-flex" style={{ fontSize: 12 }}>
          <button className="seg-opt" data-on={ansicht === "matrix"} onClick={() => setAnsicht("matrix")}>Matrix</button>
          <button className="seg-opt" data-on={ansicht === "liste"} onClick={() => setAnsicht("liste")}>Liste</button>
        </div>
        <button className="btn btn-primary" onClick={() => { setFehler(null); setForm(EMPTY); }}>
          <i className="ph ph-calendar-plus" />
          Termin
        </button>
      </PageHeader>

      {termine.length === 0 ? (
        <Empty icon="ph-calendar-dots" text="Keine Termine" hint="Lege den ersten Termin an." />
      ) : (
        <>
          {/* Desktop: Matrix oder Liste */}
          <div className="hidden lg:flex" style={{ flex: 1, overflow: "auto", padding: "8px 18px 0", alignItems: "flex-start" }}>
            {ansicht === "matrix" ? (
              <MatrixView aktive={aktive} termine={termine} cellMap={cellMap} zielPersonen={zielPersonen} onCycle={cycle} editMode={editMode} />
            ) : (
              <ListeView termine={termine} verf={verf} zielPersonen={zielPersonen} onEdit={(t) => setForm({ id: t.id, titel: t.titel, datumVon: t.datumVon, datumBis: t.datumBis ?? "", planungsmodus: t.planungsmodus, zielgruppe: t.zielgruppe, ort: t.ort ?? "" })} />
            )}
          </div>

          {/* Mobile: Terminliste (Tippen öffnet den Bearbeiten-Dialog) */}
          <div className="flex flex-col gap-2 lg:hidden" style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
            {termine.map((t) => {
              const ziel = zielPersonen(t);
              const zusagen = verf.filter((v) => v.terminId === t.id && v.status === "ja" && ziel.some((p) => p.id === v.personId)).length;
              const d = fmtDateShort(t.datumVon);
              return (
                <button
                  key={t.id}
                  onClick={() => { setFehler(null); setForm({ id: t.id, titel: t.titel, datumVon: t.datumVon, datumBis: t.datumBis ?? "", planungsmodus: t.planungsmodus, zielgruppe: t.zielgruppe, ort: t.ort ?? "" }); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", background: "var(--color-surface)", borderRadius: 11, border: 0, color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" }}
                >
                  <div style={{ width: 38, flex: "none", textAlign: "center", lineHeight: 1.05 }}>
                    <div style={{ font: "600 17px/1 var(--font-heading)" }}>{d.tag}</div>
                    <div style={{ fontSize: 10, color: "var(--color-neutral-500)", textTransform: "uppercase" }}>{d.mon}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.titel}</div>
                    <div style={{ fontSize: 11, color: "var(--color-neutral-500)", marginTop: 1 }}>{zusagen}/{ziel.length} Zusagen</div>
                  </div>
                  <ModeTag modus={t.planungsmodus} short />
                  <i className="ph ph-pencil-simple" style={{ color: "var(--color-neutral-600)" }} />
                </button>
              );
            })}
          </div>
        </>
      )}

      {form && (
        <Dialog title={form.id ? "Termin bearbeiten" : "Neuer Termin"} onClose={() => setForm(null)}>
          <div className="field">
            <label>Titel *</label>
            <input className="input" value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>Datum von *</label>
              <DatePicker value={form.datumVon} onChange={(v) => setForm({ ...form, datumVon: v })} clearable={false} />
            </div>
            <div className="field">
              <label>Datum bis (mehrtägig)</label>
              <DatePicker value={form.datumBis} onChange={(v) => setForm({ ...form, datumBis: v })} />
            </div>
          </div>
          <div className="field">
            <label>Planungsmodus</label>
            <select className="input" value={form.planungsmodus} onChange={(e) => setForm({ ...form, planungsmodus: e.target.value as Planungsmodus })}>
              {PLANUNGSMODI.map((m) => (
                <option key={m} value={m}>{MODUS_LABEL[m]}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>Zielgruppe</label>
              <select className="input" value={form.zielgruppe} onChange={(e) => setForm({ ...form, zielgruppe: e.target.value as Zielgruppe })}>
                {ZIELGRUPPEN.map((z) => (
                  <option key={z} value={z}>{ZIEL_LABEL[z]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Ort</label>
              <input className="input" value={form.ort} onChange={(e) => setForm({ ...form, ort: e.target.value })} />
            </div>
          </div>
          {form.id && (() => {
            const tid = form.id;
            const ziel = zielPersonen({ zielgruppe: form.zielgruppe } as Termin);
            return (
              <div className="field">
                <label>Anwesenheiten <span style={{ color: "var(--color-neutral-500)", fontWeight: 400 }}>· Ja / Nein / offen</span></label>
                {ziel.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>Keine Personen in der Zielgruppe.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto", paddingRight: 2 }}>
                    {ziel.map((p) => {
                      const s = cellMap.get(`${p.id}:${tid}`) ?? "offen";
                      return (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{personName(p)}</span>
                          <div style={{ display: "flex", gap: 4, flex: "none" }}>
                            {(["ja", "nein", "offen"] as const).map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setCell(p.id, tid, st)}
                                aria-label={st}
                                style={{ ...SEG_BTN, ...(s === st ? SEG_ON[st] : SEG_OFF) }}
                              >
                                <i className={`ph-bold ${STATUS_CELL[st].icon}`} />
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          {fehler && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{fehler}</div>}
          <div className="dialog-actions">
            {form.id && (
              <button
                className="btn btn-danger"
                style={{ marginRight: "auto" }}
                onClick={async () => {
                  if (confirm("Diesen Termin wirklich löschen? Verfügbarkeiten und Planung gehen verloren.")) {
                    await api(`/termine/${form.id}`, { method: "DELETE" });
                    setForm(null);
                    reload();
                    reloadVerf();
                  }
                }}
              >
                <i className="ph ph-trash" />
                Löschen
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setForm(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={save} disabled={!form.titel.trim() || !form.datumVon}>
              <i className="ph ph-check" />
              Speichern
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function MatrixView({
  aktive,
  termine,
  cellMap,
  zielPersonen,
  onCycle,
  editMode,
}: {
  aktive: Person[];
  termine: Termin[];
  cellMap: Map<string, Verfuegbarkeit["status"]>;
  zielPersonen: (t: Termin) => Person[];
  onCycle: (personId: number, terminId: number) => void;
  editMode: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      <table
        className="table"
        style={{ minWidth: 640, ...(editMode ? { boxShadow: "0 0 0 1.5px var(--color-accent-800)", borderRadius: 12 } : {}) }}
      >
      <thead>
        <tr>
          <th style={{ minWidth: 150 }}>Name</th>
          {termine.map((t) => {
            const ziel = zielPersonen(t);
            const ja = ziel.filter((p) => cellMap.get(`${p.id}:${t.id}`) === "ja").length;
            const d = fmtDateShort(t.datumVon);
            return (
              <th key={t.id} style={{ textAlign: "center", paddingBottom: 8, verticalAlign: "top" }}>
                <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600 }}>{d.tag}. {d.mon}</div>
                <div style={{ margin: "4px auto 2px", maxWidth: 96, fontSize: 10.5, fontWeight: 400, color: "var(--color-neutral-400)", textTransform: "none", letterSpacing: 0, whiteSpace: "normal", lineHeight: 1.25 }}>
                  {t.titel}
                </div>
                <div style={{ fontSize: 10, color: "var(--color-neutral-500)", textTransform: "none", letterSpacing: 0 }}>
                  {ja}/{ziel.length}
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {aktive.map((p) => (
          <tr key={p.id}>
            <td>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <span
                  title={p.rolle === "betreuer" ? "Betreuer" : "Jugendlich"}
                  style={{
                    width: 18, height: 18, flex: "none", borderRadius: 5, display: "inline-grid", placeItems: "center",
                    fontSize: 10, fontWeight: 700,
                    ...(p.rolle === "betreuer"
                      ? { background: "var(--color-accent-2-800)", color: "var(--color-accent-2-100)" }
                      : { background: "var(--color-neutral-800)", color: "var(--color-neutral-200)" }),
                  }}
                >
                  {p.rolle === "betreuer" ? "B" : "J"}
                </span>
                <span style={{ fontSize: 12.5 }}>{personName(p)}</span>
              </span>
            </td>
            {termine.map((t) => {
              const ziel = zielPersonen(t);
              const inScope = ziel.some((z) => z.id === p.id);
              const s = inScope ? cellMap.get(`${p.id}:${t.id}`) ?? "offen" : null;
              const cell = s ? STATUS_CELL[s] : null;
              return (
                <td key={t.id} style={{ textAlign: "center" }}>
                  {cell ? (
                    editMode ? (
                      <button
                        onClick={() => onCycle(p.id, t.id)}
                        title="klicken zum Wechseln (Ja → Nein → offen)"
                        style={{ display: "inline-grid", placeItems: "center", width: 26, height: 26, borderRadius: 7, background: cell.bg, color: cell.c, cursor: "pointer", border: 0, boxShadow: "inset 0 0 0 1px var(--color-neutral-600)" }}
                      >
                        <i className={`ph-bold ${cell.icon}`} style={{ fontSize: 12 }} />
                      </button>
                    ) : (
                      <span
                        style={{ display: "inline-grid", placeItems: "center", width: 26, height: 26, borderRadius: 7, background: cell.bg, color: cell.c }}
                      >
                        <i className={`ph-bold ${cell.icon}`} style={{ fontSize: 12 }} />
                      </span>
                    )
                  ) : (
                    <span style={{ color: "var(--color-neutral-800)" }}>·</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
      </table>
    </div>
  );
}

function ListeView({
  termine,
  verf,
  zielPersonen,
  onEdit,
}: {
  termine: Termin[];
  verf: Verfuegbarkeit[];
  zielPersonen: (t: Termin) => Person[];
  onEdit: (t: Termin) => void;
}) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Datum</th>
          <th>Titel</th>
          <th>Modus</th>
          <th>Zielgruppe</th>
          <th style={{ textAlign: "right" }}>Zusagen</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {termine.map((t) => {
          const ziel = zielPersonen(t);
          const ja = verf.filter((v) => v.terminId === t.id && v.status === "ja" && ziel.some((p) => p.id === v.personId)).length;
          return (
            <tr key={t.id}>
              <td style={{ whiteSpace: "nowrap" }}>{fmtDate(t.datumVon)}{t.datumBis ? `–${fmtDate(t.datumBis).slice(0, 5)}` : ""}</td>
              <td style={{ fontWeight: 500 }}>{t.titel}</td>
              <td><ModeTag modus={t.planungsmodus} /></td>
              <td style={{ fontSize: 12.5, color: "var(--color-neutral-400)" }}>{ZIEL_LABEL[t.zielgruppe]}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{ja}<span style={{ color: "var(--color-neutral-600)" }}>/{ziel.length}</span></td>
              <td style={{ textAlign: "right" }}>
                <button className="btn btn-ghost" onClick={() => onEdit(t)}><i className="ph ph-pencil-simple" /></button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
