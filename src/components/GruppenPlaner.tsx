"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { api, Person, Planung, HindernisFaehigkeit, Gruppe, Gruppenmitglied, Termin, Verfuegbarkeit, personName } from "@/lib/api";
import { ModeTag, PageHeader, fmtDateShort } from "@/components/ui";
import { A_TEIL_POSITIONEN, KNOTEN_POSITIONEN, KNOTEN, B_TEIL_AUFGABEN } from "@/lib/domain/constants";
import { gruppenAlter, sollZeitLabel, gruppenWarnungen } from "@/lib/domain/planung";
import { alter, alterInDiesemJahr } from "@/lib/domain/alter";

// Welche Zusatzinfos in der Starterliste angezeigt werden
type StarterInfo = { alter: boolean; jgAlter: boolean; termine: number[] };

const VERF_STYLE = {
  ja: { icon: "ph-check", c: "var(--color-accent-300)" },
  nein: { icon: "ph-x", c: "var(--danger)" },
  offen: { icon: "ph-minus", c: "var(--color-neutral-500)" },
} as const;

const HIND_MAP = {
  ja: { icon: "ph-check-circle", c: "var(--color-accent-300)", title: "Wassergraben ok" },
  unsicher: { icon: "ph-warning-circle", c: "var(--warn)", title: "Wassergraben unsicher" },
  nein: { icon: "ph-x-circle", c: "var(--danger)", title: "Wassergraben nicht geschafft" },
} as const;

