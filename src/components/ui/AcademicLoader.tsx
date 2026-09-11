import React, { useEffect, useState } from "react";

/**
 * Delays showing a loader so operations that finish quickly (<~250ms)
 * never flash an animation at all.
 */
export function useDelayedVisible(delay = 250): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  return visible;
}

/**
 * AcademicOS branded micro-loader: three paper/evidence pieces stack neatly
 * once, then the academic seal (graduation cap) appears above the stack and
 * idles with a calm opacity pulse. CSS-driven (transform + opacity only),
 * respects prefers-reduced-motion, appears only after `delay` ms.
 *
 * size: 16 (in-button) … 64 (main region max). Design is authored on a
 * 48x48 stage and scaled with a transform.
 */
export function AcademicLoader({
  size = 32,
  label,
  delay = 250,
  className = "",
}: {
  size?: number;
  label: string;
  delay?: number;
  className?: string;
}) {
  const visible = useDelayedVisible(delay);
  return (
    <span
      role="status"
      className={`acad-loader ${visible ? "is-visible" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="acad-loader__stage" style={{ transform: `scale(${size / 48})` }}>
        <span className="acad-loader__paper acad-loader__p1" />
        <span className="acad-loader__paper acad-loader__p2" />
        <span className="acad-loader__paper acad-loader__p3" />
        <span className="acad-loader__cap" />
      </span>
    </span>
  );
}
