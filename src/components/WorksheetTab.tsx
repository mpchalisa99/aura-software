import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Download,
  FileCode2,
  FileText,
  Printer,
  Save,
  Upload,
} from 'lucide-react';
import {
  CalculationSummary,
  FinancialParameters,
  NonPersonnelCostItem,
  PersonnelAllocationItem,
  ProjectProfile,
} from '../types/aura';
import {
  formatIDR,
  formatNumberID,
  formatTimestampID,
  generateClipboardReport,
} from '../utils/formatters';

interface WorksheetTabProps {
  profile: ProjectProfile;
  personnelItems: PersonnelAllocationItem[];
  nonPersonnelItems: NonPersonnelCostItem[];
  financials: FinancialParameters;
  summary: CalculationSummary;
  regulationVersion: string;
  lastUpdated: string;
  onSaveSimulation: () => void;
  onImportProjectData: (data: {
    profile: ProjectProfile;
    personnelItems: PersonnelAllocationItem[];
    nonPersonnelItems: NonPersonnelCostItem[];
    financials: FinancialParameters;
  }) => void;
}

export const WorksheetTab: React.FC<WorksheetTabProps> = ({
  profile,
  personnelItems,
  nonPersonnelItems,
  financials,
  summary,
  regulationVersion,
  lastUpdated,
  onSaveSimulation,
  onImportProjectData,
}) => {
  const [copiedClipboard, setCopiedClipboard] = useState(false);
  const [savedHistory, setSavedHistory] = useState(false);
  const [showTextPreview, setShowTextPreview] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reportText = generateClipboardReport(
    profile,
    personnelItems,
    nonPersonnelItems,
    financials,
    summary,
    regulationVersion
  );

  const handleCopyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopiedClipboard(true);
      setTimeout(() => setCopiedClipboard(false), 2500);
    } catch {
      setShowTextPreview(true);
    }
  };

  const handleSaveToLocalHistory = () => {
    onSaveSimulation();
    setSavedHistory(true);
    setTimeout(() => setSavedHistory(false), 2200);
  };

  const handleExportProjectJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      regulationVersion,
      profile,
      personnelItems,
      nonPersonnelItems,
      financials,
      summary,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = profile.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.href = url;
    link.download = `aura-hps-${safeName || 'proyek'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const rows: string[][] = [
      ['KERTAS KERJA ESTIMASI HARGA PERANGKAT LUNAK (HPS / RAB) - AURA-SOFTWARE'],
      ['Nama Proyek', profile.projectName],
      ['Satuan Kerja', profile.proposingUnit],
      ['Tahun Anggaran', profile.fiscalYear],
      ['Skema Pengadaan', profile.procurementScheme],
      ['Kompleksitas', profile.complexity],
      ['Durasi (Bulan)', String(profile.durationMonths)],
      ['Versi Regulasi', regulationVersion],
      [],
      ['I. BIAYA LANGSUNG PERSONEL (MAN-MONTH / OB)'],
      ['No', 'Peran Tenaga Ahli', 'Kualifikasi', 'Jml Orang', 'Durasi (Bln)', 'Volume (OB)', 'Tarif Satuan (Rp)', 'Status Tarif', 'Subtotal (Rp)'],
    ];

    personnelItems.forEach((item, index) => {
      const effectiveStandard = Math.round(item.standardRate * profile.locationFactor);
      const isOverride = item.overrideRate !== null;
      const activeRate = isOverride ? item.overrideRate! : effectiveStandard;
      const mm = item.headcount * item.durationMonths;
      rows.push([
        String(index + 1),
        item.roleName,
        item.tier,
        String(item.headcount),
        String(item.durationMonths),
        String(mm),
        String(activeRate),
        isOverride ? 'Override Proyek' : 'Standar Regulasi',
        String(mm * activeRate),
      ]);
    });

    rows.push(['', 'TOTAL BIAYA LANGSUNG PERSONEL', '', String(summary.totalPersonnelHeadcount), '', String(summary.totalManMonths), '', '', String(summary.totalPersonnelCost)]);
    rows.push([]);
    rows.push(['II. BIAYA LANGSUNG NON-PERSONEL']);
    rows.push(['No', 'Kategori', 'Uraian Komponen', 'Volume', 'Satuan', 'Harga Satuan (Rp)', 'Subtotal (Rp)']);

    nonPersonnelItems.forEach((np, index) => {
      rows.push([
        String(index + 1),
        np.category,
        np.itemName,
        String(np.quantity),
        np.unit,
        String(np.unitPrice),
        String(np.quantity * np.unitPrice),
      ]);
    });

    rows.push(['', 'TOTAL BIAYA LANGSUNG NON-PERSONEL', '', '', '', '', String(summary.totalNonPersonnelCost)]);
    rows.push([]);
    rows.push(['III. REKAPITULASI HPS / RAB']);
    rows.push(['1. Subtotal Biaya Langsung', String(summary.directCostSubtotal)]);
    rows.push([`2. Overhead & Keuntungan Wajar (${financials.overheadAndProfitPercent}%)`, String(summary.overheadAndProfitValue)]);
    rows.push(['3. Harga Sebelum Pajak (DPP)', String(summary.dppBeforeTax)]);
    rows.push([`4. Nilai PPN (${financials.ppnPercent}%)`, String(summary.ppnValue)]);
    rows.push(['5. GRAND TOTAL ESTIMASI (HPS / RAB)', String(summary.grandTotalEstimation)]);

    const csvContent = rows
      .map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kertas-kerja-hps-aura.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.profile || !Array.isArray(parsed.personnelItems) || !Array.isArray(parsed.nonPersonnelItems)) {
          setImportError('File JSON tidak memiliki struktur proyek AURA-SOFTWARE yang valid.');
          return;
        }
        onImportProjectData({
          profile: parsed.profile,
          personnelItems: parsed.personnelItems,
          nonPersonnelItems: parsed.nonPersonnelItems,
          financials: parsed.financials || financials,
        });
      } catch {
        setImportError('Gagal membaca file JSON proyek.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const personnelPercentage =
    summary.directCostSubtotal > 0
      ? (summary.totalPersonnelCost / summary.directCostSubtotal) * 100
      : 0;
  const nonPersonnelPercentage =
    summary.directCostSubtotal > 0
      ? (summary.totalNonPersonnelCost / summary.directCostSubtotal) * 100
      : 0;

  return (
    <div className="space-y-7">
      {/* Action Command Bar */}
      <section className="hud-panel p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <span>DOKUMEN KERTAS KERJA HPS / RAB</span>
            <span aria-hidden="true">·</span>
            <span>RUJUKAN: {regulationVersion}</span>
          </div>
          <h2 className="text-xl font-display font-semibold text-white mt-0.5">
            Rincian Kertas Kerja Penilaian Harga Perangkat Lunak
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyClipboard}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
          >
            {copiedClipboard ? (
              <>
                <Check className="w-4 h-4" />
                <span>Tersalin ke Clipboard</span>
              </>
            ) : (
              <>
                <ClipboardCopy className="w-4 h-4" />
                <span>Salin Ringkasan (Clipboard)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowTextPreview((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0e2040] hover:bg-[#152d59] text-cyan-200 border border-cyan-500/30 transition-colors whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{showTextPreview ? 'Tutup Teks' : 'Lihat Teks Terstruktur'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToLocalHistory}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0e2040] hover:bg-[#152d59] text-slate-200 border border-cyan-500/30 transition-colors whitespace-nowrap shrink-0"
          >
            {savedHistory ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tersimpan</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Lokal</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0e2040] hover:bg-[#152d59] text-slate-200 border border-cyan-500/30 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportProjectJson}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0e2040] hover:bg-[#152d59] text-slate-200 border border-cyan-500/30 transition-colors whitespace-nowrap shrink-0"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Ekspor JSON</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Muat JSON</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFileChange}
            className="hidden"
          />
        </div>
      </section>

      {importError && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 font-mono">
          {importError}
        </div>
      )}

      {showTextPreview && (
        <section className="hud-panel p-5 no-print">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
            <span className="text-xs font-mono text-cyan-300">
              PRATINJAU TEKS TERSTRUKTUR (FORMAT CLIPBOARD)
            </span>
            <button
              type="button"
              onClick={handleCopyClipboard}
              className="px-3 py-1 text-xs font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/30"
            >
              Salin Sekarang
            </button>
          </div>
          <pre className="mt-3 p-4 bg-[#040914] border border-slate-800 text-xs font-mono text-cyan-100 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {reportText}
          </pre>
        </section>
      )}

      {/* Military Monitor Document Sheet */}
      <section className="hud-panel p-6 space-y-7">
        {/* Document Metadata Header with Top-Left TNI AU Emblem & Top-Right Petir Emblem */}
        <div className="border-b border-amber-400/35 pb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-amber-400 bg-black overflow-hidden shrink-0 shadow-[0_0_16px_rgba(245,158,11,0.35)]">
              <img
                src="/assets/aistudio/1792503945296_954409ac.jpg"
                alt="Logo TNI Angkatan Udara"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-mono text-amber-400 tracking-wider">
                MARKAS BESAR TNI ANGKATAN UDARA · KERTAS KERJA ANALISIS ANGGARAN TI
              </p>
              <h3 className="text-2xl font-display font-bold text-white mt-1">
                {profile.projectName || 'Proyek Pengembangan Perangkat Lunak'}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 mt-1.5">
                <span>Satker: {profile.proposingUnit}</span>
                <span aria-hidden="true">·</span>
                <span>Tahun Anggaran: {profile.fiscalYear}</span>
                <span aria-hidden="true">·</span>
                <span>Durasi: {profile.durationMonths} Bulan</span>
                <span aria-hidden="true">·</span>
                <span>Indeks Lokasi: {profile.locationFactor.toFixed(2)}x</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0">
            <div className="text-left lg:text-right font-mono text-xs space-y-1 bg-[#061020] p-3.5 border border-amber-400/30">
              <div className="text-slate-400">
                Skema: <span className="text-slate-200">{profile.procurementScheme}</span>
              </div>
              <div className="text-slate-400">
                Kompleksitas: <span className="text-amber-300">{profile.complexity}</span>
              </div>
              <div className="text-slate-400">
                Pembaruan Tarif: <span className="text-slate-300">{formatTimestampID(lastUpdated)}</span>
              </div>
            </div>

            <div className="w-16 h-16 rounded-full border-2 border-amber-400 bg-black overflow-hidden shrink-0 shadow-[0_0_16px_rgba(245,158,11,0.35)]">
              <img
                src="/assets/aistudio/1794962413180_09546ffa.png"
                alt="Logo Petir Korps Elektronika TNI AU"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover scale-[1.14]"
              />
            </div>
          </div>
        </div>

        {/* Table I: Biaya Langsung Personel */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-mono font-semibold text-cyan-300 tracking-wide">
              BAGIAN I — RINCIAN BIAYA LANGSUNG PERSONEL (MAN-MONTH / ORANG-BULAN)
            </h4>
            <span className="text-xs font-mono text-slate-400">
              Proporsi: {personnelPercentage.toFixed(1)}% dari Biaya Langsung
            </span>
          </div>

          <div className="overflow-x-auto border border-cyan-500/25">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#050e1d] border-b border-cyan-500/30 text-[11px] font-mono text-cyan-300">
                  <th className="py-2.5 px-3 w-12">No</th>
                  <th className="py-2.5 px-3">Uraian Peran Tenaga Ahli &amp; Lingkup Tugas</th>
                  <th className="py-2.5 px-3">Kualifikasi</th>
                  <th className="py-2.5 px-3 text-right">Personel</th>
                  <th className="py-2.5 px-3 text-right">Durasi</th>
                  <th className="py-2.5 px-3 text-right">Volume (OB)</th>
                  <th className="py-2.5 px-3 text-right">Harga Satuan (Rp/OB)</th>
                  <th className="py-2.5 px-3 text-right">Jumlah Harga (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {personnelItems.map((item, idx) => {
                  const effectiveStandard = Math.round(item.standardRate * profile.locationFactor);
                  const isOverride = item.overrideRate !== null;
                  const activeRate = isOverride ? item.overrideRate! : effectiveStandard;
                  const mm = item.headcount * item.durationMonths;
                  const subtotal = mm * activeRate;

                  return (
                    <tr
                      key={item.id}
                      className={idx % 2 === 0 ? 'bg-[#081326]' : 'bg-[#0b1a33]'}
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-white">{item.roleName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{item.taskDescription}</div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-cyan-200">{item.tier}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        {item.headcount} Org
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        {item.durationMonths} Bln
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-cyan-300 font-medium">
                        {formatNumberID(mm, 1)} OB
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span className={isOverride ? 'text-amber-300' : 'text-slate-200'}>
                          {formatIDR(activeRate)}
                        </span>
                        {isOverride && (
                          <span className="block text-[10px] text-amber-400">
                            Override Simulasi
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-white">
                        {formatIDR(subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#050e1d] border-t border-cyan-500/40 font-mono text-xs">
                  <td colSpan={3} className="py-3 px-3 font-semibold text-cyan-300">
                    TOTAL BIAYA LANGSUNG PERSONEL (SUBTOTAL I)
                  </td>
                  <td className="py-3 px-3 text-right text-slate-200">
                    {summary.totalPersonnelHeadcount} Org
                  </td>
                  <td className="py-3 px-3 text-right text-slate-400">—</td>
                  <td className="py-3 px-3 text-right font-semibold text-cyan-300">
                    {formatNumberID(summary.totalManMonths, 1)} OB
                  </td>
                  <td />
                  <td className="py-3 px-3 text-right font-bold text-cyan-300 text-sm">
                    {formatIDR(summary.totalPersonnelCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Table II: Biaya Langsung Non-Personel */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-mono font-semibold text-cyan-300 tracking-wide">
              BAGIAN II — RINCIAN BIAYA LANGSUNG NON-PERSONEL
            </h4>
            <span className="text-xs font-mono text-slate-400">
              Proporsi: {nonPersonnelPercentage.toFixed(1)}% dari Biaya Langsung
            </span>
          </div>

          <div className="overflow-x-auto border border-cyan-500/25">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#050e1d] border-b border-cyan-500/30 text-[11px] font-mono text-cyan-300">
                  <th className="py-2.5 px-3 w-12">No</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Uraian Komponen &amp; Catatan Teknis</th>
                  <th className="py-2.5 px-3 text-right">Volume</th>
                  <th className="py-2.5 px-3">Satuan</th>
                  <th className="py-2.5 px-3 text-right">Harga Satuan (Rp)</th>
                  <th className="py-2.5 px-3 text-right">Jumlah Harga (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {nonPersonnelItems.map((np, idx) => {
                  const subtotal = np.quantity * np.unitPrice;
                  return (
                    <tr
                      key={np.id}
                      className={idx % 2 === 0 ? 'bg-[#081326]' : 'bg-[#0b1a33]'}
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono text-cyan-200">{np.category}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-white">{np.itemName}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{np.notes}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        {formatNumberID(np.quantity, 0)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{np.unit}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        {formatIDR(np.unitPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-white">
                        {formatIDR(subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#050e1d] border-t border-cyan-500/40 font-mono text-xs">
                  <td colSpan={6} className="py-3 px-3 font-semibold text-cyan-300">
                    TOTAL BIAYA LANGSUNG NON-PERSONEL (SUBTOTAL II)
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-cyan-300 text-sm">
                    {formatIDR(summary.totalNonPersonnelCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Table III: Rekapitulasi Perhitungan HPS / RAB */}
        <div>
          <h4 className="text-sm font-mono font-semibold text-cyan-300 tracking-wide mb-3">
            BAGIAN III — REKAPITULASI PERHITUNGAN AKHIR HPS / RAB
          </h4>

          <div className="overflow-x-auto border border-cyan-500/35">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="bg-[#050e1d] border-b border-cyan-500/30 text-[11px] text-cyan-300">
                  <th className="py-2.5 px-4 w-16">Kode</th>
                  <th className="py-2.5 px-4">Komponen Struktur Biaya</th>
                  <th className="py-2.5 px-4">Rumus Perhitungan</th>
                  <th className="py-2.5 px-4 text-right">Nilai Anggaran (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/90">
                <tr className="bg-[#081326]">
                  <td className="py-3 px-4 text-slate-400">A</td>
                  <td className="py-3 px-4 font-sans font-medium text-slate-200">
                    Total Biaya Langsung Personel (Remunerasi Tenaga Ahli)
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    ∑ (Jumlah Personel × Durasi Bulan × Tarif OB)
                  </td>
                  <td className="py-3 px-4 text-right text-slate-100">
                    {formatIDR(summary.totalPersonnelCost)}
                  </td>
                </tr>
                <tr className="bg-[#0b1a33]">
                  <td className="py-3 px-4 text-slate-400">B</td>
                  <td className="py-3 px-4 font-sans font-medium text-slate-200">
                    Total Biaya Langsung Non-Personel
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    ∑ (Volume × Harga Satuan Komponen)
                  </td>
                  <td className="py-3 px-4 text-right text-slate-100">
                    {formatIDR(summary.totalNonPersonnelCost)}
                  </td>
                </tr>
                <tr className="bg-[#071630] border-t border-cyan-500/30">
                  <td className="py-3 px-4 text-cyan-300 font-semibold">I</td>
                  <td className="py-3 px-4 font-sans font-semibold text-cyan-200">
                    Subtotal Biaya Langsung
                  </td>
                  <td className="py-3 px-4 text-cyan-300/90">A + B</td>
                  <td className="py-3 px-4 text-right font-semibold text-cyan-200">
                    {formatIDR(summary.directCostSubtotal)}
                  </td>
                </tr>
                <tr className="bg-[#081326]">
                  <td className="py-3 px-4 text-slate-400">II</td>
                  <td className="py-3 px-4 font-sans font-medium text-slate-200">
                    Nilai Overhead &amp; Keuntungan Wajar ({financials.overheadAndProfitPercent}%)
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    Subtotal Biaya Langsung × {financials.overheadAndProfitPercent}%
                  </td>
                  <td className="py-3 px-4 text-right text-slate-100">
                    {formatIDR(summary.overheadAndProfitValue)}
                  </td>
                </tr>
                <tr className="bg-[#071630]">
                  <td className="py-3 px-4 text-cyan-300 font-semibold">III</td>
                  <td className="py-3 px-4 font-sans font-semibold text-cyan-200">
                    Harga Sebelum Pajak / Dasar Pengenaan Pajak (DPP)
                  </td>
                  <td className="py-3 px-4 text-cyan-300/90">I + II</td>
                  <td className="py-3 px-4 text-right font-semibold text-cyan-200">
                    {formatIDR(summary.dppBeforeTax)}
                  </td>
                </tr>
                <tr className="bg-[#081326]">
                  <td className="py-3 px-4 text-slate-400">IV</td>
                  <td className="py-3 px-4 font-sans font-medium text-slate-200">
                    Nilai Pajak Pertambahan Nilai / PPN ({financials.ppnPercent}%)
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    DPP × {financials.ppnPercent}%
                  </td>
                  <td className="py-3 px-4 text-right text-slate-100">
                    {formatIDR(summary.ppnValue)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-[#040d1c] border-t-2 border-cyan-400 text-sm">
                  <td className="py-4 px-4 font-bold text-cyan-400">V</td>
                  <td className="py-4 px-4 font-sans font-bold text-white">
                    GRAND TOTAL ESTIMASI HARGA PERANGKAT LUNAK (HPS / RAB)
                  </td>
                  <td className="py-4 px-4 text-cyan-300 font-mono text-xs">
                    DPP + Nilai PPN
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-lg text-cyan-300">
                    {formatIDR(summary.grandTotalEstimation)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Formal Regulatory Disclaimer Block */}
        <div className="bg-[#050c18] border border-amber-400/35 p-4 flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <p className="font-semibold text-amber-300 font-mono tracking-wide">
              CATATAN DISCLAIMER FORMAL &amp; KEPATUHAN REGULASI PENGADAAN
            </p>
            <p className="mt-1">
              Hasil perhitungan pada aplikasi <strong className="text-white">AURA-SOFTWARE</strong> ini merupakan alat bantu analisis teknis dan estimasi awal penyusunan Kertas Kerja Harga Perkiraan Sendiri (HPS) maupun Rencana Anggaran Biaya (RAB). Penetapan resmi nilai HPS/RAB tetap mengikuti verifikasi dokumen Kerangka Acuan Kerja (KAK), survei/analisis pasar terkini, ketersediaan pagu anggaran (DIPA), serta pengesahan oleh Pejabat Pembuat Komitmen (PPK) atau Unit Berwenang di lingkungan TNI Angkatan Udara sesuai Peraturan Presiden tentang Pengadaan Barang/Jasa Pemerintah.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
