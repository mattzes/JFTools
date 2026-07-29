"use client";

import { useMemo, useState } from "react";
import { api, useApi, Person, Dokumententyp, Rueckmeldung, personName } from "@/lib/api";
import { Dialog, Empty, PageHeader, Spinner, SortArrow, Th, useSort, sortRows } from "@/components/ui";
import { ZIELGRUPPEN, Zielgruppe } from "@/lib/domain/constants";

const COLORS = ["var(--danger)", "var(--warn)", "var(--color-accent-400)", "var(--color-accent-2)"];

const ZIEL_LABEL: Record<Zielgruppe, string> = {
  alle: "alle",
  nur_betreuer: "nur Betreuer",
  nur_jugendliche: "nur Jugendliche",
};

// Ziel-Personen eines Dokumenttyps (aktive gefiltert nach Zielgruppe)
function inZielgruppe(p: Person, zielgruppe: string) {
  return zielgruppe === "nur_betreuer" ? p.rolle === "betreuer" : zielgruppe === "nur_jugendliche" ? p.rolle === "jugendlich" : true;
}

function RolleBadge({ rolle }: { rolle: Person["rolle"] }) {
  const betreuer = rolle === "betreuer";
  return (
    <span
      title={betreuer ? "Betreuer" : "Jugendlich"}
      style={{
        width: 18, height: 18, flex: "none", borderRadius: 5, display: "inline-grid", placeItems: "center",
        fontSize: 10, fontWeight: 700,
        ...(betreuer ? { background: "var(--color-accent-2-800)", color: "var(--color-accent-2-100)" } : { background: "var(--color-neutral-800)", color: "var(--color-neutral-200)" }),
      }}
    >
      {betreuer ? "B" : "J"}
    </span>
  );
}

