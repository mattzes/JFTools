"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Dialog } from "./ui";

type ConfirmOptions = {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean; // roter Bestätigen-Button (Löschen)
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// Benutzerdefinierter Bestätigungsdialog statt window.confirm().
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm muss innerhalb von ConfirmProvider genutzt werden");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <Dialog title={opts.title ?? "Bestätigen"} onClose={() => finish(false)}>
          <div style={{ fontSize: 14, color: "var(--color-neutral-300)", lineHeight: 1.5 }}>{opts.message}</div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={() => finish(false)}>{opts.cancelLabel ?? "Abbrechen"}</button>
            <button className={`btn ${opts.danger === false ? "btn-primary" : "btn-danger"}`} onClick={() => finish(true)}>
              {opts.confirmLabel ?? "Löschen"}
            </button>
          </div>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}