export function GruppenPlaner({
  personen,
  planung,
  hindernisse,
  termine,
  alleVerf,
  reload,
}: {
  personen: Person[];
  planung: Planung;
  hindernisse: HindernisFaehigkeit[];
  termine: Termin[];
  alleVerf: Verfuegbarkeit[];
  reload: () => void;
}) {
  const { termin } = planung;
  const modus = termin.planungsmodus;
  const istATeil = modus === "a_teil" || modus === "a_und_b_teil";
  const istBTeil = modus === "a_und_b_teil";
  const doppelstart = termin.doppelstartErlaubt;

  const [activePerson, setActivePerson] = useState<{ personId: number; from: "pool" | number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingAssigned, setPendingAssigned] = useState<Set<number>>(new Set());
  const markPending = (id: number) => setPendingAssigned((prev) => new Set(prev).add(id));
  const [info, setInfo] = useState<StarterInfo>({ alter: false, jgAlter: false, termine: [] });

  // Andere Termine (nicht der aktuelle) für die Anwesenheits-Auswahl
  const andereTermine = useMemo(
    () => termine.filter((t) => t.id !== termin.id).sort((a, b) => a.datumVon.localeCompare(b.datumVon)),
    [termine, termin.id],
  );
  // Verfügbarkeits-Status je Person & Termin
  const verfByPT = useMemo(() => {
    const m = new Map<string, Verfuegbarkeit["status"]>();
    alleVerf.forEach((v) => m.set(`${v.personId}:${v.terminId}`, v.status));
    return m;
  }, [alleVerf]);
  const infoTermine = useMemo(() => andereTermine.filter((t) => info.termine.includes(t.id)), [andereTermine, info.termine]);

  const personById = useMemo(() => new Map(personen.map((p) => [p.id, p])), [personen]);
  const hindByPerson = useMemo(() => new Map(hindernisse.map((h) => [h.personId, h])), [hindernisse]);
  const verfByPerson = useMemo(() => new Map(planung.verfuegbarkeiten.map((v) => [v.personId, v.status])), [planung.verfuegbarkeiten]);
  // Knoten je Gruppe: Schlüssel "<gruppeId>:<position>"
  const knotenByPos = useMemo(() => {
    const m = new Map<string, string>();
    planung.knoten.forEach((k) => m.set(`${k.gruppeId}:${k.position}`, k.knoten));
    return m;
  }, [planung.knoten]);

  // Starterliste = alle mit Zusage für den Termin
  const starter = useMemo(
    () => personen.filter((p) => p.aktiv && verfByPerson.get(p.id) === "ja").sort((a, b) => a.nachname.localeCompare(b.nachname)),
    [personen, verfByPerson],
  );
  // Doppelstarter: in mehr als einer Gruppe dieses Wettbewerbs
  const gruppenCountByPerson = useMemo(() => {
    const m = new Map<number, number>();
    planung.mitglieder.forEach((mm) => m.set(mm.personId, (m.get(mm.personId) ?? 0) + 1));
    return m;
  }, [planung.mitglieder]);

  // Sobald die frischen Daten die Zuteilung zeigen, Pending-Markierung wieder lösen
  useEffect(() => {
    setPendingAssigned((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => !(gruppenCountByPerson.get(id) ?? 0)));
      return next.size === prev.size ? prev : next;
    });
  }, [gruppenCountByPerson]);

  const istZugewiesen = (id: number) => (gruppenCountByPerson.get(id) ?? 0) >= 1 || pendingAssigned.has(id);

  // Ohne Doppelstart verschwinden bereits zugeteilte Starter aus der Liste links
  const pool = doppelstart ? starter : starter.filter((p) => !istZugewiesen(p.id));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const mitgliederByGruppe = (gid: number) => planung.mitglieder.filter((m) => m.gruppeId === gid);

  async function addGruppe() {
    setBusy(true);
    await api("/gruppen", { method: "POST", body: JSON.stringify({ terminId: termin.id, name: `Gruppe ${planung.gruppen.length + 1}` }) });
    reload();
    setBusy(false);
  }

  async function deleteGruppe(id: number) {
    if (!confirm("Gruppe löschen?")) return;
    await api(`/gruppen/${id}`, { method: "DELETE" });
    reload();
  }

  async function toggleDoppelstart() {
    setBusy(true);
    await api(`/termine/${termin.id}`, { method: "PATCH", body: JSON.stringify({ doppelstartErlaubt: !doppelstart }) });
    reload();
    setBusy(false);
  }

  async function setKnoten(gruppeId: number, position: string, knoten: string | null) {
    // aktuelle Knoten dieser Gruppe zusammenstellen, gewünschte Position ändern
    const map = new Map<string, string>();
    for (const pos of KNOTEN_POSITIONEN) {
      const cur = knotenByPos.get(`${gruppeId}:${pos}`);
      if (cur) map.set(pos, cur);
    }
    if (knoten) map.set(position, knoten);
    else map.delete(position);
    const arr = [...map].map(([pos, kn]) => ({ position: pos, knoten: kn }));
    await api(`/gruppen/${gruppeId}/knoten`, { method: "PUT", body: JSON.stringify(arr) });
    reload();
  }

  async function onDragEnd(e: DragEndEvent) {
    setActivePerson(null);
    const active = activePerson;
    if (!active) return;
    const overId = e.over?.id;
    if (typeof overId !== "string") return;

    // over = "gruppe-<id>" oder "pos-<gruppeId>-<POS>"
    if (overId.startsWith("gruppe-") || overId.startsWith("pos-")) {
      let gruppeId: number;
      let position: string | null = null;
      if (overId.startsWith("pos-")) {
        const [, gid, pos] = overId.split("-");
        gruppeId = Number(gid);
        position = pos;
      } else {
        gruppeId = Number(overId.replace("gruppe-", ""));
      }

      // Position nicht doppelt besetzen: ist sie schon von einer anderen Person
      // belegt, ist der Drop schlicht nicht möglich.
      if (position) {
        const besetzt = planung.mitglieder.some(
          (m) => m.gruppeId === gruppeId && m.aTeilPosition === position && m.personId !== active.personId,
        );
        if (besetzt) return;
      }

      const existing = planung.mitglieder.find((m) => m.gruppeId === gruppeId && m.personId === active.personId);

      if (active.from === "pool") {
        if (existing) {
          if (position) await api(`/gruppenmitglieder/${existing.id}`, { method: "PATCH", body: JSON.stringify({ aTeilPosition: position }) });
        } else if (!doppelstart) {
          // Ohne Doppelstart: bereits woanders zugeteilt → VERSCHIEBEN, sonst neu zuweisen
          markPending(active.personId);
          const andere = planung.mitglieder.find((m) => m.personId === active.personId);
          if (andere) {
            await api(`/gruppenmitglieder/${andere.id}`, { method: "PATCH", body: JSON.stringify({ gruppeId, aTeilPosition: position ?? andere.aTeilPosition }) });
          } else {
            await api("/gruppenmitglieder", { method: "POST", body: JSON.stringify({ gruppeId, personId: active.personId, aTeilPosition: position }) });
          }
        } else {
          // Doppelstart erlaubt: KOPIEREN (Person bleibt in der Starterliste)
          markPending(active.personId);
          await api("/gruppenmitglieder", {
            method: "POST",
            body: JSON.stringify({ gruppeId, personId: active.personId, aTeilPosition: position }),
          });
        }
      } else {
        // Zwischen Gruppen: VERSCHIEBEN (die Zuweisung aus der Quellgruppe)
        const src = planung.mitglieder.find((m) => m.gruppeId === active.from && m.personId === active.personId);
        if (src && active.from !== gruppeId) {
          if (existing) {
            await api(`/gruppenmitglieder/${src.id}`, { method: "DELETE" });
          } else {
            await api(`/gruppenmitglieder/${src.id}`, { method: "PATCH", body: JSON.stringify({ gruppeId, aTeilPosition: position ?? src.aTeilPosition }) });
          }
        } else if (src && position) {
          await api(`/gruppenmitglieder/${src.id}`, { method: "PATCH", body: JSON.stringify({ aTeilPosition: position }) });
        }
      }
      reload();
    }
  }

  const activeP = activePerson ? personById.get(activePerson.personId) : null;

  return (
    <>
      <PageHeader
        title={termin.titel}
        sub={`${starter.length} Starter · ${planung.gruppen.length} ${planung.gruppen.length === 1 ? "Gruppe" : "Gruppen"}`}
      >
        <ModeTag modus={modus} />
        <AnzeigeMenu info={info} setInfo={setInfo} termine={andereTermine} />
        <button
          className="btn btn-secondary"
          onClick={toggleDoppelstart}
          disabled={busy}
          title={doppelstart ? "Doppelstart erlaubt: Personen können mehreren Gruppen zugeteilt werden" : "Kein Doppelstart: jede Person nur in einer Gruppe"}
        >
          <i className={`ph ${doppelstart ? "ph-toggle-right" : "ph-toggle-left"}`} style={{ fontSize: 18, color: doppelstart ? "var(--color-accent-300)" : "var(--color-neutral-500)" }} />
          Doppelstart {doppelstart ? "erlaubt" : "aus"}
        </button>
        <button className="btn btn-primary" onClick={addGruppe} disabled={busy}>
          <i className="ph ph-plus" />
          Gruppe
        </button>
      </PageHeader>

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => {
          const d = e.active.data.current as { personId: number; from: "pool" | number } | undefined;
          if (d) setActivePerson(d);
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActivePerson(null)}
      >
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Starterliste */}
          <StarterPool
            starter={pool}
            doppelstart={doppelstart}
            hindByPerson={hindByPerson}
            gruppenCountByPerson={gruppenCountByPerson}
            istZugewiesen={istZugewiesen}
            info={info}
            infoTermine={infoTermine}
            verfByPT={verfByPT}
          />

          {/* Gruppen */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px 24px" }}>
            {planung.gruppen.length === 0 ? (
              <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--color-neutral-500)", gap: 10, textAlign: "center" }}>
                <i className="ph ph-users-three" style={{ fontSize: 36, color: "var(--color-neutral-600)" }} />
                <div>Noch keine Gruppe angelegt.</div>
                <button className="btn btn-primary" onClick={addGruppe}><i className="ph ph-plus" />Erste Gruppe</button>
              </div>
            ) : (
              <div
                style={
                  istATeil
                    ? { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${istBTeil ? 540 : 440}px), 1fr))`, alignItems: "start", gap: 16 }
                    : { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }
                }
              >
                {planung.gruppen.map((g) => (
                  <GruppeCard
                    key={g.id}
                    gruppe={g}
                    mitglieder={mitgliederByGruppe(g.id)}
                    personById={personById}
                    hindByPerson={hindByPerson}
                    verfByPerson={verfByPerson}
                    knotenByPos={knotenByPos}
                    onSetKnoten={(position, knoten) => setKnoten(g.id, position, knoten)}
                    gruppenCountByPerson={gruppenCountByPerson}
                    modus={modus}
                    istATeil={istATeil}
                    istBTeil={istBTeil}
                    onDelete={() => deleteGruppe(g.id)}
                    onRemoveMember={async (mid) => {
                      await api(`/gruppenmitglieder/${mid}`, { method: "DELETE" });
                      reload();
                    }}
                    onSetLaeufer={async (mid, l) => {
                      await api(`/gruppenmitglieder/${mid}`, { method: "PATCH", body: JSON.stringify({ bTeilLaeufer: l }) });
                      reload();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeP && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9, background: "var(--color-surface)", boxShadow: "var(--shadow-md)" }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{personName(activeP)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  );
}

function StarterPool({
  starter,
  doppelstart,
  hindByPerson,
  gruppenCountByPerson,
  istZugewiesen,
  info,
  infoTermine,
  verfByPT,
}: {
  starter: Person[];
  doppelstart: boolean;
  hindByPerson: Map<number, HindernisFaehigkeit>;
  gruppenCountByPerson: Map<number, number>;
  istZugewiesen: (id: number) => boolean;
  info: StarterInfo;
  infoTermine: Termin[];
  verfByPT: Map<string, Verfuegbarkeit["status"]>;
}) {
  return (
    <div
      className="hidden md:flex"
      style={{ width: 216, flex: "none", borderRight: "1px solid var(--color-divider)", flexDirection: "column", overflow: "hidden" }}
    >
      <div style={{ padding: "13px 14px 9px" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Starter</div>
        <div style={{ fontSize: 10.5, color: "var(--color-neutral-500)", marginTop: 1 }}>
          {doppelstart ? "aus Zusagen · ziehen zum Zuteilen" : "aus Zusagen · zugeteilte ausgeblendet"}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {starter.length === 0 && (
          <div style={{ fontSize: 11.5, color: "var(--color-neutral-500)", padding: "8px 4px", lineHeight: 1.5 }}>
            Noch keine Zusagen. In <b>Termine</b> Verfügbarkeit auf „Ja" setzen.
          </div>
        )}
        {starter.map((p) => {
          const meta: React.ReactNode[] = [];
          if (info.alter && p.geburtsdatum) meta.push(<InfoTag key="a" title="Alter">{alter(p.geburtsdatum)} J</InfoTag>);
          if (info.jgAlter && p.geburtsdatum) meta.push(<InfoTag key="j" title="Jahrgangsalter">Jg {alterInDiesemJahr(p.geburtsdatum)}</InfoTag>);
          for (const t of infoTermine) {
            const st = verfByPT.get(`${p.id}:${t.id}`) ?? "offen";
            const s = VERF_STYLE[st];
            const d = fmtDateShort(t.datumVon);
            meta.push(
              <InfoTag key={`t${t.id}`} title={`${t.titel}: ${st}`}>
                <i className={`ph-bold ${s.icon}`} style={{ color: s.c, fontSize: 10 }} />
                {d.tag}. {d.mon}
              </InfoTag>,
            );
          }
          return (
            <StarterChip
              key={p.id}
              person={p}
              hind={hindByPerson.get(p.id)}
              doppel={(gruppenCountByPerson.get(p.id) ?? 0) >= 2}
              zugewiesen={istZugewiesen(p.id)}
              meta={meta.length ? meta : null}
            />
          );
        })}
      </div>
    </div>
  );
}

function StarterChip({ person, hind, doppel, zugewiesen, meta }: { person: Person; hind?: HindernisFaehigkeit; doppel: boolean; zugewiesen: boolean; meta?: React.ReactNode[] | null }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-${person.id}`,
    data: { personId: person.id, from: "pool" },
  });
  const h = hind ? HIND_MAP[hind.status] : null;
  const borderColor = !zugewiesen ? "var(--warn)" : doppel ? "var(--color-accent-700)" : "var(--color-divider)";
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={!zugewiesen ? "noch keiner Gruppe zugewiesen" : undefined}
      style={{
        display: "flex", flexDirection: "column", gap: 5, padding: "7px 9px", borderRadius: 9,
        background: !zugewiesen ? "color-mix(in srgb, var(--warn) 10%, var(--color-bg))" : "var(--color-bg)",
        border: `1px solid ${borderColor}`,
        cursor: "grab", opacity: isDragging ? 0.4 : 1, touchAction: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{personName(person)}</div>
        {doppel && <span style={{ fontSize: 9, fontWeight: 700, background: "var(--color-accent)", color: "#0d0e15", borderRadius: 5, padding: "1px 5px" }}>2×</span>}
        {h && <i className={`ph ${h.icon}`} style={{ color: h.c, fontSize: 14 }} title={h.title} />}
      </div>
      {meta && <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{meta}</div>}
    </div>
  );
}

