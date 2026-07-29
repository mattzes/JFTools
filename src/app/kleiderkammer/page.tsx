"use client";

import { useMemo, useState } from "react";
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

type Modus = "bestand" | "ausgabe";

const bestandKey = (stueckId: number, groesse: string | null) => `${stueckId}:${groesse ?? ""}`;

// ── Dialog-Formulare ──
type GroessenZeile = { groesse: string; menge: string };
type NeuStueck = { name: string; mitGroessen: boolean; menge: string; groessen: GroessenZeile[] };
const EMPTY_STUECK: NeuStueck = { name: "", mitGroessen: false, menge: "", groessen: [{ groesse: "", menge: "" }] };

// Ein Dialog für alles: Bezeichnung, Bestand je Größe (bzw. gesamt), Löschen
type EditZeile = { id: number | null; origGroesse: string; groesse: string; menge: string };
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
  menge: string;
  ausgegebenAm: string;
};

function heute() {
  return new Date().toISOString().slice(0, 10);
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
    // Größen alphabetisch/numerisch sortieren
    m.forEach((arr) =>
      arr.sort((a, b) => (a.groesse ?? "").localeCompare(b.groesse ?? "", "de", { numeric: true })),
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
    .sort((a, b) => a.nachname.localeCompare(b.nachname, "de"));

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
        ? rows.map((b) => ({ id: b.id, origGroesse: b.groesse ?? "", groesse: b.groesse ?? "", menge: String(b.menge) }))
        : [{ id: rows[0]?.id ?? null, origGroesse: "", groesse: "", menge: rows[0] ? String(rows[0].menge) : "" }],
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
      for (const g of editForm.groessen) {
        const name = g.groesse.trim();
        if (name === "") continue;
        // Umbenannte Größe: alte Zeile entfernen, damit keine Waise bleibt
        if (g.id != null && g.origGroesse !== name) {
          await api(`/kleidung-bestand/${g.id}`, { method: "DELETE" });
        }
        await api("/kleidung-bestand", {
          method: "PUT",
          body: JSON.stringify({ kleidungsstueckId: editForm.id, groesse: name, menge: Number(g.menge) || 0 }),
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
    await api("/kleidung-ausgaben", {
      method: "POST",
      body: JSON.stringify({
        personId: selPerson.id,
        kleidungsstueckId: ausgabeForm.kleidungsstueckId,
        groesse: ausgabeForm.groesse,
        menge: Number(ausgabeForm.menge) || 1,
        ausgegebenAm: ausgabeForm.ausgegebenAm || null,
      }),
    });
    setAusgabeForm(null);
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
        </div>
        {modus === "bestand" && (
          <button className="btn btn-secondary" onClick={() => setNeuStueck({ ...EMPTY_STUECK })}>
            <i className="ph ph-plus" />
            Kleidungsstück hinzufügen
          </button>
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
      ) : (
        <AusgabeAnsicht
          jugendliche={jugendliche}
          suche={suche}
          setSuche={setSuche}
          selPerson={selPerson}
          setSelPersonId={setSelPersonId}
          personAusgaben={personAusgaben}
          stueckById={stueckById}
          bestandByStueck={bestandByStueck}
          verfuegbar={verfuegbar}
          ausgabenAlle={ausgaben}
          onAusgeben={() => setAusgabeForm({ kleidungsstueckId: null, groesse: null, menge: "1", ausgegebenAm: heute() })}
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
              <label>Größen & Bestand</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {editForm.groessen.map((g, i) => (
                  <div key={i} style={{ display: "flex", gap: 8 }}>
                    <input
                      className="input"
                      placeholder="Größe (z. B. 152, S, 42)"
                      value={g.groesse}
                      onChange={(e) => {
                        const groessen = [...editForm.groessen];
                        groessen[i] = { ...g, groesse: e.target.value };
                        setEditForm({ ...editForm, groessen });
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
                        const groessen = [...editForm.groessen];
                        groessen[i] = { ...g, menge: e.target.value };
                        setEditForm({ ...editForm, groessen });
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      aria-label="Größe entfernen"
                      onClick={() =>
                        setEditForm({
                          ...editForm,
                          groessen: editForm.groessen.filter((_, j) => j !== i),
                          removed: g.id != null ? [...editForm.removed, g.id] : editForm.removed,
                        })
                      }
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
                onClick={() => setEditForm({ ...editForm, groessen: [...editForm.groessen, { id: null, origGroesse: "", groesse: "", menge: "" }] })}
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
                    groessen: [{ ...(editForm.groessen[0] ?? { id: null, origGroesse: "", groesse: "" }), menge: e.target.value }],
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
                setAusgabeForm({ ...ausgabeForm, kleidungsstueckId: id, groesse: null });
              }}
            >
              <option value="">— wählen —</option>
              {stueckeSortiert.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {ausgabeStueck?.mitGroessen && (
            <div className="field">
              <label>Größe</label>
              <select
                className="input"
                value={ausgabeForm.groesse ?? ""}
                onChange={(e) => setAusgabeForm({ ...ausgabeForm, groesse: e.target.value || null })}
              >
                <option value="">— wählen —</option>
                {ausgabeBestand.map((b) => {
                  const v = verfuegbar(b);
                  return (
                    <option key={b.id} value={b.groesse ?? ""} disabled={v <= 0}>
                      {b.groesse} — {v} verfügbar
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="field">
            <label>Menge{ausgabeStueck ? ` (${ausgabeMaxMenge} verfügbar)` : ""}</label>
            <input
              className="input"
              type="number"
              min={1}
              value={ausgabeForm.menge}
              onChange={(e) => setAusgabeForm({ ...ausgabeForm, menge: e.target.value })}
            />
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
                (ausgabeStueck?.mitGroessen && !ausgabeForm.groesse) ||
                (Number(ausgabeForm.menge) || 0) < 1 ||
                (Number(ausgabeForm.menge) || 0) > ausgabeMaxMenge
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
              <label>Zurückzunehmende Menge (max. {total})</label>
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
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setRueckgabeForm(null)}>Abbrechen</button>
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
  if (stuecke.length === 0) {
    return <Empty icon="ph-t-shirt" text="Noch keine Kleidungsstücke" hint="Lege oben ein Kleidungsstück an." />;
  }
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      {stuecke.map((s) => {
        const rows = bestandByStueck.get(s.id) ?? [];
        const gesamt = rows.reduce((n, b) => n + b.menge, 0);
        const ausgegeben = rows.reduce((n, b) => n + issued(b.kleidungsstueckId, b.groesse), 0);
        return (
          <button
            key={s.id}
            type="button"
            className="panel"
            onClick={() => onEdit(s)}
            style={{ flexShrink: 0, width: "100%", textAlign: "left", border: 0, background: "var(--color-surface)", color: "inherit", font: "inherit", cursor: "pointer" }}
          >
            <div className="panel-h">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 34, height: 34, flex: "none", borderRadius: 9, display: "grid", placeItems: "center", fontSize: 18, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
                  <i className="ph ph-t-shirt" />
                </span>
                <span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <b style={{ fontSize: 14.5 }}>{s.name}</b>
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--color-neutral-500)" }}>
                    {gesamt} gesamt · {ausgegeben} ausgegeben · {gesamt - ausgegeben} verfügbar
                  </span>
                </span>
              </span>
            </div>

            {rows.length === 0 ? (
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
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Ausgabe-je-Person-Ansicht ──
function AusgabeAnsicht({
  jugendliche,
  suche,
  setSuche,
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
  suche: string;
  setSuche: (v: string) => void;
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

  // Gleiche Utensilien mit gleicher Größe zu einer Zeile zusammenfassen (Menge summiert),
  // damit die Mengenangabe stimmt. Utensilien ohne Größe gruppieren je Kleidungsstück.
  const zeilen: { key: string; kleidungsstueckId: number; groesse: string | null; menge: number; ausgegebenAm: string | null; ausgaben: KleidungAusgabe[] }[] = [];
  const zeileIndex = new Map<string, number>();
  for (const a of personAusgaben) {
    const key = `${a.kleidungsstueckId}:${a.groesse ?? ""}`;
    const idx = zeileIndex.get(key);
    if (idx != null) {
      const z = zeilen[idx];
      z.menge += a.menge;
      z.ausgaben.push(a);
      if ((a.ausgegebenAm ?? "") > (z.ausgegebenAm ?? "")) z.ausgegebenAm = a.ausgegebenAm;
    } else {
      zeileIndex.set(key, zeilen.length);
      zeilen.push({ key, kleidungsstueckId: a.kleidungsstueckId, groesse: a.groesse, menge: a.menge, ausgegebenAm: a.ausgegebenAm, ausgaben: [a] });
    }
  }

  // Tausch möglich, wenn eine andere Größe desselben Stücks genug verfügbaren Bestand für die Gesamtmenge hat
  const kannTauschen = (z: (typeof zeilen)[number]) => {
    const s = stueckById.get(z.kleidungsstueckId);
    if (!s?.mitGroessen) return false;
    return (bestandByStueck.get(z.kleidungsstueckId) ?? []).some(
      (b) => b.groesse !== z.groesse && verfuegbar(b) >= z.menge,
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
        <div style={{ padding: "12px 14px 8px" }}>
          <input className="input" placeholder="Jugendliche suchen…" value={suche} onChange={(e) => setSuche(e.target.value)} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
          {jugendliche.map((p) => {
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
          <div style={{ padding: "12px 16px 8px" }}>
            <input className="input" placeholder="Jugendliche suchen…" value={suche} onChange={(e) => setSuche(e.target.value)} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 12px" }}>
            {jugendliche.map((p) => {
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
              <>
                {/* Desktop: Tabelle */}
                <div className="hidden lg:block">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Kleidungsstück</th>
                      <th>Größe</th>
                      <th style={{ textAlign: "center" }}>Menge</th>
                      <th>Ausgegeben am</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {zeilen.map((z) => {
                      const swap = kannTauschen(z);
                      return (
                        <tr key={z.key}>
                          <td>{stueckById.get(z.kleidungsstueckId)?.name ?? "—"}</td>
                          <td>{z.groesse ?? "—"}</td>
                          <td style={{ textAlign: "center" }}>{z.menge}</td>
                          <td>{fmtDate(z.ausgegebenAm)}</td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button
                              className="btn btn-ghost"
                              title={swap ? "In andere Größe tauschen" : "Keine andere Größe verfügbar"}
                              onClick={() => onTauschen(z.ausgaben)}
                              disabled={!swap}
                              style={swap ? undefined : { opacity: 0.4, cursor: "not-allowed" }}
                            >
                              <i className="ph ph-arrows-left-right" /> Tauschen
                            </button>
                            <button className="btn btn-ghost" title="Zurücknehmen" onClick={() => onRueckgabe(z.ausgaben)}>
                              <i className="ph ph-arrow-u-up-left" /> Rückgabe
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>

                {/* Mobile: kompakte Karten */}
                <div className="flex flex-col lg:hidden" style={{ gap: 8 }}>
                  {zeilen.map((z) => {
                    const swap = kannTauschen(z);
                    return (
                      <div key={z.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--color-surface)", borderRadius: 11 }}>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {stueckById.get(z.kleidungsstueckId)?.name ?? "—"}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
                            {[`${z.menge}×`, z.groesse != null ? `Größe ${z.groesse}` : null, fmtDate(z.ausgegebenAm)].filter(Boolean).join(" · ")}
                          </span>
                        </div>
                        <button
                          className="btn btn-ghost"
                          aria-label="In andere Größe tauschen"
                          title={swap ? "In andere Größe tauschen" : "Keine andere Größe verfügbar"}
                          onClick={() => onTauschen(z.ausgaben)}
                          disabled={!swap}
                          style={swap ? { flex: "none" } : { flex: "none", opacity: 0.4, cursor: "not-allowed" }}
                        >
                          <i className="ph ph-arrows-left-right" />
                        </button>
                        <button className="btn btn-ghost" aria-label="Zurücknehmen" title="Zurücknehmen" onClick={() => onRueckgabe(z.ausgaben)} style={{ flex: "none" }}>
                          <i className="ph ph-arrow-u-up-left" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
