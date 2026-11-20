// Discreet "Enregistré" indicator, shown after each autosave.
export interface SaveStatus {
  ok: boolean;
  at: Date;
}

const time = (date: Date) =>
  date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function SavedIndicator({ status }: { status: SaveStatus | null }) {
  if (!status) return null;
  return status.ok ? (
    <span className="saved-indicator" title={`Enregistré dans ce navigateur à ${time(status.at)}`}>
      ✓ Enregistré
    </span>
  ) : (
    <span
      className="saved-indicator is-error"
      title="Le stockage du navigateur est indisponible ou plein."
    >
      Sauvegarde impossible
    </span>
  );
}
