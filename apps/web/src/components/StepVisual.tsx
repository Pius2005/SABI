import type { ReactNode } from 'react';
import { APP_NAME } from '../lib/config';

const T = {
  fill: 'currentColor',
  stroke: 'none',
  fontFamily: 'inherit',
  fontWeight: 700,
} as const;

const LINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** SVG attributes accept numbers or numeric strings; normalise both. */
type Coord = number | string;

const PHONE_ICON =
  'M6.5 3h3l1.5 4-2 1.5a13 13 0 0 0 6.5 6.5l1.5-2 4 1.5v3A2.5 2.5 0 0 1 18.5 20C10.5 20 4 13.5 4 5.5A2.5 2.5 0 0 1 6.5 3z';

function Phone({ children }: { children: ReactNode }) {
  return (
    <g>
      <rect x="88" y="18" width="184" height="404" rx="30" fill="none" stroke="currentColor" strokeWidth="4" />
      <rect x="100" y="40" width="160" height="360" rx="18" fill="var(--paper-color)" stroke="currentColor" strokeWidth="2" />
      <line x1="150" y1="29" x2="210" y2="29" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="158" y1="408" x2="202" y2="408" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {children}
    </g>
  );
}

function Status({ time = '9:41' }: { time?: string }) {
  return (
    <g>
      <text x="112" y="54" fontSize="8" {...T}>
        {time}
      </text>
      <rect x="228" y="47" width="14" height="8" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="243" y="49" width="2" height="4" fill="currentColor" />
      <rect x="214" y="48" width="3" height="7" fill="currentColor" />
      <rect x="219" y="46" width="3" height="9" fill="currentColor" />
    </g>
  );
}

function AppBar({ title, back = true }: { title: string; back?: boolean }) {
  return (
    <g>
      {back ? <path d="M116 67l-8-8 8-8" {...LINE} /> : null}
      <text x="180" y="64" textAnchor="middle" fontSize="13" {...T}>
        {title}
      </text>
      <line x1="100" y1="78" x2="260" y2="78" stroke="currentColor" strokeWidth="2" />
    </g>
  );
}

function Pill({
  x,
  y,
  w,
  h,
  label,
  filled = false,
  size = 10,
}: {
  x: Coord;
  y: Coord;
  w: Coord;
  h: Coord;
  label: string;
  filled?: boolean;
  size?: number;
}) {
  const px = Number(x);
  const py = Number(y);
  const pw = Number(w);
  const ph = Number(h);
  return (
    <g>
      <rect
        x={px}
        y={py}
        width={pw}
        height={ph}
        rx={ph / 2}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <text
        x={px + pw / 2}
        y={py + ph / 2 + size * 0.36}
        textAnchor="middle"
        fontSize={size}
        fill={filled ? 'var(--paper-color)' : 'currentColor'}
        stroke="none"
        fontFamily="inherit"
        fontWeight="700"
      >
        {label}
      </text>
    </g>
  );
}

