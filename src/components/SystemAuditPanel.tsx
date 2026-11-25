import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  Cpu,
  Lock,
  Radar,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  AuditAdjustmentAction,
  AuditReportResult,
  FinancialParameters,
  NonPersonnelCostItem,
  PersonnelAllocationItem,
  ProjectProfile,
  RegulationConfigPayload,
} from '../types/aura';
import { runDeterministicAudit } from '../utils/auditEngine';
import { formatIDR, formatTimestampID } from '../utils/formatters';

interface SystemAuditPanelProps {
  profile: ProjectProfile;
  personnelItems: PersonnelAllocationItem[];
  nonPersonnelItems: NonPersonnelCostItem[];
  financials: FinancialParameters;
  regulationConfig: RegulationConfigPayload;
  auditReport: AuditReportResult;
  onUpdateAuditReport: (report: AuditReportResult) => void;
  onApplyAdjustments: (adjustments: AuditAdjustmentAction[]) => void;
}

export const SystemAuditPanel: React.FC<SystemAuditPanelProps> = ({
  profile,
  personnelItems,
  nonPersonnelItems,
  financials,
  regulationConfig,
  auditReport,
  onUpdateAuditReport,
  onApplyAdjustments,
}) => {
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiStatusNotice, setAiStatusNotice] = useState<string | null>(null);
  const [appliedSuccessMsg, setAppliedSuccessMsg] = useState<string | null>(null);

  const handleRunAiAudit = async () => {
    setIsAnalyzingAi(true);
    setAiStatusNotice(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile,
          personnelItems,
          nonPersonnelItems,
          financials,
          regulationConfig,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (response.ok && data && data.status && Array.isArray(data.findings)) {
        const nextReport = data as AuditReportResult;
        onUpdateAuditReport(nextReport);
        setAiStatusNotice(
          `Analisis Audit AI Server (${nextReport.modelUsed || 'gemini-2.5-flash'}) selesai · Status: ${nextReport.status}.`
        );
      } else if (data && data.fallbackReport) {
        const fallbackRep = data.fallbackReport as AuditReportResult;
        onUpdateAuditReport(fallbackRep);
        setAiStatusNotice(
          `${data.error || 'Menggunakan hasil analisis Mesin Heuristik Deterministik Lokal Terverifikasi.'} · Status: ${fallbackRep.status}.`
        );
      } else {
        const fallback = runDeterministicAudit(
          profile,
          personnelItems,
          nonPersonnelItems,
          financials,
          regulationConfig,
          'LOCAL_HEURISTIC_ENGINE'
        );
        onUpdateAuditReport(fallback);
        setAiStatusNotice(
          `${data?.error || 'Endpoint /api/audit merespons di luar format standar. Menampilkan hasil audit deterministik lokal.'} · Status: ${fallback.status}.`
        );
      }
    } catch {
      clearTimeout(timeoutId);
      const fallback = runDeterministicAudit(
        profile,
        personnelItems,
        nonPersonnelItems,
        financials,
        regulationConfig,
        'LOCAL_HEURISTIC_ENGINE'
      );
      onUpdateAuditReport(fallback);
      setAiStatusNotice(
        `Koneksi /api/audit timeout (>8 detik) atau offline. Status diperbarui menggunakan mesin deterministik lokal: ${fallback.status}.`
      );
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleTriggerApply = (adjustments: AuditAdjustmentAction[], label: string) => {
    if (adjustments.length === 0) return;
    setAiStatusNotice(null);
    onApplyAdjustments(adjustments);
    setAppliedSuccessMsg(label);
    setTimeout(() => setAppliedSuccessMsg(null), 4000);
  };

  const statusColorConfig =
    auditReport.status === 'WAJAR / COMPLIANT'
      ? {
          border: 'border-emerald-400/45',
          bg: 'bg-emerald-950/35',
          text: 'text-emerald-300',
          icon: <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />,
        }
      : auditReport.status === 'PERINGATAN / PERLU REVIU'
      ? {
          border: 'border-amber-400/50',
          bg: 'bg-amber-950/40',
          text: 'text-amber-300',
          icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
        }
      : {
          border: 'border-rose-500/55',
          bg: 'bg-rose-950/45',
          text: 'text-rose-300',
          icon: <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />,
        };

  return (
    <section
      aria-label="System Audit and Anomaly Radar"
      className="hud-command-crest p-5 sm:p-6 space-y-6"
    >
      {/* Top Header Bar: Radar Status + AI Audit Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-amber-400/25">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-cyan-300">
            <Radar className="w-4 h-4 text-amber-400 shrink-0" />
            <span>SYSTEM AUDIT &amp; ANOMALY RADAR</span>
            <span aria-hidden="true">·</span>
            <span>RUJUKAN: {auditReport.regulationVersion}</span>
            <span aria-hidden="true">·</span>
            <span>
              MODE:{' '}
              {auditReport.source === 'AI_SERVER_AUDIT'
                ? `AI SERVER (${auditReport.modelUsed})`
                : 'DETERMINISTIC ENGINE'}
            </span>
          </div>
          <h2 className="text-xl font-display font-bold text-white">
            Evaluasi Kewajaran Anggaran, Kepatuhan Regulasi &amp; Kompleksitas Teknis
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Indicator Frame */}
          <div
            aria-live="polite"
            className={`flex items-center gap-2.5 px-3.5 py-2 border transition-colors ${
              isAnalyzingAi
                ? 'border-cyan-400/60 bg-cyan-950/50'
                : `${statusColorConfig.border} ${statusColorConfig.bg}`
            }`}
          >
            {isAnalyzingAi ? (
              <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
            ) : (
              statusColorConfig.icon
            )}
            <div className="font-mono">
              <span className="block text-[10px] text-slate-400 leading-none">
                STATUS AUDIT HPS/RAB
              </span>
              <span
                className={`text-xs font-bold ${
                  isAnalyzingAi ? 'text-cyan-300' : statusColorConfig.text
                }`}
              >
                {isAnalyzingAi ? 'MEMINDAI AUDIT...' : auditReport.status}
              </span>
            </div>
          </div>

          {/* AI Audit & Solution Trigger Button */}
          <button
            type="button"
            onClick={handleRunAiAudit}
            disabled={isAnalyzingAi}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 disabled:opacity-60 text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.35)] transition-all whitespace-nowrap shrink-0"
          >
            {isAnalyzingAi ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memindai via /api/audit...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>ANALISIS AUDIT AI &amp; SARAN SOLUSI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Guardrail & Telemetry Notice */}
      <div className="bg-[#050d1d] border border-cyan-500/25 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-mono font-semibold text-cyan-300">
              GUARDRAIL ANTI-HALUSINASI &amp; PROTEKSI KUALITAS AKTIF:{' '}
            </span>
            <span>{auditReport.executiveSummary}</span>
          </div>
        </div>
        <div className="text-[11px] font-mono text-slate-400 shrink-0">
          Audit: {formatTimestampID(auditReport.auditedAt)}
        </div>
      </div>

      {aiStatusNotice && (
        <div className="bg-cyan-950/60 border border-cyan-400/40 px-4 py-2.5 text-xs font-mono text-cyan-200 flex items-center justify-between">
          <span>{aiStatusNotice}</span>
          <button
            type="button"
            onClick={() => setAiStatusNotice(null)}
            className="text-amber-300 hover:text-white ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {appliedSuccessMsg && (
        <div className="bg-emerald-950/70 border border-emerald-400/50 px-4 py-2.5 text-xs font-mono text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{appliedSuccessMsg}</span>
        </div>
      )}

      {/* Technical Complexity Deep Understanding Summary Bar */}
      <div className="bg-[#071327] border border-cyan-500/30 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-300 font-semibold">
            <Cpu className="w-4 h-4 text-cyan-400" />
            <span>EVALUASI KOMPLEKSITAS TEKNIS MENDALAM (NON-RASIO MURNI)</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-cyan-300">
            <span>
              Skor Kompleksitas:{' '}
              <strong className="text-white">
                {auditReport.technicalComplexityAssessment.complexityScore}/100
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {auditReport.technicalComplexityAssessment.highComplexityCount} Modul Tinggi
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {auditReport.technicalComplexityAssessment.specialIntegrationCount} Integrasi Khusus
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {auditReport.technicalComplexityAssessment.securityStandardCount} Keamanan Berlapis
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {auditReport.technicalComplexityAssessment.workloadJustificationSummary}
        </p>
      </div>

      {/* 2-Column Split: 1. Diagnosa Kesalahan/Anomali & 2. Solusi & Saran Perbaikan Realistis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: Diagnosa Kesalahan / Temuan Anomali */}
        <div className="lg:col-span-7 bg-[#061022] border border-cyan-500/25 p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
              <div>
                <span className="text-[11px] font-mono text-cyan-400">
                  BAGIAN 01 · DIAGNOSA TEMUAN &amp; KEPATUHAN REGULASI
                </span>
                <h3 className="text-base font-display font-semibold text-white mt-0.5">
                  Diagnosa Kesalahan / Temuan Anomali ({auditReport.findings.length} Item)
                </h3>
              </div>
              <ShieldAlert className="w-5 h-5 text-cyan-400 shrink-0" />
            </div>

            <div className="divide-y divide-slate-800/90 mt-3">
              {auditReport.findings.map((finding) => {
                const badgeColor =
                  finding.severity === 'CRITICAL'
                    ? 'text-rose-300 border-rose-500/50 bg-rose-950/50'
                    : finding.severity === 'WARNING'
                    ? 'text-amber-300 border-amber-400/50 bg-amber-950/50'
                    : 'text-emerald-300 border-emerald-400/40 bg-emerald-950/40';

                return (
                  <div key={finding.id} className="py-3.5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">
                        {finding.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-mono font-semibold border ${badgeColor}`}
                      >
                        {finding.severity}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {finding.diagnosis}
                    </p>

                    <div className="text-[11px] text-slate-400 bg-[#040a16] p-2.5 border border-slate-800/90 space-y-1">
                      <div>
                        <strong className="text-cyan-300 font-mono">
                          Pertimbangan Kompleksitas:{' '}
                        </strong>
                        <span>{finding.technicalContextJustification}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 font-mono text-[10px]">
                        <span className="text-amber-300">
                          Rujukan: {finding.regulationCitation}
                        </span>
                        <span className="text-cyan-200">{finding.deterministicMetric}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Column 2: Solusi & Saran Perbaikan Realistis */}
        <div className="lg:col-span-5 bg-[#061022] border border-amber-400/30 p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-amber-400/20">
              <div>
                <span className="text-[11px] font-mono text-amber-400">
                  BAGIAN 02 · REKOMENDASI KOREKSI TERUKUR
                </span>
                <h3 className="text-base font-display font-semibold text-white mt-0.5">
                  Solusi &amp; Saran Perbaikan Realistis
                </h3>
              </div>
              <Wrench className="w-5 h-5 text-amber-400 shrink-0" />
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {auditReport.solutions.summaryAdvice}
            </p>

            {auditReport.solutions.adjustments.length === 0 ? (
              auditReport.status === 'WAJAR / COMPLIANT' ? (
                <div className="p-5 bg-[#040b18] border border-emerald-500/30 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <div className="text-sm font-display font-semibold text-white">
                    Anggaran Telah Optimal &amp; Mematuhi Regulasi
                  </div>
                  <p className="text-xs text-slate-400">
                    Tidak ada komponen tarif yang melampaui acuan standar maupun duplikasi item. Seluruh alokasi personel dan keamanan siber direkomendasikan untuk dipertahankan 100%.
                  </p>
                </div>
              ) : (
                <div className="p-5 bg-[#040b18] border border-amber-400/40 text-center space-y-2">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                  <div className="text-sm font-display font-semibold text-white">
                    Perlu Verifikasi Dokumen Pendukung / Survei Pasar
                  </div>
                  <p className="text-xs text-slate-400">
                    Terdapat catatan reviu (seperti harga satuan komponen khusus atau verifikasi KAK) yang memerlukan konfirmasi manual dokumen E-Katalog LKPP tanpa pemotongan anggaran otomatis.
                  </p>
                </div>
              )
            ) : (
              <div className="space-y-3">
                {auditReport.solutions.adjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="p-3.5 bg-[#040a16] border border-amber-400/35 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-semibold text-amber-200">
                        {adj.title}
                      </h4>
                      <span className="font-mono text-xs font-bold text-emerald-300 shrink-0">
                        {adj.exactGrandTotalDelta <= 0
                          ? formatIDR(adj.exactGrandTotalDelta)
                          : `+${formatIDR(adj.exactGrandTotalDelta)}`}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {adj.rationale}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                      <div className="bg-[#081326] p-2 border border-slate-800">
                        <span className="block text-[10px] text-slate-400">Nilai Saat Ini</span>
                        <span className="text-rose-300">{adj.currentValueLabel}</span>
                      </div>
                      <div className="bg-[#081326] p-2 border border-cyan-500/30">
                        <span className="block text-[10px] text-slate-400">Saran Terukur</span>
                        <span className="text-cyan-300">{adj.recommendedValueLabel}</span>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-slate-400">
                        {adj.regulationCitation}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleTriggerApply(
                            [adj],
                            `Saran "${adj.title}" berhasil diterapkan ke perhitungan HPS/RAB.`
                          )
                        }
                        className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Terapkan Saran Ini</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deterministic Post-Adjustment Financial Simulation Footer */}
          <div className="pt-4 border-t border-amber-400/30 space-y-3">
            <div className="bg-[#040914] p-3.5 border border-cyan-500/25 space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Grand Total HPS Saat Ini:</span>
                <span className="text-white font-semibold">
                  {formatIDR(auditReport.solutions.currentGrandTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-cyan-300">
                <span>Simulasi HPS Setelah Saran Terukur:</span>
                <span className="text-sm font-bold text-amber-300">
                  {formatIDR(auditReport.solutions.projectedGrandTotalAfterAdjustments)}
                </span>
              </div>
              {auditReport.solutions.totalMeasuredSavings !== 0 && (
                <div
                  className={`flex items-center justify-between text-[11px] pt-1 border-t border-slate-800 ${
                    auditReport.solutions.totalMeasuredSavings > 0
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                  }`}
                >
                  <span>
                    {auditReport.solutions.totalMeasuredSavings > 0
                      ? 'Efisiensi / Penurunan Terukur:'
                      : 'Penambahan Penguatan Keamanan:'}
                  </span>
                  <span>
                    {auditReport.solutions.totalMeasuredSavings > 0 ? '-' : '+'}
                    {formatIDR(Math.abs(auditReport.solutions.totalMeasuredSavings))}
                  </span>
                </div>
              )}
            </div>

            {auditReport.solutions.adjustments.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  handleTriggerApply(
                    auditReport.solutions.adjustments,
                    `Seluruh (${auditReport.solutions.adjustments.length}) saran perbaikan terukur berhasil diterapkan ke Kertas Kerja HPS/RAB.`
                  )
                }
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all"
              >
                <Sliders className="w-4 h-4" />
                <span>
                  TERAPKAN SARAN TERUKUR ({auditReport.solutions.adjustments.length} KOREKSI)
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
