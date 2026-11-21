import {
  DEFAULT_REGULATION_CONFIG,
  HIGH_COMPLEXITY_MODULE_OPTIONS,
  LAYERED_SECURITY_STANDARD_OPTIONS,
  SPECIAL_INTEGRATION_OPTIONS,
} from '../data/defaultRegulations';
import {
  ArchitecturalTierCode,
  CalculationSummary,
  ComplexityLevel,
  DraftEstimateNonPersonnel,
  DraftEstimatePayload,
  DraftEstimatePersonnel,
  FinancialParameters,
  NonPersonnelCostItem,
  PersonnelAllocationItem,
  ProcurementScheme,
  QualificationTier,
  RegulationConfigPayload,
  RoleTariff,
} from '../types/aura';
import { calculateProjectSummary, formatIDR, formatNumberID } from './formatters';

export interface ArchitecturalTierMeta {
  tier: ArchitecturalTierCode;
  tierLabel: string;
  complexityLevel: ComplexityLevel;
  procurementScheme: ProcurementScheme;
  complexityScore: number;
  defaultDurationMonths: number;
  minDurationMonths: number;
  maxDurationMonths: number;
  recommendedOverheadPercent: number;
  isUltraSimple?: boolean;
}

const VALID_NON_PERSONNEL_CATEGORIES: NonPersonnelCostItem['category'][] = [
  'Lisensi',
  'Server / Cloud',
  'Integrasi API',
  'Security Testing',
  'Dokumentasi',
  'SLA & Pemeliharaan',
];

const VALID_COMPLEXITY_LEVELS: ComplexityLevel[] = [
  'Rendah (Sistem Informasi Standar / CRUD)',
  'Menengah (Integrasi Multi-Satker & Portal Layanan)',
  'Tinggi (Sistem Komando Taktis / C4ISR & Analitik Real-Time)',
  'Kritis / Strategis (Pertahanan Siber & Avionik Terintegrasi)',
];

const VALID_PROCUREMENT_SCHEMES: ProcurementScheme[] = [
  'Swakelola Tipe I / Internal TNI AU',
  'Swakelola Tipe II (Instansi / Perguruan Tinggi)',
  'Tender / Seleksi Jasa Konsultansi Badan Usaha',
  'E-Purchasing Katalog Elektronik (E-Katalog LKPP)',
  'Pengadaan Langsung (< Rp 100 Juta / Rp 200 Juta)',
];

/**
 * Resolves any roleId, code (TA-01..TA-10), or role name to the exact RoleTariff
 * from the active RegulationConfigPayload.
 */
export function resolveRoleTariff(
  roleIdOrCode: string | undefined,
  roleName: string | undefined,
  regulationConfig: RegulationConfigPayload
): RoleTariff {
  const tariffs =
    regulationConfig?.roleTariffs?.length > 0
      ? regulationConfig.roleTariffs
      : DEFAULT_REGULATION_CONFIG.roleTariffs;

  const idNorm = (roleIdOrCode || '').trim().toLowerCase();
  const nameNorm = (roleName || '').trim().toLowerCase();

  // 1. Exact ID or code match (e.g. 'role-backend', 'ta-04')
  const exact = tariffs.find(
    (r) =>
      r.id.toLowerCase() === idNorm ||
      r.code.toLowerCase() === idNorm ||
      r.roleName.toLowerCase() === nameNorm
  );
  if (exact) return exact;

  // 2. Semantic match based on combined roleId + roleName
  const combined = `${idNorm} ${nameNorm}`;
  const findById = (id: string) => tariffs.find((r) => r.id === id) || tariffs[0];

  if (
    combined.includes('ta-01') ||
    combined.includes('project manager') ||
    combined.includes('team lead') ||
    combined.includes('scrum') ||
    idNorm === 'role-pm'
  ) {
    return findById('role-pm');
  }
  if (
    combined.includes('ta-02') ||
    combined.includes('architect') ||
    combined.includes('analyst') ||
    combined.includes('analis') ||
    idNorm === 'role-sa' ||
    idNorm === 'role-arch'
  ) {
    return findById('role-sa');
  }
  if (
    combined.includes('ta-03') ||
    combined.includes('ui/ux') ||
    combined.includes('uiux') ||
    combined.includes('design') ||
    combined.includes('desain')
  ) {
    return findById('role-uiux');
  }
  if (
    combined.includes('ta-06') ||
    combined.includes('mobile') ||
    combined.includes('android') ||
    combined.includes('ios') ||
    combined.includes('flutter')
  ) {
    return findById('role-mobile');
  }
  if (
    combined.includes('ta-07') ||
    combined.includes('ai') ||
    combined.includes('data') ||
    combined.includes('telemetry') ||
    combined.includes('telemetri') ||
    combined.includes('machine learning') ||
    combined.includes('ml')
  ) {
    return findById('role-ai-data');
  }
  if (
    combined.includes('ta-08') ||
    combined.includes('qa') ||
    combined.includes('tester') ||
    combined.includes('security') ||
    combined.includes('appsec') ||
    combined.includes('pentest') ||
    combined.includes('quality')
  ) {
    return findById('role-qa-sec');
  }
  if (
    combined.includes('ta-09') ||
    combined.includes('devops') ||
    combined.includes('cloud') ||
    combined.includes('infra') ||
    combined.includes('sre') ||
    combined.includes('cluster')
  ) {
    return findById('role-devops');
  }
  if (
    combined.includes('ta-10') ||
    combined.includes('writer') ||
    combined.includes('trainer') ||
    combined.includes('dokumentasi')
  ) {
    return findById('role-tw');
  }
  if (
    combined.includes('ta-05') ||
    combined.includes('frontend') ||
    combined.includes('front-end') ||
    combined.includes('gis') ||
    combined.includes('web')
  ) {
    return findById('role-frontend');
  }
  if (
    combined.includes('ta-04') ||
    combined.includes('backend') ||
    combined.includes('back-end') ||
    combined.includes('full-stack') ||
    combined.includes('fullstack') ||
    combined.includes('developer') ||
    combined.includes('engineer') ||
    idNorm === 'role-dev'
  ) {
    return findById('role-backend');
  }

  return findById('role-backend');
}

export function normalizeQualificationTier(tier: string | undefined): QualificationTier {
  const norm = (tier || '').trim().toLowerCase();
  if (norm.includes('lead') || norm.includes('principal') || norm.includes('utama')) {
    return 'Lead / Principal';
  }
  if (norm.includes('senior') || norm.includes('madya')) {
    return 'Senior';
  }
  if (norm.includes('junior') || norm.includes('pratama') || norm.includes('muda')) {
    return 'Junior';
  }
  return 'Middle';
}

