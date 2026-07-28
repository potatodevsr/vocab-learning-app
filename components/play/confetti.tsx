const COLOURS = [
  "var(--brand)",
  "var(--accent-sun)",
  "var(--accent-mint)",
  "var(--accent-sky)",
  "var(--accent-bubble)",
];

/**
 * Deterministic spread via the golden ratio — varied to the eye, identical on every
 * render. No `Math.random()` (impure in render), no state, no effect.
 */
const GOLDEN = 0.6180339887;

const PIECES = Array.from({ length: 40 }, (_, index) => {
  const spread = ((index + 1) * GOLDEN) % 1;

  return {
    id: index,
    left: spread * 100,
    drift: (spread - 0.5) * 160,
    delay: ((index * 7) % 10) / 20,
    duration: 2 + (((index * 13) % 8) / 8) * 1.6,
    colour: COLOURS[index % COLOURS.length],
  };
});

/**
 * Celebrate at exactly one moment per session (SPEC §6.1). Pure CSS, so there is no
 * image payload and no animation library — and `prefers-reduced-motion` hides it
 * entirely via the stylesheet rather than via a JS branch.
 */
export function Confetti() {
  return (
    <div
      aria-hidden
      data-testid="confetti"
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {PIECES.map((piece) => (
        <span
          key={piece.id}
          className="play-confetti-piece"
          style={
            {
              left: `${piece.left}%`,
              background: piece.colour,
              animationDelay: `${piece.delay}s`,
              "--drift": `${piece.drift}px`,
              "--fall": `${piece.duration}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
