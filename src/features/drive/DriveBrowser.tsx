import { useEffect, useRef } from 'react';
import { openDriveFile, openWithPicker, useDriveBrowser } from '../../app/driveActions';
import { fr } from '../../i18n/fr';
import { CloseIcon } from '../../ui/icons';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

/** Liste des prompts enregistrés par l'application dans Google Drive (F29). */
export function DriveBrowser() {
  const { open, loading, files, close } = useDriveBrowser();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const choose = (action: () => Promise<void>) => {
    close();
    void action();
  };

  return (
    <dialog
      ref={ref}
      className="dialog drive-browser"
      aria-labelledby="drive-browser-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="help-header">
        <h2 id="drive-browser-title" className="dialog-title">
          {fr.drive.browserTitle}
        </h2>
        <button type="button" className="icon-btn" aria-label={fr.common.close} onClick={close}>
          <CloseIcon />
        </button>
      </div>
      {loading && <p className="hint">{fr.drive.browserLoading}</p>}
      {!loading && files.length === 0 && <p className="hint">{fr.drive.browserEmpty}</p>}
      <ul className="drive-files">
        {files.map((file) => (
          <li key={file.id}>
            <button
              type="button"
              className="drive-file"
              onClick={() => choose(() => openDriveFile(file.id))}
            >
              <span>{file.name.replace(/\.teleprompteur\.json$/, '')}</span>
              <span className="hint">
                {fr.drive.modifiedOn(dateFormat.format(new Date(file.modifiedTime)))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={() => choose(() => openWithPicker())}>
          {fr.drive.otherFile}
        </button>
      </div>
    </dialog>
  );
}