function Bubble({
  x,
  y,
  w,
  h,
  lines,
  out = false,
  size = 9,
}: {
  x: Coord;
  y: Coord;
  w: Coord;
  h: Coord;
  lines: string[];
  out?: boolean;
  size?: number;
}) {
  const px = Number(x);
  const py = Number(y);
  return (
    <g>
      <rect
        x={px}
        y={py}
        width={Number(w)}
        height={Number(h)}
        rx="9"
        fill={out ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
      />
      {lines.map((line, index) => (
        <text
          key={line}
          x={px + 9}
          y={py + 15 + index * (size + 3)}
          fontSize={size}
          fill={out ? 'var(--paper-color)' : 'currentColor'}
          stroke="none"
          fontFamily="inherit"
          fontWeight="700"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function CallButton({ cx, cy, r = 17, filled = true }: { cx: number; cy: number; r?: number; filled?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" />
      <g transform={`translate(${cx - 8}, ${cy - 8}) scale(0.66)`}>
        <path d={PHONE_ICON} fill={filled ? 'var(--paper-color)' : 'currentColor'} stroke="none" />
      </g>
    </g>
  );
}

function Keypad({ startY = 228, dim = false }: { startY?: number; dim?: boolean }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  return (
    <g opacity={dim ? 0.55 : 1}>
      {keys.map((key, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const cx = 136 + col * 44;
        const cy = startY + row * 36;
        return (
          <g key={key}>
            <circle cx={cx} cy={cy} r="15" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="12" {...T}>
              {key}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Avatar({ cx, cy, r = 26, label = 'A' }: { cx: Coord; cy: Coord; r?: Coord; label?: string }) {
  const px = Number(cx);
  const py = Number(cy);
  const pr = Number(r);
  return (
    <g>
      <circle cx={px} cy={py} r={pr} fill="none" stroke="currentColor" strokeWidth="2.5" />
      <text x={px} y={py + 7} textAnchor="middle" fontSize={pr * 0.85} {...T}>
        {label}
      </text>
    </g>
  );
}

function Row({
  y,
  label,
  value,
  highlight = false,
  icon = 'circle',
}: {
  y: Coord;
  label: string;
  value?: string;
  highlight?: boolean;
  icon?: 'circle' | 'lock' | 'check' | 'arrow';
}) {
  const py = Number(y);
  return (
    <g>
      <rect
        x="108"
        y={py}
        width="144"
        height="30"
        rx="7"
        fill={highlight ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {icon === 'lock' ? (
        <g transform={`translate(114 ${py + 9})`}>
          <rect x="0" y="5" width="10" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 5V3.5a3 3 0 0 1 6 0V5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </g>
      ) : icon === 'check' ? (
        <path d={`M114 ${py + 15}l3 3 5-6`} fill="none" stroke="currentColor" strokeWidth="2" />
      ) : icon === 'arrow' ? (
        <path d={`M114 ${py + 15}h8m-3-3 3 3-3 3`} fill="none" stroke="currentColor" strokeWidth="1.8" />
      ) : (
        <circle cx="120" cy={py + 15} r="3" fill="currentColor" />
      )}
      <text
        x="132"
        y={py + 19}
        fontSize="9.5"
        fill={highlight ? 'var(--paper-color)' : 'currentColor'}
        stroke="none"
        fontFamily="inherit"
        fontWeight="700"
      >
        {label}
      </text>
      {value ? (
        <text
          x="246"
          y={py + 19}
          textAnchor="end"
          fontSize="8.5"
          fill={highlight ? 'var(--paper-color)' : 'currentColor'}
          stroke="none"
          fontFamily="inherit"
          fontWeight="700"
        >
          {value}
        </text>
      ) : null}
    </g>
  );
}

function Field({ y, label, value }: { y: Coord; label: string; value: string }) {
  const py = Number(y);
  return (
    <g>
      <text x="112" y={py} fontSize="8" {...T}>
        {label}
      </text>
      <rect x="112" y={py + 6} width="136" height="26" rx="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <text x="120" y={py + 23} fontSize="9.5" {...T}>
        {value}
      </text>
    </g>
  );
}

function ToggleOn({ x, y }: { x: Coord; y: Coord }) {
  const px = Number(x);
  const py = Number(y);
  return (
    <g>
      <rect x={px} y={py} width="30" height="16" rx="8" fill="currentColor" />
      <circle cx={px + 22} cy={py + 8} r="5.5" fill="var(--paper-color)" />
    </g>
  );
}

function ToggleOff({ x, y }: { x: Coord; y: Coord }) {
  const px = Number(x);
  const py = Number(y);
  return (
    <g>
      <rect x={px} y={py} width="30" height="16" rx="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx={px + 8} cy={py + 8} r="5.5" fill="currentColor" />
    </g>
  );
}

function WarningTag({ x, y, w, label }: { x: Coord; y: Coord; w: Coord; label: string }) {
  const px = Number(x);
  const py = Number(y);
  return (
    <g>
      <rect x={px} y={py} width={Number(w)} height="26" rx="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" />
      <text x={px + 9} y={py + 17} fontSize="8.5" {...T}>
        {label}
      </text>
    </g>
  );
}

function Person({ cx, cy, label = '', scale = 1 }: { cx: Coord; cy: Coord; label?: string; scale?: number }) {
  return (
    <g transform={`translate(${Number(cx)} ${Number(cy)}) scale(${scale})`}>
      <circle cx="0" cy="-22" r="14" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M-24 32a24 24 0 0 1 48 0" fill="none" stroke="currentColor" strokeWidth="2.5" />
      {label ? (
        <text x="0" y="14" textAnchor="middle" fontSize="11" {...T}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

type Spotlight = { shape: 'circle' | 'rect'; x: number; y: number; w: number; h: number } | null | undefined;

function Scene({
  label,
  children,
  spotlight,
}: {
  label: string;
  children: ReactNode;
  spotlight?: Spotlight;
}) {
  return (
    <svg
      viewBox="0 0 360 440"
      role="img"
      aria-label={label}
      className="mx-auto block h-auto w-full max-w-[21rem]"
      style={{ maxHeight: '26rem' }}
    >
      <rect width="360" height="440" fill="var(--paper-color)" />
      {children}
      {spotlight ? (
        spotlight.shape === 'circle' ? (
          <circle
            cx={spotlight.x}
            cy={spotlight.y}
            r={Math.max(spotlight.w, spotlight.h) / 2 + 6}
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeDasharray="9 6"
          />
        ) : (
          <rect
            x={spotlight.x - 4}
            y={spotlight.y - 4}
            width={spotlight.w + 8}
            height={spotlight.h + 8}
            rx="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeDasharray="9 6"
          />
        )
      ) : null}
    </svg>
  );
}

function visual(name: string): ReactNode {
  switch (name) {
    case 'phone-front':
      return (
        <Phone>
          <Status />
          <text x="180" y="150" textAnchor="middle" fontSize="24" {...T}>
            {APP_NAME}
          </text>
          <text x="180" y="174" textAnchor="middle" fontSize="11" {...T}>
            Hello, Ada
          </text>
          <Pill x="132" y="205" w="96" h="34" label="Start" filled />
          <text x="180" y="272" textAnchor="middle" fontSize="9" {...T}>
            Hold the phone. Screen faces you.
          </text>
          <path d="M210 330c28 6 42 22 42 44" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="250" cy="372" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </Phone>
      );

    case 'phone-side':
      return (
        <g>
          <rect x="148" y="30" width="64" height="380" rx="20" fill="none" stroke="currentColor" strokeWidth="4" />
          <rect x="148" y="30" width="64" height="380" rx="20" fill="var(--paper-color)" stroke="currentColor" strokeWidth="4" />
          <rect x="210" y="128" width="8" height="46" rx="4" fill="currentColor" />
          <circle cx="214" cy="151" r="34" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="5 5" />
          <path d="M254 151h34" {...LINE} />
          <path d="M282 143l8 8-8 8" {...LINE} />
          <text x="286" y="128" fontSize="11" {...T}>
            Power
          </text>
          <text x="180" y="420" textAnchor="middle" fontSize="10" {...T}>
            Press and hold 3 seconds
          </text>
        </g>
      );

    case 'phone-home': {
      const apps = ['Call', 'Chat', 'Bank', 'Camera', 'Music', 'News', 'Maps', 'Photos', 'Settings'];
      return (
        <Phone>
          <Status />
          <text x="180" y="112" textAnchor="middle" fontSize="26" {...T}>
            9:41
          </text>
          {apps.map((label, index) => {
            const col = index % 3;
            const row = Math.floor(index / 3);
            const x = 120 + col * 48;
            const y = 150 + row * 52;
            return (
              <g key={label}>
                <rect x={x} y={y} width="36" height="36" rx="9" fill="none" stroke="currentColor" strokeWidth="2" />
                <text x={x + 18} y={y + 23} textAnchor="middle" fontSize="13" {...T}>
                  {label.slice(0, 1)}
                </text>
                <text x={x + 18} y={y + 47} textAnchor="middle" fontSize="6.5" {...T}>
                  {label}
                </text>
              </g>
            );
          })}
          <text x="180" y="382" textAnchor="middle" fontSize="8" {...T}>
            Tap an app to open it
          </text>
        </Phone>
      );
    }

    case 'phone-bottom':
      return (
        <g>
          <rect x="80" y="90" width="200" height="220" rx="26" fill="none" stroke="currentColor" strokeWidth="4" />
          <line x1="80" y1="300" x2="280" y2="300" stroke="currentColor" strokeWidth="4" />
          <rect x="160" y="294" width="40" height="12" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <circle key={index} cx={130 + index * 16} cy="318" r="2.5" fill="currentColor" />
          ))}
          <path d="M180 306v54c0 18 14 26 30 26" fill="none" stroke="currentColor" strokeWidth="3" />
          <rect x="208" y="378" width="30" height="26" rx="5" fill="none" stroke="currentColor" strokeWidth="3" />
          <text x="180" y="350" textAnchor="middle" fontSize="10" {...T}>
            Charging port
          </text>
        </g>
      );

    case 'phone-charging':
      return (
        <Phone>
          <Status />
          <text x="180" y="140" textAnchor="middle" fontSize="13" {...T}>
            Charging
          </text>
          <rect x="146" y="162" width="68" height="34" rx="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <rect x="150" y="166" width="34" height="26" rx="2" fill="currentColor" />
          <rect x="216" y="171" width="5" height="16" rx="2" fill="currentColor" />
          <path d="M178 168l-8 14h7l-3 12 12-16h-7z" fill="var(--paper-color)" stroke="none" />
          <path d="M180 360v20c0 14 10 20 22 20h30" fill="none" stroke="currentColor" strokeWidth="3" />
          <rect x="232" y="390" width="24" height="20" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
          <text x="180" y="322" textAnchor="middle" fontSize="9" {...T}>
            Plug in the cable
          </text>
        </Phone>
      );

    case 'phone-touch':
      return (
        <Phone>
          <Status />
          <text x="180" y="118" textAnchor="middle" fontSize="12" {...T}>
            Touch gently
          </text>
          <circle cx="180" cy="190" r="30" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="180" cy="190" r="42" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 5" />
          <text x="180" y="196" textAnchor="middle" fontSize="14" {...T}>
            Tap
          </text>
          <path d="M198 210c22 16 32 34 32 54" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="232" cy="270" r="10" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <text x="180" y="320" textAnchor="middle" fontSize="9" {...T}>
            Use one finger. Do not press hard.
          </text>
        </Phone>
      );

    case 'wifi':
      return (
        <Phone>
          <Status />
          <AppBar title="Settings" />
          <text x="116" y="106" fontSize="12" {...T}>
            Wi-Fi
          </text>
          <ToggleOn x="222" y="94" />
          <text x="116" y="134" fontSize="8" {...T}>
            Choose a network
          </text>
          <Row y="146" label="Mama's WiFi" value="On" highlight icon="lock" />
          <Row y="182" label="Shop WiFi" value="Off" icon="lock" />
          <Row y="218" label="Mobile data" value="Off" />
          <WarningTag x="108" y="270" w="144" label="Ask for the password first" />
        </Phone>
      );

    case 'data':
      return (
        <Phone>
          <Status />
          <AppBar title="Settings" />
          <text x="116" y="106" fontSize="11" {...T}>
            Mobile data
          </text>
          <ToggleOn x="222" y="94" />
          <text x="116" y="132" fontSize="8" {...T}>
            Uses your airtime
          </text>
          <Row y="146" label="Data left" value="1.2 GB" />
          <Row y="182" label="Airtime" value="₦850" />
          <Row y="218" label="Wi-Fi" value="Off" icon="lock" />
          <WarningTag x="108" y="272" w="144" label="Turn data off to save airtime" />
        </Phone>
      );

    case 'settings-wifi':
      return (
        <Phone>
          <Status />
          <AppBar title="Settings" />
          <Row y="96" label="Wi-Fi" value="On" highlight />
          <Row y="132" label="Mobile data" value="Off" />
          <Row y="168" label="Display" />
          <Row y="204" label="Sound" />
          <Row y="240" label="Battery" />
          <Row y="276" label="About phone" />
        </Phone>
      );

    case 'wifi-password':
      return (
        <Phone>
          <Status />
          <AppBar title="Wi-Fi" />
          <text x="112" y="104" fontSize="11" {...T}>
            Mama's WiFi
          </text>
          <text x="112" y="130" fontSize="8" {...T}>
            Enter password
          </text>
          <rect x="112" y="140" width="136" height="30" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <circle key={index} cx={124 + index * 12} cy="155" r="3.5" fill="currentColor" />
          ))}
          <Pill x="146" y="190" w="68" h="30" label="Join" filled />
          <WarningTag x="108" y="246" w="144" label="Ask the owner for the password" />
        </Phone>
      );

    case 'settings-display':
      return (
        <Phone>
          <Status />
          <AppBar title="Settings" />
          <Row y="96" label="Wi-Fi" value="On" />
          <Row y="132" label="Display" value="Text" highlight />
          <Row y="168" label="Sound" />
          <Row y="204" label="Brightness" />
          <Row y="240" label="Text size" />
          <Row y="276" label="Auto-lock" />
        </Phone>
      );

    case 'settings-text':
      return (
        <Phone>
          <Status />
          <AppBar title="Text size" />
          <text x="120" y="150" fontSize="16" {...T}>
            A
          </text>
          <text x="172" y="154" fontSize="24" {...T}>
            A
          </text>
          <text x="222" y="160" fontSize="34" {...T}>
            A
          </text>
          <line x1="112" y1="188" x2="248" y2="188" stroke="currentColor" strokeWidth="2" />
          <circle cx="206" cy="188" r="9" fill="currentColor" />
          <text x="180" y="224" textAnchor="middle" fontSize="12" {...T}>
            This is easier to read
          </text>
          <text x="180" y="246" textAnchor="middle" fontSize="9" {...T}>
            Slide to make words bigger
          </text>
        </Phone>
      );

    case 'settings-brightness':
      return (
        <Phone>
          <Status />
          <AppBar title="Brightness" />
          <circle cx="180" cy="130" r="22" fill="none" stroke="currentColor" strokeWidth="2.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={180 + Math.cos(rad) * 30}
                y1={130 + Math.sin(rad) * 30}
                x2={180 + Math.cos(rad) * 38}
                y2={130 + Math.sin(rad) * 38}
                stroke="currentColor"
                strokeWidth="2.5"
              />
            );
          })}
          <line x1="112" y1="206" x2="248" y2="206" stroke="currentColor" strokeWidth="2" />
          <circle cx="222" cy="206" r="9" fill="currentColor" />
          <text x="180" y="246" textAnchor="middle" fontSize="10" {...T}>
            Bright screen, easy to see
          </text>
          <text x="180" y="268" textAnchor="middle" fontSize="8.5" {...T}>
            Not too bright at night
          </text>
        </Phone>
      );

    case 'recent-apps':
      return (
        <Phone>
          <Status />
          <text x="180" y="110" textAnchor="middle" fontSize="12" {...T}>
            Open apps
          </text>
          {[0, 1, 2].map((index) => (
            <g key={index}>
              <rect x="112" y={132 + index * 74} width="136" height="60" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
              <rect x="122" y={142 + index * 74} width="40" height="40" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
              <text x="172" y={158 + index * 74} fontSize="10" {...T}>
                {['Chat', 'Bank', 'Camera'][index]}
              </text>
              <text x="172" y={174 + index * 74} fontSize="8" {...T}>
                Tap to open
              </text>
              <path
                d={`M236 ${148 + index * 74}l8 8m0-8l-8 8`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </g>
          ))}
          <text x="180" y="368" textAnchor="middle" fontSize="8.5" {...T}>
            Swipe up to close an app
          </text>
        </Phone>
      );

    case 'dialer':
      return (
        <Phone>
          <Status />
          <AppBar title="Phone" back={false} />
          <text x="180" y="108" textAnchor="middle" fontSize="15" {...T}>
            0803 000 0000
          </text>
          <text x="180" y="124" textAnchor="middle" fontSize="8" {...T}>
            Practice number
          </text>
          <Keypad startY={152} />
          <CallButton cx={180} cy={322} r={18} />
          <Pill x="122" y="352" w="46" h="24" label="USSD" size={8} />
          <Pill x="192" y="352" w="46" h="24" label="Delete" size={8} />
        </Phone>
      );

    case 'call-active':
      return (
        <Phone>
          <Status />
          <text x="180" y="96" textAnchor="middle" fontSize="11" {...T}>
            On a call
          </text>
          <Avatar cx="180" cy="150" r="34" label="A" />
          <text x="180" y="206" textAnchor="middle" fontSize="15" {...T}>
            Ada
          </text>
          <text x="180" y="226" textAnchor="middle" fontSize="10" {...T}>
            00:12
          </text>
          <Pill x="112" y="252" w="56" h="26" label="Mute" size={8} />
          <Pill x="192" y="252" w="56" h="26" label="Speaker" size={8} />
          <CallButton cx={180} cy={322} r={20} />
          <text x="180" y="358" textAnchor="middle" fontSize="8" {...T}>
            Red button ends the call
          </text>
        </Phone>
      );

    case 'call-incoming':
      return (
        <Phone>
          <Status />
          <text x="180" y="100" textAnchor="middle" fontSize="11" {...T}>
            Incoming call
          </text>
          <Avatar cx="180" cy="158" r="34" label="A" />
          <text x="180" y="214" textAnchor="middle" fontSize="15" {...T}>
            Ada
          </text>
          <CallButton cx={130} cy={272} r={20} filled={false} />
          <CallButton cx={230} cy={272} r={20} />
          <text x="130" y="310" textAnchor="middle" fontSize="8" {...T}>
            Decline
          </text>
          <text x="230" y="310" textAnchor="middle" fontSize="8" {...T}>
            Answer
          </text>
          <text x="180" y="350" textAnchor="middle" fontSize="8" {...T}>
            Press the button, then lift to your ear
          </text>
        </Phone>
      );

    case 'dialer-recents':
      return (
        <Phone>
          <Status />
          <AppBar title="Recent calls" />
          {[
            { name: 'Ada', value: 'Missed' },
            { name: 'Mama', value: 'Today' },
            { name: 'Unknown', value: 'Yesterday' },
          ].map((entry, index) => (
            <g key={entry.name}>
              <circle cx="122" cy={112 + index * 46} r="13" fill="none" stroke="currentColor" strokeWidth="2" />
              <text x="122" y={116 + index * 46} textAnchor="middle" fontSize="10" {...T}>
                {entry.name.slice(0, 1)}
              </text>
              <text x="144" y={110 + index * 46} fontSize="10" {...T}>
                {entry.name}
              </text>
              <text x="144" y={124 + index * 46} fontSize="8" {...T}>
                {entry.value}
              </text>
              <path d={`M238 ${108 + index * 46}h14`} {...LINE} />
            </g>
          ))}
          <Pill x="136" y="300" w="88" h="30" label="Call back" />
        </Phone>
      );

    case 'contact-save':
      return (
        <Phone>
          <Status />
          <AppBar title="New contact" />
          <Field y="104" label="Name" value="Ada" />
          <Field y="160" label="Phone number" value="0803 000 0000" />
          <Pill x="136" y="230" w="88" h="32" label="Save" filled />
          <WarningTag x="108" y="292" w="144" label="Only save people you know" />
        </Phone>
      );

    case 'whatsapp-chat':
      return (
        <Phone>
          <Status />
          <AppBar title="Ada" />
          <Bubble x="110" y="94" w="98" h="42" lines={['Good morning,', 'how are you?']} />
          <Bubble x="150" y="146" w="100" h="42" lines={['I am fine.', 'Thank you.']} out />
          <Bubble x="110" y="198" w="92" h="30" lines={['See you soon']} />
          <rect x="108" y="344" width="104" height="30" rx="15" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="118" y="363" fontSize="8.5" {...T}>
            Message
          </text>
          <circle cx="230" cy="359" r="16" fill="currentColor" />
          <g transform="translate(223 352) scale(0.6)">
            <rect x="4" y="2" width="12" height="20" rx="6" fill="var(--paper-color)" />
            <path d="M1 11a9 9 0 0 0 18 0M10 20v4" fill="none" stroke="var(--paper-color)" strokeWidth="2.5" />
          </g>
        </Phone>
      );

    case 'video-call':
      return (
        <Phone>
          <Status />
          <text x="180" y="96" textAnchor="middle" fontSize="11" {...T}>
            Video call
          </text>
          <Avatar cx="180" cy="178" r="46" label="A" />
          <text x="180" y="246" textAnchor="middle" fontSize="15" {...T}>
            Ada
          </text>
          <rect x="206" y="104" width="42" height="56" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="227" cy="132" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
          <Pill x="112" y="288" w="52" h="26" label="Mute" size={8} />
          <Pill x="174" y="288" w="52" h="26" label="Camera" size={8} />
          <Pill x="236" y="288" w="18" h="26" label="X" size={9} />
          <text x="180" y="336" textAnchor="middle" fontSize="8" {...T}>
            The red button stops the video
          </text>
        </Phone>
      );

    case 'whatsapp-chats':
      return (
        <Phone>
          <Status />
          <AppBar title="WhatsApp" />
          {[
            { name: 'Ada', line: 'See you soon', initial: 'A' },
            { name: 'Mama', line: 'Did you eat?', initial: 'M' },
            { name: 'Family group', line: 'Ada: Good morning', initial: 'F' },
            { name: 'Unknown', line: 'You have won!', initial: '?' },
          ].map((entry, index) => (
            <g key={entry.name}>
              <Avatar cx={122} cy={104 + index * 52} r={16} label={entry.initial} />
              <text x="148" y={102 + index * 52} fontSize="10" {...T}>
                {entry.name}
              </text>
              <text x="148" y={116 + index * 52} fontSize="8" {...T}>
                {entry.line}
              </text>
              <line x1="108" y1={130 + index * 52} x2="252" y2={130 + index * 52} stroke="currentColor" strokeWidth="1" />
            </g>
          ))}
          <text x="180" y="360" textAnchor="middle" fontSize="8" {...T}>
            Tap a name to open the chat
          </text>
        </Phone>
      );

    case 'whatsapp-sent':
      return (
        <Phone>
          <Status />
          <AppBar title="Ada" />
          <Bubble x="110" y="98" w="96" h="34" lines={['I am coming.']} out />
          <path d="M196 124l4 4 7-8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <Bubble x="110" y="148" w="120" h="44" lines={['I will bring', 'the medicine.']} out />
          <path d="M218 182l4 4 7-8M226 182l4 4 7-8" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <text x="180" y="230" textAnchor="middle" fontSize="8" {...T}>
            One tick: sent. Two ticks: delivered.
          </text>
          <rect x="108" y="344" width="104" height="30" rx="15" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="230" cy="359" r="16" fill="currentColor" />
        </Phone>
      );

    case 'camera':
      return (
        <Phone>
          <Status />
          <rect x="106" y="88" width="148" height="220" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M118 100v20M118 100h20M242 100v20M242 100h-20M118 296v-20M118 296h20M242 296v-20M242 296h-20" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="180" cy="198" r="34" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="180" cy="198" r="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx="180" cy="344" r="22" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="180" cy="344" r="14" fill="currentColor" />
          <text x="180" y="386" textAnchor="middle" fontSize="8" {...T}>
            Press the round button to take a photo
          </text>
        </Phone>
      );

    case 'whatsapp-keyboard':
      return (
        <Phone>
          <Status />
          <AppBar title="Ada" />
          <Bubble x="110" y="94" w="96" h="30" lines={['Hello Ada']} />
          <rect x="108" y="230" width="144" height="26" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, index) => (
            <g key={row}>
              {row.split('').map((letter, letterIndex) => (
                <g key={`${row}-${letter}`}>
                  <rect
                    x={112 + letterIndex * 13 + (index === 1 ? 6 : index === 2 ? 18 : 0)}
                    y={266 + index * 26}
                    width="11"
                    height="20"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <text
                    x={117.5 + letterIndex * 13 + (index === 1 ? 6 : index === 2 ? 18 : 0)}
                    y={280 + index * 26}
                    textAnchor="middle"
                    fontSize="6"
                    {...T}
                  >
                    {letter}
                  </text>
                </g>
              ))}
            </g>
          ))}
          <rect x="130" y="346" width="100" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <text x="180" y="360" textAnchor="middle" fontSize="7" {...T}>
            space
          </text>
        </Phone>
      );

    case 'whatsapp-attach':
      return (
        <Phone>
          <Status />
          <AppBar title="Ada" />
          <Bubble x="110" y="94" w="96" h="30" lines={['Send me a photo']} />
          <rect x="104" y="236" width="152" height="120" rx="12" fill="var(--paper-color)" stroke="currentColor" strokeWidth="2" />
          <text x="180" y="256" textAnchor="middle" fontSize="9" {...T}>
            Attach
          </text>
          {['Camera', 'Gallery', 'Document'].map((label, index) => (
            <g key={label}>
              <circle cx={132 + index * 48} cy="288" r="15" fill="none" stroke="currentColor" strokeWidth="2" />
              <text x={132 + index * 48} y="292" textAnchor="middle" fontSize="9" {...T}>
                {label.slice(0, 1)}
              </text>
              <text x={132 + index * 48} y="320" textAnchor="middle" fontSize="6.5" {...T}>
                {label}
              </text>
            </g>
          ))}
          <text x="180" y="342" textAnchor="middle" fontSize="7.5" {...T}>
            Choose where the photo comes from
          </text>
        </Phone>
      );

    case 'gallery':
      return (
        <Phone>
          <Status />
          <AppBar title="Gallery" />
          {Array.from({ length: 9 }).map((_, index) => {
            const col = index % 3;
            const row = Math.floor(index / 3);
            const x = 110 + col * 48;
            const y = 94 + row * 58;
            return (
              <g key={index}>
                <rect x={x} y={y} width="42" height="50" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d={`M${x + 4} ${y + 36}l10-12 8 8 6-6 10 10`} fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx={x + 32} cy={y + 12} r="4" fill="currentColor" />
              </g>
            );
          })}
          <text x="180" y="330" textAnchor="middle" fontSize="8" {...T}>
            Tap a photo to choose it
          </text>
        </Phone>
      );

    case 'photo-preview':
      return (
        <Phone>
          <Status />
          <AppBar title="Send photo" />
          <rect x="110" y="94" width="140" height="190" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M120 250l34-46 26 28 18-20 32 38" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="222" cy="120" r="9" fill="currentColor" />
          <Pill x="136" y="306" w="88" h="32" label="Send" filled />
          <text x="180" y="360" textAnchor="middle" fontSize="8" {...T}>
            Check the photo before you send
          </text>
        </Phone>
      );

    case 'whatsapp-invite':
      return (
        <Phone>
          <Status />
          <AppBar title="Group invite" />
          <Avatar cx="180" cy="132" r="32" label="F" />
          <text x="180" y="188" textAnchor="middle" fontSize="13" {...T}>
            Family group
          </text>
          <text x="180" y="208" textAnchor="middle" fontSize="8.5" {...T}>
            Ada invited you
          </text>
          <Pill x="136" y="240" w="88" h="32" label="Join" filled />
          <Pill x="136" y="284" w="88" h="32" label="Not now" />
          <WarningTag x="108" y="340" w="144" label="Only join groups you know" />
        </Phone>
      );

    case 'whatsapp-group':
      return (
        <Phone>
          <Status />
          <AppBar title="Family group" />
          <text x="116" y="94" fontSize="7.5" {...T}>
            Ada
          </text>
          <Bubble x="110" y="100" w="100" h="30" lines={['Good morning all']} />
          <text x="150" y="144" fontSize="7.5" {...T}>
            Mama
          </text>
          <Bubble x="150" y="150" w="100" h="30" lines={['Morning my dear']} out />
          <text x="116" y="194" fontSize="7.5" {...T}>
            Ada
          </text>
          <Bubble x="110" y="200" w="112" h="30" lines={['See you on Sunday']} />
          <rect x="108" y="344" width="104" height="30" rx="15" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="230" cy="359" r="16" fill="currentColor" />
        </Phone>
      );

    case 'whatsapp-ticks':
      return (
        <Phone>
          <Status />
          <AppBar title="Messages" />
          <Bubble x="110" y="96" w="110" h="32" lines={['I got your message']} out />
          <path d="M208 120l4 4 7-8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <text x="180" y="146" textAnchor="middle" fontSize="8" {...T}>
            One tick: sent
          </text>
          <Bubble x="110" y="170" w="110" h="32" lines={['Thank you']} out />
          <path d="M200 194l4 4 7-8M208 194l4 4 7-8" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <text x="180" y="220" textAnchor="middle" fontSize="8" {...T}>
            Two ticks: delivered
          </text>
          <WarningTag x="108" y="270" w="144" label="Ticks do not prove who is reading" />
        </Phone>
      );

    case 'bank-home':
      return (
        <Phone>
          <Status />
          <AppBar title="My bank" back={false} />
          <rect x="110" y="96" width="140" height="58" rx="8" fill="currentColor" />
          <text x="120" y="118" fontSize="8" fill="var(--paper-color)" stroke="none" fontFamily="inherit" fontWeight="700">
            Practice account
          </text>
          <text x="120" y="140" fontSize="15" fill="var(--paper-color)" stroke="none" fontFamily="inherit" fontWeight="700">
            ₦ 25,000
          </text>
          <Pill x="110" y="176" w="64" h="34" label="Balance" filled />
          <Pill x="186" y="176" w="64" h="34" label="Transfer" />
          <Pill x="110" y="224" w="64" h="34" label="Airtime" />
          <Pill x="186" y="224" w="64" h="34" label="History" />
          <WarningTag x="108" y="292" w="144" label="Open the app yourself, not a link" />
        </Phone>
      );

    case 'bank-pin':
      return (
        <Phone>
          <Status />
          <AppBar title="Enter PIN" />
          <text x="180" y="110" textAnchor="middle" fontSize="9" {...T}>
            Practice PIN
          </text>
          {[0, 1, 2, 3].map((index) => (
            <circle key={index} cx={146 + index * 23} cy="138" r="6" fill="currentColor" />
          ))}
          <Keypad startY={176} />
          <WarningTag x="108" y="320" w="144" label="Never enter a real PIN in practice" />
        </Phone>
      );

    case 'bank-balance':
      return (
        <Phone>
          <Status />
          <AppBar title="Balance" />
          <text x="180" y="126" textAnchor="middle" fontSize="9" {...T}>
            Available balance
          </text>
          <text x="180" y="164" textAnchor="middle" fontSize="26" {...T}>
            ₦ 25,000
          </text>
          <text x="180" y="188" textAnchor="middle" fontSize="8" {...T}>
            Practice money only
          </text>
          <Pill x="136" y="226" w="88" h="32" label="Done" filled />
          <WarningTag x="108" y="286" w="144" label="Log out when you finish" />
        </Phone>
      );

    case 'bank-transfer':
      return (
        <Phone>
          <Status />
          <AppBar title="Transfer" />
          <Field y="96" label="Account number" value="0123 456 789" />
          <Field y="152" label="Amount" value="₦ 5,000" />
          <Field y="208" label="Name check" value="ADA OKAFOR" />
          <Pill x="136" y="268" w="88" h="32" label="Continue" filled />
          <WarningTag x="108" y="322" w="144" label="Check the name before you send" />
        </Phone>
      );

    case 'bank-receipt':
      return (
        <Phone>
          <Status />
          <circle cx="180" cy="132" r="34" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M164 132l11 11 22-24" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <text x="180" y="198" textAnchor="middle" fontSize="15" {...T}>
            Transfer sent
          </text>
          <text x="180" y="222" textAnchor="middle" fontSize="9" {...T}>
            ₦ 5,000 to ADA
          </text>
          <text x="180" y="244" textAnchor="middle" fontSize="8" {...T}>
            Practice receipt
          </text>
          <Pill x="136" y="278" w="88" h="30" label="Done" filled />
        </Phone>
      );

    case 'ussd':
      return (
        <Phone>
          <Status />
          <AppBar title="Phone" back={false} />
          <text x="180" y="112" textAnchor="middle" fontSize="20" {...T}>
            *737#
          </text>
          <text x="180" y="132" textAnchor="middle" fontSize="8" {...T}>
            Practice USSD code
          </text>
          <Keypad startY={156} />
          <CallButton cx={180} cy={326} r={18} />
          <text x="180" y="366" textAnchor="middle" fontSize="8" {...T}>
            USSD works without data
          </text>
        </Phone>
      );

    case 'pos':
      return (
        <g>
          <rect x="90" y="70" width="180" height="230" rx="18" fill="none" stroke="currentColor" strokeWidth="4" />
          <rect x="106" y="90" width="148" height="90" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="180" y="124" textAnchor="middle" fontSize="11" {...T}>
            Amount
          </text>
          <text x="180" y="152" textAnchor="middle" fontSize="20" {...T}>
            ₦ 5,000
          </text>
          <rect x="106" y="196" width="148" height="26" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="180" y="213" textAnchor="middle" fontSize="8" {...T}>
            Insert card here
          </text>
          <text x="180" y="252" textAnchor="middle" fontSize="8" {...T}>
            Check the amount before you pay
          </text>
          <rect x="120" y="300" width="120" height="74" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="180" y="324" textAnchor="middle" fontSize="8" {...T}>
            Receipt
          </text>
          <line x1="132" y1="336" x2="228" y2="336" stroke="currentColor" strokeWidth="1.5" />
          <line x1="132" y1="348" x2="210" y2="348" stroke="currentColor" strokeWidth="1.5" />
        </g>
      );

    case 'sms-bank':
      return (
        <Phone>
          <Status />
          <AppBar title="Messages" />
          <rect x="108" y="94" width="144" height="96" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="118" y="112" fontSize="9" {...T}>
            Your bank
          </text>
          <text x="118" y="132" fontSize="8.5" {...T}>
            Debit alert:
          </text>
          <text x="118" y="148" fontSize="8.5" {...T}>
            ₦ 5,000 was sent.
          </text>
          <text x="118" y="168" fontSize="8.5" {...T}>
            Not you? Call the bank.
          </text>
          <WarningTag x="108" y="212" w="144" label="Use the number on your card" />
          <Pill x="136" y="266" w="88" h="30" label="Open" />
        </Phone>
      );

    case 'bank-card':
      return (
        <g>
          <rect x="60" y="120" width="240" height="150" rx="16" fill="none" stroke="currentColor" strokeWidth="4" />
          <rect x="82" y="146" width="42" height="30" rx="5" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <line x1="96" y1="146" x2="96" y2="176" stroke="currentColor" strokeWidth="1.5" />
          <line x1="110" y1="146" x2="110" y2="176" stroke="currentColor" strokeWidth="1.5" />
          <text x="82" y="214" fontSize="14" {...T}>
            •••• •••• •••• 1234
          </text>
          <text x="82" y="244" fontSize="9" {...T}>
            ADA OKAFOR
          </text>
          <text x="250" y="244" textAnchor="end" fontSize="9" {...T}>
            12/29
          </text>
          <WarningTag x="60" y="300" w="240" label="Never share the card number or CVV" />
        </g>
      );

    case 'bank-pin-warning':
      return (
        <g>
          <path d="M180 70l70 26v62c0 54-36 92-70 108-34-16-70-54-70-108v-62z" fill="none" stroke="currentColor" strokeWidth="4" />
          <path d="M152 170l20 20 38-44" fill="none" stroke="currentColor" strokeWidth="5" />
          <text x="180" y="316" textAnchor="middle" fontSize="16" {...T}>
            Never share your PIN
          </text>
          <text x="180" y="342" textAnchor="middle" fontSize="10" {...T}>
            Not with family. Not with "bank staff".
          </text>
          <text x="180" y="364" textAnchor="middle" fontSize="10" {...T}>
            Not in a message or on a call.
          </text>
        </g>
      );

    case 'sms-otp':
      return (
        <Phone>
          <Status />
          <AppBar title="Messages" />
          <rect x="108" y="94" width="144" height="88" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="118" y="112" fontSize="9" {...T}>
            Your bank
          </text>
          <text x="118" y="132" fontSize="8.5" {...T}>
            Your code is
          </text>
          <text x="118" y="152" fontSize="14" {...T}>
            ••••••
          </text>
          <text x="118" y="170" fontSize="8" {...T}>
            Never share this code.
          </text>
          <WarningTag x="108" y="204" w="144" label="The bank will never ask for it" />
          <text x="180" y="268" textAnchor="middle" fontSize="9" {...T}>
            Read it yourself. Do not send it.
          </text>
        </Phone>
      );

    case 'scam-stop':
      return (
        <g>
          <circle cx="180" cy="170" r="74" fill="none" stroke="currentColor" strokeWidth="4" />
          <path d="M180 96v148M106 170h148" stroke="currentColor" strokeWidth="4" />
          <path d="M152 140l56 60M208 140l-56 60" stroke="currentColor" strokeWidth="4" />
          <path d="M72 300c0-24 18-42 42-42h18M288 300c0-24-18-42-42-42h-18" fill="none" stroke="currentColor" strokeWidth="3" />
          <text x="180" y="350" textAnchor="middle" fontSize="18" {...T}>
            STOP
          </text>
          <text x="180" y="376" textAnchor="middle" fontSize="10" {...T}>
            Do not reply. Do not press the link.
          </text>
        </g>
      );

    case 'family-help':
      return (
        <g>
          <Person cx="120" cy="180" scale={1.25} label="" />
          <Person cx="250" cy="200" scale={1.05} label="" />
          <rect x="214" y="150" width="34" height="56" rx="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <text x="180" y="340" textAnchor="middle" fontSize="14" {...T}>
            Ask someone you trust
          </text>
          <text x="180" y="366" textAnchor="middle" fontSize="9.5" {...T}>
            You can still do it yourself, step by step.
          </text>
        </g>
      );

    case 'sms-scam':
      return (
        <Phone>
          <Status />
          <AppBar title="Messages" />
          <rect x="108" y="94" width="144" height="104" rx="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
          <text x="118" y="112" fontSize="9" {...T}>
            Unknown sender
          </text>
          <text x="118" y="134" fontSize="8.5" {...T}>
            Your account is
          </text>
          <text x="118" y="150" fontSize="8.5" {...T}>
            blocked. Press here:
          </text>
          <text x="118" y="170" fontSize="8.5" textDecoration="underline" {...T}>
            bank-verify.example
          </text>
          <text x="118" y="188" fontSize="8" {...T}>
            Send your PIN to fix it.
          </text>
          <WarningTag x="108" y="212" w="144" label="This is a scam. Do not reply." />
        </Phone>
      );

    case 'sms-prize':
      return (
        <Phone>
          <Status />
          <AppBar title="Messages" />
          <rect x="108" y="94" width="144" height="110" rx="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
          <text x="118" y="112" fontSize="9" {...T}>
            Unknown sender
          </text>
          <text x="118" y="136" fontSize="11" {...T}>
            You have won
          </text>
          <text x="118" y="156" fontSize="15" {...T}>
            ₦500,000
          </text>
          <text x="118" y="176" fontSize="8.5" {...T}>
            Pay ₦2,000 to claim.
          </text>
          <text x="118" y="194" fontSize="8.5" textDecoration="underline" {...T}>
            claim-prize.example
          </text>
          <WarningTag x="108" y="220" w="144" label="A real prize never asks for money" />
        </Phone>
      );

    case 'sms-delete':
      return (
        <Phone>
          <Status />
          <AppBar title="Messages" />
          <rect x="108" y="94" width="144" height="94" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="118" y="112" fontSize="9" {...T}>
            Unknown sender
          </text>
          <text x="118" y="134" fontSize="8.5" {...T}>
            Press this link to
          </text>
          <text x="118" y="150" fontSize="8.5" {...T}>
            receive your money.
          </text>
          <Pill x="112" y="204" w="64" h="30" label="Block" filled />
          <Pill x="184" y="204" w="64" h="30" label="Delete" />
          <text x="180" y="266" textAnchor="middle" fontSize="9" {...T}>
            Block first, then delete.
          </text>
        </Phone>
      );

    case 'sim-swap':
      return (
        <g>
          <rect x="70" y="110" width="76" height="90" rx="10" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M98 110v26H70" fill="none" stroke="currentColor" strokeWidth="3" />
          <rect x="96" y="140" width="28" height="34" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M156 155h44" {...LINE} />
          <path d="M192 145l10 10-10 10" {...LINE} />
          <rect x="216" y="80" width="70" height="120" rx="12" fill="none" stroke="currentColor" strokeWidth="3" />
          <text x="180" y="250" textAnchor="middle" fontSize="13" {...T}>
            SIM swap
          </text>
          <text x="180" y="274" textAnchor="middle" fontSize="9.5" {...T}>
            If your phone loses signal,
          </text>
          <text x="180" y="292" textAnchor="middle" fontSize="9.5" {...T}>
            call your network at once.
          </text>
        </g>
      );

    case 'sim-shop':
      return (
        <g>
          <rect x="60" y="220" width="240" height="90" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M60 250h240" stroke="currentColor" strokeWidth="2" />
          <Person cx="130" cy="180" scale={1.1} label="" />
          <rect x="204" y="150" width="48" height="64" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="228" y="176" textAnchor="middle" fontSize="8" {...T}>
            SIM
          </text>
          <text x="180" y="342" textAnchor="middle" fontSize="13" {...T}>
            Buy a SIM only from the network
          </text>
          <text x="180" y="366" textAnchor="middle" fontSize="9.5" {...T}>
            Register it with your own name.
          </text>
        </g>
      );

    case 'call-unknown':
      return (
        <Phone>
          <Status />
          <text x="180" y="100" textAnchor="middle" fontSize="11" {...T}>
            Incoming call
          </text>
          <Avatar cx="180" cy="158" r="34" label="?" />
          <text x="180" y="214" textAnchor="middle" fontSize="15" {...T}>
            Unknown number
          </text>
          <text x="180" y="234" textAnchor="middle" fontSize="8.5" {...T}>
            0803 000 0000
          </text>
          <CallButton cx={130} cy={272} r={20} filled={false} />
          <CallButton cx={230} cy={272} r={20} />
          <text x="130" y="310" textAnchor="middle" fontSize="8" {...T}>
            Decline
          </text>
          <text x="230" y="310" textAnchor="middle" fontSize="8" {...T}>
            Answer
          </text>
        </Phone>
      );

    case 'scam-caller':
      return (
        <Phone>
          <Status />
          <text x="180" y="96" textAnchor="middle" fontSize="10" {...T}>
            Caller says: "I am from your bank"
          </text>
          <Avatar cx="180" cy="150" r="30" label="?" />
          <Bubble x="108" y="192" w="144" h="46" lines={['We need your PIN', 'to protect your money.']} />
          <WarningTag x="108" y="254" w="144" label="A real bank never asks for your PIN" />
          <Pill x="136" y="302" w="88" h="30" label="End call" filled />
        </Phone>
      );

    case 'job-scam':
      return (
        <Phone>
          <Status />
          <AppBar title="Job advert" />
          <rect x="108" y="94" width="144" height="128" rx="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
          <text x="118" y="114" fontSize="10" {...T}>
            Work from home
          </text>
          <text x="118" y="134" fontSize="9" {...T}>
            Earn ₦20,000 a day
          </text>
          <text x="118" y="154" fontSize="9" {...T}>
            Pay ₦5,000 fee
          </text>
          <text x="118" y="174" fontSize="9" {...T}>
            Send your bank details
          </text>
          <text x="118" y="198" fontSize="8.5" textDecoration="underline" {...T}>
            quick-job.example
          </text>
          <WarningTag x="108" y="234" w="144" label="A real job does not ask you to pay" />
        </Phone>
      );

    case 'job-real':
      return (
        <Phone>
          <Status />
          <AppBar title="Job advert" />
          <rect x="108" y="94" width="144" height="128" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="118" y="114" fontSize="10" {...T}>
            Shop assistant
          </text>
          <text x="118" y="134" fontSize="9" {...T}>
            Apply at the shop
          </text>
          <text x="118" y="154" fontSize="9" {...T}>
            Bring your CV
          </text>
          <text x="118" y="174" fontSize="9" {...T}>
            No fee to apply
          </text>
          <path d="M118 196l8 8 14-16" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <WarningTag x="108" y="234" w="144" label="Check the address and the employer" />
        </Phone>
      );

    case 'sms-link':
      return (
        <Phone>
          <Status />
          <AppBar title="Messages" />
          <rect x="108" y="94" width="144" height="90" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="118" y="112" fontSize="9" {...T}>
            Unknown sender
          </text>
          <text x="118" y="134" fontSize="8.5" {...T}>
            Your parcel is waiting.
          </text>
          <text x="118" y="154" fontSize="8.5" {...T}>
            Press this link:
          </text>
          <text x="118" y="172" fontSize="9" textDecoration="underline" {...T}>
            parcel-track.example
          </text>
          <WarningTag x="108" y="204" w="144" label="Do not press links you did not expect" />
          <text x="180" y="262" textAnchor="middle" fontSize="9" {...T}>
            Ask the company using its real number.
          </text>
        </Phone>
      );

    case 'sms-block':
      return (
        <Phone>
          <Status />
          <AppBar title="Messages" />
          <rect x="108" y="94" width="144" height="96" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="118" y="112" fontSize="9" {...T}>
            Unknown sender
          </text>
          <text x="118" y="134" fontSize="8.5" {...T}>
            Send your OTP now
          </text>
          <text x="118" y="150" fontSize="8.5" {...T}>
            or your account closes.
          </text>
          <Pill x="112" y="208" w="64" h="30" label="Block" filled />
          <Pill x="184" y="208" w="64" h="30" label="Delete" />
          <text x="180" y="268" textAnchor="middle" fontSize="9" {...T}>
            Block stops more messages.
          </text>
        </Phone>
      );

    case 'facilitator':
      return (
        <g>
          <Person cx="120" cy="170" scale={1.25} label="" />
          <Person cx="242" cy="190" scale={1.05} label="" />
          <rect x="80" y="250" width="54" height="70" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <line x1="90" y1="268" x2="124" y2="268" stroke="currentColor" strokeWidth="2" />
          <line x1="90" y1="282" x2="124" y2="282" stroke="currentColor" strokeWidth="2" />
          <line x1="90" y1="296" x2="114" y2="296" stroke="currentColor" strokeWidth="2" />
          <text x="180" y="356" textAnchor="middle" fontSize="14" {...T}>
            Learn together, small small
          </text>
        </g>
      );

    case 'help':
      return (
        <g>
          <Person cx="180" cy="190" scale={1.5} label="" />
          <path d="M126 170a54 54 0 0 1 108 0" fill="none" stroke="currentColor" strokeWidth="3" />
          <rect x="118" y="170" width="16" height="34" rx="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <rect x="226" y="170" width="16" height="34" rx="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M242 204c0 24-22 34-42 34" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="196" cy="238" r="5" fill="currentColor" />
          <text x="180" y="360" textAnchor="middle" fontSize="14" {...T}>
            A person can help you
          </text>
        </g>
      );

    case 'browser':
      return (
        <Phone>
          <Status />
          <rect x="106" y="88" width="148" height="26" rx="13" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="120" y="105" fontSize="8" {...T}>
            www.example.com
          </text>
          <rect x="106" y="126" width="148" height="150" rx="8" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="180" y="156" textAnchor="middle" fontSize="11" {...T}>
            A website
          </text>
          <line x1="122" y1="176" x2="238" y2="176" stroke="currentColor" strokeWidth="2" />
          <line x1="122" y1="192" x2="220" y2="192" stroke="currentColor" strokeWidth="2" />
          <line x1="122" y1="208" x2="230" y2="208" stroke="currentColor" strokeWidth="2" />
          <Pill x="136" y="292" w="88" h="30" label="Search" />
        </Phone>
      );

    case 'browser-search':
      return (
        <Phone>
          <Status />
          <rect x="106" y="92" width="148" height="30" rx="15" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="120" y="111" fontSize="9" {...T}>
            clinic near me
          </text>
          {['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, index) => (
            <g key={row}>
              {row.split('').map((letter, letterIndex) => (
                <g key={`${row}-${letter}`}>
                  <rect
                    x={112 + letterIndex * 13 + (index === 1 ? 6 : index === 2 ? 18 : 0)}
                    y={150 + index * 28}
                    width="11"
                    height="22"
                    rx="2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <text
                    x={117.5 + letterIndex * 13 + (index === 1 ? 6 : index === 2 ? 18 : 0)}
                    y={165 + index * 28}
                    textAnchor="middle"
                    fontSize="6"
                    {...T}
                  >
                    {letter}
                  </text>
                </g>
              ))}
            </g>
          ))}
          <rect x="130" y="240" width="100" height="22" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <text x="180" y="255" textAnchor="middle" fontSize="7" {...T}>
            space
          </text>
        </Phone>
      );

    case 'browser-results':
      return (
        <Phone>
          <Status />
          <rect x="106" y="88" width="148" height="24" rx="12" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="118" y="104" fontSize="8" {...T}>
            clinic near me
          </text>
          {[0, 1, 2].map((index) => (
            <g key={index}>
              <text x="112" y={134 + index * 58} fontSize="9" textDecoration="underline" {...T}>
                {['Community clinic', 'Health centre', 'Pharmacy'][index]}
              </text>
              <text x="112" y={150 + index * 58} fontSize="7.5" {...T}>
                Open 8am - 5pm
              </text>
              <line x1="108" y1={162 + index * 58} x2="252" y2={162 + index * 58} stroke="currentColor" strokeWidth="1" />
            </g>
          ))}
          <text x="180" y="340" textAnchor="middle" fontSize="8" {...T}>
            Check the address before you go.
          </text>
        </Phone>
      );

    case 'music':
      return (
        <Phone>
          <Status />
          <text x="180" y="110" textAnchor="middle" fontSize="12" {...T}>
            Music
          </text>
          <rect x="120" y="130" width="120" height="120" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="180" cy="190" r="26" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="180" cy="190" r="8" fill="currentColor" />
          <text x="180" y="278" textAnchor="middle" fontSize="11" {...T}>
            Old favourites
          </text>
          <circle cx="180" cy="314" r="24" fill="currentColor" />
          <path d="M174 302l18 12-18 12z" fill="var(--paper-color)" stroke="none" />
          <path d="M132 314h-20M248 314h-20" stroke="currentColor" strokeWidth="3" />
        </Phone>
      );

    case 'news-warning':
      return (
        <Phone>
          <Status />
          <AppBar title="News" />
          <text x="112" y="106" fontSize="11" {...T}>
            Breaking story
          </text>
          <line x1="112" y1="118" x2="248" y2="118" stroke="currentColor" strokeWidth="2" />
          {[0, 1, 2, 3].map((index) => (
            <line key={index} x1="112" y1={136 + index * 16} x2={index === 3 ? 210 : 248} y2={136 + index * 16} stroke="currentColor" strokeWidth="1.5" />
          ))}
          <WarningTag x="108" y="220" w="144" label="Check who wrote it and the date" />
          <Pill x="136" y="270" w="88" h="30" label="Check source" />
        </Phone>
      );

    case 'ride':
      return (
        <g>
          <rect x="50" y="60" width="260" height="300" rx="12" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M80 300c30-50 40-40 70-80s60-20 80-70 40-40 50-60" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="8 6" />
          <circle cx="80" cy="300" r="9" fill="currentColor" />
          <path d="M280 90l14 0-7-14z" fill="currentColor" />
          <rect x="150" y="160" width="40" height="22" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="158" cy="184" r="4" fill="currentColor" />
          <circle cx="182" cy="184" r="4" fill="currentColor" />
          <text x="180" y="398" textAnchor="middle" fontSize="11" {...T}>
            Check the car and the plate
          </text>
        </g>
      );

    case 'ride-driver':
      return (
        <Phone>
          <Status />
          <AppBar title="Your ride" />
          <Avatar cx="180" cy="136" r="32" label="D" />
          <text x="180" y="190" textAnchor="middle" fontSize="13" {...T}>
            Driver name
          </text>
          <text x="180" y="212" textAnchor="middle" fontSize="11" {...T}>
            Plate: ABC 123 XY
          </text>
          <text x="180" y="232" textAnchor="middle" fontSize="9" {...T}>
            White Toyota
          </text>
          <Pill x="136" y="262" w="88" h="30" label="Call driver" />
          <WarningTag x="108" y="318" w="144" label="Match the plate before you enter" />
        </Phone>
      );

    case 'ride-share':
      return (
        <Phone>
          <Status />
          <AppBar title="Share trip" />
          <text x="180" y="112" textAnchor="middle" fontSize="10" {...T}>
            Send your trip to someone
          </text>
          <Row y="136" label="Ada" icon="arrow" />
          <Row y="172" label="Mama" icon="arrow" />
          <Row y="208" label="Family group" icon="arrow" />
          <Pill x="136" y="266" w="88" h="30" label="Send" filled />
          <text x="180" y="322" textAnchor="middle" fontSize="8.5" {...T}>
            They can see the car and the route.
          </text>
        </Phone>
      );

    case 'clinic':
      return (
        <g>
          <rect x="70" y="130" width="220" height="170" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M150 300v-60h60v60" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M180 155v40M160 175h40" stroke="currentColor" strokeWidth="5" />
          <rect x="92" y="160" width="34" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="234" y="160" width="34" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <text x="180" y="342" textAnchor="middle" fontSize="13" {...T}>
            Book a clinic visit
          </text>
          <text x="180" y="366" textAnchor="middle" fontSize="9.5" {...T}>
            Bring your card and your phone.
          </text>
        </g>
      );

    case 'calendar':
      return (
        <Phone>
          <Status />
          <AppBar title="Choose a day" />
          <text x="180" y="102" textAnchor="middle" fontSize="11" {...T}>
            March 2027
          </text>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <text key={`${day}-${index}`} x={118 + index * 21} y="124" textAnchor="middle" fontSize="8" {...T}>
              {day}
            </text>
          ))}
          {Array.from({ length: 28 }).map((_, index) => {
            const col = index % 7;
            const row = Math.floor(index / 7);
            const x = 118 + col * 21;
            const y = 148 + row * 28;
            const selected = index === 16;
            return (
              <g key={index}>
                {selected ? <circle cx={x} cy={y - 4} r="11" fill="currentColor" /> : null}
                <text x={x} y={y} textAnchor="middle" fontSize="8" fill={selected ? 'var(--paper-color)' : 'currentColor'} stroke="none" fontFamily="inherit" fontWeight="700">
                  {index + 1}
                </text>
              </g>
            );
          })}
          <Pill x="136" y="286" w="88" h="30" label="Book" filled />
        </Phone>
      );

    case 'gov-portal':
      return (
        <Phone>
          <Status />
          <AppBar title="Government portal" />
          <path d="M120 120l60-30 60 30" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <path d="M130 120v34M160 120v34M200 120v34M230 120v34M120 164h120" fill="none" stroke="currentColor" strokeWidth="2" />
          <Field y="184" label="Full name" value="Ada Okafor" />
          <Field y="240" label="Reference" value={`${APP_NAME}-0001`} />
          <Pill x="136" y="300" w="88" h="30" label="Submit" filled />
          <text x="180" y="356" textAnchor="middle" fontSize="8" {...T}>
            Use the official website only.
          </text>
        </Phone>
      );

    default:
      return (
        <Phone>
          <Status />
          <text x="180" y="180" textAnchor="middle" fontSize="12" {...T}>
            Phone practice
          </text>
          <text x="180" y="204" textAnchor="middle" fontSize="9" {...T}>
            Look at the picture and follow the steps.
          </text>
        </Phone>
      );
  }
}

export function StepVisual({
  name,
  alt,
  spotlight,
}: {
  name: string;
  alt: string;
  spotlight?: Spotlight;
}) {
  return (
    <Scene label={alt} spotlight={spotlight}>
      {visual(name)}
    </Scene>
  );
}
