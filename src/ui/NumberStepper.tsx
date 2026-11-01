import { useState, type ReactNode } from 'react';
import { MinusIcon, PlusIcon } from './icons';
import { fr } from '../i18n/fr';

interface NumberStepperProps {
  value: number;
  /** Bornage et arrondi au pas (spec fonctionnelle F5, F6). */
  normalize(value: number): number;
  step: number;
  onChange(value: number): void;
  label: string;
  icon?: ReactNode;
  suffix?: ReactNode;
  /** Affichage de la valeur (ex. virgule décimale). */
  format?: (value: number) => string;
}

const defaultFormat = (value: number) => String(value).replace('.', ',');

/**
 * Champ numérique à pas : boutons −/+ et saisie libre, validée à la sortie du champ.
 * Valeur hors plage → ramenée à la borne ; champ vide → valeur précédente.
 */
export function NumberStepper({
  value,
  normalize,
  step,
  onChange,
  label,
  icon,
  suffix,
  format = defaultFormat,
}: NumberStepperProps) {
  const [editing, setEditing] = useState<string | null>(null);

  const commit = () => {
    if (editing === null) return;
    const parsed = Number(editing.replace(',', '.'));
    setEditing(null);
    if (editing.trim() === '' || !Number.isFinite(parsed)) return;
    const next = normalize(parsed);
    if (next !== value) onChange(next);
  };

  const bump = (direction: 1 | -1) => {
    const next = normalize(value + direction * step);
    if (next !== value) onChange(next);
  };

  return (
    <div className="stepper" role="group" aria-label={label} title={label}>
      {icon && <span className="stepper-icon">{icon}</span>}
      <button
        type="button"
        className="icon-btn small"
        onClick={() => bump(-1)}
        aria-label={`${fr.prompter.decrease} : ${label}`}
      >
        <MinusIcon />
      </button>
      <input
        className="stepper-input"
        inputMode={Number.isInteger(step) ? 'numeric' : 'decimal'}
        aria-label={label}
        value={editing ?? format(value)}
        onChange={(e) => setEditing(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            e.currentTarget.blur();
          }
          if (e.key === 'Escape') {
            setEditing(null);
            e.currentTarget.blur();
          }
          e.stopPropagation();
        }}
      />
      <button
        type="button"
        className="icon-btn small"
        onClick={() => bump(1)}
        aria-label={`${fr.prompter.increase} : ${label}`}
      >
        <PlusIcon />
      </button>
      {suffix && <span className="stepper-suffix">{suffix}</span>}
    </div>
  );
}
