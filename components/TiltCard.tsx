"use client";

/**
 * Tilts gently towards the pointer in 3D. The angle is deliberately shallow -
 * big tilts look like a template, small ones feel like paper.
 */

import { useRef, useState, type ReactNode } from "react";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Maximum tilt in degrees. */
  maxDegrees?: number;
}

export default function TiltCard({ children, className = "", maxDegrees = 4 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    const node = ref.current;
    if (!node) return;

    const box = node.getBoundingClientRect();
    const percentX = (event.clientX - box.left) / box.width - 0.5;
    const percentY = (event.clientY - box.top) / box.height - 0.5;

    setActive(true);
    setTilt({
      x: -percentY * maxDegrees * 2,
      y: percentX * maxDegrees * 2,
    });
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={() => {
        setActive(false);
        setTilt({ x: 0, y: 0 });
      }}
      className={`tilt-3d transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${className}`}
      style={{
        transform: `perspective(1400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${active ? 1.006 : 1})`,
      }}
    >
      {children}
    </div>
  );
}
