"use client";

/**
 * Two things follow the pointer:
 *  - a big soft glow, trailing slowly (it reads as light, not as a cursor)
 *  - a small ring, trailing quickly, which grows over anything clickable
 *
 * It only runs for real pointers (mouse or trackpad) and switches itself off
 * for touch screens and for visitors who asked for reduced motion. Everything
 * is written to `transform` inside one animation frame, so it stays cheap.
 */

import { useEffect, useRef } from "react";

export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = window.matchMedia("(pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || calm.matches) return;

    const glow = glowRef.current;
    const ring = ringRef.current;
    if (!glow || !ring) return;

    // Where the pointer is, and where the two layers currently are.
    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const glowAt = { ...pointer };
    const ringAt = { ...pointer };
    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;

      glow.style.opacity = "0.16";
      ring.style.opacity = "1";

      // Grow the ring over anything interactive.
      const target = event.target as HTMLElement | null;
      const interactive = target?.closest?.("a, button, input, [data-magnetic]");
      ring.dataset.hover = interactive ? "true" : "false";
    };

    const onPointerLeave = () => {
      glow.style.opacity = "0";
      ring.style.opacity = "0";
    };

    const tick = () => {
      // Different easing per layer: the glow drifts, the ring keeps up.
      glowAt.x += (pointer.x - glowAt.x) * 0.07;
      glowAt.y += (pointer.y - glowAt.y) * 0.07;
      ringAt.x += (pointer.x - ringAt.x) * 0.22;
      ringAt.y += (pointer.y - ringAt.y) * 0.22;

      glow.style.transform = `translate3d(${glowAt.x}px, ${glowAt.y}px, 0)`;
      ring.style.transform = `translate3d(${ringAt.x}px, ${ringAt.y}px, 0)`;

      frame = requestAnimationFrame(tick);
    };

    // Start hidden so nothing sits in the middle of the page before the first move.
    glow.style.opacity = "0";
    ring.style.opacity = "0";

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    frame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div ref={glowRef} className="pointer-glow" aria-hidden="true" />
      <div ref={ringRef} className="pointer-ring" aria-hidden="true" />
    </>
  );
}