export default function RueckmeldungenPage() {
  const { data: personen } = useApi<Person[]>("/personen");
  const { data: doks, reload: reloadDoks } = useApi<Dokumententyp[]>("/dokumententypen");
  const { data: rueck, reload } = useApi<Rueckmeldung[]>("/rueckmeldungen");
  const [neuerTyp, setNeuerTyp] = useState<{ name: string; zielgruppe: Zielgruppe } | null>(null);
  const [mobilDok, setMobilDok] = useState<Dokumententyp | null>(null);
  const [editMode, setEditMode] = useState(false);
  const { sort, toggle: onSort } = useSort();

  const map = useMemo(() => {
    const m = new Map<string, Rueckmeldung>();
    rueck?.forEach((r) => m.set(`${r.personId}:${r.dokumententypId}`, r));
    return m;
  }, [rueck]);

  if (!personen || !doks || !rueck) return <Spinner />;

  const aktive = personen.filter((p) => p.aktiv);
  const aktiveSortiert = sortRows(aktive, sort, (p, key) => {
    if (key === "name") return `${p.nachname} ${p.vorname}`;
    if (key.startsWith("d:")) {
      const did = Number(key.slice(2));
      const d = doks.find((x) => x.id === did);
      if (!d || !inZielgruppe(p, d.zielgruppe)) return null;
      return map.get(`${p.id}:${did}`)?.erhalten ? 0 : 1; // erhalten zuerst
    }
    return null;
  });

  async function setErhalten(personId: number, dokumententypId: number, erhalten: boolean) {
    await api("/rueckmeldungen", {
      method: "PUT",
      body: JSON.stringify({ personId, dokumententypId, erhalten, erhaltenAm: erhalten ? new Date().toISOString().slice(0, 10) : null }),
    });
    reload();
  }

  function toggle(personId: number, dokumententypId: number) {
    const cur = map.get(`${personId}:${dokumententypId}`);
    setErhalten(personId, dokumententypId, !(cur?.erhalten ?? false));
  }

  async function addTyp() {
    if (!neuerTyp?.name.trim()) return;
    await api("/dokumententypen", { method: "POST", body: JSON.stringify({ name: neuerTyp.name.trim(), zielgruppe: neuerTyp.zielgruppe }) });
    setNeuerTyp(null);
    reloadDoks();
  }

  const stats = doks.map((d, i) => {
    const ziel = aktive.filter((p) => inZielgruppe(p, d.zielgruppe));
    const da = ziel.filter((p) => map.get(`${p.id}:${d.id}`)?.erhalten).length;
    const fehlt = ziel.filter((p) => !map.get(`${p.id}:${d.id}`)?.erhalten).map((p) => p.vorname + " " + p.nachname[0] + ".");
    return { ...d, da, ges: ziel.length, pct: ziel.length ? Math.round((da / ziel.length) * 100) : 0, color: COLORS[i % COLORS.length], fehlt };
  });

  return (
    <>
      <PageHeader title="Checkliste" sub="Zettel & Einverständnis — wem fehlt noch was?">
        <button
          className={`hidden lg:inline-flex btn ${editMode ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setEditMode((v) => !v)}
        >
          <i className={`ph ${editMode ? "ph-check" : "ph-pencil-simple"}`} />
          {editMode ? "Bearbeiten fertig" : "Checkliste bearbeiten"}
        </button>
        <button className="btn btn-secondary" onClick={() => setNeuerTyp({ name: "", zielgruppe: "alle" })}>
          <i className="ph ph-plus" />
          Checkliste hinzufügen
        </button>
      </PageHeader>

      {aktive.length === 0 ? (
        <Empty icon="ph-clipboard-text" text="Keine Personen" hint="Lege zuerst Personen an." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Übersichtskacheln */}
          <div className="hidden lg:flex gap-3 overflow-x-auto" style={{ padding: "16px 18px 8px" }}>
            {stats.map((d) => (
              <div key={d.id} className="kpi" style={{ minWidth: 180, gap: 9 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{d.name}</span>
                  {d.zielgruppe !== "alle" && (
                    <span className="ph-tag" style={{ background: "var(--color-neutral-800)", color: "var(--color-neutral-300)", fontSize: 9.5 }}>{ZIEL_LABEL[d.zielgruppe]}</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span className="kpi-n" style={{ fontSize: 22 }}>{d.da}</span>
                  <span style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>/ {d.ges} erhalten</span>
                </div>
                <div className="av-bar"><div className="av-fill" style={{ width: `${d.pct}%`, background: d.color }} /></div>
              </div>
            ))}
          </div>

          {/* Desktop-Matrix */}
          <div className="hidden lg:block" style={{ padding: "6px 18px 0", overflowX: "auto" }}>
            <table
              className="table"
              style={editMode ? { boxShadow: "0 0 0 1.5px var(--color-accent-800)", borderRadius: 12 } : undefined}
            >
              <thead>
                <tr>
                  <Th sortKey="name" sort={sort} onSort={onSort}>Name</Th>
                  {doks.map((d) => {
                    const aktiv = sort?.key === `d:${d.id}`;
                    return (
                      <th
                        key={d.id}
                        onClick={() => onSort(`d:${d.id}`)}
                        title="Klicken zum Sortieren"
                        style={{ textAlign: "center", cursor: "pointer", userSelect: "none" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          {d.name}
                          <SortArrow dir={aktiv ? sort!.dir : null} />
                        </div>
                        {d.zielgruppe !== "alle" && (
                          <div style={{ fontSize: 10, fontWeight: 400, color: "var(--color-neutral-500)", textTransform: "none", letterSpacing: 0 }}>{ZIEL_LABEL[d.zielgruppe]}</div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {aktiveSortiert.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <RolleBadge rolle={p.rolle} />
                        <span style={{ fontSize: 14 }}>{personName(p)}</span>
                      </span>
                    </td>
                    {doks.map((d) => {
                      if (!inZielgruppe(p, d.zielgruppe)) {
                        return <td key={d.id} style={{ textAlign: "center", color: "var(--color-neutral-800)" }}>·</td>;
                      }
                      const ok = map.get(`${p.id}:${d.id}`)?.erhalten ?? false;
                      const icon = <i className={`ph ${ok ? "ph-check-circle" : "ph-clock"}`} style={{ color: ok ? "var(--color-accent-300)" : "var(--warn)", fontSize: 21 }} />;
                      return (
                        <td key={d.id} style={{ textAlign: "center" }}>
                          {editMode ? (
                            <button
                              onClick={() => toggle(p.id, d.id)}
                              title={ok ? "erhalten — klicken zum Wechseln" : "offen — klicken zum Wechseln"}
                              style={{ display: "inline-grid", placeItems: "center", width: 36, height: 36, borderRadius: 9, background: "transparent", border: 0, cursor: "pointer", boxShadow: "inset 0 0 0 1px var(--color-neutral-600)" }}
                            >
                              {icon}
                            </button>
                          ) : (
                            <span style={{ display: "inline-grid", placeItems: "center", width: 36, height: 36 }} title={ok ? "erhalten" : "offen"}>
                              {icon}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: pro Dokumenttyp eine Karte */}
          <div className="flex flex-col gap-3 lg:hidden" style={{ padding: "16px 16px 16px" }}>
            {stats.map((d) => (
              <button
                key={d.id}
                className="panel"
                onClick={() => setMobilDok(d)}
                title="Checkliste bearbeiten"
                style={{ padding: "14px 16px", textAlign: "left", color: "inherit", font: "inherit", cursor: "pointer", width: "100%" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{d.name}</span>
                    {d.zielgruppe !== "alle" && (
                      <span className="ph-tag" style={{ background: "var(--color-neutral-800)", color: "var(--color-neutral-300)", fontSize: 9.5 }}>{ZIEL_LABEL[d.zielgruppe]}</span>
                    )}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600 }}>
                    {d.da}/{d.ges}
                    <i className="ph ph-caret-right" style={{ color: "var(--color-neutral-500)" }} />
                  </span>
                </div>
                <div className="av-bar" style={{ height: 7, marginBottom: 10 }}>
                  <div className="av-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>
                  <i className="ph ph-clock" style={{ color: "var(--warn)" }} /> fehlt bei: {d.fehlt.length ? d.fehlt.join(", ") : "niemandem 🎉"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {neuerTyp !== null && (
        <Dialog title="Checkliste hinzufügen" onClose={() => setNeuerTyp(null)}>
          <div className="field">
            <label>Name</label>
            <input className="input" autoFocus placeholder="z. B. Gesundheitsbogen Zeltlager" value={neuerTyp.name} onChange={(e) => setNeuerTyp({ ...neuerTyp, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addTyp()} />
          </div>
          <div className="field">
            <label>Zielgruppe</label>
            <select className="input" value={neuerTyp.zielgruppe} onChange={(e) => setNeuerTyp({ ...neuerTyp, zielgruppe: e.target.value as Zielgruppe })}>
              {ZIELGRUPPEN.map((z) => (
                <option key={z} value={z}>{ZIEL_LABEL[z]}</option>
              ))}
            </select>
          </div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setNeuerTyp(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={addTyp} disabled={!neuerTyp.name.trim()}>Anlegen</button>
          </div>
        </Dialog>
      )}

      {mobilDok && (
        <Dialog title={mobilDok.name} onClose={() => setMobilDok(null)} fullscreenMobile>
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ marginBottom: 0 }}>
              Wer hat abgegeben?
              {mobilDok.zielgruppe !== "alle" && <> · {ZIEL_LABEL[mobilDok.zielgruppe]}</>}
            </label>
          </div>
          <div className="dialog-scroll-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {aktive
              .filter((p) => inZielgruppe(p, mobilDok.zielgruppe))
              .slice()
              .sort((a, b) => `${a.nachname} ${a.vorname}`.localeCompare(`${b.nachname} ${b.vorname}`))
              .map((p) => {
                const ok = map.get(`${p.id}:${mobilDok.id}`)?.erhalten ?? false;
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <RolleBadge rolle={p.rolle} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{personName(p)}</span>
                    <div className="seg" style={{ fontSize: 11, flex: "none" }}>
                      <button className="seg-opt" data-on={ok} onClick={() => setErhalten(p.id, mobilDok.id, true)}>Erhalten</button>
                      <button className="seg-opt" data-on={!ok} onClick={() => setErhalten(p.id, mobilDok.id, false)}>Offen</button>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="dialog-actions">
            <button className="btn btn-primary" onClick={() => setMobilDok(null)}>
              <i className="ph ph-check" />
              Fertig
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
