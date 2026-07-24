"use client";

import { useMemo, useState } from "react";
import { api, useApi, Person, Termin, Gruppe, Gruppenmitglied, personName } from "@/lib/api";
import { Avatar, Dialog, Empty, PageHeader, Spinner } from "@/components/ui";
import { ALTERSKLASSEN } from "@/lib/domain/constants";
import { alterInDiesemJahr } from "@/lib/domain/alter";

export default function ZeltlagerPage() {
  const { data: personen } = useApi<Person[]>("/personen");
  const { data: termine } = useApi<Termin[]>("/termine");

  if (!personen || !termine) return <Spinner />;

  // Zeltlager-Termine: nur_gruppen mit "zeltlager" im Titel, sonst alle nur_gruppen
  const zeltTermine = termine.filter((t) => t.planungsmodus === "nur_gruppen");
  const zeltlager = zeltTermine.find((t) => /zeltlager/i.test(t.titel)) ?? zeltTermine[0];

  if (!zeltlager) {
    return (
      <>
        <PageHeader title="Zeltlager" />
        <Empty icon="ph-tent" text="Kein Zeltlager-Termin" hint={'Lege einen Termin mit Planungsmodus nur_gruppen an (z. B. „Kreiszeltlager").'} />
      </>
    );
  }

  return <ZeltlagerBoard termin={zeltlager} personen={personen.filter((p) => p.aktiv)} />;
}

