import { fr } from '../../i18n/fr';
import { disconnect, getAccessToken, useDriveAuth } from '../../services/google/auth';
import { isDriveConfigured } from '../../services/google/config';
import { toast } from '../../ui/feedback';

/** Section Google Drive des préférences (F29). */
export function DriveSettings() {
  const connected = useDriveAuth((s) => s.connected);
  if (!isDriveConfigured()) return null;
  return (
    <section className="panel">
      <h2>{fr.drive.section}</h2>
      <p>{fr.drive.sectionInfo}</p>
      <p className="hint">{connected ? fr.drive.connected : fr.drive.disconnected}</p>
      <div className="toolbar">
        {connected ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              disconnect();
              toast(fr.drive.disconnectedToast);
            }}
          >
            {fr.drive.disconnect}
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              void getAccessToken().then(
                () => toast(fr.drive.connectedToast),
                () => toast(fr.drive.authFailed, { tone: 'error' }),
              )
            }
          >
            {fr.drive.connect}
          </button>
        )}
      </div>
    </section>
  );
}