export function normalizeNonPersonnelCategory(
  category: string | undefined,
  itemName?: string
): NonPersonnelCostItem['category'] {
  const combined = `${category || ''} ${itemName || ''}`.toLowerCase();
  const exact = VALID_NON_PERSONNEL_CATEGORIES.find(
    (c) => c.toLowerCase() === (category || '').trim().toLowerCase()
  );
  if (exact) return exact;

  if (combined.includes('cloud') || combined.includes('server') || combined.includes('vps') || combined.includes('hosting')) {
    return 'Server / Cloud';
  }
  if (combined.includes('lisensi') || combined.includes('licen') || combined.includes('map') || combined.includes('gis')) {
    return 'Lisensi';
  }
  if (combined.includes('api') || combined.includes('integrasi') || combined.includes('gateway') || combined.includes('feed') || combined.includes('sdk')) {
    return 'Integrasi API';
  }
  if (combined.includes('security') || combined.includes('pentest') || combined.includes('penetration') || combined.includes('kriptografi') || combined.includes('red-team') || combined.includes('audit')) {
    return 'Security Testing';
  }
  if (combined.includes('sla') || combined.includes('pemeliharaan') || combined.includes('maintenance') || combined.includes('garansi') || combined.includes('helpdesk')) {
    return 'SLA & Pemeliharaan';
  }
  return 'Dokumentasi';
}

/**
 * Extracts an explicit duration in months from natural Indonesian/English prompt text (e.g. "12 bulan", "6 bln").
 */
export function extractRequestedMonths(userMsg: string): number | null {
  const match = userMsg.match(/\b(\d{1,2})\s*(bulan|bln|months?|mos?)\b/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  if (Number.isFinite(val) && val >= 1 && val <= 36) {
    return val;
  }
  return null;
}

/**
 * Intelligent 4-Tier Architectural Classifier.
 * Sharply separates utility/simple apps (Tier 1) from standard Satker portals (Tier 2),
 * real-time spatial/telemetry platforms like Flightradar24 (Tier 3),
 * and strategic C4ISR / cyber defense systems (Tier 4).
 */
export function classifyArchitecturalTier(userMsg: string): ArchitecturalTierMeta {
  const lower = userMsg.toLowerCase();

  const tier4Keywords = [
    'c4isr',
    'pertahanan siber',
    'cyber defense',
    'kohanudnas',
    'sensor fusion',
    'multi-radar',
    'multiradar',
    'komando pertahanan',
    'pertahanan udara',
    'kriptografi militer',
    'avionik',
    'satsiber',
    'peperangan elektronika',
    'strategis',
    'kritis',
    'soc militer',
    'sistem senjata',
    'komando tempur',
    'komando operasi udara',
  ];

  const tier3Keywords = [
    'flightradar',
    'flight radar',
    'pelacakan pesawat',
    'lacak pesawat',
    'ads-b',
    'adsb',
    'ais',
    'real-time',
    'realtime',
    'telemetri',
    'telemetry',
    'spasial',
    'gis',
    'peta interaktif',
    'peta taktis',
    'stream',
    'streaming',
    'radar',
    'tracking',
    'pelacakan',
    'iot',
    'ai ',
    ' ai',
    'machine learning',
    'analitik prediktif',
    'multi-platform',
    'penerbangan',
    'drone',
    'uav',
    'satelit',
  ];

  const tier1UltraSimpleKeywords = [
    'kalkulator',
    'calculator',
    'landing page',
    'form statis',
    'formulir statis',
    'halaman statis',
    'konverter',
    'converter',
    'stopwatch',
    'timer',
    'to-do',
    'todo',
    'catatan harian',
  ];

  const tier1Keywords = [
    ...tier1UltraSimpleKeywords,
    'sederhana',
    'simple',
    'ringan',
    'pencatatan',
    'absensi',
    'profil',
    'company profile',
    'web profil',
    'crud',
    'buku tamu',
    'utilitas',
    'utility',
    'kecil',
    'mini',
  ];

  const tier2Keywords = [
    'e-office',
    'eoffice',
    'administrasi',
    'personel',
    'lanud',
    'satker',
    'inventori',
    'inventory',
    'logistik',
    'portal',
    'surat',
    'disposisi',
    'simpeg',
    'kepegawaian',
    'arsip',
    'e-arsip',
    'aset',
    'gudang',
    'keuangan',
    'anggaran',
    'pelaporan',
    'erp',
    'layanan internal',
    'manajemen',
    'multi-satker',
  ];

  const countHits = (list: string[]) =>
    list.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0);

  const t4Hits = countHits(tier4Keywords);
  const t3Hits = countHits(tier3Keywords);
  const t2Hits = countHits(tier2Keywords);
  const t1Hits = countHits(tier1Keywords);
  const t1UltraHits = countHits(tier1UltraSimpleKeywords);
  const hasExplicitEnterpriseScope =
    lower.includes('e-office') ||
    lower.includes('eoffice') ||
    lower.includes('portal') ||
    lower.includes('erp') ||
    lower.includes('multi-satker') ||
    lower.includes('lanud') ||
    lower.includes('satker');

  // Explicit Tier 4 triggers (strategic defense, C4ISR, cyber defense + telemetry, sensor fusion)
  if (
    t4Hits >= 1 &&
    (t4Hits >= 2 ||
      lower.includes('c4isr') ||
      lower.includes('pertahanan siber') ||
      lower.includes('sensor fusion') ||
      lower.includes('komando pertahanan') ||
      lower.includes('kohanudnas') ||
      lower.includes('kriptografi militer') ||
      lower.includes('avionik') ||
      (lower.includes('pertahanan') && (lower.includes('radar') || lower.includes('siber') || lower.includes('telemetri'))))
  ) {
    return {
      tier: 'TIER 4',
      tierLabel: 'TIER 4 · STRATEGIS / C4ISR & PERTAHANAN SIBER',
      complexityLevel: 'Kritis / Strategis (Pertahanan Siber & Avionik Terintegrasi)',
      procurementScheme: 'Tender / Seleksi Jasa Konsultansi Badan Usaha',
      complexityScore: 95,
      defaultDurationMonths: 14,
      minDurationMonths: 12,
      maxDurationMonths: 18,
      recommendedOverheadPercent: 12,
    };
  }

  // Explicit Tier 3 triggers (Flightradar24, real-time tracking, GIS spatial, ADS-B, telemetry, AI)
  if (t3Hits >= 1) {
    return {
      tier: 'TIER 3',
      tierLabel: 'TIER 3 · REAL-TIME, SPASIAL & TELEMETRI',
      complexityLevel: 'Tinggi (Sistem Komando Taktis / C4ISR & Analitik Real-Time)',
      procurementScheme: 'Tender / Seleksi Jasa Konsultansi Badan Usaha',
      complexityScore: 84,
      defaultDurationMonths: 10,
      minDurationMonths: 8,
      maxDurationMonths: 12,
      recommendedOverheadPercent: 10,
    };
  }

  // Tier 1 triggers (calculator, simple app, static form, landing page, simple CRUD, absensi/profil sederhana)
  if (t1UltraHits >= 1 || (t1Hits >= 1 && (!hasExplicitEnterpriseScope || t1Hits >= 2) && t2Hits <= 1)) {
    const isUltraSimple =
      t1UltraHits >= 1 && !lower.includes('database') && !lower.includes('crud') && !lower.includes('absensi');
    return {
      tier: 'TIER 1',
      tierLabel: 'TIER 1 · UTILITAS / APLIKASI STANDAR',
      complexityLevel: 'Rendah (Sistem Informasi Standar / CRUD)',
      procurementScheme: 'Pengadaan Langsung (< Rp 100 Juta / Rp 200 Juta)',
      complexityScore: isUltraSimple ? 15 : 22,
      defaultDurationMonths: isUltraSimple ? 1 : 2,
      minDurationMonths: 1,
      maxDurationMonths: 2,
      recommendedOverheadPercent: 10,
      isUltraSimple,
    };
  }

  // Tier 2 default (portal satker, e-office, inventori, administrasi, sistem informasi standar)
  return {
    tier: 'TIER 2',
    tierLabel: 'TIER 2 · SISTEM INFORMASI MENENGAH / PORTAL SATKER',
    complexityLevel: 'Menengah (Integrasi Multi-Satker & Portal Layanan)',
    procurementScheme: 'E-Purchasing Katalog Elektronik (E-Katalog LKPP)',
    complexityScore: 46,
    defaultDurationMonths: 4,
    minDurationMonths: 3,
    maxDurationMonths: 5,
    recommendedOverheadPercent: 10,
  };
}

