"use client";

import { useMemo, useState } from "react";
import { api, useApi, Person, Disziplin, Messung, personName } from "@/lib/api";
import { Avatar, DatePicker, Dialog, Empty, PageHeader, Spinner } from "@/components/ui";

export default function TrainingPage() {
  const { data: personen } = useApi<Person[]>("/personen");
  const { data: disziplinen, reload: reloadDis } = useApi<Disziplin[]>("/disziplinen");
  const { data: messungen, reload } = useApi<Messung[]>("/messungen");
  const [aktiveDisId, setAktiveDisId] = useState<number | null>(null);
  const [neueDis, setNeueDis] = useState<string | null>(null);
  const [erfassen, setErfassen] = useState(false);

  const disId = aktiveDisId ?? disziplinen?.[0]?.id ?? null;

  const personById = useMemo(() => new Map((personen ?? []).map((p) => [p.id, p])), [personen]);

  const rows = useMemo(() => {
    if (!messungen || disId == null) return [];
    const byPerson = new Map<number, Messung[]>();
    messungen.filter((m) => m.disziplinId === disId && m.wertSekunden != null).forEach((m) => {
      const arr = byPerson.get(m.personId) ?? [];
      arr.push(m);
      byPerson.set(m.personId, arr);
    });
    const out = [...byPerson.entries()].map(([personId, ms]) => {
      const sorted = [...ms].sort((a, b) => a.datum.localeCompare(b.datum));
      const werte = sorted.map((m) => m.wertSekunden!);
      const best = Math.min(...werte);
      const last = werte[werte.length - 1];
      const lastNote = [...sorted].reverse().find((m) => m.notiz)?.notiz ?? "—";
      return { personId, best, last, werte, note: lastNote };
    });
    return out.sort((a, b) => a.best - b.best);
  }, [messungen, disId]);

  if (!personen || !disziplinen || !messungen) return <Spinner />;

  const aktiveDis = disziplinen.find((d) => d.id === disId);

  async function addDis() {
    if (!neueDis?.trim()) return;
    await api("/disziplinen", { method: "POST", body: JSON.stringify({ name: neueDis.trim() }) });
    setNeueDis(null);
    reloadDis();
  }

  return (
    <>
      <PageHeader title="Training" sub={aktiveDis ? `${aktiveDis.name} · Bestzeiten & Verlauf` : "Zeiten erfassen & auswerten"}>
        <button className="btn btn-primary" onClick={() => setErfassen(true)} disabled={disId == null}>
          <i className="ph ph-stopwatch" />
          Zeit erfassen
        </button>
      </PageHeader>

      {/* Disziplin-Tabs */}
      <div style={{ padding: "14px 18px 6px", display: "flex", gap: 8, flexWrap: "wrap" }} className="lg:px-6">
        {disziplinen.map((d) => (
          <button
            key={d.id}
            className="ph-tag"
            onClick={() => setAktiveDisId(d.id)}
            style={{
              padding: "5px 12px", cursor: "pointer", border: 0,
              background: d.id === disId ? "var(--color-accent-800)" : "var(--color-neutral-800)",
              color: d.id === disId ? "var(--color-accent-100)" : "var(--color-neutral-300)",
            }}
          >
            {d.name}
          </button>
        ))}
        <button className="ph-tag" onClick={() => setNeueDis("")} style={{ padding: "5px 10px", border: "1px dashed var(--color-neutral-700)", background: "transparent", color: "var(--color-neutral-500)", cursor: "pointer" }}>
          <i className="ph ph-plus" />
        </button>
      </div>

      {disId == null ? (
        <Empty icon="ph-timer" text="Keine Disziplin" hint="Lege eine Disziplin an, um Zeiten zu erfassen." />
      ) : rows.length === 0 ? (
        <Empty icon="ph-stopwatch" text="Noch keine Zeiten" hint="Erfasse die erste Zeit über den Button oben." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Desktop-Tabelle */}
          <div className="hidden lg:block" style={{ padding: "6px 18px 0" }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 34 }}>#</th>
                  <th>Person</th>
                  <th style={{ textAlign: "center" }}>Bestzeit</th>
                  <th style={{ textAlign: "center" }}>Letzte</th>
                  <th>Verlauf</th>
                  <th>Notiz</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const p = personById.get(r.personId);
                  return (
                    <tr key={r.personId}>
                      <td style={{ color: "var(--color-neutral-500)", fontWeight: 600 }}>{i + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <Avatar name={p ? personName(p) : "?"} size={24} />
                          <span style={{ fontSize: 12.5 }}>{p ? personName(p) : "?"}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}><b style={{ color: "var(--color-accent-200)", fontSize: 13 }}>{r.best}s</b></td>
                      <td style={{ textAlign: "center", color: "var(--color-neutral-400)" }}>{r.last}s</td>
                      <td><Sparkline werte={r.werte} /></td>
                      <td style={{ fontSize: 11.5, color: "var(--color-neutral-400)", maxWidth: 220 }}>{r.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile-Karten */}
          <div className="flex flex-col gap-2 lg:hidden" style={{ padding: "4px 16px 16px" }}>
            {rows.map((r, i) => {
              const p = personById.get(r.personId);
              return (
                <div key={r.personId} className="panel" style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 16, fontSize: 11, fontWeight: 700, color: "var(--color-neutral-500)" }}>{i + 1}</span>
                    <Avatar name={p ? personName(p) : "?"} size={28} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p ? personName(p) : "?"}</span>
                    <Sparkline werte={r.werte} w={70} h={22} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--color-divider)" }}>
                    <div><span style={{ font: "600 15px/1 var(--font-heading)", color: "var(--color-accent-200)" }}>{r.best}s</span> <span style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>best</span></div>
                    <div><span style={{ font: "600 14px/1 var(--font-heading)" }}>{r.last}s</span> <span style={{ fontSize: 10, color: "var(--color-neutral-500)" }}>letzte</span></div>
                  </div>
                  {r.note !== "—" && <div style={{ fontSize: 11, color: "var(--color-neutral-500)", marginTop: 7 }}><i className="ph ph-note" /> {r.note}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {neueDis !== null && (
        <Dialog title="Neue Disziplin" onClose={() => setNeueDis(null)}>
          <div className="field">
            <label>Name</label>
            <input className="input" autoFocus placeholder="z. B. Handschuhe Anziehen" value={neueDis} onChange={(e) => setNeueDis(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDis()} />
          </div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setNeueDis(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={addDis} disabled={!neueDis.trim()}>Anlegen</button>
          </div>
        </Dialog>
      )}

      {erfassen && aktiveDis && (
        <ErfassenDialog
          disziplin={aktiveDis}
          personen={personen.filter((p) => p.aktiv)}
          onClose={() => setErfassen(false)}
          onSaved={() => { setErfassen(false); reload(); }}
        />
      )}
    </>
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

function ErfassenDialog({
  disziplin,
  personen,
  onClose,
  onSaved,
}: {
  disziplin: Disziplin;
  personen: Person[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [personId, setPersonId] = useState<string>("");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [wert, setWert] = useState("");
  const [wertText, setWertText] = useState("");
  const [notiz, setNotiz] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!personId) return;
    setBusy(true);
    await api("/messungen", {
      method: "POST",
      body: JSON.stringify({
        personId: Number(personId),
        disziplinId: disziplin.id,
        datum,
        wertSekunden: wert ? Number(wert.replace(",", ".")) : null,
        wertText: wertText || null,
        notiz: notiz || null,
      }),
    });
    onSaved();
  }

  return (
    <Dialog title={`Zeit erfassen — ${disziplin.name}`} onClose={onClose}>
      <div className="field">
        <label>Person</label>
        <select className="input" value={personId} onChange={(e) => setPersonId(e.target.value)}>
          <option value="">— wählen —</option>
          {personen.map((p) => (
            <option key={p.id} value={p.id}>{personName(p)}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label>Datum</label>
          <DatePicker value={datum} onChange={setDatum} clearable={false} />
        </div>
        <div className="field">
          <label>Zeit (Sekunden)</label>
          <input type="text" inputMode="decimal" className="input" placeholder="z. B. 14.2" value={wert} onChange={(e) => setWert(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>Freitext (falls keine genaue Zeit, z. B. „ca. 20s")</label>
        <input className="input" value={wertText} onChange={(e) => setWertText(e.target.value)} />
      </div>
      <div className="field">
        <label>Notiz</label>
        <textarea className="input" placeholder="z. B. verhaspelt sich mit dem Knoten" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
      </div>
      <div className="dialog-actions">
        <button className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button className="btn btn-primary" onClick={save} disabled={!personId || busy}>
          <i className="ph ph-check" />
          Speichern
        </button>
      </div>
    </Dialog>
  );
}
