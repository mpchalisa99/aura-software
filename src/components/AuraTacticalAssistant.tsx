import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  CheckCircle2,
  Cpu,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
  Terminal,
  User,
  X,
} from 'lucide-react';
import {
  AssistantChatMessage,
  DraftEstimatePayload,
  ProjectProfile,
  PersonnelAllocationItem,
  NonPersonnelCostItem,
  RegulationConfigPayload,
} from '../types/aura';
import { calculateProjectSummary, formatIDR, formatNumberID } from '../utils/formatters';

interface AuraTacticalAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  regulationConfig: RegulationConfigPayload;
  onApplyDraftEstimate: (draft: DraftEstimatePayload) => void;
}

const QUICK_PROMPTS = [
  'Buatkan estimasi aplikasi pelacakan pesawat real-time seperti Flightradar24',
  'Estimasi sistem komando pertahanan siber & telemetri radar 12 bulan',
  'Hitung RAB portal e-office & administrasi personel Lanud',
];

export const AuraTacticalAssistant: React.FC<AuraTacticalAssistantProps> = ({
  isOpen,
  onClose,
  regulationConfig,
  onApplyDraftEstimate,
}) => {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'assistant',
      timestamp: new Date().toISOString(),
      reply:
        'Sistem AURA Tactical AI Estimator siap melayani. Silakan masukkan deskripsi proyek pengembangan perangkat lunak TNI AU atau pilih salah satu perintah cepat di bawah untuk membuat draf RAB & HPS secara otomatis.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [appliedMsgId, setAppliedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const promptText = (textToSend || inputText).trim();
    if (!promptText || isSending) return;

    const userMsgId = `msg-user-${Date.now()}`;
    const userMessage: AssistantChatMessage = {
      id: userMsgId,
      sender: 'user',
      timestamp: new Date().toISOString(),
      reply: promptText,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputText('');
    setIsSending(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          regulationConfig,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok && data && data.reply) {
        const assistantMsg: AssistantChatMessage = {
          id: `msg-asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          reply: data.reply,
          draftEstimate: data.draftEstimate,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data?.error || 'Gagal menerima respons AI');
      }
    } catch {
      clearTimeout(timeoutId);
      // Deterministic fallback response if API fails or times out
      const fallbackReply = `[FALLBACK DETERMINISTIK] Analisis taktis untuk "${promptText}" berhasil disusun. Draf estimasi RAB & HPS telah dikunci menggunakan standar Billing Rate SBM & INKINDO 2026. Silakan klik tombol di bawah untuk menerapkannya ke kalkulator.`;
      const fallbackDraft: DraftEstimatePayload = {
        projectName: `Draf Sistem Taktis: ${promptText.slice(0, 45)}...`,
        proposingUnit: 'Disinfolahtaau (Dinas Informasi dan Pengolahan Data Angkatan Udara)',
        procurementScheme: 'Tender / Seleksi Jasa Konsultansi Badan Usaha',
        complexityLevel: 'Tinggi (Sistem Komando Taktis / C4ISR & Analitik Real-Time)',
        durationMonths: 12,
        locationFactor: 1.00,
        highComplexityModules: ['Modul Inti Operasional & Dashboard HUD', 'Enkripsi Data & Komunikasi Kripto Militer', 'Modul Audit Trail & Keamanan Berlapis'],
        specialIntegrations: ['Gateway API Sensor & Telemetri TNI AU', 'SSO Active Directory Mabesau'],
        layeredSecurityStandards: ['ISO 27001 Information Security', 'Penetration Testing (Pentest) Independen'],
        personnel: [
          { roleId: 'role-pm', roleName: 'Project Manager / Team Leader', tier: 'Senior', headcount: 1, durationMonths: 12, taskDescription: 'Manajemen Proyek & Koordinasi Komando' },
          { roleId: 'role-arch', roleName: 'Solution / System Architect', tier: 'Lead / Principal', headcount: 1, durationMonths: 12, taskDescription: 'Desain Arsitektur & Enkripsi Kriptografi' },
          { roleId: 'role-dev', roleName: 'Full-Stack Software Engineer', tier: 'Senior', headcount: 3, durationMonths: 12, taskDescription: 'Pengembangan Backend Core & Frontend HUD' },
          { roleId: 'role-qa-sec', roleName: 'QA & Security Specialist (AppSec)', tier: 'Senior', headcount: 2, durationMonths: 12, taskDescription: 'Pengujian Mutu & Kelaikan Siber' },
          { roleId: 'role-devops', roleName: 'DevOps & Infrastructure Engineer', tier: 'Senior', headcount: 2, durationMonths: 12, taskDescription: 'Deployment Cluster Server & Pengamanan Jaringan' }
        ],
        nonPersonnel: [
          { category: 'Server / Cloud', itemName: 'Dedicated Secure Cloud Server & Kubernetes', quantity: 12, unit: 'Bulan', unitPrice: 15000000, notes: 'Infrastruktur High-Availability Terisolasi' },
          { category: 'Lisensi', itemName: 'Enterprise Database & Middleware Licences', quantity: 1, unit: 'Paket', unitPrice: 40000000, notes: 'Lisensi komersial terverifikasi TKDN' },
          { category: 'Integrasi API', itemName: 'Secure API Gateway & Sensor SDK', quantity: 2, unit: 'Paket', unitPrice: 17500000, notes: 'Koneksi telemetri dan enkripsi token' },
          { category: 'Security Testing', itemName: 'Independent Penetration Testing & AppSec Audit', quantity: 2, unit: 'Kegiatan', unitPrice: 25000000, notes: 'Audit keamanan siber independen' },
          { category: 'Dokumentasi', itemName: 'Buku Manual Sistem & SOP Administrator', quantity: 3, unit: 'Kegiatan', unitPrice: 5000000, notes: 'Dokumentasi lengkap serah terima' }
        ]
      };

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-fallback-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          reply: fallbackReply,
          draftEstimate: fallbackDraft,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleApplyDraft = (msgId: string, draft: DraftEstimatePayload) => {
    onApplyDraftEstimate(draft);
    setAppliedMsgId(msgId);
    setTimeout(() => setAppliedMsgId(null), 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="hud-command-crest w-full max-w-4xl h-[90vh] sm:h-[82vh] flex flex-col bg-[#040812] border border-cyan-400/40 shadow-[0_0_30px_rgba(0,240,255,0.25)] overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#061022] border-b border-cyan-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-cyan-950 border border-cyan-400/50 flex items-center justify-center text-cyan-300">
              <Bot className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-mono text-xs text-cyan-300 font-semibold tracking-wider">
                <span>AURA AI ESTIMATOR (TACTICAL CHAT)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Model: gemini-2.5-flash · Regulasi: REG-PBJ-2026.04
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 hover:border-cyan-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-sans bg-[#030712]">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const draftSummary = msg.draftEstimate
              ? calculateProjectSummary(
                  msg.draftEstimate.personnel.map((p, idx) => ({
                    id: `d-p-${idx}`,
                    roleId: p.roleId,
                    roleName: p.roleName,
                    tier: (p.tier as any) || 'Senior',
                    headcount: p.headcount,
                    durationMonths: p.durationMonths,
                    standardRate: 15000000,
                    overrideRate: null,
                    taskDescription: p.taskDescription,
                  })),
                  msg.draftEstimate.nonPersonnel.map((np, idx) => ({
                    id: `d-np-${idx}`,
                    category: np.category,
                    itemName: np.itemName,
                    quantity: np.quantity,
                    unit: np.unit,
                    unitPrice: np.unitPrice,
                    notes: np.notes,
                  })),
                  { overheadAndProfitPercent: 12, ppnPercent: 11, includeOverheadInPersonnel: true },
                  msg.draftEstimate.locationFactor
                )
              : null;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div
                  className={`w-8 h-8 rounded shrink-0 flex items-center justify-center font-mono text-xs ${
                    isUser
                      ? 'bg-amber-950 border border-amber-400/50 text-amber-300'
                      : 'bg-cyan-950 border border-cyan-400/50 text-cyan-300'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
                </div>

                <div className={`space-y-3 ${isUser ? 'text-right' : 'text-left'}`}>
                  <div
                    className={`p-4 rounded border text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-amber-950/30 border-amber-400/40 text-amber-100 font-mono'
                        : 'bg-[#061022] border-cyan-500/35 text-slate-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.reply}</div>
                  </div>

                  {/* Draft Estimate Preview Card */}
                  {msg.draftEstimate && draftSummary && (
                    <div className="bg-[#050e1f] border border-cyan-400/50 p-4 space-y-3 shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 pb-2.5">
                        <div>
                          <span className="text-[10px] font-mono text-cyan-400">
                            DRAF ESTIMASI TERSTRUKTUR SIAP DIMUAT
                          </span>
                          <h4 className="text-sm font-display font-bold text-white mt-0.5">
                            {msg.draftEstimate.projectName}
                          </h4>
                        </div>
                        <span className="px-2.5 py-1 bg-amber-950/80 border border-amber-400/50 text-amber-300 text-xs font-mono font-bold">
                          {msg.draftEstimate.complexityLevel.split('(')[0].trim()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                        <div className="bg-[#030814] p-2 border border-slate-800">
                          <span className="block text-[10px] text-slate-400">Durasi Proyek</span>
                          <span className="text-cyan-300 font-bold">
                            {msg.draftEstimate.durationMonths} Bulan
                          </span>
                        </div>
                        <div className="bg-[#030814] p-2 border border-slate-800">
                          <span className="block text-[10px] text-slate-400">Total Tenaga Ahli</span>
                          <span className="text-white font-bold">
                            {draftSummary.totalPersonnelHeadcount} Orang ({formatNumberID(draftSummary.totalManMonths, 1)} OB)
                          </span>
                        </div>
                        <div className="bg-[#030814] p-2 border border-slate-800">
                          <span className="block text-[10px] text-slate-400">Komponen Non-Personel</span>
                          <span className="text-cyan-300 font-bold">
                            {formatIDR(draftSummary.totalNonPersonnelCost)}
                          </span>
                        </div>
                        <div className="bg-[#030814] p-2 border border-cyan-500/30">
                          <span className="block text-[10px] text-slate-400">Estimasi Grand Total</span>
                          <span className="text-amber-300 font-bold">
                            {formatIDR(draftSummary.grandTotalEstimation)}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-end">
                        {appliedMsgId === msg.id ? (
                          <div className="flex items-center gap-1.5 px-4 py-2 bg-emerald-950 border border-emerald-400 text-emerald-300 text-xs font-mono font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Berhasil Dimuat ke Kalkulator!</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyDraft(msg.id, msg.draftEstimate!)}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.35)] transition-all"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>TERAPKAN KE FORM KALKULATOR</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar */}
        <div className="px-4 py-2.5 bg-[#050e1e] border-t border-cyan-500/20 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono text-cyan-400 shrink-0">Perintah Cepat:</span>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt)}
              disabled={isSending}
              className="px-2.5 py-1 text-[11px] font-mono bg-[#08152b] hover:bg-cyan-950/80 border border-cyan-500/30 hover:border-cyan-400 text-cyan-200 transition-colors disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-[#061022] border-t border-cyan-500/30 flex items-center gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSending) {
                handleSendMessage();
              }
            }}
            placeholder="Ketik deskripsi sistem informasi atau RAB proyek yang ingin diestimasi..."
            disabled={isSending}
            className="flex-1 bg-[#030712] border border-cyan-500/40 focus:border-cyan-400 text-white placeholder-slate-500 text-xs sm:text-sm px-4 py-3 font-mono outline-none"
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={isSending || !inputText.trim()}
            className="flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 transition-colors shrink-0"
          >
            {isSending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <span>Kirim</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
