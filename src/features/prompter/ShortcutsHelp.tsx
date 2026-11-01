import { fr } from '../../i18n/fr';
import { CloseIcon } from '../../ui/icons';

export function ShortcutsHelp({ onClose }: { onClose(): void }) {
  return (
    <div className="help-panel" role="dialog" aria-modal="false" aria-labelledby="help-title">
      <div className="help-header">
        <h2 id="help-title">{fr.shortcuts.title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={fr.common.close}>
          <CloseIcon />
        </button>
      </div>
      <dl className="help-list">
        {fr.shortcuts.list.map(([keys, action]) => (
          <div key={keys}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
      <p className="help-note">{fr.shortcuts.gestures}</p>
    </div>
  );
}
