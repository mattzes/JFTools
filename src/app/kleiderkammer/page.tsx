"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import {
  api,
  useApi,
  Person,
  Kleidungsstueck,
  KleidungBestand,
  KleidungAusgabe,
  personName,
} from "@/lib/api";
import { DatePicker, Dialog, Empty, PageHeader, Spinner, fmtDate } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmProvider";
import { useStoredState } from "@/lib/useStoredState";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Modus = "bestand" | "ausgabe" | "rueckgaben";

const bestandKey = (stueckId: number, groesse: string | null) => `${stueckId}:${groesse ?? ""}`;

// ── Dialog-Formulare ──
type GroessenZeile = { groesse: string; menge: string };
type NeuStueck = { name: string; mitGroessen: boolean; menge: string; groessen: GroessenZeile[] };
const EMPTY_STUECK: NeuStueck = { name: "", mitGroessen: false, menge: "", groessen: [{ groesse: "", menge: "" }] };

// Ein Dialog für alles: Bezeichnung, Bestand je Größe (bzw. gesamt), Löschen
// uid: stabile Client-ID für Drag-&-Drop (bleibt beim Live-Umsortieren konstant)
type EditZeile = { uid: string; id: number | null; origGroesse: string; groesse: string; menge: string };
let uidCounter = 0;
const neueZeileUid = () => `z${++uidCounter}`;
type EditForm = {
  id: number;
  name: string;
  mitGroessen: boolean;
  groessen: EditZeile[]; // bei !mitGroessen: eine Zeile (groesse leer)
  removed: number[]; // Bestand-IDs, die gelöscht werden sollen
};

type AusgabeForm = {
  kleidungsstueckId: number | null;
  groesse: string | null;
  modus: "vorhanden" | "erhoehen";
  neueGroesse: boolean;
  menge: string;
  ausgegebenAm: string;
};

function heute() {
  return new Date().toISOString().slice(0, 10);
}

