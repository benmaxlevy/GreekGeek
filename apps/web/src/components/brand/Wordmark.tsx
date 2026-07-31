import type { CSSProperties } from "react";

export interface WordmarkProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

/** Rally's fixed monochrome seal. School colors never tint this mark. */
export function Wordmark({ size = 40, color = "#e8e5dc", style }: WordmarkProps) {
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center"
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "radial-gradient(circle at 50% 44%, #211f1c 0%, #171613 56%, #090909 100%)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.035), 0 0 0 1px rgba(0,0,0,0.72), 0 8px 24px rgba(0,0,0,0.28)",
        ...style,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: Math.max(2, Math.round(size * 0.07)),
          borderRadius: "50%",
          border: "1px dashed rgba(232,229,220,0.42)",
        }}
      />
      <span
        style={{
          position: "relative",
          fontFamily: "var(--font-sans), 'Instrument Sans', Arial, sans-serif",
          fontSize: Math.round(size * 0.44),
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.055em",
          color,
          textShadow: "0 1px 0 rgba(255,255,255,0.04)",
          transform: "scaleX(0.82)",
        }}
      >
        R
      </span>
    </span>
  );
}