/**
 * Builds deterministic PersonnelAllocationItem[] and CalculationSummary for any DraftEstimatePayload
 * strictly using the active regulationConfig billing rates (zero hardcoded rates).
 */
export function buildPricedItemsFromDraft(
  draft: DraftEstimatePayload,
  regulationConfig: RegulationConfigPayload
): {
  personnelItems: PersonnelAllocationItem[];
  nonPersonnelItems: NonPersonnelCostItem[];
  financials: FinancialParameters;
  summary: CalculationSummary;
} {
  const activeConfig =
    regulationConfig?.roleTariffs?.length > 0 ? regulationConfig : DEFAULT_REGULATION_CONFIG;

  const projectDuration = Math.max(1, Math.round(draft.durationMonths || 4));
  const locationFactor = Number.isFinite(draft.locationFactor) && draft.locationFactor > 0
    ? draft.locationFactor
    : 1.0;

  const personnelItems: PersonnelAllocationItem[] = (draft.personnel || []).map((p, idx) => {
    const matchedRole = resolveRoleTariff(p.roleId, p.roleName, activeConfig);
    const tier = normalizeQualificationTier(p.tier);
    const standardRate = matchedRole.rates[tier] ?? matchedRole.rates.Middle;
    const safeHeadcount = Math.max(1, Math.min(8, Math.round(p.headcount || 1)));
    const safeDuration = Math.max(
      0.5,
      Math.min(projectDuration, Number(p.durationMonths) || projectDuration)
    );

    return {
      id: `draft-p-${idx}-${matchedRole.id}`,
      roleId: matchedRole.id,
      roleName: matchedRole.roleName,
      tier,
      headcount: safeHeadcount,
      durationMonths: safeDuration,
      standardRate,
      overrideRate: null,
      taskDescription: p.taskDescription || matchedRole.description,
    };
  });

  const nonPersonnelItems: NonPersonnelCostItem[] = (draft.nonPersonnel || []).map((np, idx) => ({
    id: `draft-np-${idx}`,
    category: normalizeNonPersonnelCategory(np.category, np.itemName),
    itemName: np.itemName || 'Komponen Pendukung Teknis',
    quantity: Math.max(1, Number(np.quantity) || 1),
    unit: np.unit || 'Paket',
    unitPrice: Math.max(0, Math.round(Number(np.unitPrice) || 0)),
    notes: np.notes || 'Sesuai acuan standar regulasi aktif',
  }));

  const overheadPct =
    typeof draft.recommendedOverheadPercent === 'number' &&
    draft.recommendedOverheadPercent >= 0 &&
    draft.recommendedOverheadPercent <= 15
      ? draft.recommendedOverheadPercent
      : 10;

  const financials: FinancialParameters = {
    overheadAndProfitPercent: overheadPct,
    ppnPercent: activeConfig.defaultPpnPercent || 11,
    includeOverheadInPersonnel: false,
  };

  const summary = calculateProjectSummary(
    personnelItems,
    nonPersonnelItems,
    financials,
    locationFactor
  );

  return { personnelItems, nonPersonnelItems, financials, summary };
}

/**
 * Sanitizes and normalizes an AI-generated DraftEstimatePayload so every roleId, tier,
 * checkbox option, complexityLevel, and procurementScheme matches the app's exact schemas
 * and active regulation table.
 */
