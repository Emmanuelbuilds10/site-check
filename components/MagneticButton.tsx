"use client";

/**
 * A button that leans towards the pointer, with a light sweep across it.
 * The pull is small on purpose - enough to feel alive, not enough to annoy.
 */

import { useRef, useState, type ReactNode } from "react";

interface MagneticButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  /** How far the button may lean, in pixels. */
  strength?: number;
  /** Show the moving highlight. Skip it for quiet buttons. */
  sheen?: boolean;
}

export default function MagneticButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  className = "",
  strength = 9,
  sheen = false,
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  function handleMove(event: React.PointerEvent<HTMLButtonElement>) {
    const node = ref.current;
    if (!node || disabled) return;

    const box = node.getBoundingClientRect();
    const relativeX = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
    const relativeY = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);

    setOffset({
      x: Math.max(-1, Math.min(1, relativeX)) * strength,
      y: Math.max(-1, Math.min(1, relativeY)) * strength,
    });
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      onPointerMove={handleMove}
      onPointerLeave={() => setOffset({ x: 0, y: 0 })}
      className={`group relative overflow-hidden transition-[transform,background-color,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
    >
      {sheen && !disabled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-sheen bg-white/25 blur-md"
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}
