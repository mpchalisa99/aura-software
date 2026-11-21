import React, { useState } from 'react';
import {
  Activity,
  Award,
  CheckCircle2,
  Compass,
  Cpu,
  FileText,
  Lock,
  Radar,
  Scale,
  Shield,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { CalculationSummary, ProjectProfile, RegulationConfigPayload } from '../types/aura';
import { formatIDR, formatNumberID } from '../utils/formatters';

interface FinancialIntelligenceAgentPanelProps {
  profile: ProjectProfile;
  summary: CalculationSummary;
  regulationConfig: RegulationConfigPayload;
}

export const FinancialIntelligenceAgentPanel: React.FC<FinancialIntelligenceAgentPanelProps> = ({
  profile,
  summary,
  regulationConfig,
}) => {
  const [activeViewMode, setActiveViewMode] = useState<'summary' | 'breakdown' | 'regulations'>('summary');

  // Heuristic Baseline Valuation based on complexity & duration
  const complexityMultiplier =
    profile.complexity.startsWith('Rendah')
      ? 0.7
      : profile.complexity.startsWith('Menengah')
      ? 1.0
      : profile.complexity.startsWith('Tinggi')
      ? 1.45
      : 1.9;

  const baseHeuristicCost = profile.durationMonths * 45000000 * complexityMultiplier * profile.locationFactor * Math.max(1, (summary.totalPersonnelHeadcount || 10) / 10);
  const optimisticPlafon = Math.round(Math.min(summary.grandTotalEstimation, baseHeuristicCost * 0.88));
  const conservativePlafon = Math.round(Math.max(summary.grandTotalEstimation, baseHeuristicCost * 1.18));

  return (
    <section
      aria-label="Financial Intelligence and Defense Valuation Agent"
      className="hud-panel p-5 sm:p-6 space-y-5 border-2 border-cyan-400/35 bg-gradient-to-br from-[#040a17] via-[#071328] to-[#040812]"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-cyan-500/25">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-cyan-950/85 border border-cyan-400/50 text-cyan-300">
            <Scale className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-cyan-300">
              <span className="px-2 py-0.5 bg-cyan-950 border border-cyan-500/45 text-cyan-200">
                AI AGENT · INTELIJEN FINANSIAL &amp; VALUASI PERTAHANAN
              </span>
              <span aria-hidden="true">·</span>
              <span>RUJUKAN: {regulationConfig.version}</span>
            </div>
            <h3 className="text-lg font-display font-bold text-white mt-1">
              Baseline Estimate &amp; Plafon Biaya Pengadaan Perangkat Lunak
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setActiveViewMode('summary')}
            className={`px-3 py-1.5 border transition-all ${
              activeViewMode === 'summary'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                : 'bg-[#081326] text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10'
            }`}
          >
            Ringkasan Baseline
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode('breakdown')}
            className={`px-3 py-1.5 border transition-all ${
              activeViewMode === 'breakdown'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                : 'bg-[#081326] text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10'
            }`}
          >
            Matriks Kualifikasi
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode('regulations')}
            className={`px-3 py-1.5 border transition-all ${
              activeViewMode === 'regulations'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                : 'bg-[#081326] text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10'
            }`}
          >
            Rujukan Regulasi
          </button>
        </div>
      </div>

      {activeViewMode === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Optimistic Plafon */}
            <div className="bg-[#050e1f] p-4 border border-cyan-500/30 space-y-1">
              <span className="text-[10px] font-mono text-cyan-400 block">
                PLAFON OPTIMIS (EFISIENSI MAKSIMAL)
              </span>
              <div className="text-lg font-mono font-bold text-emerald-300">
                {formatIDR(optimisticPlafon)}
              </div>
              <p className="text-[11px] text-slate-400">
                Batas bawah estimasi berdasarkan rasio optimal tim ramping dan otomatisasi devops.
              </p>
            </div>

            {/* Current HPS Estimate */}
            <div className="bg-[#071630] p-4 border-2 border-amber-400/50 space-y-1 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <span className="text-[10px] font-mono text-amber-300 block">
                GRAND TOTAL ESTIMASI SAAT INI (HPS)
              </span>
              <div className="text-xl font-mono font-bold text-amber-300">
                {formatIDR(summary.grandTotalEstimation)}
              </div>
              <p className="text-[11px] text-cyan-200">
                Nilai aktif kertas kerja untuk proyek "{profile.projectName || 'Proyek Tanpa Nama'}".
              </p>
            </div>

            {/* Conservative Plafon */}
            <div className="bg-[#050e1f] p-4 border border-cyan-500/30 space-y-1">
              <span className="text-[10px] font-mono text-cyan-400 block">
                PLAFON KONSERVATIF (CADANGAN RISIKO)
              </span>
              <div className="text-lg font-mono font-bold text-cyan-300">
                {formatIDR(conservativePlafon)}
              </div>
              <p className="text-[11px] text-slate-400">
                Batas atas estimasi dengan cadangan mitigasi risiko operasional &amp; pengujian ketat.
              </p>
            </div>
          </div>

          <div className="bg-[#040a16] p-4 border border-cyan-500/20 text-xs text-slate-300 leading-relaxed space-y-2">
            <div className="flex items-center gap-2 font-mono text-cyan-300 font-semibold">
              <Radar className="w-4 h-4 text-amber-400 shrink-0" />
              <span>DIAGNOSA INTELIJEN KEUANGAN PERTAHANAN:</span>
            </div>
            <p>
              Proyek dengan skema <strong className="text-white">{profile.procurementScheme}</strong> dan tingkat kompleksitas <strong className="text-cyan-200">{profile.complexity}</strong> selama <strong className="text-white">{profile.durationMonths} bulan</strong> memerlukan total alokasi beban kerja yang proporsional. Rentang wajar pengadaan berkisar antara <strong className="text-emerald-300">{formatIDR(optimisticPlafon)}</strong> hingga <strong className="text-cyan-300">{formatIDR(conservativePlafon)}</strong>.
            </p>
          </div>
        </div>
      )}

      {activeViewMode === 'breakdown' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="bg-[#050d1d] p-4 border border-cyan-500/30 space-y-3">
            <h4 className="text-sm font-semibold text-amber-300 font-display">
              Matriks Kualifikasi &amp; Plafon Tarif Berdasarkan Durasi ({profile.durationMonths} Bulan)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-[#081326] border border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px]">Kualifikasi Junior / Pelaksana</span>
                <span className="text-cyan-200 font-bold">Rp 12.500.000 – Rp 16.000.000 / OB</span>
              </div>
              <div className="p-3 bg-[#081326] border border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px]">Kualifikasi Middle / Engineer</span>
                <span className="text-cyan-200 font-bold">Rp 17.500.000 – Rp 23.000.000 / OB</span>
              </div>
              <div className="p-3 bg-[#081326] border border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px]">Kualifikasi Senior / Architect</span>
                <span className="text-cyan-200 font-bold">Rp 25.000.000 – Rp 35.000.000 / OB</span>
              </div>
              <div className="p-3 bg-[#081326] border border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px]">Kualifikasi Lead / Principal</span>
                <span className="text-cyan-200 font-bold">Rp 38.000.000 – Rp 52.000.000 / OB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeViewMode === 'regulations' && (
        <div className="space-y-3 text-xs text-slate-300 font-mono">
          <div className="bg-[#050d1d] p-4 border border-cyan-500/30 space-y-2">
            <h4 className="text-sm font-semibold text-amber-300 font-display">
              Rujukan Regulasi Resmi Pengadaan &amp; Valuasi (2026)
            </h4>
            <ul className="list-disc list-inside space-y-1.5 text-slate-300">
              <li>
                <strong className="text-cyan-300">Perpres No. 12 Tahun 2021:</strong> Pengadaan Barang/Jasa Pemerintah — Penyusunan HPS berdasarkan harga pasar, standar biaya masukan, dan analisis beban kerja.
              </li>
              <li>
                <strong className="text-cyan-300">SBM Kemenkeu TA 2026:</strong> Standar Biaya Masukan Umum &amp; Khusus untuk honorarium tenaga ahli dan pengadaan sistem informasi.
              </li>
              <li>
                <strong className="text-cyan-300">Billing Rate INKINDO 2026:</strong> Acuan remunerasi minimum tenaga ahli konsultansi teknologi informasi dan sistem komunikasi pertahanan.
              </li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