export function normalizeDraftEstimate(
  rawDraft: Partial<DraftEstimatePayload>,
  userMsg: string,
  regulationConfig: RegulationConfigPayload
): DraftEstimatePayload {
  const activeConfig =
    regulationConfig?.roleTariffs?.length > 0 ? regulationConfig : DEFAULT_REGULATION_CONFIG;
  const fallbackMeta = classifyArchitecturalTier(userMsg);

  const tierCode: ArchitecturalTierCode =
    rawDraft.tierClassification === 'TIER 1' ||
    rawDraft.tierClassification === 'TIER 2' ||
    rawDraft.tierClassification === 'TIER 3' ||
    rawDraft.tierClassification === 'TIER 4'
      ? rawDraft.tierClassification
      : fallbackMeta.tier;

  const tierLabelMap: Record<ArchitecturalTierCode, string> = {
    'TIER 1': 'TIER 1 · UTILITAS / APLIKASI STANDAR',
    'TIER 2': 'TIER 2 · SISTEM INFORMASI MENENGAH / PORTAL SATKER',
    'TIER 3': 'TIER 3 · REAL-TIME, SPASIAL & TELEMETRI',
    'TIER 4': 'TIER 4 · STRATEGIS / C4ISR & PERTAHANAN SIBER',
  };

  const complexityMap: Record<ArchitecturalTierCode, ComplexityLevel> = {
    'TIER 1': 'Rendah (Sistem Informasi Standar / CRUD)',
    'TIER 2': 'Menengah (Integrasi Multi-Satker & Portal Layanan)',
    'TIER 3': 'Tinggi (Sistem Komando Taktis / C4ISR & Analitik Real-Time)',
    'TIER 4': 'Kritis / Strategis (Pertahanan Siber & Avionik Terintegrasi)',
  };

  const matchedComplexity =
    VALID_COMPLEXITY_LEVELS.find((c) => c === rawDraft.complexityLevel) ||
    complexityMap[tierCode];

  const matchedScheme =
    VALID_PROCUREMENT_SCHEMES.find((s) => s === rawDraft.procurementScheme) ||
    fallbackMeta.procurementScheme;

  const durationMonths = Math.max(
    1,
    Math.min(24, Math.round(Number(rawDraft.durationMonths) || fallbackMeta.defaultDurationMonths))
  );

  const matchOptions = (inputs: string[] | undefined, allowed: string[]): string[] => {
    if (!Array.isArray(inputs) || inputs.length === 0) return [];
    const matched = new Set<string>();
    inputs.forEach((raw) => {
      const lowerRaw = String(raw || '').toLowerCase();
      const exact = allowed.find((opt) => opt.toLowerCase() === lowerRaw);
      if (exact) {
        matched.add(exact);
        return;
      }
      // Keyword match onto canonical checkbox options
      const partial = allowed.find((opt) => {
        const words = opt
          .toLowerCase()
          .replace(/[()/]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4);
        return words.some((w) => lowerRaw.includes(w));
      });
      if (partial) matched.add(partial);
    });
    return Array.from(matched);
  };

  const normalizedPersonnel: DraftEstimatePersonnel[] = Array.isArray(rawDraft.personnel)
    ? rawDraft.personnel.map((p) => {
        const resolved = resolveRoleTariff(p.roleId, p.roleName, activeConfig);
        const tier = normalizeQualificationTier(p.tier);
        return {
          roleId: resolved.id,
          roleName: resolved.roleName,
          tier,
          headcount: Math.max(1, Math.min(8, Math.round(Number(p.headcount) || 1))),
          durationMonths: Math.max(
            0.5,
            Math.min(durationMonths, Number(p.durationMonths) || durationMonths)
          ),
          taskDescription: p.taskDescription || resolved.description,
        };
      })
    : [];

  // Deduplicate personnel rows by roleId + tier to prevent audit duplication flags
  const dedupedPersonnelMap = new Map<string, DraftEstimatePersonnel>();
  normalizedPersonnel.forEach((item) => {
    const key = item.roleId;
    if (!dedupedPersonnelMap.has(key)) {
      dedupedPersonnelMap.set(key, item);
    } else {
      const prev = dedupedPersonnelMap.get(key)!;
      prev.headcount = Math.min(8, prev.headcount + item.headcount);
      prev.durationMonths = Math.max(prev.durationMonths, item.durationMonths);
    }
  });

  const normalizedNonPersonnel: DraftEstimateNonPersonnel[] = Array.isArray(rawDraft.nonPersonnel)
    ? rawDraft.nonPersonnel.map((np) => ({
        category: normalizeNonPersonnelCategory(np.category, np.itemName),
        itemName: np.itemName || 'Komponen Pendukung Teknis',
        quantity: Math.max(1, Number(np.quantity) || 1),
        unit: np.unit || 'Paket',
        unitPrice: Math.max(0, Math.round(Number(np.unitPrice) || 0)),
        notes: np.notes || 'Acuan standar biaya aktif',
      }))
    : [];

  const defaultScoreMap: Record<ArchitecturalTierCode, number> = {
    'TIER 1': 18,
    'TIER 2': 46,
    'TIER 3': 84,
    'TIER 4': 95,
  };

  const rawScore = Number(rawDraft.complexityScore);
  const complexityScore =
    Number.isFinite(rawScore) && rawScore >= 5 && rawScore <= 100
      ? Math.round(rawScore)
      : defaultScoreMap[tierCode];

  return {
    projectName: (rawDraft.projectName || '').trim() || `Estimasi Proyek: ${userMsg.slice(0, 60)}`,
    proposingUnit:
      (rawDraft.proposingUnit || '').trim() ||
      'Disinfolahtaau (Dinas Informasi dan Pengolahan Data Angkatan Udara)',
    procurementScheme: matchedScheme,
    complexityLevel: matchedComplexity,
    tierClassification: tierCode,
    tierLabel: rawDraft.tierLabel || tierLabelMap[tierCode],
    complexityScore,
    recommendedOverheadPercent:
      typeof rawDraft.recommendedOverheadPercent === 'number'
        ? rawDraft.recommendedOverheadPercent
        : tierCode === 'TIER 4'
        ? 12
        : 10,
    durationMonths,
    locationFactor:
      Number.isFinite(Number(rawDraft.locationFactor)) && Number(rawDraft.locationFactor) > 0
        ? Number(rawDraft.locationFactor)
        : 1.0,
    highComplexityModules:
      tierCode === 'TIER 1' || tierCode === 'TIER 2'
        ? []
        : matchOptions(rawDraft.highComplexityModules, HIGH_COMPLEXITY_MODULE_OPTIONS),
    specialIntegrations:
      tierCode === 'TIER 1'
        ? []
        : matchOptions(rawDraft.specialIntegrations, SPECIAL_INTEGRATION_OPTIONS),
    layeredSecurityStandards:
      tierCode === 'TIER 1'
        ? []
        : matchOptions(rawDraft.layeredSecurityStandards, LAYERED_SECURITY_STANDARD_OPTIONS),
    personnel: Array.from(dedupedPersonnelMap.values()),
    nonPersonnel: normalizedNonPersonnel,
  };
}

/**
 * Generates a rich, sharply contrasted 4-Tier deterministic architectural estimate
 * using the active regulationConfig billing rates (REG-PBJ-2026.04) and returns both
 * an architectural rationale reply and a fully compliant DraftEstimatePayload.
 */
