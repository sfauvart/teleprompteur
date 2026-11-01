import { useState } from 'react';
import { formatDuration, parseDuration } from '../../domain/duration';
import { TARGET_DURATION_LIMITS, clamp } from '../../domain/settings';
import { speedForTarget, speedUnitLabel } from '../../domain/speed';
import { countWordsMemo } from '../../domain/words';
import { fr } from '../../i18n/fr';
import { useSession } from '../../stores/sessionStore';
import { toast } from '../../ui/feedback';
import { CloseIcon } from '../../ui/icons';

/** Durée cible et vitesse proposée (F44). */
export function TargetDuration() {
  const settings = useSession((s) => s.draft.settings);
  const text = useSession((s) => s.draft.text);
  const distance = useSession((s) => s.measuredDistance);
  const updateSettings = useSession((s) => s.updateSettings);
  const [editing, setEditing] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const target = settings.targetDurationSec;
  const proposal =
    target === null
      ? null
      : speedForTarget(settings.speed.unit, target, distance ?? 0, countWordsMemo(text));

  const commit = () => {
    if (editing === null) return;
    const value = editing.trim();
    setEditing(null);
    if (!value) {
      setInvalid(false);
      updateSettings({ targetDurationSec: null });
      return;
    }
    const seconds = parseDuration(value);
    setInvalid(seconds === null);
    if (seconds !== null) {
      updateSettings({
        targetDurationSec: clamp(seconds, TARGET_DURATION_LIMITS.min, TARGET_DURATION_LIMITS.max),
      });
    }
  };

  const unit = speedUnitLabel(settings.speed.unit);

  return (
    <div className="target">
      <label className="field inline">
        <span>{fr.target.label}</span>
        <input
          className="target-input"
          value={editing ?? (target === null ? '' : formatDuration(target))}
          placeholder={fr.target.placeholder}
          title={fr.target.hint}
          aria-invalid={invalid}
          onChange={(e) => setEditing(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>
      {target !== null && (
        <button
          type="button"
          className="icon-btn small"
          aria-label={fr.target.clear}
          title={fr.target.clear}
          onClick={() => updateSettings({ targetDurationSec: null })}
        >
          <CloseIcon width={16} height={16} />
        </button>
      )}
      {invalid && <span className="error">{fr.target.invalid}</span>}
      {proposal && (
        <span className="target-proposal">
          {fr.target.proposal(`${proposal.speed.value} ${unit}`)}
          {proposal.clamped && (
            <span className="hint">
              {' '}
              — {fr.target.outOfRange(`${Math.round(proposal.exact)} ${unit}`)}
            </span>
          )}
          {proposal.speed.value !== settings.speed.value && (
            <button
              type="button"
              className="btn small"
              onClick={() => {
                updateSettings({ speed: proposal.speed });
                toast(fr.target.applied);
              }}
            >
              {fr.target.apply}
            </button>
          )}
        </span>
      )}
    </div>
  );
}
