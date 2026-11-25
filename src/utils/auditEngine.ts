import {
  AuditAdjustmentAction,
  AuditFindingItem,
  AuditReportResult,
  AuditStatusLevel,
  CalculationSummary,
  FinancialParameters,
  NonPersonnelCostItem,
  PersonnelAllocationItem,
  ProjectProfile,
  RegulationConfigPayload,
} from '../types/aura';
import { DEFAULT_REGULATION_CONFIG } from '../data/defaultRegulations';
import { calculateProjectSummary, formatIDR, formatNumberID } from './formatters';

export function computeTechnicalComplexityAssessment(
  profile: ProjectProfile,
  personnelItems: PersonnelAllocationItem[],
  nonPersonnelItems: NonPersonnelCostItem[],
  summary: CalculationSummary
) {
  const highModules = profile.highComplexityModules || [];
  const specialInts = profile.specialIntegrations || [];
  const secStandards = profile.layeredSecurityStandards || [];

  let baseScore = 30;
  if (profile.complexity.startsWith('Menengah')) baseScore = 50;
  if (profile.complexity.startsWith('Tinggi')) baseScore = 72;
  if (profile.complexity.startsWith('Kritis')) baseScore = 88;

  const bonus =
    highModules.length * 4 + specialInts.length * 3 + secStandards.length * 3;
  const complexityScore = Math.min(100, baseScore + bonus);

  const hasSecurityRole = personnelItems.some(
    (p) =>
      p.roleId === 'role-qa-sec' ||
      p.roleName.toLowerCase().includes('security') ||
      p.roleName.toLowerCase().includes('qa')
  );
  const hasAiOrDevOps = personnelItems.some(
    (p) =>
      p.roleId === 'role-ai-data' ||
      p.roleId === 'role-devops' ||
      p.roleName.toLowerCase().includes('ai') ||
      p.roleName.toLowerCase().includes('devops')
  );
  const hasPentestItem = nonPersonnelItems.some(
    (np) => np.category === 'Security Testing'
  );

  const justificationParts: string[] = [];
  if (highModules.length > 0) {
    justificationParts.push(
      `${highModules.length} modul berkompleksitas tinggi (${highModules
        .map((m) => m.split('(')[0].trim())
        .join(', ')})`
    );
  }
  if (specialInts.length > 0) {
    justificationParts.push(
      `${specialInts.length} skema integrasi khusus (${specialInts
        .map((i) => i.split('(')[0].trim())
        .join(', ')})`
    );
  }
  if (secStandards.length > 0) {
    justificationParts.push(
      `${secStandards.length} standar keamanan berlapis (${secStandards
        .map((s) => s.split('(')[0].trim())
        .join(', ')})`
    );
  }

  const workloadJustificationSummary =
    justificationParts.length > 0
      ? `Alokasi beban kerja ${formatNumberID(summary.totalManMonths, 1)} Orang-Bulan (${summary.totalPersonnelHeadcount} tenaga ahli) dan infrastruktur non-personel sebesar ${formatIDR(summary.totalNonPersonnelCost)} dinilai SEPADAN dan TERJUSTIFIKASI secara teknis untuk mendukung ${justificationParts.join('; ')}.${hasAiOrDevOps && hasSecurityRole && hasPentestItem ? ' Struktur tim telah mencakup spesialis AI/DevOps serta uji kelaikan siber (AppSec/Pentest) sesuai tuntutan operasional TNI AU.' : ''}`
      : `Proyek dikategorikan pada tingkat kompleksitas "${profile.complexity}" dengan alokasi ${formatNumberID(summary.totalManMonths, 1)} Orang-Bulan selama ${profile.durationMonths} bulan.`;

  return {
    complexityScore,
    highComplexityCount: highModules.length,
    specialIntegrationCount: specialInts.length,
    securityStandardCount: secStandards.length,
    workloadJustificationSummary,
  };
}

/**
 * Deterministic Audit Engine:
 * - Aggregates and evaluates role duplication & excessive headcount per role (e.g. Project Manager / Team Lead).
 * - Analyzes team composition ratio (Managerial vs Technical vs Support).
 * - Suggests measured consolidation without blind cuts.
 */
