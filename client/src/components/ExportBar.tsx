// Bottom action bar, shared by Édition, Lecture and the import screen.
//   - main button: « ⬇ Exporter le .ink » (the source an author can reopen in Inky);
//   - « Autres formats » menu: the compiled .json (what ink runtimes load: inkjs, Unity…)
//     and « Voir le code Ink » (a dialog with a Copy button).
// Every file is produced from the CURRENT Ink source at click time.
import { useRef, useState } from "react";
import { compileInk } from "../lib/inkCompile";
import { downloadText, fileBaseName } from "../lib/download";
import { SavedIndicator, type SaveStatus } from "./SavedIndicator";

interface Props {
  /** Returns the current Ink source (called on click, so it is never stale). */
  getInk: () => string;
  /** Used to name the files: "Le phare" → le-phare.ink / le-phare.json. */
  title: string;
  saveStatus?: SaveStatus | null;
  /** Lecture: a discreet bar that does not distract from reading. */
  quiet?: boolean;
  /** The import screen already shows the code: hide « Voir le code Ink ». */
  showCodeItem?: boolean;
}

export function ExportBar({
  getInk,
  title,
  saveStatus = null,
  quiet = false,
  showCodeItem = true,
}: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = fileBaseName(title);

  const closeMenu = () => menu.current?.removeAttribute("open");

  const exportInk = () => downloadText(`${base}.ink`, getInk());

  const exportJson = () => {
    closeMenu();
    const compiled = compileInk(getInk());
    const json = compiled.story?.ToJson();
    if (!json) {
      setError("Export impossible : l'histoire ne compile pas. Corrige les erreurs d'abord.");
      return;
    }
    setError(null);
    downloadText(`${base}.json`, json, "application/json");
  };

  const showCode = () => {
    closeMenu();
    setCode(getInk());
    setCopied(false);
    dialog.current?.showModal(); // native modal: focus trap and Escape to close
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard refused: the code stays selectable in the dialog
    }
  };

  return (
    <footer className={`action-bar${quiet ? " is-quiet" : ""}`}>
      <div className="export-actions">
        <button type="button" className="button-primary" onClick={exportInk}>
          ⬇ Exporter le .ink
        </button>
        <details className="export-menu" ref={menu}>
          <summary className="button-secondary">Autres formats ▾</summary>
          <div className="export-menu-list">
            <button type="button" onClick={exportJson}>
              Exporter le .json compilé
              <small>Pour un moteur ink (inkjs, Unity…)</small>
            </button>
            {showCodeItem && (
              <button type="button" onClick={showCode}>
                Voir le code Ink
              </button>
            )}
          </div>
        </details>
        {error && (
          <span className="export-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <SavedIndicator status={saveStatus} />

      <dialog ref={dialog} className="code-dialog" aria-labelledby="code-dialog-title">
        <div className="code-dialog-header">
          <h2 id="code-dialog-title">Code Ink</h2>
          <div className="code-dialog-actions">
            <button type="button" className="button-primary" onClick={() => void copy()}>
              {copied ? "✓ Copié" : "Copier"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => dialog.current?.close()}
            >
              Fermer
            </button>
          </div>
        </div>
        <pre className="code-block" tabIndex={0}>
          {code}
        </pre>
      </dialog>
    </footer>
  );
}