function ZeltlagerBoard({ termin, personen }: { termin: Termin; personen: Person[] }) {
  const { data: planung, reload } = useApi<{ gruppen: Gruppe[]; mitglieder: Gruppenmitglied[] }>(`/termine/${termin.id}/planung`);
  const [addTo, setAddTo] = useState<Gruppe | null>(null);
  const [neueGruppe, setNeueGruppe] = useState<{ klasse: string; betreuer: string } | null>(null);

  const personById = useMemo(() => new Map(personen.map((p) => [p.id, p])), [personen]);
  const betreuer = personen.filter((p) => p.rolle === "betreuer");
  const jugend = personen.filter((p) => p.rolle === "jugendlich");

  if (!planung) return <Spinner />;

  const jahr = new Date().getFullYear();
  const zugeteilt = new Set(planung.mitglieder.map((m) => m.personId));

  async function addGruppe() {
    if (!neueGruppe) return;
    await api("/gruppen", {
      method: "POST",
      body: JSON.stringify({
        terminId: termin.id,
        name: neueGruppe.betreuer ? `Gruppe ${neueGruppe.betreuer.split(" ")[0]}` : `Gruppe ${planung!.gruppen.length + 1}`,
        altersklasse: neueGruppe.klasse,
        betreuerPersonId: neueGruppe.betreuer ? Number(neueGruppe.betreuer) : null,
      }),
    });
    setNeueGruppe(null);
    reload();
  }

  async function addMember(gruppeId: number, personId: number) {
    await api("/gruppenmitglieder", { method: "POST", body: JSON.stringify({ gruppeId, personId }) });
    reload();
  }

  return (
    <>
      <PageHeader title={termin.titel} sub="Einteilung nach Altersklassen · Stichtag Jahrgang">
        <button className="btn btn-primary" onClick={() => setNeueGruppe({ klasse: ALTERSKLASSEN[0], betreuer: "" })}>
          <i className="ph ph-plus" />
          Gruppe
        </button>
      </PageHeader>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 24px" }} className="lg:px-6">
        {planung.gruppen.length === 0 ? (
          <Empty icon="ph-tent" text="Noch keine Gruppen" hint="Lege eine Gruppe je Betreuer und Altersklasse an." />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {planung.gruppen.map((g) => {
              const members = planung.mitglieder.filter((m) => m.gruppeId === g.id);
              const betr = g.betreuerPersonId ? personById.get(g.betreuerPersonId) : null;
              return (
                <div key={g.id} className="panel" style={{ alignSelf: "start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 15px" }}>
                    <span style={{ width: 34, height: 34, flex: "none", borderRadius: 9, display: "grid", placeItems: "center", background: "var(--color-accent-2-800)", color: "var(--color-accent-2-100)" }}>
                      <i className="ph ph-user" />
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{betr ? personName(betr) : g.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--color-neutral-500)" }}>{betr ? "Betreuer:in" : `${members.length} Jugendliche`}</div>
                    </div>
                    <span className="ph-tag" style={{ background: "var(--color-neutral-800)", color: "var(--color-neutral-200)" }}>{g.altersklasse ?? "—"}</span>
                    <button className="btn btn-ghost" style={{ color: "var(--color-neutral-500)" }} onClick={async () => { if (confirm("Gruppe löschen?")) { await api(`/gruppen/${g.id}`, { method: "DELETE" }); reload(); } }}>
                      <i className="ph ph-trash" />
                    </button>
                  </div>
                  <div style={{ padding: "10px 15px 13px", borderTop: "1px solid var(--color-divider)", display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {members.map((m) => {
                      const p = personById.get(m.personId);
                      if (!p) return null;
                      return (
                        <span key={m.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 4px", background: "var(--color-bg)", borderRadius: 20, fontSize: 11.5 }}>
                          <Avatar name={personName(p)} size={22} />
                          {personName(p)}
                          <button onClick={async () => { await api(`/gruppenmitglieder/${m.id}`, { method: "DELETE" }); reload(); }} style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--color-neutral-600)", padding: 0 }}>
                            <i className="ph ph-x" style={{ fontSize: 11 }} />
                          </button>
                        </span>
                      );
                    })}
                    <button
                      onClick={() => setAddTo(g)}
                      style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: "50%", border: "1px dashed var(--color-neutral-700)", color: "var(--color-neutral-500)", background: "transparent", cursor: "pointer" }}
                      aria-label="Jugendliche hinzufügen"
                    >
                      <i className="ph ph-plus" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Neue Gruppe */}
      {neueGruppe && (
        <Dialog title="Neue Zeltlager-Gruppe" onClose={() => setNeueGruppe(null)}>
          <div className="field">
            <label>Altersklasse</label>
            <select className="input" value={neueGruppe.klasse} onChange={(e) => setNeueGruppe({ ...neueGruppe, klasse: e.target.value })}>
              {ALTERSKLASSEN.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Betreuer:in</label>
            <select className="input" value={neueGruppe.betreuer} onChange={(e) => setNeueGruppe({ ...neueGruppe, betreuer: e.target.value })}>
              <option value="">— ohne —</option>
              {betreuer.map((b) => (
                <option key={b.id} value={b.id}>{personName(b)}</option>
              ))}
            </select>
          </div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setNeueGruppe(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={addGruppe}>Anlegen</button>
          </div>
        </Dialog>
      )}

      {/* Jugendliche hinzufügen */}
      {addTo && (
        <Dialog title={`Jugendliche → ${addTo.betreuerPersonId ? personName(personById.get(addTo.betreuerPersonId)!) : addTo.name}`} onClose={() => setAddTo(null)}>
          <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
            Altersklasse {addTo.altersklasse} · Jahrgangs-Alter (Stichtag {jahr})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
            {jugend.filter((p) => !zugeteilt.has(p.id)).map((p) => (
              <button
                key={p.id}
                onClick={() => { addMember(addTo.id, p.id); setAddTo(null); }}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", background: "var(--color-bg)", borderRadius: 9, border: "1px solid var(--color-divider)", cursor: "pointer", color: "inherit", textAlign: "left" }}
              >
                <Avatar name={personName(p)} size={26} />
                <span style={{ flex: 1, fontSize: 13 }}>{personName(p)}</span>
                <span style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>{p.geburtsdatum ? `${alterInDiesemJahr(p.geburtsdatum)} J.` : ""}</span>
              </button>
            ))}
            {jugend.filter((p) => !zugeteilt.has(p.id)).length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--color-neutral-500)", padding: 8 }}>Alle Jugendlichen sind bereits eingeteilt.</div>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
