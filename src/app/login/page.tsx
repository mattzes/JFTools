"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? `Fehler ${res.status}`);
      }
      const next = params.get("next");
      // Vollständiges Neuladen, damit die Middleware die neue Cookie sieht.
      window.location.href = next && next.startsWith("/") ? next : "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--color-bg)",
        color: "var(--color-text)",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 340,
          background: "var(--color-surface)",
          borderRadius: 16,
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,.35)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", textAlign: "center" }}>
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              fontSize: 24,
              background: "var(--color-accent-900)",
              color: "var(--color-accent-200)",
            }}
          >
            <i className="ph-fill ph-lock-key" />
          </span>
          <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>JF Verwaltung</h1>
          <p style={{ fontSize: 12.5, color: "var(--color-neutral-500)", margin: 0 }}>
            Bitte Passwort eingeben, um fortzufahren.
          </p>
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
          <span style={{ color: "var(--color-neutral-400)" }}>Passwort</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            style={{
              padding: "11px 13px",
              borderRadius: 10,
              border: "1px solid var(--color-divider)",
              background: "var(--color-bg)",
              color: "var(--color-text)",
              fontSize: 15,
              outline: "none",
            }}
          />
        </label>

        {error && (
          <div style={{ fontSize: 12.5, color: "#f5a2a2", background: "rgba(245,120,120,.12)", padding: "9px 12px", borderRadius: 9 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || password.length === 0}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            background: "var(--color-accent)",
            color: "#161826",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || password.length === 0 ? "default" : "pointer",
            opacity: loading || password.length === 0 ? 0.6 : 1,
          }}
        >
          {loading ? "Anmelden…" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
