"use client";

/**
 * Splits a heading into words that rise into place one after another.
 *
 * Screen readers still get the whole sentence: the container carries the real
 * text as its label and the animated words are hidden from assistive tech.
 */

interface SplitTextProps {
  text: string;
  className?: string;
  /** Wait before the first word, in milliseconds. */
  delay?: number;
  /** Gap between words, in milliseconds. */
  step?: number;
}

export default function SplitText({ text, className = "", delay = 0, step = 55 }: SplitTextProps) {
  const words = text.split(" ");

  return (
    <span className={`flex flex-wrap gap-x-[0.26em] ${className}`} aria-label={text}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden="true"
          className="inline-block overflow-hidden pb-[0.14em]"
        >
          <span
            className="inline-block animate-rise"
            style={{ animationDelay: `${delay + index * step}ms` }}
          >
            {word}
          </span>
        </span>
      ))}
    </span>
  );
}
