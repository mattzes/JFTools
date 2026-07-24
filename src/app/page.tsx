"use client";

import Link from "next/link";
import { api, useApi, Person, Termin, Verfuegbarkeit, Rueckmeldung, Dokumententyp } from "@/lib/api";
import { Avatar, ModeTag, PageHeader, Spinner, fmtDateShort } from "@/components/ui";
import { leistungsspangeVorschlag } from "@/lib/domain/alter";

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

  // Fehlende Rückmeldungen (alle Dokumenttypen × Jugendliche)
  let fehlendeRueck = 0;
  const fehltJe: { name: string; offen: number }[] = [];
  for (const d of doks) {
    const offen = jugend.filter((p) => !rueck.some((r) => r.personId === p.id && r.dokumententypId === d.id && r.erhalten)).length;
    fehlendeRueck += offen;
    if (offen > 0) fehltJe.push({ name: d.name, offen });
  }

  // Abzeichen fällig im laufenden Jahr
  const lspFaellig = jugend.filter((p) => {
    if (p.leistungsspangeDatum || !p.geburtsdatum) return false; // absolviert oder ohne Geburtsdatum
    return leistungsspangeVorschlag(p.geburtsdatum) === jahr;
  }).length;
  const jf2Faellig = jugend.filter((p) => !p.jugendflamme2 && p.jugendflamme1 && p.geburtsdatum && jahr - new Date(p.geburtsdatum).getFullYear() >= 13).length;
  const jf1Faellig = jugend.filter((p) => !p.jugendflamme1 && p.geburtsdatum && jahr - new Date(p.geburtsdatum).getFullYear() >= 10).length;
  const faelligGesamt = lspFaellig + jf2Faellig + jf1Faellig;

  const kpis = [
    { n: aktive.length, label: "Aktive Personen", icon: "ph-users-three", iconBg: "var(--color-accent-900)", iconFg: "var(--color-accent-200)", delta: `${jugend.length} J · ${betreuer.length} B` },
    { n: offeneVerf, label: "Offene Verfügbarkeiten", icon: "ph-question", iconBg: "rgba(240,178,58,.16)", iconFg: "var(--warn)", delta: `${termine.filter((t) => (t.datumBis ?? t.datumVon) >= heute).length} Termine` },
    { n: fehlendeRueck, label: "Fehlende Rückmeldungen", icon: "ph-clipboard-text", iconBg: "rgba(232,110,110,.16)", iconFg: "var(--danger)", delta: `${doks.length} Typen` },
    { n: faelligGesamt, label: `Abzeichen fällig ${jahr}`, icon: "ph-medal", iconBg: "var(--color-accent-900)", iconFg: "var(--color-accent-200)", delta: "" },
  ];

  const heuteFmt = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <PageHeader title="Übersicht" sub={`${heuteFmt} · Saison ${jahr}`}>
        <Link href="/termine" className="btn btn-primary">
          <i className="ph ph-plus" />
          Neuer Termin
        </Link>
      </PageHeader>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 24px" }} className="lg:px-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" style={{ marginBottom: 16 }}>
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
                <Link key={t.id} href={`/termine/${t.id}`} className="mrow" style={{ textDecoration: "none", color: "inherit" }}>
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
                <h4>Offene Rückmeldungen</h4>
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

            {/* Abzeichen fällig */}
            <div className="panel">
              <div className="panel-h">
                <i className="ph ph-medal" style={{ color: "var(--color-accent-300)" }} />
                <h4>Abzeichen fällig {jahr}</h4>
              </div>
              {[
                { typ: "Leistungsspange", n: lspFaellig },
                { typ: "Jugendflamme 2", n: jf2Faellig },
                { typ: "Jugendflamme 1", n: jf1Faellig },
              ]
                .filter((f) => f.n > 0)
                .map((f) => (
                  <Link key={f.typ} href="/abzeichen" className="mrow" style={{ textDecoration: "none", color: "inherit" }}>
                    <span style={{ width: 26, height: 26, flex: "none", borderRadius: 7, display: "grid", placeItems: "center", fontSize: 13, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
                      <i className="ph ph-medal" />
                    </span>
                    <div style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{f.typ}</div>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{f.n} Pers.</span>
                  </Link>
                ))}
              {faelligGesamt === 0 && (
                <div className="mrow" style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
                  Nichts fällig
                </div>
              )}
            </div>

            {/* Sitzplätze */}
            <div className="panel" style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 40, height: 40, flex: "none", borderRadius: 10, display: "grid", placeItems: "center", fontSize: 20, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
                <i className="ph ph-car" />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ font: "600 20px/1 var(--font-heading)" }}>
                  {betreuer.reduce((a, b) => a + (b.sitzplaetze ?? 0), 0)}{" "}
                  <span style={{ fontSize: 13, color: "var(--color-neutral-500)", fontWeight: 400 }}>Sitzplätze</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-500)", marginTop: 3 }}>
                  {betreuer.filter((b) => (b.sitzplaetze ?? 0) > 0).length} Fahrer verfügbar
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Erststart: noch keine Personen da → anlegen oder Demo-Daten laden */}
        {aktive.length === 0 && (
          <div className="panel" style={{ marginTop: 16, padding: 20, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Avatar name="J F" size={38} />
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
