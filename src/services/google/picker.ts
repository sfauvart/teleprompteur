import { fr } from '../../i18n/fr';
import { googleConfig } from './config';
import { GAPI_SCRIPT, loadScript } from './scriptLoader';

let pickerLoaded: Promise<void> | null = null;

function loadPicker(): Promise<void> {
  pickerLoaded ??= loadScript(GAPI_SCRIPT).then(
    () =>
      new Promise<void>((resolve, reject) =>
        gapi.load('picker', {
          callback: () => resolve(),
          onerror: () => reject(new Error('picker')),
        }),
      ),
  );
  return pickerLoaded;
}

/**
 * Sélecteur de fichiers Google : la sélection accorde à l'application l'accès au fichier
 * (portée `drive.file`). `fileId` présélectionne un fichier précis (lien `#gdrive=`).
 * Renvoie l'identifiant choisi, ou null si annulé.
 */
export async function pickFile(token: string, fileId?: string): Promise<string | null> {
  await loadPicker();
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setMimeTypes('application/json')
      .setMode(google.picker.DocsViewMode.LIST);
    if (fileId) view.setFileIds(fileId);
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(googleConfig.apiKey)
      .setAppId(googleConfig.appId)
      .setLocale('fr')
      .setTitle(fr.drive.browserTitle)
      .setCallback((data) => {
        const action = data[google.picker.Response.ACTION];
        if (action === google.picker.Action.PICKED) {
          resolve(data[google.picker.Response.DOCUMENTS]?.[0]?.[google.picker.Document.ID] ?? null);
        } else if (action === google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}