export function runDeterministicAudit(
  profile: ProjectProfile,
  personnelItems: PersonnelAllocationItem[],
  nonPersonnelItems: NonPersonnelCostItem[],
  financials: FinancialParameters,
  regulationConfig: RegulationConfigPayload,
  source: 'AI_SERVER_AUDIT' | 'LOCAL_HEURISTIC_ENGINE' = 'LOCAL_HEURISTIC_ENGINE',
  modelUsed = 'Deterministic-Rule-Engine-v2.8'
): AuditReportResult {
  const summary = calculateProjectSummary(
    personnelItems,
    nonPersonnelItems,
    financials,
    profile.locationFactor
  );

  const complexityAssessment = computeTechnicalComplexityAssessment(
    profile,
    personnelItems,
    nonPersonnelItems,
    summary
  );

  const findings: AuditFindingItem[] = [];
  const adjustments: AuditAdjustmentAction[] = [];

  const overheadMult = 1 + Math.max(0, financials.overheadAndProfitPercent) / 100;
  const ppnMult = 1 + Math.max(0, financials.ppnPercent) / 100;
  const combinedTaxOverheadMult = overheadMult * ppnMult;

  // 1. Technical Complexity & Workload Justification Check
  findings.push({
    id: 'finding-tech-complexity',
    severity: 'COMPLIANT',
    category: 'KOMPLEKSITAS_TEKNIS',
    title: 'Kesesuaian Beban Kerja (Man-Month) & Infrastruktur terhadap Kompleksitas Teknis',
    diagnosis: complexityAssessment.workloadJustificationSummary,
    regulationCitation:
      'Perlem LKPP No. 12 Tahun 2021 & Pedoman Penyusunan KAK/HPS Sistem Informasi Pemerintah',
    technicalContextJustification:
      'Kebutuhan tenaga ahli spesialis, klaster server/cloud terisolasi, gateway integrasi API, serta uji keamanan siber berlapis tidak dikategorikan sebagai pemborosan karena selaras dengan spesifikasi teknis dan arsitektur sistem.',
    deterministicMetric: `Skor Kompleksitas: ${complexityAssessment.complexityScore}/100 · Volume: ${formatNumberID(summary.totalManMonths, 1)} OB · Biaya Langsung: ${formatIDR(summary.directCostSubtotal)}`,
  });

  // 1B. ABSOLUTE HEADCOUNT & MAN-MONTH (OB) CEILING VALIDATION (Unconditional of Complexity Score)
  const globalHeadcount = summary.totalPersonnelHeadcount;
  const globalManMonths = summary.totalManMonths;

  if (globalHeadcount > 25 || globalManMonths > 450) {
    const isCriticalOverstaff = globalHeadcount > 40 || globalManMonths > 1000;
    const ceilingActionDraft: AuditAdjustmentAction = {
      id: 'adj-overstaffing-ceiling',
      actionType: 'REDUCE_EXCESS_HEADCOUNT',
      targetId: 'ALL_OVERSTAFFING',
      title: 'Normalisasi Kapasitas Tim ke Batas Rasional (Maks. 24 Ahli / 420 OB)',
      rationale: `Menyesuaikan kapasitas dan duplikasi tenaga ahli dari ${globalHeadcount} orang (${formatNumberID(globalManMonths, 1)} OB) ke komposisi optimum rasional sesuai batas kewajaran proyek perangkat lunak pemerintah.`,
      regulationCitation: 'Perlem LKPP No. 12 Tahun 2021',
      currentValueLabel: `${globalHeadcount} Orang (${formatNumberID(globalManMonths, 1)} OB)`,
      recommendedValueLabel: 'Komposisi Optimum Rasional (<= 24 Ahli)',
      recommendedNumericValue: 24,
      exactDirectCostDelta: 0,
      exactGrandTotalDelta: 0,
    };
    const ceilingDryRun = applyAuditAdjustmentsToState(
      profile,
      personnelItems,
      nonPersonnelItems,
      financials,
      [ceilingActionDraft],
      regulationConfig
    );
    const ceilingSummary = calculateProjectSummary(
      ceilingDryRun.personnelItems,
      ceilingDryRun.nonPersonnelItems,
      ceilingDryRun.financials,
      profile.locationFactor
    );
    const directCostDelta = summary.directCostSubtotal - ceilingSummary.directCostSubtotal;
    const grandTotalDelta = summary.grandTotalEstimation - ceilingSummary.grandTotalEstimation;

    findings.push({
      id: 'finding-overstaffing-ceiling',
      severity: isCriticalOverstaff ? 'CRITICAL' : 'WARNING',
      category: 'VOLUME_DURASI',
      title: isCriticalOverstaff
        ? 'ANOMALI KRITIS / OVER-STAFFING (NON-COMPLIANT): Kapasitas Tim Melampaui Batas Atas (Ceiling) Wajar'
        : 'PERINGATAN KAPASITAS TIM: Jumlah Tenaga Ahli / OB Mendekati Batas Atas Wajar',
      diagnosis: `Total alokasi personel mencapai ${globalHeadcount} orang dengan beban ${formatNumberID(globalManMonths, 1)} Man-Month (OB), ${isCriticalOverstaff ? 'sangat jauh melampaui batas atas kewajaran proyek sistem informasi/militer (maksimal 25–40 personel / 1.000 OB)' : 'melampaui koridor efisien tim inti (25 personel / 450 OB)'}, meskipun tingkat kompleksitas proyek bernilai ${complexityAssessment.complexityScore}/100.`,
      regulationCitation: 'Perlem LKPP No. 12 Tahun 2021 & Standar Efisiensi Belanja Pengadaan Perangkat Lunak Pemerintah',
      technicalContextJustification:
        'Skor kompleksitas teknis tinggi mencerminkan kerumitan arsitektur (seperti C4ISR atau keamanan siber berlapis), namun tetap memerlukan komposisi tenaga ahli inti yang ramping dan terkelola (ideal <= 24 ahli), bukan penambahan headcount paralel berlebihan (Brooks\'s Law).',
      deterministicMetric: `Total Tim: ${globalHeadcount} Orang · Total OB: ${formatNumberID(globalManMonths, 1)} OB · Batas Wajar: <= 25 Orang / 450 OB`,
    });

    adjustments.push({
      ...ceilingActionDraft,
      recommendedValueLabel: `${ceilingSummary.totalPersonnelHeadcount} Ahli (${formatNumberID(ceilingSummary.totalManMonths, 1)} OB)`,
      exactDirectCostDelta: -directCostDelta,
      exactGrandTotalDelta: -grandTotalDelta,
    });
  }

  // 2. AGGREGATION & ROLE DUPLICATION / EXCESSIVE QUANTITY CHECK (Project Manager / Team Lead / etc.)
  const roleGroupMap = new Map<
    string,
    {
      roleId: string;
      roleName: string;
      rows: PersonnelAllocationItem[];
      totalHeadcount: number;
      totalManMonths: number;
      totalCost: number;
    }
  >();

  personnelItems.forEach((item) => {
    const key = item.roleId || item.roleName.trim().toLowerCase();
    const mm = item.headcount * item.durationMonths;
    const activeRate =
      item.overrideRate !== null
        ? item.overrideRate
        : Math.round(item.standardRate * profile.locationFactor);
    const cost = mm * activeRate;

    if (!roleGroupMap.has(key)) {
      roleGroupMap.set(key, {
        roleId: item.roleId,
        roleName: item.roleName,
        rows: [item],
        totalHeadcount: item.headcount,
        totalManMonths: mm,
        totalCost: cost,
      });
    } else {
      const existing = roleGroupMap.get(key)!;
      existing.rows.push(item);
      existing.totalHeadcount += item.headcount;
      existing.totalManMonths += mm;
      existing.totalCost += cost;
    }
  });

  // Evaluate each aggregated role group for duplication or excessive headcount
  let technicalHeadcount = 0;
  let technicalManMonths = 0;
  let managerialHeadcount = 0;
  let managerialManMonths = 0;

  roleGroupMap.forEach((group) => {
    const lowerName = group.roleName.toLowerCase();
    const isManagerial =
      lowerName.includes('project manager') ||
      lowerName.includes('team lead') ||
      lowerName.includes('scrum master') ||
      lowerName.includes('lead');

    if (isManagerial) {
      managerialHeadcount += group.totalHeadcount;
      managerialManMonths += group.totalManMonths;
    } else if (!lowerName.includes('technical writer')) {
      technicalHeadcount += group.totalHeadcount;
      technicalManMonths += group.totalManMonths;
    }

    // Check for explicit role duplication (multiple rows for the exact same role)
    if (group.rows.length > 1) {
      const dupActionDraft: AuditAdjustmentAction = {
        id: `adj-consolidate-role-${group.roleId}`,
        actionType: 'DEDUPLICATE_NON_PERSONNEL',
        targetId: group.roleId,
        title: `Konsolidasikan Baris Terduplikasi Peran "${group.roleName}" Menjadi 1 Entri Terstruktur`,
        rationale: `Menggabungkan ${group.rows.length} baris peran "${group.roleName}" menjadi satu entri terstruktur dengan penyesuaian durasi proporsional tanpa mengorbankan tim teknis.`,
        regulationCitation: 'Perlem LKPP No. 12 Tahun 2021',
        currentValueLabel: `${group.rows.length} Baris Terpecah (${formatIDR(group.totalCost)})`,
        recommendedValueLabel: '1 Entri Terkonsolidasi',
        recommendedNumericValue: 0,
        exactDirectCostDelta: 0,
        exactGrandTotalDelta: 0,
      };
      const dupDryRun = applyAuditAdjustmentsToState(
        profile,
        personnelItems,
        nonPersonnelItems,
        financials,
        [dupActionDraft],
        regulationConfig
      );
      const dupSummary = calculateProjectSummary(
        dupDryRun.personnelItems,
        dupDryRun.nonPersonnelItems,
        dupDryRun.financials,
        profile.locationFactor
      );

      findings.push({
        id: `finding-dup-role-${group.roleId}`,
        severity: 'CRITICAL',
        category: 'VOLUME_DURASI',
        title: `Indikasi Duplikasi Baris Peran "${group.roleName}" (${group.rows.length} Baris Terakumulasi)`,
        diagnosis: `Peran "${group.roleName}" muncul terpecah dalam ${group.rows.length} baris terpisah dengan total akumulasi ${group.totalHeadcount} orang, ${formatNumberID(group.totalManMonths, 1)} OB, dan total biaya ${formatIDR(group.totalCost)}. Hal ini berpotensi pencatatan ganda atau alokasi pengawas yang tidak terpadu.`,
        regulationCitation: 'Perlem LKPP No. 12 Tahun 2021 — Prinsip Akuntabilitas & Efisiensi Struktur Tim HPS',
        technicalContextJustification:
          'Konsolidasi baris peran yang terduplikasi menjadi satu entri terstruktur dengan volume gabungan yang wajar memastikan kejelasan penugasan.',
        deterministicMetric: `Akumulasi: ${group.rows.length} Baris · ${group.totalHeadcount} Orang · ${formatNumberID(group.totalManMonths, 1)} OB · Total: ${formatIDR(group.totalCost)}`,
      });

      adjustments.push({
        ...dupActionDraft,
        exactDirectCostDelta: dupSummary.directCostSubtotal - summary.directCostSubtotal,
        exactGrandTotalDelta: dupSummary.grandTotalEstimation - summary.grandTotalEstimation,
      });
    }

    // Check for absolute per-role headcount hard caps (Managerial: >2 warn, >4 crit; Technical: >8 warn, >15 crit)
    const maxAllowedCount = isManagerial ? 2 : 8;
    const criticalAllowedCount = isManagerial ? 4 : 15;

    if (group.totalHeadcount > maxAllowedCount) {
      const isCrit = group.totalHeadcount > criticalAllowedCount;
      const targetCount = isManagerial ? 1 : 4;
      const hardcapDraft: AuditAdjustmentAction = {
        id: `adj-hardcap-role-${group.roleId}`,
        actionType: 'REDUCE_EXCESS_HEADCOUNT',
        targetId: group.roleId,
        title: `Normalisasi Jumlah Peran "${group.roleName}" ke Batas Wajar (${targetCount} Orang)`,
        rationale: `Menyesuaikan alokasi personel dari ${group.totalHeadcount} orang menjadi ${targetCount} orang pada peran "${group.roleName}".`,
        regulationCitation: 'Perlem LKPP No. 12 Tahun 2021',
        currentValueLabel: `${group.totalHeadcount} Orang (${formatIDR(group.totalCost)})`,
        recommendedValueLabel: `${targetCount} Orang (Proporsional)`,
        recommendedNumericValue: targetCount,
        exactDirectCostDelta: 0,
        exactGrandTotalDelta: 0,
      };
      const hardcapDryRun = applyAuditAdjustmentsToState(
        profile,
        personnelItems,
        nonPersonnelItems,
        financials,
        [hardcapDraft],
        regulationConfig
      );
      const hardcapSummary = calculateProjectSummary(
        hardcapDryRun.personnelItems,
        hardcapDryRun.nonPersonnelItems,
        hardcapDryRun.financials,
        profile.locationFactor
      );

      findings.push({
        id: `finding-hardcap-role-${group.roleId}`,
        severity: isCrit ? 'CRITICAL' : 'WARNING',
        category: 'VOLUME_DURASI',
        title: `${isCrit ? 'ANOMALI KRITIS / OVER-STAFFING' : 'PERINGATAN'} — Pengelembungan Personel Peran "${group.roleName}" (${group.totalHeadcount} Orang)`,
        diagnosis: `Alokasi personel pada peran "${group.roleName}" mencapai ${group.totalHeadcount} orang (${formatNumberID(group.totalManMonths, 1)} OB), melampaui batas atas wajar (${isCrit ? 'kritis' : 'maksimal'} ${targetCount}–${maxAllowedCount} orang). Kelebihan jumlah tenaga ahli paralel pada satu peran melanggar prinsip efisiensi dan menyebabkan inefisiensi koordinasi (Brooks's Law).`,
        regulationCitation: 'Perlem LKPP No. 12 Tahun 2021 — Prinsip Kewajaran Beban Kerja & Efisiensi Pengadaan',
        technicalContextJustification:
          'Kompleksitas tinggi membenarkan kualifikasi Senior/Lead, namun bukan penambahan banyak tenaga ahli paralel pada satu peran.',
        deterministicMetric: `Jumlah Saat Ini: ${group.totalHeadcount} Orang · Batas Wajar: ${targetCount} Orang`,
      });

      adjustments.push({
        ...hardcapDraft,
        exactDirectCostDelta: hardcapSummary.directCostSubtotal - summary.directCostSubtotal,
        exactGrandTotalDelta: hardcapSummary.grandTotalEstimation - summary.grandTotalEstimation,
      });
    }
  });

  // 3. TEAM COMPOSITION RATIO ANALYSIS (Managerial vs Technical vs Support)
  const totalTeamHeadcount = personnelItems.reduce((acc, p) => acc + p.headcount, 0) || 1;
  const managerialRatio = (managerialHeadcount / totalTeamHeadcount) * 100;

  if (managerialHeadcount >= Math.max(2, technicalHeadcount * 0.75) && totalTeamHeadcount >= 4) {
    findings.push({
      id: 'finding-team-composition-topheavy',
      severity: 'WARNING',
      category: 'VOLUME_DURASI',
      title: `Analisis Rasio Komposisi Tim: Struktur Peran Manajerial Terlalu Gemuk (${managerialHeadcount} Manajerial vs ${technicalHeadcount} Teknis)`,
      diagnosis: `Proporsi peran manajerial dan koordinasi mencapai ${managerialRatio.toFixed(1)}% dari total tenaga ahli. Sesuai praktik rekayasa perangkat lunak standar, struktur tim ideal menempatkan mayoritas alokasi pada peran teknis & produksi (Developer, Solution Architect, Analis, QA, DevOps) agar eksekusi pengembangan berjalan efektif dan tidak top-heavy.`,
      regulationCitation: 'Standar Produktivitas Tim Pengembang Perangkat Lunak & Pedoman HPS LKPP',
      technicalContextJustification:
        'Penyesuaian komposisi tim menjadi lebih ramping di sisi pengawas atau konsolidasi peran pimpinan proyek meningkatkan efisiensi eksekusi teknis.',
      deterministicMetric: `Manajerial: ${managerialHeadcount} Orang · Teknis: ${technicalHeadcount} Orang · Rasio: ${managerialRatio.toFixed(1)}%`,
    });

    const alreadyHasManagerialCap = adjustments.some(
      (a) =>
        a.id === 'adj-overstaffing-ceiling' ||
        a.id === 'adj-hardcap-role-role-pm'
    );
    if (!alreadyHasManagerialCap) {
      const ratioActionDraft: AuditAdjustmentAction = {
        id: 'adj-team-composition-topheavy',
        actionType: 'REDUCE_EXCESS_HEADCOUNT',
        targetId: 'MANAGERIAL_RATIO',
        title: 'Rampingkan Rasio Peran Manajerial ke Struktur Proporsional (1 Orang Pimpinan)',
        rationale: `Mengoptimalkan jumlah peran manajerial/koordinasi dari ${managerialHeadcount} orang menjadi 1 pimpinan proyek agar rasio tim teknis (${technicalHeadcount} orang) kembali proporsional.`,
        regulationCitation: 'Standar Produktivitas Tim & Pedoman HPS LKPP',
        currentValueLabel: `${managerialHeadcount} Manajerial (${managerialRatio.toFixed(1)}%)`,
        recommendedValueLabel: '1 Manajerial Utama',
        recommendedNumericValue: 1,
        exactDirectCostDelta: 0,
        exactGrandTotalDelta: 0,
      };
      const ratioDryRun = applyAuditAdjustmentsToState(
        profile,
        personnelItems,
        nonPersonnelItems,
        financials,
        [ratioActionDraft],
        regulationConfig
      );
      const ratioSummary = calculateProjectSummary(
        ratioDryRun.personnelItems,
        ratioDryRun.nonPersonnelItems,
        ratioDryRun.financials,
        profile.locationFactor
      );

      adjustments.push({
        ...ratioActionDraft,
        exactDirectCostDelta: ratioSummary.directCostSubtotal - summary.directCostSubtotal,
        exactGrandTotalDelta: ratioSummary.grandTotalEstimation - summary.grandTotalEstimation,
      });
    }
  } else {
    findings.push({
      id: 'finding-team-composition-compliant',
      severity: 'COMPLIANT',
      category: 'VOLUME_DURASI',
      title: 'Analisis Rasio Komposisi Tim Pengembangan: Proporsi Seimbang (Manajerial vs Teknis)',
      diagnosis: `Komposisi tenaga ahli menunjukkan keseimbangan proporsional antara peran manajerial/koordinasi (${managerialHeadcount} orang) dan tim eksekusi teknis & produksi (${technicalHeadcount} orang).`,
      regulationCitation: 'Standar Rekayasa Perangkat Lunak Nasional',
      technicalContextJustification: 'Struktur tim mendukung pendelegasian tugas dan kecepatan eksekusi.',
      deterministicMetric: `Rasio Komposisi Tim: PROPORSIONAL (${managerialHeadcount} Manajerial / ${technicalHeadcount} Teknis)`,
    });
  }

  // 4. Check Personnel Tariff Overrides against Official Regulation Rates
  personnelItems.forEach((item) => {
    const effectiveStandard = Math.round(item.standardRate * profile.locationFactor);
    if (item.overrideRate !== null && item.overrideRate > effectiveStandard) {
      const rateDiff = item.overrideRate - effectiveStandard;
      const pctAbove = (rateDiff / (effectiveStandard || 1)) * 100;
      const mm = item.headcount * item.durationMonths;
      const directDelta = rateDiff * mm;
      const grandDelta = Math.round(directDelta * combinedTaxOverheadMult);

      const severity = pctAbove > 15 ? 'CRITICAL' : 'WARNING';

      findings.push({
        id: `finding-rate-${item.id}`,
        severity,
        category: 'REGULASI_TARIF',
        title: `Override Tarif "${item.roleName}" (${item.tier}) Melampaui Acuan Regulasi (+${pctAbove.toFixed(1)}%)`,
        diagnosis: `Tarif override ditetapkan sebesar ${formatIDR(item.overrideRate)}/OB, sedangkan acuan standar tabel regulasi (${regulationConfig.version} dengan IKK ${profile.locationFactor.toFixed(2)}x) untuk kualifikasi ${item.tier} adalah ${formatIDR(effectiveStandard)}/OB. Terdapat selisih lebih sebesar ${formatIDR(rateDiff)}/OB atau total biaya langsung ${formatIDR(directDelta)} untuk ${formatNumberID(mm, 1)} OB.`,
        regulationCitation: `Pedoman Billing Rate INKINDO 2026 & SBM Kemenkeu TA 2026 (${regulationConfig.version})`,
        technicalContextJustification:
          'Penyesuaian kembali ke tarif standar regulasi tetap mempertahankan jumlah personel, kualifikasi, dan durasi kerja penuh sehingga tidak menurunkan kualitas teknis maupun keamanan proyek.',
        deterministicMetric: `Selisih Tarif: +${formatIDR(rateDiff)}/OB · Dampak HPS (termasuk Overhead & PPN): +${formatIDR(grandDelta)}`,
      });

      adjustments.push({
        id: `adj-rate-${item.id}`,
        actionType: 'NORMALIZE_OVERRIDE_RATE',
        targetId: item.id,
        title: `Normalisasi Tarif ${item.roleName} (${item.tier}) ke Acuan Regulasi Resmi`,
        rationale: `Mengembalikan tarif ${item.roleName} dari override ${formatIDR(item.overrideRate)}/OB ke tarif standar terverifikasi ${formatIDR(effectiveStandard)}/OB tanpa memangkas jumlah personel (${item.headcount} orang) maupun durasi kerja (${item.durationMonths} bulan).`,
        regulationCitation: `Billing Rate INKINDO 2026 & Perpres No. 12 Tahun 2021 Pasal 26`,
        currentValueLabel: `${formatIDR(item.overrideRate)} / OB`,
        recommendedValueLabel: `${formatIDR(effectiveStandard)} / OB (Standar)`,
        recommendedNumericValue: effectiveStandard,
        exactDirectCostDelta: -directDelta,
        exactGrandTotalDelta: -grandDelta,
      });
    }
  });

  // 5. Check Personnel Duration Exceeding Project Duration
  personnelItems.forEach((item) => {
    if (item.durationMonths > profile.durationMonths) {
      const excessMonths = item.durationMonths - profile.durationMonths;
      const activeRate =
        item.overrideRate !== null
          ? item.overrideRate
          : Math.round(item.standardRate * profile.locationFactor);
      const excessMM = excessMonths * item.headcount;
      const directDelta = excessMM * activeRate;
      const grandDelta = Math.round(directDelta * combinedTaxOverheadMult);

      findings.push({
        id: `finding-dur-${item.id}`,
        severity: 'CRITICAL',
        category: 'VOLUME_DURASI',
        title: `Durasi Penugasan "${item.roleName}" (${item.durationMonths} Bln) Melebihi Durasi Proyek (${profile.durationMonths} Bln)`,
        diagnosis: `Terdapat kelebihan alokasi durasi kerja selama ${formatNumberID(excessMonths, 1)} bulan (${formatNumberID(excessMM, 1)} OB) pada peran ${item.roleName} dibandingkan jadwal total pelaksanaan proyek (${profile.durationMonths} bulan).`,
        regulationCitation: 'Perlem LKPP No. 12 Tahun 2021 — Kesesuaian Jadwal Pelaksanaan KAK & Kontrak',
        technicalContextJustification:
          'Penyelarasan durasi personel agar tidak melampaui masa kontrak proyek merupakan koreksi administratif-aritmetika yang wajib dilakukan tanpa mengurangi ruang lingkup modul teknis.',
        deterministicMetric: `Kelebihan Volume: ${formatNumberID(excessMM, 1)} OB · Dampak HPS: +${formatIDR(grandDelta)}`,
      });

      adjustments.push({
        id: `adj-dur-${item.id}`,
        actionType: 'CAP_PERSONNEL_DURATION',
        targetId: item.id,
        title: `Selaraskan Durasi ${item.roleName} ke Durasi Maksimal Proyek (${profile.durationMonths} Bulan)`,
        rationale: `Menyesuaikan durasi kerja dari ${item.durationMonths} bulan menjadi ${profile.durationMonths} bulan sesuai batas jadwal kontrak proyek.`,
        regulationCitation: 'Perlem LKPP No. 12 Tahun 2021',
        currentValueLabel: `${item.durationMonths} Bulan`,
        recommendedValueLabel: `${profile.durationMonths} Bulan`,
        recommendedNumericValue: profile.durationMonths,
        exactDirectCostDelta: -directDelta,
        exactGrandTotalDelta: -grandDelta,
      });
    }
  });

  // 6. Check Overhead & Profit Percentage against Perpres/LKPP range (10% - 15%)
  const [minOverhead, maxOverhead] = regulationConfig.recommendedOverheadRange;
  const isSwakelolaTipe1 = profile.procurementScheme.includes('Swakelola Tipe I');

  if (isSwakelolaTipe1 && financials.overheadAndProfitPercent > 0) {
    const excessOverheadRp = summary.overheadAndProfitValue;
    const grandDelta = Math.round(excessOverheadRp * ppnMult);

    findings.push({
      id: 'finding-overhead-swakelola',
      severity: 'WARNING',
      category: 'PARAMETER_KEUANGAN',
      title: `Skema Swakelola Tipe I Mencantumkan Margin/Overhead Penyedia (${financials.overheadAndProfitPercent}%)`,
      diagnosis: `Pada skema Swakelola Tipe I (dikerjakan internal oleh Satker TNI AU), perhitungan RAB umumnya tidak membebankan keuntungan (profit margin) badan usaha penyedia. Saat ini tercatat Overhead & Keuntungan sebesar ${financials.overheadAndProfitPercent}% (${formatIDR(excessOverheadRp)}).`,
      regulationCitation: 'Perpres No. 12 Tahun 2021 & Pedoman Swakelola LKPP',
      technicalContextJustification:
        'Koreksi komponen margin penyedia pada skema Swakelola murni bersifat kepatuhan regulasi pengadaan dan sama sekali tidak mengurangi anggaran biaya langsung personel maupun infrastruktur teknis.',
      deterministicMetric: `Nilai Overhead Saat Ini: ${formatIDR(excessOverheadRp)} · Dampak Total: +${formatIDR(grandDelta)}`,
    });

    adjustments.push({
      id: 'adj-overhead-swakelola',
      actionType: 'ADJUST_OVERHEAD_PERCENT',
      title: 'Penyesuaian Overhead & Keuntungan ke 0% untuk Skema Swakelola Tipe I',
      rationale:
        'Menghilangkan komponen margin keuntungan penyedia pada skema Swakelola Tipe I internal Satker dengan tetap mempertahankan 100% biaya langsung personel dan non-personel.',
      regulationCitation: 'Perlem LKPP Pedoman Swakelola',
      currentValueLabel: `${financials.overheadAndProfitPercent}%`,
      recommendedValueLabel: '0% (Swakelola Internal)',
      recommendedNumericValue: 0,
      exactDirectCostDelta: 0,
      exactGrandTotalDelta: -grandDelta,
    });
  } else if (!isSwakelolaTipe1 && financials.overheadAndProfitPercent > maxOverhead) {
    const excessPct = financials.overheadAndProfitPercent - maxOverhead;
    const excessOverheadRp = summary.directCostSubtotal * (excessPct / 100);
    const grandDelta = Math.round(excessOverheadRp * ppnMult);

    findings.push({
      id: 'finding-overhead-high',
      severity: 'CRITICAL',
      category: 'PARAMETER_KEUANGAN',
      title: `Persentase Overhead & Keuntungan (${financials.overheadAndProfitPercent}%) Melebihi Batas Kewajaran (${maxOverhead}%)`,
      diagnosis: `Batas atas kewajaran Overhead & Keuntungan untuk jasa konsultansi/pengembangan sistem informasi sesuai rujukan Perpres & LKPP adalah ${maxOverhead}%. Terdapat kelebihan ${excessPct.toFixed(1)}% senilai ${formatIDR(excessOverheadRp)} sebelum pajak.`,
      regulationCitation: 'Perpres No. 12 Tahun 2021 Pasal 26 & Pedoman HPS LKPP (Batas Wajar 10%–15%)',
      technicalContextJustification:
        'Menurunkan persentase overhead ke batas wajar 15% tidak memotong anggaran teknis pengembangan, lisensi, maupun pengujian keamanan.',
      deterministicMetric: `Kelebihan Overhead: +${excessPct.toFixed(1)}% (+${formatIDR(excessOverheadRp)}) · Dampak Grand Total: +${formatIDR(grandDelta)}`,
    });

    adjustments.push({
      id: 'adj-overhead-cap',
      actionType: 'ADJUST_OVERHEAD_PERCENT',
      title: `Koreksi Persentase Overhead & Keuntungan Wajar ke Batas Maksimal Regulasi (${maxOverhead}%)`,
      rationale: `Menyesuaikan Overhead & Keuntungan dari ${financials.overheadAndProfitPercent}% ke ${maxOverhead}% sesuai batas atas kewajaran HPS pemerintah tanpa menyentuh biaya langsung teknis.`,
      regulationCitation: 'Perpres No. 12 Tahun 2021 Pasal 26',
      currentValueLabel: `${financials.overheadAndProfitPercent}%`,
      recommendedValueLabel: `${maxOverhead}% (Batas Atas Wajar)`,
      recommendedNumericValue: maxOverhead,
      exactDirectCostDelta: 0,
      exactGrandTotalDelta: -grandDelta,
    });
  } else {
    findings.push({
      id: 'finding-overhead-ok',
      severity: 'COMPLIANT',
      category: 'PARAMETER_KEUANGAN',
      title: `Parameter Overhead & Keuntungan Wajar (${financials.overheadAndProfitPercent}%) Sesuai Koridor Regulasi`,
      diagnosis: `Nilai Overhead & Keuntungan sebesar ${financials.overheadAndProfitPercent}% (${formatIDR(summary.overheadAndProfitValue)}) berada dalam rentang kewajaran pengadaan pemerintah (${minOverhead}%–${maxOverhead}%).`,
      regulationCitation: 'Perpres No. 12 Tahun 2021 Pasal 26',
      technicalContextJustification: 'Mendukung kesinambungan manajemen mutu dan mitigasi risiko proyek.',
      deterministicMetric: `Overhead & Keuntungan: ${formatIDR(summary.overheadAndProfitValue)} (${financials.overheadAndProfitPercent}%)`,
    });
  }

  // 7. Check PPN Tax compliance
  const defaultPpn = regulationConfig.defaultPpnPercent || 11;
  if (
    !isSwakelolaTipe1 &&
    financials.ppnPercent !== 11 &&
    financials.ppnPercent !== 12
  ) {
    const targetPpn = defaultPpn;
    const currentPpnRp = summary.ppnValue;
    const recommendedPpnRp = summary.dppBeforeTax * (targetPpn / 100);
    const grandDelta = Math.round(recommendedPpnRp - currentPpnRp);

    findings.push({
      id: 'finding-ppn-rate',
      severity: 'WARNING',
      category: 'PARAMETER_KEUANGAN',
      title: `Tarif PPN (${financials.ppnPercent}%) Berbeda dari Tarif Standar Regulasi (${targetPpn}%)`,
      diagnosis: `Pengadaan melalui penyedia kena pajak menggunakan tarif PPN efektif ${targetPpn}% (atau 12% sesuai klasifikasi objek pajak). Saat ini parameter PPN diatur pada ${financials.ppnPercent}% (${formatIDR(currentPpnRp)}).`,
      regulationCitation: 'UU No. 7 Tahun 2021 (UU HPP) & PMK No. 131/2024',
      technicalContextJustification:
        'Penyesuaian tarif PPN memastikan akurasi pagu pajak (WAPU) tanpa mengubah biaya teknis.',
      deterministicMetric: `PPN Saat Ini: ${formatIDR(currentPpnRp)} · PPN Standar (${targetPpn}%): ${formatIDR(recommendedPpnRp)}`,
    });

    adjustments.push({
      id: 'adj-ppn-standard',
      actionType: 'ADJUST_PPN_PERCENT',
      title: `Sesuaikan Tarif PPN ke Standar Regulasi Berlaku (${targetPpn}%)`,
      rationale: `Menetapkan tarif PPN pada ${targetPpn}% sesuai ketentuan perpajakan pengadaan barang/jasa pemerintah.`,
      regulationCitation: 'UU No. 7 Tahun 2021 & PMK No. 131/2024',
      currentValueLabel: `${financials.ppnPercent}%`,
      recommendedValueLabel: `${targetPpn}%`,
      recommendedNumericValue: targetPpn,
      exactDirectCostDelta: 0,
      exactGrandTotalDelta: grandDelta,
    });
  }

  // 8. Check Duplicate Non-Personnel Items
  const seenNpKeys = new Map<string, NonPersonnelCostItem>();
  nonPersonnelItems.forEach((np) => {
    const normKey = `${np.category}::${np.itemName.trim().toLowerCase()}`;
    const existing = seenNpKeys.get(normKey);
    if (existing) {
      const dupSubtotal = np.quantity * np.unitPrice;
      const grandDelta = Math.round(dupSubtotal * combinedTaxOverheadMult);

      findings.push({
        id: `finding-dup-np-${np.id}`,
        severity: 'CRITICAL',
        category: 'VOLUME_DURASI',
        title: `Indikasi Duplikasi Komponen Non-Personel: "${np.itemName}"`,
        diagnosis: `Komponen "${np.itemName}" pada kategori ${np.category} tercatat lebih dari satu kali dengan uraian identik, menimbulkan potensi pencatatan ganda sebesar ${formatIDR(dupSubtotal)} (biaya langsung).`,
        regulationCitation: 'Perlem LKPP No. 12 Tahun 2021 — Prinsip Akuntabilitas & Anti Pencatatan Ganda HPS',
        technicalContextJustification:
          'Penghapusan baris duplikat yang identik menjaga keakuratan kertas kerja tanpa menghilangkan komponen fungsional yang dibutuhkan proyek.',
        deterministicMetric: `Biaya Langsung Duplikat: ${formatIDR(dupSubtotal)} · Dampak HPS: +${formatIDR(grandDelta)}`,
      });

      adjustments.push({
        id: `adj-dup-np-${np.id}`,
        actionType: 'DEDUPLICATE_NON_PERSONNEL',
        targetId: np.id,
        title: `Eliminasi Baris Duplikat Komponen "${np.itemName}"`,
        rationale: `Menghapus entri ganda pada item "${np.itemName}" dengan tetap mempertahankan item utamanya pada Kertas Kerja.`,
        regulationCitation: 'Perlem LKPP No. 12 Tahun 2021',
        currentValueLabel: `2 Entri Identik (${formatIDR(dupSubtotal)})`,
        recommendedValueLabel: '1 Entri Tunggal Terverifikasi',
        recommendedNumericValue: 0,
        exactDirectCostDelta: -dupSubtotal,
        exactGrandTotalDelta: -grandDelta,
      });
    } else {
      seenNpKeys.set(normKey, np);
    }
  });

  // 8B. Independent Non-Personnel Item Volume & Unit Price Audit (Independent of Complexity Score)
  nonPersonnelItems.forEach((np) => {
    const unitLower = (np.unit || '').toLowerCase();
    const qty = np.quantity;
    let isAbnormal = false;
    let reasonText = '';
    let recommendedQty = 1;

    if (unitLower.includes('tahun') && qty > 3) {
      isAbnormal = true;
      recommendedQty = Math.max(1, Math.ceil(profile.durationMonths / 12));
      reasonText = `Volume ${qty} ${np.unit} dinilai sangat tidak wajar (melebihi batas wajar 3 untuk item berbasis tahun).`;
    } else if (unitLower.includes('paket') && qty > 5) {
      isAbnormal = true;
      recommendedQty = 2;
      reasonText = `Volume ${qty} ${np.unit} pada komponen "${np.itemName}" melampaui batas kewajaran operasional (maksimal 5 paket).`;
    } else if (unitLower.includes('kegiatan') && qty > 6) {
      isAbnormal = true;
      recommendedQty = 3;
      reasonText = `Volume ${qty} ${np.unit} pada "${np.itemName}" dinilai terlalu besar untuk satu siklus proyek.`;
    } else if (unitLower.includes('bulan') && qty > Math.max(24, profile.durationMonths * 2)) {
      isAbnormal = true;
      recommendedQty = profile.durationMonths;
      reasonText = `Volume ${qty} ${np.unit} pada "${np.itemName}" melampaui durasi proyek (${profile.durationMonths} bulan).`;
    }

    if (isAbnormal) {
      const excessQty = qty - recommendedQty;
      const directDelta = excessQty * np.unitPrice;
      const grandDelta = Math.round(directDelta * combinedTaxOverheadMult);

      findings.push({
        id: `finding-np-abnormal-${np.id}`,
        severity: 'CRITICAL',
        category: 'VOLUME_DURASI',
        title: `Volume Tidak Wajar pada Komponen Non-Personel: "${np.itemName}" (${qty} ${np.unit})`,
        diagnosis: `${reasonText} Mengakibatkan pembengkakan biaya langsung sebesar ${formatIDR(directDelta)} (potensi ketidakefisienan HPS/RAB).`,
        regulationCitation: 'Perlem LKPP No. 12 Tahun 2021 — Prinsip Kewajaran Volume & Harga Satuan HPS',
        technicalContextJustification:
          'Koreksi volume non-personel ke batas proporsional memastikan penyusunan anggaran sesuai kebutuhan riil operasional.',
        deterministicMetric: `Volume Saat Ini: ${qty} ${np.unit} · Rekomendasi: ${recommendedQty} ${np.unit}`,
      });

      adjustments.push({
        id: `adj-np-abnormal-${np.id}`,
        actionType: 'ADJUST_NON_PERSONNEL_QTY',
        targetId: np.id,
        title: `Koreksi Volume "${np.itemName}" ke Batas Wajar (${recommendedQty} ${np.unit})`,
        rationale: `Menyesuaikan volume item "${np.itemName}" dari ${qty} menjadi ${recommendedQty} ${np.unit} sesuai skala riil kebutuhan proyek.`,
        regulationCitation: 'Perlem LKPP No. 12 Tahun 2021',
        currentValueLabel: `${qty} ${np.unit} (${formatIDR(np.quantity * np.unitPrice)})`,
        recommendedValueLabel: `${recommendedQty} ${np.unit} (${formatIDR(recommendedQty * np.unitPrice)})`,
        recommendedNumericValue: recommendedQty,
        exactDirectCostDelta: -directDelta,
        exactGrandTotalDelta: -grandDelta,
      });
    }

    if (np.unitPrice > 200000000 && !isAbnormal) {
      findings.push({
        id: `finding-np-highprice-${np.id}`,
        severity: 'WARNING',
        category: 'REGULASI_TARIF',
        title: `Harga Satuan Tinggi pada "${np.itemName}" (${formatIDR(np.unitPrice)} / ${np.unit})`,
        diagnosis: `Komponen "${np.itemName}" memiliki harga satuan di atas Rp 200 Juta per unit yang memerlukan verifikasi dokumen pendukung (E-Katalog LKPP atau survei harga pasar resmi).`,
        regulationCitation: 'Perpres No. 12 Tahun 2021 Pasal 26 — Survei Harga Pasar & E-Katalog',
        technicalContextJustification: 'Pastikan spesifikasi teknis dan garansi sepadan dengan nilai satuan.',
        deterministicMetric: `Harga Satuan: ${formatIDR(np.unitPrice)}`,
      });
    }
  });

  // 9. Check Cybersecurity & QA Readiness for High/Strategic Complexity Projects
  const isHighOrStrategic =
    profile.complexity.startsWith('Tinggi') ||
    profile.complexity.startsWith('Kritis') ||
    (profile.layeredSecurityStandards && profile.layeredSecurityStandards.length >= 2);

  const hasSecurityTesting = nonPersonnelItems.some(
    (np) => np.category === 'Security Testing' && np.quantity > 0 && np.unitPrice > 0
  );
  const hasQaRole = personnelItems.some(
    (p) => p.roleId === 'role-qa-sec' && p.headcount > 0 && p.durationMonths > 0
  );

  if (isHighOrStrategic && (!hasSecurityTesting || !hasQaRole)) {
    const missingTargetId =
      !hasQaRole && !hasSecurityTesting
        ? 'MISSING_BOTH'
        : !hasQaRole
        ? 'MISSING_QA_ROLE'
        : 'MISSING_PENTEST';

    const secActionDraft: AuditAdjustmentAction = {
      id: 'adj-sec-readiness',
      actionType: 'ADD_SECURITY_COMPONENT',
      targetId: missingTargetId,
      title:
        missingTargetId === 'MISSING_BOTH'
          ? 'Lengkapi Peran QA/AppSec & Uji Penetrasi Siber (Pentest)'
          : missingTargetId === 'MISSING_QA_ROLE'
          ? 'Tambahkan Peran QA & Security Tester (AppSec) Sesuai Tarif Regulasi'
          : 'Tambahkan Komponen Uji Kelaikan Keamanan Siber (Penetration Testing)',
      rationale:
        'Menambahkan komponen pengujian keamanan siber wajib berdasarkan tarif standar regulasi aktif untuk memenuhi kepatuhan kelaikan proyek berisiko tinggi/kritis.',
      regulationCitation: 'Standar BSSN/Diskomlekau & SPBE',
      currentValueLabel: `${!hasQaRole ? 'Tanpa QA/AppSec' : 'QA Ada'} · ${!hasSecurityTesting ? 'Tanpa Pentest' : 'Pentest Ada'}`,
      recommendedValueLabel: 'QA/AppSec + Security Testing Lengkap',
      recommendedNumericValue: 1,
      exactDirectCostDelta: 0,
      exactGrandTotalDelta: 0,
    };
    const secDryRun = applyAuditAdjustmentsToState(
      profile,
      personnelItems,
      nonPersonnelItems,
      financials,
      [secActionDraft],
      regulationConfig
    );
    const secSummary = calculateProjectSummary(
      secDryRun.personnelItems,
      secDryRun.nonPersonnelItems,
      secDryRun.financials,
      profile.locationFactor
    );

    findings.push({
      id: 'finding-sec-readiness',
      severity: 'WARNING',
      category: 'KEAMANAN_SIBER',
      title: 'Rekomendasi Penguatan Verifikasi Kelaikan Siber (QA/AppSec & Penetration Testing)',
      diagnosis: `Proyek memiliki tingkat kompleksitas tinggi/kritis dengan standar keamanan berlapis, namun ${!hasQaRole ? 'belum mengalokasikan peran QA & Security Tester (AppSec)' : 'belum mencantumkan komponen non-personel Security Testing / Penetration Testing independen'}.`,
      regulationCitation: 'Pedoman Kelaikan Keamanan Siber Pertahanan & Standar BSSN/Diskomlekau',
      technicalContextJustification:
        'Sesuai prinsip larangan pemotongan yang mengorbankan keamanan, sistem menyarankan agar komponen pengujian keamanan tetap dipenuhi guna menjamin kelaikan operasional.',
      deterministicMetric: `Status QA Role: ${hasQaRole ? 'Ada' : 'Belum Ada'} · Security Testing: ${hasSecurityTesting ? 'Ada' : 'Belum Ada'}`,
    });

    adjustments.push({
      ...secActionDraft,
      exactDirectCostDelta: secSummary.directCostSubtotal - summary.directCostSubtotal,
      exactGrandTotalDelta: secSummary.grandTotalEstimation - summary.grandTotalEstimation,
    });
  } else if (hasSecurityTesting && hasQaRole) {
    findings.push({
      id: 'finding-sec-compliant',
      severity: 'COMPLIANT',
      category: 'KEAMANAN_SIBER',
      title: 'Kepatuhan Standar Keamanan Berlapis & Uji Kelaikan Siber Terpenuhi',
      diagnosis:
        'Struktur anggaran telah mencakup alokasi QA & Security Tester (AppSec) serta komponen uji keamanan siber (Security Testing/Pentest) yang memadai dan tidak boleh dipangkas.',
      regulationCitation: 'Standar Keamanan Informasi Pertahanan & SPBE',
      technicalContextJustification:
        'Biaya pengujian keamanan dan kriptografi merupakan investasi wajib untuk melindungi integritas data komando TNI AU.',
      deterministicMetric: 'Kepatuhan Keamanan Siber: TERVERIFIKASI',
    });
  }

  // Simulate exact post-adjustment summary deterministically
  const simulatedResult = applyAuditAdjustmentsToState(
    profile,
    personnelItems,
    nonPersonnelItems,
    financials,
    adjustments,
    regulationConfig
  );
  const projectedSummary = calculateProjectSummary(
    simulatedResult.personnelItems,
    simulatedResult.nonPersonnelItems,
    simulatedResult.financials,
    profile.locationFactor
  );

  const totalMeasuredSavings =
    summary.grandTotalEstimation - projectedSummary.grandTotalEstimation;

  const hasCritical = findings.some((f) => f.severity === 'CRITICAL');
  const hasWarning = findings.some((f) => f.severity === 'WARNING');

  let status: AuditStatusLevel = 'WAJAR / COMPLIANT';
  if (hasCritical) {
    status = 'ANOMALI KRITIS / INDIKASI KEMAHALAN';
  } else if (hasWarning) {
    status = 'PERINGATAN / PERLU REVIU';
  }

  const executiveSummary =
    adjustments.length === 0
      ? `Seluruh komponen biaya langsung personel (${formatIDR(summary.totalPersonnelCost)}), biaya non-personel (${formatIDR(summary.totalNonPersonnelCost)}), serta parameter keuangan pada proyek "${profile.projectName}" telah SESUAI (COMPLIANT) dengan rujukan ${regulationConfig.version} dan sepadan dengan profil kompleksitas teknis (${complexityAssessment.complexityScore}/100). Tidak diperlukan pemotongan anggaran.`
      : `Ditemukan ${adjustments.length} temuan penyesuaian terukur berbasis regulasi ${regulationConfig.version} pada proyek "${profile.projectName}". Seluruh beban kerja kompleksitas teknis utama tetap dipertahankan (tanpa pemotongan agresif). Apabila saran koreksi diterapkan, Grand Total HPS/RAB akan disesuaikan secara terukur dari ${formatIDR(summary.grandTotalEstimation)} menjadi ${formatIDR(projectedSummary.grandTotalEstimation)} (${totalMeasuredSavings >= 0 ? 'efisiensi' : 'penambahan'} bersih ${formatIDR(Math.abs(totalMeasuredSavings))}).`;

  const summaryAdvice =
    adjustments.length === 0
      ? status === 'WAJAR / COMPLIANT'
        ? 'Pertahankan struktur HPS/RAB saat ini. Alokasi tenaga ahli, infrastruktur, dan keamanan siber telah proporsional dan mematuhi batas tarif standar.'
        : 'Terdapat komponen berharga satuan tinggi yang memerlukan verifikasi survei harga pasar / E-Katalog LKPP tanpa pemotongan anggaran otomatis.'
      : 'Terapkan koreksi terukur pada komponen yang melampaui batas regulasi, duplikat administratif, atau kelengkapan keamanan di bawah ini untuk memulihkan status kepatuhan HPS/RAB.';

  return {
    status,
    source,
    modelUsed,
    auditedAt: new Date().toISOString(),
    regulationVersion: regulationConfig.version,
    executiveSummary,
    technicalComplexityAssessment: complexityAssessment,
    findings,
    solutions: {
      summaryAdvice,
      adjustments,
      currentGrandTotal: summary.grandTotalEstimation,
      projectedGrandTotalAfterAdjustments: projectedSummary.grandTotalEstimation,
      totalMeasuredSavings,
    },
  };
}

