/** Écran tactile principal : on privilégie alors le partage natif (spec technique §9.3). */
function prefersShare(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

/**
 * Remet un fichier à l'utilisateur : partage natif sur mobile s'il accepte les fichiers,
 * sinon téléchargement classique.
 */
export async function saveFile(blob: Blob, fileName: string): Promise<void> {
  if (prefersShare() && typeof navigator.canShare === 'function') {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // Échec du partage : repli sur le téléchargement.
      }
    }
  }
  download(blob, fileName);
}

export function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ouvre le sélecteur de fichiers du système. */
export function pickFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => resolve(Array.from(input.files ?? [])), { once: true });
    input.addEventListener('cancel', () => resolve([]), { once: true });
    input.click();
  });
}
