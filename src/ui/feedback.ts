import { create } from 'zustand';

// --- Notifications (toasts) ---

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  dismiss(id: number): void;
}

let nextToastId = 1;

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(
  message: string,
  options: { tone?: Toast['tone']; action?: Toast['action']; durationMs?: number } = {},
): void {
  const id = nextToastId++;
  const { tone = 'info', action, durationMs = action ? 12_000 : 4_000 } = options;
  useToasts.setState((state) => ({ toasts: [...state.toasts, { id, message, tone, action }] }));
  if (durationMs > 0) setTimeout(() => useToasts.getState().dismiss(id), durationMs);
}

// --- Dialogues modaux ---

export interface DialogAction<T extends string> {
  value: T;
  label: string;
  variant?: 'primary' | 'danger' | 'default';
}

export type DialogRequest =
  | {
      kind: 'choice';
      title: string;
      message: string;
      actions: DialogAction<string>[];
      resolve: (value: string | null) => void;
    }
  | {
      kind: 'text';
      title: string;
      label: string;
      initial: string;
      resolve: (value: string | null) => void;
    };

interface DialogState {
  current: DialogRequest | null;
  queue: DialogRequest[];
  close(value: string | null): void;
}

export const useDialogs = create<DialogState>()((set, get) => ({
  current: null,
  queue: [],
  close(value) {
    const { current, queue } = get();
    current?.resolve(value);
    set({ current: queue[0] ?? null, queue: queue.slice(1) });
  },
}));

function open(request: DialogRequest): void {
  const { current, queue } = useDialogs.getState();
  if (current) useDialogs.setState({ queue: [...queue, request] });
  else useDialogs.setState({ current: request });
}

/** Demande un choix ; `null` si le dialogue est fermé sans choisir (Échap). */
export function choose<T extends string>(options: {
  title: string;
  message: string;
  actions: DialogAction<T>[];
}): Promise<T | null> {
  return new Promise((resolve) =>
    open({ kind: 'choice', ...options, resolve: resolve as (value: string | null) => void }),
  );
}

/** Demande une saisie de texte ; `null` si annulé. */
export function askText(options: {
  title: string;
  label: string;
  initial?: string;
}): Promise<string | null> {
  return new Promise((resolve) => open({ kind: 'text', initial: '', ...options, resolve }));
}
