import { GoogleGenAI, Type } from '@google/genai';
import type { Request, Response } from 'express';
import {
  AuditFindingItem,
  AuditReportResult,
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
Tugas Anda adalah mengevaluasi kewajaran Kertas Kerja Harga Perkiraan Sendiri (HPS) / Rencana Anggaran Biaya (RAB) perangkat lunak dengan fokus khusus pada:
1. Regulasi resmi aktif (Perpres No. 12 Tahun 2021, Perlem LKPP No. 12 Tahun 2021, SBM Kemenkeu, Billing Rate INKINDO, dan UU HPP PPN).
2. Deteksi Duplikasi & Jumlah Berlebih Per Peran (Man-Month / OB):
   - Mengagregasikan seluruh baris peran yang sama/sejenis.
   - Memberikan peringatan anomali kritis apabila peran manajerial/koordinasi (Project Manager, Team Lead) muncul berulang kali atau tidak proporsional terhadap ukuran tim teknis.
3. Analisis Rasio Komposisi Tim Pengembangan Software:
   - Evaluasi proporsi peran manajerial dibanding peran teknis & produksi serta pendukung.
4. Pemahaman Kompleksitas Teknis Mendalam:
   - Modul tinggi, integrasi khusus, dan standar keamanan berlapis tidak boleh ditandai sebagai pemborosan apabila sepadan dengan spesifikasi operasional.

ATURAN PENGUNCIAN KETAT (GUARDRAILS):
- DILARANG BERHALUSINASI ANGKA: Setiap angka Rupiah (Rp), persentase (%), volume Orang-Bulan (OB), dan selisih penghematan WAJIB menggunakan angka deterministik yang sudah dihitung di dalam payload "DATA DETERMINISTIK TERKUNCI". Dilarang mengarang nominal baru atau menebak angka di luar data terverifikasi.
- DILARANG MENYARANKAN PEMOTONGAN AGRESIF / TIDAK REALISTIS: Dilarang menyarankan pemangkasan jumlah personel inti, durasi kontrak utama, atau penghapusan komponen keamanan siber yang dapat mengorbankan kualitas, keamanan, keandalan, dan kelaikan operasional TNI AU.`;

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
      },
      deterministicCalculations: {
        totalManMonths: `${formatNumberID(summary.totalManMonths, 1)} OB`,
        totalPersonnelHeadcount: `${summary.totalPersonnelHeadcount} Orang`,
        totalPersonnelCost: formatIDR(summary.totalPersonnelCost),
        totalNonPersonnelCost: formatIDR(summary.totalNonPersonnelCost),
        directCostSubtotal: formatIDR(summary.directCostSubtotal),
        grandTotalEstimation: formatIDR(summary.grandTotalEstimation),
      },
      lockedStatus: deterministicBase.status,
      complexityScore: deterministicBase.technicalComplexityAssessment.complexityScore,
      deterministicFindings: deterministicBase.findings,
      deterministicAdjustments: deterministicBase.solutions.adjustments,
    };

    const userPrompt = `Lakukan audit mendalam atas Kertas Kerja HPS/RAB proyek berikut dengan fokus pada deteksi duplikasi peran manajerial, rasio komposisi tim, dan kepatuhan regulasi. Gunakan HANYA angka deterministik yang tertera pada DATA DETERMINISTIK TERKUNCI di bawah ini:

DATA DETERMINISTIK TERKUNCI:
${JSON.stringify(lockedPayloadSummary, null, 2)}

Tuliskan dalam Bahasa Indonesia formal militer/pemerintahan:
1. executiveSummary: Ringkasan eksekutif hasil audit yang mengutip angka Grand Total (${formatIDR(summary.grandTotalEstimation)}), status kepatuhan regulasi (${regulationConfig.version}), dan evaluasi komposisi tim.
2. workloadJustificationSummary: Analisis mengapa beban kerja dan komposisi tim sepadan dengan kompleksitas teknis.
3. summaryAdvice: Rekomendasi solusi terukur dan proporsional.
4. refinedFindings: Diperbolehkan memperkaya narasi diagnosis dan technicalContextJustification dari deterministicFindings.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        executiveSummary: { type: Type.STRING },
        workloadJustificationSummary: { type: Type.STRING },
        summaryAdvice: { type: Type.STRING },
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
    } catch {
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
