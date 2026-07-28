"use client";

import { useMemo, useState } from "react";
import { api, useApi, Person, Disziplin, Messung, TrainingEintrag, personName } from "@/lib/api";
import { DatePicker, Dialog, Empty, PageHeader, Spinner, Th, useSort, sortRows, fmtDate } from "@/components/ui";
import {
  TRAINING_KATEGORIEN,
  TrainingKategorie,
  WASSERGRABEN_WERTE,
  WASSERGRABEN_LABELS,
  LEINBEUTEL_WERTE,
  LEINBEUTEL_LABELS,
} from "@/lib/domain/constants";
import { useStoredState } from "@/lib/useStoredState";

const heute = () => new Date().toISOString().slice(0, 10);

type Agg = { best: number; last: number; avg: number; werte: number[] };

function aggFor(messungen: Messung[], personId: number, disziplinId: number | undefined): Agg | null {
  if (disziplinId == null) return null;
  const ms = messungen
    .filter((m) => m.personId === personId && m.disziplinId === disziplinId && m.wertSekunden != null)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  if (ms.length === 0) return null;
  const werte = ms.map((m) => m.wertSekunden!);
  const best = Math.min(...werte);
  return { best, last: werte[werte.length - 1], avg: werte.reduce((s, v) => s + v, 0) / werte.length, werte };
}

