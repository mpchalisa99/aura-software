import {
  CalculationSummary,
  FinancialParameters,
  NonPersonnelCostItem,
  PersonnelAllocationItem,
  ProjectProfile,
  RegulationConfigPayload,
} from '../types/aura';

export function formatIDR(amount: number): string {
  if (!Number.isFinite(amount)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatNumberID(num: number, decimals = 0): string {
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatTimestampID(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function calculateProjectSummary(
  personnelItems: PersonnelAllocationItem[],
  nonPersonnelItems: NonPersonnelCostItem[],
  financials: FinancialParameters,
  locationFactor = 1.0
): CalculationSummary {
  const safeFactor = Number.isFinite(locationFactor) && locationFactor > 0 ? locationFactor : 1.0;

  let totalManMonths = 0;
  let totalPersonnelHeadcount = 0;
  let totalPersonnelCost = 0;

  for (const item of personnelItems) {
    const hc = Math.max(0, Number(item.headcount) || 0);
    const dur = Math.max(0, Number(item.durationMonths) || 0);
    const activeRate =
      item.overrideRate !== null && item.overrideRate >= 0
        ? item.overrideRate
        : Math.max(0, Number(item.standardRate) || 0) * safeFactor;

    const mm = hc * dur;
    totalManMonths += mm;
    totalPersonnelHeadcount += hc;
    totalPersonnelCost += mm * activeRate;
  }

  let totalNonPersonnelCost = 0;
  for (const np of nonPersonnelItems) {
    const qty = Math.max(0, Number(np.quantity) || 0);
    const price = Math.max(0, Number(np.unitPrice) || 0);
    totalNonPersonnelCost += qty * price;
  }

  const directCostSubtotal = totalPersonnelCost + totalNonPersonnelCost;
  const overheadPct = Math.max(0, Number(financials.overheadAndProfitPercent) || 0);
  const ppnPct = Math.max(0, Number(financials.ppnPercent) || 0);

  // Rumus resmi sesuai spesifikasi:
  // 1. Subtotal Biaya Langsung = Total Biaya Personel + Total Biaya Non-Personel
  // 2. Nilai Overhead & Keuntungan = Subtotal Biaya Langsung × (% Overhead/Keuntungan)
  // 3. Harga Sebelum Pajak (DPP) = Subtotal Biaya Langsung + Nilai Overhead & Keuntungan
  // 4. Nilai PPN = DPP × (% PPN)
  // 5. Grand Total Estimasi = DPP + Nilai PPN
  const overheadAndProfitValue = directCostSubtotal * (overheadPct / 100);
  const dppBeforeTax = directCostSubtotal + overheadAndProfitValue;
  const ppnValue = dppBeforeTax * (ppnPct / 100);
  const grandTotalEstimation = dppBeforeTax + ppnValue;

  return {
    totalManMonths,
    totalPersonnelHeadcount,
    activeRolesCount: personnelItems.filter((i) => i.headcount > 0 && i.durationMonths > 0).length,
    activeNonPersonnelCount: nonPersonnelItems.filter((i) => i.quantity > 0 && i.unitPrice > 0).length,
    totalPersonnelCost,
    totalNonPersonnelCost,
    directCostSubtotal,
    overheadAndProfitValue,
    dppBeforeTax,
    ppnValue,
    grandTotalEstimation,
  };
}

export function validateRegulationPayload(data: unknown): {
  valid: boolean;
  error?: string;
  payload?: RegulationConfigPayload;
} {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Format JSON tidak valid (bukan objek).' };
  }

  const candidate = data as Partial<RegulationConfigPayload>;

  if (typeof candidate.version !== 'string' || !candidate.version.trim()) {
    return { valid: false, error: 'Field "version" wajib berupa string yang tidak kosong.' };
  }
  if (!Array.isArray(candidate.roleTariffs) || candidate.roleTariffs.length === 0) {
    return { valid: false, error: 'Field "roleTariffs" wajib berupa array daftar tarif personel.' };
  }
  if (!Array.isArray(candidate.regulations)) {
    return { valid: false, error: 'Field "regulations" wajib berupa array rujukan regulasi.' };
  }

  for (const role of candidate.roleTariffs) {
    if (!role.id || !role.roleName || !role.rates || typeof role.rates.Senior !== 'number') {
      return {
        valid: false,
        error: `Struktur tarif peran "${role?.roleName || 'Unknown'}" tidak memiliki rincian rates (Junior/Middle/Senior/Lead).`,
      };
    }
  }

  return {
    valid: true,
    payload: candidate as RegulationConfigPayload,
  };
}

export function generateClipboardReport(
  profile: ProjectProfile,
  personnelItems: PersonnelAllocationItem[],
  nonPersonnelItems: NonPersonnelCostItem[],
  financials: FinancialParameters,
  summary: CalculationSummary,
  regulationVersion: string
): string {
  const lines: string[] = [];
  const hr = '========================================================================';
  const subHr = '------------------------------------------------------------------------';

  lines.push(hr);
  lines.push('AURA-SOFTWARE — KERTAS KERJA ESTIMASI HARGA PERANGKAT LUNAK (HPS / RAB)');
  lines.push(`Versi Tabel Regulasi : ${regulationVersion}`);
  lines.push(`Waktu Cetak          : ${formatTimestampID(new Date().toISOString())}`);
  lines.push(hr);
  lines.push('');
  lines.push('I. PROFIL PROYEK & PENGADAAN');
  lines.push(subHr);
  lines.push(`Nama Proyek / Aplikasi : ${profile.projectName}`);
  lines.push(`Satuan Kerja Pengusul  : ${profile.proposingUnit}`);
  lines.push(`Tahun Anggaran         : ${profile.fiscalYear}`);
  lines.push(`Skema Pengadaan        : ${profile.procurementScheme}`);
  lines.push(`Tingkat Kompleksitas   : ${profile.complexity}`);
  lines.push(`Durasi Pengerjaan      : ${profile.durationMonths} Bulan`);
  lines.push(`Faktor Indeks Lokasi   : ${profile.locationFactor.toFixed(2)}x`);
  if (profile.notes) {
    lines.push(`Catatan Teknis         : ${profile.notes}`);
  }
  lines.push('');
  lines.push('II. RINCIAN BIAYA LANGSUNG PERSONEL (MAN-MONTH / OB)');
  lines.push(subHr);

  personnelItems.forEach((item, idx) => {
    const activeRate =
      item.overrideRate !== null && item.overrideRate >= 0
        ? item.overrideRate
        : item.standardRate * profile.locationFactor;
    const mm = item.headcount * item.durationMonths;
    const subtotal = mm * activeRate;
    const rateTag = item.overrideRate !== null ? ' [OVERRIDE PROYEK]' : '';

    lines.push(
      `${idx + 1}. ${item.roleName} (${item.tier})${rateTag}`
    );
    lines.push(
      `   Volume: ${item.headcount} Orang x ${item.durationMonths} Bulan = ${mm} OB | Tarif: ${formatIDR(activeRate)}/OB | Subtotal: ${formatIDR(subtotal)}`
    );
  });
  lines.push(subHr);
  lines.push(`Total Volume Personel  : ${formatNumberID(summary.totalManMonths, 1)} Orang-Bulan (OB) (${summary.totalPersonnelHeadcount} Personel)`);
  lines.push(`Total Biaya Personel   : ${formatIDR(summary.totalPersonnelCost)}`);
  lines.push('');
  lines.push('III. RINCIAN BIAYA LANGSUNG NON-PERSONEL');
  lines.push(subHr);

  nonPersonnelItems.forEach((item, idx) => {
    const subtotal = item.quantity * item.unitPrice;
    lines.push(`${idx + 1}. [${item.category}] ${item.itemName}`);
    lines.push(
      `   Volume: ${item.quantity} ${item.unit} x ${formatIDR(item.unitPrice)} = ${formatIDR(subtotal)}`
    );
  });
  lines.push(subHr);
  lines.push(`Total Biaya Non-Personel: ${formatIDR(summary.totalNonPersonnelCost)}`);
  lines.push('');
  lines.push('IV. REKAPITULASI PERHITUNGAN HPS / RAB');
  lines.push(subHr);
  lines.push(`1. Total Biaya Langsung Personel       : ${formatIDR(summary.totalPersonnelCost)}`);
  lines.push(`2. Total Biaya Langsung Non-Personel   : ${formatIDR(summary.totalNonPersonnelCost)}`);
  lines.push(`3. Subtotal Biaya Langsung (1 + 2)     : ${formatIDR(summary.directCostSubtotal)}`);
  lines.push(
    `4. Overhead & Keuntungan Wajar (${financials.overheadAndProfitPercent}%) : ${formatIDR(summary.overheadAndProfitValue)}`
  );
  lines.push(`5. Harga Sebelum Pajak / DPP (3 + 4)   : ${formatIDR(summary.dppBeforeTax)}`);
  lines.push(`6. Pajak Pertambahan Nilai / PPN (${financials.ppnPercent}%): ${formatIDR(summary.ppnValue)}`);
  lines.push(hr);
  lines.push(`GRAND TOTAL ESTIMASI (HPS / RAB)       : ${formatIDR(summary.grandTotalEstimation)}`);
  lines.push(hr);
  lines.push('');
  lines.push('CATATAN DISCLAIMER FORMAL:');
  lines.push(
    'Hasil perhitungan AURA-SOFTWARE ini merupakan alat bantu analisis dan estimasi awal penyusunan Kertas Kerja HPS/RAB. Penetapan resmi Harga Perkiraan Sendiri (HPS) dan Rencana Anggaran Biaya (RAB) tetap mengikuti verifikasi teknis, analisis pasar terkini, serta pengesahan Pejabat Pembuat Komitmen (PPK) / Unit Berwenang sesuai peraturan perundang-undangan yang berlaku.'
  );

  return lines.join('\n');
}
