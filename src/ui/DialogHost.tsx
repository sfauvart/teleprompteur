import { useEffect, useRef, useState } from 'react';
import { useDialogs, type DialogRequest } from './feedback';
import { fr } from '../i18n/fr';

/** Affiche le dialogue courant dans un `<dialog>` natif (focus piégé, Échap = annuler). */
export function DialogHost() {
  const current = useDialogs((s) => s.current);
  const close = useDialogs((s) => s.close);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (current && !dialog.open) dialog.showModal();
    if (!current && dialog.open) dialog.close();
  }, [current]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={(e) => {
        e.preventDefault();
        close(null);
      }}
    >
      {current && <DialogBody key={dialogKey(current)} request={current} onClose={close} />}
    </dialog>
  );
}

let keyCounter = 0;
const keys = new WeakMap<DialogRequest, number>();
function dialogKey(request: DialogRequest): number {
  if (!keys.has(request)) keys.set(request, keyCounter++);
  return keys.get(request)!;
}

function DialogBody({
  request,
  onClose,
}: {
  request: DialogRequest;
  onClose(value: string | null): void;
}) {
  const [text, setText] = useState(request.kind === 'text' ? request.initial : '');

  if (request.kind === 'text') {
    return (
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onClose(text.trim());
        }}
      >
        <h2 className="dialog-title">{request.title}</h2>
        <label className="field">
          <span>{request.label}</span>
          <input autoFocus value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => onClose(null)}>
            {fr.common.cancel}
          </button>
          <button type="submit" className="btn primary" disabled={!text.trim()}>
            {fr.common.confirm}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <h2 className="dialog-title">{request.title}</h2>
      <p className="dialog-message">{request.message}</p>
      <div className="dialog-actions">
        {request.actions.map((action, index) => (
          <button
            key={action.value}
            type="button"
            autoFocus={index === request.actions.length - 1}
            className={`btn ${action.variant ?? ''}`}
            onClick={() => onClose(action.value)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
