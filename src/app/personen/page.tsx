"use client";

import { useMemo, useState } from "react";
import { api, useApi, Person, HindernisFaehigkeit, personName } from "@/lib/api";
import { Avatar, DatePicker, Dialog, Empty, PageHeader, Spinner, fmtDate } from "@/components/ui";
import { alter, alterInDiesemJahr, leistungsspangeVorschlag, geburtsdatumPlausibel } from "@/lib/domain/alter";
import { HINDERNIS_MATERIAL, HINDERNIS_STATUS } from "@/lib/domain/constants";

type FormState = {
  id?: number;
  rolle: "jugendlich" | "betreuer";
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  ort: string;
  ausweisnr: string;
  geburtsdatum: string;
  eintrittsdatum: string;
  geschlecht: "" | "M" | "W";
  sitzplaetze: string;
  jugendflamme1: string;
  jugendflamme2: string;
  leistungsspangeDatum: string;
  aktiv: boolean;
};

const EMPTY_FORM: FormState = {
  rolle: "jugendlich", vorname: "", nachname: "", strasse: "", plz: "", ort: "",
  ausweisnr: "", geburtsdatum: "", eintrittsdatum: "", geschlecht: "", sitzplaetze: "",
  jugendflamme1: "", jugendflamme2: "", leistungsspangeDatum: "", aktiv: true,
};

