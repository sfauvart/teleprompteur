/** Formats essayés dans l'ordre (spec technique §9.1). */
const CANDIDATES = [
  { mime: 'audio/webm;codecs=opus', extension: 'webm' },
  { mime: 'audio/mp4', extension: 'm4a' },
  { mime: 'audio/ogg;codecs=opus', extension: 'ogg' },
  { mime: 'audio/webm', extension: 'webm' },
] as const;

export type MicrophoneError = 'unsupported' | 'denied' | 'not-found' | 'unknown';

export class MicrophoneUnavailable extends Error {
  readonly reason: MicrophoneError;

  constructor(reason: MicrophoneError) {
    super(reason);
    this.reason = reason;
  }
}

export interface Recording {
  blob: Blob;
  extension: string;
}

export function isRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Enregistrement audio pendant la lecture (F10). Le flux micro est conservé tant que
 * l'interrupteur est actif ; chaque session de lecture produit un fichier.
 */
export class AudioRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private format: (typeof CANDIDATES)[number] = CANDIDATES[0];
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Vrai pendant l'enregistrement effectif (indicateur rouge). */
  isRecording = (): boolean => this.recorder?.state === 'recording';

  get enabled(): boolean {
    return this.stream !== null;
  }

  /** Demande l'accès au micro. */
  async enable(): Promise<void> {
    if (this.stream) return;
    if (!isRecordingSupported()) throw new MicrophoneUnavailable('unsupported');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      throw new MicrophoneUnavailable(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'not-found'
            : 'unknown',
      );
    }
    this.format =
      CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c.mime)) ??
      CANDIDATES[CANDIDATES.length - 1]!;
  }

  /** Démarre ou reprend l'enregistrement (Play). */
  startOrResume(): void {
    if (!this.stream) return;
    if (this.recorder?.state === 'paused') {
      this.recorder.resume();
    } else if (!this.recorder) {
      this.chunks = [];
      this.recorder = new MediaRecorder(this.stream, { mimeType: this.format.mime });
      this.recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      });
      this.recorder.addEventListener('pause', this.emit);
      this.recorder.addEventListener('resume', this.emit);
      this.recorder.addEventListener('start', this.emit);
      this.recorder.start();
    }
    this.emit();
  }

  pause(): void {
    if (this.recorder?.state === 'recording') this.recorder.pause();
    this.emit();
  }

  /** Termine la session d'enregistrement et renvoie le fichier (null si rien n'a été enregistré). */
  finish(): Promise<Recording | null> {
    const recorder = this.recorder;
    this.recorder = null;
    if (!recorder || recorder.state === 'inactive') {
      this.emit();
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          const blob = new Blob(this.chunks, { type: this.format.mime.split(';')[0] });
          this.chunks = [];
          this.emit();
          resolve(blob.size > 0 ? { blob, extension: this.format.extension } : null);
        },
        { once: true },
      );
      recorder.stop();
    });
  }

  /** Coupe le micro (pistes arrêtées : le témoin système s'éteint). */
  async disable(): Promise<Recording | null> {
    const recording = await this.finish();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.emit();
    return recording;
  }

  private emit = (): void => {
    for (const listener of this.listeners) listener();
  };
}
