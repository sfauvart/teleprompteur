import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </Icon>
);
export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
  </Icon>
);
export const StopIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="currentColor" />
  </Icon>
);
export const FullscreenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </Icon>
);
export const ExitFullscreenIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Icon>
);
export const MirrorIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v18M9 7L4 12l5 5V7zM15 7l5 5-5 5V7z" />
  </Icon>
);
export const InvertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12h18M7 9L12 4l5 5H7zM7 15l5 5 5-5H7z" />
  </Icon>
);
export const HelpIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.01" />
  </Icon>
);
export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Icon>
);
export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 12h12" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 6v12M6 12h12" />
  </Icon>
);
export const SpeedIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 14l4-4M4 18a9 9 0 1 1 16 0" />
  </Icon>
);
export const TextSizeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 19l5-13 5 13M4.5 15h7M14 19l3.5-8 3.5 8M15 16.5h5" />
  </Icon>
);
export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);