function isManagerialRoleName(roleName: string): boolean {
  const lower = roleName.toLowerCase();
  return (
    lower.includes('project manager') ||
    lower.includes('team lead') ||
    lower.includes('scrum master') ||
    lower.includes('lead')
  );
}

export function applyAuditAdjustmentsToState(
  profile: ProjectProfile,
  personnelItems: PersonnelAllocationItem[],
  nonPersonnelItems: NonPersonnelCostItem[],
  financials: FinancialParameters,
  adjustmentsToApply: AuditAdjustmentAction[],
  regulationConfig: RegulationConfigPayload = DEFAULT_REGULATION_CONFIG
): {
  personnelItems: PersonnelAllocationItem[];
  nonPersonnelItems: NonPersonnelCostItem[];
  financials: FinancialParameters;
} {
  let nextPersonnel = personnelItems.map((p) => ({ ...p }));
  let nextNonPersonnel = nonPersonnelItems.map((np) => ({ ...np }));
  let nextFinancials = { ...financials };

  for (const adj of adjustmentsToApply) {
    if (adj.actionType === 'NORMALIZE_OVERRIDE_RATE' && adj.targetId) {
      nextPersonnel = nextPersonnel.map((p) =>
        p.id === adj.targetId ? { ...p, overrideRate: null } : p
      );
    } else if (adj.actionType === 'CAP_PERSONNEL_DURATION' && adj.targetId) {
      nextPersonnel = nextPersonnel.map((p) =>
        p.id === adj.targetId
          ? { ...p, durationMonths: Math.min(p.durationMonths, profile.durationMonths) }
          : p
      );
    } else if (adj.actionType === 'ADJUST_OVERHEAD_PERCENT') {
      nextFinancials = {
        ...nextFinancials,
        overheadAndProfitPercent: adj.recommendedNumericValue,
      };
    } else if (adj.actionType === 'ADJUST_PPN_PERCENT') {
      nextFinancials = {
        ...nextFinancials,
        ppnPercent: adj.recommendedNumericValue,
      };
    } else if (adj.actionType === 'REDUCE_EXCESS_HEADCOUNT') {
      if (adj.id === 'adj-overstaffing-ceiling' || adj.targetId === 'ALL_OVERSTAFFING') {
        // 1. Consolidate duplicate roles and cap durations to project duration
        const groupMap = new Map<string, PersonnelAllocationItem>();
        nextPersonnel.forEach((p) => {
          const key = p.roleId || p.roleName.trim().toLowerCase();
          const cappedDur = Math.min(Math.max(1, p.durationMonths), profile.durationMonths);
          const existing = groupMap.get(key);
          if (!existing) {
            groupMap.set(key, { ...p, durationMonths: cappedDur });
          } else {
            existing.headcount += p.headcount;
            existing.durationMonths = Math.max(existing.durationMonths, cappedDur);
          }
        });
        let normalized = Array.from(groupMap.values());

        // 2. Enforce per-role ceiling (Managerial <= 1-2, Technical <= 6)
        const nonMgrTotal = normalized
          .filter((p) => !isManagerialRoleName(p.roleName) && !p.roleName.toLowerCase().includes('technical writer'))
          .reduce((acc, p) => acc + p.headcount, 0);
        const mgrCap = nonMgrTotal <= 3 ? 1 : 2;

        normalized = normalized.map((p) => {
          const isMgr = isManagerialRoleName(p.roleName);
          return {
            ...p,
            headcount: Math.min(p.headcount, isMgr ? mgrCap : 6),
          };
        });

        // 3. Scale down total headcount strictly <= 24 (within compliant zone <= 25)
        let totalHc = normalized.reduce((acc, p) => acc + p.headcount, 0);
        while (totalHc > 24) {
          let maxIdx = -1;
          let maxVal = 1;
          normalized.forEach((p, idx) => {
            if (p.headcount > maxVal) {
              maxVal = p.headcount;
              maxIdx = idx;
            }
          });
          if (maxIdx === -1) {
            // More than 24 distinct rows at headcount=1; trim last non-security row
            if (normalized.length > 24) {
              normalized.pop();
              totalHc = normalized.reduce((acc, p) => acc + p.headcount, 0);
            } else {
              break;
            }
          } else {
            normalized[maxIdx] = { ...normalized[maxIdx], headcount: normalized[maxIdx].headcount - 1 };
            totalHc -= 1;
          }
        }

        // 4. Scale down total OB strictly <= 420 (within compliant zone <= 450)
        let totalOb = normalized.reduce((acc, p) => acc + p.headcount * p.durationMonths, 0);
        while (totalOb > 420) {
          let maxIdx = -1;
          let maxScore = 0;
          normalized.forEach((p, idx) => {
            const ob = p.headcount * p.durationMonths;
            if ((p.headcount > 1 || p.durationMonths > 1) && ob > maxScore) {
              maxScore = ob;
              maxIdx = idx;
            }
          });
          if (maxIdx === -1) break;
          const target = normalized[maxIdx];
          if (target.headcount > 1) {
            normalized[maxIdx] = { ...target, headcount: target.headcount - 1 };
          } else if (target.durationMonths > 1) {
            normalized[maxIdx] = { ...target, durationMonths: Math.max(1, target.durationMonths - 1) };
          }
          totalOb = normalized.reduce((acc, p) => acc + p.headcount * p.durationMonths, 0);
        }

        nextPersonnel = normalized;
      } else if (adj.id === 'adj-team-composition-topheavy' || adj.targetId === 'MANAGERIAL_RATIO') {
        let keptFirstMgr = false;
        nextPersonnel = nextPersonnel
          .map((p) => {
            if (!isManagerialRoleName(p.roleName)) return p;
            if (!keptFirstMgr) {
              keptFirstMgr = true;
              return { ...p, headcount: 1 };
            }
            return { ...p, headcount: 0 };
          })
          .filter((p) => p.headcount > 0);
      } else if (adj.targetId) {
        const targetCap = Math.max(1, adj.recommendedNumericValue || 2);
        const matchingIndices: number[] = [];
        nextPersonnel.forEach((p, idx) => {
          if (p.roleId === adj.targetId || p.id === adj.targetId) {
            matchingIndices.push(idx);
          }
        });

        if (matchingIndices.length > 0) {
          let currentSum = matchingIndices.reduce((acc, idx) => acc + nextPersonnel[idx].headcount, 0);
          // First reduce headcount from the last matching row backwards
          for (let i = matchingIndices.length - 1; i >= 0 && currentSum > targetCap; i--) {
            const rowIdx = matchingIndices[i];
            const rowHc = nextPersonnel[rowIdx].headcount;
            const minKeep = i === 0 ? 1 : 0;
            if (rowHc > minKeep) {
              const deduct = Math.min(rowHc - minKeep, currentSum - targetCap);
              nextPersonnel[rowIdx] = { ...nextPersonnel[rowIdx], headcount: rowHc - deduct };
              currentSum -= deduct;
            }
          }
          nextPersonnel = nextPersonnel.filter((p) => p.headcount > 0);
        }
      }
    } else if (adj.actionType === 'ADJUST_NON_PERSONNEL_QTY' && adj.targetId) {
      nextNonPersonnel = nextNonPersonnel.map((np) =>
        np.id === adj.targetId
          ? { ...np, quantity: adj.recommendedNumericValue }
          : np
      );
    } else if (adj.actionType === 'DEDUPLICATE_NON_PERSONNEL' && adj.targetId) {
      const isNp = nextNonPersonnel.some((np) => np.id === adj.targetId);
      if (isNp) {
        nextNonPersonnel = nextNonPersonnel.filter((np) => np.id !== adj.targetId);
      } else {
        const roleIdMatch = adj.targetId.replace('role-', '');
        const roleGroups = new Map<string, PersonnelAllocationItem[]>();
        nextPersonnel.forEach((p) => {
          const key = p.roleId || p.roleName.trim().toLowerCase();
          if (!roleGroups.has(key)) roleGroups.set(key, [p]);
          else roleGroups.get(key)!.push(p);
        });

        const consolidated: PersonnelAllocationItem[] = [];
        roleGroups.forEach((groupRows, key) => {
          if (groupRows.length > 1 && (key.includes(roleIdMatch) || groupRows.some(g => g.roleId === adj.targetId))) {
            const first = groupRows[0];
            const totalHeadcount = groupRows.reduce((sum, r) => sum + r.headcount, 0);
            const maxDuration = Math.min(
              profile.durationMonths,
              Math.max(...groupRows.map((r) => r.durationMonths))
            );
            consolidated.push({
              ...first,
              headcount: totalHeadcount,
              durationMonths: maxDuration,
            });
          } else {
            consolidated.push(...groupRows);
          }
        });
        nextPersonnel = consolidated;
      }
    } else if (adj.actionType === 'ADD_SECURITY_COMPONENT') {
      const needsQa = adj.targetId === 'MISSING_QA_ROLE' || adj.targetId === 'MISSING_BOTH';
      const needsPentest = adj.targetId === 'MISSING_PENTEST' || adj.targetId === 'MISSING_BOTH';

      if (needsQa && !nextPersonnel.some((p) => p.roleId === 'role-qa-sec' && p.headcount > 0 && p.durationMonths > 0)) {
        const qaRole =
          regulationConfig.roleTariffs.find((r) => r.id === 'role-qa-sec') ||
          DEFAULT_REGULATION_CONFIG.roleTariffs.find((r) => r.id === 'role-qa-sec')!;
        nextPersonnel.push({
          id: `pers-sec-${Date.now()}`,
          roleId: qaRole.id,
          roleName: qaRole.roleName,
          tier: 'Senior',
          headcount: 1,
          durationMonths: Math.max(1, Math.min(profile.durationMonths, Math.ceil(profile.durationMonths * 0.5))),
          standardRate: qaRole.rates.Senior,
          overrideRate: null,
          taskDescription: 'Pengujian fungsional, AppSec, dan verifikasi kelaikan siber sesuai standar Diskomlekau.',
        });
      }

      if (needsPentest && !nextNonPersonnel.some((np) => np.category === 'Security Testing' && np.quantity > 0 && np.unitPrice > 0)) {
        const pentestStd =
          regulationConfig.nonPersonnelStandards.find((s) => s.category === 'Security Testing') ||
          DEFAULT_REGULATION_CONFIG.nonPersonnelStandards.find((s) => s.category === 'Security Testing')!;
        nextNonPersonnel.push({
          id: `np-sec-${Date.now()}`,
          category: 'Security Testing',
          itemName: pentestStd.name,
          quantity: 1,
          unit: pentestStd.unit,
          unitPrice: pentestStd.defaultUnitPrice,
          notes: 'Komponen wajib pengujian kelaikan keamanan siber independen.',
        });
      }
    }
  }

  return {
    personnelItems: nextPersonnel,
    nonPersonnelItems: nextNonPersonnel,
    financials: nextFinancials,
  };
}
