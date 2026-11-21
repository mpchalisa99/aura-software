export type QualificationTier = 'Junior' | 'Middle' | 'Senior' | 'Lead / Principal';

export interface RoleTariff {
  id: string;
  code: string;
  roleName: string;
  category: 'Management & Analysis' | 'Engineering & Development' | 'Data, AI & Security' | 'Quality & Documentation';
  rates: Record<QualificationTier, number>; // Rupiah per Man-Month (OB / Orang-Bulan)
  standardReference: string;
  description: string;
}

export interface RegulationReference {
  id: string;
  code: string;
  title: string;
  issuer: string;
  year: number;
  category: 'Perpres' | 'LKPP' | 'SBM Kemenkeu' | 'Standar Industri' | 'Perpajakan';
  summary: string;
  active: boolean;
}

export interface NonPersonnelStandard {
  id: string;
  category: 'Lisensi' | 'Server / Cloud' | 'Integrasi API' | 'Security Testing' | 'Dokumentasi' | 'SLA & Pemeliharaan';
  name: string;
  unit: string;
  defaultUnitPrice: number;
  referenceNote: string;
}

export interface RegulationConfigPayload {
  version: string;
  lastUpdated: string;
  sourceAuthority: string;
  defaultPpnPercent: number;
  recommendedOverheadRange: [number, number];
  regulations: RegulationReference[];
  roleTariffs: RoleTariff[];
  nonPersonnelStandards: NonPersonnelStandard[];
}

export type ProcurementScheme =
  | 'Swakelola Tipe I / Internal TNI AU'
  | 'Swakelola Tipe II (Instansi / Perguruan Tinggi)'
  | 'Tender / Seleksi Jasa Konsultansi Badan Usaha'
  | 'E-Purchasing Katalog Elektronik (E-Katalog LKPP)'
  | 'Pengadaan Langsung (< Rp 100 Juta / Rp 200 Juta)';

export type ComplexityLevel =
  | 'Rendah (Sistem Informasi Standar / CRUD)'
  | 'Menengah (Integrasi Multi-Satker & Portal Layanan)'
  | 'Tinggi (Sistem Komando Taktis / C4ISR & Analitik Real-Time)'
  | 'Kritis / Strategis (Pertahanan Siber & Avionik Terintegrasi)';

export interface ProjectProfile {
  projectName: string;
  proposingUnit: string;
  fiscalYear: string;
  procurementScheme: ProcurementScheme;
  complexity: ComplexityLevel;
  durationMonths: number;
  locationFactor: number; // Indeks Kemahalan Konstruksi / Regional multiplier (default 1.00)
  notes: string;
  highComplexityModules?: string[];
  specialIntegrations?: string[];
  layeredSecurityStandards?: string[];
}

export interface PersonnelAllocationItem {
  id: string;
  roleId: string;
  roleName: string;
  tier: QualificationTier;
  headcount: number; // Jumlah Personel (Orang)
  durationMonths: number; // Durasi Kerja (Bulan)
  standardRate: number; // Tarif Standar dari Tabel Regulasi (Rp / OB)
  overrideRate: number | null; // Override Tarif Proyek Ini (null jika ikut standar)
  taskDescription: string;
}

export interface NonPersonnelCostItem {
  id: string;
  category: 'Lisensi' | 'Server / Cloud' | 'Integrasi API' | 'Security Testing' | 'Dokumentasi' | 'SLA & Pemeliharaan';
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  notes: string;
}

export interface FinancialParameters {
  overheadAndProfitPercent: number; // e.g., 10% - 15%
  ppnPercent: number; // default 11%
  includeOverheadInPersonnel: boolean;
}

export interface CalculationSummary {
  totalManMonths: number;
  totalPersonnelHeadcount: number;
  activeRolesCount: number;
  activeNonPersonnelCount: number;
  totalPersonnelCost: number;
  totalNonPersonnelCost: number;
  directCostSubtotal: number; // Subtotal Biaya Langsung = Personel + Non-Personel
  overheadAndProfitValue: number; // Subtotal Biaya Langsung * (% Overhead/Keuntungan)
  dppBeforeTax: number; // Harga Sebelum Pajak (DPP) = Subtotal + Overhead
  ppnValue: number; // DPP * (% PPN)
  grandTotalEstimation: number; // DPP + PPN
}

export interface SavedSimulation {
  id: string;
  savedAt: string;
  regulationVersion: string;
  profile: ProjectProfile;
  personnelItems: PersonnelAllocationItem[];
  nonPersonnelItems: NonPersonnelCostItem[];
  financials: FinancialParameters;
  summary: CalculationSummary;
}

export type SyncStatus = 'SYNCED' | 'OFFLINE CACHE' | 'SYNCING' | 'CUSTOM OVERRIDE';

export type AuditStatusLevel =
  | 'WAJAR / COMPLIANT'
  | 'PERINGATAN / PERLU REVIU'
  | 'ANOMALI KRITIS / INDIKASI KEMAHALAN';

export interface AuditFindingItem {
  id: string;
  severity: 'COMPLIANT' | 'WARNING' | 'CRITICAL';
  category: 'REGULASI_TARIF' | 'KOMPLEKSITAS_TEKNIS' | 'PARAMETER_KEUANGAN' | 'VOLUME_DURASI' | 'KEAMANAN_SIBER';
  title: string;
  diagnosis: string;
  regulationCitation: string;
  technicalContextJustification: string;
  deterministicMetric: string;
}

export interface AuditAdjustmentAction {
  id: string;
  actionType:
    | 'NORMALIZE_OVERRIDE_RATE'
    | 'CAP_PERSONNEL_DURATION'
    | 'ADJUST_OVERHEAD_PERCENT'
    | 'ADJUST_PPN_PERCENT'
    | 'DEDUPLICATE_NON_PERSONNEL'
    | 'REDUCE_EXCESS_HEADCOUNT'
    | 'ADJUST_NON_PERSONNEL_QTY';
  targetId?: string;
  title: string;
  rationale: string;
  regulationCitation: string;
  currentValueLabel: string;
  recommendedValueLabel: string;
  recommendedNumericValue: number;
  exactDirectCostDelta: number; // Deterministic change in Direct Cost (Rp)
  exactGrandTotalDelta: number; // Deterministic change in Grand Total incl. Overhead & PPN (Rp)
}

export interface AuditReportResult {
  status: AuditStatusLevel;
  source: 'AI_SERVER_AUDIT' | 'LOCAL_HEURISTIC_ENGINE';
  modelUsed: string;
  auditedAt: string;
  regulationVersion: string;
  executiveSummary: string;
  technicalComplexityAssessment: {
    complexityScore: number; // 1 - 100
    highComplexityCount: number;
    specialIntegrationCount: number;
    securityStandardCount: number;
    workloadJustificationSummary: string;
  };
  findings: AuditFindingItem[];
  solutions: {
    summaryAdvice: string;
    adjustments: AuditAdjustmentAction[];
    currentGrandTotal: number;
    projectedGrandTotalAfterAdjustments: number;
    totalMeasuredSavings: number;
  };
}
