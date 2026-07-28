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
  const [detailPerson, setDetailPerson] = useState<number | null>(null);

  const kat = TRAINING_KATEGORIEN.find((k) => k.key === aktiveKey) ?? TRAINING_KATEGORIEN[0];

  const personById = useMemo(() => new Map((personen ?? []).map((p) => [p.id, p])), [personen]);
  const disziplinIdByName = useMemo(() => new Map((disziplinen ?? []).map((d) => [d.name, d.id])), [disziplinen]);

  // Notiz/Wert je Person für die aktive Kategorie (nicht jede Person hat einen Eintrag)
  const eintragByPerson = useMemo(
    () => new Map((eintraege ?? []).filter((e) => e.kategorie === kat.key).map((e) => [e.personId, e])),
    [eintraege, kat.key],
  );
  // Standardmäßig werden ALLE aktiven Jugendlichen in jeder Kategorie angezeigt.
  const jugendliche = useMemo(
    () =>
      (personen ?? [])
        .filter((p) => p.aktiv && p.rolle === "jugendlich")
        .sort((a, b) => `${a.nachname} ${a.vorname}`.localeCompare(`${b.nachname} ${b.vorname}`)),
    [personen],
  );

  if (!personen || !disziplinen || !messungen || !eintraege) return <Spinner />;

  const reloadAll = () => {
    reloadMess();
    reloadEintr();
  };

  async function setWert(personId: number, wert: string | null) {
    await api("/training-eintraege", {
      method: "PUT",
      body: JSON.stringify({ personId, kategorie: kat.key, wert, notiz: null }),
    });
    reloadEintr();
  }

  const detailPersonObj = detailPerson != null ? personById.get(detailPerson) : undefined;
  const detailEintrag = detailPerson != null ? eintragByPerson.get(detailPerson) : undefined;

  return (
    <>
      {/* Kategorie-Umschaltung in der Kopfzeile (segmentiert wie Matrix/Liste bei Terminen) */}
      <PageHeader title="Training">
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
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
      </PageHeader>

      {jugendliche.length === 0 ? (
        <Empty icon="ph-users-three" text="Keine aktiven Jugendlichen" hint="Lege unter Personen aktive Jugendliche an." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {kat.kind === "zeit" && (
            <ZeitTabelle
              kat={kat}
              personen={jugendliche}
              eintragByPerson={eintragByPerson}
              messungen={messungen}
              disziplinId={kat.disziplin ? disziplinIdByName.get(kat.disziplin) : undefined}
              onOpen={setDetailPerson}
            />
          )}
          {kat.kind === "knoten" && (
            <KnotenTabelle
              kat={kat}
              personen={jugendliche}
              eintragByPerson={eintragByPerson}
              messungen={messungen}
              disziplinIdByName={disziplinIdByName}
              onOpen={setDetailPerson}
            />
          )}
          {kat.kind === "wassergraben" && (
            <StatischTabelle
              kat={kat}
              personen={jugendliche}
              eintragByPerson={eintragByPerson}
              onSetWert={setWert}
            />
          )}
          {kat.kind === "leinbeutel" && (
            <LeinbeutelTabelle
              personen={jugendliche}
              eintragByPerson={eintragByPerson}
              messungen={messungen}
              disziplinId={kat.disziplin ? disziplinIdByName.get(kat.disziplin) : undefined}
              onOpen={setDetailPerson}
            />
          )}
        </div>
      )}

      {detailPersonObj && kat.kind === "leinbeutel" && (
        <LeinbeutelDialog
          kat={kat}
          eintrag={detailEintrag}
          person={detailPersonObj}
          messungen={messungen}
          disziplinId={kat.disziplin ? disziplinIdByName.get(kat.disziplin) : undefined}
          onClose={() => setDetailPerson(null)}
          onChanged={reloadAll}
        />
      )}
      {detailPersonObj && kat.kind === "zeit" && (
        <ZeitDialog
          kat={kat}
          eintrag={detailEintrag}
          person={detailPersonObj}
          messungen={messungen}
          disziplinId={kat.disziplin ? disziplinIdByName.get(kat.disziplin) : undefined}
          onClose={() => setDetailPerson(null)}
          onChanged={reloadAll}
        />
      )}
      {detailPersonObj && kat.kind === "knoten" && (
        <KnotenDialog
          kat={kat}
          eintrag={detailEintrag}
          person={detailPersonObj}
          messungen={messungen}
          disziplinIdByName={disziplinIdByName}
          onClose={() => setDetailPerson(null)}
          onChanged={reloadAll}
        />
      )}
    </>
  );
}