export default function TrainingPage() {
  const { data: personen } = useApi<Person[]>("/personen");
  const { data: disziplinen } = useApi<Disziplin[]>("/disziplinen");
  const { data: messungen, reload: reloadMess } = useApi<Messung[]>("/messungen");
  const { data: eintraege, reload: reloadEintr } = useApi<TrainingEintrag[]>("/training-eintraege");
  const [aktiveKey, setAktiveKey] = useStoredState("training.kat", TRAINING_KATEGORIEN[0].key);
  const [addOpen, setAddOpen] = useState(false);
  const [detailPerson, setDetailPerson] = useState<number | null>(null);

  const kat = TRAINING_KATEGORIEN.find((k) => k.key === aktiveKey) ?? TRAINING_KATEGORIEN[0];

  const personById = useMemo(() => new Map((personen ?? []).map((p) => [p.id, p])), [personen]);
  const disziplinIdByName = useMemo(() => new Map((disziplinen ?? []).map((d) => [d.name, d.id])), [disziplinen]);

  // Nur Teilnehmer, deren Person noch aktiv ist (deaktivierte werden hier nicht angezeigt)
  const teilnehmer = useMemo(
    () => (eintraege ?? []).filter((e) => e.kategorie === kat.key && personById.get(e.personId)?.aktiv),
    [eintraege, kat.key, personById],
  );
  const eintragByPerson = useMemo(() => new Map(teilnehmer.map((e) => [e.personId, e])), [teilnehmer]);

  if (!personen || !disziplinen || !messungen || !eintraege) return <Spinner />;

  const reloadAll = () => {
    reloadMess();
    reloadEintr();
  };

  // Disziplin-IDs, die zu dieser Kategorie gehören (für Aufräumen beim Entfernen)
  function katDisziplinIds(k: TrainingKategorie): number[] {
    const names = k.kind === "zeit" && k.disziplin ? [k.disziplin] : k.kind === "knoten" ? [...(k.disziplinen ?? [])] : [];
    return names.map((n) => disziplinIdByName.get(n)).filter((x): x is number => x != null);
  }

  async function setWert(personId: number, wert: string | null) {
    await api("/training-eintraege", {
      method: "PUT",
      body: JSON.stringify({ personId, kategorie: kat.key, wert, notiz: null }),
    });
    reloadEintr();
  }

  async function removeTeilnehmer(e: TrainingEintrag) {
    if (!confirm(`${personName(personById.get(e.personId)!)} aus „${kat.label}" entfernen? Erfasste Zeiten gehen verloren.`)) return;
    const disIds = new Set(katDisziplinIds(kat));
    const toDelete = messungen!.filter((m) => m.personId === e.personId && disIds.has(m.disziplinId));
    for (const m of toDelete) await api(`/messungen/${m.id}`, { method: "DELETE" });
    await api(`/training-eintraege/${e.id}`, { method: "DELETE" });
    reloadAll();
  }

  const detailEintrag = detailPerson != null ? eintragByPerson.get(detailPerson) : undefined;

  return (
    <>
      <PageHeader title="Training" sub={kat.label}>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <i className="ph ph-user-plus" />
          Person hinzufügen
        </button>
      </PageHeader>

      {/* Feste Kategorie-Umschaltung (segmentiert wie Matrix/Liste bei Terminen) */}
      <div style={{ padding: "14px 18px 6px", overflowX: "auto" }} className="lg:px-6">
        <div className="seg" style={{ fontSize: 12 }}>
          {TRAINING_KATEGORIEN.map((k) => (
            <button
              key={k.key}
              className="seg-opt"
              data-on={k.key === kat.key}
              onClick={() => setAktiveKey(k.key)}
              style={{ whiteSpace: "nowrap" }}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {teilnehmer.length === 0 ? (
        <Empty icon="ph-user-plus" text="Noch keine Personen" hint="Füge über den Button oben Personen zu dieser Kategorie hinzu." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {kat.kind === "zeit" && (
            <ZeitTabelle
              kat={kat}
              teilnehmer={teilnehmer}
              personById={personById}
              messungen={messungen}
              disziplinId={kat.disziplin ? disziplinIdByName.get(kat.disziplin) : undefined}
              onOpen={setDetailPerson}
            />
          )}
          {kat.kind === "knoten" && (
            <KnotenTabelle
              kat={kat}
              teilnehmer={teilnehmer}
              personById={personById}
              messungen={messungen}
              disziplinIdByName={disziplinIdByName}
              onOpen={setDetailPerson}
            />
          )}
          {(kat.kind === "wassergraben" || kat.kind === "leinbeutel") && (
            <StatischTabelle
              kat={kat}
              teilnehmer={teilnehmer}
              personById={personById}
              onSetWert={setWert}
              onRemove={removeTeilnehmer}
            />
          )}
        </div>
      )}

      {addOpen && (
        <AddDialog
          kategorie={kat}
          personen={personen.filter((p) => p.aktiv)}
          vorhanden={new Set(teilnehmer.map((e) => e.personId))}
          onClose={() => setAddOpen(false)}
          onAdded={reloadEintr}
        />
      )}

      {detailPerson != null && detailEintrag && kat.kind === "zeit" && (
        <ZeitDialog
          kat={kat}
          eintrag={detailEintrag}
          person={personById.get(detailPerson)!}
          messungen={messungen}
          disziplinId={kat.disziplin ? disziplinIdByName.get(kat.disziplin) : undefined}
          onClose={() => setDetailPerson(null)}
          onChanged={reloadAll}
          onRemove={async () => { await removeTeilnehmer(detailEintrag); setDetailPerson(null); }}
        />
      )}
      {detailPerson != null && detailEintrag && kat.kind === "knoten" && (
        <KnotenDialog
          kat={kat}
          eintrag={detailEintrag}
          person={personById.get(detailPerson)!}
          messungen={messungen}
          disziplinIdByName={disziplinIdByName}
          onClose={() => setDetailPerson(null)}
          onChanged={reloadAll}
          onRemove={async () => { await removeTeilnehmer(detailEintrag); setDetailPerson(null); }}
        />
      )}
    </>
  );
}

// ── Zeit-Kategorien ──
function ZeitTabelle({
  teilnehmer,
  personById,
  messungen,
  disziplinId,
  onOpen,
}: {
  kat: TrainingKategorie;
  teilnehmer: TrainingEintrag[];
  personById: Map<number, Person>;
  messungen: Messung[];
  disziplinId: number | undefined;
  onOpen: (personId: number) => void;
}) {
  const { sort, toggle } = useSort();
  const rows = teilnehmer.map((e) => {
    const p = personById.get(e.personId);
    return { e, p, agg: aggFor(messungen, e.personId, disziplinId), note: e.notiz };
  });
  const ranked = [...rows].sort((a, b) => (a.agg?.best ?? Infinity) - (b.agg?.best ?? Infinity));
  const rankByPerson = new Map(ranked.map((r, i) => [r.e.personId, r.agg ? i + 1 : null]));
  const sorted = sortRows(rows, sort, (r, key) => {
    switch (key) {
      case "rang": return rankByPerson.get(r.e.personId);
      case "person": return r.p ? `${r.p.nachname} ${r.p.vorname}` : "";
      case "best": return r.agg?.best ?? null;
      case "schnitt": return r.agg?.avg ?? null;
      case "letzte": return r.agg?.last ?? null;
      case "notiz": return r.note ?? null;
      default: return null;
    }
  });
  return (
    <div className="hidden lg:block" style={{ padding: "0 18px" }}>
      <table className="table">
        <thead>
          <tr>
            <Th sortKey="rang" sort={sort} onSort={toggle} style={{ width: 34 }}>#</Th>
            <Th sortKey="person" sort={sort} onSort={toggle}>Person</Th>
            <Th sortKey="best" sort={sort} onSort={toggle} align="center">Bestzeit</Th>
            <Th sortKey="schnitt" sort={sort} onSort={toggle} align="center">Ø Zeit</Th>
            <Th sortKey="letzte" sort={sort} onSort={toggle} align="center">Letzte</Th>
            <th>Verlauf</th>
            <Th sortKey="notiz" sort={sort} onSort={toggle}>Notiz</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.e.personId} onClick={() => onOpen(r.e.personId)} style={{ cursor: "pointer" }}>
              <td style={{ color: "var(--color-neutral-500)", fontWeight: 600 }}>{rankByPerson.get(r.e.personId) ?? "—"}</td>
              <td style={{ fontSize: 14 }}>{r.p ? personName(r.p) : "?"}</td>
              <td style={{ textAlign: "center" }}>{r.agg ? <b style={{ color: "var(--color-accent-200)", fontSize: 15 }}>{r.agg.best}s</b> : "—"}</td>
              <td style={{ textAlign: "center", color: "var(--color-neutral-400)" }}>{r.agg ? `${r.agg.avg.toFixed(1)}s` : "—"}</td>
              <td style={{ textAlign: "center", color: "var(--color-neutral-400)" }}>{r.agg ? `${r.agg.last}s` : "—"}</td>
              <td>{r.agg ? <Sparkline werte={r.agg.werte} /> : <span style={{ color: "var(--color-neutral-600)" }}>—</span>}</td>
              <td style={{ fontSize: 13, color: "var(--color-neutral-400)", maxWidth: 220 }}>{r.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile */}
      <MobileCards rows={ranked.map((r) => ({ personId: r.e.personId, p: r.p, agg: r.agg, note: r.note, rank: rankByPerson.get(r.e.personId) }))} onOpen={onOpen} />
    </div>
  );
}

function MobileCards({
  rows,
  onOpen,
}: {
  rows: { personId: number; p: Person | undefined; agg: Agg | null; note: string | null; rank: number | null | undefined }[];
  onOpen: (personId: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 lg:hidden" style={{ padding: "4px 0 16px" }}>
      {rows.map((r) => (
        <div key={r.personId} className="panel" style={{ padding: "12px 14px", cursor: "pointer" }} onClick={() => onOpen(r.personId)}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 16, fontSize: 11, fontWeight: 700, color: "var(--color-neutral-500)" }}>{r.rank ?? "—"}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.p ? personName(r.p) : "?"}</span>
            {r.agg && <Sparkline werte={r.agg.werte} w={70} h={22} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--color-divider)" }}>
            {r.agg ? (
              <>
                <div><span style={{ font: "600 15px/1 var(--font-heading)", color: "var(--color-accent-200)" }}>{r.agg.best}s</span> <span style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>best</span></div>
                <div><span style={{ font: "600 14px/1 var(--font-heading)" }}>{r.agg.avg.toFixed(1)}s</span> <span style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>Ø</span></div>
                <div><span style={{ font: "600 14px/1 var(--font-heading)" }}>{r.agg.last}s</span> <span style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>letzte</span></div>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>Noch keine Zeit — tippen zum Erfassen</span>
            )}
          </div>
          {r.note && <div style={{ fontSize: 11, color: "var(--color-neutral-500)", marginTop: 7 }}><i className="ph ph-note" /> {r.note}</div>}
        </div>
      ))}
    </div>
  );
}

