"use client";

import Link from "next/link";
import { api, useApi, Person, Termin, Verfuegbarkeit, Rueckmeldung, Dokumententyp } from "@/lib/api";
import { ModeTag, PageHeader, Spinner, fmtDateShort } from "@/components/ui";

export default function UebersichtPage() {
  const { data: personen } = useApi<Person[]>("/personen");
  const { data: termine } = useApi<Termin[]>("/termine");
  const { data: verf } = useApi<Verfuegbarkeit[]>("/verfuegbarkeiten");
  const { data: rueck } = useApi<Rueckmeldung[]>("/rueckmeldungen");
  const { data: doks } = useApi<Dokumententyp[]>("/dokumententypen");

  if (!personen || !termine || !verf || !rueck || !doks) return <Spinner />;

  const aktive = personen.filter((p) => p.aktiv);
  const jugend = aktive.filter((p) => p.rolle === "jugendlich");
  const betreuer = aktive.filter((p) => p.rolle === "betreuer");
  const heute = new Date().toISOString().slice(0, 10);
  const jahr = new Date().getFullYear();

  const zielgruppePersonen = (t: Termin) =>
    t.zielgruppe === "nur_betreuer" ? betreuer : t.zielgruppe === "nur_jugendliche" ? jugend : aktive;

  const kommende = termine.filter((t) => (t.datumBis ?? t.datumVon) >= heute).slice(0, 5);
  const naechsteBasis = kommende.length ? kommende : termine.slice(-5);

  // Offene Verfügbarkeiten: Personen der Zielgruppe ohne Ja/Nein-Eintrag bei kommenden Terminen
  let offeneVerf = 0;
  for (const t of termine.filter((t) => (t.datumBis ?? t.datumVon) >= heute)) {
    for (const p of zielgruppePersonen(t)) {
      const v = verf.find((v) => v.personId === p.id && v.terminId === t.id);
      if (!v || v.status === "offen") offeneVerf++;
    }
  }

  // Offene Checkliste (alle Dokumenttypen × jeweilige Zielgruppe)
  const fehltJe: { name: string; offen: number }[] = [];
  for (const d of doks) {
    const ziel = d.zielgruppe === "nur_betreuer" ? betreuer : d.zielgruppe === "nur_jugendliche" ? jugend : aktive;
    const offen = ziel.filter((p) => !rueck.some((r) => r.personId === p.id && r.dokumententypId === d.id && r.erhalten)).length;
    if (offen > 0) fehltJe.push({ name: d.name, offen });
  }

  const kpis = [
    { n: aktive.length, label: "Aktive Personen", icon: "ph-users-three", iconBg: "var(--color-accent-900)", iconFg: "var(--color-accent-200)", delta: `${jugend.length} J · ${betreuer.length} B` },
    { n: offeneVerf, label: "Fehlende Terminrückmeldungen", icon: "ph-question", iconBg: "rgba(240,178,58,.16)", iconFg: "var(--warn)", delta: `${termine.filter((t) => (t.datumBis ?? t.datumVon) >= heute).length} Termine` },
  ];

  const heuteFmt = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title="Übersicht" sub={`${heuteFmt} · Saison ${jahr}`} />

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 24px" }} className="lg:px-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 16 }}>
          {kpis.map((k) => (
            <div className="kpi" key={k.label}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 16, background: k.iconBg, color: k.iconFg }}>
                  <i className={`ph ${k.icon}`} />
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--color-neutral-500)" }}>{k.delta}</span>
              </div>
              <div className="kpi-n">{k.n}</div>
              <div className="kpi-l">{k.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
          {/* Nächste Termine */}
          <div className="panel" style={{ alignSelf: "start" }}>
            <div className="panel-h">
              <i className="ph ph-calendar-dots" style={{ color: "var(--color-accent-300)" }} />
              <h4>Nächste Termine</h4>
              <Link href="/termine" style={{ marginLeft: "auto", fontSize: 12, textDecoration: "none" }}>
                alle →
              </Link>
            </div>
            {naechsteBasis.map((t) => {
              const ziel = zielgruppePersonen(t);
              const zusagen = verf.filter((v) => v.terminId === t.id && v.status === "ja" && ziel.some((p) => p.id === v.personId)).length;
              const pct = ziel.length ? Math.round((zusagen / ziel.length) * 100) : 0;
              const d = fmtDateShort(t.datumVon);
              return (
                <Link key={t.id} href="/termine" className="mrow" style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ width: 38, flex: "none", textAlign: "center", lineHeight: 1.05 }}>
                    <div style={{ font: "600 17px/1 var(--font-heading)" }}>{d.tag}</div>
                    <div style={{ fontSize: 10, color: "var(--color-neutral-500)", textTransform: "uppercase" }}>{d.mon}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.titel}</div>
                    <div style={{ marginTop: 2 }}>
                      <ModeTag modus={t.planungsmodus} />
                    </div>
                  </div>
                  <div style={{ width: 104, flex: "none", textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {zusagen}
                      <span style={{ color: "var(--color-neutral-600)" }}>/{ziel.length}</span>
                    </div>
                    <div className="av-bar" style={{ marginTop: 5 }}>
                      <div className="av-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Offene Rückmeldungen */}
            <div className="panel">
              <div className="panel-h">
                <i className="ph ph-clipboard-text" style={{ color: "var(--warn)" }} />
                <h4>Offene Checkliste</h4>
              </div>
              {fehltJe.length === 0 && (
                <div className="mrow" style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
                  Alles da <i className="ph ph-check" style={{ color: "var(--color-accent-300)" }} />
                </div>
              )}
              {fehltJe.map((r) => (
                <Link key={r.name} href="/rueckmeldungen" className="mrow" style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{r.name}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--warn)" }}>{r.offen} offen</span>
                </Link>
              ))}
            </div>

          </div>
        </div>

        {/* Erststart: noch keine Personen da → anlegen oder Demo-Daten laden */}
        {aktive.length === 0 && (
          <div className="panel" style={{ marginTop: 16, padding: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Noch keine Personen angelegt</div>
              <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>Lege Jugendliche und Betreuer an — oder starte mit Beispieldaten aus der Spezifikation.</div>
            </div>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                await api("/seed-demo", { method: "POST" }).catch(() => {});
                location.reload();
              }}
            >
              <i className="ph ph-sparkle" />
              Demo-Daten laden
            </button>
            <Link href="/personen" className="btn btn-primary">
              <i className="ph ph-user-plus" />
              Person anlegen
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