// ── Zeit-Kategorien ──
function ZeitTabelle({
  personen,
  eintragByPerson,
  messungen,
  disziplinId,
  onOpen,
}: {
  kat: TrainingKategorie;
  personen: Person[];
  eintragByPerson: Map<number, TrainingEintrag>;
  messungen: Messung[];
  disziplinId: number | undefined;
  onOpen: (personId: number) => void;
}) {
  const { sort, toggle } = useSort();
  const rows = personen.map((p) => ({
    p,
    agg: aggFor(messungen, p.id, disziplinId),
    note: eintragByPerson.get(p.id)?.notiz ?? null,
  }));
  const ranked = [...rows].sort((a, b) => (a.agg?.best ?? Infinity) - (b.agg?.best ?? Infinity));
  const rankByPerson = new Map(ranked.map((r, i) => [r.p.id, r.agg ? i + 1 : null]));
  const sorted = sortRows(rows, sort, (r, key) => {
    switch (key) {
      case "rang": return rankByPerson.get(r.p.id);
      case "person": return `${r.p.nachname} ${r.p.vorname}`;
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
            <tr key={r.p.id} onClick={() => onOpen(r.p.id)} style={{ cursor: "pointer" }}>
              <td style={{ color: "var(--color-neutral-500)", fontWeight: 600 }}>{rankByPerson.get(r.p.id) ?? "—"}</td>
              <td style={{ fontSize: 14 }}>{personName(r.p)}</td>
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
      <MobileCards rows={ranked.map((r) => ({ personId: r.p.id, p: r.p, agg: r.agg, note: r.note, rank: rankByPerson.get(r.p.id) }))} onOpen={onOpen} />
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
  personen,
  eintragByPerson,
  messungen,
  disziplinIdByName,
  onOpen,
}: {
  kat: TrainingKategorie;
  personen: Person[];
  eintragByPerson: Map<number, TrainingEintrag>;
  messungen: Messung[];
  disziplinIdByName: Map<string, number>;
  onOpen: (personId: number) => void;
}) {
  const knoten = kat.disziplinen ?? [];
  const { sort, toggle } = useSort();
  const rows = sortRows([...personen], sort, (p, key) =>
    key === "person" ? `${p.nachname} ${p.vorname}` : null,
  );
  return (
    <div className="hidden lg:block" style={{ padding: "0 18px" }}>
      <table className="table">
        <thead>
          <tr>
            <Th sortKey="person" sort={sort} onSort={toggle}>Person</Th>
            <th>Knoten</th>
            <th style={{ textAlign: "center" }}>Bestzeit</th>
            <th style={{ textAlign: "center" }}>Ø Zeit</th>
            <th style={{ textAlign: "center" }}>Letzte</th>
            <th>Verlauf</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const notiz = eintragByPerson.get(p.id)?.notiz;
            return knoten.map((kn, i) => {
              const agg = aggFor(messungen, p.id, disziplinIdByName.get(kn));
              return (
                <tr key={`${p.id}:${kn}`} onClick={() => onOpen(p.id)} style={{ cursor: "pointer" }}>
                  {i === 0 && (
                    <td rowSpan={knoten.length} style={{ fontSize: 14, fontWeight: 500, verticalAlign: "top", borderRight: "1px solid var(--color-divider)" }}>
                      {personName(p)}
                      {notiz && <div style={{ fontSize: 11, color: "var(--color-neutral-500)", marginTop: 4, maxWidth: 160 }}><i className="ph ph-note" /> {notiz}</div>}
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
        {rows.map((p) => {
          return (
            <div key={p.id} className="panel" style={{ padding: "12px 14px", cursor: "pointer" }} onClick={() => onOpen(p.id)}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{personName(p)}</div>
              {knoten.map((kn) => {
                const agg = aggFor(messungen, p.id, disziplinIdByName.get(kn));
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
  personen,
  eintragByPerson,
  onSetWert,
}: {
  kat: TrainingKategorie;
  personen: Person[];
  eintragByPerson: Map<number, TrainingEintrag>;
  onSetWert: (personId: number, wert: string | null) => void;
}) {
  const { sort, toggle } = useSort();
  const options: { value: string; label: string }[] =
    kat.kind === "wassergraben"
      ? WASSERGRABEN_WERTE.map((w) => ({ value: w, label: WASSERGRABEN_LABELS[w] }))
      : LEINBEUTEL_WERTE.map((w) => ({ value: w, label: LEINBEUTEL_LABELS[w] }));
  // Custom-Reihenfolge: „nicht eingetragen" = niedrigster Wert (0), dann in Options-Reihenfolge
  // (Wassergraben: ohne Geräte → mit Verteiler → mit Schlauchpaket).
  const wertRang = new Map(options.map((o, i) => [o.value, i + 1]));
  const rows = sortRows([...personen], sort, (p, key) => {
    switch (key) {
      case "person": return `${p.nachname} ${p.vorname}`;
      case "wert": {
        const w = eintragByPerson.get(p.id)?.wert;
        return w != null ? wertRang.get(w) ?? 0 : 0;
      }
      default: return null;
    }
  });
  return (
    <div style={{ padding: "0 18px" }}>
      <table className="table">
        <thead>
          <tr>
            <Th sortKey="person" sort={sort} onSort={toggle}>Person</Th>
            <Th sortKey="wert" sort={sort} onSort={toggle}>{kat.kind === "wassergraben" ? "Erreicht" : "Ergebnis"}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td style={{ fontSize: 14 }}>{personName(p)}</td>
              <td>
                <select
                  className="input"
                  style={{ maxWidth: 260 }}
                  value={eintragByPerson.get(p.id)?.wert ?? ""}
                  onChange={(ev) => onSetWert(p.id, ev.target.value || null)}
                >
                  <option value="">— nicht eingetragen —</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Leinbeutelwerfen: Mehrfach-Würfe + Trefferstatistik ──
type LbStats = { total: number; treffer: number; zuKurz: number; vorbei: number; quote: number | null };
function leinbeutelStats(messungen: Messung[], personId: number, disziplinId: number | undefined): LbStats {
  if (disziplinId == null) return { total: 0, treffer: 0, zuKurz: 0, vorbei: 0, quote: null };
  const ms = messungen.filter((m) => m.personId === personId && m.disziplinId === disziplinId && m.wertText != null);
  const total = ms.length;
  const treffer = ms.filter((m) => m.wertText === "getroffen").length;
  const zuKurz = ms.filter((m) => m.wertText === "zu_kurz").length;
  const vorbei = ms.filter((m) => m.wertText === "vorbeigeworfen").length;
  return { total, treffer, zuKurz, vorbei, quote: total ? treffer / total : null };
}

function LeinbeutelTabelle({
  personen,
  eintragByPerson,
  messungen,
  disziplinId,
  onOpen,
}: {
  personen: Person[];
  eintragByPerson: Map<number, TrainingEintrag>;
  messungen: Messung[];
  disziplinId: number | undefined;
  onOpen: (personId: number) => void;
}) {
  const { sort, toggle } = useSort();
  const rows = personen.map((p) => ({ p, stats: leinbeutelStats(messungen, p.id, disziplinId), note: eintragByPerson.get(p.id)?.notiz ?? null }));
  const sorted = sortRows(rows, sort, (r, key) => {
    switch (key) {
      case "person": return `${r.p.nachname} ${r.p.vorname}`;
      case "wuerfe": return r.stats.total || null;
      case "treffer": return r.stats.treffer || null;
      case "zukurz": return r.stats.zuKurz || null;
      case "vorbei": return r.stats.vorbei || null;
      case "quote": return r.stats.quote;
      case "notiz": return r.note ?? null;
      default: return null;
    }
  });
  const pct = (q: number | null) => (q == null ? "—" : `${Math.round(q * 100)} %`);
  return (
    <div style={{ padding: "0 18px" }}>
      <table className="table">
        <thead>
          <tr>
            <Th sortKey="person" sort={sort} onSort={toggle}>Person</Th>
            <Th sortKey="wuerfe" sort={sort} onSort={toggle} align="center">Würfe</Th>
            <Th sortKey="treffer" sort={sort} onSort={toggle} align="center">Treffer</Th>
            <Th sortKey="zukurz" sort={sort} onSort={toggle} align="center">zu kurz</Th>
            <Th sortKey="vorbei" sort={sort} onSort={toggle} align="center">vorbei</Th>
            <Th sortKey="quote" sort={sort} onSort={toggle} align="center">Quote</Th>
            <Th sortKey="notiz" sort={sort} onSort={toggle}>Notiz</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.p.id} onClick={() => onOpen(r.p.id)} style={{ cursor: "pointer" }}>
              <td style={{ fontSize: 14 }}>{personName(r.p)}</td>
              <td style={{ textAlign: "center", color: "var(--color-neutral-400)" }}>{r.stats.total || "—"}</td>
              <td style={{ textAlign: "center" }}>{r.stats.total ? <b style={{ color: "var(--color-accent-200)" }}>{r.stats.treffer}</b> : "—"}</td>
              <td style={{ textAlign: "center", color: "var(--color-neutral-400)" }}>{r.stats.total ? r.stats.zuKurz : "—"}</td>
              <td style={{ textAlign: "center", color: "var(--color-neutral-400)" }}>{r.stats.total ? r.stats.vorbei : "—"}</td>
              <td style={{ textAlign: "center", fontWeight: 600 }}>{pct(r.stats.quote)}</td>
              <td style={{ fontSize: 13, color: "var(--color-neutral-400)", maxWidth: 200 }}>{r.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeinbeutelDialog({
  kat,
  eintrag,
  person,
  messungen,
  disziplinId,
  onClose,
  onChanged,
}: {
  kat: TrainingKategorie;
  eintrag: TrainingEintrag | undefined;
  person: Person;
  messungen: Messung[];
  disziplinId: number | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [notiz, setNotiz] = useState(eintrag?.notiz ?? "");
  const [datum, setDatum] = useState(heute());
  const [ergebnis, setErgebnis] = useState<string>(LEINBEUTEL_WERTE[0]);
  const [busy, setBusy] = useState(false);

  const wuerfe = messungen
    .filter((m) => m.personId === person.id && m.disziplinId === disziplinId && m.wertText != null)
    .sort((a, b) => b.datum.localeCompare(a.datum));
  const stats = leinbeutelStats(messungen, person.id, disziplinId);

  async function saveNotiz() {
    await api("/training-eintraege", {
      method: "PUT",
      body: JSON.stringify({ personId: person.id, kategorie: kat.key, notiz: notiz || null, wert: null }),
    });
  }

  async function addWurf() {
    if (disziplinId == null) return;
    setBusy(true);
    await api("/messungen", {
      method: "POST",
      body: JSON.stringify({ personId: person.id, disziplinId, datum, wertSekunden: null, wertText: ergebnis, notiz: null }),
    });
    setBusy(false);
    onChanged();
  }

  async function del(id: number) {
    await api(`/messungen/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <Dialog title={`${personName(person)} — Leinbeutelwerfen`} onClose={async () => { await saveNotiz(); onChanged(); onClose(); }}>
      <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--color-surface)", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 4 }}>
        {stats.total > 0 && (
          <div style={{ display: "flex", gap: 18 }}>
            <div><div style={{ font: "600 18px/1 var(--font-heading)", color: "var(--color-accent-200)" }}>{stats.treffer}/{stats.total}</div><div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>Treffer</div></div>
            <div><div style={{ font: "600 18px/1 var(--font-heading)" }}>{stats.quote != null ? `${Math.round(stats.quote * 100)} %` : "—"}</div><div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>Quote</div></div>
            <div><div style={{ font: "600 18px/1 var(--font-heading)" }}>{stats.zuKurz}·{stats.vorbei}</div><div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>zu kurz · vorbei</div></div>
          </div>
        )}
        <div className="field">
          <label>Notiz (pro Person)</label>
          <textarea className="input" value={notiz} onChange={(e) => setNotiz(e.target.value)} onBlur={saveNotiz} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label>Datum</label>
            <DatePicker value={datum} onChange={setDatum} clearable={false} />
          </div>
          <div className="field">
            <label>Ergebnis</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select className="input" value={ergebnis} onChange={(e) => setErgebnis(e.target.value)}>
                {LEINBEUTEL_WERTE.map((w) => (
                  <option key={w} value={w}>{LEINBEUTEL_LABELS[w]}</option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={addWurf} disabled={busy || disziplinId == null}><i className="ph ph-plus" /></button>
            </div>
          </div>
        </div>
        {disziplinId == null && (
          <div style={{ fontSize: 11.5, color: "var(--warn)" }}>
            <i className="ph ph-warning" /> Disziplin „Leinbeutelwerfen" nicht gefunden — bitte Seite neu laden.
          </div>
        )}
      </div>

      {wuerfe.length > 0 && (
        <div style={{ overflowY: "auto", maxHeight: "45vh", margin: "0 -4px", padding: "0 4px" }}>
          <table className="table" style={{ marginTop: 4 }}>
            <thead>
              <tr><th>Datum</th><th>Ergebnis</th><th style={{ width: 40 }} /></tr>
            </thead>
            <tbody>
              {wuerfe.map((m) => (
                <tr key={m.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDatum(m.datum)}</td>
                  <td style={{ color: m.wertText === "getroffen" ? "var(--color-accent-200)" : "var(--color-neutral-300)" }}>
                    {LEINBEUTEL_LABELS[m.wertText as keyof typeof LEINBEUTEL_LABELS] ?? m.wertText}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button title="Wurf löschen" onClick={() => del(m.id)} style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--color-neutral-500)", padding: 4 }}>
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
        <button className="btn btn-secondary" onClick={async () => { await saveNotiz(); onChanged(); onClose(); }}>Schließen</button>
      </div>
    </Dialog>
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
function ZeitDialog({
  kat,
  eintrag,
  person,
  messungen,
  disziplinId,
  onClose,
  onChanged,
}: {
  kat: TrainingKategorie;
  eintrag: TrainingEintrag | undefined;
  person: Person;
  messungen: Messung[];
  disziplinId: number | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [notiz, setNotiz] = useState(eintrag?.notiz ?? "");
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
}: {
  kat: TrainingKategorie;
  eintrag: TrainingEintrag | undefined;
  person: Person;
  messungen: Messung[];
  disziplinIdByName: Map<string, number>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const knoten = kat.disziplinen ?? [];
  const [notiz, setNotiz] = useState(eintrag?.notiz ?? "");
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
        <button className="btn btn-secondary" onClick={async () => { await saveNotiz(); onChanged(); onClose(); }}>Schließen</button>
        <button className="btn btn-primary" onClick={speichern} disabled={busy || (!hatEingabe && notiz === (eintrag?.notiz ?? ""))}>
          <i className="ph ph-check" />Speichern
        </button>
      </div>
    </Dialog>
  );
}
