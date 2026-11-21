import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Cpu,
  Layers,
  RefreshCw,
  Send,
  Sparkles,
  Terminal,
  User,
  X,
} from 'lucide-react';
import {
  ArchitecturalTierCode,
  AssistantChatMessage,
  DraftEstimatePayload,
  RegulationConfigPayload,
} from '../types/aura';
import {
  buildPricedItemsFromDraft,
  generateDeterministicArchitecturalEstimate,
  normalizeDraftEstimate,
} from '../utils/architecturalEstimator';
import { formatIDR, formatNumberID } from '../utils/formatters';

interface AuraTacticalAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  regulationConfig: RegulationConfigPayload;
  onApplyDraftEstimate: (draft: DraftEstimatePayload) => void;
}

const QUICK_PROMPTS = [
  {
    tier: 'TIER 1',
    text: 'Buatkan estimasi aplikasi kalkulator sederhana & pencatatan harian',
  },
  {
    tier: 'TIER 2',
    text: 'Hitung RAB portal e-office & administrasi personel Lanud',
  },
  {
    tier: 'TIER 3',
    text: 'Buatkan estimasi aplikasi pelacakan pesawat real-time seperti Flightradar24',
  },
  {
    tier: 'TIER 4',
    text: 'Estimasi sistem komando pertahanan siber & telemetri radar 12 bulan',
  },
];

