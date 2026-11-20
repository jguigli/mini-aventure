// Step 1: temporary screen that checks the client → Vite proxy → API chain.
// Replaced by the creation screen at step 5.
import { useEffect, useState } from "react";
import { API_HEALTH_PATH, type HealthResponse } from "@shared/api";

type Status = { kind: "loading" } | { kind: "ok"; health: HealthResponse } | { kind: "error" };

export default function App() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch(API_HEALTH_PATH, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<HealthResponse>;
      })
      .then((health) => setStatus({ kind: "ok", health }))
      .catch((err: unknown) => {
        // Unmounting the component aborts the request: that is not an error.
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatus({ kind: "error" });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="page">
      <section className="card">
        <p className="logo" aria-hidden="true">
          🧭
        </p>
        <h1>Mini-aventure</h1>
        <p className="subtitle">Crée des histoires à choix pour les 8-15 ans.</p>
        <p className="status" role="status" aria-live="polite">
          {status.kind === "loading" && "Connexion à l'API…"}
          {status.kind === "error" && (
            <span className="bad">API injoignable : lance le serveur avec « make dev ».</span>
          )}
          {status.kind === "ok" &&
            (status.health.openaiKey ? (
              <span className="good">API OK, clé OpenAI configurée</span>
            ) : (
              <span className="warn">API OK, clé manquante : renseigne server/.env</span>
            ))}
        </p>
      </section>
    </main>
  );
}