export function generateDeterministicArchitecturalEstimate(
  userMsg: string,
  regulationConfig: RegulationConfigPayload,
  modeLabel: 'LOCAL_FALLBACK' | 'SERVER_FALLBACK' = 'LOCAL_FALLBACK'
): { reply: string; draftEstimate: DraftEstimatePayload } {
  const activeConfig =
    regulationConfig?.roleTariffs?.length > 0 ? regulationConfig : DEFAULT_REGULATION_CONFIG;
  const meta = classifyArchitecturalTier(userMsg);
  const lower = userMsg.toLowerCase();

  const requestedMonths = extractRequestedMonths(userMsg);
  const duration = requestedMonths
    ? Math.max(meta.minDurationMonths, Math.min(meta.maxDurationMonths, requestedMonths))
    : meta.defaultDurationMonths;

  const scaleDur = (ratio: number, minM = 1) =>
    Math.max(minM, Math.min(duration, Math.round(duration * ratio)));

  let draft: DraftEstimatePayload;
  let rationaleBody = '';

  if (meta.tier === 'TIER 1') {
    const isCalculator = lower.includes('kalkulator') || lower.includes('calculator');
    const isLanding = lower.includes('landing') || lower.includes('profil');
    const isAbsensi = lower.includes('absensi') || lower.includes('pencatatan') || lower.includes('crud');

    const projectName = isCalculator
      ? 'Aplikasi Utilitas Kalkulator & Perhitungan Standar Satker'
      : isLanding
      ? 'Portal Web Profil & Halaman Informasi Statis Satker'
      : isAbsensi
      ? 'Aplikasi Pencatatan & Administrasi Ringan (CRUD Standar)'
      : `Aplikasi Utilitas Standar: ${userMsg.slice(0, 52)}`;

    const personnel: DraftEstimatePersonnel[] = meta.isUltraSimple
      ? [
          {
            roleId: 'role-frontend',
            roleName: 'Frontend Developer',
            tier: 'Junior',
            headcount: 1,
            durationMonths: duration,
            taskDescription: 'Implementasi antarmuka aplikasi utilitas, logika perhitungan klien, dan tampilan responsif.',
          },
          {
            roleId: 'role-uiux',
            roleName: 'UI/UX Designer (Tactical Interface)',
            tier: 'Junior',
            headcount: 1,
            durationMonths: Math.max(0.5, duration * 0.5),
            taskDescription: 'Desain tata letak antarmuka ringan, ikonografi, dan panduan kemudahan penggunaan.',
          },
          {
            roleId: 'role-qa-sec',
            roleName: 'QA & Security Tester (AppSec)',
            tier: 'Junior',
            headcount: 1,
            durationMonths: Math.max(0.5, duration * 0.5),
            taskDescription: 'Pengujian akurasi fungsi, validasi input, dan uji lintas perangkat mobile/desktop.',
          },
        ]
      : [
          {
            roleId: 'role-frontend',
            roleName: 'Frontend Developer',
            tier: 'Middle',
            headcount: 1,
            durationMonths: duration,
            taskDescription: 'Pengembangan antarmuka form pencatatan, tabel data, dan ekspor laporan sederhana.',
          },
          {
            roleId: 'role-backend',
            roleName: 'Backend Developer',
            tier: 'Junior',
            headcount: 1,
            durationMonths: duration,
            taskDescription: 'Pengembangan API CRUD ringan, autentikasi dasar, dan skema database standar.',
          },
          {
            roleId: 'role-qa-sec',
            roleName: 'QA & Security Tester (AppSec)',
            tier: 'Junior',
            headcount: 1,
            durationMonths: Math.max(1, Math.round(duration * 0.5)),
            taskDescription: 'Pengujian fungsional CRUD, validasi data, dan UAT pengguna.',
          },
        ];

    const nonPersonnel: DraftEstimateNonPersonnel[] = [
      {
        category: 'Server / Cloud',
        itemName: 'Hosting Web Ringan / Shared VPS Staging & Produksi',
        quantity: duration,
        unit: 'Bulan',
        unitPrice: meta.isUltraSimple ? 1500000 : 2500000,
        notes: 'Kebutuhan komputasi ringan tanpa klaster terdistribusi',
      },
      {
        category: 'Dokumentasi',
        itemName: 'Panduan Pengguna Singkat (User Guide) & Manual Instalasi',
        quantity: 1,
        unit: 'Kegiatan',
        unitPrice: meta.isUltraSimple ? 3500000 : 5000000,
        notes: 'Dokumentasi operasional dasar dan serah terima kode sumber',
      },
    ];

    draft = {
      projectName,
      proposingUnit: 'Satuan Kerja Pengusul Internal TNI AU',
      procurementScheme: meta.procurementScheme,
      complexityLevel: meta.complexityLevel,
      tierClassification: 'TIER 1',
      tierLabel: meta.tierLabel,
      complexityScore: meta.complexityScore,
      recommendedOverheadPercent: meta.recommendedOverheadPercent,
      durationMonths: duration,
      locationFactor: 1.0,
      highComplexityModules: [],
      specialIntegrations: [],
      layeredSecurityStandards: [],
      personnel,
      nonPersonnel,
    };

    rationaleBody =
      `Rasionalisasi Arsitektur (TIER 1 — Skor ${meta.complexityScore}/100): ` +
      `Kebutuhan ini diklasifikasikan sebagai aplikasi utilitas/standar dengan logika deterministik ringan. ` +
      `Struktur biaya tetap hemat karena TIDAK membutuhkan pipeline data real-time, lisensi GIS/peta spasial, arsitek sistem terdistribusi, AI Engineer, maupun klaster server berskala besar. ` +
      `Cukup ditangani tim ringkas (${personnel.length} personel kualifikasi Junior–Middle) selama ${duration} bulan dengan skema Pengadaan Langsung.`;
  } else if (meta.tier === 'TIER 2') {
    const isEoffice = lower.includes('e-office') || lower.includes('eoffice') || lower.includes('surat') || lower.includes('administrasi');
    const isInventory = lower.includes('inventori') || lower.includes('logistik') || lower.includes('aset') || lower.includes('gudang');

    const projectName = isEoffice
      ? 'Portal E-Office, Tata Naskah Dinas & Administrasi Personel Lanud'
      : isInventory
      ? 'Sistem Informasi Manajemen Inventori & Logistik Satker TNI AU'
      : `Sistem Informasi Portal Layanan Satker: ${userMsg.slice(0, 48)}`;

    const personnel: DraftEstimatePersonnel[] = [
      {
        roleId: 'role-pm',
        roleName: 'Project Manager / Team Leader',
        tier: 'Middle',
        headcount: 1,
        durationMonths: duration,
        taskDescription: 'Pengendalian jadwal, koordinasi Satker/Lanud, dan kendali mutu serah terima.',
      },
      {
        roleId: 'role-sa',
        roleName: 'System Analyst / Solution Architect',
        tier: 'Middle',
        headcount: 1,
        durationMonths: scaleDur(0.75, 2),
        taskDescription: 'Pemetaan proses bisnis naskah dinas/layanan internal, desain ERD, dan dokumen SRS.',
      },
      {
        roleId: 'role-uiux',
        roleName: 'UI/UX Designer (Tactical Interface)',
        tier: 'Middle',
        headcount: 1,
        durationMonths: scaleDur(0.5, 2),
        taskDescription: 'Desain antarmuka portal layanan responsif dan alur kerja operator administrasi.',
      },
      {
        roleId: 'role-backend',
        roleName: 'Backend Developer',
        tier: 'Middle',
        headcount: 1,
        durationMonths: duration,
        taskDescription: 'Pengembangan REST API layanan internal, manajemen RBAC, disposisi, dan integrasi SSO/TTE.',
      },
      {
        roleId: 'role-frontend',
        roleName: 'Frontend Developer',
        tier: 'Middle',
        headcount: 1,
        durationMonths: duration,
        taskDescription: 'Implementasi web portal, dashboard pimpinan, dan modul pelaporan administrasi.',
      },
      {
        roleId: 'role-qa-sec',
        roleName: 'QA & Security Tester (AppSec)',
        tier: 'Middle',
        headcount: 1,
        durationMonths: scaleDur(0.5, 2),
        taskDescription: 'Pengujian fungsional end-to-end, UAT bersama pengguna, dan pemeriksaan kerentanan dasar.',
      },
      {
        roleId: 'role-tw',
        roleName: 'Technical Writer & Trainer',
        tier: 'Middle',
        headcount: 1,
        durationMonths: scaleDur(0.5, 2),
        taskDescription: 'Penyusunan dokumen BPO, manual admin, dan pelatihan operator Satker/Lanud.',
      },
    ];

    const nonPersonnel: DraftEstimateNonPersonnel[] = [
      {
        category: 'Server / Cloud',
        itemName: 'Cloud VPS Staging & Produksi Standar Instansi',
        quantity: duration,
        unit: 'Bulan',
        unitPrice: 8500000,
        notes: 'Lingkungan komputasi dan backup standar selama masa pengembangan',
      },
      {
        category: 'Integrasi API',
        itemName: 'Gateway Integrasi API Antar-Satker / SSO & Modul TTE BSrE',
        quantity: 1,
        unit: 'Paket',
        unitPrice: 18500000,
        notes: 'Standar integrasi SPBE dan autentikasi terpusat',
      },
      {
        category: 'Dokumentasi',
        itemName: 'Cetak Dokumen KAK/SRS/SDD/BPO & Workshop Pelatihan Operator',
        quantity: 1,
        unit: 'Kegiatan',
        unitPrice: 16500000,
        notes: 'Acuan SBM Kemenkeu TA 2026',
      },
      {
        category: 'SLA & Pemeliharaan',
        itemName: 'Garansi Pemeliharaan, Patch Keamanan & Helpdesk SLA Dasar (12 Bulan)',
        quantity: 1,
        unit: 'Paket / Tahun',
        unitPrice: 24000000,
        notes: 'Layanan purna jual dan dukungan operasional pasca BAST',
      },
    ];

    draft = {
      projectName,
      proposingUnit: 'Disminpersau / Satker Pembina Sistem Informasi Lanud',
      procurementScheme: meta.procurementScheme,
      complexityLevel: meta.complexityLevel,
      tierClassification: 'TIER 2',
      tierLabel: meta.tierLabel,
      complexityScore: meta.complexityScore,
      recommendedOverheadPercent: meta.recommendedOverheadPercent,
      durationMonths: duration,
      locationFactor: 1.0,
      highComplexityModules: [],
      specialIntegrations: [SPECIAL_INTEGRATION_OPTIONS[0]],
      layeredSecurityStandards: [LAYERED_SECURITY_STANDARD_OPTIONS[1]],
      personnel,
      nonPersonnel,
    };

    rationaleBody =
      `Rasionalisasi Arsitektur (TIER 2 — Skor ${meta.complexityScore}/100): ` +
      `Sistem ini merupakan portal operasional multi-pengguna tingkat Satker/Lanud dengan alur persetujuan, manajemen dokumen/inventori, serta integrasi autentikasi SSO/TTE. ` +
      `Biaya disusun secara proporsional menggunakan tim penuh siklus SDLC (7 tenaga ahli kualifikasi Middle selama ${duration} bulan) dan infrastruktur cloud standar — tanpa membebankan komponen mahal seperti klaster GPU/AI, lisensi radar, atau arsitektur stream berkecepatan tinggi.`;
  } else if (meta.tier === 'TIER 3') {
    const isFlightTracker =
      lower.includes('flightradar') ||
      lower.includes('flight radar') ||
      lower.includes('pesawat') ||
      lower.includes('ads-b') ||
      lower.includes('penerbangan');

    const projectName = isFlightTracker
      ? 'Sistem Pelacakan Pesawat & Telemetri Penerbangan Real-Time (Tactical FlightTracker)'
      : `Sistem Telemetri Spasial & Pemrosesan Real-Time: ${userMsg.slice(0, 46)}`;

    const personnel: DraftEstimatePersonnel[] = [
      {
        roleId: 'role-pm',
        roleName: 'Project Manager / Team Leader',
        tier: 'Senior',
        headcount: 1,
        durationMonths: duration,
        taskDescription: 'Manajemen proyek lintas disiplin, tata kelola risiko real-time, dan pelaporan komando.',
      },
      {
        roleId: 'role-sa',
        roleName: 'System Analyst / Solution Architect',
        tier: 'Lead / Principal',
        headcount: 1,
        durationMonths: scaleDur(0.9, 7),
        taskDescription: 'Arsitektur event-driven high-throughput, pemodelan data spasial, dan skema high-availability.',
      },
      {
        roleId: 'role-uiux',
        roleName: 'UI/UX Designer (Tactical Interface)',
        tier: 'Senior',
        headcount: 1,
        durationMonths: scaleDur(0.5, 4),
        taskDescription: 'Desain antarmuka peta taktis interaktif HUD, simbol penerbangan, dan UX mobile/web.',
      },
      {
        roleId: 'role-backend',
        roleName: 'Backend Developer',
        tier: 'Senior',
        headcount: 3,
        durationMonths: scaleDur(0.9, 7),
        taskDescription: 'Pengembangan layanan ingesti stream WebSocket/gRPC high-throughput untuk ribuan objek paralel.',
      },
      {
        roleId: 'role-frontend',
        roleName: 'Frontend Developer',
        tier: 'Senior',
        headcount: 2,
        durationMonths: scaleDur(0.9, 7),
        taskDescription: 'Rendering peta spasial WebGL/GIS berkecepatan tinggi dan dashboard pelacakan real-time.',
      },
      {
        roleId: 'role-mobile',
        roleName: 'Mobile Developer (Android / iOS)',
        tier: 'Senior',
        headcount: 2,
        durationMonths: scaleDur(0.8, 6),
        taskDescription: 'Pengembangan aplikasi mobile Android/iOS pelacakan live dengan notifikasi push & cache offline.',
      },
      {
        roleId: 'role-ai-data',
        roleName: 'AI / Data Engineer',
        tier: 'Senior',
        headcount: 1,
        durationMonths: scaleDur(0.8, 6),
        taskDescription: 'Rekayasa pipeline stream ADS-B/radar/AIS, korelasi lintasan, dan database time-series spasial.',
      },
      {
        roleId: 'role-devops',
        roleName: 'DevOps & Cloud Infrastructure Engineer',
        tier: 'Senior',
        headcount: 1,
        durationMonths: scaleDur(0.8, 6),
        taskDescription: 'Orkestrasi cluster Kubernetes high-availability, autoscaling stream broker, dan observabilitas.',
      },
      {
        roleId: 'role-qa-sec',
        roleName: 'QA & Security Tester (AppSec)',
        tier: 'Senior',
        headcount: 1,
        durationMonths: scaleDur(0.7, 5),
        taskDescription: 'Stress/load testing ribuan objek simultan, pengujian AppSec, dan validasi latensi.',
      },
      {
        roleId: 'role-tw',
        roleName: 'Technical Writer & Trainer',
        tier: 'Middle',
        headcount: 1,
        durationMonths: scaleDur(0.5, 4),
        taskDescription: 'Dokumentasi arsitektur API/stream, Buku Pedoman Operator, dan transfer teknologi.',
      },
    ];

    const nonPersonnel: DraftEstimateNonPersonnel[] = [
      {
        category: 'Server / Cloud',
        itemName: 'Cloud Cluster High-Availability Multi-Node & Stream Broker (Kafka/Redis)',
        quantity: duration,
        unit: 'Bulan',
        unitPrice: 22000000,
        notes: 'Klaster komputasi terdistribusi untuk ingesti telemetri real-time 24/7',
      },
      {
        category: 'Lisensi',
        itemName: 'Lisensi Spatial Map Engine (GIS), Feed Data ADS-B/Telemetri & Time-Series DB',
        quantity: 1,
        unit: 'Paket / Tahun',
        unitPrice: 85000000,
        notes: 'Lisensi komersial rendering peta taktis dan sumber data lintasan',
      },
      {
        category: 'Integrasi API',
        itemName: 'Gateway Integrasi Feed Sensor/ADS-B/Radar & API Multi-Platform Web/Mobile',
        quantity: 2,
        unit: 'Paket',
        unitPrice: 28000000,
        notes: 'Pengembangan adapter protokol stream dan enkripsi transmisi data',
      },
      {
        category: 'Security Testing',
        itemName: 'Penetration Testing Independen & Uji Beban Ribuan Objek Simultan',
        quantity: 1,
        unit: 'Paket',
        unitPrice: 45000000,
        notes: 'Pengujian kelaikan keamanan siber dan ketahanan latensi rendah',
      },
      {
        category: 'Dokumentasi',
        itemName: 'Dokumen Arsitektur Teknis, SRS/SDD, BPO & Workshop Operator',
        quantity: 2,
        unit: 'Kegiatan',
        unitPrice: 16500000,
        notes: 'Acuan SBM Kemenkeu TA 2026',
      },
      {
        category: 'SLA & Pemeliharaan',
        itemName: 'Dukungan Pemeliharaan, Monitoring 24/7 & Garansi SLA 99.9% (12 Bulan)',
        quantity: 1,
        unit: 'Paket / Tahun',
        unitPrice: 48000000,
        notes: 'Menjamin ketersediaan layanan real-time pasca go-live',
      },
    ];

    draft = {
      projectName,
      proposingUnit: 'Disinfolahtaau — Subdis Sistem Informasi Operasi & Penerbangan',
      procurementScheme: meta.procurementScheme,
      complexityLevel: meta.complexityLevel,
      tierClassification: 'TIER 3',
      tierLabel: meta.tierLabel,
      complexityScore: meta.complexityScore,
      recommendedOverheadPercent: meta.recommendedOverheadPercent,
      durationMonths: duration,
      locationFactor: 1.0,
      highComplexityModules: [
        HIGH_COMPLEXITY_MODULE_OPTIONS[0],
        HIGH_COMPLEXITY_MODULE_OPTIONS[2],
        HIGH_COMPLEXITY_MODULE_OPTIONS[3],
      ],
      specialIntegrations: [
        SPECIAL_INTEGRATION_OPTIONS[0],
        SPECIAL_INTEGRATION_OPTIONS[1],
      ],
      layeredSecurityStandards: [
        LAYERED_SECURITY_STANDARD_OPTIONS[0],
        LAYERED_SECURITY_STANDARD_OPTIONS[3],
      ],
      personnel,
      nonPersonnel,
    };

    rationaleBody =
      `Rasionalisasi Arsitektur (TIER 3 — Skor ${meta.complexityScore}/100): ` +
      `Sistem pelacakan/telemetri real-time berarsitektur kompleks (setara Flightradar24 / GIS Spasial) membutuhkan pemrosesan stream koordinat ribuan objek secara simultan berlatensi rendah, rendering peta taktis interaktif berkecepatan tinggi di Web & Mobile, serta klaster server High-Availability. ` +
      `Oleh karena itu dibutuhkan tim spesialis lengkap (14 tenaga ahli Senior–Lead termasuk Data/Telemetry Engineer, Mobile Dev, GIS Frontend, dan DevOps Cluster selama ${duration} bulan) beserta lisensi map engine/feed data dan uji beban/pentest.`;
  } else {
    // TIER 4 — STRATEGIS / PERTAHANAN SIBER & C4ISR KRITIS
    const projectName =
      lower.includes('siber') || lower.includes('cyber')
        ? 'Sistem Komando Pertahanan Siber, Telemetri Multi-Radar & C4ISR Terpadu TNI AU'
        : 'Sistem Komando Pertahanan Udara Terintegrasi & Sensor Fusion C4ISR Strategis';

    const personnel: DraftEstimatePersonnel[] = [
      {
        roleId: 'role-pm',
        roleName: 'Project Manager / Team Leader',
        tier: 'Lead / Principal',
        headcount: 1,
        durationMonths: duration,
        taskDescription: 'Pimpinan program strategis pertahanan, tata kelola kontrak kompleks, dan kepatuhan regulasi.',
      },
      {
        roleId: 'role-sa',
        roleName: 'System Analyst / Solution Architect',
        tier: 'Lead / Principal',
        headcount: 2,
        durationMonths: scaleDur(0.92, 10),
        taskDescription: 'Perancangan arsitektur C4ISR terdistribusi, zero-trust network, dan kriptografi berlapis.',
      },
      {
        roleId: 'role-uiux',
        roleName: 'UI/UX Designer (Tactical Interface)',
        tier: 'Senior',
        headcount: 1,
        durationMonths: scaleDur(0.6, 7),
        taskDescription: 'Desain antarmuka ruang komando (command center wall display) & HUD taktis militer.',
      },
      {
        roleId: 'role-backend',
        roleName: 'Backend Developer',
        tier: 'Senior',
        headcount: 4,
        durationMonths: scaleDur(0.92, 10),
        taskDescription: 'Engine inti sensor fusion multi-radar, korelasi insiden siber real-time, dan audit trail imutabel.',
      },
      {
        roleId: 'role-frontend',
        roleName: 'Frontend Developer',
        tier: 'Senior',
        headcount: 2,
        durationMonths: scaleDur(0.88, 10),
        taskDescription: 'Visualisasi peta operasi udara multi-layer, dashboard SOC pertahanan, dan panel kendali.',
      },
      {
        roleId: 'role-mobile',
        roleName: 'Mobile Developer (Android / iOS)',
        tier: 'Senior',
        headcount: 1,
        durationMonths: scaleDur(0.75, 8),
        taskDescription: 'Aplikasi taktis lapangan terenkripsi dengan sinkronisasi offline-first antar pangkalan.',
      },
      {
        roleId: 'role-ai-data',
        roleName: 'AI / Data Engineer',
        tier: 'Lead / Principal',
        headcount: 3,
        durationMonths: scaleDur(0.88, 10),
        taskDescription: 'Model AI deteksi anomali ancaman siber, fusi data multi-sensor radar, dan analitik prediktif.',
      },
      {
        roleId: 'role-qa-sec',
        roleName: 'QA & Security Tester (AppSec)',
        tier: 'Lead / Principal',
        headcount: 2,
        durationMonths: scaleDur(0.8, 9),
        taskDescription: 'Red-teaming internal, audit kriptografi, pengujian penetrasi berkelanjutan, dan stress test ekstrem.',
      },
      {
        roleId: 'role-devops',
        roleName: 'DevOps & Cloud Infrastructure Engineer',
        tier: 'Lead / Principal',
        headcount: 2,
        durationMonths: scaleDur(0.88, 10),
        taskDescription: 'Orkestrasi cluster bare-metal on-premise terisolasi (air-gapped), DevSecOps, dan DRC.',
      },
      {
        roleId: 'role-tw',
        roleName: 'Technical Writer & Trainer',
        tier: 'Senior',
        headcount: 1,
        durationMonths: scaleDur(0.6, 7),
        taskDescription: 'Penyusunan dokumen teknis rahasia, SOP operasi komando, dan transfer teknologi lintas Lanud.',
      },
    ];

    const nonPersonnel: DraftEstimateNonPersonnel[] = [
      {
        category: 'Server / Cloud',
        itemName: 'Klaster Server On-Premise Bare-Metal / GPU Compute Node & Air-Gapped Staging',
        quantity: duration,
        unit: 'Bulan',
        unitPrice: 28000000,
        notes: 'Infrastruktur komputasi terisolasi berkeandalan tinggi untuk pelatihan AI & simulasi radar',
      },
      {
        category: 'Lisensi',
        itemName: 'Lisensi Enterprise Sensor Fusion, Tactical GIS Militer & Modul HSM Kriptografi',
        quantity: 1,
        unit: 'Paket / Tahun',
        unitPrice: 145000000,
        notes: 'Lisensi perangkat lunak pemetaan militer dan pengamanan kunci kriptografi',
      },
      {
        category: 'Integrasi API',
        itemName: 'Gateway Protokol Taktis Multi-Radar, Link Enkripsi & Integrasi Lintas Komando',
        quantity: 2,
        unit: 'Paket',
        unitPrice: 45000000,
        notes: 'Interoperabilitas protokol sensor militer dan replikasi multi-pangkalan',
      },
      {
        category: 'Security Testing',
        itemName: 'Audit Kriptografi, Red-Teaming & Sertifikasi Kelaikan Siber Independen (BSSN/ITSec)',
        quantity: 2,
        unit: 'Paket',
        unitPrice: 65000000,
        notes: 'Verifikasi kelaikan pertahanan siber berlapis sebelum operasionalisasi',
      },
      {
        category: 'Dokumentasi',
        itemName: 'Dokumen KAK/SRS/SDD/SOP Operasi & Workshop Transfer Teknologi Multi-Lanud',
        quantity: 3,
        unit: 'Kegiatan',
        unitPrice: 22000000,
        notes: 'Pelatihan intensif operator komando, tim Satsiber, dan administrator sistem',
      },
      {
        category: 'SLA & Pemeliharaan',
        itemName: 'Dukungan On-Site Engineer & Pemeliharaan Kritis 24/7 SLA 99.99% (12 Bulan)',
        quantity: 1,
        unit: 'Paket / Tahun',
        unitPrice: 95000000,
        notes: 'Respons insiden kritis < 15 menit & pembaruan patch keamanan berkala',
      },
    ];

    draft = {
      projectName,
      proposingUnit: 'Satsiber TNI AU, Kohanudnas & Disinfolahtaau',
      procurementScheme: meta.procurementScheme,
      complexityLevel: meta.complexityLevel,
      tierClassification: 'TIER 4',
      tierLabel: meta.tierLabel,
      complexityScore: meta.complexityScore,
      recommendedOverheadPercent: meta.recommendedOverheadPercent,
      durationMonths: duration,
      locationFactor: 1.0,
      highComplexityModules: [...HIGH_COMPLEXITY_MODULE_OPTIONS],
      specialIntegrations: [
        SPECIAL_INTEGRATION_OPTIONS[0],
        SPECIAL_INTEGRATION_OPTIONS[1],
        SPECIAL_INTEGRATION_OPTIONS[2],
      ],
      layeredSecurityStandards: [...LAYERED_SECURITY_STANDARD_OPTIONS],
      personnel,
      nonPersonnel,
    };

    rationaleBody =
      `Rasionalisasi Arsitektur (TIER 4 — Skor ${meta.complexityScore}/100): ` +
      `Sistem komando strategis/pertahanan siber & C4ISR menuntut arsitektur mission-critical berstandar pertahanan: fusi data multi-radar, deteksi ancaman berbasis AI, enkripsi kriptografi berlapis (TLS 1.3/AES-256/HSM), operasi klaster terisolasi (air-gapped), serta sertifikasi kelaikan siber independen. ` +
      `Diperlukan tim inti 19 tenaga ahli Senior–Lead selama ${duration} bulan beserta infrastruktur GPU/bare-metal, red-teaming, dan SLA kritis 24/7.`;
  }

  const { summary } = buildPricedItemsFromDraft(draft, activeConfig);

  const sourceTag =
    modeLabel === 'LOCAL_FALLBACK'
      ? 'MESIN ESTIMATOR ARSITEKTUR LOKAL (OFFLINE FALLBACK)'
      : 'MESIN ESTIMATOR ARSITEKTUR DETERMINISTIK SERVER';

  const reply = `[${sourceTag}]
Klasifikasi Arsitektur: **${draft.tierLabel}** (Skor Kompleksitas: ${draft.complexityScore}/100)
Proyek: **${draft.projectName}**

${rationaleBody}

Ringkasan Deterministik (Acuan ${activeConfig.version} · Perpres 12/2021 · SBM/INKINDO 2026):
• Durasi & Skema: ${draft.durationMonths} Bulan · ${draft.procurementScheme}
• Komposisi Tim: ${summary.totalPersonnelHeadcount} Tenaga Ahli (${formatNumberID(summary.totalManMonths, 1)} OB) → ${formatIDR(summary.totalPersonnelCost)}
• Biaya Non-Personel: ${draft.nonPersonnel.length} Komponen → ${formatIDR(summary.totalNonPersonnelCost)}
• Estimasi Grand Total HPS/RAB (incl. Overhead ${draft.recommendedOverheadPercent}% & PPN ${activeConfig.defaultPpnPercent}%): **${formatIDR(summary.grandTotalEstimation)}**

Klik tombol **"TERAPKAN KE FORM KALKULATOR"** di bawah untuk memuat seluruh profil, tabel tenaga ahli, dan komponen non-personel ke Kertas Kerja HPS/RAB.`;

  return { reply, draftEstimate: draft };
}
