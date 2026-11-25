import React, { useState } from 'react';
import {
  Check,
  Cpu,
  Edit3,
  FileSpreadsheet,
  Lock,
  Network,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  HIGH_COMPLEXITY_MODULE_OPTIONS,
  LAYERED_SECURITY_STANDARD_OPTIONS,
  PROJECT_PRESET_TEMPLATES,
  SPECIAL_INTEGRATION_OPTIONS,
} from '../data/defaultRegulations';
import {
  AuditAdjustmentAction,
  AuditReportResult,
  CalculationSummary,
  ComplexityLevel,
  FinancialParameters,
  NonPersonnelCostItem,
  PersonnelAllocationItem,
  ProcurementScheme,
  ProjectProfile,
  QualificationTier,
  RegulationConfigPayload,
} from '../types/aura';
import { formatIDR, formatNumberID } from '../utils/formatters';
import { SystemAuditPanel } from './SystemAuditPanel';

interface CalculatorTabProps {
  profile: ProjectProfile;
  onChangeProfile: (next: ProjectProfile) => void;
  personnelItems: PersonnelAllocationItem[];
  onChangePersonnel: (next: PersonnelAllocationItem[]) => void;
  nonPersonnelItems: NonPersonnelCostItem[];
  onChangeNonPersonnel: (next: NonPersonnelCostItem[]) => void;
  financials: FinancialParameters;
  onChangeFinancials: (next: FinancialParameters) => void;
  regulationConfig: RegulationConfigPayload;
  summary: CalculationSummary;
  auditReport: AuditReportResult;
  onUpdateAuditReport: (report: AuditReportResult) => void;
  onApplyAuditAdjustments: (adjustments: AuditAdjustmentAction[]) => void;
  onSaveSimulation: () => void;
  onGoToWorksheet: () => void;
  onApplyPreset: (presetId: string) => void;
}

const PROCUREMENT_SCHEMES: ProcurementScheme[] = [
  'Tender / Seleksi Jasa Konsultansi Badan Usaha',
  'E-Purchasing Katalog Elektronik (E-Katalog LKPP)',
  'Swakelola Tipe I / Internal TNI AU',
  'Swakelola Tipe II (Instansi / Perguruan Tinggi)',
  'Pengadaan Langsung (< Rp 100 Juta / Rp 200 Juta)',
];

const COMPLEXITY_LEVELS: ComplexityLevel[] = [
  'Rendah (Sistem Informasi Standar / CRUD)',
  'Menengah (Integrasi Multi-Satker & Portal Layanan)',
  'Tinggi (Sistem Komando Taktis / C4ISR & Analitik Real-Time)',
  'Kritis / Strategis (Pertahanan Siber & Avionik Terintegrasi)',
];

const QUALIFICATION_TIERS: QualificationTier[] = ['Junior', 'Middle', 'Senior', 'Lead / Principal'];

const NON_PERSONNEL_CATEGORIES: NonPersonnelCostItem['category'][] = [
  'Lisensi',
  'Server / Cloud',
  'Integrasi API',
  'Security Testing',
  'Dokumentasi',
  'SLA & Pemeliharaan',
];

