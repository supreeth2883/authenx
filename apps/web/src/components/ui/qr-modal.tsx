"use client";

import { QRCodeSVG } from "qrcode.react";
import { Modal } from "./modal";
import { Button } from "./form";

interface QrModalProps {
  open: boolean;
  onClose: () => void;
  credentialId: string;
  credentialName?: string;
}

function getVerifyUrl(credentialId: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/employer/verify/${credentialId}`;
}

export function QrModal({ open, onClose, credentialId, credentialName }: QrModalProps) {
  const url = getVerifyUrl(credentialId);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
  };

  const handleDownload = () => {
    const svg = document.querySelector("#qr-modal-svg svg") as SVGSVGElement | null;
    if (!svg) return;

    const canvas = document.createElement("canvas");
    const size = 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(svgUrl);
      const link = document.createElement("a");
      link.download = `credential-${credentialId.slice(0, 8)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = svgUrl;
  };

  return (
    <Modal open={open} onClose={onClose} title="Verify Credential" subtitle={credentialName}>
      <div className="flex justify-center mb-6" id="qr-modal-svg">
        <div className="p-4 bg-white rounded-2xl">
          <QRCodeSVG value={url} size={200} level="M" includeMargin />
        </div>
      </div>
      <p className="text-xs text-center font-mono text-slate-400 dark:text-slate-500 break-all mb-4">
        {credentialId}
      </p>
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={handleCopy}>
          Copy Link
        </Button>
        <Button variant="secondary" className="flex-1" onClick={handleDownload}>
          Download PNG
        </Button>
        <Button variant="primary" className="flex-1" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