function InfoTag({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 500,
        background: "var(--color-neutral-800)", color: "var(--color-neutral-300)",
        borderRadius: 5, padding: "1px 5px", whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function AnzeigeMenu({ info, setInfo, termine }: { info: StarterInfo; setInfo: (i: StarterInfo) => void; termine: Termin[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const anzahl = (info.alter ? 1 : 0) + (info.jgAlter ? 1 : 0) + info.termine.length;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn btn-secondary" onClick={() => setOpen((o) => !o)} title="Zusatzinfos in der Starterliste">
        <i className="ph ph-sliders-horizontal" style={{ fontSize: 16 }} />
        Anzeige{anzahl ? ` · ${anzahl}` : ""}
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60, width: 260,
            background: "var(--color-surface)", border: "1px solid var(--color-divider)", borderRadius: 10,
            boxShadow: "var(--shadow-md)", padding: "10px 6px", maxHeight: 360, overflowY: "auto",
          }}
        >
          <MenuLabel>Pro Jugendlichem zeigen</MenuLabel>
          <CheckRow checked={info.alter} onChange={(v) => setInfo({ ...info, alter: v })}>Alter</CheckRow>
          <CheckRow checked={info.jgAlter} onChange={(v) => setInfo({ ...info, jgAlter: v })}>Jahrgangsalter</CheckRow>
          {termine.length > 0 && <MenuLabel>Anwesenheit bei Termin</MenuLabel>}
          {termine.map((t) => {
            const d = fmtDateShort(t.datumVon);
            return (
              <CheckRow
                key={t.id}
                checked={info.termine.includes(t.id)}
                onChange={(v) => setInfo({ ...info, termine: v ? [...info.termine, t.id] : info.termine.filter((x) => x !== t.id) })}
              >
                <span style={{ color: "var(--color-neutral-500)", fontVariantNumeric: "tabular-nums" }}>{d.tag}. {d.mon}</span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.titel}</span>
              </CheckRow>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-neutral-600)", padding: "8px 10px 4px" }}>
      {children}
    </div>
  );
}

function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "flex", alignItems: "center", gap: 9, padding: "6px 10px", borderRadius: 7,
        cursor: "pointer", fontSize: 12.5, minWidth: 0,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ flex: "none" }} />
      {children}
    </label>
  );
}

