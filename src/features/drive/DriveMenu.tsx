import { useState } from 'react';
import {
  browseDrive,
  copyDriveLink,
  makeDriveFilePublic,
  openWithPicker,
  saveToDrive,
} from '../../app/driveActions';
import { fr } from '../../i18n/fr';
import { preloadAuth } from '../../services/google/auth';
import { isDriveConfigured } from '../../services/google/config';
import { useSession } from '../../stores/sessionStore';

/** Menu Google Drive de l'éditeur (F29) ; absent si Drive n'est pas configuré. */
export function DriveMenu() {
  const [open, setOpen] = useState(false);
  const hasText = useSession((s) => s.draft.text.trim() !== '');
  const linked = useSession((s) => s.draft.drive !== null);
  if (!isDriveConfigured()) return null;

  const run = (action: () => unknown) => () => {
    setOpen(false);
    void action();
  };

  return (
    <div className="menu">
      <button
        type="button"
        className="btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          // Script Google préchargé : la fenêtre de connexion restera liée au clic suivant.
          void preloadAuth().catch(() => undefined);
          setOpen((value) => !value);
        }}
      >
        {fr.drive.menu} ▾
      </button>
      {open && (
        <div className="menu-list" role="menu">
          <button type="button" role="menuitem" disabled={!hasText} onClick={run(saveToDrive)}>
            {fr.drive.save}
          </button>
          <button type="button" role="menuitem" onClick={run(browseDrive)}>
            {fr.drive.open}
          </button>
          <button type="button" role="menuitem" onClick={run(() => openWithPicker())}>
            {fr.drive.otherFile}
          </button>
          <button type="button" role="menuitem" disabled={!linked} onClick={run(copyDriveLink)}>
            {fr.drive.copyLink}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!linked}
            onClick={run(makeDriveFilePublic)}
          >
            {fr.drive.makePublic}
          </button>
        </div>
      )}
    </div>
  );
}
