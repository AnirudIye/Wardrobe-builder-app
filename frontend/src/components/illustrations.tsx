// Flat vector illustrations used across the landing page in place of emoji and
// line icons - each one actually depicts the thing it stands for (a t-shirt, a
// sneaker, a sun behind a cloud, a wardrobe, and so on). Self-contained SVG, so
// nothing is fetched from the network. Palette: navy #0B1957 / blush #FA9EBC /
// cream #FFF6EA with a couple of literal accents (gold sun, brown leather).
type IProps = { className?: string };
const box = (className = "w-full h-full") => ({ viewBox: "0 0 64 64", className, xmlns: "http://www.w3.org/2000/svg" });

/* ------------------------------------------------------------- garments */
export function Tee({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M22 12 15 16 10 27 18 31 18 52a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V31l8-4-5-11-7-4c0 8-20 8-20 0Z" fill="#FA9EBC" stroke="#0B1957" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M24 13c0 5 16 5 16 0" fill="none" stroke="#0B1957" strokeWidth="2" opacity="0.5" />
      <path d="M24 40h16" stroke="#F2769F" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Coat({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M22 11 14 15 9 27l6 4v23h34V31l6-4-5-12-8-4-10 6Z" fill="#1B2C77" stroke="#071140" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M22 11 32 17 42 11 32 25Z" fill="#0B1957" />
      <line x1="32" y1="17" x2="32" y2="54" stroke="#071140" strokeWidth="2" />
      <rect x="15" y="34" width="34" height="5" fill="#071140" />
      <rect x="29" y="33.5" width="6" height="6" rx="1" fill="#FA9EBC" />
      <circle cx="27" cy="30" r="1.3" fill="#FDC9DA" />
      <circle cx="27" cy="45" r="1.3" fill="#FDC9DA" />
    </svg>
  );
}

export function Jeans({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M20 12h24l-1 7H21z" fill="#3350A8" stroke="#071140" strokeWidth="2" strokeLinejoin="round" />
      <path d="M21 19h22l-2 35h-8l-3-24-3 24h-8z" fill="#3350A8" stroke="#071140" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M24 24l3 6M40 24l-3 6" stroke="#FDC9DA" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="22.5" y="13.5" width="19" height="4" rx="1" fill="#26397A" />
    </svg>
  );
}

export function Sneaker({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M7 41c0-10 10-14 16-10l12 7c5 2 12 2 15 6v4H7z" fill="#FFFBF4" stroke="#0B1957" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M7 48h43v3a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3z" fill="#0B1957" />
      <path d="M20 33l3 7M25 35l3 7M30 37l3 7" stroke="#0B1957" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 43h8" stroke="#FA9EBC" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Derby({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M9 43c0-9 7-13 13-11l18 8c6 2 11 3 12 7v3H9z" fill="#A9744F" stroke="#5A3A1E" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M9 50h43v2a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2z" fill="#5A3A1E" />
      <path d="M22 34c3 3 4 6 4 9" fill="none" stroke="#5A3A1E" strokeWidth="1.8" />
    </svg>
  );
}

export function Belt({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <rect x="8" y="26" width="48" height="12" rx="6" fill="#7A4E2E" stroke="#5A3A1E" strokeWidth="2" />
      <rect x="24" y="24" width="14" height="16" rx="2" fill="none" stroke="#F6C453" strokeWidth="2.4" />
      <line x1="31" y1="24" x2="31" y2="40" stroke="#F6C453" strokeWidth="2.4" />
    </svg>
  );
}

/* -------------------------------------------------------------- weather */
export function SunCloud({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <g stroke="#F6C453" strokeWidth="2.4" strokeLinecap="round">
        <line x1="24" y1="8" x2="24" y2="12" />
        <line x1="11" y1="21" x2="15" y2="21" />
        <line x1="14" y1="12" x2="17" y2="15" />
        <line x1="34" y1="12" x2="31" y2="15" />
      </g>
      <circle cx="24" cy="22" r="8" fill="#F6C453" />
      <path d="M22 50a9 9 0 0 1 1-18 11 11 0 0 1 20 3 8 8 0 0 1-1 15z" fill="#FFFBF4" stroke="#0B1957" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------- concepts */
export function Wardrobe({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <rect x="13" y="8" width="38" height="44" rx="3" fill="#F7E9D4" stroke="#0B1957" strokeWidth="2.2" />
      <line x1="32" y1="8" x2="32" y2="52" stroke="#0B1957" strokeWidth="2" />
      <line x1="13" y1="18" x2="51" y2="18" stroke="#0B1957" strokeWidth="1.6" opacity="0.5" />
      <circle cx="29" cy="32" r="1.6" fill="#0B1957" />
      <circle cx="35" cy="32" r="1.6" fill="#0B1957" />
      <path d="M18 25l4-3 3 3M46 25l-4-3-3 3" stroke="#FA9EBC" strokeWidth="2" strokeLinecap="round" fill="none" />
      <line x1="18" y1="52" x2="18" y2="56" stroke="#0B1957" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="46" y1="52" x2="46" y2="56" stroke="#0B1957" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Bag({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M15 21h34l-3 32a3 3 0 0 1-3 3H21a3 3 0 0 1-3-3z" fill="#FA9EBC" stroke="#0B1957" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M23 21v-4a9 9 0 0 1 18 0v4" fill="none" stroke="#0B1957" strokeWidth="2.2" />
      <path d="M27 33a5 5 0 0 0 10 0" fill="none" stroke="#F2769F" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Chat({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M12 14h40a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H30l-11 8v-8h-7a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z" fill="#0B1957" />
      <circle cx="24" cy="28" r="2.2" fill="#FDC9DA" />
      <circle cx="32" cy="28" r="2.2" fill="#FDC9DA" />
      <circle cx="40" cy="28" r="2.2" fill="#FDC9DA" />
      <path d="M47 12l1.3 3.1L51 16l-2.7 1.1L47 20l-1.3-2.9L43 16l2.7-.9z" fill="#FA9EBC" />
    </svg>
  );
}

export function Mirror({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <ellipse cx="30" cy="26" rx="15" ry="18" fill="#FDC9DA" stroke="#0B1957" strokeWidth="2.2" />
      <ellipse cx="30" cy="26" rx="15" ry="18" fill="none" stroke="#FA9EBC" strokeWidth="1.4" opacity="0.6" transform="scale(0.82) translate(6.5 5.5)" />
      <path d="M22 18c-2 3-2 7 0 10" fill="none" stroke="#FFF6EA" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="27.5" y="44" width="5" height="14" rx="2.5" fill="#0B1957" />
      <path d="M45 40l1.1 2.7L49 44l-2.9 1.1L45 48l-1.1-2.9L41 44l2.9-1.3z" fill="#F6C453" />
    </svg>
  );
}

export function Calendar({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <rect x="11" y="14" width="42" height="39" rx="5" fill="#FFFBF4" stroke="#0B1957" strokeWidth="2.2" />
      <path d="M11 20a5 5 0 0 1 5-5h32a5 5 0 0 1 5 5v4H11z" fill="#FA9EBC" stroke="#0B1957" strokeWidth="2.2" strokeLinejoin="round" />
      <line x1="21" y1="10" x2="21" y2="18" stroke="#0B1957" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="43" y1="10" x2="43" y2="18" stroke="#0B1957" strokeWidth="2.6" strokeLinecap="round" />
      <g fill="#0B1957">
        <circle cx="21" cy="34" r="2" /><circle cx="32" cy="34" r="2" /><circle cx="43" cy="34" r="2" />
        <circle cx="21" cy="44" r="2" /><circle cx="32" cy="44" r="2" opacity="0.35" />
      </g>
      <circle cx="43" cy="44" r="4" fill="#F2769F" />
    </svg>
  );
}

/* ---------------------------------------------------------------- steps */
export function Camera({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M23 20l3-5h12l3 5" fill="#1B2C77" />
      <rect x="9" y="20" width="46" height="30" rx="5" fill="#1B2C77" stroke="#071140" strokeWidth="2.2" />
      <circle cx="32" cy="35" r="9" fill="#FDC9DA" stroke="#0B1957" strokeWidth="2.2" />
      <circle cx="32" cy="35" r="4" fill="#0B1957" />
      <circle cx="48" cy="26" r="1.8" fill="#F6C453" />
    </svg>
  );
}

export function Pin({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M32 7c-10 0-17 7-17 17 0 12 17 32 17 32s17-20 17-32c0-10-7-17-17-17Z" fill="#FA9EBC" stroke="#0B1957" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="32" cy="24" r="6.5" fill="#FFF6EA" stroke="#0B1957" strokeWidth="2" />
    </svg>
  );
}

export function Sparkles({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M27 8l4.5 11L43 23l-11.5 4L27 38l-4.5-11L11 23l11.5-4z" fill="#FA9EBC" stroke="#0B1957" strokeWidth="2" strokeLinejoin="round" />
      <path d="M46 34l2.2 5.3L54 41l-5.8 1.7L46 48l-2.2-5.3L38 41l5.8-1.7z" fill="#F6C453" stroke="#0B1957" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function Bags({ className }: IProps) {
  return (
    <svg {...box(className)}>
      <path d="M28 26h22l-2 26a3 3 0 0 1-3 3H33a3 3 0 0 1-3-3z" fill="#1B2C77" stroke="#071140" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M34 26v-3a6 6 0 0 1 12 0v3" fill="none" stroke="#071140" strokeWidth="2" />
      <path d="M12 22h20l-2 30a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3z" fill="#FA9EBC" stroke="#0B1957" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M17 22v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#0B1957" strokeWidth="2" />
    </svg>
  );
}

/* -------------------------------------------------------------- avatars */
const AV = [
  { bg: "#FDC9DA", skin: "#E8B58C", hair: "#3B2A22", shirt: "#0B1957" },
  { bg: "#C9D4F5", skin: "#F0C7A0", hair: "#6B4A2B", shirt: "#F2769F" },
  { bg: "#F7E9D4", skin: "#B07A50", hair: "#1E1A17", shirt: "#1B2C77" },
  { bg: "#FADCE6", skin: "#D79A6E", hair: "#2A2320", shirt: "#3350A8" },
] as const;

export function Avatar({ i = 0, className }: { i?: number; className?: string }) {
  const a = AV[i % AV.length];
  return (
    <svg viewBox="0 0 40 40" className={className ?? "w-full h-full"} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="20" fill={a.bg} />
      <path d="M8 36a12 11 0 0 1 24 0z" fill={a.shirt} />
      <circle cx="20" cy="17" r="7.5" fill={a.skin} />
      <path d="M12.5 16a7.5 7.5 0 0 1 15 0c0-3-2-6-7.5-6s-7.5 3-7.5 6z" fill={a.hair} />
    </svg>
  );
}
