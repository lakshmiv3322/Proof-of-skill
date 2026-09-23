import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

// ─────────────────────────────────────────────────────────────
// QRCodeSVG — Real QR Code generator powered by `qrcode`
// Generates standard scannable QR matrices with Reed-Solomon ECC.
// ─────────────────────────────────────────────────────────────

interface QRCodeSVGProps {
  value: string;
  size?: number;
  className?: string;
  fgColor?: string;
  bgColor?: string;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
}

export function QRCodeSVG({
  value,
  size = 128,
  className = '',
  fgColor = 'currentColor',
  bgColor = 'transparent',
  level = 'M',
  includeMargin = false,
}: QRCodeSVGProps) {
  const [matrixData, setMatrixData] = useState<{ qrSize: number; data: Uint8Array } | null>(null);

  useEffect(() => {
    try {
      const qr = QRCode.create(value || 'https://proofofskill.com', { errorCorrectionLevel: level });
      const qrSize = qr.modules.size;
      const data = qr.modules.data;
      setMatrixData({ qrSize, data });
    } catch (err) {
      console.error('[QRCodeSVG] Error generating QR code matrix:', err);
    }
  }, [value, level]);

  if (!matrixData) {
    return <div style={{ width: size, height: size }} className={className} />;
  }

  const { qrSize, data } = matrixData;
  const margin = includeMargin ? 2 : 0;
  const totalSize = qrSize + margin * 2;
  const cellSize = size / totalSize;

  const rects: React.ReactNode[] = [];
  for (let r = 0; r < qrSize; r++) {
    for (let c = 0; c < qrSize; c++) {
      if (data[r * qrSize + c]) {
        rects.push(
          <rect
            key={`${r}-${c}`}
            x={(c + margin) * cellSize}
            y={(r + margin) * cellSize}
            width={cellSize + 0.03}
            height={cellSize + 0.03}
            fill={fgColor}
          />
        );
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      shapeRendering="crispEdges"
      aria-label={`QR code for ${value}`}
    >
      {bgColor !== 'transparent' && (
        <rect width={size} height={size} fill={bgColor} />
      )}
      {rects}
    </svg>
  );
}
