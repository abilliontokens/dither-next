"use client";

import { useEffect, useState } from "react";

import { cn } from "./lib";
import styles from "./DitherAsciiText.module.css";

const RAMP = " .:-=+*#%@";

export interface DitherAsciiTextProps {
  text?: string;
  cols?: number;
  className?: string;
}

export function DitherAsciiText({
  text = "DITHER",
  cols = 64,
  className,
}: DitherAsciiTextProps) {
  const [art, setArt] = useState("");

  useEffect(() => {
    const build = () => {
      const cvs = document.createElement("canvas");
      const ctx = cvs.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const colCount = Math.max(8, Math.min(200, Math.round(cols)));
      const fontPx = 80;
      const font = `bold ${fontPx}px ui-monospace, "SFMono-Regular", monospace`;
      ctx.font = font;
      const w = Math.max(1, Math.ceil(ctx.measureText(text).width));
      const h = Math.ceil(fontPx * 1.25);
      cvs.width = w;
      cvs.height = h;
      ctx.font = font;
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.clearRect(0, 0, w, h);
      ctx.fillText(text, 0, h / 2);
      const cellW = w / colCount;
      const rows = Math.max(3, Math.round(h / (cellW * 1.9)));
      const cellH = h / rows;
      const data = ctx.getImageData(0, 0, w, h).data;
      let out = "";
      for (let ry = 0; ry < rows; ry++) {
        let line = "";
        for (let cx = 0; cx < colCount; cx++) {
          const px = Math.min(w - 1, Math.floor((cx + 0.5) * cellW));
          const py = Math.min(h - 1, Math.floor((ry + 0.5) * cellH));
          const a = data[(py * w + px) * 4 + 3] / 255;
          line += RAMP[Math.min(RAMP.length - 1, Math.floor(a * RAMP.length))];
        }
        out += `${line}\n`;
      }
      setArt(out);
    };
    build();
  }, [text, cols]);

  return (
    <pre
      className={cn(
        styles.ditherAscii,
        "font-mono leading-[0.85] text-[7px]",
        className,
      )}
      aria-label={text}
    >
      {art}
    </pre>
  );
}
