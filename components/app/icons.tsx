/**
 * Icones SVG inline (paths lucide.dev) — pas de dep lucide-react v1.16 trop ancien.
 * Toutes les icones partagent les memes props : size + className (color via currentColor).
 */

type IconProps = {
  size?: number;
  className?: string;
};

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
});

export const IconHome = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" />
  </svg>
);

export const IconSearch = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconCompass = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="16,8 14,14 8,16 10,10" />
  </svg>
);

export const IconCable = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 9V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4" />
    <path d="M4 9h6" />
    <path d="M14 15h6" />
    <path d="M16 19a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2" />
  </svg>
);

export const IconLayoutGrid = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

export const IconStar = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  </svg>
);

export const IconUser = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
  </svg>
);

export const IconUsers = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    <circle cx="17" cy="8" r="3" />
    <path d="M22 20c0-3-2-5-5-5" />
  </svg>
);

export const IconGift = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3" y="8" width="18" height="4" rx="1" />
    <path d="M12 8v13" />
    <path d="M5 12v9h14v-9" />
    <path d="M12 8a3 3 0 1 1 0-5 3 3 0 0 1 0 5z" />
    <path d="M12 8a3 3 0 1 0 0-5 3 3 0 0 0 0 5z" />
  </svg>
);

export const IconZap = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <polygon points="13,2 4,14 11,14 10,22 20,10 13,10" />
  </svg>
);

export const IconChevronDown = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconInbox = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <polyline points="22,12 16,12 14,15 10,15 8,12 2,12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
  </svg>
);

export const IconPlus = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMic = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
    <path d="M8 21h8" />
  </svg>
);

export const IconArrowUp = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </svg>
);

export const IconArrowRight = ({ size = 14, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export const IconSparkles = ({ size = 14, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
    <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
    <path d="M5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6L5 16z" />
  </svg>
);

export const IconPalette = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.8 4-4 4h-1.5a1.5 1.5 0 0 0-1.06 2.56l.51.5A1.5 1.5 0 0 1 14.89 22H12z" />
    <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
    <circle cx="12" cy="7.5" r="1" fill="currentColor" />
    <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
  </svg>
);

export const IconImage = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="1.5" />
    <path d="m21 15-4-4-8 8" />
  </svg>
);

export const IconSettings = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const IconChevronRight = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const IconChevronLeft = ({ size = 16, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const IconGlobe = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18" />
    <path d="M12 3a14 14 0 0 0 0 18" />
  </svg>
);

export const IconPlay = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
  </svg>
);

export const IconBot = ({ size = 18, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="4" y="7" width="16" height="13" rx="3" />
    <path d="M12 3v4" />
    <circle cx="9" cy="13" r="1" fill="currentColor" />
    <circle cx="15" cy="13" r="1" fill="currentColor" />
    <path d="M9 17h6" />
  </svg>
);

export const IconType = ({ size = 14, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 7V4h16v3" />
    <path d="M12 4v16" />
    <path d="M8 20h8" />
  </svg>
);

export const IconWaveform = ({ size = 14, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M2 12h2" />
    <path d="M6 8v8" />
    <path d="M10 5v14" />
    <path d="M14 9v6" />
    <path d="M18 7v10" />
    <path d="M22 11v2" />
  </svg>
);

export const IconFile = ({ size = 14, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6" />
  </svg>
);

export const IconWand = ({ size = 14, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M15 4V2" />
    <path d="M15 16v-2" />
    <path d="M8 9h2" />
    <path d="M20 9h2" />
    <path d="M17.8 11.8 19 13" />
    <path d="M15 9h.01" />
    <path d="M17.8 6.2 19 5" />
    <path d="M3 21 12 12" />
    <path d="M12.2 6.2 11 5" />
  </svg>
);

export const IconRepeat = ({ size = 14, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
);
