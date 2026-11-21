import { GoogleGenAI, Type } from '@google/genai';
import type { Request, Response } from 'express';
import { DraftEstimatePayload } from '../src/types/aura';

interface AssistantRequestBody {
  message?: string;
  regulationConfig?: any;
}

const SYSTEM_INSTRUCTION = `Anda adalah Asisten AI Taktis Pengadaan Perangkat Lunak TNI Angkatan Udara (Disinfolahtaau) dan Ahli HPS/RAB Pengadaan Barang/Jasa Pemerintah (Perpres No. 12 Tahun 2021 & SBM Kemenkeu 2026).
Tugas Anda adalah:
1. Menganalisis kebutuhan sistem informasi/perangkat lunak militer atau pemerintahan yang diminta pengguna.
2. Memberikan penjelasan teknis, arsitektur, dan dasar regulasi yang relevan (misalnya C4ISR, SWA BHUWANA PAKSA, enkripsi militer, integrasi radar, portal e-office).
3. Menyusun draf estimasi anggaran terstruktur (draftEstimate) yang mencakup:
   - projectName: Nama proyek sesuai usulan.
   - proposingUnit: Satuan pengusul (misalnya Dinas Informasi dan Pengolahan Data Angkatan Udara / Disinfolahtaau).
   - procurementScheme: Skema pengadaan wajar (misalnya "Tender / Seleksi Jasa Konsultansi Badan Usaha" atau "Swakelola Tipe I / Internal TNI AU").
   - complexityLevel: Tingkat kompleksitas (misalnya "Tinggi (Sistem Komando Taktis / C4ISR & Analitik Real-Time)" atau "Kritis / Strategis").
   - durationMonths: Durasi proyek dalam bulan (misalnya 6, 12, atau 18).
   - locationFactor: Indeks lokasi (default 1.00).
   - highComplexityModules: Daftar modul utama yang relevan.
   - specialIntegrations: Daftar integrasi khusus (misalnya API Gateway, Radar Feed).
   - layeredSecurityStandards: Standar keamanan berlapis (misalnya "ISO 27001", "Pentest Independen BSSN").
   - personnel: Alokasi tenaga ahli proporsional (mengacu pada kode peran TA-01 s.d. TA-10, kualifikasi, jumlah orang rasional 2-6 per peran, durasi).
   - nonPersonnel: Biaya pendukung (Server Cloud, Lisensi, Integrasi API, Security Testing, Dokumentasi, SLA).

DILARANG BERHALUSINASI ANGKA TAHUN ATAU TARIF DI LUAR STANDAR RESMI SBM / INKINDO 2026. Gunakan tarif satuan yang wajar dan proporsional.`;

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

  const apiKey = process.env.GEMINI_API_KEY;

  // Local Deterministic Fallback Generator
  const generateDeterministicAssistantFallback = (userMsg: string) => {
    const lower = userMsg.toLowerCase();
    let projName = 'Sistem Informasi Komando & Layanan Taktis TNI AU';
    let duration = 12;
    let complexity = 'Tinggi (Sistem Komando Taktis / C4ISR & Analitik Real-Time)';
    let headcounts = { pm: 1, arch: 1, dev: 4, qa: 2, devops: 2 };

    if (lower.includes('flightradar') || lower.includes('pesawat') || lower.includes('real-time')) {
      projName = 'Sistem Real-Time Radar & Pelacakan Penerbangan Taktis (FlightTracker TNI AU)';
      duration = 10;
    } else if (lower.includes('siber') || lower.includes('cyber') || lower.includes('telemetri')) {
      projName = 'Pusat Operasi Pertahanan Siber & Telemetri Komando Pertahanan Udara (Kohanudnas)';
      duration = 14;
    } else if (lower.includes('e-office') || lower.includes('administrasi') || lower.includes('lanud')) {
      projName = 'Portal Terpadu E-Office & Administrasi Personel Markas Besar TNI AU';
      duration = 8;
    }

    const draftEstimate: DraftEstimatePayload = {
      projectName: projName,
      proposingUnit: 'Dinas Informasi dan Pengolahan Data Angkatan Udara (Disinfolahtaau)',
      procurementScheme: 'Tender / Seleksi Jasa Konsultansi Badan Usaha',
      complexityLevel: complexity,
      durationMonths: duration,
      locationFactor: 1.00,
      highComplexityModules: [
        'Modul Inti & Dashboard Komando Operasi',
        'Mesin Pemrosesan Data & Enkripsi Kriptografi Militer',
        'Gateway Integrasi Sensor & API Eksternal',
        'Modul Audit Trail & Keamanan Berlapis (AppSec)'
      ],
      specialIntegrations: [
        'Integrasi Radar / Sensor Telemetri (REST/WebSocket)',
        'Active Directory / LDAP Mabes TNI AU SSO'
      ],
      layeredSecurityStandards: [
        'ISO 27001:2022 Information Security Management',
        'Penetration Testing & Vulnerability Assessment Independen',
        'Enkripsi Data AES-256 (At Rest & In Transit)'
      ],
      personnel: [
        { roleId: 'role-pm', roleName: 'Project Manager / Team Leader', tier: 'Senior', headcount: headcounts.pm, durationMonths: duration, taskDescription: 'Manajemen Proyek, Pelaporan Komando, & Mitigasi Risiko' },
        { roleId: 'role-arch', roleName: 'Solution / System Architect', tier: 'Lead / Principal', headcount: headcounts.arch, durationMonths: duration, taskDescription: 'Desain Arsitektur Sistem C4ISR & Standar Enkripsi' },
        { roleId: 'role-dev', roleName: 'Full-Stack Software Engineer / Developer', tier: 'Senior', headcount: headcounts.dev, durationMonths: duration, taskDescription: 'Pengembangan Backend Core & Frontend Tactical HUD' },
        { roleId: 'role-qa-sec', roleName: 'QA & Security Specialist (AppSec)', tier: 'Senior', headcount: headcounts.qa, durationMonths: duration, taskDescription: 'Pengujian Kelaikan Fungsional & Pentest Keamanan Siber' },
        { roleId: 'role-devops', roleName: 'DevOps & Cloud Infrastructure Engineer', tier: 'Senior', headcount: headcounts.devops, durationMonths: duration, taskDescription: 'Penerapan Cluster Server On-Premise / Secure Cloud TNI AU' }
      ],
      nonPersonnel: [
        { category: 'Server / Cloud', itemName: 'Dedicated Secure Cloud Server & Kubernetes Cluster', quantity: duration, unit: 'Bulan', unitPrice: 15000000, notes: 'Infrastruktur High-Availability & Isolated VPC' },
        { category: 'Lisensi', itemName: 'Enterprise Database & Middleware Licences', quantity: 1, unit: 'Paket', unitPrice: 45000000, notes: 'Lisensi komersial terverifikasi TKDN' },
        { category: 'Integrasi API', itemName: 'Secure API Gateway & Sensor Connector SDK', quantity: 2, unit: 'Paket', unitPrice: 20000000, notes: 'Koneksi telemetri dan enkripsi token' },
        { category: 'Security Testing', itemName: 'Independent Penetration Testing & Vulnerability Audit', quantity: 2, unit: 'Kegiatan', unitPrice: 30000000, notes: 'Audit kelaikan siber oleh lembaga independen' },
        { category: 'Dokumentasi', itemName: 'Buku Manual Teknis, Arsitektur, & SOP Administrator', quantity: 3, unit: 'Kegiatan', unitPrice: 7500000, notes: 'Dokumentasi lengkap serah terima sistem' }
      ]
    };

    const reply = `ANALISIS TAKTIS AI (DETERMINISTIC FALLBACK):
Berdasarkan permintaan Anda ("${userMsg}"), sistem AURA menyusun draf estimasi pengadaan perangkat lunak untuk **${projName}** dengan durasi ${duration} bulan. 
Perhitungan mengacu pada Pedoman Perpres No. 12 Tahun 2021 dan standar Billing Rate SBM/INKINDO 2026. Struktur tim dirancang proporsional (${headcounts.pm + headcounts.arch + headcounts.dev + headcounts.qa + headcounts.devops} tenaga ahli inti) dengan standar keamanan berlapis untuk menjamin kelaikan operasional TNI AU.
Silakan klik tombol **"TERAPKAN KE FORM KALKULATOR"** di bawah untuk memuat draf ini ke kalkulator utama.`;

    return { reply, draftEstimate };
  };

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || !apiKey.trim()) {
    const fallback = generateDeterministicAssistantFallback(message);
    return res.status(200).json(fallback);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

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
                  durationMonths: { type: Type.INTEGER },
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9500);

    const geminiRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Pengguna meminta estimasi/chat taktis: "${message}". Buat analisis dan draftEstimate terstruktur sesuai instruksi sistem.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    clearTimeout(timeout);

    const text = geminiRes.text || '{}';
    const parsed = JSON.parse(text);
    if (parsed && parsed.reply && parsed.draftEstimate) {
      return res.status(200).json(parsed);
    } else {
      throw new Error('Format balasan AI tidak sesuai.');
    }
  } catch (err) {
    const fallback = generateDeterministicAssistantFallback(message);
    return res.status(200).json(fallback);
  }
}
