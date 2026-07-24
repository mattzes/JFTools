"use client";

import Link from "next/link";
import { useApi, Termin, Verfuegbarkeit } from "@/lib/api";
import { ModeTag, PageHeader, Spinner, Empty, fmtDate, fmtDateShort } from "@/components/ui";

export default function WettbewerbePage() {
  const { data: termine } = useApi<Termin[]>("/termine");
  const { data: verf } = useApi<Verfuegbarkeit[]>("/verfuegbarkeiten");

  if (!termine || !verf) return <Spinner />;

  const planbar = termine.filter((t) => t.planungsmodus !== "keine");

  return (
    <>
      <PageHeader title="Wettbewerbe & Planung" sub="Alle Termine mit Gruppeneinteilung, A-Teil oder A+B-Teil" />

      {planbar.length === 0 ? (
        <Empty icon="ph-trophy" text="Keine planbaren Termine" hint="Lege einen Termin mit Planungsmodus nur_gruppen, a_teil oder a_und_b_teil an." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 24px" }} className="lg:px-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {planbar.map((t) => {
              const zusagen = verf.filter((v) => v.terminId === t.id && v.status === "ja").length;
              const d = fmtDateShort(t.datumVon);
              return (
                <Link
                  key={t.id}
                  href={`/wettbewerbe/${t.id}`}
                  className="panel"
                  style={{ padding: 18, textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 46, flex: "none", textAlign: "center", lineHeight: 1.05 }}>
                      <div style={{ font: "600 20px/1 var(--font-heading)" }}>{d.tag}</div>
                      <div style={{ fontSize: 10, color: "var(--color-neutral-500)", textTransform: "uppercase" }}>{d.mon}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{t.titel}</div>
                      <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)", marginTop: 2 }}>
                        {fmtDate(t.datumVon)}{t.ort ? ` · ${t.ort}` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ModeTag modus={t.planungsmodus} />
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-neutral-500)" }}>{zusagen} Zusagen</span>
                    <i className="ph ph-arrow-right" style={{ color: "var(--color-accent-300)" }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
