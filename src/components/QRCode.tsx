"use client";

import { QRCodeSVG } from "qrcode.react";

interface QRCodeDisplayProps {
  gameId: string;
}

export default function QRCodeDisplay({ gameId }: QRCodeDisplayProps) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/play?code=${gameId}`
      : "";

  if (!url) return null;

  return (
    <div className="flex flex-col items-center">
      <div className="bg-white p-3 rounded-lg border border-border">
        <QRCodeSVG value={url} size={180} />
      </div>
      <p className="text-text-tertiary text-xs mt-2">
        Scan to join or go to{" "}
        <span className="text-text-secondary">/play</span>
      </p>
    </div>
  );
}
