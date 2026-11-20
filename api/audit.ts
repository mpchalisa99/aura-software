import { GoogleGenAI, Type } from '@google/genai';
import type { Request, Response } from 'express';
import {
  AuditFindingItem,
  AuditReportResult,
  AuditStatusLevel,
  FinancialParameters,
  NonPersonnelCostItem,
  PersonnelAllocationItem,
  ProjectProfile,
  RegulationConfigPayload,
} from '../src/types/aura';
import { runDeterministicAudit } from '../src/utils/auditEngine';
import { calculateProjectSummary, formatIDR, formatNumberID } from '../src/utils/formatters';

interface AuditRequestBody {
  profile?: ProjectProfile;
  personnelItems?: PersonnelAllocationItem[];
  nonPersonnelItems?: NonPersonnelCostItem[];
  financials?: FinancialParameters;
  regulationConfig?: RegulationConfigPayload;
}

const SYSTEM_INSTRUCTION = `Anda adalah Auditor Ahli Pengadaan Barang/Jasa Pemerintah & Arsitek Sistem Militer TNI Angkatan Udara pada sistem AURA-SOFTWARE (Disinfolahtaau).
Tugas Anda adalah mengevaluasi kewajaran Kertas Kerja Harga Perkiraan Sendiri (HPS) / Rencana Anggaran Biaya (RAB) perangkat lunak berdasarkan:
1. Regulasi resmi aktif (Perpres No. 12 Tahun 2021, Perlem LKPP No. 12 Tahun 2021, SBM Kemenkeu, Billing Rate INKINDO, dan UU HPP PPN).
2. Pemahaman Kompleksitas Teknis Mendalam:
   - Modul berkompleksitas tinggi (pemrosesan data/telemetri real-time, algoritma AI/ML, C4ISR, arsitektur terdistribusi).
   - Integrasi sistem khusus (gateway lintas satker, protokol komunikasi taktis terenkripsi, sinkronisasi multi-lanud offline-first, migrasi data).
   - Standar keamanan berlapis (enkripsi end-to-end TLS/HSM, MFA/RBAC/TTE BSrE, SIEM audit trail, hardening & penetration testing BSSN/ITSec).
   JANGAN PERNAH menandai kebutuhan biaya atau beban kerja (man-month maupun infrastruktur non-personel seperti Dedicated Cloud, Lisensi Kriptografi, atau Penetration Testing) sebagai pemborosan/anomali apabila memang sepadan dengan kompleksitas teknis, integrasi khusus, atau standar keamanan berlapis pada proyek.

ATURAN PENGUNCIAN KETAT (GUARDRAILS):
- DILARANG BERHALUSINASI ANGKA: Setiap angka Rupiah (Rp), persentase (%), volume Orang-Bulan (OB), dan selisih penghematan WAJIB menggunakan angka deterministik yang sudah dihitung di dalam payload "DATA DETERMINISTIK TERKUNCI". Dilarang mengarang nominal baru atau menebak angka di luar data terverifikasi.
- DILARANG MENYARANKAN PEMOTONGAN AGRESIF / TIDAK REALISTIS: Dilarang menyarankan pemangkasan jumlah personel inti, durasi kontrak utama, atau penghapusan komponen keamanan siber yang dapat mengorbankan kualitas, keamanan, keandalan, dan kelaikan operasional TNI AU. Rekomendasi penyesuaian hanya boleh bersifat terukur, proporsional, dan realistis sesuai daftar penyesuaian deterministik.`;

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Metode HTTP tidak diizinkan. Gunakan metode POST untuk meminta analisis audit HPS/RAB.',
    });
  }

  const body = (req.body || {}) as AuditRequestBody;
  const { profile, personnelItems, nonPersonnelItems, financials, regulationConfig } = body;

  if (
    !profile ||
    !Array.isArray(personnelItems) ||
    !Array.isArray(nonPersonnelItems) ||
    !financials ||
    !regulationConfig
  ) {
    return res.status(400).json({
      error:
        'Payload permintaan audit tidak lengkap. Wajib menyertakan profile, personnelItems, nonPersonnelItems, financials, dan regulationConfig.',
    });
  }

  // Always compute the deterministic baseline on the server so numbers are 100% locked and tamper-proof
  const deterministicBase = runDeterministicAudit(
    profile,
    personnelItems,
    nonPersonnelItems,
    financials,
    regulationConfig,
    'AI_SERVER_AUDIT',
    'gemini-2.5-flash'
  );

  const summary = calculateProjectSummary(
    personnelItems,
    nonPersonnelItems,
    financials,
    profile.locationFactor
  );

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || !apiKey.trim()) {
    return res.status(503).json({
      error:
        'Variabel lingkungan server GEMINI_API_KEY belum dikonfigurasi. Menggunakan mesin audit deterministik terverifikasi.',
      fallbackReport: {
        ...deterministicBase,
        source: 'LOCAL_HEURISTIC_ENGINE',
      },
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const lockedPayloadSummary = {
      projectProfile: {
        projectName: profile.projectName,
        proposingUnit: profile.proposingUnit,
        procurementScheme: profile.procurementScheme,
        complexityLevel: profile.complexity,
        durationMonths: profile.durationMonths,
        locationFactor: profile.locationFactor,
        highComplexityModules: profile.highComplexityModules || [],
        specialIntegrations: profile.specialIntegrations || [],
        layeredSecurityStandards: profile.layeredSecurityStandards || [],
      },
      regulationMetadata: {
        version: regulationConfig.version,
        sourceAuthority: regulationConfig.sourceAuthority,
        recommendedOverheadRange: regulationConfig.recommendedOverheadRange,
        defaultPpnPercent: regulationConfig.defaultPpnPercent,
      },
      deterministicCalculations: {
        totalManMonths: `${formatNumberID(summary.totalManMonths, 1)} OB`,
        totalPersonnelHeadcount: `${summary.totalPersonnelHeadcount} Orang`,
        totalPersonnelCost: formatIDR(summary.totalPersonnelCost),
        totalNonPersonnelCost: formatIDR(summary.totalNonPersonnelCost),
        directCostSubtotal: formatIDR(summary.directCostSubtotal),
        overheadPercent: `${financials.overheadAndProfitPercent}%`,
        overheadValue: formatIDR(summary.overheadAndProfitValue),
        dppBeforeTax: formatIDR(summary.dppBeforeTax),
        ppnPercent: `${financials.ppnPercent}%`,
        ppnValue: formatIDR(summary.ppnValue),
        grandTotalEstimation: formatIDR(summary.grandTotalEstimation),
        projectedGrandTotalAfterAdjustments: formatIDR(
          deterministicBase.solutions.projectedGrandTotalAfterAdjustments
        ),
        totalMeasuredSavings: formatIDR(
          Math.abs(deterministicBase.solutions.totalMeasuredSavings)
        ),
      },
      lockedStatus: deterministicBase.status,
      complexityScore: deterministicBase.technicalComplexityAssessment.complexityScore,
      deterministicFindings: deterministicBase.findings,
      deterministicAdjustments: deterministicBase.solutions.adjustments,
    };

    const userPrompt = `Lakukan audit mendalam atas Kertas Kerja HPS/RAB proyek berikut dengan mematuhi aturan ANTI-HALUSINASI ANGKA dan LARANGAN PEMOTONGAN TIDAK REALISTIS.
Gunakan HANYA angka deterministik yang tertera pada DATA DETERMINISTIK TERKUNCI di bawah ini:

DATA DETERMINISTIK TERKUNCI:
${JSON.stringify(lockedPayloadSummary, null, 2)}

Tuliskan dalam Bahasa Indonesia formal militer/pemerintahan yang tajam dan objektif:
1. executiveSummary: Ringkasan eksekutif hasil audit yang mengutip angka Grand Total (${formatIDR(summary.grandTotalEstimation)}), status kepatuhan regulasi (${regulationConfig.version}), dan evaluasi kompleksitas teknis.
2. workloadJustificationSummary: Analisis mengapa beban kerja (${formatNumberID(summary.totalManMonths, 1)} OB) dan komponen non-personel (${formatIDR(summary.totalNonPersonnelCost)}) sepadan dengan modul kompleksitas tinggi, integrasi khusus, dan standar keamanan berlapis yang dipilih.
3. summaryAdvice: Rekomendasi solusi terukur dan proporsional tanpa pemotongan agresif.
4. refinedFindings: Diperbolehkan memperkaya narasi diagnosis dan technicalContextJustification dari deterministicFindings dengan tetap mempertahankan angka deterministicMetric dan regulationCitation yang sama persis.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        executiveSummary: {
          type: Type.STRING,
          description: 'Ringkasan eksekutif audit HPS/RAB menggunakan angka deterministik.',
        },
        workloadJustificationSummary: {
          type: Type.STRING,
          description:
            'Penjelasan kelayakan beban kerja berdasarkan kompleksitas teknis, integrasi khusus, dan keamanan berlapis.',
        },
        summaryAdvice: {
          type: Type.STRING,
          description: 'Saran perbaikan terukur dan realistis tanpa pemotongan membabi buta.',
        },
        refinedFindings: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              diagnosis: { type: Type.STRING },
              technicalContextJustification: { type: Type.STRING },
            },
            required: ['id', 'title', 'diagnosis', 'technicalContextJustification'],
          },
        },
      },
      required: [
        'executiveSummary',
        'workloadJustificationSummary',
        'summaryAdvice',
        'refinedFindings',
      ],
    };

    let responseText = '';
    let activeModelName = 'gemini-2.5-flash';

    try {
      const geminiRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.15,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      responseText = geminiRes.text || '';
    } catch (primaryErr) {
      // Fallback to gemini-4-hydrogen if gemini-2.5-flash is unavailable in the current region/account
      activeModelName = 'gemini-4-hydrogen';
      const fallbackRes = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      responseText = fallbackRes.text || '';
    }

    const parsedAi = JSON.parse(responseText || '{}') as {
      executiveSummary?: string;
      workloadJustificationSummary?: string;
      summaryAdvice?: string;
      refinedFindings?: Array<{
        id: string;
        title: string;
        diagnosis: string;
        technicalContextJustification: string;
      }>;
    };

    // Merge AI narrative with locked deterministic metrics & adjustments so numbers can NEVER be hallucinated
    const mergedFindings: AuditFindingItem[] = deterministicBase.findings.map((baseFinding) => {
      const match = parsedAi.refinedFindings?.find((rf) => rf.id === baseFinding.id);
      if (!match) return baseFinding;
      return {
        ...baseFinding,
        title: match.title || baseFinding.title,
        diagnosis: match.diagnosis || baseFinding.diagnosis,
        technicalContextJustification:
          match.technicalContextJustification || baseFinding.technicalContextJustification,
      };
    });

    const finalReport: AuditReportResult = {
      ...deterministicBase,
      source: 'AI_SERVER_AUDIT',
      modelUsed: activeModelName,
      auditedAt: new Date().toISOString(),
      executiveSummary: parsedAi.executiveSummary || deterministicBase.executiveSummary,
      technicalComplexityAssessment: {
        ...deterministicBase.technicalComplexityAssessment,
        workloadJustificationSummary:
          parsedAi.workloadJustificationSummary ||
          deterministicBase.technicalComplexityAssessment.workloadJustificationSummary,
      },
      findings: mergedFindings,
      solutions: {
        ...deterministicBase.solutions,
        summaryAdvice: parsedAi.summaryAdvice || deterministicBase.solutions.summaryAdvice,
      },
    };

    return res.status(200).json(finalReport);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses audit AI.';
    return res.status(502).json({
      error: `Layanan AI Server tidak dapat menyelesaikan permintaan (${message}). Menampilkan hasil analisis mesin deterministik terverifikasi.`,
      fallbackReport: {
        ...deterministicBase,
        source: 'LOCAL_HEURISTIC_ENGINE',
      },
    });
  }
}
