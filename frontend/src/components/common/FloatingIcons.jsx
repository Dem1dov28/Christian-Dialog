import React from "react";

/**
 * FloatingIcons — EpochalDialog Historical Background Decorations
 *
 * Design rules:
 *  ✓ FIXED positions — identical on every render, no randomness
 *  ✓ UNIQUE icons — one icon per slot, zero repeats
 *  ✓ CONSTANT opacity — set in slot definition, NEVER animated
 *  ✓ High visibility — increased opacity so icons are clearly seen
 *  ✓ Mobile-safe zones: top 12%–85% to avoid header/bottom-nav overlap
 *  ✓ Desktop: icons fill all edges and a few interior points
 */

/* ─────────────────────────────────────────────────────────────────
   SVG ICONS: Religion, Science, Politics, Philosophy,
              Inventions, Art, Literature, Business
───────────────────────────────────────────────────────────────── */
const ICONS = {

  /* ═══ RELIGION ═══ */
  
  /* Cross — Christianity */
  cross: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M5 8h14" />
    </svg>
  ),

  /* Temple dome — Religion/sacred architecture */
  temple: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V10" />
      <path d="M19 21V10" />
      <path d="M9 21V14h6v7" />
      <path d="M3 10h18L12 3 3 10z" />
    </svg>
  ),

  /* Star & Crescent — Islam */
  crescent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />
      <path d="M19 7l.5 1.5L21 9l-1.5.5L19 11l-.5-1.5L17 9l1.5-.5z" fill="currentColor" fillOpacity="0.3" />
    </svg>
  ),

  /* ═══ SCIENCE ═══ */
  
  /* Atom — Physics */
  atom: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.3" />
      <ellipse cx="12" cy="12" rx="10" ry="4" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
    </svg>
  ),

  /* Flask — Chemistry */
  flask: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6v5l4.5 9a2 2 0 0 1-1.8 2.9H6.3A2 2 0 0 1 4.5 17L9 8V3z" />
      <line x1="6" y1="3" x2="18" y2="3" />
      <path d="M6 15h12" opacity="0.5" />
    </svg>
  ),

  /* DNA helix — Biology */
  dna: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 15c6.667-6 13.333 0 20-6" />
      <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
      <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
      <path d="M17 6l-2.5-2.5" />
      <path d="M14 8l-3-3" />
      <path d="M7 18l2.5 2.5" />
      <path d="M10 16l3 3" />
    </svg>
  ),

  /* ═══ POLITICS ═══ */
  
  /* Crown — Monarchy */
  crown: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 17h20v3H2z" />
      <path d="M2 10l4 4 6-8 6 8 4-4v7H2z" />
      <circle cx="12" cy="4" r="1" fill="currentColor" />
    </svg>
  ),

  /* Columns — Government/Democracy */
  columns: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="20" width="20" height="2" rx="1" />
      <rect x="2" y="2" width="20" height="3" rx="1" />
      <rect x="4" y="5" width="2" height="15" />
      <rect x="11" y="5" width="2" height="15" />
      <rect x="18" y="5" width="2" height="15" />
    </svg>
  ),

  /* Scales — Justice/Law */
  scales: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" />
      <path d="M4 7l3.5 7h-7l3.5-7" />
      <path d="M20 7l-3.5 7h7l-3.5-7" />
      <path d="M4 7h16" />
      <circle cx="12" cy="3" r="1" fill="currentColor" />
      <line x1="10" y1="21" x2="14" y2="21" />
    </svg>
  ),

  /* ═══ PHILOSOPHY ═══ */
  
  /* Eye — Wisdom/Knowledge */
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.25" />
    </svg>
  ),

  /* Infinity — Eternal thought */
  infinity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4z" />
    </svg>
  ),

  /* Thought bubble — Philosophy/Thinking */
  thought: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),

  /* ═══ INVENTIONS ═══ */
  
  /* Lightbulb — Ideas */
  lightbulb: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </svg>
  ),

  /* Gear — Engineering */
  gear: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),

  /* Compass — Navigation/Discovery */
  compass: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill="currentColor" fillOpacity="0.25" />
    </svg>
  ),

  /* ═══ ART ═══ */
  
  /* Palette — Painting */
  palette: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.64 1.5-1.5 0-.39-.13-.74-.38-1.02-.21-.28-.38-.59-.38-.98 0-.93.75-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.97-4.48-9-10-9z" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" />
      <circle cx="12" cy="7" r="1.5" fill="currentColor" />
      <circle cx="16" cy="10" r="1.5" fill="currentColor" />
    </svg>
  ),

  /* Lyre — Music */
  lyre: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c-3 0-5 2.5-5 5v10a2 2 0 0 0 4 0v-1h2v1a2 2 0 0 0 4 0V8c0-2.5-2-5-5-5z" />
      <line x1="10" y1="10" x2="10" y2="16" />
      <line x1="14" y1="10" x2="14" y2="16" />
    </svg>
  ),

  /* Theater masks — Drama */
  masks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a7 7 0 0 0 14 0 7 7 0 0 0-14 0z" />
      <circle cx="6" cy="8" r="1" fill="currentColor" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
      <path d="M6 12s1.5 2 3.5 2 3.5-2 3.5-2" />
      <path d="M22 15a7 7 0 0 1-10 0" opacity="0.6" />
      <circle cx="17" cy="13" r="1" fill="currentColor" opacity="0.6" />
      <circle cx="21" cy="13" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  ),

  /* ═══ LITERATURE ═══ */
  
  /* Open book — Knowledge */
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),

  /* Quill — Writing */
  quill: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
    </svg>
  ),

  /* Scroll — Ancient texts */
  scroll: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  ),

  /* ═══ BUSINESS ═══ */
  
  /* Coins — Money/Trade */
  coins: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="7" />
      <path d="M15 15a7 7 0 1 0 0-6" />
      <path d="M9 6v6l3 2" />
    </svg>
  ),

  /* Chart — Growth/Economy */
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M18 9l-5 5-4-4-6 6" />
    </svg>
  ),

  /* Briefcase — Commerce */
  briefcase: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
};