function GruppeCard({
  gruppe,
  mitglieder,
  personById,
  hindByPerson,
  verfByPerson,
  knotenByPos,
  onSetKnoten,
  gruppenCountByPerson,
  modus,
  istATeil,
  istBTeil,
  onDelete,
  onRemoveMember,
  onSetLaeufer,
}: {
  gruppe: Gruppe;
  mitglieder: Gruppenmitglied[];
  personById: Map<number, Person>;
  hindByPerson: Map<number, HindernisFaehigkeit>;
  verfByPerson: Map<number, string>;
  knotenByPos: Map<string, string>;
  onSetKnoten: (position: string, knoten: string | null) => void;
  gruppenCountByPerson: Map<number, number>;
  modus: string;
  istATeil: boolean;
  istBTeil: boolean;
  onDelete: () => void;
  onRemoveMember: (id: number) => void;
  onSetLaeufer: (id: number, l: number | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `gruppe-${gruppe.id}` });
  const { summe, schnitt, anzahl } = gruppenAlter(mitglieder, personById);
  const soll = sollZeitLabel(summe);
  const warnungen = gruppenWarnungen(mitglieder, personById, verfByPerson as Map<number, "ja" | "nein" | "offen">, modus, new Set());

  const byPos = new Map<string, Gruppenmitglied>();
  mitglieder.forEach((m) => m.aTeilPosition && byPos.set(m.aTeilPosition, m));
  const ohnePos = mitglieder.filter((m) => !m.aTeilPosition);

  // Doppelt vergebene Knoten (unter den 4 Knoten-Positionen) für Warnung ermitteln
  const knotenCount = new Map<string, number>();
  for (const kp of KNOTEN_POSITIONEN) {
    const k = knotenByPos.get(`${gruppe.id}:${kp}`);
    if (k) knotenCount.set(k, (knotenCount.get(k) ?? 0) + 1);
  }
  const doppelteKnoten = new Set([...knotenCount].filter(([, n]) => n > 1).map(([k]) => k));

  return (
    <div ref={setNodeRef} className="panel" style={{ border: `1px solid ${isOver ? "var(--color-accent)" : "var(--color-accent-800)"}`, ...(istATeil ? {} : { width: 280, flex: "none" }) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 15px" }}>
        <i className="ph ph-users-three" style={{ color: "var(--color-accent-300)" }} />
        <h4 style={{ margin: 0, fontSize: 15 }}>{gruppe.name}</h4>
        <span style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>
          {istATeil ? `${byPos.size} / 9 besetzt` : `${mitglieder.length} Personen`}
        </span>
        <button className="btn btn-ghost" style={{ marginLeft: "auto", color: "var(--color-neutral-500)" }} onClick={onDelete} aria-label="Gruppe löschen">
          <i className="ph ph-trash" />
        </button>
      </div>

      {istATeil ? (
        <>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: istBTeil ? "1.4fr 42px 1.5fr 1.5fr 30px" : "1.6fr 42px 1.6fr 30px", padding: "6px 15px", fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--color-neutral-600)", borderTop: "1px solid var(--color-divider)" }}>
            <div>Person</div>
            <div>Pos</div>
            <div>Knoten</div>
            {istBTeil && <div>B-Teil-Läufer</div>}
            <div style={{ textAlign: "center" }}><i className="ph ph-drop-half" title="Wassergraben" /></div>
          </div>
          {A_TEIL_POSITIONEN.map((pos) => {
            const m = byPos.get(pos);
            const p = m ? personById.get(m.personId) : null;
            const hasKnoten = (KNOTEN_POSITIONEN as readonly string[]).includes(pos);
            const knoten = knotenByPos.get(`${gruppe.id}:${pos}`);
            const hind = p ? hindByPerson.get(p.id) : null;
            const h = hind ? HIND_MAP[hind.status] : null;
            return (
              <PositionRow key={pos} gruppeId={gruppe.id} pos={pos} istBTeil={istBTeil} belegt={!!m}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  {p ? (
                    <MemberChip m={m!} p={p} from={gruppe.id} doppel={(gruppenCountByPerson.get(p.id) ?? 0) >= 2} onRemove={() => onRemoveMember(m!.id)} />
                  ) : (
                    <span style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>frei — hierher ziehen</span>
                  )}
                </div>
                <div>
                  <span style={{ display: "inline-grid", placeItems: "center", width: 30, height: 24, borderRadius: 6, fontSize: 11, fontWeight: 700, background: "var(--color-neutral-800)", color: "var(--color-neutral-100)" }}>{pos}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  {hasKnoten ? (
                    <KnotenSelect
                      value={knoten ?? ""}
                      doppelt={!!knoten && doppelteKnoten.has(knoten)}
                      onChange={(k) => onSetKnoten(pos, k)}
                    />
                  ) : null}
                </div>
                {istBTeil && (
                  <div style={{ fontSize: 11.5 }}>
                    {m ? (
                      <LaeuferSelect value={m.bTeilLaeufer} onChange={(l) => onSetLaeufer(m.id, l)} />
                    ) : (
                      <span style={{ color: "var(--color-neutral-700)" }}>—</span>
                    )}
                  </div>
                )}
                <div style={{ textAlign: "center" }}>{h && <i className={`ph ${h.icon}`} style={{ color: h.c, fontSize: 15 }} title={h.title} />}</div>
              </PositionRow>
            );
          })}
          {ohnePos.length > 0 && (
            <div style={{ padding: "8px 15px", borderTop: "1px solid var(--color-divider)", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: "var(--color-neutral-600)", textTransform: "uppercase", letterSpacing: ".06em" }}>ohne Position:</span>
              {ohnePos.map((m) => {
                const p = personById.get(m.personId);
                return p ? <MemberChip key={m.id} m={m} p={p} from={gruppe.id} doppel={(gruppenCountByPerson.get(p.id) ?? 0) >= 2} onRemove={() => onRemoveMember(m.id)} /> : null;
              })}
            </div>
          )}
        </>
      ) : (
        // nur_gruppen: Mitglieder als vertikale Liste (eine Person pro Zeile)
        <div style={{ padding: "10px 15px 13px", borderTop: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 6, minHeight: 52 }}>
          {mitglieder.length === 0 && <span style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>Personen aus der Starterliste hierher ziehen</span>}
          {mitglieder.map((m, i) => {
            const p = personById.get(m.personId);
            return p ? (
              <MemberRow
                key={m.id}
                index={i + 1}
                m={m}
                p={p}
                from={gruppe.id}
                doppel={(gruppenCountByPerson.get(p.id) ?? 0) >= 2}
                hind={hindByPerson.get(p.id)}
                onRemove={() => onRemoveMember(m.id)}
              />
            ) : null;
          })}
        </div>
      )}

      {/* Live-Footer: Alterssumme / Schnitt / Soll-Zeit */}
      {(istBTeil || anzahl > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "13px 18px", borderTop: "1px solid var(--color-divider)", background: "linear-gradient(90deg,rgba(145,132,217,.10),transparent)", flexWrap: "wrap" }}>
          <Stat n={summe} l="Alterssumme" />
          <Stat n={schnitt} l="Ø Alter" />
          {istBTeil && (
            <div style={{ paddingLeft: 22, borderLeft: "1px solid var(--color-divider)" }}>
              <div style={{ font: "600 19px/1 var(--font-heading)", color: "var(--color-accent-200)" }}>{soll.text} min</div>
              <div style={{ fontSize: 10, color: "var(--color-neutral-500)", marginTop: 2 }}>Soll-Zeit B-Teil</div>
            </div>
          )}
          {istBTeil && (
            <span className="ph-tag" style={{ marginLeft: "auto", background: soll.ok ? "var(--color-accent-900)" : "rgba(232,110,110,.16)", color: soll.ok ? "var(--color-accent-200)" : "var(--danger)" }}>
              <i className={`ph ${soll.ok ? "ph-check-circle" : "ph-warning-circle"}`} />
              {soll.ok ? "startberechtigt (90–162)" : "außerhalb 90–162"}
            </span>
          )}
        </div>
      )}

      {warnungen.length > 0 && (
        <div style={{ padding: "10px 15px", borderTop: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 4 }}>
          {warnungen.map((w, i) => (
            <div key={i} style={{ fontSize: 11.5, color: "var(--warn)", display: "flex", alignItems: "center", gap: 6 }}>
              <i className="ph ph-warning" />{w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PositionRow({ gruppeId, pos, istBTeil, belegt, children }: { gruppeId: number; pos: string; istBTeil: boolean; belegt: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `pos-${gruppeId}-${pos}` });
  const aktiv = isOver && !belegt; // nur freie Positionen hervorheben
  return (
    <div
      ref={setNodeRef}
      style={{
        display: "grid",
        gridTemplateColumns: istBTeil ? "1.4fr 42px 1.5fr 1.5fr 30px" : "1.6fr 42px 1.6fr 30px",
        alignItems: "center", padding: "7px 15px", borderTop: "1px solid var(--color-divider)",
        background: aktiv ? "color-mix(in srgb,var(--color-accent) 12%,transparent)" : "transparent",
        boxShadow: aktiv ? "inset 0 0 0 1.5px var(--color-accent)" : undefined,
        borderRadius: aktiv ? 8 : undefined,
      }}
    >
      {children}
    </div>
  );
}

function MemberRow({ index, m, p, from, doppel, hind, onRemove }: { index: number; m: Gruppenmitglied; p: Person; from: number; doppel: boolean; hind?: HindernisFaehigkeit; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `member-${m.id}`,
    data: { personId: p.id, from },
  });
  const h = hind ? HIND_MAP[hind.status] : null;
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 10,
        background: "var(--color-bg)", border: `1px solid ${doppel ? "var(--color-accent-700)" : "var(--color-divider)"}`,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <span style={{ display: "inline-grid", placeItems: "center", width: 22, height: 22, flex: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
        {index}
      </span>
      <span
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0, cursor: "grab", touchAction: "none" }}
        title="ziehen zum Verschieben"
      >
        <i className="ph ph-dots-six-vertical" style={{ color: "var(--color-neutral-600)", fontSize: 15, flex: "none" }} />
        <span style={{ minWidth: 0, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{personName(p)}</span>
      </span>
      {doppel && <span style={{ fontSize: 9, fontWeight: 700, background: "var(--color-accent)", color: "#0d0e15", borderRadius: 5, padding: "1px 6px", flex: "none" }}>2×</span>}
      {h && <i className={`ph ${h.icon}`} style={{ color: h.c, fontSize: 15, flex: "none" }} title={h.title} />}
      <button onClick={onRemove} style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--color-neutral-600)", padding: 2, flex: "none" }} aria-label="Entfernen">
        <i className="ph ph-x" style={{ fontSize: 14 }} />
      </button>
    </div>
  );
}

function MemberChip({ m, p, from, doppel, onRemove }: { m: Gruppenmitglied; p: Person; from: number; doppel: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `member-${m.id}`,
    data: { personId: p.id, from },
  });
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span ref={setNodeRef} {...listeners} {...attributes} style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "grab", opacity: isDragging ? 0.4 : 1, touchAction: "none", minWidth: 0 }}>
        <span style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{personName(p)}</span>
        {doppel && <span style={{ fontSize: 8.5, fontWeight: 700, background: "var(--color-accent)", color: "#0d0e15", borderRadius: 4, padding: "0px 4px" }}>2×</span>}
      </span>
      <button onClick={onRemove} style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--color-neutral-600)", padding: 0 }} aria-label="Entfernen">
        <i className="ph ph-x" style={{ fontSize: 12 }} />
      </button>
    </span>
  );
}

