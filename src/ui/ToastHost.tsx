import { useToasts } from './feedback';
import { CloseIcon } from './icons';
import { fr } from '../i18n/fr';

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span>{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="btn small primary"
              onClick={() => {
                t.action?.run();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            className="icon-btn small"
            aria-label={fr.common.close}
            onClick={() => dismiss(t.id)}
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