/* ─────────────────────────────────────────────────────────────────
   FIXED ICON LAYOUT

   Coordinate system: left/top are % of viewport width/height.

   Mobile-safe zone: top 12%–84%  (avoids header ~56px & bottom nav ~60px)
   Tablet-safe zone: top 10%–88%
   Desktop: full range

   Layout philosophy:
     • 8 mobile icons: 4 corners (safe) + 4 sides
     • 13 tablet icons: add outer mid-edge positions
     • 20 desktop icons: fill interior atmosphere points too

   Each icon appears ONCE. Key = icon key from ICONS object above.
───────────────────────────────────────────────────────────────── */
const ICON_SLOTS = [
  //  key           left   top   size  rot    opacity  delay   desktop  tablet  mobile
  // ── 4 CORNER ANCHORS (always visible on all breakpoints) ──────────────────────────
  { key: "book", left: 5, top: 13, size: 38, rot: 15, op: 0.52, delay: 0, d: true, t: true, m: true },
  { key: "atom", left: 88, top: 12, size: 40, rot: -10, op: 0.52, delay: 14, d: true, t: true, m: true },
  { key: "scales", left: 6, top: 82, size: 36, rot: 8, op: 0.48, delay: 6, d: true, t: true, m: true },
  { key: "palette", left: 88, top: 82, size: 34, rot: -12, op: 0.48, delay: 22, d: true, t: true, m: true },

  // ── 4 MID-EDGE (mobile + tablet + desktop) ────────────────────────────────────────
  { key: "cross", left: 47, top: 14, size: 42, rot: 0, op: 0.50, delay: 30, d: true, t: true, m: true },
  { key: "lightbulb", left: 5, top: 48, size: 36, rot: 10, op: 0.48, delay: 18, d: true, t: true, m: true },
  { key: "crown", left: 89, top: 46, size: 36, rot: -10, op: 0.48, delay: 26, d: true, t: true, m: true },
  { key: "eye", left: 47, top: 83, size: 36, rot: 0, op: 0.48, delay: 40, d: true, t: true, m: true },

  // ── TABLET EXTRAS (tablet + desktop) ─────────────────────────────────────────────
  { key: "quill", left: 22, top: 11, size: 34, rot: 0, op: 0.44, delay: 42, d: true, t: true, m: false },
  { key: "flask", left: 72, top: 11, size: 34, rot: 5, op: 0.44, delay: 50, d: true, t: true, m: false },
  { key: "crescent", left: 22, top: 85, size: 34, rot: -12, op: 0.44, delay: 34, d: true, t: true, m: false },
  { key: "thought", left: 73, top: 85, size: 34, rot: 20, op: 0.44, delay: 4, d: true, t: true, m: false },
  { key: "infinity", left: 47, top: 48, size: 30, rot: 22, op: 0.38, delay: 58, d: true, t: true, m: false },

  // ── DESKTOP ONLY (fine atmosphere detail) ────────────────────────────────────────
  { key: "columns", left: 3, top: 30, size: 32, rot: 0, op: 0.40, delay: 38, d: true, t: false, m: false },
  { key: "lyre", left: 3, top: 66, size: 30, rot: -5, op: 0.40, delay: 62, d: true, t: false, m: false },
  { key: "gear", left: 91, top: 28, size: 32, rot: -25, op: 0.40, delay: 46, d: true, t: false, m: false },
  { key: "briefcase", left: 91, top: 65, size: 30, rot: 35, op: 0.40, delay: 20, d: true, t: false, m: false },
  { key: "scroll", left: 27, top: 48, size: 28, rot: -18, op: 0.36, delay: 16, d: true, t: false, m: false },
  { key: "chart", left: 68, top: 48, size: 28, rot: 8, op: 0.36, delay: 54, d: true, t: false, m: false },
  { key: "temple", left: 47, top: 68, size: 30, rot: 0, op: 0.36, delay: 10, d: true, t: false, m: false },
];

