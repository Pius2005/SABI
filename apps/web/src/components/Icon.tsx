import type { ReactNode, SVGProps } from 'react';

const ICONS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10.5V20h13v-9.5" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.2a2.7 2.7 0 1 1 4.2 2.3c-1 .7-1.6 1.2-1.6 2.5" />
      <circle cx="12" cy="17.4" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  forward: <path d="M9 5l7 7-7 7" />,
  down: <path d="M6 9l6 6 6-6" />,
  up: <path d="M6 15l6-6 6 6" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21M9 21h6" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none" />,
  play: <path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none" />,
  volume: (
    <>
      <path d="M4 9.5h4L13 5v14l-5-4.5H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  check: <path d="M4 12.5l5 5L20 6.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  alert: (
    <>
      <path d="M12 3 2.5 20h19z" />
      <path d="M12 9v5" />
      <circle cx="12" cy="17.3" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.7 3.2 8 7.5 9.5 4.3-1.5 7.5-4.8 7.5-9.5V6z" />
      <path d="M8.5 12.2l2.5 2.5 4.5-5" />
    </>
  ),
  phone: (
    <path d="M6.5 3h3l1.5 4-2 1.5a13 13 0 0 0 6.5 6.5l1.5-2 4 1.5v3A2.5 2.5 0 0 1 18.5 20C10.5 20 4 13.5 4 5.5A2.5 2.5 0 0 1 6.5 3z" />
  ),
  'phone-off': (
    <>
      <path d="M6.5 3h3l1.5 4-2 1.5a13 13 0 0 0 6.5 6.5l1.5-2 4 1.5v3A2.5 2.5 0 0 1 18.5 20C10.5 20 4 13.5 4 5.5A2.5 2.5 0 0 1 6.5 3z" />
      <path d="M3 3l18 18" />
    </>
  ),
  chat: (
    <>
      <path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-5l-5 4v-4H7a3 3 0 0 1-3-3z" />
      <path d="M8 8.5h8M8 12h5" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9l9-5 9 5" />
      <path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9" />
      <path d="M3 21h18M3 18h18" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v11" />
      <path d="M7 9.5l5 5 5-5" />
      <path d="M4 17v3h16v-3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="M17 8l4 4-4 4M21 12H9" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.9M17.5 14.2A6.2 6.2 0 0 1 21.2 20" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3v18h17" />
      <path d="M8 17v-5M12 17V7M16 17v-8M20 17v-3" />
    </>
  ),
  flag: (
    <>
      <path d="M5 21V3" />
      <path d="M5 4h13l-3 4 3 4H5" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8V3h10v5" />
      <path d="M5 8h14a2 2 0 0 1 2 2v7h-4v4H7v-4H3v-7a2 2 0 0 1 2-2z" />
      <path d="M7 13h10v6H7z" />
    </>
  ),
  plus: <path d="M12 4v16M4 12h16" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5L21 21" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.5 8.5a15 15 0 0 1 19 0M5.5 12a10 10 0 0 1 13 0M8.5 15.5a5 5 0 0 1 7 0" />
      <circle cx="12" cy="19" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  'wifi-off': (
    <>
      <path d="M2.5 8.5a15 15 0 0 1 7-3.8M14.5 4.9a15 15 0 0 1 7 3.6M5.5 12a10 10 0 0 1 4-2.3M14.5 9.7a10 10 0 0 1 4 2.3M8.5 15.5a5 5 0 0 1 7 0" />
      <path d="M3 3l18 18" />
    </>
  ),
  star: (
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
  ),
  award: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.5L7 21l5-2.5L17 21l-1.5-7.5" />
    </>
  ),
  send: (
    <>
      <path d="M21 3L3 10.5l7 2.5 2.5 7z" />
      <path d="M10 13l11-10" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h3l1.5-2h5L16 6h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  paperclip: (
    <path d="M20 11.5l-8.4 8.4a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.9 1.9 0 0 1-2.6-2.6l7.8-7.8" />
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17.5h2M14 17.5h2" />
    </>
  ),
  heart: (
    <path d="M12 20.5S3.5 15.5 3.5 9.2A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.5 3.2c0 6.3-8.5 11.3-8.5 11.3z" />
  ),
  'arrow-right': (
    <>
      <path d="M4 12h16" />
      <path d="M14 6l6 6-6 6" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="4.5" />
      <path d="M11.2 11.2L21 21M17 17l2-2M14.5 14.5l2-2" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19M6 15h4" />
    </>
  ),
  message: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  text: (
    <>
      <path d="M4 6V4h16v2M12 4v16M8 20h8" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.1M3.5 12h.1M3.5 18h.1" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" />
      <rect x="13.5" y="3.5" width="7" height="7" />
      <rect x="3.5" y="13.5" width="7" height="7" />
      <rect x="13.5" y="13.5" width="7" height="7" />
    </>
  ),
  headphones: (
    <>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4" height="7" rx="2" />
      <rect x="17" y="14" width="4" height="7" rx="2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  car: (
    <>
      <path d="M4 16l1.5-6h13L20 16" />
      <path d="M3 16h18v4h-3v-2H6v2H3z" />
      <circle cx="7" cy="18" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M2 21h20M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7.5 12.2l3 3 6-6.4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.6" r="0.7" fill="currentColor" stroke="none" />
    </>
  ),
  install: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <path d="M12 6v7M9 10l3 3 3-3M9.5 18.5h5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.5a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4L11 6.1" />
      <path d="M14 10.5a4.5 4.5 0 0 0-6.4 0l-2.1 2.1a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1" />
    </>
  ),
  hand: (
    <>
      <path d="M8 12V6a1.5 1.5 0 0 1 3 0v5" />
      <path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 11V6a1.5 1.5 0 0 1 3 0v8" />
      <path d="M8 11.5 6.5 10a1.6 1.6 0 0 0-2.4 2.1l4 6.2A5 5 0 0 0 12.5 21H15a5 5 0 0 0 5-5v-4" />
    </>
  ),
};

export type IconName = keyof typeof ICONS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName | string;
  size?: number;
}

export function Icon({ name, size = 24, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {ICONS[name] ?? ICONS.info}
    </svg>
  );
}
