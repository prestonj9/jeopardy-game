"use client";

import { QRCodeSVG } from "qrcode.react";
import ShareableLink from "./ShareableLink";

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

      {/* Shareable link with copy button */}
      <div className="mt-3">
        <ShareableLink url={url} />
      </div>
    </div>
  );
}