function getTierBadgeClasses(tier?: ArchitecturalTierCode): string {
  switch (tier) {
    case 'TIER 1':
      return 'bg-emerald-950/80 border-emerald-400/50 text-emerald-300';
    case 'TIER 2':
      return 'bg-sky-950/80 border-sky-400/50 text-sky-300';
    case 'TIER 3':
      return 'bg-amber-950/80 border-amber-400/55 text-amber-300';
    case 'TIER 4':
      return 'bg-rose-950/80 border-rose-400/55 text-rose-300';
    default:
      return 'bg-cyan-950/80 border-cyan-400/50 text-cyan-300';
  }
}

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
      source: 'LOCAL_DETERMINISTIC',
      reply:
        'AURA Tactical AI Estimator siap melayani. Sistem secara otomatis membedakan 4 Tier Kompleksitas Arsitektur (Tier 1 Utilitas Ringan hingga Tier 4 Strategis/C4ISR) berbasis tabel tarif resmi aktif.\n\nMasukkan kebutuhan aplikasi Anda atau pilih salah satu contoh perintah cepat di bawah ini.',
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

      if (response.ok && data && data.reply && data.draftEstimate) {
        const normalizedDraft = normalizeDraftEstimate(
          data.draftEstimate,
          promptText,
          regulationConfig
        );

        const assistantMsg: AssistantChatMessage = {
          id: `msg-asst-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          reply: data.reply,
          source: data.source || 'AI_SERVER',
          modelUsed: data.modelUsed || 'gemini-2.5-flash',
          draftEstimate: normalizedDraft,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data?.error || 'Format respons AI tidak valid.');
      }
    } catch {
      clearTimeout(timeoutId);
      // Smart 4-tier local deterministic architectural fallback (never uses a single fixed template)
      const fallback = generateDeterministicArchitecturalEstimate(
        promptText,
        regulationConfig,
        'LOCAL_FALLBACK'
      );

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-fallback-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toISOString(),
          reply: fallback.reply,
          source: 'LOCAL_DETERMINISTIC',
          modelUsed: 'Architectural-4Tier-Local-v3.0',
          draftEstimate: fallback.draftEstimate,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-slate-950/85 backdrop-blur-sm">
      <div className="hud-command-crest w-full max-w-4xl h-[92vh] sm:h-[85vh] flex flex-col bg-[#040812] border border-cyan-400/45 shadow-[0_0_32px_rgba(0,240,255,0.22)] overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 bg-[#061022] border-b border-cyan-500/30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-cyan-950 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shrink-0">
              <Bot className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-xs text-cyan-300 font-semibold tracking-wider">
                <span className="truncate">AURA AI ESTIMATOR (TACTICAL CHAT)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                4-Tier Architectural Intelligence · Model: gemini-2.5-flash · Regulasi:{' '}
                {regulationConfig.version}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup AURA AI Estimator"
            className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-700 hover:border-cyan-400 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 font-sans bg-[#030712]">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const priced = msg.draftEstimate
              ? buildPricedItemsFromDraft(msg.draftEstimate, regulationConfig)
              : null;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 sm:gap-3 max-w-3xl ${
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
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

                <div className={`space-y-3 min-w-0 flex-1 ${isUser ? 'text-right' : 'text-left'}`}>
                  <div
                    className={`p-3.5 sm:p-4 rounded border text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? 'bg-amber-950/30 border-amber-400/40 text-amber-100 font-mono inline-block text-left'
                        : 'bg-[#061022] border-cyan-500/35 text-slate-200'
                    }`}
                  >
                    {!isUser && msg.modelUsed && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400/80 mb-2 pb-1.5 border-b border-slate-800/80">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>
                          {msg.source === 'AI_SERVER'
                            ? `AI SERVER (${msg.modelUsed})`
                            : `FALLBACK DETERMINISTIK 4-TIER (${msg.modelUsed})`}
                        </span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{msg.reply}</div>
                  </div>

                  {/* Draft Estimate Preview Card (100% Deterministically Priced from Active Regulation) */}
                  {msg.draftEstimate && priced && (
                    <div className="bg-[#050e1f] border border-cyan-400/50 p-3.5 sm:p-4 space-y-3 shadow-lg">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-cyan-500/20 pb-2.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-mono text-cyan-400">
                              PRATINJAU ESTIMASI DETERMINISTIK ({regulationConfig.version})
                            </span>
                            {typeof msg.draftEstimate.complexityScore === 'number' && (
                              <span className="text-[10px] font-mono text-slate-300 bg-slate-900 border border-slate-700 px-1.5 py-0.5">
                                SKOR {msg.draftEstimate.complexityScore}/100
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-display font-bold text-white mt-1">
                            {msg.draftEstimate.projectName}
                          </h4>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                            {msg.draftEstimate.procurementScheme}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 border text-[11px] font-mono font-bold shrink-0 ${getTierBadgeClasses(
                            msg.draftEstimate.tierClassification
                          )}`}
                        >
                          {msg.draftEstimate.tierLabel ||
                            msg.draftEstimate.complexityLevel.split('(')[0].trim()}
                        </span>
                      </div>

                      {/* KPI Summary Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                        <div className="bg-[#030814] p-2.5 border border-slate-800">
                          <span className="block text-[10px] text-slate-400">Durasi &amp; Tim</span>
                          <span className="text-cyan-300 font-bold">
                            {msg.draftEstimate.durationMonths} Bln ·{' '}
                            {priced.summary.totalPersonnelHeadcount} Org
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {formatNumberID(priced.summary.totalManMonths, 1)} OB
                          </span>
                        </div>
                        <div className="bg-[#030814] p-2.5 border border-slate-800">
                          <span className="block text-[10px] text-slate-400">Biaya Personel</span>
                          <span className="text-white font-bold">
                            {formatIDR(priced.summary.totalPersonnelCost)}
                          </span>
                        </div>
                        <div className="bg-[#030814] p-2.5 border border-slate-800">
                          <span className="block text-[10px] text-slate-400">Non-Personel</span>
                          <span className="text-cyan-300 font-bold">
                            {formatIDR(priced.summary.totalNonPersonnelCost)}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {priced.nonPersonnelItems.length} Komponen
                          </span>
                        </div>
                        <div className="bg-[#030814] p-2.5 border border-amber-400/40">
                          <span className="block text-[10px] text-amber-300/90">
                            Grand Total HPS/RAB
                          </span>
                          <span className="text-amber-300 font-bold">
                            {formatIDR(priced.summary.grandTotalEstimation)}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            OH {priced.financials.overheadAndProfitPercent}% · PPN{' '}
                            {priced.financials.ppnPercent}%
                          </span>
                        </div>
                      </div>

                      {/* Compact Role Composition Readout */}
                      <div className="bg-[#030814] border border-slate-800/90 p-2.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400">
                          <Layers className="w-3.5 h-3.5" />
                          <span>
                            KOMPOSISI PERAN ({priced.personnelItems.length} POSISI · TARIF RESMI{' '}
                            {regulationConfig.version})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-300">
                          {priced.personnelItems.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-0.5"
                            >
                              <span className="truncate">
                                {p.roleName}{' '}
                                <span className="text-slate-400">({p.tier})</span>
                              </span>
                              <span className="text-cyan-300 shrink-0">
                                {p.headcount} org × {p.durationMonths} bln
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          Seluruh tarif terkunci pada standar SBM/INKINDO {regulationConfig.version}
                        </span>
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

          {isSending && (
            <div className="flex items-center gap-2.5 text-xs font-mono text-cyan-300 pl-11">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>
                Menganalisis arsitektur (Tier 1–4) &amp; menghitung tarif regulasi via /api/assistant...
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts Bar (All 4 Architectural Tiers) */}
        <div className="px-3.5 sm:px-4 py-2.5 bg-[#050e1e] border-t border-cyan-500/20 flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="text-[10px] font-mono text-cyan-400 shrink-0 mr-1">
            Perintah Cepat (Tier 1–4):
          </span>
          {QUICK_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(item.text)}
              disabled={isSending}
              className="px-2.5 py-1 text-[11px] font-mono bg-[#08152b] hover:bg-cyan-950/80 border border-cyan-500/30 hover:border-cyan-400 text-cyan-200 transition-colors disabled:opacity-50 text-left"
            >
              <span className="text-amber-300 font-semibold mr-1.5">[{item.tier}]</span>
              <span>{item.text}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3.5 sm:p-4 bg-[#061022] border-t border-cyan-500/30 flex items-center gap-2.5 sm:gap-3 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isSending) {
                handleSendMessage();
              }
            }}
            placeholder="Contoh: Estimasi aplikasi kalkulator sederhana, atau sistem pelacakan pesawat real-time..."
            disabled={isSending}
            className="flex-1 bg-[#030712] border border-cyan-500/40 focus:border-cyan-400 text-white placeholder-slate-500 text-xs sm:text-sm px-3.5 py-2.5 sm:py-3 font-mono outline-none min-w-0"
          />
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={isSending || !inputText.trim()}
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 transition-colors shrink-0"
          >
            {isSending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Memproses...</span>
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