/* Fixed animation durations per slot index — no randomness */
const DURATIONS = [
  82, 95, 78, 110, 88, 102, 74, 96,
  115, 80, 92, 105, 72, 118, 86, 100, 76, 108, 84, 94,
];

/* ─────────────────────────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────────────────────────── */
function FloatingIcons() {
  const [bp, setBp] = React.useState(() => {
    if (typeof window === "undefined") return "desktop";
    if (window.innerWidth <= 480) return "mobile";
    if (window.innerWidth <= 768) return "tablet";
    return "desktop";
  });

  React.useEffect(() => {
    const q480 = window.matchMedia("(max-width: 480px)");
    const q768 = window.matchMedia("(max-width: 768px)");
    const update = () => {
      if (q480.matches) setBp("mobile");
      else if (q768.matches) setBp("tablet");
      else setBp("desktop");
    };
    q480.addEventListener("change", update);
    q768.addEventListener("change", update);
    return () => {
      q480.removeEventListener("change", update);
      q768.removeEventListener("change", update);
    };
  }, []);

  const visible = ICON_SLOTS.filter(s =>
    bp === "desktop" ? s.d : bp === "tablet" ? s.t : s.m
  );

  return (
    <div className="floating-icons-container" aria-hidden="true">
      {visible.map((slot, i) => (
        <div
          key={slot.key}
          className="floating-icon"
          style={{
            left: `${slot.left}%`,
            top: `${slot.top}%`,
            width: `${slot.size}px`,
            height: `${slot.size}px`,
            opacity: slot.op,           /* fixed — never changes */
            transform: `rotate(${slot.rot}deg)`,
            animationDuration: `${DURATIONS[i % DURATIONS.length]}s`,
            animationDelay: `-${slot.delay}s`, /* negative = start mid-cycle, no fade-in wait */
          }}
        >
          {ICONS[slot.key]}
        </div>
      ))}
    </div>
  );
}

export default FloatingIcons;
