import type { ReactNode } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange(checked: boolean): void;
  label: ReactNode;
  title?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, title, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="switch"
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-label">{label}</span>
    </button>
  );
}
