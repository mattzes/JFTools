"use client";

import { useMemo, useState } from "react";
import { api, useApi, Person, Dokumententyp, Rueckmeldung, personName } from "@/lib/api";
import { Avatar, Dialog, Empty, PageHeader, Spinner } from "@/components/ui";

const COLORS = ["var(--danger)", "var(--warn)", "var(--color-accent-400)", "var(--color-accent-2)"];

export default function RueckmeldungenPage() {
  const { data: personen } = useApi<Person[]>("/personen");
  const { data: doks, reload: reloadDoks } = useApi<Dokumententyp[]>("/dokumententypen");
  const { data: rueck, reload } = useApi<Rueckmeldung[]>("/rueckmeldungen");
  const [neuerTyp, setNeuerTyp] = useState<string | null>(null);

  const map = useMemo(() => {
    const m = new Map<string, Rueckmeldung>();
    rueck?.forEach((r) => m.set(`${r.personId}:${r.dokumententypId}`, r));
    return m;
  }, [rueck]);

  if (!personen || !doks || !rueck) return <Spinner />;

  const jugend = personen.filter((p) => p.aktiv && p.rolle === "jugendlich");

  async function toggle(personId: number, dokumententypId: number) {
    const cur = map.get(`${personId}:${dokumententypId}`);
    const erhalten = !(cur?.erhalten ?? false);
    await api("/rueckmeldungen", {
      method: "PUT",
      body: JSON.stringify({ personId, dokumententypId, erhalten, erhaltenAm: erhalten ? new Date().toISOString().slice(0, 10) : null }),
    });
    reload();
  }

  async function addTyp() {
    if (!neuerTyp?.trim()) return;
    await api("/dokumententypen", { method: "POST", body: JSON.stringify({ name: neuerTyp.trim() }) });
    setNeuerTyp(null);
    reloadDoks();
  }

  const stats = doks.map((d, i) => {
    const da = jugend.filter((p) => map.get(`${p.id}:${d.id}`)?.erhalten).length;
    const fehlt = jugend.filter((p) => !map.get(`${p.id}:${d.id}`)?.erhalten).map((p) => p.vorname + " " + p.nachname[0] + ".");
    return { ...d, da, ges: jugend.length, pct: jugend.length ? Math.round((da / jugend.length) * 100) : 0, color: COLORS[i % COLORS.length], fehlt };
  });

  return (
    <>
      <PageHeader title="Rückmeldungen" sub="Zettel & Einverständnis — wem fehlt noch was?">
        <button className="btn btn-secondary" onClick={() => setNeuerTyp("")}>
          <i className="ph ph-plus" />
          Dokumenttyp
        </button>
      </PageHeader>

      {jugend.length === 0 ? (
        <Empty icon="ph-clipboard-text" text="Keine Jugendlichen" hint="Lege zuerst Personen an." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Übersichtskacheln */}
          <div className="flex gap-3 overflow-x-auto" style={{ padding: "16px 18px 8px" }}>
            {stats.map((d) => (
              <div key={d.id} className="kpi" style={{ minWidth: 180, gap: 9 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{d.name}</div>
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
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  {doks.map((d) => (
                    <th key={d.id} style={{ textAlign: "center" }}>{d.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jugend.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <Avatar name={personName(p)} size={24} />
                        <span style={{ fontSize: 12.5 }}>{personName(p)}</span>
                      </div>
                    </td>
                    {doks.map((d) => {
                      const ok = map.get(`${p.id}:${d.id}`)?.erhalten ?? false;
                      return (
                        <td key={d.id} style={{ textAlign: "center" }}>
                          <button onClick={() => toggle(p.id, d.id)} style={{ background: "transparent", border: 0, cursor: "pointer" }} title={ok ? "erhalten" : "offen"}>
                            <i className={`ph ${ok ? "ph-check-circle" : "ph-clock"}`} style={{ color: ok ? "var(--color-accent-300)" : "var(--warn)", fontSize: 18 }} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: pro Dokumenttyp eine Karte */}
          <div className="flex flex-col gap-3 lg:hidden" style={{ padding: "6px 16px 16px" }}>
            {stats.map((d) => (
              <div key={d.id} className="panel" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{d.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{d.da}/{d.ges}</span>
                </div>
                <div className="av-bar" style={{ height: 7, marginBottom: 10 }}>
                  <div className="av-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>
                  <i className="ph ph-clock" style={{ color: "var(--warn)" }} /> fehlt bei: {d.fehlt.length ? d.fehlt.join(", ") : "niemandem 🎉"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {neuerTyp !== null && (
        <Dialog title="Neuer Dokumenttyp" onClose={() => setNeuerTyp(null)}>
          <div className="field">
            <label>Name</label>
            <input className="input" autoFocus placeholder="z. B. Gesundheitsbogen Zeltlager" value={neuerTyp} onChange={(e) => setNeuerTyp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTyp()} />
          </div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setNeuerTyp(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={addTyp} disabled={!neuerTyp.trim()}>Anlegen</button>
          </div>
        </Dialog>
      )}
    </>
  );
}