// Element in einem Array von `from` nach `to` verschieben (neue Kopie)
function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function KleiderkammerPage() {
  const confirm = useConfirm();
  const { data: personen } = useApi<Person[]>("/personen");
  const { data: stuecke, reload: reloadStuecke } = useApi<Kleidungsstueck[]>("/kleidungsstuecke");
  const { data: bestand, reload: reloadBestand } = useApi<KleidungBestand[]>("/kleidung-bestand");
  const { data: ausgaben, reload: reloadAusgaben } = useApi<KleidungAusgabe[]>("/kleidung-ausgaben");

  const [modusRaw, setModus] = useStoredState("kleiderkammer.modus", "bestand");
  const modus = modusRaw as Modus;
  const [neuStueck, setNeuStueck] = useState<NeuStueck | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [selPersonId, setSelPersonId] = useState<number | null>(null);
  const [suche, setSuche] = useState("");
  const [ausgabeForm, setAusgabeForm] = useState<AusgabeForm | null>(null);
  const [tauschForm, setTauschForm] = useState<{ ausgaben: KleidungAusgabe[]; groesse: string | null } | null>(null);
  const [rueckgabeForm, setRueckgabeForm] = useState<{ ausgaben: KleidungAusgabe[]; menge: string } | null>(null);

  // ── Ableitungen ──
  const issuedByKey = useMemo(() => {
    const m = new Map<string, number>();
    ausgaben?.forEach((a) => {
      const k = bestandKey(a.kleidungsstueckId, a.groesse);
      m.set(k, (m.get(k) ?? 0) + a.menge);
    });
    return m;
  }, [ausgaben]);

  const bestandByStueck = useMemo(() => {
    const m = new Map<number, KleidungBestand[]>();
    bestand?.forEach((b) => {
      const arr = m.get(b.kleidungsstueckId) ?? [];
      arr.push(b);
      m.set(b.kleidungsstueckId, arr);
    });
    // Nach benutzerdefinierter Reihenfolge sortieren, bei Gleichstand numerisch/alphabetisch
    m.forEach((arr) =>
      arr.sort(
        (a, b) =>
          a.sortierung - b.sortierung ||
          (a.groesse ?? "").localeCompare(b.groesse ?? "", "de", { numeric: true }),
      ),
    );
    return m;
  }, [bestand]);

  const stueckeSortiert = useMemo(
    () => (stuecke ? [...stuecke].sort((a, b) => a.name.localeCompare(b.name, "de")) : []),
    [stuecke],
  );

  const stueckById = useMemo(() => {
    const m = new Map<number, Kleidungsstueck>();
    stuecke?.forEach((s) => m.set(s.id, s));
    return m;
  }, [stuecke]);

  if (!personen || !stuecke || !bestand || !ausgaben) return <Spinner />;

  const issued = (stueckId: number, groesse: string | null) => issuedByKey.get(bestandKey(stueckId, groesse)) ?? 0;
  const verfuegbar = (b: KleidungBestand) => b.menge - issued(b.kleidungsstueckId, b.groesse);

  const jugendliche = personen
    .filter((p) => p.aktiv && p.rolle === "jugendlich")
    .filter((p) => {
      const q = suche.trim().toLowerCase();
      return !q || personName(p).toLowerCase().includes(q);
    })
    .sort((a, b) => personName(a).localeCompare(personName(b), "de"));

  const selPerson = personen.find((p) => p.id === selPersonId) ?? null;
  const personAusgaben = selPerson ? ausgaben.filter((a) => a.personId === selPerson.id) : [];

  // ── Aktionen ──
  async function speichereStueck() {
    if (!neuStueck || !neuStueck.name.trim()) return;
    const body = {
      name: neuStueck.name.trim(),
      mitGroessen: neuStueck.mitGroessen,
      bestand: neuStueck.mitGroessen
        ? neuStueck.groessen
            .filter((g) => g.groesse.trim() !== "")
            .map((g) => ({ groesse: g.groesse.trim(), menge: Number(g.menge) || 0 }))
        : neuStueck.menge.trim() !== ""
          ? [{ groesse: null, menge: Number(neuStueck.menge) || 0 }]
          : [],
    };
    await api("/kleidungsstuecke", { method: "POST", body: JSON.stringify(body) });
    setNeuStueck(null);
    reloadStuecke();
    reloadBestand();
  }

  function openEdit(s: Kleidungsstueck) {
    const rows = bestandByStueck.get(s.id) ?? [];
    setEditForm({
      id: s.id,
      name: s.name,
      mitGroessen: s.mitGroessen,
      groessen: s.mitGroessen
        ? rows.map((b) => ({ uid: neueZeileUid(), id: b.id, origGroesse: b.groesse ?? "", groesse: b.groesse ?? "", menge: String(b.menge) }))
        : [{ uid: neueZeileUid(), id: rows[0]?.id ?? null, origGroesse: "", groesse: "", menge: rows[0] ? String(rows[0].menge) : "" }],
      removed: [],
    });
  }

  async function speichereEdit() {
    if (!editForm || !editForm.name.trim()) return;
    const orig = stueckById.get(editForm.id);

    // 1. Umbenennung
    if (orig && orig.name !== editForm.name.trim()) {
      await api(`/kleidungsstuecke/${editForm.id}`, { method: "PATCH", body: JSON.stringify({ name: editForm.name.trim() }) });
    }

    // 2. Explizit entfernte Größen löschen
    for (const id of editForm.removed) {
      await api(`/kleidung-bestand/${id}`, { method: "DELETE" });
    }

    // 3. Bestand je Größe (bzw. gesamt) upserten
    if (editForm.mitGroessen) {
      // Reihenfolge im Formular = benutzerdefinierte Sortierung (sortierung = Index)
      for (let i = 0; i < editForm.groessen.length; i++) {
        const g = editForm.groessen[i];
        const name = g.groesse.trim();
        if (name === "") continue;
        // Umbenannte Größe: alte Zeile entfernen, damit keine Waise bleibt
        if (g.id != null && g.origGroesse !== name) {
          await api(`/kleidung-bestand/${g.id}`, { method: "DELETE" });
        }
        await api("/kleidung-bestand", {
          method: "PUT",
          body: JSON.stringify({ kleidungsstueckId: editForm.id, groesse: name, menge: Number(g.menge) || 0, sortierung: i }),
        });
      }
    } else {
      const g = editForm.groessen[0];
      await api("/kleidung-bestand", {
        method: "PUT",
        body: JSON.stringify({ kleidungsstueckId: editForm.id, groesse: null, menge: Number(g?.menge) || 0 }),
      });
    }

    setEditForm(null);
    reloadStuecke();
    reloadBestand();
  }

  async function loescheStueckAusEdit() {
    if (!editForm) return;
    if (
      await confirm({
        title: "Kleidungsstück löschen",
        message: `„${editForm.name}" samt Bestand und allen Ausgaben löschen?`,
        confirmLabel: "Löschen",
        danger: true,
      })
    ) {
      await api(`/kleidungsstuecke/${editForm.id}`, { method: "DELETE" });
      setEditForm(null);
      reloadStuecke();
      reloadBestand();
      reloadAusgaben();
    }
  }

  async function speichereAusgabe() {
    if (!ausgabeForm || !selPerson || ausgabeForm.kleidungsstueckId == null) return;
    const stueckId = ausgabeForm.kleidungsstueckId;
    const stueck = stueckById.get(stueckId);
    const menge = Number(ausgabeForm.menge) || 1;
    const groesse = stueck?.mitGroessen ? ausgabeForm.groesse?.trim() || null : null;

    if (ausgabeForm.modus === "erhoehen") {
      const rows = bestandByStueck.get(stueckId) ?? [];
      const row = rows.find((b) => b.groesse === groesse);
      await api("/kleidung-bestand", {
        method: "PUT",
        body: JSON.stringify({
          kleidungsstueckId: stueckId,
          groesse,
          menge: (row?.menge ?? 0) + menge,
          ...(row ? {} : { sortierung: rows.length }),
        }),
      });
    }

    await api("/kleidung-ausgaben", {
      method: "POST",
      body: JSON.stringify({
        personId: selPerson.id,
        kleidungsstueckId: stueckId,
        groesse,
        menge,
        ausgegebenAm: ausgabeForm.ausgegebenAm || null,
      }),
    });
    setAusgabeForm(null);
    reloadBestand();
    reloadAusgaben();
  }

  async function speichereRueckgabe() {
    if (!rueckgabeForm) return;
    const { ausgaben } = rueckgabeForm;
    const total = ausgaben.reduce((n, a) => n + a.menge, 0);
    let rest = Math.min(Math.max(Number(rueckgabeForm.menge) || 0, 1), total);
    // Bei gruppierten Utensilien über mehrere Einträge zurücknehmen (neueste zuerst)
    for (const a of [...ausgaben].reverse()) {
      if (rest <= 0) break;
      if (rest >= a.menge) {
        await api(`/kleidung-ausgaben/${a.id}`, { method: "DELETE" });
        rest -= a.menge;
      } else {
        await api(`/kleidung-ausgaben/${a.id}`, { method: "PATCH", body: JSON.stringify({ menge: a.menge - rest }) });
        rest = 0;
      }
    }
    setRueckgabeForm(null);
    reloadAusgaben();
  }

  // Teilmenge auf die Rückgabe-Warteliste vormerken (statt sofort zurücknehmen).
  // Wie speichereRueckgabe, aber die Menge wird als vorgemerkt markiert; bei Teilmengen
  // wird die Zeile in einen aktiven Rest und einen neuen vorgemerkten Eintrag gesplittet.
  async function speichereVormerken() {
    if (!rueckgabeForm) return;
    const { ausgaben } = rueckgabeForm;
    const total = ausgaben.reduce((n, a) => n + a.menge, 0);
    let rest = Math.min(Math.max(Number(rueckgabeForm.menge) || 0, 1), total);
    const am = heute();
    for (const a of [...ausgaben].reverse()) {
      if (rest <= 0) break;
      if (rest >= a.menge) {
        await api(`/kleidung-ausgaben/${a.id}`, { method: "PATCH", body: JSON.stringify({ rueckgabeAngefordertAm: am }) });
        rest -= a.menge;
      } else {
        await api(`/kleidung-ausgaben/${a.id}`, { method: "PATCH", body: JSON.stringify({ menge: a.menge - rest }) });
        await api("/kleidung-ausgaben", {
          method: "POST",
          body: JSON.stringify({
            personId: a.personId,
            kleidungsstueckId: a.kleidungsstueckId,
            groesse: a.groesse,
            menge: rest,
            ausgegebenAm: a.ausgegebenAm,
            rueckgabeAngefordertAm: am,
          }),
        });
        rest = 0;
      }
    }
    setRueckgabeForm(null);
    reloadAusgaben();
  }

  // Rückgabe finalisieren: vorgemerkte Einträge einer Zeile löschen → Bestand wird frei
  async function zurueckgegeben(eintraege: KleidungAusgabe[]) {
    for (const a of eintraege) {
      await api(`/kleidung-ausgaben/${a.id}`, { method: "DELETE" });
    }
    reloadAusgaben();
  }

  async function speichereTausch() {
    if (!tauschForm || !tauschForm.groesse) return;
    // Gruppierte Zeile: alle betroffenen Einträge auf die neue Größe umstellen
    for (const a of tauschForm.ausgaben) {
      await api(`/kleidung-ausgaben/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({ groesse: tauschForm.groesse }),
      });
    }
    setTauschForm(null);
    reloadAusgaben();
  }

  // Für den Tausch-Dialog: andere Größen desselben Stücks mit genügend Bestand
  const tauschErste = tauschForm ? tauschForm.ausgaben[0] : null;
  const tauschMenge = tauschForm ? tauschForm.ausgaben.reduce((n, a) => n + a.menge, 0) : 0;
  const tauschStueck = tauschErste ? stueckById.get(tauschErste.kleidungsstueckId) : null;
  const tauschOptionen = tauschErste
    ? (bestandByStueck.get(tauschErste.kleidungsstueckId) ?? []).filter(
        (b) => b.groesse !== tauschErste.groesse,
      )
    : [];

  // Für den Ausgabe-Dialog: verfügbare Bestand-Zeilen des gewählten Stücks
  const ausgabeStueck = ausgabeForm?.kleidungsstueckId != null ? stueckById.get(ausgabeForm.kleidungsstueckId) : null;
  const ausgabeBestand = ausgabeForm?.kleidungsstueckId != null ? bestandByStueck.get(ausgabeForm.kleidungsstueckId) ?? [] : [];
  const ausgabeMaxMenge = (() => {
    if (!ausgabeStueck) return 0;
    const row = ausgabeStueck.mitGroessen
      ? ausgabeBestand.find((b) => b.groesse === ausgabeForm?.groesse)
      : ausgabeBestand.find((b) => b.groesse === null);
    return row ? verfuegbar(row) : 0;
  })();

  return (
    <>
      <PageHeader title="Kleiderkammer" sub="Bestand verwalten & Utensilien an Jugendliche ausgeben">
        <div className="seg" role="tablist" aria-label="Ansicht">
          <button type="button" className="seg-opt" data-on={modus === "bestand"} onClick={() => setModus("bestand")}>
            <i className="ph ph-stack" />
            Bestand
          </button>
          <button type="button" className="seg-opt" data-on={modus === "ausgabe"} onClick={() => setModus("ausgabe")}>
            <i className="ph ph-user-list" />
            Ausgabe
          </button>
          <button type="button" className="seg-opt" data-on={modus === "rueckgaben"} onClick={() => setModus("rueckgaben")}>
            <i className="ph ph-hourglass-medium" />
            Rückgaben
          </button>
        </div>
        {modus === "bestand" && (
          <button className="btn btn-secondary" onClick={() => setNeuStueck({ ...EMPTY_STUECK })}>
            <i className="ph ph-plus" />
            Kleidungsstück hinzufügen
          </button>
        )}
        {(modus === "ausgabe" || modus === "rueckgaben") && (
          <input
            className={`input input-search${modus === "ausgabe" && selPerson ? " hidden lg:block" : ""}`}
            placeholder="Suchen …"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
        )}
      </PageHeader>

      {modus === "bestand" ? (
        <BestandAnsicht
          stuecke={stueckeSortiert}
          bestandByStueck={bestandByStueck}
          issued={issued}
          verfuegbar={verfuegbar}
          onEdit={openEdit}
        />
      ) : modus === "rueckgaben" ? (
        <RueckgabenAnsicht
          jugendliche={jugendliche}
          ausgabenAlle={ausgaben}
          stueckById={stueckById}
          onZurueckgegeben={zurueckgegeben}
        />
      ) : (
        <AusgabeAnsicht
          jugendliche={jugendliche}
          selPerson={selPerson}
          setSelPersonId={setSelPersonId}
          personAusgaben={personAusgaben}
          stueckById={stueckById}
          bestandByStueck={bestandByStueck}
          verfuegbar={verfuegbar}
          ausgabenAlle={ausgaben}
          onAusgeben={() => setAusgabeForm({ kleidungsstueckId: null, groesse: null, modus: "vorhanden", neueGroesse: false, menge: "1", ausgegebenAm: heute() })}
          onRueckgabe={(ausgaben) => setRueckgabeForm({ ausgaben, menge: String(ausgaben.reduce((n, a) => n + a.menge, 0)) })}
          onTauschen={(ausgaben) => setTauschForm({ ausgaben, groesse: null })}
        />
      )}

      {/* Dialog: Kleidungsstück anlegen */}
      {neuStueck && (
        <Dialog title="Kleidungsstück hinzufügen" onClose={() => setNeuStueck(null)} fullscreenMobile>
          <div className="field">
            <label>Bezeichnung</label>
            <input
              className="input"
              autoFocus
              placeholder="z. B. Einsatzjacke, Helm, Stiefel"
              value={neuStueck.name}
              onChange={(e) => setNeuStueck({ ...neuStueck, name: e.target.value })}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, cursor: "pointer", margin: "2px 0 4px" }}>
            <input
              type="checkbox"
              checked={neuStueck.mitGroessen}
              onChange={(e) => setNeuStueck({ ...neuStueck, mitGroessen: e.target.checked })}
            />
            nach Größen unterteilen
          </label>

          {neuStueck.mitGroessen ? (
            <div className="field">
              <label>Größen & Startbestand</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {neuStueck.groessen.map((g, i) => (
                  <div key={i} style={{ display: "flex", gap: 8 }}>
                    <input
                      className="input"
                      placeholder="Größe (z. B. 152, S, 42)"
                      value={g.groesse}
                      onChange={(e) => {
                        const groessen = [...neuStueck.groessen];
                        groessen[i] = { ...g, groesse: e.target.value };
                        setNeuStueck({ ...neuStueck, groessen });
                      }}
                    />
                    <input
                      className="input"
                      type="number"
                      min={0}
                      placeholder="Menge"
                      style={{ maxWidth: 110 }}
                      value={g.menge}
                      onChange={(e) => {
                        const groessen = [...neuStueck.groessen];
                        groessen[i] = { ...g, menge: e.target.value };
                        setNeuStueck({ ...neuStueck, groessen });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      aria-label="Größe entfernen"
                      onClick={() => setNeuStueck({ ...neuStueck, groessen: neuStueck.groessen.filter((_, j) => j !== i) })}
                    >
                      <i className="ph ph-x" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ alignSelf: "flex-start", marginTop: 6 }}
                onClick={() => setNeuStueck({ ...neuStueck, groessen: [...neuStueck.groessen, { groesse: "", menge: "" }] })}
              >
                <i className="ph ph-plus" /> Größe hinzufügen
              </button>
            </div>
          ) : (
            <div className="field">
              <label>Gesamtbestand</label>
              <input
                className="input"
                type="number"
                min={0}
                placeholder="Anzahl"
                value={neuStueck.menge}
                onChange={(e) => setNeuStueck({ ...neuStueck, menge: e.target.value })}
              />
            </div>
          )}

          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setNeuStueck(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={speichereStueck} disabled={!neuStueck.name.trim()}>Anlegen</button>
          </div>
        </Dialog>
      )}

      {/* Dialog: Kleidungsstück bearbeiten – alles in einem */}
      {editForm && (
        <Dialog title="Kleidungsstück bearbeiten" onClose={() => setEditForm(null)} fullscreenMobile>
          <div className="field">
            <label>Bezeichnung</label>
            <input
              className="input"
              autoFocus
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>

          {editForm.mitGroessen ? (
            <div className="field">
              <label>Größen & Bestand · zum Sortieren am Griff ziehen</label>
              <GroessenEditor
                groessen={editForm.groessen}
                onChange={(groessen) => setEditForm({ ...editForm, groessen })}
                onRemove={(i) =>
                  setEditForm({
                    ...editForm,
                    groessen: editForm.groessen.filter((_, j) => j !== i),
                    removed: editForm.groessen[i].id != null ? [...editForm.removed, editForm.groessen[i].id!] : editForm.removed,
                  })
                }
              />
              <button
                type="button"
                className="btn btn-ghost"
                style={{ alignSelf: "flex-start", marginTop: 6 }}
                onClick={() => setEditForm({ ...editForm, groessen: [...editForm.groessen, { uid: neueZeileUid(), id: null, origGroesse: "", groesse: "", menge: "" }] })}
              >
                <i className="ph ph-plus" /> Größe hinzufügen
              </button>
            </div>
          ) : (
            <div className="field">
              <label>Gesamtbestand</label>
              <input
                className="input"
                type="number"
                min={0}
                value={editForm.groessen[0]?.menge ?? ""}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    groessen: [{ ...(editForm.groessen[0] ?? { uid: neueZeileUid(), id: null, origGroesse: "", groesse: "" }), menge: e.target.value }],
                  })
                }
              />
            </div>
          )}

          <div className="dialog-actions">
            <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={loescheStueckAusEdit}>
              <i className="ph ph-trash" /> Löschen
            </button>
            <button className="btn btn-secondary" onClick={() => setEditForm(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={speichereEdit} disabled={!editForm.name.trim()}>Speichern</button>
          </div>
        </Dialog>
      )}

      {/* Dialog: Utensil ausgeben */}
      {ausgabeForm && selPerson && (
        <Dialog title={`Utensil ausgeben — ${personName(selPerson)}`} onClose={() => setAusgabeForm(null)} fullscreenMobile>
          <div className="field">
            <label>Kleidungsstück</label>
            <select
              className="input"
              value={ausgabeForm.kleidungsstueckId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                setAusgabeForm({ ...ausgabeForm, kleidungsstueckId: id, groesse: null, neueGroesse: false });
              }}
            >
              <option value="">— wählen —</option>
              {stueckeSortiert.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {ausgabeStueck && (
            <div className="field">
              <label>Quelle</label>
              <div className="seg" role="tablist" aria-label="Bestandsquelle">
                <button
                  type="button"
                  className="seg-opt"
                  data-on={ausgabeForm.modus === "vorhanden"}
                  onClick={() => setAusgabeForm({ ...ausgabeForm, modus: "vorhanden", groesse: null, neueGroesse: false })}
                >
                  <i className="ph ph-stack" /> Aus Bestand
                </button>
                <button
                  type="button"
                  className="seg-opt"
                  data-on={ausgabeForm.modus === "erhoehen"}
                  onClick={() => setAusgabeForm({ ...ausgabeForm, modus: "erhoehen", groesse: null, neueGroesse: false })}
                >
                  <i className="ph ph-plus-circle" /> Bestand erhöhen
                </button>
              </div>
            </div>
          )}

          {ausgabeStueck?.mitGroessen && (() => {
            const erhoehen = ausgabeForm.modus === "erhoehen";
            // Im Erhöhen-Modus ohne vorhandene Größen gibt es nichts zum Auffüllen → direkt Freitext
            const nurNeu = erhoehen && ausgabeBestand.length === 0;
            const freitext = erhoehen && (ausgabeForm.neueGroesse || nurNeu);
            return (
              <div className="field">
                <label>Größe</label>
                {freitext ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="input"
                      autoFocus
                      placeholder="Größe (z. B. 152, S, 42)"
                      value={ausgabeForm.groesse ?? ""}
                      onChange={(e) => setAusgabeForm({ ...ausgabeForm, groesse: e.target.value || null })}
                    />
                    {!nurNeu && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Zurück zur Auswahl"
                        onClick={() => setAusgabeForm({ ...ausgabeForm, neueGroesse: false, groesse: null })}
                      >
                        <i className="ph ph-list" />
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    className="input"
                    value={ausgabeForm.groesse ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "__neu__") {
                        setAusgabeForm({ ...ausgabeForm, neueGroesse: true, groesse: "" });
                        return;
                      }
                      setAusgabeForm({ ...ausgabeForm, groesse: e.target.value || null });
                    }}
                  >
                    <option value="">— wählen —</option>
                    {ausgabeBestand.map((b) => {
                      const v = verfuegbar(b);
                      // Im Erhöhen-Modus auch ausverkaufte Größen wählbar (werden aufgefüllt)
                      return (
                        <option key={b.id} value={b.groesse ?? ""} disabled={!erhoehen && v <= 0}>
                          {b.groesse} — {v} verfügbar
                        </option>
                      );
                    })}
                    {erhoehen && <option value="__neu__">+ Neue Größe …</option>}
                  </select>
                )}
              </div>
            );
          })()}

          <div className="field">
            <label>Menge{ausgabeStueck ? ` (${ausgabeMaxMenge} verfügbar)` : ""}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={ausgabeForm.menge}
              onChange={(e) => setAusgabeForm({ ...ausgabeForm, menge: e.target.value })}
            />
            {(() => {
              if (ausgabeForm.modus !== "erhoehen") return null;
              const anzahl = Number(ausgabeForm.menge) || 0;
              if (anzahl < 1) return null;
              const groesse = ausgabeStueck?.mitGroessen ? ausgabeForm.groesse?.trim() : null;
              const label =
                ausgabeMaxMenge === 0 && !ausgabeBestand.some((b) => (b.groesse ?? "") === (groesse ?? ""))
                  ? `Neuer Bestand${groesse ? ` „${groesse}"` : ""} wird mit ${anzahl} angelegt`
                  : `Bestand wird um ${anzahl} erhöht`;
              return (
                <div style={{ fontSize: 12, color: "var(--color-neutral-500)", marginTop: 4 }}>
                  <i className="ph ph-info" /> {label}
                </div>
              );
            })()}
          </div>
          <div className="field">
            <label>Ausgegeben am</label>
            <DatePicker value={ausgabeForm.ausgegebenAm} onChange={(v) => setAusgabeForm({ ...ausgabeForm, ausgegebenAm: v })} />
          </div>

          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setAusgabeForm(null)}>Abbrechen</button>
            <button
              className="btn btn-primary"
              onClick={speichereAusgabe}
              disabled={
                ausgabeForm.kleidungsstueckId == null ||
                (ausgabeStueck?.mitGroessen && !ausgabeForm.groesse?.trim()) ||
                (Number(ausgabeForm.menge) || 0) < 1 ||
                (ausgabeForm.modus === "vorhanden" && (Number(ausgabeForm.menge) || 0) > ausgabeMaxMenge)
              }
            >
              Ausgeben
            </button>
          </div>
        </Dialog>
      )}

      {/* Dialog: Größe tauschen */}
      {tauschForm && tauschStueck && (
        <Dialog title={`Größe tauschen — ${tauschStueck.name}`} onClose={() => setTauschForm(null)}>
          <div style={{ fontSize: 13, color: "var(--color-neutral-500)", marginBottom: 4 }}>
            Aktuell: Größe {tauschErste?.groesse ?? "—"} × {tauschMenge}
          </div>
          <div className="field">
            <label>Neue Größe</label>
            <select
              className="input"
              value={tauschForm.groesse ?? ""}
              onChange={(e) => setTauschForm({ ...tauschForm, groesse: e.target.value || null })}
            >
              <option value="">— wählen —</option>
              {tauschOptionen.map((b) => {
                const v = verfuegbar(b);
                const reicht = v >= tauschMenge;
                return (
                  <option key={b.id} value={b.groesse ?? ""} disabled={!reicht}>
                    {b.groesse} — {v} verfügbar
                  </option>
                );
              })}
            </select>
          </div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setTauschForm(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={speichereTausch} disabled={!tauschForm.groesse}>Tauschen</button>
          </div>
        </Dialog>
      )}

      {/* Dialog: Rückgabe (mit Menge) */}
      {rueckgabeForm && (() => {
        const first = rueckgabeForm.ausgaben[0];
        const total = rueckgabeForm.ausgaben.reduce((n, a) => n + a.menge, 0);
        const name = stueckById.get(first.kleidungsstueckId)?.name ?? "Utensil";
        return (
          <Dialog title={`Rückgabe — ${name}`} onClose={() => setRueckgabeForm(null)}>
            <div style={{ fontSize: 13, color: "var(--color-neutral-500)", marginBottom: 4 }}>
              Ausgegeben: {first.groesse ? `Größe ${first.groesse} · ` : ""}
              {total} Stück
            </div>
            <div className="field">
              <label>Menge (max. {total})</label>
              <input
                className="input"
                type="number"
                min={1}
                max={total}
                autoFocus
                value={rueckgabeForm.menge}
                onChange={(e) => setRueckgabeForm({ ...rueckgabeForm, menge: e.target.value })}
              />
            </div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
              „Rückgabe vormerken" setzt die Menge auf die Warteliste (wartet auf Rückgabe); „Zurücknehmen" gibt sie sofort in den Bestand zurück.
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setRueckgabeForm(null)}>Abbrechen</button>
              <button
                className="btn btn-secondary"
                onClick={speichereVormerken}
                disabled={(Number(rueckgabeForm.menge) || 0) < 1 || (Number(rueckgabeForm.menge) || 0) > total}
              >
                <i className="ph ph-hourglass-medium" /> Rückgabe vormerken
              </button>
              <button
                className="btn btn-primary"
                onClick={speichereRueckgabe}
                disabled={(Number(rueckgabeForm.menge) || 0) < 1 || (Number(rueckgabeForm.menge) || 0) > total}
              >
                Zurücknehmen
              </button>
            </div>
          </Dialog>
        );
      })()}
    </>
  );
}

// ── Größen-Editor mit Drag-&-Drop-Sortierung (touch-tauglich) ──
function GroessenEditor({
  groessen,
  onChange,
  onRemove,
}: {
  groessen: EditZeile[];
  onChange: (groessen: EditZeile[]) => void;
  onRemove: (index: number) => void;
}) {
  // Kleine Aktivierungsdistanz: Tippen in die Felder bleibt möglich, erst Ziehen startet DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = groessen.findIndex((g) => g.uid === active.id);
    const to = groessen.findIndex((g) => g.uid === over.id);
    if (from !== -1 && to !== -1) onChange(moveItem(groessen, from, to));
  }

  const setField = (i: number, patch: Partial<EditZeile>) => {
    const next = [...groessen];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <SortableContext items={groessen.map((g) => g.uid)} strategy={verticalListSortingStrategy}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {groessen.map((g, i) => (
            <GroesseRow key={g.uid} index={i} zeile={g} onField={setField} onRemove={onRemove} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function GroesseRow({
  index,
  zeile,
  onField,
  onRemove,
}: {
  index: number;
  zeile: EditZeile;
  onField: (i: number, patch: Partial<EditZeile>) => void;
  onRemove: (i: number) => void;
}) {
  // Live-Umsortierung: andere Einträge weichen aus, unter dem gehaltenen Element bleibt eine Lücke
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: zeile.uid });
  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex", gap: 8, alignItems: "center", borderRadius: 8,
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <button
        type="button"
        className="btn btn-ghost"
        aria-label="Zum Sortieren ziehen"
        title="Zum Sortieren ziehen"
        style={{ flex: "none", padding: 6, cursor: "grab", touchAction: "none", color: "var(--color-neutral-500)" }}
        {...attributes}
        {...listeners}
      >
        <i className="ph ph-dots-six-vertical" />
      </button>
      <input
        className="input"
        placeholder="Größe (z. B. 152, S, 42)"
        value={zeile.groesse}
        onChange={(e) => onField(index, { groesse: e.target.value })}
      />
      <input
        className="input"
        type="number"
        min={0}
        placeholder="Menge"
        style={{ maxWidth: 110 }}
        value={zeile.menge}
        onChange={(e) => onField(index, { menge: e.target.value })}
      />
      <button
        type="button"
        className="btn btn-ghost"
        aria-label="Größe entfernen"
        onClick={() => onRemove(index)}
      >
        <i className="ph ph-x" />
      </button>
    </div>
  );
}

// ── Bestand-Ansicht ──
function BestandAnsicht({
  stuecke,
  bestandByStueck,
  issued,
  verfuegbar,
  onEdit,
}: {
  stuecke: Kleidungsstueck[];
  bestandByStueck: Map<number, KleidungBestand[]>;
  issued: (stueckId: number, groesse: string | null) => number;
  verfuegbar: (b: KleidungBestand) => number;
  onEdit: (s: Kleidungsstueck) => void;
}) {
  const [eingeklapptRaw, setEingeklappt] = useStoredState("kleiderkammer.bestand.eingeklappt", "");
  const eingeklappt = useMemo(
    () => new Set(eingeklapptRaw.split(",").filter(Boolean).map(Number)),
    [eingeklapptRaw],
  );
  const toggle = (id: number) => {
    const next = new Set(eingeklappt);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEingeklappt([...next].join(","));
  };

  if (stuecke.length === 0) {
    return <Empty icon="ph-t-shirt" text="Noch keine Kleidungsstücke" hint="Lege oben ein Kleidungsstück an." />;
  }
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      {stuecke.map((s) => {
        const rows = bestandByStueck.get(s.id) ?? [];
        const gesamt = rows.reduce((n, b) => n + b.menge, 0);
        const ausgegeben = rows.reduce((n, b) => n + issued(b.kleidungsstueckId, b.groesse), 0);
        const zu = eingeklappt.has(s.id);
        return (
          <div key={s.id} className="panel" style={{ flexShrink: 0 }}>
            <div
              className="panel-h"
              role="button"
              aria-expanded={!zu}
              onClick={() => toggle(s.id)}
              style={{ cursor: "pointer" }}
            >
              <i
                className={`ph ${zu ? "ph-caret-right" : "ph-caret-down"}`}
                style={{ flex: "none", fontSize: 14, color: "var(--color-neutral-500)" }}
              />
              <span style={{ width: 34, height: 34, flex: "none", borderRadius: 9, display: "grid", placeItems: "center", fontSize: 18, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
                <i className="ph ph-t-shirt" />
              </span>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: "block", fontSize: 14.5 }}>{s.name}</b>
                <span style={{ fontSize: 11.5, color: "var(--color-neutral-500)" }}>
                  {gesamt} gesamt · {ausgegeben} ausgegeben · {gesamt - ausgegeben} verfügbar
                </span>
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginLeft: "auto", flex: "none" }}
                aria-label="Bearbeiten"
                title="Bearbeiten"
                onClick={(e) => { e.stopPropagation(); onEdit(s); }}
              >
                <i className="ph ph-pencil-simple" />
              </button>
            </div>

            {!zu &&
              (rows.length === 0 ? (
                <div className="mrow" style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
                  Kein Bestand erfasst.
                </div>
              ) : (
                rows.map((b) => {
                  const aus = issued(b.kleidungsstueckId, b.groesse);
                  const verf = verfuegbar(b);
                  return (
                    <div key={b.id} className="mrow">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500, minWidth: 60 }}>{b.groesse ?? "Gesamt"}</span>
                        <span style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
                          {b.menge} gesamt · {aus} ausgegeben ·{" "}
                          <span style={{ color: verf > 0 ? "var(--color-accent-300)" : "var(--warn)" }}>{verf} verfügbar</span>
                        </span>
                      </span>
                    </div>
                  );
                })
              ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Gruppierung: Ausgaben → Zeilen (Stück+Größe+Status) → Gruppen (je Kleidungsstück) ──
type Zeile = {
  key: string;
  kleidungsstueckId: number;
  groesse: string | null;
  menge: number;
  ausgegebenAm: string | null;
  vorgemerkt: boolean; // wartet auf Rückgabe
  ausgaben: KleidungAusgabe[];
};
type Gruppe = {
  id: number;
  name: string;
  mitGroessen: boolean;
  menge: number;
  zeilen: Zeile[];
};

// Gleiche Utensilien (Stück + Größe + Vormerk-Status) zu einer Zeile zusammenfassen,
// dann nach Kleidungsstück gruppieren. Gruppen alphabetisch, Größen numerisch/alpha.
function buildGruppen(ausgaben: KleidungAusgabe[], stueckById: Map<number, Kleidungsstueck>): Gruppe[] {
  const zeilen: Zeile[] = [];
  const idx = new Map<string, number>();
  for (const a of ausgaben) {
    const vorgemerkt = a.rueckgabeAngefordertAm != null;
    const key = `${a.kleidungsstueckId}:${a.groesse ?? ""}:${vorgemerkt ? "w" : "a"}`;
    const i = idx.get(key);
    if (i != null) {
      const z = zeilen[i];
      z.menge += a.menge;
      z.ausgaben.push(a);
      if ((a.ausgegebenAm ?? "") > (z.ausgegebenAm ?? "")) z.ausgegebenAm = a.ausgegebenAm;
    } else {
      idx.set(key, zeilen.length);
      zeilen.push({ key, kleidungsstueckId: a.kleidungsstueckId, groesse: a.groesse, menge: a.menge, ausgegebenAm: a.ausgegebenAm, vorgemerkt, ausgaben: [a] });
    }
  }
  const map = new Map<number, Zeile[]>();
  for (const z of zeilen) {
    const arr = map.get(z.kleidungsstueckId) ?? [];
    arr.push(z);
    map.set(z.kleidungsstueckId, arr);
  }
  return [...map.entries()]
    .map(([id, zs]) => ({
      id,
      name: stueckById.get(id)?.name ?? "—",
      mitGroessen: stueckById.get(id)?.mitGroessen ?? false,
      menge: zs.reduce((n, z) => n + z.menge, 0),
      zeilen: [...zs].sort((a, b) => (a.groesse ?? "").localeCompare(b.groesse ?? "", "de", { numeric: true })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

// Gemeinsame Darstellung „gruppiert nach Kleidungsstück": Desktop-Tabelle mit
// Gruppen-Kopfzeilen, Mobile Gruppen-Karten. Die Aktionen je Zeile liefert der Aufrufer.
function KleidungGruppen({
  gruppen,
  mengeLabel = "ausgegeben",
  renderAktion,
}: {
  gruppen: Gruppe[];
  mengeLabel?: string;
  renderAktion: (z: Zeile, g: Gruppe, variant: "desktop" | "mobile") => ReactNode;
}) {
  return (
    <>
      {/* Desktop: Tabelle, gruppiert nach Kleidungsstück */}
      <div className="hidden lg:block">
        <table className="table">
          <thead>
            <tr>
              <th>Größe</th>
              <th style={{ textAlign: "center" }}>Menge</th>
              <th>Ausgegeben am</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {gruppen.map((g, gi) => (
              <Fragment key={g.id}>
                <tr>
                  <td colSpan={4} style={{ padding: "12px 12px 6px", borderTop: gi > 0 ? "1px solid var(--color-divider)" : undefined }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 26, height: 26, flex: "none", borderRadius: 7, display: "grid", placeItems: "center", fontSize: 14, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
                        <i className="ph ph-t-shirt" />
                      </span>
                      <b style={{ fontSize: 14 }}>{g.name}</b>
                      <span style={{ fontSize: 11.5, color: "var(--color-neutral-500)" }}>· {g.menge} {mengeLabel}</span>
                    </span>
                  </td>
                </tr>
                {g.zeilen.map((z) => (
                  <tr key={z.key}>
                    <td>{z.groesse ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>{z.menge}</td>
                    <td>{fmtDate(z.ausgegebenAm)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{renderAktion(z, g, "desktop")}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Gruppen-Karten je Kleidungsstück */}
      <div className="flex flex-col lg:hidden" style={{ gap: 12 }}>
        {gruppen.map((g) => (
          <div key={g.id} className="panel">
            <div className="panel-h">
              <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, display: "grid", placeItems: "center", fontSize: 16, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
                <i className="ph ph-t-shirt" />
              </span>
              <b style={{ fontSize: 14 }}>{g.name}</b>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--color-neutral-500)" }}>{g.menge} {mengeLabel}</span>
            </div>
            {g.zeilen.map((z) => (
              <div key={z.key} className="mrow">
                <span style={{ flex: 1, minWidth: 0, display: "inline-flex", alignItems: "center", gap: 10 }}>
                  {z.groesse != null && <span style={{ fontSize: 13.5, fontWeight: 500, minWidth: 48 }}>{z.groesse}</span>}
                  <span style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>{`${z.menge}× · ${fmtDate(z.ausgegebenAm)}`}</span>
                </span>
                {renderAktion(z, g, "mobile")}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// Kleine Aktions-Buttons für Tausch/Rückgabe/Zurückgegeben (Desktop mit Label, Mobile Icon-only)
function AktionButton({
  variant,
  icon,
  label,
  title,
  onClick,
  disabled,
}: {
  variant: "desktop" | "mobile";
  icon: string;
  label: string;
  title?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const dim = disabled ? { opacity: 0.4, cursor: "not-allowed" as const } : undefined;
  return variant === "desktop" ? (
    <button className="btn btn-ghost" title={title ?? label} onClick={onClick} disabled={disabled} style={dim}>
      <i className={`ph ${icon}`} /> {label}
    </button>
  ) : (
    <button className="btn btn-ghost" aria-label={label} title={title ?? label} onClick={onClick} disabled={disabled} style={{ flex: "none", padding: 8, fontSize: 18, ...dim }}>
      <i className={`ph ${icon}`} />
    </button>
  );
}

// ── Ausgabe-je-Person-Ansicht ──
function AusgabeAnsicht({
  jugendliche,
  selPerson,
  setSelPersonId,
  personAusgaben,
  stueckById,
  bestandByStueck,
  verfuegbar,
  ausgabenAlle,
  onAusgeben,
  onRueckgabe,
  onTauschen,
}: {
  jugendliche: Person[];
  selPerson: Person | null;
  setSelPersonId: (id: number | null) => void;
  personAusgaben: KleidungAusgabe[];
  stueckById: Map<number, Kleidungsstueck>;
  bestandByStueck: Map<number, KleidungBestand[]>;
  verfuegbar: (b: KleidungBestand) => number;
  ausgabenAlle: KleidungAusgabe[];
  onAusgeben: () => void;
  onRueckgabe: (ausgaben: KleidungAusgabe[]) => void;
  onTauschen: (ausgaben: KleidungAusgabe[]) => void;
}) {
  const anzahlProPerson = (id: number) => ausgabenAlle.filter((a) => a.personId === id).reduce((n, a) => n + a.menge, 0);

  const gruppen = buildGruppen(personAusgaben, stueckById);

  // Tausch möglich, wenn eine andere Größe desselben Stücks genug verfügbaren Bestand für die Gesamtmenge hat
  const kannTauschen = (z: Zeile) => {
    const s = stueckById.get(z.kleidungsstueckId);
    if (!s?.mitGroessen) return false;
    return (bestandByStueck.get(z.kleidungsstueckId) ?? []).some(
      (b) => b.groesse !== z.groesse && verfuegbar(b) >= z.menge,
    );
  };

  // Aktionen je Zeile: vorgemerkte Zeilen zeigen nur ein „wartet"-Badge, aktive Zeilen
  // Tauschen (nur bei Größen) + Rückgabe.
  const renderAktion = (z: Zeile, g: Gruppe, variant: "desktop" | "mobile") => {
    if (z.vorgemerkt) {
      return (
        <span className="ph-tag" style={{ background: "var(--color-neutral-800)", color: "var(--color-neutral-300)" }}>
          <i className="ph ph-hourglass-medium" /> wartet
        </span>
      );
    }
    const swap = kannTauschen(z);
    return (
      <>
        {g.mitGroessen && (
          <AktionButton
            variant={variant}
            icon="ph-arrows-left-right"
            label="Tauschen"
            title={swap ? "In andere Größe tauschen" : "Keine andere Größe verfügbar"}
            onClick={() => onTauschen(z.ausgaben)}
            disabled={!swap}
          />
        )}
        <AktionButton variant={variant} icon="ph-arrow-u-up-left" label="Rückgabe" title="Zurücknehmen / vormerken" onClick={() => onRueckgabe(z.ausgaben)} />
      </>
    );
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      {/* Personen-Liste (Desktop) */}
      <div
        style={{
          width: 260, flex: "none", borderRight: "1px solid var(--color-divider)",
          flexDirection: "column", minHeight: 0,
        }}
        className="hidden lg:flex"
      >
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
          {jugendliche.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--color-neutral-500)", padding: "8px 11px", textAlign: "center" }}>Niemand gefunden</div>
          ) : jugendliche.map((p) => {
            const on = selPerson?.id === p.id;
            const n = anzahlProPerson(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setSelPersonId(p.id)}
                style={{
                  width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 8, padding: "9px 11px", borderRadius: 8, border: 0, cursor: "pointer", fontSize: 13.5,
                  background: on ? "color-mix(in srgb,var(--color-accent) 16%,transparent)" : "transparent",
                  color: on ? "var(--color-accent-200)" : "var(--color-text)", fontWeight: on ? 600 : 400,
                }}
              >
                <span>{personName(p)}</span>
                {n > 0 && (
                  <span className="ph-tag" style={{ background: "var(--color-neutral-800)", color: "var(--color-neutral-300)" }}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: volle Personen-Liste + Suche, solange niemand gewählt ist */}
      {!selPerson && (
        <div className="flex lg:hidden" style={{ flex: 1, minWidth: 0, flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
            {jugendliche.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--color-neutral-500)", padding: "8px 11px", textAlign: "center" }}>Niemand gefunden</div>
            ) : jugendliche.map((p) => {
              const n = anzahlProPerson(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelPersonId(p.id)}
                  style={{
                    width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 8, padding: "11px 11px", borderRadius: 8, border: 0, cursor: "pointer", fontSize: 14,
                    background: "transparent", color: "var(--color-text)",
                  }}
                >
                  <span>{personName(p)}</span>
                  {n > 0 && (
                    <span className="ph-tag" style={{ background: "var(--color-neutral-800)", color: "var(--color-neutral-300)" }}>{n}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail */}
      <div
        className={selPerson ? "flex" : "hidden lg:flex"}
        style={{ flex: 1, minWidth: 0, flexDirection: "column", minHeight: 0 }}
      >
        {!selPerson ? (
          <Empty icon="ph-user-list" text="Jugendliche/n wählen" hint="Links eine Person auswählen, um ausgegebene Utensilien zu sehen." />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <button className="btn btn-ghost lg:hidden" onClick={() => setSelPersonId(null)} aria-label="Zurück zur Liste" title="Zurück zur Liste">
                  <i className="ph ph-arrow-left" /> Zurück
                </button>
                <div style={{ font: "600 17px/1.1 var(--font-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{personName(selPerson)}</div>
              </div>
              <button className="btn btn-secondary" onClick={onAusgeben}>
                <i className="ph ph-plus" /> Utensil ausgeben
              </button>
            </div>

            {personAusgaben.length === 0 ? (
              <Empty icon="ph-package" text="Noch nichts ausgegeben" hint="Über „Utensil ausgeben“ Kleidung zuweisen." />
            ) : (
              <KleidungGruppen gruppen={gruppen} renderAktion={renderAktion} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ausstehende-Rückgaben-Ansicht (gruppiert nach Jugendlichen, dann Kleidungsstück) ──
function RueckgabenAnsicht({
  jugendliche,
  ausgabenAlle,
  stueckById,
  onZurueckgegeben,
}: {
  jugendliche: Person[];
  ausgabenAlle: KleidungAusgabe[];
  stueckById: Map<number, Kleidungsstueck>;
  onZurueckgegeben: (ausgaben: KleidungAusgabe[]) => void;
}) {
  const vorgemerktByPerson = new Map<number, KleidungAusgabe[]>();
  for (const a of ausgabenAlle) {
    if (a.rueckgabeAngefordertAm == null) continue;
    const arr = vorgemerktByPerson.get(a.personId) ?? [];
    arr.push(a);
    vorgemerktByPerson.set(a.personId, arr);
  }
  // Nur Jugendliche mit ausstehenden Rückgaben (Reihenfolge/Filter aus der Suche übernommen)
  const personen = jugendliche.filter((p) => (vorgemerktByPerson.get(p.id)?.length ?? 0) > 0);

  const renderAktion = (z: Zeile, _g: Gruppe, variant: "desktop" | "mobile") => (
    <AktionButton
      variant={variant}
      icon="ph-arrow-u-up-left"
      label="Zurückgegeben"
      title="Als zurückgegeben markieren – zurück in den Bestand"
      onClick={() => onZurueckgegeben(z.ausgaben)}
    />
  );

  if (personen.length === 0) {
    return (
      <Empty
        icon="ph-hourglass"
        text="Keine ausstehenden Rückgaben"
        hint="In der Ausgabe-Ansicht kannst du Stücke mit „Rückgabe vormerken“ auf die Warteliste setzen."
      />
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
      {personen.map((p) => {
        const eintraege = vorgemerktByPerson.get(p.id) ?? [];
        const gesamt = eintraege.reduce((n, a) => n + a.menge, 0);
        return (
          <div key={p.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ font: "600 17px/1.1 var(--font-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{personName(p)}</div>
              <span className="ph-tag" style={{ background: "var(--color-neutral-800)", color: "var(--color-neutral-300)" }}>{gesamt}</span>
            </div>
            <KleidungGruppen gruppen={buildGruppen(eintraege, stueckById)} mengeLabel="vorgemerkt" renderAktion={renderAktion} />
          </div>
        );
      })}
    </div>
  );
}