function LaeuferSelect({ value, onChange }: { value: number | null; onChange: (l: number | null) => void }) {
  return (
    <select
      className="input"
      style={{ minHeight: 28, padding: "2px 6px", fontSize: 11.5, width: "auto", display: "inline-block" }}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">— Läufer —</option>
      {Object.entries(B_TEIL_AUFGABEN).map(([nr, aufg]) => (
        <option key={nr} value={nr}>{nr} · {aufg}</option>
      ))}
    </select>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div style={{ font: "600 19px/1 var(--font-heading)" }}>{n}</div>
      <div style={{ fontSize: 10, color: "var(--color-neutral-500)", marginTop: 2 }}>{l}</div>
    </div>
  );
}

function KnotenSelect({ value, doppelt, onChange }: { value: string; doppelt: boolean; onChange: (knoten: string | null) => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <select
        className="input"
        title={doppelt ? "Knoten in dieser Gruppe doppelt vergeben" : undefined}
        style={{ minHeight: 28, padding: "2px 6px", fontSize: 11.5, width: "auto", display: "inline-block", ...(doppelt ? { borderColor: "var(--danger)", color: "var(--danger)" } : {}) }}
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">— offen —</option>
        {KNOTEN.map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>
      {doppelt && <i className="ph ph-warning" style={{ color: "var(--danger)", fontSize: 14, flex: "none" }} title="Knoten doppelt vergeben" />}
    </span>
  );
}