export default function PersonenPage() {
  const { data: personen, reload } = useApi<Person[]>("/personen");
  const { data: hindernisse, reload: reloadHind } = useApi<HindernisFaehigkeit[]>("/hindernis");
  const [suche, setSuche] = useState("");
  const [selId, setSelId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zeigeInaktive, setZeigeInaktive] = useState(false);

  const liste = useMemo(() => {
    if (!personen) return [];
    const q = suche.toLowerCase();
    return personen
      .filter((p) => (zeigeInaktive ? true : p.aktiv))
      .filter((p) => !q || personName(p).toLowerCase().includes(q) || (p.ausweisnr ?? "").includes(q))
      .sort((a, b) => (a.rolle === b.rolle ? a.nachname.localeCompare(b.nachname) : a.rolle === "jugendlich" ? -1 : 1));
  }, [personen, suche, zeigeInaktive]);

  if (!personen) return <Spinner />;

  const sel = personen.find((p) => p.id === selId) ?? null;
  const selHind = sel ? hindernisse?.find((h) => h.personId === sel.id) : null;
  const jugend = personen.filter((p) => p.aktiv && p.rolle === "jugendlich").length;
  const betr = personen.filter((p) => p.aktiv && p.rolle === "betreuer").length;

  function openEdit(p?: Person) {
    setFehler(null);
    if (!p) return setForm(EMPTY_FORM);
    setForm({
      id: p.id, rolle: p.rolle, vorname: p.vorname, nachname: p.nachname,
      strasse: p.strasse ?? "", plz: p.plz ?? "", ort: p.ort ?? "",
      ausweisnr: p.ausweisnr ?? "", geburtsdatum: p.geburtsdatum ?? "",
      eintrittsdatum: p.eintrittsdatum ?? "", geschlecht: p.geschlecht ?? "",
      sitzplaetze: p.sitzplaetze != null ? String(p.sitzplaetze) : "",
      jugendflamme1: p.jugendflamme1 ?? "", jugendflamme2: p.jugendflamme2 ?? "",
      leistungsspangeDatum: p.leistungsspangeDatum ?? "",
      aktiv: p.aktiv,
    });
  }

  async function save() {
    if (!form) return;
    setFehler(null);
    const istBetreuer = form.rolle === "betreuer";
    if (istBetreuer) {
      if (form.sitzplaetze.trim() === "") {
        setFehler("Sitzplätze sind für Betreuer eine Pflichtangabe.");
        return;
      }
    } else {
      if (!form.geburtsdatum || !form.eintrittsdatum || !form.geschlecht || !form.ausweisnr.trim()) {
        setFehler("Für Jugendliche sind Geburtsdatum, Eintrittsdatum, Geschlecht und Mitgliedsnummer Pflicht.");
        return;
      }
    }
    if (form.geburtsdatum && !geburtsdatumPlausibel(form.geburtsdatum)) {
      setFehler("Geburtsdatum unplausibel (Alter muss zwischen 5 und 80 liegen) — bitte prüfen.");
      return;
    }
    const payload = {
      rolle: form.rolle,
      vorname: form.vorname.trim(),
      nachname: form.nachname.trim(),
      strasse: istBetreuer ? null : form.strasse || null,
      plz: istBetreuer ? null : form.plz || null,
      ort: istBetreuer ? null : form.ort || null,
      ausweisnr: istBetreuer ? null : form.ausweisnr || null,
      geburtsdatum: istBetreuer ? null : form.geburtsdatum || null,
      eintrittsdatum: istBetreuer ? null : form.eintrittsdatum || null,
      geschlecht: istBetreuer ? null : form.geschlecht || null,
      sitzplaetze: istBetreuer && form.sitzplaetze !== "" ? Number(form.sitzplaetze) : null,
      jugendflamme1: istBetreuer ? null : form.jugendflamme1 || null,
      jugendflamme2: istBetreuer ? null : form.jugendflamme2 || null,
      leistungsspangeDatum: !istBetreuer && form.leistungsspangeDatum ? form.leistungsspangeDatum : null,
      aktiv: form.aktiv,
    };
    try {
      if (form.id) {
        await api(`/personen/${form.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/personen", { method: "POST", body: JSON.stringify(payload) });
      }
      setForm(null);
      reload();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    }
  }

  async function setHindernis(p: Person, material: string, status: string) {
    await api("/hindernis", {
      method: "PUT",
      body: JSON.stringify({ personId: p.id, hindernis: "Wassergraben", material, status }),
    });
    reloadHind();
  }

  return (
    <>
      <PageHeader title="Personen" sub={`${jugend} Jugendliche · ${betr} Betreuer`}>
        <input
          className="input"
          style={{ width: 180 }}
          placeholder="Suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => openEdit()}>
          <i className="ph ph-user-plus" />
          Person
        </button>
      </PageHeader>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Liste */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 16px 16px" }}>
          {liste.length === 0 ? (
            <Empty icon="ph-users-three" text="Keine Personen" hint="Lege die erste Person über den Button oben an." />
          ) : (
            <>
              {/* Desktop-Tabelle */}
              <table className="table hidden lg:table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Rolle</th>
                    <th>Geburtsdatum</th>
                    <th>Ausweis-Nr.</th>
                    <th style={{ textAlign: "center" }}>Jahrg.-Alter</th>
                    <th style={{ textAlign: "center" }}>JFL1</th>
                    <th style={{ textAlign: "center" }}>JFL2</th>
                    <th>LSP</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((p) => (
                    <tr key={p.id} onClick={() => setSelId(p.id)} style={{ cursor: "pointer", opacity: p.aktiv ? 1 : 0.45 }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <Avatar name={personName(p)} />
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{personName(p)}</div>
                        </div>
                      </td>
                      <td>
                        <span className="ph-tag" style={p.rolle === "betreuer" ? { background: "var(--color-accent-2-800)", color: "var(--color-accent-2-100)" } : { background: "var(--color-neutral-800)", color: "var(--color-neutral-200)" }}>
                          {p.rolle === "betreuer" ? "Betreuer" : "Jugendlich"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{p.geburtsdatum ? fmtDate(p.geburtsdatum) : <Dash />}</td>
                      <td style={{ fontSize: 12.5 }}>{p.ausweisnr ? p.ausweisnr : <Dash />}</td>
                      <td style={{ textAlign: "center" }}>{p.geburtsdatum ? <span style={{ fontWeight: 500 }}>{alterInDiesemJahr(p.geburtsdatum)}</span> : <Dash />}</td>
                      <td style={{ textAlign: "center" }}>{p.jugendflamme1 ? <i className="ph ph-check" style={{ color: "var(--color-accent-300)" }} /> : <Dash />}</td>
                      <td style={{ textAlign: "center" }}>{p.jugendflamme2 ? <i className="ph ph-check" style={{ color: "var(--color-accent-300)" }} /> : <Dash />}</td>
                      <td style={{ fontSize: 12.5 }}>
                        {p.leistungsspangeDatum ? (
                          <span style={{ color: "var(--color-accent-300)" }}>
                            <i className="ph ph-medal" style={{ marginRight: 4 }} />{fmtDate(p.leistungsspangeDatum)}
                          </span>
                        ) : p.geburtsdatum ? (
                          <span style={{ color: "var(--color-neutral-500)" }}>Vorschlag {leistungsspangeVorschlag(p.geburtsdatum)}</span>
                        ) : (
                          <Dash />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Karten */}
              <div className="flex flex-col gap-2 lg:hidden" style={{ padding: "4px 6px" }}>
                {liste.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelId(p.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 11, padding: "10px 12px",
                      background: "var(--color-surface)", borderRadius: 11, border: 0,
                      color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer",
                      opacity: p.aktiv ? 1 : 0.45,
                    }}
                  >
                    <Avatar name={personName(p)} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{personName(p)}</div>
                      <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>
                        {p.rolle === "betreuer" ? "Betreuer" : "Jugendlich"}
                        {p.geburtsdatum ? ` · ${alter(p.geburtsdatum)} J.` : ""}
                      </div>
                    </div>
                    <i className="ph ph-caret-right" style={{ color: "var(--color-neutral-600)" }} />
                  </button>
                ))}
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 8px", fontSize: 12, color: "var(--color-neutral-500)", cursor: "pointer" }}>
                <input type="checkbox" checked={zeigeInaktive} onChange={(e) => setZeigeInaktive(e.target.checked)} />
                Inaktive anzeigen
              </label>
            </>
          )}
        </div>

        {/* Detail-Panel (Desktop) */}
        {sel && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-[var(--color-bg)] lg:static lg:z-auto lg:w-[300px] lg:flex-none"
            style={{ borderLeft: "1px solid var(--color-divider)", padding: 18 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span style={{ width: 46, height: 46, flex: "none", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 600, background: "linear-gradient(150deg,#9184d9,#5d5294)", color: "#fff" }}>
                {sel.vorname[0]}{sel.nachname[0]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 16px/1.1 var(--font-heading)" }}>{personName(sel)}</div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-500)", marginTop: 2 }}>{sel.ausweisnr ? `Nr. ${sel.ausweisnr}` : "ohne Mitgliedsnummer"}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setSelId(null)} aria-label="Schließen">
                <i className="ph ph-x" style={{ fontSize: 18 }} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              <span className="ph-tag" style={{ background: "var(--color-neutral-800)", color: "var(--color-neutral-200)" }}>
                {sel.rolle === "betreuer" ? "Betreuer" : "Jugendlich"}
              </span>
              {sel.geburtsdatum && (
                <span className="ph-tag" style={{ background: "var(--color-neutral-800)", color: "var(--color-neutral-200)" }}>
                  {sel.geschlecht ?? "?"} · {alter(sel.geburtsdatum)} J.
                </span>
              )}
              {!sel.aktiv && (
                <span className="ph-tag" style={{ background: "rgba(232,110,110,.16)", color: "var(--danger)" }}>inaktiv</span>
              )}
            </div>

            <SectionLabel>Stammdaten</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5, marginBottom: 16 }}>
              <KV k="Geburtsdatum" v={fmtDate(sel.geburtsdatum)} />
              <KV k="Jahrgangs-Alter" v={sel.geburtsdatum ? `${alterInDiesemJahr(sel.geburtsdatum)} (Wettbewerb)` : "—"} />
              <KV k="Eintritt" v={fmtDate(sel.eintrittsdatum)} />
              <KV k="Adresse" v={[sel.strasse, [sel.plz, sel.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"} />
              {sel.rolle === "betreuer" && <KV k="Sitzplätze (PKW)" v={sel.sitzplaetze != null ? String(sel.sitzplaetze) : "—"} />}
            </div>

            {sel.rolle === "jugendlich" && (
              <>
                <SectionLabel>Abzeichen</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
                  <BadgeRow label="Jugendflamme 1" value={fmtDate(sel.jugendflamme1)} done={!!sel.jugendflamme1} />
                  <BadgeRow label="Jugendflamme 2" value={fmtDate(sel.jugendflamme2)} done={!!sel.jugendflamme2} />
                  <BadgeRow
                    label="Leistungsspange"
                    value={
                      sel.leistungsspangeDatum
                        ? fmtDate(sel.leistungsspangeDatum)
                        : sel.geburtsdatum
                          ? `Vorschlag ${leistungsspangeVorschlag(sel.geburtsdatum)}`
                          : "—"
                    }
                    done={!!sel.leistungsspangeDatum}
                  />
                </div>

                <SectionLabel>Wassergraben (A-Teil)</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  <select
                    className="input"
                    value={selHind ? `${selHind.material}|${selHind.status}` : ""}
                    onChange={(e) => {
                      const [material, status] = e.target.value.split("|");
                      if (material && status) setHindernis(sel, material, status);
                    }}
                  >
                    <option value="">— nicht erfasst —</option>
                    {HINDERNIS_MATERIAL.flatMap((m) =>
                      HINDERNIS_STATUS.map((s) => (
                        <option key={`${m}|${s}`} value={`${m}|${s}`}>
                          {m === "ohne" ? "ohne Material" : m === "verteiler" ? "mit Verteiler" : "mit Schlauchpaket"} · {s}
                        </option>
                      )),
                    )}
                  </select>
                  <div style={{ fontSize: 10.5, color: "var(--color-neutral-500)" }}>
                    Welche Material-Kombination schafft die Person fehlerfrei über den Wassergraben?
                  </div>
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openEdit(sel)}>
                <i className="ph ph-pencil-simple" />
                Bearbeiten
              </button>
              <button
                className="btn btn-secondary"
                title={sel.aktiv ? "Deaktivieren (Historie bleibt erhalten)" : "Wieder aktivieren"}
                onClick={async () => {
                  await api(`/personen/${sel.id}`, { method: "PATCH", body: JSON.stringify({ aktiv: !sel.aktiv }) });
                  reload();
                }}
              >
                <i className={`ph ${sel.aktiv ? "ph-archive" : "ph-arrow-counter-clockwise"}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Formular-Dialog */}
      {form && (
        <Dialog title={form.id ? "Person bearbeiten" : "Neue Person"} onClose={() => setForm(null)}>
          <div style={{ display: "flex", gap: 8 }}>
            {(["jugendlich", "betreuer"] as const).map((r) => (
              <button key={r} className="seg-opt" data-on={form.rolle === r} style={{ flex: 1, justifyContent: "center", border: "1px solid var(--color-divider)", borderRadius: 8 }} onClick={() => setForm({ ...form, rolle: r })}>
                {r === "jugendlich" ? "Jugendlich" : "Betreuer"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vorname *">
              <input className="input" value={form.vorname} onChange={(e) => setForm({ ...form, vorname: e.target.value })} />
            </Field>
            <Field label="Nachname *">
              <input className="input" value={form.nachname} onChange={(e) => setForm({ ...form, nachname: e.target.value })} />
            </Field>

            {form.rolle === "jugendlich" && (
              <>
                <Field label="Geburtsdatum *">
                  <DatePicker value={form.geburtsdatum} onChange={(v) => setForm({ ...form, geburtsdatum: v })} clearable={false} />
                </Field>
                <Field label="Eintrittsdatum *">
                  <DatePicker value={form.eintrittsdatum} onChange={(v) => setForm({ ...form, eintrittsdatum: v })} clearable={false} />
                </Field>
                <Field label="Geschlecht *">
                  <select className="input" value={form.geschlecht} onChange={(e) => setForm({ ...form, geschlecht: e.target.value as FormState["geschlecht"] })}>
                    <option value="">—</option>
                    <option value="M">M</option>
                    <option value="W">W</option>
                  </select>
                </Field>
                <Field label="Mitgliedsnummer (Ausweis-Nr.) *">
                  <input className="input" value={form.ausweisnr} onChange={(e) => setForm({ ...form, ausweisnr: e.target.value })} />
                </Field>
                <Field label="Straße">
                  <input className="input" value={form.strasse} onChange={(e) => setForm({ ...form, strasse: e.target.value })} />
                </Field>
                <div className="grid grid-cols-[80px_1fr] gap-2">
                  <Field label="PLZ">
                    <input className="input" value={form.plz} onChange={(e) => setForm({ ...form, plz: e.target.value })} />
                  </Field>
                  <Field label="Ort">
                    <input className="input" value={form.ort} onChange={(e) => setForm({ ...form, ort: e.target.value })} />
                  </Field>
                </div>
              </>
            )}
          </div>

          {form.rolle === "betreuer" ? (
            <Field label="Sitzplätze im PKW (für Fahrgemeinschaften) *">
              <input type="number" min={0} max={9} className="input" value={form.sitzplaetze} onChange={(e) => setForm({ ...form, sitzplaetze: e.target.value })} />
            </Field>
          ) : form.id ? (
            // Abzeichen werden erst beim Bearbeiten erfasst, nicht beim Anlegen
            <>
              <SectionLabel>Abzeichen</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Field label="JFL1 — Datum der Abnahme">
                  <DatePicker value={form.jugendflamme1} onChange={(v) => setForm({ ...form, jugendflamme1: v })} />
                </Field>
                <Field label="JFL2 — Datum der Abnahme">
                  <DatePicker value={form.jugendflamme2} onChange={(v) => setForm({ ...form, jugendflamme2: v })} />
                </Field>
                <div style={{ gridColumn: "1 / -1" }}>
                  <Field label="LSP — Datum der Abnahme">
                    <DatePicker value={form.leistungsspangeDatum} onChange={(v) => setForm({ ...form, leistungsspangeDatum: v })} />
                  </Field>
                </div>
              </div>
            </>
          ) : null}

          {fehler && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{fehler}</div>}
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setForm(null)}>Abbrechen</button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={
                !form.vorname.trim() ||
                !form.nachname.trim() ||
                (form.rolle === "betreuer"
                  ? form.sitzplaetze.trim() === ""
                  : !form.geburtsdatum || !form.eintrittsdatum || !form.geschlecht || !form.ausweisnr.trim())
              }
            >
              <i className="ph ph-check" />
              Speichern
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "var(--color-neutral-500)" }}>{k}</span>
      <span style={{ textAlign: "right" }}>{v}</span>
    </div>
  );
}

function BadgeRow({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
      <i className="ph ph-medal" style={{ color: done ? "var(--color-accent-300)" : "var(--color-neutral-600)" }} />
      {label}
      <span style={{ marginLeft: "auto", color: "var(--color-neutral-500)" }}>{value}</span>
    </div>
  );
}

// Einheitliche Darstellung fehlender Werte
function Dash() {
  return <span style={{ color: "var(--color-neutral-600)" }}>—</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
