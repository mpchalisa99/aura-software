import { GoogleGenAI, Type } from '@google/genai';
import type { Request, Response } from 'express';
import {
  DEFAULT_REGULATION_CONFIG,
  HIGH_COMPLEXITY_MODULE_OPTIONS,
  LAYERED_SECURITY_STANDARD_OPTIONS,
  SPECIAL_INTEGRATION_OPTIONS,
} from '../src/data/defaultRegulations';
import { DraftEstimatePayload, RegulationConfigPayload } from '../src/types/aura';
import {
  analyzeStrategicDomainContext,
  buildPricedItemsFromDraft,
  classifyArchitecturalTier,
  generateDeterministicArchitecturalEstimate,
  normalizeDraftEstimate,
} from '../src/utils/architecturalEstimator';
import { formatIDR, formatNumberID } from '../src/utils/formatters';

interface AssistantRequestBody {
  message?: string;
  regulationConfig?: RegulationConfigPayload;
}

const SYSTEM_INSTRUCTION = `Anda adalah Arsitek Sistem Senior & Estimator HPS/RAB Perangkat Lunak TNI Angkatan Udara (Diskomlekau) pada aplikasi AURA-SOFTWARE yang mengacu pada Perpres No. 12 Tahun 2021, Perlem LKPP No. 12 Tahun 2021, SBM Kemenkeu TA 2026, dan Pedoman Billing Rate INKINDO 2026.

TUGAS WAJIB ANDA:
Petakan setiap permintaan pengguna secara TAJAM dan PROPORSIONAL ke salah satu dari 4 TIER KOMPLEKSITAS ARSITEKTUR berikut (JANGAN menyamaratakan aplikasi sederhana dengan sistem strategis):

1. TIER 1 — UTILITAS / APLIKASI STANDAR (contoh: aplikasi kalkulator, pencatatan sederhana, form statis, landing page, web profil, CRUD ringan):
   - tierClassification: "TIER 1"
   - complexityLevel: "Rendah (Sistem Informasi Standar / CRUD)"
   - procurementScheme: "Pengadaan Langsung (< Rp 100 Juta / Rp 200 Juta)"
   - complexityScore: 10–25
   - durationMonths: 1–2 Bulan
   - Tim: 2–3 Orang (misal role-frontend Junior/Middle, role-uiux atau role-qa-sec paruh waktu 0.5-1 bulan; TANPA AI Engineer, TANPA DevOps cluster, TANPA arsitek terdistribusi)
   - Non-Personel: minimal (hosting ringan Rp 1,5–2,5 jt/bln & dokumentasi dasar Rp 3,5–5 jt)
   - Kisaran Grand Total: puluhan juta hingga < Rp 150 Juta.

2. TIER 2 — SISTEM INFORMASI MENENGAH / PORTAL SATKER (contoh: e-office, administrasi personel Lanud, manajemen inventori/logistik standar, portal layanan internal):
   - tierClassification: "TIER 2"
   - complexityLevel: "Menengah (Integrasi Multi-Satker & Portal Layanan)"
   - procurementScheme: "E-Purchasing Katalog Elektronik (E-Katalog LKPP)"
   - complexityScore: 35–55
   - durationMonths: 3–5 Bulan
   - Tim: 5–7 Orang kualifikasi Middle (role-pm, role-sa, role-uiux, role-backend, role-frontend, role-qa-sec, role-tw)
   - Non-Personel: Cloud VPS standar, integrasi SSO/API ringan, dokumentasi, SLA dasar
   - Kisaran Grand Total: Rp 350 Juta – Rp 1,2 Miliar.

3. TIER 3 — SISTEM REAL-TIME, SPASIAL & TELEMETRI KOMPLEKS (contoh: pelacakan pesawat real-time seperti Flightradar24, pemrosesan stream ADS-B/radar/AIS, peta spasial GIS interaktif tinggi, multi-platform web & mobile):
   - tierClassification: "TIER 3"
   - complexityLevel: "Tinggi (Sistem Komando Taktis / C4ISR & Analitik Real-Time)"
   - procurementScheme: "Tender / Seleksi Jasa Konsultansi Badan Usaha"
   - complexityScore: 75–90
   - durationMonths: 8–12 Bulan
   - Tim: 11–16 Orang kualifikasi Senior–Lead (role-pm Senior, role-sa Lead, role-uiux Senior, role-backend 3 org Senior, role-frontend 2 org Senior, role-mobile 2 org Senior, role-ai-data Senior, role-devops Senior, role-qa-sec Senior, role-tw Middle)
   - Non-Personel: Server/Cloud cluster high-availability, lisensi map engine/spatial & feed data, integrasi API, penetration testing, dokumentasi, SLA 99.9%
   - Kisaran Grand Total: Rp 2,5 Miliar – Rp 6,5 Miliar.

4. TIER 4 — SISTEM STRATEGIS / PERTAHANAN SIBER & C4ISR KRITIS (contoh: komando pertahanan udara terintegrasi, sensor fusion multi-radar, kriptografi militer berlapis, pertahanan siber nasional/Kohanudnas):
   - tierClassification: "TIER 4"
   - complexityLevel: "Kritis / Strategis (Pertahanan Siber & Avionik Terintegrasi)"
   - procurementScheme: "Tender / Seleksi Jasa Konsultansi Badan Usaha"
   - complexityScore: 90–100
   - durationMonths: 12–18 Bulan
   - Tim: 16–24 Orang kualifikasi Senior & Lead / Principal dengan standar keamanan siber penuh
   - Non-Personel: Bare-metal/GPU cluster on-premise, lisensi sensor fusion/GIS/HSM, gateway protokol militer, red-teaming/audit kriptografi independen, transfer teknologi, SLA 24/7
   - Kisaran Grand Total: Rp 6,5 Miliar – Rp 12 Miliar.

ATURAN WAJIB KODE PERAN & KUALIFIKASI:
- Gunakan HANYA roleId valid berikut: "role-pm", "role-sa", "role-uiux", "role-backend", "role-frontend", "role-mobile", "role-ai-data", "role-qa-sec", "role-devops", "role-tw".
- Gunakan HANYA tier valid berikut: "Junior", "Middle", "Senior", "Lead / Principal".
- Gunakan HANYA kategori nonPersonnel valid berikut: "Server / Cloud", "Lisensi", "Integrasi API", "Security Testing", "Dokumentasi", "SLA & Pemeliharaan".
- Durasi setiap baris personel TIDAK BOLEH melebihi durationMonths proyek.
- Pada field "reply" (Bahasa Indonesia formal teknis), WAJIB sertakan 2 dimensi penalaran strategis berikut secara eksplisit dan konsisten 100% dengan "draftEstimate":
  A. PENALARAN KEMAMPUAN & KETERSEDIAAN SDM (TALENT SCARCITY & SKILL DEPTH):
     * Peran umum/standar (CRUD web/form, UI dasar, QA fungsional): talenta tersedia luas; gunakan tim ramping (Junior–Middle) tanpa membengkakkan OB.
     * Peran spesialis langka / domain kritis (telemetri real-time, avionik/radar/sensor, simulator pesawat tempur/fisika komputasi, kriptografi militer, optimasi AI kompleks): wajib gunakan kualifikasi Senior hingga Lead / Principal serta durasi integrasi & pengujian lebih panjang karena kurva belajar domain curam dan kelangkaan SDM tersertifikasi.
     * Jika permintaan menyebutkan keterbatasan SDM internal atau kebutuhan pendampingan/transfer teknologi (knowledge transfer / ToT / bimtek), alokasikan peran "role-tw" (Technical Writer & Trainer) dan paket pelatihan secara proporsional TANPA memaksakan tim engineering raksasa yang tidak efisien.
  B. PENALARAN FAKTOR IMPOR, LISENSI OEM, PERANGKAT KHUSUS & DOMAIN INDUSTRI:
     * Bedakan secara tegas antara aplikasi buatan lokal berbasis open-source/standar umum (biaya didominasi jam kerja lokal & hosting standar) dengan sistem yang bergantung pada lisensi OEM luar negeri, SDK/physics/visual engine khusus, integrasi perangkat keras/sensor/avionik (HIL), atau sertifikasi kelaikan militer.
     * Pada sistem berketergantungan impor/OEM/perangkat khusus (mis. simulator pesawat tempur, C4ISR, radar/avionik), jelaskan EKSPLISIT bahwa lonjakan biaya dipicu komponen impor/lisensi OEM, IP/kustomisasi khusus, standar keselamatan/kelaikan, dan SDM spesialis tersertifikasi — BUKAN sekadar menulis lebih banyak baris kode.
- ATURAN ANTI-HALUSINASI ANGKA: Jangan mengarang nominal Rupiah acak di dalam "reply" yang bertentangan dengan hasil perhitungan deterministik. Biarkan ringkasan nominal akhir diambil dari tabel regulasi aktif (${DEFAULT_REGULATION_CONFIG.version}).`;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`AI request timed out after ${ms}ms`));
    }, ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Metode HTTP tidak diizinkan. Gunakan POST untuk komunikasi dengan AURA Tactical Assistant.',
    });
  }

  const body = (req.body || {}) as AssistantRequestBody;
  const message = (body.message || '').trim();

  if (!message) {
    return res.status(400).json({ error: 'Pesan chat tidak boleh kosong.' });
  }

  const activeConfig: RegulationConfigPayload =
    body.regulationConfig?.roleTariffs?.length
      ? body.regulationConfig
      : DEFAULT_REGULATION_CONFIG;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || !apiKey.trim()) {
    const fallback = generateDeterministicArchitecturalEstimate(
      message,
      activeConfig,
      'SERVER_FALLBACK'
    );
    return res.status(200).json({
      ...fallback,
      source: 'LOCAL_DETERMINISTIC',
      modelUsed: 'Architectural-4Tier-Engine-v3.0',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const tierHint = classifyArchitecturalTier(message);
    const domainHint = analyzeStrategicDomainContext(message);

    const compactTariffReference = activeConfig.roleTariffs.map((r) => ({
      roleId: r.id,
      code: r.code,
      roleName: r.roleName,
      ratesRpPerOB: r.rates,
    }));

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        reply: { type: Type.STRING },
        draftEstimate: {
          type: Type.OBJECT,
          properties: {
            projectName: { type: Type.STRING },
            proposingUnit: { type: Type.STRING },
            procurementScheme: { type: Type.STRING },
            complexityLevel: { type: Type.STRING },
            tierClassification: { type: Type.STRING },
            complexityScore: { type: Type.INTEGER },
            recommendedOverheadPercent: { type: Type.NUMBER },
            talentScarcityProfile: { type: Type.STRING },
            supplyChainProfile: { type: Type.STRING },
            knowledgeTransferIncluded: { type: Type.BOOLEAN },
            durationMonths: { type: Type.INTEGER },
            locationFactor: { type: Type.NUMBER },
            highComplexityModules: { type: Type.ARRAY, items: { type: Type.STRING } },
            specialIntegrations: { type: Type.ARRAY, items: { type: Type.STRING } },
            layeredSecurityStandards: { type: Type.ARRAY, items: { type: Type.STRING } },
            personnel: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  roleId: { type: Type.STRING },
                  roleName: { type: Type.STRING },
                  tier: { type: Type.STRING },
                  headcount: { type: Type.INTEGER },
                  durationMonths: { type: Type.NUMBER },
                  taskDescription: { type: Type.STRING },
                },
                required: ['roleId', 'roleName', 'tier', 'headcount', 'durationMonths', 'taskDescription'],
              },
            },
            nonPersonnel: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  itemName: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  unitPrice: { type: Type.NUMBER },
                  notes: { type: Type.STRING },
                },
                required: ['category', 'itemName', 'quantity', 'unit', 'unitPrice', 'notes'],
              },
            },
          },
          required: [
            'projectName',
            'proposingUnit',
            'procurementScheme',
            'complexityLevel',
            'tierClassification',
            'complexityScore',
            'durationMonths',
            'locationFactor',
            'highComplexityModules',
            'specialIntegrations',
            'layeredSecurityStandards',
            'personnel',
            'nonPersonnel',
          ],
        },
      },
      required: ['reply', 'draftEstimate'],
    };

    const userPrompt = `Permintaan pengguna: "${message}"

Referensi Regulasi Aktif (${activeConfig.version}, PPN ${activeConfig.defaultPpnPercent}%, Overhead Wajar ${activeConfig.recommendedOverheadRange[0]}%-${activeConfig.recommendedOverheadRange[1]}%):
Tabel Billing Rate Peran (Rp/OB):
${JSON.stringify(compactTariffReference)}

Opsi Checkbox Fitur Resmi (gunakan string persis di bawah bila relevan, atau kosongkan [] untuk TIER 1):
- highComplexityModules: ${JSON.stringify(HIGH_COMPLEXITY_MODULE_OPTIONS)}
- specialIntegrations: ${JSON.stringify(SPECIAL_INTEGRATION_OPTIONS)}
- layeredSecurityStandards: ${JSON.stringify(LAYERED_SECURITY_STANDARD_OPTIONS)}

Indikasi awal klasifikasi & konteks domain strategis:
- Tier Arsitektur: ${tierHint.tier} (${tierHint.tierLabel})
- Profil Kelangkaan SDM: ${domainHint.talentScarcityProfile}
- Profil Rantai Pasok / Impor OEM: ${domainHint.supplyChainProfile}
- Kebutuhan Pendampingan / Transfer Teknologi Internal: ${domainHint.hasSdmConstraintOrToT ? 'YA (wajib sertakan porsi role-tw & kegiatan ToT proporsional tanpa membengkakkan headcount)' : 'Standar sesuai Tier'}
Pastikan estimasi, komposisi peran, non-personel (termasuk komponen OEM/impor bila relevan), dan narasi "reply" benar-benar selaras serta konsisten dengan tabel regulasi aktif.`;

    let activeModelName = 'gemini-2.5-flash';
    let responseText = '';

    try {
      const geminiRes = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userPrompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
        9200
      );
      responseText = geminiRes.text || '';
    } catch {
      activeModelName = 'gemini-4-hydrogen';
      const fallbackRes = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: userPrompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
        5500
      );
      responseText = fallbackRes.text || '';
    }

    const parsed = JSON.parse(responseText || '{}') as {
      reply?: string;
      draftEstimate?: Partial<DraftEstimatePayload>;
    };

    if (!parsed || !parsed.reply || !parsed.draftEstimate) {
      throw new Error('Format balasan AI tidak lengkap.');
    }

    // Normalize AI output and lock all pricing deterministically to active regulationConfig
    const normalizedDraft = normalizeDraftEstimate(
      parsed.draftEstimate,
      message,
      activeConfig
    );

    // Ensure at least 1 personnel item exists; otherwise use deterministic fallback
    if (normalizedDraft.personnel.length === 0) {
      throw new Error('Daftar personel AI kosong.');
    }

    const { summary } = buildPricedItemsFromDraft(normalizedDraft, activeConfig);

    // Append deterministic locked financial readout so chat text matches calculator 100%
    const verifiedFooter = `\n\n─── RINGKASAN TERKUNCI DETERMINISTIK (${activeConfig.version}) ───\n• Klasifikasi: ${normalizedDraft.tierLabel} (Skor ${normalizedDraft.complexityScore}/100)\n• Profil SDM & Rantai Pasok: ${normalizedDraft.talentScarcityProfile} | ${normalizedDraft.supplyChainProfile}\n• Durasi & Tim: ${normalizedDraft.durationMonths} Bulan · ${summary.totalPersonnelHeadcount} Orang (${formatNumberID(summary.totalManMonths, 1)} OB)\n• Biaya Personel: ${formatIDR(summary.totalPersonnelCost)}\n• Biaya Non-Personel: ${formatIDR(summary.totalNonPersonnelCost)}\n• Estimasi Grand Total HPS/RAB (incl. Overhead ${normalizedDraft.recommendedOverheadPercent ?? 10}% & PPN ${activeConfig.defaultPpnPercent}%): ${formatIDR(summary.grandTotalEstimation)}`;

    return res.status(200).json({
      reply: `${parsed.reply.trim()}${verifiedFooter}`,
      draftEstimate: normalizedDraft,
      source: 'AI_SERVER',
      modelUsed: activeModelName,
    });
  } catch {
    const fallback = generateDeterministicArchitecturalEstimate(
      message,
      activeConfig,
      'SERVER_FALLBACK'
    );
    return res.status(200).json({
      ...fallback,
      source: 'LOCAL_DETERMINISTIC',
      modelUsed: 'Architectural-4Tier-Engine-v3.0',
    });
  }
}
