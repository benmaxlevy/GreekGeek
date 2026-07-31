import type { CSSProperties } from "react";
import { Wordmark } from "@/components/brand/Wordmark";

export interface BrandLockupProps {
  markSize?: number;
  textSize?: number | string;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}

/** The only approved Rally lockup: fixed seal plus tracked RALLY wordtext. */
export function BrandLockup({
  markSize = 40,
  textSize = 15,
  gap = 10,
  className,
  style,
}: BrandLockupProps) {
  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap, lineHeight: 1, ...style }}
    >
      <Wordmark size={markSize} />
      <span
        className="rally-brand-caps"
        style={{
          fontSize: textSize,
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#ffffff",
        }}
      >
        Rally
      </span>
    </span>
  );
}