export const CalculatorTab: React.FC<CalculatorTabProps> = ({
  profile,
  onChangeProfile,
  personnelItems,
  onChangePersonnel,
  nonPersonnelItems,
  onChangeNonPersonnel,
  financials,
  onChangeFinancials,
  regulationConfig,
  summary,
  auditReport,
  onUpdateAuditReport,
  onApplyAuditAdjustments,
  onSaveSimulation,
  onGoToWorksheet,
  onApplyPreset,
}) => {
  const [selectedStandardCatalogId, setSelectedStandardCatalogId] = useState<string>(
    regulationConfig.nonPersonnelStandards[0]?.id || ''
  );
  const [justSavedFeedback, setJustSavedFeedback] = useState(false);

  const toggleComplexityDimension = (
    field: 'highComplexityModules' | 'specialIntegrations' | 'layeredSecurityStandards',
    value: string
  ) => {
    const current = profile[field] || [];
    const exists = current.includes(value);
    const next = exists ? current.filter((v) => v !== value) : [...current, value];
    onChangeProfile({
      ...profile,
      [field]: next,
    });
  };

  const handleAddPersonnelRow = () => {
    const defaultRole = regulationConfig.roleTariffs[0];
    if (!defaultRole) return;
    const tier: QualificationTier = 'Middle';
    const newRow: PersonnelAllocationItem = {
      id: `pers-${Date.now()}`,
      roleId: defaultRole.id,
      roleName: defaultRole.roleName,
      tier,
      headcount: 1,
      durationMonths: profile.durationMonths || 4,
      standardRate: defaultRole.rates[tier],
      overrideRate: null,
      taskDescription: defaultRole.description,
    };
    onChangePersonnel([...personnelItems, newRow]);
  };

  const handleUpdatePersonnelRow = (
    id: string,
    patch: Partial<PersonnelAllocationItem>
  ) => {
    const updated = personnelItems.map((item) => {
      if (item.id !== id) return item;
      const merged = { ...item, ...patch };

      if (patch.roleId !== undefined || patch.tier !== undefined) {
        const foundRole = regulationConfig.roleTariffs.find((r) => r.id === merged.roleId);
        if (foundRole) {
          merged.roleName = foundRole.roleName;
          merged.standardRate = foundRole.rates[merged.tier] ?? foundRole.rates.Middle;
        }
      }
      return merged;
    });
    onChangePersonnel(updated);
  };

  const handleRemovePersonnelRow = (id: string) => {
    onChangePersonnel(personnelItems.filter((item) => item.id !== id));
  };

  const handleClearAllOverrides = () => {
    onChangePersonnel(
      personnelItems.map((item) => ({
        ...item,
        overrideRate: null,
      }))
    );
  };

  const handleAddNonPersonnelFromCatalog = () => {
    const std = regulationConfig.nonPersonnelStandards.find(
      (s) => s.id === selectedStandardCatalogId
    );
    const newItem: NonPersonnelCostItem = std
      ? {
          id: `np-${Date.now()}`,
          category: std.category,
          itemName: std.name,
          quantity: std.unit.includes('Bulan') ? profile.durationMonths : 1,
          unit: std.unit,
          unitPrice: std.defaultUnitPrice,
          notes: std.referenceNote,
        }
      : {
          id: `np-${Date.now()}`,
          category: 'Server / Cloud',
          itemName: 'Komponen Non-Personel Baru',
          quantity: 1,
          unit: 'Paket',
          unitPrice: 10000000,
          notes: 'Sesuai spesifikasi KAK',
        };
    onChangeNonPersonnel([...nonPersonnelItems, newItem]);
  };

  const handleUpdateNonPersonnelRow = (
    id: string,
    patch: Partial<NonPersonnelCostItem>
  ) => {
    onChangeNonPersonnel(
      nonPersonnelItems.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleRemoveNonPersonnelRow = (id: string) => {
    onChangeNonPersonnel(nonPersonnelItems.filter((item) => item.id !== id));
  };

  const handleSaveTrigger = () => {
    onSaveSimulation();
    setJustSavedFeedback(true);
    setTimeout(() => setJustSavedFeedback(false), 2200);
  };

  const activeOverridesCount = personnelItems.filter((i) => i.overrideRate !== null).length;

  return (
    <div className="space-y-8">
      {/* 1. PROFIL PROYEK, KOMPLEKSITAS TEKNIS MENDALAM & TEMPLATE SKENARIO TNI AU */}
      <section className="hud-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-cyan-500/20">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <span>01. PARAMETER IDENTITAS &amp; ARSITEKTUR KOMPLEKSITAS PROYEK</span>
              <span aria-hidden="true">·</span>
              <span>ACUAN KAK / TOR</span>
            </div>
            <h2 className="text-xl font-display font-semibold text-white mt-1">
              Profil Proyek, Skema Pengadaan &amp; Kompleksitas Teknis
            </h2>
          </div>

          {/* Preset Template Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">Muat Preset Skenario:</span>
            {PROJECT_PRESET_TEMPLATES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset.id)}
                className="px-3 py-1.5 text-xs font-medium bg-[#0d1f3d] hover:bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 transition-colors whitespace-nowrap shrink-0"
              >
                {preset.label.split('(')[0].trim()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-5">
          <div className="md:col-span-6">
            <label htmlFor="project-name" className="block text-xs font-medium text-slate-300 mb-1.5">
              Nama Proyek / Sistem Aplikasi
            </label>
            <input
              id="project-name"
              type="text"
              value={profile.projectName}
              onChange={(e) => onChangeProfile({ ...profile, projectName: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
              placeholder="Contoh: Sistem Informasi Kesiapan Alutsista (SIKAL-AU)"
            />
          </div>

          <div className="md:col-span-4">
            <label htmlFor="proposing-unit" className="block text-xs font-medium text-slate-300 mb-1.5">
              Satuan Kerja / Unit Pengusul
            </label>
            <input
              id="proposing-unit"
              type="text"
              value={profile.proposingUnit}
              onChange={(e) => onChangeProfile({ ...profile, proposingUnit: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
              placeholder="Contoh: Diskomlekau / Kohanudnas"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="fiscal-year" className="block text-xs font-medium text-slate-300 mb-1.5">
              Tahun Anggaran
            </label>
            <input
              id="fiscal-year"
              type="text"
              value={profile.fiscalYear}
              onChange={(e) => onChangeProfile({ ...profile, fiscalYear: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="md:col-span-4">
            <label htmlFor="procurement-scheme" className="block text-xs font-medium text-slate-300 mb-1.5">
              Skema Pengadaan Barang/Jasa
            </label>
            <select
              id="procurement-scheme"
              value={profile.procurementScheme}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  procurementScheme: e.target.value as ProcurementScheme,
                })
              }
              className="w-full px-3.5 py-2.5 text-sm bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
            >
              {PROCUREMENT_SCHEMES.map((scheme) => (
                <option key={scheme} value={scheme}>
                  {scheme}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label htmlFor="complexity-level" className="block text-xs font-medium text-slate-300 mb-1.5">
              Tingkat Kompleksitas Sistem Utama
            </label>
            <select
              id="complexity-level"
              value={profile.complexity}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  complexity: e.target.value as ComplexityLevel,
                })
              }
              className="w-full px-3.5 py-2.5 text-sm bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
            >
              {COMPLEXITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="duration-months" className="block text-xs font-medium text-slate-300 mb-1.5">
              Durasi Proyek (Bulan)
            </label>
            <input
              id="duration-months"
              type="number"
              min={1}
              max={60}
              value={profile.durationMonths}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  durationMonths: Math.max(1, Number(e.target.value) || 1),
                })
              }
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="location-factor" className="block text-xs font-medium text-slate-300 mb-1.5">
              Indeks Lokasi (IKK)
            </label>
            <input
              id="location-factor"
              type="number"
              step="0.05"
              min={0.5}
              max={2.5}
              value={profile.locationFactor}
              onChange={(e) =>
                onChangeProfile({
                  ...profile,
                  locationFactor: Math.max(0.5, Number(e.target.value) || 1.0),
                })
              }
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="md:col-span-12">
            <label htmlFor="project-notes" className="block text-xs font-medium text-slate-300 mb-1.5">
              Ruang Lingkup Singkat &amp; Spesifikasi Operasional
            </label>
            <input
              id="project-notes"
              type="text"
              value={profile.notes}
              onChange={(e) => onChangeProfile({ ...profile, notes: e.target.value })}
              className="w-full px-3.5 py-2 text-sm bg-[#050c18] border border-cyan-500/25 text-slate-200 focus:outline-none focus:border-cyan-400"
              placeholder="Catatan ruang lingkup modul atau target operasional..."
            />
          </div>
        </div>

        {/* DEEP TECHNICAL COMPLEXITY MATRIX (Modul Tinggi, Integrasi Khusus, Keamanan Berlapis) */}
        <div className="mt-6 pt-5 border-t border-cyan-500/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono text-amber-300 font-semibold">
                PARAMETER KOMPLEKSITAS TEKNIS MENDALAM (ACUAN VERIFIKASI BEBAN KERJA &amp; INFRASTRUKTUR)
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                Pilih karakteristik teknis proyek agar Sistem Audit AI &amp; Deterministik tidak salah menandai kebutuhan personel spesialis atau keamanan siber sebagai pemborosan.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-300 shrink-0">
              Skor Kompleksitas Aktif: {auditReport.technicalComplexityAssessment.complexityScore}/100
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. Modul Berkompleksitas Tinggi */}
            <div className="bg-[#050c18] border border-cyan-500/25 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-semibold">
                <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>A. Modul Berkompleksitas Tinggi</span>
              </div>
              <div className="space-y-1.5">
                {HIGH_COMPLEXITY_MODULE_OPTIONS.map((mod) => {
                  const checked = (profile.highComplexityModules || []).includes(mod);
                  return (
                    <button
                      key={mod}
                      type="button"
                      onClick={() => toggleComplexityDimension('highComplexityModules', mod)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs border transition-colors flex items-start gap-2 ${
                        checked
                          ? 'bg-cyan-950/60 border-cyan-400/60 text-cyan-100'
                          : 'bg-[#081326]/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${
                          checked ? 'border-cyan-300 bg-cyan-400 text-slate-950' : 'border-slate-600'
                        }`}
                      >
                        {checked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span className="leading-snug">{mod}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Integrasi Sistem Khusus */}
            <div className="bg-[#050c18] border border-cyan-500/25 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-semibold">
                <Network className="w-4 h-4 text-sky-400 shrink-0" />
                <span>B. Integrasi Sistem Khusus</span>
              </div>
              <div className="space-y-1.5">
                {SPECIAL_INTEGRATION_OPTIONS.map((integ) => {
                  const checked = (profile.specialIntegrations || []).includes(integ);
                  return (
                    <button
                      key={integ}
                      type="button"
                      onClick={() => toggleComplexityDimension('specialIntegrations', integ)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs border transition-colors flex items-start gap-2 ${
                        checked
                          ? 'bg-sky-950/60 border-sky-400/60 text-sky-100'
                          : 'bg-[#081326]/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${
                          checked ? 'border-sky-300 bg-sky-400 text-slate-950' : 'border-slate-600'
                        }`}
                      >
                        {checked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span className="leading-snug">{integ}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Standar Keamanan Berlapis */}
            <div className="bg-[#050c18] border border-amber-400/25 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-mono text-amber-300 font-semibold">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>C. Standar Keamanan Berlapis</span>
              </div>
              <div className="space-y-1.5">
                {LAYERED_SECURITY_STANDARD_OPTIONS.map((sec) => {
                  const checked = (profile.layeredSecurityStandards || []).includes(sec);
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => toggleComplexityDimension('layeredSecurityStandards', sec)}
                      className={`w-full text-left px-2.5 py-1.5 text-xs border transition-colors flex items-start gap-2 ${
                        checked
                          ? 'bg-amber-950/50 border-amber-400/60 text-amber-100'
                          : 'bg-[#081326]/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${
                          checked ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-slate-600'
                        }`}
                      >
                        {checked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span className="leading-snug">{sec}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PERHITUNGAN BIAYA LANGSUNG PERSONEL (MAN-MONTH / MM) */}
      <section className="hud-panel p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-cyan-500/20">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <span>02. BIAYA LANGSUNG PERSONEL (REMUNERASI TENAGA AHLI)</span>
              <span aria-hidden="true">·</span>
              <span>SATUAN ORANG-BULAN (OB / MM)</span>
            </div>
            <h2 className="text-xl font-display font-semibold text-white mt-1">
              Alokasi Tenaga Ahli &amp; Simulasi Override Tarif Proyek Ini
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {activeOverridesCount > 0 && (
              <button
                type="button"
                onClick={handleClearAllOverrides}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-300 bg-amber-950/50 hover:bg-amber-900/50 border border-amber-400/40 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset {activeOverridesCount} Override ke Standar</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleAddPersonnelRow}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Peran Personel</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyan-500/30 text-[11px] font-mono text-cyan-300 bg-[#071124]">
                <th className="py-3 px-3">Peran Tenaga Ahli</th>
                <th className="py-3 px-3">Kualifikasi</th>
                <th className="py-3 px-3 text-right">Jml Personel</th>
                <th className="py-3 px-3 text-right">Durasi (Bln)</th>
                <th className="py-3 px-3 text-right">Total OB/MM</th>
                <th className="py-3 px-3 text-right">Tarif Standar / Override (Rp/OB)</th>
                <th className="py-3 px-3 text-right">Subtotal Biaya (Rp)</th>
                <th className="py-3 px-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {personnelItems.map((item, idx) => {
                const effectiveStandard = Math.round(item.standardRate * profile.locationFactor);
                const isOverridden = item.overrideRate !== null;
                const activeRate = isOverridden ? item.overrideRate! : effectiveStandard;
                const manMonths = item.headcount * item.durationMonths;
                const rowSubtotal = manMonths * activeRate;

                return (
                  <tr
                    key={item.id}
                    className={`${
                      idx % 2 === 0 ? 'bg-[#081326]/90' : 'bg-[#0b1930]/60'
                    } hover:bg-cyan-950/30 transition-colors`}
                  >
                    {/* Role Selector */}
                    <td className="py-3 px-3 min-w-[230px]">
                      <select
                        aria-label={`Pilih peran baris ${idx + 1}`}
                        value={item.roleId}
                        onChange={(e) =>
                          handleUpdatePersonnelRow(item.id, { roleId: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-medium bg-[#040a15] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                      >
                        {regulationConfig.roleTariffs.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.code} — {role.roleName}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={item.taskDescription}
                        onChange={(e) =>
                          handleUpdatePersonnelRow(item.id, { taskDescription: e.target.value })
                        }
                        placeholder="Deskripsi tugas..."
                        className="w-full mt-1.5 px-2 py-1 text-[11px] bg-transparent border-b border-slate-800 text-slate-400 focus:text-slate-200 focus:border-cyan-500/40 focus:outline-none"
                      />
                    </td>

                    {/* Qualification Tier */}
                    <td className="py-3 px-3 min-w-[140px] align-top">
                      <select
                        aria-label={`Pilih kualifikasi ${item.roleName}`}
                        value={item.tier}
                        onChange={(e) =>
                          handleUpdatePersonnelRow(item.id, {
                            tier: e.target.value as QualificationTier,
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-[#040a15] border border-cyan-500/30 text-cyan-200 focus:outline-none focus:border-cyan-400"
                      >
                        {QUALIFICATION_TIERS.map((tier) => (
                          <option key={tier} value={tier}>
                            {tier}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Headcount */}
                    <td className="py-3 px-3 text-right align-top w-28">
                      <input
                        aria-label={`Jumlah personel ${item.roleName}`}
                        type="number"
                        min={1}
                        max={100}
                        value={item.headcount}
                        onChange={(e) =>
                          handleUpdatePersonnelRow(item.id, {
                            headcount: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-20 px-2.5 py-1.5 text-xs font-mono text-right bg-[#040a15] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                      />
                    </td>

                    {/* Duration Months */}
                    <td className="py-3 px-3 text-right align-top w-28">
                      <input
                        aria-label={`Durasi bulan ${item.roleName}`}
                        type="number"
                        min={0.5}
                        step={0.5}
                        max={60}
                        value={item.durationMonths}
                        onChange={(e) =>
                          handleUpdatePersonnelRow(item.id, {
                            durationMonths: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-20 px-2.5 py-1.5 text-xs font-mono text-right bg-[#040a15] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                      />
                    </td>

                    {/* Total Man-Months */}
                    <td className="py-3 px-3 text-right align-top font-mono text-xs text-cyan-300 pt-4">
                      {formatNumberID(manMonths, 1)} OB
                    </td>

                    {/* Standard or Override Rate */}
                    <td className="py-3 px-3 text-right align-top min-w-[230px]">
                      <div className="flex items-center justify-end gap-1.5">
                        {isOverridden ? (
                          <input
                            aria-label={`Tarif override ${item.roleName}`}
                            type="number"
                            step={500000}
                            min={0}
                            value={item.overrideRate ?? 0}
                            onChange={(e) =>
                              handleUpdatePersonnelRow(item.id, {
                                overrideRate: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-36 px-2.5 py-1.5 text-xs font-mono text-right bg-amber-950/40 border border-amber-400/60 text-amber-200 focus:outline-none"
                          />
                        ) : (
                          <span className="font-mono text-xs text-slate-200 py-1.5">
                            {formatIDR(effectiveStandard)}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleUpdatePersonnelRow(item.id, {
                              overrideRate: isOverridden ? null : effectiveStandard,
                            })
                          }
                          title={
                            isOverridden
                              ? 'Kembalikan ke tarif standar tabel regulasi'
                              : 'Override tarif khusus di proyek ini'
                          }
                          className={`px-2 py-1.5 text-[11px] font-mono border transition-colors whitespace-nowrap shrink-0 ${
                            isOverridden
                              ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 hover:bg-amber-500/30'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/40'
                          }`}
                        >
                          <Edit3 className="w-3.5 h-3.5 inline mr-1" />
                          {isOverridden ? 'Override' : 'Standar'}
                        </button>
                      </div>
                      {isOverridden && (
                        <div className="text-[11px] font-mono text-amber-400/90 mt-1">
                          Standar: {formatIDR(effectiveStandard)}
                        </div>
                      )}
                    </td>

                    {/* Row Subtotal */}
                    <td className="py-3 px-3 text-right align-top font-mono text-xs font-semibold text-white pt-4">
                      {formatIDR(rowSubtotal)}
                    </td>

                    {/* Remove Action */}
                    <td className="py-3 px-2 text-center align-top pt-3">
                      <button
                        type="button"
                        onClick={() => handleRemovePersonnelRow(item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        aria-label={`Hapus peran ${item.roleName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-cyan-500/40 bg-[#061022] font-mono text-xs">
                <td colSpan={2} className="py-3.5 px-3 font-semibold text-cyan-300">
                  SUBTOTAL BIAYA LANGSUNG PERSONEL
                </td>
                <td className="py-3.5 px-3 text-right text-slate-300">
                  {summary.totalPersonnelHeadcount} Orang
                </td>
                <td className="py-3.5 px-3 text-right text-slate-400">—</td>
                <td className="py-3.5 px-3 text-right font-semibold text-cyan-300">
                  {formatNumberID(summary.totalManMonths, 1)} OB
                </td>
                <td className="py-3.5 px-3 text-right text-slate-400">
                  Faktor IKK: {profile.locationFactor.toFixed(2)}x
                </td>
                <td className="py-3.5 px-3 text-right text-sm font-bold text-cyan-300">
                  {formatIDR(summary.totalPersonnelCost)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 3. PERHITUNGAN BIAYA LANGSUNG NON-PERSONEL */}
      <section className="hud-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-cyan-500/20">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <span>03. BIAYA LANGSUNG NON-PERSONEL (DIRECT REIMBURSABLE / INFRASTRUKTUR)</span>
            </div>
            <h2 className="text-xl font-display font-semibold text-white mt-1">
              Komponen Lisensi, Cloud, Integrasi API, Pentest, Dokumentasi &amp; SLA
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Pilih katalog standar biaya non-personel"
              value={selectedStandardCatalogId}
              onChange={(e) => setSelectedStandardCatalogId(e.target.value)}
              className="px-3 py-2 text-xs bg-[#050c18] border border-cyan-500/30 text-slate-200 focus:outline-none focus:border-cyan-400 max-w-xs truncate"
            >
              {regulationConfig.nonPersonnelStandards.map((std) => (
                <option key={std.id} value={std.id}>
                  [{std.category}] {std.name} ({formatIDR(std.defaultUnitPrice)}/{std.unit})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddNonPersonnelFromCatalog}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Item Non-Personel</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-cyan-500/30 text-[11px] font-mono text-cyan-300 bg-[#071124]">
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Uraian Komponen &amp; Spesifikasi</th>
                <th className="py-3 px-3 text-right">Volume</th>
                <th className="py-3 px-3">Satuan</th>
                <th className="py-3 px-3 text-right">Harga Satuan (Rp)</th>
                <th className="py-3 px-3 text-right">Subtotal (Rp)</th>
                <th className="py-3 px-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {nonPersonnelItems.map((item, idx) => {
                const rowSubtotal = item.quantity * item.unitPrice;
                return (
                  <tr
                    key={item.id}
                    className={`${
                      idx % 2 === 0 ? 'bg-[#081326]/90' : 'bg-[#0b1930]/60'
                    } hover:bg-cyan-950/30 transition-colors`}
                  >
                    <td className="py-3 px-3 align-top w-44">
                      <select
                        aria-label={`Kategori item ${idx + 1}`}
                        value={item.category}
                        onChange={(e) =>
                          handleUpdateNonPersonnelRow(item.id, {
                            category: e.target.value as NonPersonnelCostItem['category'],
                          })
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-[#040a15] border border-cyan-500/30 text-cyan-200 focus:outline-none focus:border-cyan-400"
                      >
                        {NON_PERSONNEL_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3 px-3 min-w-[260px]">
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) =>
                          handleUpdateNonPersonnelRow(item.id, { itemName: e.target.value })
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-medium bg-[#040a15] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                      />
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) =>
                          handleUpdateNonPersonnelRow(item.id, { notes: e.target.value })
                        }
                        placeholder="Catatan spesifikasi / rujukan harga..."
                        className="w-full mt-1 px-2 py-0.5 text-[11px] bg-transparent border-b border-slate-800 text-slate-400 focus:text-slate-200 focus:outline-none"
                      />
                    </td>

                    <td className="py-3 px-3 text-right align-top w-28">
                      <input
                        aria-label={`Volume ${item.itemName}`}
                        type="number"
                        min={0}
                        step={1}
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateNonPersonnelRow(item.id, {
                            quantity: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-20 px-2.5 py-1.5 text-xs font-mono text-right bg-[#040a15] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                      />
                    </td>

                    <td className="py-3 px-3 align-top w-36">
                      <input
                        aria-label={`Satuan ${item.itemName}`}
                        type="text"
                        value={item.unit}
                        onChange={(e) =>
                          handleUpdateNonPersonnelRow(item.id, { unit: e.target.value })
                        }
                        className="w-28 px-2.5 py-1.5 text-xs font-mono bg-[#040a15] border border-cyan-500/30 text-slate-200 focus:outline-none focus:border-cyan-400"
                      />
                    </td>

                    <td className="py-3 px-3 text-right align-top w-44">
                      <input
                        aria-label={`Harga satuan ${item.itemName}`}
                        type="number"
                        min={0}
                        step={500000}
                        value={item.unitPrice}
                        onChange={(e) =>
                          handleUpdateNonPersonnelRow(item.id, {
                            unitPrice: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="w-36 px-2.5 py-1.5 text-xs font-mono text-right bg-[#040a15] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                      />
                    </td>

                    <td className="py-3 px-3 text-right align-top font-mono text-xs font-semibold text-white pt-4">
                      {formatIDR(rowSubtotal)}
                    </td>

                    <td className="py-3 px-2 text-center align-top pt-3">
                      <button
                        type="button"
                        onClick={() => handleRemoveNonPersonnelRow(item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        aria-label={`Hapus item ${item.itemName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-cyan-500/40 bg-[#061022] font-mono text-xs">
                <td colSpan={5} className="py-3.5 px-3 font-semibold text-cyan-300">
                  SUBTOTAL BIAYA LANGSUNG NON-PERSONEL ({nonPersonnelItems.length} Komponen)
                </td>
                <td className="py-3.5 px-3 text-right text-sm font-bold text-cyan-300">
                  {formatIDR(summary.totalNonPersonnelCost)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 4. PARAMETER KEUANGAN, REGULASI & MATRIKS PERHITUNGAN HPS / RAB */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Financial & Regulation Parameters */}
        <div className="lg:col-span-5 hud-panel p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <span>04. PARAMETER PAJAK &amp; KEUNTUNGAN WAJAR</span>
            </div>
            <h2 className="text-xl font-display font-semibold text-white mt-1">
              Konfigurasi Overhead &amp; PPN
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Sesuai Perpres No. 12 Tahun 2021 Pasal 26, penyusunan HPS memperhitungkan keuntungan dan biaya overhead yang wajar (lazimnya 10%–15% untuk jasa konsultansi/konstruksi TI) serta PPN.
            </p>

            <div className="space-y-5 mt-6">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="overhead-input" className="font-medium text-slate-200">
                    Persentase Overhead &amp; Keuntungan Wajar (%)
                  </label>
                  <span className="font-mono text-cyan-300">
                    Rekomendasi: {regulationConfig.recommendedOverheadRange[0]}% –{' '}
                    {regulationConfig.recommendedOverheadRange[1]}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="overhead-input"
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={financials.overheadAndProfitPercent}
                    onChange={(e) =>
                      onChangeFinancials({
                        ...financials,
                        overheadAndProfitPercent: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-28 px-3 py-2 text-sm font-mono bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                  />
                  <div className="flex gap-1.5">
                    {[0, 10, 12, 15].map((presetPct) => (
                      <button
                        key={presetPct}
                        type="button"
                        onClick={() =>
                          onChangeFinancials({
                            ...financials,
                            overheadAndProfitPercent: presetPct,
                          })
                        }
                        className={`px-2.5 py-1.5 text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
                          financials.overheadAndProfitPercent === presetPct
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-semibold'
                            : 'bg-[#081326] text-slate-300 border-slate-700 hover:border-cyan-500/40'
                        }`}
                      >
                        {presetPct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label htmlFor="ppn-input" className="font-medium text-slate-200">
                    Persentase Pajak Pertambahan Nilai / PPN (%)
                  </label>
                  <span className="font-mono text-cyan-300">Default Regulasi: 11%</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="ppn-input"
                    type="number"
                    min={0}
                    max={25}
                    step={0.5}
                    value={financials.ppnPercent}
                    onChange={(e) =>
                      onChangeFinancials({
                        ...financials,
                        ppnPercent: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-28 px-3 py-2 text-sm font-mono bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                  />
                  <div className="flex gap-1.5">
                    {[0, 11, 12].map((taxPct) => (
                      <button
                        key={taxPct}
                        type="button"
                        onClick={() =>
                          onChangeFinancials({
                            ...financials,
                            ppnPercent: taxPct,
                          })
                        }
                        className={`px-2.5 py-1.5 text-xs font-mono border transition-colors whitespace-nowrap shrink-0 ${
                          financials.ppnPercent === taxPct
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-semibold'
                            : 'bg-[#081326] text-slate-300 border-slate-700 hover:border-cyan-500/40'
                        }`}
                      >
                        {taxPct === 0 ? '0% (Bebas)' : `${taxPct}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Rujukan: {regulationConfig.version}</span>
            <span>PPN Default: {regulationConfig.defaultPpnPercent}%</span>
          </div>
        </div>

        {/* Right: Automated Formula Synthesis Matrix */}
        <div className="lg:col-span-7 hud-panel p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-cyan-500/20">
              <div>
                <div className="text-xs font-mono text-cyan-400">
                  05. SINTESIS RUMUS PERHITUNGAN HPS / RAB OTOMATIS
                </div>
                <h2 className="text-xl font-display font-semibold text-white mt-1">
                  Rekapitulasi Struktur Biaya Proyek
                </h2>
              </div>
              <ShieldCheck className="w-6 h-6 text-cyan-400 shrink-0" />
            </div>

            <div className="divide-y divide-slate-800/90 font-mono text-xs mt-2">
              <div className="py-3 flex items-center justify-between gap-4">
                <div>
                  <span className="text-slate-300 font-sans font-medium">
                    A. Total Biaya Langsung Personel
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    {summary.activeRolesCount} Peran Aktif · {formatNumberID(summary.totalManMonths, 1)} Orang-Bulan (OB)
                  </span>
                </div>
                <span className="text-sm text-slate-100">{formatIDR(summary.totalPersonnelCost)}</span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4">
                <div>
                  <span className="text-slate-300 font-sans font-medium">
                    B. Total Biaya Langsung Non-Personel
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    {summary.activeNonPersonnelCount} Komponen Infrastruktur, Lisensi &amp; Pendukung
                  </span>
                </div>
                <span className="text-sm text-slate-100">{formatIDR(summary.totalNonPersonnelCost)}</span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4 bg-[#07142b] px-3">
                <div>
                  <span className="text-cyan-200 font-sans font-semibold">
                    1. Subtotal Biaya Langsung (A + B)
                  </span>
                  <span className="block text-[11px] text-cyan-400/80">
                    Total Biaya Personel + Total Biaya Non-Personel
                  </span>
                </div>
                <span className="text-sm font-semibold text-cyan-200">
                  {formatIDR(summary.directCostSubtotal)}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4 px-3">
                <div>
                  <span className="text-slate-300 font-sans font-medium">
                    2. Nilai Overhead &amp; Keuntungan Wajar ({financials.overheadAndProfitPercent}%)
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    Subtotal Biaya Langsung × {financials.overheadAndProfitPercent}%
                  </span>
                </div>
                <span className="text-sm text-slate-100">
                  {formatIDR(summary.overheadAndProfitValue)}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4 bg-[#07142b] px-3">
                <div>
                  <span className="text-cyan-200 font-sans font-semibold">
                    3. Harga Sebelum Pajak / DPP (1 + 2)
                  </span>
                  <span className="block text-[11px] text-cyan-400/80">
                    Subtotal Biaya Langsung + Nilai Overhead &amp; Keuntungan
                  </span>
                </div>
                <span className="text-sm font-semibold text-cyan-200">
                  {formatIDR(summary.dppBeforeTax)}
                </span>
              </div>

              <div className="py-3 flex items-center justify-between gap-4 px-3">
                <div>
                  <span className="text-slate-300 font-sans font-medium">
                    4. Nilai Pajak Pertambahan Nilai / PPN ({financials.ppnPercent}%)
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    DPP × {financials.ppnPercent}%
                  </span>
                </div>
                <span className="text-sm text-slate-100">{formatIDR(summary.ppnValue)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t-2 border-cyan-400/50 bg-[#050e1f] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                5. GRAND TOTAL ESTIMASI (DPP + PPN)
              </span>
              <div className="text-2xl sm:text-3xl font-mono font-bold text-white mt-0.5">
                {formatIDR(summary.grandTotalEstimation)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleSaveTrigger}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-[#0f2447] hover:bg-[#163263] text-cyan-200 border border-cyan-400/40 transition-colors whitespace-nowrap shrink-0"
              >
                {justSavedFeedback ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Tersimpan di Riwayat</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Simpan Simulasi</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onGoToWorksheet}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Buka Kertas Kerja HPS/RAB</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SYSTEM AUDIT & ANOMALY RADAR PANEL */}
      <SystemAuditPanel
        profile={profile}
        personnelItems={personnelItems}
        nonPersonnelItems={nonPersonnelItems}
        financials={financials}
        regulationConfig={regulationConfig}
        auditReport={auditReport}
        onUpdateAuditReport={onUpdateAuditReport}
        onApplyAdjustments={onApplyAuditAdjustments}
      />
    </div>
  );
};
