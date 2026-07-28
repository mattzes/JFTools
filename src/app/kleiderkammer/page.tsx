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

type Modus = "bestand" | "ausgabe";

const bestandKey = (stueckId: number, groesse: string | null) => `${stueckId}:${groesse ?? ""}`;

// ── Dialog-Formulare ──
type GroessenZeile = { groesse: string; menge: string };
type NeuStueck = { name: string; mitGroessen: boolean; menge: string; groessen: GroessenZeile[] };
const EMPTY_STUECK: NeuStueck = { name: "", mitGroessen: false, menge: "", groessen: [{ groesse: "", menge: "" }] };

type BestandForm = {
  kleidungsstueckId: number;
  name: string;
  groesse: string; // leer = keine Unterteilung
  groesseEditable: boolean; // true = neue Größe anlegen
  menge: string;
};

type AusgabeForm = {
  kleidungsstueckId: number | null;
  groesse: string | null;
  menge: string;
  ausgegebenAm: string;
  notiz: string;
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

  const [modus, setModus] = useState<Modus>("bestand");
  const [neuStueck, setNeuStueck] = useState<NeuStueck | null>(null);
  const [renameForm, setRenameForm] = useState<{ id: number; name: string } | null>(null);
  const [bestandForm, setBestandForm] = useState<BestandForm | null>(null);
  const [selPersonId, setSelPersonId] = useState<number | null>(null);
  const [suche, setSuche] = useState("");
  const [ausgabeForm, setAusgabeForm] = useState<AusgabeForm | null>(null);
  const [tauschForm, setTauschForm] = useState<{ ausgabe: KleidungAusgabe; groesse: string | null } | null>(null);

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

  async function speichereBestand() {
    if (!bestandForm) return;
    const groesse = bestandForm.groesse.trim();
    if (bestandForm.groesseEditable && groesse === "") return; // neue Größe braucht Namen
    await api("/kleidung-bestand", {
      method: "PUT",
      body: JSON.stringify({
        kleidungsstueckId: bestandForm.kleidungsstueckId,
        groesse: groesse === "" ? null : groesse,
        menge: Number(bestandForm.menge) || 0,
      }),
    });
    setBestandForm(null);
    reloadBestand();
  }

  async function speichereRename() {
    if (!renameForm || !renameForm.name.trim()) return;
    await api(`/kleidungsstuecke/${renameForm.id}`, { method: "PATCH", body: JSON.stringify({ name: renameForm.name.trim() }) });
    setRenameForm(null);
    reloadStuecke();
  }

  async function loescheStueck(s: Kleidungsstueck) {
    if (
      await confirm({
        title: "Kleidungsstück löschen",
        message: `„${s.name}" samt Bestand und allen Ausgaben löschen?`,
        confirmLabel: "Löschen",
        danger: true,
      })
    ) {
      await api(`/kleidungsstuecke/${s.id}`, { method: "DELETE" });
      reloadStuecke();
      reloadBestand();
      reloadAusgaben();
    }
  }

  async function loescheGroesse(b: KleidungBestand) {
    if (
      await confirm({
        title: "Größe entfernen",
        message: `Größe „${b.groesse}" entfernen?`,
        confirmLabel: "Entfernen",
        danger: true,
      })
    ) {
      await api(`/kleidung-bestand/${b.id}`, { method: "DELETE" });
      reloadBestand();
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
        notiz: ausgabeForm.notiz.trim() || null,
      }),
    });
    setAusgabeForm(null);
    reloadAusgaben();
  }

  async function nimmZurueck(a: KleidungAusgabe) {
    const s = stueckById.get(a.kleidungsstueckId);
    if (
      await confirm({
        title: "Rückgabe",
        message: `„${s?.name ?? "Utensil"}"${a.groesse ? ` (${a.groesse})` : ""} × ${a.menge} zurücknehmen?`,
        confirmLabel: "Zurücknehmen",
        danger: false,
      })
    ) {
      await api(`/kleidung-ausgaben/${a.id}`, { method: "DELETE" });
      reloadAusgaben();
    }
  }

  async function speichereTausch() {
    if (!tauschForm || !tauschForm.groesse) return;
    await api(`/kleidung-ausgaben/${tauschForm.ausgabe.id}`, {
      method: "PATCH",
      body: JSON.stringify({ groesse: tauschForm.groesse }),
    });
    setTauschForm(null);
    reloadAusgaben();
  }

  // Für den Tausch-Dialog: andere Größen desselben Stücks mit genügend Bestand
  const tauschStueck = tauschForm ? stueckById.get(tauschForm.ausgabe.kleidungsstueckId) : null;
  const tauschOptionen = tauschForm
    ? (bestandByStueck.get(tauschForm.ausgabe.kleidungsstueckId) ?? []).filter(
        (b) => b.groesse !== tauschForm.ausgabe.groesse,
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
            Ausgabe je Person
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
          onRename={(s) => setRenameForm({ id: s.id, name: s.name })}
          onDeleteStueck={loescheStueck}
          onAddGroesse={(s) => setBestandForm({ kleidungsstueckId: s.id, name: s.name, groesse: "", groesseEditable: true, menge: "" })}
          onEditBestand={(s, b) =>
            setBestandForm({ kleidungsstueckId: s.id, name: s.name, groesse: b.groesse ?? "", groesseEditable: false, menge: String(b.menge) })
          }
          onDeleteGroesse={loescheGroesse}
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
          onAusgeben={() => setAusgabeForm({ kleidungsstueckId: null, groesse: null, menge: "1", ausgegebenAm: heute(), notiz: "" })}
          onRueckgabe={nimmZurueck}
          onTauschen={(a) => setTauschForm({ ausgabe: a, groesse: null })}
        />
      )}

      {/* Dialog: Kleidungsstück anlegen */}
      {neuStueck && (
        <Dialog title="Kleidungsstück hinzufügen" onClose={() => setNeuStueck(null)}>
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

      {/* Dialog: Umbenennen */}
      {renameForm && (
        <Dialog title="Kleidungsstück umbenennen" onClose={() => setRenameForm(null)}>
          <div className="field">
            <label>Bezeichnung</label>
            <input
              className="input"
              autoFocus
              value={renameForm.name}
              onChange={(e) => setRenameForm({ ...renameForm, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && speichereRename()}
            />
          </div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setRenameForm(null)}>Abbrechen</button>
            <button className="btn btn-primary" onClick={speichereRename} disabled={!renameForm.name.trim()}>Speichern</button>
          </div>
        </Dialog>
      )}

      {/* Dialog: Bestand ändern / Größe hinzufügen */}
      {bestandForm && (
        <Dialog
          title={bestandForm.groesseEditable ? `Größe hinzufügen — ${bestandForm.name}` : `Bestand ändern — ${bestandForm.name}`}
          onClose={() => setBestandForm(null)}
        >
          {bestandForm.groesseEditable ? (
            <div className="field">
              <label>Größe</label>
              <input
                className="input"
                autoFocus
                placeholder="z. B. 152, S, 42"
                value={bestandForm.groesse}
                onChange={(e) => setBestandForm({ ...bestandForm, groesse: e.target.value })}
              />
            </div>
          ) : (
            bestandForm.groesse !== "" && (
              <div className="field">
                <label>Größe</label>
                <input className="input" value={bestandForm.groesse} disabled />
              </div>
            )
          )}
          <div className="field">
            <label>Gesamtbestand</label>
            <input
              className="input"
              type="number"
              min={0}
              autoFocus={!bestandForm.groesseEditable}
              value={bestandForm.menge}
              onChange={(e) => setBestandForm({ ...bestandForm, menge: e.target.value })}
            />
          </div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => setBestandForm(null)}>Abbrechen</button>
            <button
              className="btn btn-primary"
              onClick={speichereBestand}
              disabled={bestandForm.groesseEditable && bestandForm.groesse.trim() === ""}
            >
              Speichern
            </button>
          </div>
        </Dialog>
      )}

      {/* Dialog: Utensil ausgeben */}
      {ausgabeForm && selPerson && (
        <Dialog title={`Utensil ausgeben — ${personName(selPerson)}`} onClose={() => setAusgabeForm(null)}>
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
          <div className="field">
            <label>Notiz (optional)</label>
            <input className="input" value={ausgabeForm.notiz} onChange={(e) => setAusgabeForm({ ...ausgabeForm, notiz: e.target.value })} />
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
            Aktuell: Größe {tauschForm.ausgabe.groesse ?? "—"} × {tauschForm.ausgabe.menge}
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
                const reicht = v >= tauschForm.ausgabe.menge;
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
    </>
  );
}

// ── Bestand-Ansicht ──
function BestandAnsicht({
  stuecke,
  bestandByStueck,
  issued,
  verfuegbar,
  onDeleteStueck,
  onAddGroesse,
  onEditBestand,
  onDeleteGroesse,
  onRename,
}: {
  stuecke: Kleidungsstueck[];
  bestandByStueck: Map<number, KleidungBestand[]>;
  issued: (stueckId: number, groesse: string | null) => number;
  verfuegbar: (b: KleidungBestand) => number;
  onDeleteStueck: (s: Kleidungsstueck) => void;
  onAddGroesse: (s: Kleidungsstueck) => void;
  onEditBestand: (s: Kleidungsstueck, b: KleidungBestand) => void;
  onDeleteGroesse: (b: KleidungBestand) => void;
  onRename?: (s: Kleidungsstueck) => void;
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
          <div key={s.id} className="panel">
            <div className="panel-h" style={{ justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 34, height: 34, flex: "none", borderRadius: 9, display: "grid", placeItems: "center", fontSize: 18, background: "var(--color-accent-900)", color: "var(--color-accent-200)" }}>
                  <i className="ph ph-t-shirt" />
                </span>
                <span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <b style={{ fontSize: 14.5 }}>{s.name}</b>
                    {s.mitGroessen && (
                      <span className="ph-tag" style={{ background: "var(--color-neutral-800)", color: "var(--color-neutral-300)" }}>nach Größen</span>
                    )}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--color-neutral-500)" }}>
                    {gesamt} gesamt · {ausgegeben} ausgegeben · {gesamt - ausgegeben} verfügbar
                  </span>
                </span>
              </span>
              <span style={{ display: "inline-flex", gap: 4 }}>
                {s.mitGroessen && (
                  <button className="btn btn-ghost" title="Größe hinzufügen" onClick={() => onAddGroesse(s)}>
                    <i className="ph ph-plus" />
                  </button>
                )}
                {onRename && (
                  <button className="btn btn-ghost" title="Umbenennen" onClick={() => onRename(s)}>
                    <i className="ph ph-pencil-simple" />
                  </button>
                )}
                <button className="btn btn-ghost" style={{ color: "var(--danger)" }} title="Kleidungsstück löschen" onClick={() => onDeleteStueck(s)}>
                  <i className="ph ph-trash" />
                </button>
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="mrow" style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
                Kein Bestand erfasst.{" "}
                {s.mitGroessen ? (
                  <button className="btn btn-ghost" onClick={() => onAddGroesse(s)}>Größe hinzufügen</button>
                ) : (
                  <button className="btn btn-ghost" onClick={() => onEditBestand(s, { id: 0, kleidungsstueckId: s.id, groesse: null, menge: 0 })}>Bestand setzen</button>
                )}
              </div>
            ) : (
              rows.map((b) => {
                const aus = issued(b.kleidungsstueckId, b.groesse);
                const verf = verfuegbar(b);
                return (
                  <div key={b.id} className="mrow" style={{ justifyContent: "space-between" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500, minWidth: 60 }}>{b.groesse ?? "Gesamt"}</span>
                      <span style={{ fontSize: 12.5, color: "var(--color-neutral-500)" }}>
                        {b.menge} gesamt · {aus} ausgegeben ·{" "}
                        <span style={{ color: verf > 0 ? "var(--color-accent-300)" : "var(--warn)" }}>{verf} verfügbar</span>
                      </span>
                    </span>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      <button className="btn btn-ghost" title="Bestand ändern" onClick={() => onEditBestand(s, b)}>
                        <i className="ph ph-pencil-simple" />
                      </button>
                      {s.mitGroessen && (
                        <button className="btn btn-ghost" style={{ color: "var(--danger)" }} title="Größe entfernen" onClick={() => onDeleteGroesse(b)}>
                          <i className="ph ph-x" />
                        </button>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
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
  onRueckgabe: (a: KleidungAusgabe) => void;
  onTauschen: (a: KleidungAusgabe) => void;
}) {
  const anzahlProPerson = (id: number) => ausgabenAlle.filter((a) => a.personId === id).reduce((n, a) => n + a.menge, 0);

  // Tausch möglich, wenn eine andere Größe desselben Stücks genug verfügbaren Bestand hat
  const kannTauschen = (a: KleidungAusgabe) => {
    const s = stueckById.get(a.kleidungsstueckId);
    if (!s?.mitGroessen) return false;
    return (bestandByStueck.get(a.kleidungsstueckId) ?? []).some(
      (b) => b.groesse !== a.groesse && verfuegbar(b) >= a.menge,
    );
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
      {/* Personen-Liste */}
      <div
        style={{
          width: 260, flex: "none", borderRight: "1px solid var(--color-divider)",
          display: "flex", flexDirection: "column", minHeight: 0,
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

      {/* Detail */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Mobile: Personen-Auswahl als Dropdown */}
        <div className="lg:hidden" style={{ padding: "12px 16px 4px" }}>
          <select className="input" value={selPerson?.id ?? ""} onChange={(e) => setSelPersonId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Jugendliche/n wählen —</option>
            {jugendliche.map((p) => (
              <option key={p.id} value={p.id}>{personName(p)}</option>
            ))}
          </select>
        </div>

        {!selPerson ? (
          <Empty icon="ph-user-list" text="Jugendliche/n wählen" hint="Links eine Person auswählen, um ausgegebene Utensilien zu sehen." />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ font: "600 17px/1.1 var(--font-heading)" }}>{personName(selPerson)}</div>
              <button className="btn btn-secondary" onClick={onAusgeben}>
                <i className="ph ph-plus" /> Utensil ausgeben
              </button>
            </div>

            {personAusgaben.length === 0 ? (
              <Empty icon="ph-package" text="Noch nichts ausgegeben" hint="Über „Utensil ausgeben“ Kleidung zuweisen." />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Kleidungsstück</th>
                    <th>Größe</th>
                    <th style={{ textAlign: "center" }}>Menge</th>
                    <th>Ausgegeben am</th>
                    <th>Notiz</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {personAusgaben.map((a) => (
                    <tr key={a.id}>
                      <td>{stueckById.get(a.kleidungsstueckId)?.name ?? "—"}</td>
                      <td>{a.groesse ?? "—"}</td>
                      <td style={{ textAlign: "center" }}>{a.menge}</td>
                      <td>{fmtDate(a.ausgegebenAm)}</td>
                      <td style={{ color: "var(--color-neutral-500)", fontSize: 13 }}>{a.notiz ?? ""}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {(() => {
                          const swap = kannTauschen(a);
                          return (
                            <button
                              className="btn btn-ghost"
                              title={swap ? "In andere Größe tauschen" : "Keine andere Größe verfügbar"}
                              onClick={() => onTauschen(a)}
                              disabled={!swap}
                              style={swap ? undefined : { opacity: 0.4, cursor: "not-allowed" }}
                            >
                              <i className="ph ph-arrows-left-right" /> Tauschen
                            </button>
                          );
                        })()}
                        <button className="btn btn-ghost" title="Zurücknehmen" onClick={() => onRueckgabe(a)}>
                          <i className="ph ph-arrow-u-up-left" /> Rückgabe
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
