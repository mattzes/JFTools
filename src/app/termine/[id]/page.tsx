"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { api, useApi, Person, Termin, Verfuegbarkeit, personName } from "@/lib/api";
import { Avatar, ModeTag, PageHeader, Spinner, Empty, fmtDate } from "@/components/ui";

const SEG_BASE = { display: "inline-grid", placeItems: "center", width: 34, height: 30, borderRadius: 8, fontSize: 13, border: 0, cursor: "pointer" } as const;
const OFF = { background: "var(--color-neutral-800)", color: "var(--color-neutral-600)" };

export default function TerminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const terminId = Number(id);
  const { data: personen } = useApi<Person[]>("/personen");
  const { data: termine } = useApi<Termin[]>("/termine");
  const { data: verf, reload } = useApi<Verfuegbarkeit[]>("/verfuegbarkeiten");

  const cellMap = useMemo(() => {
    const m = new Map<number, Verfuegbarkeit["status"]>();
    verf?.filter((v) => v.terminId === terminId).forEach((v) => m.set(v.personId, v.status));
    return m;
  }, [verf, terminId]);

  if (!personen || !termine || !verf) return <Spinner />;
  const termin = termine.find((t) => t.id === terminId);
  if (!termin) return <Empty icon="ph-calendar-x" text="Termin nicht gefunden" />;

  const ziel = personen
    .filter((p) => p.aktiv)
    .filter((p) => (termin.zielgruppe === "nur_betreuer" ? p.rolle === "betreuer" : termin.zielgruppe === "nur_jugendliche" ? p.rolle === "jugendlich" : true));
  const ja = ziel.filter((p) => cellMap.get(p.id) === "ja").length;

  async function setStatus(personId: number, status: Verfuegbarkeit["status"]) {
    await api("/verfuegbarkeiten", { method: "PUT", body: JSON.stringify({ personId, terminId, status }) });
    reload();
  }

  const planbar = termin.planungsmodus !== "keine";

  return (
    <>
      <PageHeader
        title={termin.titel}
        sub={`${fmtDate(termin.datumVon)}${termin.datumBis ? `–${fmtDate(termin.datumBis)}` : ""}${termin.ort ? ` · ${termin.ort}` : ""} · ${ja}/${ziel.length} zugesagt`}
      >
        <ModeTag modus={termin.planungsmodus} />
        {planbar && (
          <Link href={`/wettbewerbe/${termin.id}`} className="btn btn-primary">
            <i className="ph ph-flow-arrow" />
            Gruppenplaner
          </Link>
        )}
      </PageHeader>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 16px" }} className="lg:px-6">
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)", marginBottom: 10 }}>
          Zum Abhaken tippen — Ja / Nein / offen
        </div>
        <div className="flex flex-col gap-2" style={{ maxWidth: 640 }}>
          {ziel.map((p) => {
            const s = cellMap.get(p.id) ?? "offen";
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--color-surface)", borderRadius: 11 }}>
                <Avatar name={personName(p)} size={32} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{personName(p)}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={{ ...SEG_BASE, ...(s === "ja" ? { background: "var(--color-accent-900)", color: "var(--color-accent-200)" } : OFF) }} onClick={() => setStatus(p.id, "ja")} aria-label="Ja">
                    <i className="ph-bold ph-check" />
                  </button>
                  <button style={{ ...SEG_BASE, ...(s === "nein" ? { background: "rgba(232,110,110,.2)", color: "var(--danger)" } : OFF) }} onClick={() => setStatus(p.id, "nein")} aria-label="Nein">
                    <i className="ph-bold ph-x" />
                  </button>
                  <button style={{ ...SEG_BASE, ...(s === "offen" ? { background: "var(--color-neutral-700)", color: "var(--color-neutral-100)" } : OFF) }} onClick={() => setStatus(p.id, "offen")} aria-label="Offen">
                    <i className="ph-bold ph-minus" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
