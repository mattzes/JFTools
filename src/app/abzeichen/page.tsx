"use client";

import { useState } from "react";
import { useApi, Person, personName } from "@/lib/api";
import { PageHeader, Spinner, Empty } from "@/components/ui";
import { leistungsspangeVorschlag, alterInDiesemJahr } from "@/lib/domain/alter";

type Filter = "alle" | "lsp" | "jf2" | "jf1";

export default function AbzeichenPage() {
  const { data: personen } = useApi<Person[]>("/personen");
  const [filter, setFilter] = useState<Filter>("alle");

  if (!personen) return <Spinner />;

  const jugend = personen.filter((p) => p.aktiv && p.rolle === "jugendlich");
  const jahr = new Date().getFullYear();

  // Fälligkeiten je Jahr ermitteln (Vorschlagslogik + noch nicht erledigt)
  type Eintrag = { jahr: number; typ: "Leistungsspange" | "Jugendflamme 2" | "Jugendflamme 1"; name: string };
  const eintraege: Eintrag[] = [];

  for (const p of jugend) {
    if (!p.geburtsdatum) continue;
    const gebJahr = new Date(p.geburtsdatum).getFullYear();
    const jga = alterInDiesemJahr(p.geburtsdatum);

    // Leistungsspange: nur wenn noch nicht absolviert → Vorschlag geburtsjahr+15
    if (!p.leistungsspangeDatum) {
      const y = leistungsspangeVorschlag(p.geburtsdatum);
      if (y >= jahr) eintraege.push({ jahr: y, typ: "Leistungsspange", name: personName(p) });
    }
    // JF2: fällig ab Jahrgangsalter 13, wenn noch nicht erledigt & JF1 vorhanden
    if (!p.jugendflamme2) {
      const y = Math.max(jahr, gebJahr + 13);
      if (p.jugendflamme1 || jga >= 13) eintraege.push({ jahr: y, typ: "Jugendflamme 2", name: personName(p) });
    }
    // JF1: fällig ab Jahrgangsalter 10, wenn noch nicht erledigt
    if (!p.jugendflamme1) {
      const y = Math.max(jahr, gebJahr + 10);
      eintraege.push({ jahr: y, typ: "Jugendflamme 1", name: personName(p) });
    }
  }

  const gefiltert = eintraege.filter((e) =>
    filter === "alle" ? true : filter === "lsp" ? e.typ === "Leistungsspange" : filter === "jf2" ? e.typ === "Jugendflamme 2" : e.typ === "Jugendflamme 1",
  );

  const jahre = [...new Set(gefiltert.map((e) => e.jahr))].sort((a, b) => a - b).slice(0, 6);

  return (
    <>
      <PageHeader title="Abzeichen — Fälligkeit" sub="Vorschlag automatisch (Leistungsspange = Geburtsjahr + 15), manuell überschreibbar">
        <div className="seg" style={{ fontSize: 12 }}>
          {([["alle", "Alle"], ["lsp", "Spange"], ["jf2", "JF2"], ["jf1", "JF1"]] as [Filter, string][]).map(([f, l]) => (
            <button key={f} className="seg-opt" data-on={filter === f} onClick={() => setFilter(f)}>{l}</button>
          ))}
        </div>
      </PageHeader>

      {jahre.length === 0 ? (
        <Empty icon="ph-medal" text="Keine anstehenden Abzeichen" hint="Sobald Jugendliche mit Geburtsdatum angelegt sind, erscheinen hier Fälligkeiten." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 24px" }} className="lg:px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" style={{ alignContent: "start" }}>
            {jahre.map((y) => {
              const jeType = [
                { typ: "Leistungsspange", items: gefiltert.filter((e) => e.jahr === y && e.typ === "Leistungsspange") },
                { typ: "Jugendflamme 2", items: gefiltert.filter((e) => e.jahr === y && e.typ === "Jugendflamme 2") },
                { typ: "Jugendflamme 1", items: gefiltert.filter((e) => e.jahr === y && e.typ === "Jugendflamme 1") },
              ].filter((g) => g.items.length > 0);
              const total = jeType.reduce((a, g) => a + g.items.length, 0);
              return (
                <div key={y} className="panel" style={{ alignSelf: "start" }}>
                  <div className="panel-h" style={{ justifyContent: "space-between" }}>
                    <h4 style={{ fontSize: 17 }}>{y}{y === jahr ? " · dieses Jahr" : ""}</h4>
                    <span className="ph-tag" style={{ background: "var(--color-accent-800)", color: "var(--color-accent-100)" }}>{total} fällig</span>
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
      )}
    </>
  );
}