// ── Knoten ──
function KnotenTabelle({
  kat,
  teilnehmer,
  personById,
  messungen,
  disziplinIdByName,
  onOpen,
}: {
  kat: TrainingKategorie;
  teilnehmer: TrainingEintrag[];
  personById: Map<number, Person>;
  messungen: Messung[];
  disziplinIdByName: Map<string, number>;
  onOpen: (personId: number) => void;
}) {
  const knoten = kat.disziplinen ?? [];
  const rows = [...teilnehmer].sort((a, b) => {
    const pa = personById.get(a.personId), pb = personById.get(b.personId);
    return (pa ? `${pa.nachname} ${pa.vorname}` : "").localeCompare(pb ? `${pb.nachname} ${pb.vorname}` : "");
  });
  return (
    <div className="hidden lg:block" style={{ padding: "0 18px" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Person</th>
            <th>Knoten</th>
            <th style={{ textAlign: "center" }}>Bestzeit</th>
            <th style={{ textAlign: "center" }}>Ø Zeit</th>
            <th style={{ textAlign: "center" }}>Letzte</th>
            <th>Verlauf</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const p = personById.get(e.personId);
            return knoten.map((kn, i) => {
              const agg = aggFor(messungen, e.personId, disziplinIdByName.get(kn));
              return (
                <tr key={`${e.personId}:${kn}`} onClick={() => onOpen(e.personId)} style={{ cursor: "pointer" }}>
                  {i === 0 && (
                    <td rowSpan={knoten.length} style={{ fontSize: 14, fontWeight: 500, verticalAlign: "top", borderRight: "1px solid var(--color-divider)" }}>
                      {p ? personName(p) : "?"}
                      {e.notiz && <div style={{ fontSize: 11, color: "var(--color-neutral-500)", marginTop: 4, maxWidth: 160 }}><i className="ph ph-note" /> {e.notiz}</div>}
                    </td>
                  )}
                  <td style={{ fontSize: 13 }}>{kn}</td>
                  <td style={{ textAlign: "center" }}>{agg ? <b style={{ color: "var(--color-accent-200)" }}>{agg.best}s</b> : "—"}</td>
                  <td style={{ textAlign: "center", color: "var(--color-neutral-400)" }}>{agg ? `${agg.avg.toFixed(1)}s` : "—"}</td>
                  <td style={{ textAlign: "center", color: "var(--color-neutral-400)" }}>{agg ? `${agg.last}s` : "—"}</td>
                  <td>{agg ? <Sparkline werte={agg.werte} /> : <span style={{ color: "var(--color-neutral-600)" }}>—</span>}</td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>

      {/* Mobile */}
      <div className="flex flex-col gap-2 lg:hidden" style={{ padding: "4px 0 16px" }}>
        {rows.map((e) => {
          const p = personById.get(e.personId);
          return (
            <div key={e.personId} className="panel" style={{ padding: "12px 14px", cursor: "pointer" }} onClick={() => onOpen(e.personId)}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{p ? personName(p) : "?"}</div>
              {knoten.map((kn) => {
                const agg = aggFor(messungen, e.personId, disziplinIdByName.get(kn));
                return (
                  <div key={kn} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "3px 0" }}>
                    <span style={{ flex: 1, color: "var(--color-neutral-300)" }}>{kn}</span>
                    <span style={{ color: "var(--color-accent-200)", fontWeight: 600 }}>{agg ? `${agg.best}s` : "—"}</span>
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

// ── Statische Kategorien (Wassergraben / Leinbeutel) ──
function StatischTabelle({
  kat,
  teilnehmer,
  personById,
  onSetWert,
  onRemove,
}: {
  kat: TrainingKategorie;
  teilnehmer: TrainingEintrag[];
  personById: Map<number, Person>;
  onSetWert: (personId: number, wert: string | null) => void;
  onRemove: (e: TrainingEintrag) => void;
}) {
  const options: { value: string; label: string }[] =
    kat.kind === "wassergraben"
      ? WASSERGRABEN_WERTE.map((w) => ({ value: w, label: WASSERGRABEN_LABELS[w] }))
      : LEINBEUTEL_WERTE.map((w) => ({ value: w, label: LEINBEUTEL_LABELS[w] }));
  const rows = [...teilnehmer].sort((a, b) => {
    const pa = personById.get(a.personId), pb = personById.get(b.personId);
    return (pa ? `${pa.nachname} ${pa.vorname}` : "").localeCompare(pb ? `${pb.nachname} ${pb.vorname}` : "");
  });
  return (
    <div style={{ padding: "0 18px" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Person</th>
            <th>{kat.kind === "wassergraben" ? "Erreicht" : "Ergebnis"}</th>
            <th style={{ width: 44 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const p = personById.get(e.personId);
            return (
              <tr key={e.personId}>
                <td style={{ fontSize: 14 }}>{p ? personName(p) : "?"}</td>
                <td>
                  <select
                    className="input"
                    style={{ maxWidth: 260 }}
                    value={e.wert ?? ""}
                    onChange={(ev) => onSetWert(e.personId, ev.target.value || null)}
                  >
                    <option value="">— nicht eingetragen —</option>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>
                <td style={{ textAlign: "center" }}>
                  <button
                    title="Teilnehmer entfernen"
                    onClick={() => onRemove(e)}
                    style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--color-neutral-500)", padding: 4 }}
                  >
                    <i className="ph ph-trash" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Sparkline({ werte, w = 88, h = 26 }: { werte: number[]; w?: number; h?: number }) {
  if (werte.length < 2) return <span style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>—</span>;
  const max = Math.max(...werte);
  const min = Math.min(...werte);
  const pts = werte.map((v, i) => `${((i / (werte.length - 1)) * w).toFixed(1)},${(h - ((v - min) / (max - min || 1)) * h).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--color-accent-400)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function fmtDatum(iso: string) {
  return fmtDate(iso);
}

// ── Dialoge ──
function AddDialog({
  kategorie,
  personen,
  vorhanden,
  onClose,
  onAdded,
}: {
  kategorie: TrainingKategorie;
  personen: Person[];
  vorhanden: Set<number>;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const verfuegbar = personen
    .filter((p) => !vorhanden.has(p.id) && !added.has(p.id))
    .sort((a, b) => a.nachname.localeCompare(b.nachname));

  async function add(id: number) {
    setBusyId(id);
    await api("/training-eintraege", {
      method: "PUT",
      body: JSON.stringify({ personId: id, kategorie: kategorie.key, notiz: null, wert: null }),
    });
    setAdded((prev) => new Set(prev).add(id));
    setBusyId(null);
    onAdded();
  }

  return (
    <Dialog title={`Personen hinzufügen — ${kategorie.label}`} onClose={onClose}>
      {added.size > 0 && (
        <div style={{ fontSize: 12, color: "var(--color-accent-200)", marginBottom: 8 }}>
          <i className="ph ph-check" /> {added.size} hinzugefügt
        </div>
      )}
      {verfuegbar.length === 0 ? (
        <Empty icon="ph-users-three" text="Alle aktiven Personen sind bereits dabei" />
      ) : (
        <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)", padding: "0 8px 6px" }}>Namen antippen zum Hinzufügen</div>
          {verfuegbar.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              disabled={busyId === p.id}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 8,
                border: 0, background: "var(--color-surface)", color: "inherit", cursor: "pointer",
                fontSize: 14, textAlign: "left", width: "100%",
              }}
            >
              <i className="ph ph-plus-circle" style={{ color: "var(--color-accent-300)", fontSize: 17, flex: "none" }} />
              {personName(p)}
            </button>
          ))}
        </div>
      )}
      <div className="dialog-actions">
        <button className="btn btn-secondary" onClick={onClose}>Fertig</button>
      </div>
    </Dialog>
  );
}

function ZeitDialog({
  kat,
  eintrag,
  person,
  messungen,
  disziplinId,
  onClose,
  onChanged,
  onRemove,
}: {
  kat: TrainingKategorie;
  eintrag: TrainingEintrag;
  person: Person;
  messungen: Messung[];
  disziplinId: number | undefined;
  onClose: () => void;
  onChanged: () => void;
  onRemove: () => void;
}) {
  const [notiz, setNotiz] = useState(eintrag.notiz ?? "");
  const [datum, setDatum] = useState(heute());
  const [wert, setWert] = useState("");
  const [busy, setBusy] = useState(false);

  const eintraege = messungen
    .filter((m) => m.personId === person.id && m.disziplinId === disziplinId && m.wertSekunden != null)
    .sort((a, b) => b.datum.localeCompare(a.datum));
  const werte = eintraege.map((m) => m.wertSekunden!);
  const best = werte.length ? Math.min(...werte) : null;

  async function saveNotiz() {
    await api("/training-eintraege", {
      method: "PUT",
      body: JSON.stringify({ personId: person.id, kategorie: kat.key, notiz: notiz || null, wert: null }),
    });
  }

  async function addZeit() {
    if (!wert || disziplinId == null) return;
    setBusy(true);
    await api("/messungen", {
      method: "POST",
      body: JSON.stringify({ personId: person.id, disziplinId, datum, wertSekunden: Number(wert.replace(",", ".")), wertText: null, notiz: null }),
    });
    setWert("");
    setBusy(false);
    onChanged();
  }

  async function del(id: number) {
    await api(`/messungen/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <Dialog title={`${personName(person)} — ${kat.label}`} onClose={async () => { await saveNotiz(); onChanged(); onClose(); }}>
      <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 4 }}>
        <div className="field">
          <label>Notiz (pro Person)</label>
          <textarea className="input" placeholder="z. B. verhaspelt sich mit dem Knoten" value={notiz} onChange={(e) => setNotiz(e.target.value)} onBlur={saveNotiz} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label>Datum</label>
            <DatePicker value={datum} onChange={setDatum} clearable={false} />
          </div>
          <div className="field">
            <label>Zeit (Sekunden)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" inputMode="decimal" className="input" placeholder="z. B. 14.2" value={wert} onChange={(e) => setWert(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addZeit()} />
              <button className="btn btn-primary" onClick={addZeit} disabled={!wert || busy}><i className="ph ph-plus" /></button>
            </div>
          </div>
        </div>
      </div>

      {eintraege.length > 0 && (
        <div style={{ overflowY: "auto", maxHeight: "45vh", margin: "0 -4px", padding: "0 4px" }}>
          <table className="table" style={{ marginTop: 4 }}>
            <thead>
              <tr><th>Datum</th><th style={{ textAlign: "center" }}>Zeit</th><th style={{ width: 40 }} /></tr>
            </thead>
            <tbody>
              {eintraege.map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDatum(m.datum)}</td>
                  <td style={{ textAlign: "center" }}><b style={{ color: m.wertSekunden === best ? "var(--color-accent-200)" : "inherit" }}>{m.wertSekunden}s</b></td>
                  <td style={{ textAlign: "center" }}>
                    <button title="Zeit löschen" onClick={() => del(m.id)} style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--color-neutral-500)", padding: 4 }}>
                      <i className="ph ph-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="dialog-actions" style={{ position: "sticky", bottom: 0, zIndex: 1, background: "var(--color-surface)", paddingTop: 8 }}>
        <button className="btn btn-danger" onClick={onRemove} style={{ marginRight: "auto" }}><i className="ph ph-user-minus" />Teilnehmer entfernen</button>
        <button className="btn btn-secondary" onClick={async () => { await saveNotiz(); onChanged(); onClose(); }}>Schließen</button>
      </div>
    </Dialog>
  );
}

function KnotenDialog({
  kat,
  eintrag,
  person,
  messungen,
  disziplinIdByName,
  onClose,
  onChanged,
  onRemove,
}: {
  kat: TrainingKategorie;
  eintrag: TrainingEintrag;
  person: Person;
  messungen: Messung[];
  disziplinIdByName: Map<string, number>;
  onClose: () => void;
  onChanged: () => void;
  onRemove: () => void;
}) {
  const knoten = kat.disziplinen ?? [];
  const [notiz, setNotiz] = useState(eintrag.notiz ?? "");
  const [datum, setDatum] = useState(heute());
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function saveNotiz() {
    await api("/training-eintraege", {
      method: "PUT",
      body: JSON.stringify({ personId: person.id, kategorie: kat.key, notiz: notiz || null, wert: null }),
    });
  }

  async function speichern() {
    setBusy(true);
    await saveNotiz();
    for (const kn of knoten) {
      const v = werte[kn];
      const disziplinId = disziplinIdByName.get(kn);
      if (v && disziplinId != null) {
        await api("/messungen", {
          method: "POST",
          body: JSON.stringify({ personId: person.id, disziplinId, datum, wertSekunden: Number(v.replace(",", ".")), wertText: null, notiz: null }),
        });
      }
    }
    setWerte({});
    setBusy(false);
    onChanged();
  }

  async function del(id: number) {
    await api(`/messungen/${id}`, { method: "DELETE" });
    onChanged();
  }

  const hatEingabe = knoten.some((kn) => werte[kn]);

  return (
    <Dialog title={`${personName(person)} — Knoten`} onClose={async () => { await saveNotiz(); onChanged(); onClose(); }}>
      <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 4 }}>
        <div className="field">
          <label>Notiz (pro Person)</label>
          <textarea className="input" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
        </div>
        <div className="field">
          <label>Datum</label>
          <DatePicker value={datum} onChange={setDatum} clearable={false} />
        </div>
      </div>

      <div style={{ overflowY: "auto", maxHeight: "45vh", margin: "0 -4px", padding: "0 4px" }}>
      {knoten.map((kn) => {
        const disziplinId = disziplinIdByName.get(kn);
        const eintraege = messungen
          .filter((m) => m.personId === person.id && m.disziplinId === disziplinId && m.wertSekunden != null)
          .sort((a, b) => b.datum.localeCompare(a.datum));
        const vals = eintraege.map((m) => m.wertSekunden!);
        const best = vals.length ? Math.min(...vals) : null;
        return (
          <div key={kn} style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--color-divider)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{kn}</span>
              <input
                type="text"
                inputMode="decimal"
                className="input"
                style={{ maxWidth: 120 }}
                placeholder="Sek."
                value={werte[kn] ?? ""}
                onChange={(e) => setWerte((prev) => ({ ...prev, [kn]: e.target.value }))}
              />
            </div>
            {eintraege.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {eintraege.map((m) => (
                  <span key={m.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, background: "var(--color-neutral-800)", borderRadius: 6, padding: "2px 6px" }}>
                    <b style={{ color: m.wertSekunden === best ? "var(--color-accent-200)" : "inherit" }}>{m.wertSekunden}s</b>
                    <span style={{ color: "var(--color-neutral-500)" }}>{fmtDatum(m.datum)}</span>
                    <button title="löschen" onClick={() => del(m.id)} style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--color-neutral-500)", padding: 0 }}>
                      <i className="ph ph-x" style={{ fontSize: 12 }} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
      </div>

      <div className="dialog-actions" style={{ position: "sticky", bottom: 0, zIndex: 1, background: "var(--color-surface)", paddingTop: 8 }}>
        <button className="btn btn-danger" onClick={onRemove} style={{ marginRight: "auto" }}><i className="ph ph-user-minus" />Teilnehmer entfernen</button>
        <button className="btn btn-secondary" onClick={async () => { await saveNotiz(); onChanged(); onClose(); }}>Schließen</button>
        <button className="btn btn-primary" onClick={speichern} disabled={busy || (!hatEingabe && notiz === (eintrag.notiz ?? ""))}>
          <i className="ph ph-check" />Speichern
        </button>
      </div>
    </Dialog>
  );
}
