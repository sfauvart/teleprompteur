import { isModifiedSinceDrive } from '../../app/driveActions';
import type { PromptSettings } from '../../domain/settings';
import { fr } from '../../i18n/fr';
import type { DriveLink } from '../../storage/types';

interface DriveBadgeProps {
  prompt: { title: string; text: string; settings: PromptSettings; drive: DriveLink | null };
}

/** Prompt lié à un fichier Drive, et modifié ou non depuis le dernier envoi (F29). */
export function DriveBadge({ prompt }: DriveBadgeProps) {
  if (!prompt.drive) return null;
  const modified = isModifiedSinceDrive(prompt);
  return (
    <span
      className={`badge drive ${modified ? 'modified' : ''}`}
      title={modified ? fr.drive.badgeModifiedTitle : fr.drive.badgeSynced}
    >
      {modified ? fr.drive.badgeModified : fr.drive.badge}
    </span>
  );
}
