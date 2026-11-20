import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  QrCode,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';

export const DEFAULT_SHARED_APP_URL =
  'https://ais-pre-4uivl2t2ranto22qtt7psw-981979405090.asia-southeast1.run.app';

interface ShareBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  grandTotalFormatted: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const ShareBarcodeModal: React.FC<ShareBarcodeModalProps> = ({
  isOpen,
  onClose,
  projectName,
  grandTotalFormatted,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [shareUrl, setShareUrl] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      // Prefer the shared public app URL if running inside dev preview, otherwise use active origin
      if (window.location.origin.includes('ais-dev-')) {
        return DEFAULT_SHARED_APP_URL;
      }
      return window.location.origin;
    }
    return DEFAULT_SHARED_APP_URL;
  });

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const generateQr = async () => {
      try {
        const target = shareUrl.trim() || DEFAULT_SHARED_APP_URL;
        const url = await QRCode.toDataURL(target, {
          width: 320,
          margin: 2,
          color: {
            dark: '#040812',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'H',
        });
        if (active) setQrDataUrl(url);
      } catch {
        // Ignore generation error
      }
    };
    generateQr();
    return () => {
      active = false;
    };
  }, [shareUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      setShareFeedback('Salin manual dari kotak URL di atas.');
    }
  };

  const handleNativeShare = async () => {
    const shareData = {
      title: 'AURA-SOFTWARE — Aplikasi Ukur Regulasi & Anggaran Software TNI AU',
      text: `AURA-SOFTWARE (TNI AU) — Estimasi HPS/RAB "${projectName}" (${grandTotalFormatted}). Akses aplikasi:`,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        setShareFeedback('Berhasil dibagikan melalui menu perangkat.');
        setTimeout(() => setShareFeedback(null), 3000);
        return;
      } catch {
        // User cancelled or share not permitted in iframe, fallback to copy
      }
    }
    await handleCopyUrl();
    setShareFeedback('Link aplikasi telah disalin ke Clipboard untuk dibagikan.');
    setTimeout(() => setShareFeedback(null), 3000);
  };

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = 'barcode-qr-aura-software-tniau.png';
    link.click();
  };

  // Deterministic 1D military barcode bar widths
  const barcodePattern = [
    3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 2, 3, 1, 1, 2, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 3,
    2, 1, 2, 1, 1, 3, 2, 1, 2, 3,
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-barcode-title"
    >
      <div className="hud-command-crest w-full max-w-2xl bg-[#071124] border border-amber-400/40 p-4 sm:p-6 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-amber-400/25">
          <div>
            <p className="text-[11px] font-mono text-amber-400 tracking-wider">
              AURA TELEMETRY · AKSES MULTI-PERANGKAT &amp; BARCODE APLIKASI
            </p>
            <h2
              id="share-barcode-title"
              className="text-base sm:text-lg font-display font-bold text-white mt-0.5"
            >
              QR Barcode, Share Link &amp; Mode Layar Penuh
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
            aria-label="Tutup dialog bagikan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 py-5 items-center">
          {/* Left: 2D QR Code + 1D Military Barcode Card */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="bg-white p-3.5 border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.28)] w-full max-w-[230px] flex flex-col items-center">
              <div className="w-full flex items-center justify-between text-[10px] font-mono font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2">
                <span>TNI AU · AURA-SW</span>
                <span>SCAN ACCESS</span>
              </div>

              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Barcode Aplikasi AURA-SOFTWARE"
                  className="w-44 h-44 object-contain"
                />
              ) : (
                <div className="w-44 h-44 flex items-center justify-center bg-slate-100 text-slate-500 text-xs font-mono">
                  Membuat QR...
                </div>
              )}

              {/* 1D Linear Barcode SVG */}
              <div className="w-full mt-2 pt-2 border-t border-slate-300 flex flex-col items-center">
                <svg
                  viewBox="0 0 160 28"
                  className="w-full h-7"
                  aria-label="Barcode Garis Militer AURA-SOFTWARE"
                >
                  {(() => {
                    let x = 4;
                    return barcodePattern.map((w, idx) => {
                      const currentX = x;
                      x += w * 1.9;
                      if (idx % 2 === 1) return null;
                      return (
                        <rect
                          key={idx}
                          x={currentX}
                          y={0}
                          width={w * 1.5}
                          height={26}
                          fill="#040812"
                        />
                      );
                    });
                  })()}
                </svg>
                <span className="text-[10px] font-mono font-semibold tracking-widest text-slate-800 mt-0.5">
                  *AURA-TNIAU-2026*
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadQrPng}
              className="mt-3 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Gambar QR Barcode</span>
            </button>
          </div>

          {/* Right: Share Link & Multi-Device Fullscreen Controls */}
          <div className="md:col-span-7 space-y-4">
            <div>
              <label
                htmlFor="app-share-url-input"
                className="block text-xs font-medium text-amber-300 mb-1.5"
              >
                Link Akses Aplikasi (Android, iPhone, Tablet &amp; Komputer)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="app-share-url-input"
                  type="url"
                  value={shareUrl}
                  onChange={(e) => setShareUrl(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-[#040914] border border-cyan-400/40 text-cyan-100 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Link Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Link</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Pindai QR Barcode menggunakan kamera HP Android / iPhone atau salin tautan di atas untuk membuka kalkulator AURA-SOFTWARE.
              </p>
            </div>

            {/* Quick Share & Open Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Bagikan Link Aplikasi</span>
              </button>

              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0d1f3d] hover:bg-[#142e59] text-cyan-200 border border-cyan-400/35 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka di Tab Baru</span>
              </a>

              <button
                type="button"
                onClick={onToggleFullscreen}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#0d1f3d] hover:bg-[#142e59] text-amber-200 border border-amber-400/35 transition-colors whitespace-nowrap"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Keluar Layar Penuh</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Mode Fullscreen</span>
                  </>
                )}
              </button>
            </div>

            {shareFeedback && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-400/40 text-xs font-mono text-emerald-300">
                {shareFeedback}
              </div>
            )}

            {/* Multi-device compatibility card */}
            <div className="bg-[#040914] border border-cyan-500/25 p-3.5 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 font-mono text-cyan-300 font-semibold">
                <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                <span>OPTIMASI LAYAR PENUH MULTI-PERANGKAT AKTIF</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Antarmuka telah disesuaikan secara otomatis (*Responsive Fluid Fullscreen*) untuk layar **HP Android**, **iPhone (iOS Safe-Area)**, **Tablet / iPad**, dan **Monitor Komputer Widescreen**.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
