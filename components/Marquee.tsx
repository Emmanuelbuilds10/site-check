"use client";

/**
 * The ticker strip. It scrolls forever, pauses when you hover it, and fades
 * out at both ends so it reads as a continuous loop rather than a stray row.
 */

interface MarqueeProps {
  items: string[];
  /** Reverse the direction, for the second strip. */
  reverse?: boolean;
}

export default function Marquee({ items, reverse = false }: MarqueeProps) {
  // Doubling the list lets the animation slide exactly half its width and land
  // back where it started - a seamless loop.
  const doubled = [...items, ...items];

  return (
    <div className="marquee-mask group overflow-hidden border-y border-line bg-paper-2/70 py-3">
      <div
        className="flex w-max animate-marquee items-center group-hover:[animation-play-state:paused]"
        style={reverse ? { animationDirection: "reverse" } : undefined}
      >
        {doubled.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex items-center font-mono text-[11px] uppercase tracking-[0.22em] text-ink-faint"
          >
            {item}
            <span aria-hidden="true" className="mx-5 text-[13px] text-line-strong">
              ✳
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
