import React, { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ClipboardCopy,
  Copy,
  FolderOpen,
  PlusCircle,
  Search,
  Trash2,
} from 'lucide-react';
import { SavedSimulation } from '../types/aura';
import {
  formatIDR,
  formatNumberID,
  formatTimestampID,
  generateClipboardReport,
} from '../utils/formatters';

interface HistoryTabProps {
  simulations: SavedSimulation[];
  onLoadSimulation: (sim: SavedSimulation) => void;
  onDeleteSimulation: (id: string) => void;
  onDuplicateSimulation: (sim: SavedSimulation) => void;
  onSaveCurrentSnapshot: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({
  simulations,
  onLoadSimulation,
  onDeleteSimulation,
  onDuplicateSimulation,
  onSaveCurrentSnapshot,
}) => {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = simulations.filter(
    (s) =>
      s.profile.projectName.toLowerCase().includes(query.toLowerCase()) ||
      s.profile.proposingUnit.toLowerCase().includes(query.toLowerCase()) ||
      s.profile.procurementScheme.toLowerCase().includes(query.toLowerCase())
  );

  const handleCopySimReport = async (sim: SavedSimulation) => {
    const text = generateClipboardReport(
      sim.profile,
      sim.personnelItems,
      sim.nonPersonnelItems,
      sim.financials,
      sim.summary,
      sim.regulationVersion
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(sim.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback handled silently
    }
  };

  return (
    <div className="space-y-6">
      <section className="hud-panel p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-cyan-500/20">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <span>ARSIP LOKAL KERTAS KERJA &amp; SIMULASI ANGGARAN</span>
              <span aria-hidden="true">·</span>
              <span>TOTAL: {simulations.length} SIMULASI</span>
            </div>
            <h2 className="text-xl font-display font-semibold text-white mt-1">
              Riwayat Simulasi HPS / RAB Tersimpan
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama proyek atau satker..."
                className="pl-8 pr-3 py-2 text-xs bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="button"
              onClick={onSaveCurrentSnapshot}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Simpan Proyek Aktif Sekarang</span>
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <FolderOpen className="w-10 h-10 text-cyan-400/50 mx-auto" />
            <h3 className="text-base font-display font-semibold text-white">
              Belum Ada Simulasi Tersimpan yang Cocok
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Simpan perhitungan proyek aktif Anda untuk membandingkan beberapa skenario HPS/RAB (misalnya skema Swakelola vs Tender Badan Usaha).
            </p>
            <button
              type="button"
              onClick={onSaveCurrentSnapshot}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Simpan Simulasi Pertama</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/90 mt-4">
            {filtered.map((sim) => (
              <div
                key={sim.id}
                className="py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#08152b]/60 px-3 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-cyan-400">
                    <span>{formatTimestampID(sim.savedAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{sim.profile.fiscalYear}</span>
                    <span aria-hidden="true">·</span>
                    <span>Regulasi: {sim.regulationVersion}</span>
                  </div>
                  <h3 className="text-base font-display font-semibold text-white">
                    {sim.profile.projectName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span>Satker: {sim.profile.proposingUnit}</span>
                    <span aria-hidden="true">·</span>
                    <span>{sim.profile.procurementScheme}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {formatNumberID(sim.summary.totalManMonths, 1)} OB ({sim.summary.activeRolesCount} Peran)
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                  <div className="text-left sm:text-right font-mono">
                    <span className="block text-[11px] text-slate-400">
                      Grand Total Estimasi (Termasuk PPN {sim.financials.ppnPercent}%)
                    </span>
                    <span className="text-lg font-bold text-cyan-300">
                      {formatIDR(sim.summary.grandTotalEstimation)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onLoadSimulation(sim)}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Muat ke Kalkulator</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopySimReport(sim)}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-medium bg-[#0e2040] hover:bg-[#152d59] text-cyan-200 border border-cyan-500/30 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedId === sim.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <ClipboardCopy className="w-3.5 h-3.5" />
                          <span>Salin Teks</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDuplicateSimulation(sim)}
                      title="Duplikasi skenario"
                      className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteSimulation(sim.id)}
                      title="Hapus simulasi"
                      className="p-2 text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
