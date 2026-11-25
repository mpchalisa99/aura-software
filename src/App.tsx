/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BookOpen,
  Bot,
  Calculator,
  Check,
  Compass,
  Copy,
  Cpu,
  FileSpreadsheet,
  History,
  Layers,
  Maximize2,
  Minimize2,
  QrCode,
  RefreshCw,
  Share2,
  Shield,
  Sliders,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import { CalculatorTab } from './components/CalculatorTab';
import { HistoryTab } from './components/HistoryTab';
import { RadarSyncModal } from './components/RadarSyncModal';
import { RegulationTab } from './components/RegulationTab';
import { AuraTacticalAssistant } from './components/AuraTacticalAssistant';
import {
  DEFAULT_SHARED_APP_URL,
  ShareBarcodeModal,
} from './components/ShareBarcodeModal';
import { WorksheetTab } from './components/WorksheetTab';
import {
  DEFAULT_REGULATION_CONFIG,
  DEFAULT_REMOTE_ENDPOINT,
  INITIAL_FINANCIAL_PARAMETERS,
  INITIAL_NON_PERSONNEL_ITEMS,
  INITIAL_PERSONNEL_ITEMS,
  INITIAL_PROJECT_PROFILE,
  PROJECT_PRESET_TEMPLATES,
} from './data/defaultRegulations';
import {
  AuditAdjustmentAction,
  AuditReportResult,
  ComplexityLevel,
  DraftEstimatePayload,
  FinancialParameters,
  NonPersonnelCostItem,
  PersonnelAllocationItem,
  ProcurementScheme,
  ProjectProfile,
  RegulationConfigPayload,
  SavedSimulation,
  SyncStatus,
} from './types/aura';
import {
  buildPricedItemsFromDraft,
  normalizeDraftEstimate,
} from './utils/architecturalEstimator';
import {
  applyAuditAdjustmentsToState,
  runDeterministicAudit,
} from './utils/auditEngine';
import {
  calculateProjectSummary,
  formatIDR,
  formatNumberID,
  formatTimestampID,
  validateRegulationPayload,
} from './utils/formatters';

type ActiveTab = 'calculator' | 'worksheet' | 'regulations' | 'history';

export const LOGO_TNI_AU_URL = '/assets/aistudio/1792503945296_954409ac.jpg';
export const LOGO_PETIR_URL = '/assets/aistudio/1794962413180_09546ffa.png';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // Scheduled auto-sync every 5 minutes

const STORAGE_KEYS = {
  REGULATION_CONFIG: 'aura_regulation_config_v1',
  REMOTE_ENDPOINT: 'aura_remote_endpoint_v1',
  SYNC_STATUS: 'aura_sync_status_v1',
  SAVED_SIMULATIONS: 'aura_saved_simulations_v1',
  ACTIVE_DRAFT: 'aura_active_draft_v1',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('calculator');
  const [leftLogoError, setLeftLogoError] = useState(false);
  const [rightLogoError, setRightLogoError] = useState(false);

  // Fullscreen & Share Barcode Modal State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [inlineQrUrl, setInlineQrUrl] = useState<string>('');
  const [copiedQuickLink, setCopiedQuickLink] = useState(false);

  const publicShareUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location.origin) {
      if (window.location.origin.includes('ais-dev-')) {
        return DEFAULT_SHARED_APP_URL;
      }
      return window.location.origin;
    }
    return DEFAULT_SHARED_APP_URL;
  }, []);

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(publicShareUrl, {
      width: 160,
      margin: 1,
      color: {
        dark: '#040812',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (mounted) setInlineQrUrl(url);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [publicShareUrl]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setSyncNotice(
        'Mode layar penuh mengikuti pengaturan browser perangkat Anda (gunakan "Add to Home Screen" di iPhone/Android).'
      );
      setTimeout(() => setSyncNotice(null), 3500);
    }
  };

  const handleQuickCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(publicShareUrl);
      setCopiedQuickLink(true);
      setTimeout(() => setCopiedQuickLink(false), 2400);
    } catch {
      setIsShareModalOpen(true);
    }
  };

  // Regulation & Auto-Sync State
  const [regulationConfig, setRegulationConfig] = useState<RegulationConfigPayload>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.REGULATION_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        const check = validateRegulationPayload(parsed);
        if (check.valid && check.payload) {
          return check.payload;
        }
      }
    } catch {
      // Fallback to built-in seed
    }
    return DEFAULT_REGULATION_CONFIG;
  });

  const [endpointUrl, setEndpointUrl] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REMOTE_ENDPOINT);
    if (!saved || saved.includes('aura-config.tni-au.mil.id')) {
      return DEFAULT_REMOTE_ENDPOINT;
    }
    return saved;
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SYNC_STATUS) as SyncStatus | null;
    return saved || 'SYNCED';
  });

  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [isRadarModalOpen, setIsRadarModalOpen] = useState(false);
  const [autoTriggerRadar, setAutoTriggerRadar] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const handleApplyDraftEstimate = (draft: DraftEstimatePayload) => {
    const normalized = normalizeDraftEstimate(
      draft,
      draft.projectName || '',
      regulationConfig
    );
    const priced = buildPricedItemsFromDraft(normalized, regulationConfig);
    const stamp = Date.now();

    setProfile((prev) => ({
      ...prev,
      projectName: normalized.projectName,
      proposingUnit: normalized.proposingUnit,
      procurementScheme: normalized.procurementScheme as ProcurementScheme,
      complexity: normalized.complexityLevel as ComplexityLevel,
      durationMonths: normalized.durationMonths,
      locationFactor: normalized.locationFactor,
      highComplexityModules: normalized.highComplexityModules,
      specialIntegrations: normalized.specialIntegrations,
      layeredSecurityStandards: normalized.layeredSecurityStandards,
    }));

    setPersonnelItems(
      priced.personnelItems.map((item, idx) => ({
        ...item,
        id: `draft-p-${stamp}-${idx}`,
      }))
    );

    setNonPersonnelItems(
      priced.nonPersonnelItems.map((item, idx) => ({
        ...item,
        id: `draft-np-${stamp}-${idx}`,
      }))
    );

    setFinancials(priced.financials);
    setActiveTab('calculator');

    setSyncNotice(
      `Draf estimasi ${normalized.tierClassification || ''} "${normalized.projectName}" (${formatIDR(priced.summary.grandTotalEstimation)}) berhasil dimuat ke Form Kalkulator.`
    );
    setTimeout(() => setSyncNotice(null), 5000);
    setIsAssistantOpen(false);
  };

  // Active Project Calculation State
  const [profile, setProfile] = useState<ProjectProfile>(INITIAL_PROJECT_PROFILE);
  const [personnelItems, setPersonnelItems] = useState<PersonnelAllocationItem[]>(
    INITIAL_PERSONNEL_ITEMS
  );
  const [nonPersonnelItems, setNonPersonnelItems] = useState<NonPersonnelCostItem[]>(
    INITIAL_NON_PERSONNEL_ITEMS
  );
  const [financials, setFinancials] = useState<FinancialParameters>(
    INITIAL_FINANCIAL_PARAMETERS
  );

  // AI Audit Override State (reset whenever project inputs change so numbers are never stale)
  const [aiAuditOverride, setAiAuditOverride] = useState<AuditReportResult | null>(null);

  // Clear AI narrative override whenever underlying calculation inputs change
  useEffect(() => {
    setAiAuditOverride(null);
  }, [profile, personnelItems, nonPersonnelItems, financials, regulationConfig]);

  // Live Deterministic Audit Baseline
  const activeAuditReport = useMemo<AuditReportResult>(() => {
    if (aiAuditOverride) {
      return aiAuditOverride;
    }
    return runDeterministicAudit(
      profile,
      personnelItems,
      nonPersonnelItems,
      financials,
      regulationConfig
    );
  }, [aiAuditOverride, profile, personnelItems, nonPersonnelItems, financials, regulationConfig]);

  // Saved Simulations History
  const [savedSimulations, setSavedSimulations] = useState<SavedSimulation[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SAVED_SIMULATIONS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fall through to seed simulations
    }

    return PROJECT_PRESET_TEMPLATES.map((preset, index) => {
      const summary = calculateProjectSummary(
        preset.personnelItems,
        preset.nonPersonnelItems,
        preset.financials,
        preset.profile.locationFactor
      );
      return {
        id: `sim-seed-${index + 1}`,
        savedAt: new Date(Date.now() - index * 86400000).toISOString(),
        regulationVersion: DEFAULT_REGULATION_CONFIG.version,
        profile: preset.profile,
        personnelItems: preset.personnelItems,
        nonPersonnelItems: preset.nonPersonnelItems,
        financials: preset.financials,
        summary,
      };
    });
  });

  // Load active draft if present
  useEffect(() => {
    try {
      const rawDraft = localStorage.getItem(STORAGE_KEYS.ACTIVE_DRAFT);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft);
        if (
          parsed.profile &&
          Array.isArray(parsed.personnelItems) &&
          Array.isArray(parsed.nonPersonnelItems)
        ) {
          setProfile({
            ...INITIAL_PROJECT_PROFILE,
            ...parsed.profile,
          });
          setPersonnelItems(parsed.personnelItems);
          setNonPersonnelItems(parsed.nonPersonnelItems);
          if (parsed.financials) setFinancials(parsed.financials);
        }
      }
    } catch {
      // Ignore malformed draft
    }
  }, []);

  // Auto-save active draft
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.ACTIVE_DRAFT,
        JSON.stringify({ profile, personnelItems, nonPersonnelItems, financials })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [profile, personnelItems, nonPersonnelItems, financials]);

  // Background Auto-Sync Function (runs on mount, on periodic schedule, and on network recovery)
  const executeBackgroundRegulationSync = useCallback(
    async (silent = true) => {
      if (syncStatus === 'CUSTOM OVERRIDE' && silent) {
        return;
      }

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        setSyncStatus('OFFLINE CACHE');
        localStorage.setItem(STORAGE_KEYS.SYNC_STATUS, 'OFFLINE CACHE');
        return;
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const response = await fetch(endpointUrl, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          const check = validateRegulationPayload(data);
          if (check.valid && check.payload) {
            const freshPayload: RegulationConfigPayload = {
              ...check.payload,
              lastUpdated: new Date().toISOString(),
            };
            setRegulationConfig(freshPayload);
            setSyncStatus('SYNCED');
            localStorage.setItem(
              STORAGE_KEYS.REGULATION_CONFIG,
              JSON.stringify(freshPayload)
            );
            localStorage.setItem(STORAGE_KEYS.SYNC_STATUS, 'SYNCED');
            return;
          }
        }
      } catch {
        // Fallback to localStorage / built-in seed data
      }

      // Verify current local cache is valid
      setRegulationConfig((prev) => {
        const check = validateRegulationPayload(prev);
        if (check.valid && check.payload) {
          localStorage.setItem(
            STORAGE_KEYS.REGULATION_CONFIG,
            JSON.stringify(check.payload)
          );
          return check.payload;
        }
        return DEFAULT_REGULATION_CONFIG;
      });
    },
    [endpointUrl, syncStatus]
  );

  // On-Load + Scheduled Periodic Auto-Sync + Online/Offline Event Listeners
  useEffect(() => {
    executeBackgroundRegulationSync(true);

    const intervalId = window.setInterval(() => {
      executeBackgroundRegulationSync(true);
    }, AUTO_SYNC_INTERVAL_MS);

    const handleOnline = () => {
      executeBackgroundRegulationSync(true);
    };
    const handleOffline = () => {
      setSyncStatus('OFFLINE CACHE');
      localStorage.setItem(STORAGE_KEYS.SYNC_STATUS, 'OFFLINE CACHE');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [executeBackgroundRegulationSync]);

  // Live HPS / RAB Calculation Summary
  const summary = useMemo(() => {
    return calculateProjectSummary(
      personnelItems,
      nonPersonnelItems,
      financials,
      profile.locationFactor
    );
  }, [personnelItems, nonPersonnelItems, financials, profile.locationFactor]);

  // Budget share percentages for tactical telemetry bar
  const costShares = useMemo(() => {
    const total = summary.grandTotalEstimation || 1;
    const personnelShare = Math.min(100, Math.max(0, (summary.totalPersonnelCost / total) * 100));
    const nonPersonnelShare = Math.min(
      100,
      Math.max(0, (summary.totalNonPersonnelCost / total) * 100)
    );
    const overheadShare = Math.min(
      100,
      Math.max(0, (summary.overheadAndProfitValue / total) * 100)
    );
    const ppnShare = Math.min(100, Math.max(0, (summary.ppnValue / total) * 100));
    return {
      personnelShare,
      nonPersonnelShare,
      overheadShare,
      ppnShare,
    };
  }, [summary]);

  const handleApplySyncedConfig = (
    newConfig: RegulationConfigPayload,
    status: SyncStatus,
    message: string
  ) => {
    setRegulationConfig(newConfig);
    setSyncStatus(status);
    localStorage.setItem(STORAGE_KEYS.REGULATION_CONFIG, JSON.stringify(newConfig));
    localStorage.setItem(STORAGE_KEYS.SYNC_STATUS, status);

    setPersonnelItems((prev) =>
      prev.map((item) => {
        const foundRole = newConfig.roleTariffs.find((r) => r.id === item.roleId);
        if (!foundRole) return item;
        return {
          ...item,
          roleName: foundRole.roleName,
          standardRate: foundRole.rates[item.tier] ?? item.standardRate,
        };
      })
    );

    setSyncNotice(message);
    setTimeout(() => setSyncNotice(null), 4000);
  };

  const handleApplyAuditAdjustments = (adjustments: AuditAdjustmentAction[]) => {
    const nextState = applyAuditAdjustmentsToState(
      profile,
      personnelItems,
      nonPersonnelItems,
      financials,
      adjustments
    );
    setPersonnelItems(nextState.personnelItems);
    setNonPersonnelItems(nextState.nonPersonnelItems);
    setFinancials(nextState.financials);
    setAiAuditOverride(null);
    setSyncNotice(
      `Berhasil menerapkan ${adjustments.length} saran koreksi terukur ke Kertas Kerja HPS/RAB.`
    );
    setTimeout(() => setSyncNotice(null), 4000);
  };

  const handleSaveEndpointUrl = (url: string) => {
    setEndpointUrl(url);
    localStorage.setItem(STORAGE_KEYS.REMOTE_ENDPOINT, url);
  };

  const handleSaveCurrentSimulation = () => {
    const newSim: SavedSimulation = {
      id: `sim-${Date.now()}`,
      savedAt: new Date().toISOString(),
      regulationVersion: regulationConfig.version,
      profile: { ...profile },
      personnelItems: personnelItems.map((i) => ({ ...i })),
      nonPersonnelItems: nonPersonnelItems.map((i) => ({ ...i })),
      financials: { ...financials },
      summary: { ...summary },
    };

    const updated = [newSim, ...savedSimulations];
    setSavedSimulations(updated);
    localStorage.setItem(STORAGE_KEYS.SAVED_SIMULATIONS, JSON.stringify(updated));
    setSyncNotice(`Simulasi "${profile.projectName}" disimpan ke Riwayat Lokal.`);
    setTimeout(() => setSyncNotice(null), 3200);
  };

  const handleLoadSimulation = (sim: SavedSimulation) => {
    setProfile({
      ...INITIAL_PROJECT_PROFILE,
      ...sim.profile,
    });
    setPersonnelItems(sim.personnelItems.map((i) => ({ ...i })));
    setNonPersonnelItems(sim.nonPersonnelItems.map((i) => ({ ...i })));
    setFinancials({ ...sim.financials });
    setActiveTab('calculator');
    setSyncNotice(`Simulasi "${sim.profile.projectName}" dimuat ke kalkulator.`);
    setTimeout(() => setSyncNotice(null), 3200);
  };

  const handleDeleteSimulation = (id: string) => {
    const updated = savedSimulations.filter((s) => s.id !== id);
    setSavedSimulations(updated);
    localStorage.setItem(STORAGE_KEYS.SAVED_SIMULATIONS, JSON.stringify(updated));
  };

  const handleDuplicateSimulation = (sim: SavedSimulation) => {
    const copy: SavedSimulation = {
      ...sim,
      id: `sim-${Date.now()}`,
      savedAt: new Date().toISOString(),
      profile: {
        ...sim.profile,
        projectName: `${sim.profile.projectName} (Salinan Skenario)`,
      },
    };
    const updated = [copy, ...savedSimulations];
    setSavedSimulations(updated);
    localStorage.setItem(STORAGE_KEYS.SAVED_SIMULATIONS, JSON.stringify(updated));
  };

  const handleApplyPreset = (presetId: string) => {
    const found = PROJECT_PRESET_TEMPLATES.find((p) => p.id === presetId);
    if (!found) return;
    setProfile({ ...found.profile });
    setPersonnelItems(
      found.personnelItems.map((item) => {
        const role = regulationConfig.roleTariffs.find((r) => r.id === item.roleId);
        return {
          ...item,
          standardRate: role ? role.rates[item.tier] : item.standardRate,
        };
      })
    );
    setNonPersonnelItems(found.nonPersonnelItems.map((i) => ({ ...i })));
    setFinancials({ ...found.financials });
    setSyncNotice(`Preset skenario "${found.label}" berhasil dimuat.`);
    setTimeout(() => setSyncNotice(null), 3000);
  };

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'calculator',
      label: 'Dashboard Kalkulator',
      icon: <Calculator className="w-4 h-4" />,
    },
    {
      id: 'worksheet',
      label: 'Kertas Kerja HPS/RAB',
      icon: <FileSpreadsheet className="w-4 h-4" />,
    },
    {
      id: 'regulations',
      label: 'Regulasi & Tarif',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'history',
      label: 'Riwayat Simulasi',
      icon: <History className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-dvh w-full flex flex-col bg-[#040812] text-slate-100 overflow-x-hidden">
      {/* TOP BAR CONTRACT: 3 zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-4 sm:gap-8 px-3 sm:px-6 lg:px-8 py-3 bg-[#060f20]/95 border-b border-amber-500/30 shadow-lg no-print">
        {/* Zone 1: Brand Wordmark + Small White Subtitle */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('calculator');
          }}
          className="flex items-center whitespace-nowrap shrink-0 group"
        >
          <span className="flex flex-col leading-tight">
            <span className="text-base sm:text-lg font-display font-bold tracking-wider text-amber-300 group-hover:text-cyan-300 transition-colors">
              AURA-SOFTWARE
            </span>
            <span className="text-[11px] font-sans font-normal text-white tracking-wide">
              alat ukur regulasi -software
            </span>
          </span>
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Navigasi Utama"
          className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-amber-400 text-amber-300 font-semibold'
                    : 'border-transparent text-slate-300 hover:text-white hover:border-cyan-400/50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAssistantOpen(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-semibold bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.35)] transition-all whitespace-nowrap shrink-0"
          >
            <Bot className="w-4 h-4" />
            <span>AURA AI ESTIMATOR (CHAT)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoTriggerRadar(true);
              setIsRadarModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 shadow-[0_0_15px_rgba(0,212,255,0.3)] transition-all whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>SYNC REGULASI RESMI SEKARANG</span>
          </button>
        </div>
      </header>

      {/* Mobile & Tablet Navigation Bar */}
      <div className="md:hidden flex items-center overflow-x-auto border-b border-cyan-500/20 bg-[#060f20] px-3 py-2 gap-2 no-print">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'bg-[#0b1b36] text-slate-300'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* MAIN FLUID FULLSCREEN TACTICAL HUD WORKSPACE */}
      <main className="flex-1 w-full max-w-[1920px] mx-auto px-2.5 sm:px-5 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* ELEGANT MILITARY COMMAND CREST BANNER WITH TOP-LEFT TNI AU LOGO & TOP-RIGHT PETIR LOGO */}
        <section className="hud-command-crest p-4 sm:p-6 lg:p-7 relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.16) 0%, transparent 65%)',
            }}
          />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6">
            {/* Top Row on Mobile/Tablet: Both Emblems on Top-Left and Top-Right Corners */}
            <div className="w-full flex lg:w-auto items-center justify-between">
              {/* POJOK KIRI ATAS: Official TNI AU Emblem Medallion */}
              <div className="flex items-center gap-3">
                <div className="relative group shrink-0">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-amber-500/40 to-cyan-400/40 blur-sm" />
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full border-2 border-amber-400 bg-black overflow-hidden flex items-center justify-center shadow-[0_0_24px_rgba(245,158,11,0.4)]">
                    {!leftLogoError ? (
                      <img
                        src={LOGO_TNI_AU_URL}
                        alt="Logo TNI Angkatan Udara - Swa Bhuwana Paksa"
                        referrerPolicy="no-referrer"
                        onError={() => setLeftLogoError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Shield className="w-10 h-10 text-amber-400" />
                    )}
                  </div>
                </div>

                <div className="lg:hidden">
                  <div className="text-[10px] sm:text-[11px] font-mono text-amber-400 tracking-widest">
                    TNI ANGKATAN UDARA
                  </div>
                  <div className="text-xs font-mono text-cyan-300">
                    SWA BHUWANA PAKSA
                  </div>
                </div>
              </div>

              {/* Mobile/Tablet Top-Right Petir Logo */}
              <div className="flex lg:hidden items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] sm:text-[11px] font-mono text-amber-400 tracking-widest">
                    KORPS ELEKTRONIKA
                  </div>
                  <div className="text-xs font-mono text-cyan-300">
                    DISINFOLAHTAAU
                  </div>
                </div>

                <div className="relative group shrink-0">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-tl from-amber-500/40 to-cyan-400/40 blur-sm" />
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-amber-400 bg-black overflow-hidden flex items-center justify-center shadow-[0_0_24px_rgba(245,158,11,0.4)]">
                    {!rightLogoError ? (
                      <img
                        src={LOGO_PETIR_URL}
                        alt="Logo Petir Korps Elektronika TNI AU"
                        referrerPolicy="no-referrer"
                        onError={() => setRightLogoError(true)}
                        className="w-full h-full object-cover scale-[1.14]"
                      />
                    ) : (
                      <Activity className="w-10 h-10 text-amber-400" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* CENTER: Command Authority Title, Telemetry & Quick Fullscreen/Barcode Actions */}
            <div className="flex-1 text-left lg:text-center space-y-2.5 w-full">
              <div className="hidden lg:flex flex-wrap items-center justify-center gap-2 text-xs font-mono tracking-widest text-amber-400">
                <span>MARKAS BESAR TNI ANGKATAN UDARA</span>
                <span aria-hidden="true">·</span>
                <span className="text-cyan-300">SWA BHUWANA PAKSA</span>
                <span aria-hidden="true">·</span>
                <span>KORPS ELEKTRONIKA</span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-4xl font-display font-bold text-white tracking-tight text-balance">
                AURA-SOFTWARE — Pusat Kendali Estimasi Anggaran &amp; Regulasi Perangkat Lunak
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 max-w-3xl lg:mx-auto">
                Kalkulator Taktis, Sistem Audit Kepatuhan AI &amp; Kertas Kerja HPS/RAB Pengadaan Sistem Informasi Berbasis Basis Data Regulasi Resmi Pemerintah
              </p>

              {/* Unboxed Tactical Telemetry Readout Strip */}
              <div className="pt-1 flex flex-wrap items-center lg:justify-center gap-x-3 gap-y-1.5 text-xs font-mono text-slate-300">
                <span
                  className={
                    syncStatus === 'SYNCED'
                      ? 'text-emerald-400 font-semibold'
                      : syncStatus === 'OFFLINE CACHE'
                      ? 'text-amber-300 font-semibold'
                      : 'text-cyan-300 font-semibold'
                  }
                >
                  TELEMETRI: {syncStatus} (AUTO-SYNC 5M)
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  /
                </span>
                <span className="text-amber-300">
                  VERSI: {regulationConfig.version}
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  /
                </span>
                <span className="text-cyan-200">
                  RUJUKAN: {regulationConfig.sourceAuthority}
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  /
                </span>
                <span>UPDATE: {formatTimestampID(regulationConfig.lastUpdated)}</span>
              </div>

              {/* Quick Utility Strip: Barcode, Share Link, Fullscreen Mode, Endpoint Config */}
              <div className="pt-2 flex flex-wrap items-center lg:justify-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors whitespace-nowrap shrink-0"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Tampilkan QR Barcode &amp; Link</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickCopyShareLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0c1c38] hover:bg-[#132b54] text-cyan-200 border border-cyan-400/35 transition-colors whitespace-nowrap shrink-0"
                >
                  {copiedQuickLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Link Aplikasi Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Salin Share Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#0c1c38] hover:bg-[#132b54] text-slate-200 border border-amber-400/35 transition-colors whitespace-nowrap shrink-0"
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-amber-300" />
                      <span>Keluar Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 text-amber-300" />
                      <span>Layar Penuh (Fullscreen)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAutoTriggerRadar(false);
                    setIsRadarModalOpen(true);
                  }}
                  className="px-3 py-1.5 text-xs font-mono text-cyan-300 hover:text-amber-300 bg-[#081326] border border-cyan-500/30 transition-colors whitespace-nowrap shrink-0"
                >
                  Pengaturan Endpoint JSON
                </button>
              </div>
            </div>

            {/* Desktop POJOK KANAN ATAS: Official Lightning (Petir) Emblem Medallion */}
            <div className="hidden lg:flex items-center shrink-0">
              <div className="relative group shrink-0">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tl from-amber-500/40 to-cyan-400/40 blur-sm" />
                <div className="relative w-24 h-24 rounded-full border-2 border-amber-400 bg-black overflow-hidden flex items-center justify-center shadow-[0_0_24px_rgba(245,158,11,0.4)]">
                  {!rightLogoError ? (
                    <img
                      src={LOGO_PETIR_URL}
                      alt="Logo Petir Korps Elektronika TNI AU"
                      referrerPolicy="no-referrer"
                      onError={() => setRightLogoError(true)}
                      className="w-full h-full object-cover scale-[1.14]"
                    />
                  ) : (
                    <Activity className="w-10 h-10 text-amber-400" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {syncNotice && (
          <div className="bg-cyan-950/80 border border-amber-400/50 px-4 py-2.5 text-xs font-mono text-cyan-100 flex items-center justify-between">
            <span>{syncNotice}</span>
            <button
              type="button"
              onClick={() => setSyncNotice(null)}
              className="text-amber-300 hover:text-white ml-4"
            >
              Tutup
            </button>
          </div>
        )}

        {/* FIGHTER COCKPIT KPI SUMMARY PANEL (4 PRECISION AVIONICS FRAMES) */}
        <section
          aria-label="Ringkasan Indikator Kinerja Utama Anggaran"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4"
        >
          {/* KPI 1: Grand Total Estimasi Akhir */}
          <div className="hud-panel p-4 sm:p-5 flex flex-col justify-between border-amber-400/35">
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-amber-300">
                <span>01 · TOTAL ESTIMASI AKHIR (HPS/RAB)</span>
                <Award className="w-4 h-4 text-amber-400 shrink-0" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-white mt-2 truncate">
                {formatIDR(summary.grandTotalEstimation)}
              </div>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="w-full h-1.5 bg-slate-900 overflow-hidden flex">
                <div
                  className="bg-cyan-400 h-full"
                  style={{ width: `${costShares.personnelShare}%` }}
                />
                <div
                  className="bg-sky-500 h-full"
                  style={{ width: `${costShares.nonPersonnelShare}%` }}
                />
                <div
                  className="bg-amber-400 h-full"
                  style={{ width: `${costShares.overheadShare + costShares.ppnShare}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span className="truncate">DPP: {formatIDR(summary.dppBeforeTax)}</span>
                <span className="text-amber-300 shrink-0">PPN {financials.ppnPercent}%</span>
              </div>
            </div>
          </div>

          {/* KPI 2: Biaya Langsung Personel (Man-Month) */}
          <div className="hud-panel p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300">
                <span>02 · BIAYA PERSONEL (MAN-MONTH)</span>
                <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-cyan-300 mt-2 truncate">
                {formatIDR(summary.totalPersonnelCost)}
              </div>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="w-full h-1.5 bg-slate-900 overflow-hidden">
                <div
                  className="bg-cyan-400 h-full"
                  style={{ width: `${costShares.personnelShare}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span>Volume: {formatNumberID(summary.totalManMonths, 1)} OB</span>
                <span>{costShares.personnelShare.toFixed(1)}% Total</span>
              </div>
            </div>
          </div>

          {/* KPI 3: Biaya Langsung Non-Personel */}
          <div className="hud-panel p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300">
                <span>03 · BIAYA NON-PERSONEL</span>
                <Layers className="w-4 h-4 text-sky-400 shrink-0" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-slate-100 mt-2 truncate">
                {formatIDR(summary.totalNonPersonnelCost)}
              </div>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="w-full h-1.5 bg-slate-900 overflow-hidden">
                <div
                  className="bg-sky-400 h-full"
                  style={{ width: `${costShares.nonPersonnelShare}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span>{summary.activeNonPersonnelCount} Komponen Teknis</span>
                <span>{costShares.nonPersonnelShare.toFixed(1)}% Total</span>
              </div>
            </div>
          </div>

          {/* KPI 4: Kekuatan Peran, Status Audit & Kompleksitas */}
          <div className="hud-panel p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-amber-300">
                <span>04 · TIM &amp; SKOR KOMPLEKSITAS</span>
                <Compass className="w-4 h-4 text-amber-400 shrink-0" />
              </div>
              <div className="text-xl sm:text-2xl font-mono font-bold text-white mt-2">
                {summary.totalPersonnelHeadcount} Ahli · Skor{' '}
                {activeAuditReport.technicalComplexityAssessment.complexityScore}
              </div>
            </div>
            <div className="mt-3.5 space-y-2">
              <div className="w-full h-1.5 bg-slate-900 overflow-hidden">
                <div
                  className="bg-amber-400 h-full"
                  style={{
                    width: `${activeAuditReport.technicalComplexityAssessment.complexityScore}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                <span className="truncate">{activeAuditReport.status}</span>
                <span className="shrink-0">{profile.durationMonths} Bln</span>
              </div>
            </div>
          </div>
        </section>

        {/* TACTICAL BARCODE, SHARE LINK & BUDGET TELEMETRY STRIP */}
        <section className="hud-panel p-4 sm:px-5 sm:py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
          {/* Left: Budget Distribution Readout */}
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-mono text-xs font-semibold text-amber-300 tracking-wider">
                  KOMPOSISI STRUKTUR ANGGARAN AKTIF:
                </span>
              </div>
              <div className="text-sm sm:text-base font-display font-extrabold text-white tracking-wide pl-6">
                {profile.projectName}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-cyan-400 inline-block" />
                <span className="text-slate-300">
                  Personel: <strong className="text-white">{costShares.personnelShare.toFixed(1)}%</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-sky-500 inline-block" />
                <span className="text-slate-300">
                  Non-Personel: <strong className="text-white">{costShares.nonPersonnelShare.toFixed(1)}%</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-400 inline-block" />
                <span className="text-slate-300">
                  Overhead ({financials.overheadAndProfitPercent}%):{' '}
                  <strong className="text-white">{costShares.overheadShare.toFixed(1)}%</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-400 inline-block" />
                <span className="text-slate-300">
                  PPN ({financials.ppnPercent}%):{' '}
                  <strong className="text-white">{costShares.ppnShare.toFixed(1)}%</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Inline QR Barcode & Direct Share Link Box */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-[#040914] border border-amber-400/30 p-2.5">
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2.5 text-left group shrink-0"
              title="Klik untuk memperbesar QR Barcode"
            >
              {inlineQrUrl ? (
                <img
                  src={inlineQrUrl}
                  alt="QR Barcode AURA-SOFTWARE"
                  className="w-12 h-12 border border-amber-400 bg-white p-0.5 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 border border-amber-400 bg-slate-900 flex items-center justify-center shrink-0">
                  <QrCode className="w-6 h-6 text-amber-400" />
                </div>
              )}
              <div>
                <span className="block text-[10px] font-mono text-amber-400 tracking-wider">
                  BARCODE &amp; SHARE LINK APLIKASI
                </span>
                <span className="block text-xs font-mono text-cyan-200 group-hover:text-white underline underline-offset-2 truncate max-w-[220px] sm:max-w-[260px]">
                  {publicShareUrl}
                </span>
              </div>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleQuickCopyShareLink}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap"
              >
                {copiedQuickLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-colors whitespace-nowrap"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Besar</span>
              </button>
            </div>
          </div>
        </section>

        {/* DASHBOARD REGULATED PRICE OPTIONS PANEL (FLOOR, STANDARD, CEILING) */}
        {activeTab === 'calculator' && (
          <section className="hud-panel p-4 sm:p-5 space-y-3 no-print border border-cyan-500/40 bg-[#040917]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/25 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-mono text-xs font-bold text-cyan-300 tracking-wider">
                  PILIHAN OPSI HARGA REGULASI HPS (BAWAH · STANDARD · ATAS)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                Acuan: Perpres 12/2021 &amp; SBM Kemenkeu 2026
              </span>
            </div>

            {(() => {
              const summaryFloor = calculateProjectSummary(
                personnelItems,
                nonPersonnelItems,
                { ...financials, overheadAndProfitPercent: 10 },
                profile.locationFactor
              );
              const summaryStandard = calculateProjectSummary(
                personnelItems,
                nonPersonnelItems,
                { ...financials, overheadAndProfitPercent: 12 },
                profile.locationFactor
              );
              const summaryCeiling = calculateProjectSummary(
                personnelItems,
                nonPersonnelItems,
                { ...financials, overheadAndProfitPercent: 15 },
                profile.locationFactor
              );

              const handleApplyMode = (mode: 'floor' | 'standard' | 'ceiling') => {
                const targetOh = mode === 'floor' ? 10 : mode === 'ceiling' ? 15 : 12;
                setFinancials((prev) => ({
                  ...prev,
                  overheadAndProfitPercent: targetOh,
                }));
                const targetTotal =
                  mode === 'floor'
                    ? summaryFloor.grandTotalEstimation
                    : mode === 'ceiling'
                    ? summaryCeiling.grandTotalEstimation
                    : summaryStandard.grandTotalEstimation;
                const modeLabel =
                  mode === 'floor'
                    ? 'Batas Bawah (Floor · OH 10%)'
                    : mode === 'ceiling'
                    ? 'Batas Atas (Ceiling HPS · OH 15%)'
                    : 'Harga Standar (Rekomendasi · OH 12%)';

                setSyncNotice(`Kertas Kerja Kalkulator berhasil disesuaikan ke Opsi ${modeLabel}: ${formatIDR(targetTotal)}`);
                setTimeout(() => setSyncNotice(null), 4500);
              };

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                  <button
                    type="button"
                    onClick={() => handleApplyMode('floor')}
                    className={`p-3 text-left border transition-all group ${
                      financials.overheadAndProfitPercent === 10
                        ? 'bg-emerald-950/80 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                        : 'bg-[#030814] hover:bg-emerald-950/40 border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase">1. Batas Bawah (Floor)</span>
                      {financials.overheadAndProfitPercent === 10 && (
                        <span className="text-[9px] bg-emerald-400 text-slate-950 px-1.5 py-0.2 font-bold">AKTIF</span>
                      )}
                    </div>
                    <div className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-200 mt-1">
                      {formatIDR(summaryFloor.grandTotalEstimation)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Overhead Wajar 10% (Efisiensi HPS)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyMode('standard')}
                    className={`p-3 text-left border transition-all group ${
                      financials.overheadAndProfitPercent === 12
                        ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.25)]'
                        : 'bg-[#030814] hover:bg-cyan-950/40 border-cyan-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-cyan-300 font-bold uppercase">2. Harga Standar (Utama)</span>
                      {financials.overheadAndProfitPercent === 12 && (
                        <span className="text-[9px] bg-cyan-400 text-slate-950 px-1.5 py-0.2 font-bold">AKTIF</span>
                      )}
                    </div>
                    <div className="text-sm sm:text-base font-bold text-amber-300 group-hover:text-amber-200 mt-1">
                      {formatIDR(summaryStandard.grandTotalEstimation)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Overhead Rekomendasi 12%
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyMode('ceiling')}
                    className={`p-3 text-left border transition-all group ${
                      financials.overheadAndProfitPercent === 15
                        ? 'bg-amber-950/80 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                        : 'bg-[#030814] hover:bg-amber-950/40 border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-amber-400 font-bold uppercase">3. Batas Atas (Ceiling HPS)</span>
                      {financials.overheadAndProfitPercent === 15 && (
                        <span className="text-[9px] bg-amber-400 text-slate-950 px-1.5 py-0.2 font-bold">AKTIF</span>
                      )}
                    </div>
                    <div className="text-sm sm:text-base font-bold text-white group-hover:text-amber-200 mt-1">
                      {formatIDR(summaryCeiling.grandTotalEstimation)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Overhead Maksimal Regulasi 15%
                    </div>
                  </button>
                </div>
              );
            })()}
          </section>
        )}

        {/* ACTIVE TAB VIEWPORT */}
        {activeTab === 'calculator' && (
          <CalculatorTab
            profile={profile}
            onChangeProfile={setProfile}
            personnelItems={personnelItems}
            onChangePersonnel={setPersonnelItems}
            nonPersonnelItems={nonPersonnelItems}
            onChangeNonPersonnel={setNonPersonnelItems}
            financials={financials}
            onChangeFinancials={setFinancials}
            regulationConfig={regulationConfig}
            summary={summary}
            auditReport={activeAuditReport}
            onUpdateAuditReport={setAiAuditOverride}
            onApplyAuditAdjustments={handleApplyAuditAdjustments}
            onSaveSimulation={handleSaveCurrentSimulation}
            onGoToWorksheet={() => setActiveTab('worksheet')}
            onApplyPreset={handleApplyPreset}
          />
        )}

        {activeTab === 'worksheet' && (
          <WorksheetTab
            profile={profile}
            personnelItems={personnelItems}
            nonPersonnelItems={nonPersonnelItems}
            financials={financials}
            summary={summary}
            regulationConfig={regulationConfig}
            regulationVersion={regulationConfig.version}
            lastUpdated={regulationConfig.lastUpdated}
            auditReport={activeAuditReport}
            onUpdateAuditReport={setAiAuditOverride}
            onApplyAuditAdjustments={handleApplyAuditAdjustments}
            onSaveSimulation={handleSaveCurrentSimulation}
            onImportProjectData={(imported) => {
              setProfile({
                ...INITIAL_PROJECT_PROFILE,
                ...imported.profile,
              });
              setPersonnelItems(imported.personnelItems);
              setNonPersonnelItems(imported.nonPersonnelItems);
              setFinancials(imported.financials);
              setSyncNotice(`Kertas kerja "${imported.profile.projectName}" berhasil dimuat.`);
              setTimeout(() => setSyncNotice(null), 3500);
            }}
          />
        )}

        {activeTab === 'regulations' && (
          <RegulationTab
            regulationConfig={regulationConfig}
            syncStatus={syncStatus}
            endpointUrl={endpointUrl}
            onUpdateRegulationConfig={(nextCfg, status = 'CUSTOM OVERRIDE') =>
              handleApplySyncedConfig(
                nextCfg,
                status,
                `Tabel regulasi & tarif diperbarui (${nextCfg.version}).`
              )
            }
            onOpenRadarModal={() => {
              setAutoTriggerRadar(false);
              setIsRadarModalOpen(true);
            }}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            simulations={savedSimulations}
            onLoadSimulation={handleLoadSimulation}
            onDeleteSimulation={handleDeleteSimulation}
            onDuplicateSimulation={handleDuplicateSimulation}
            onSaveCurrentSnapshot={handleSaveCurrentSimulation}
          />
        )}
      </main>

      {/* MILITARY FOOTER WITH REGULATORY SUMMARY */}
      <footer className="mt-8 border-t border-amber-500/25 bg-[#040914] py-5 px-4 sm:px-8 text-xs text-slate-400 no-print">
        <div className="max-w-[1920px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="font-display font-semibold text-amber-300">
              AURA-SOFTWARE
            </span>
            <span aria-hidden="true"> · </span>
            <span>
              Aplikasi Ukur Regulasi &amp; Anggaran Software — TNI Angkatan Udara
            </span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            <span>Acuan: Perpres 12/2021 · Pedoman LKPP · SBM Kemenkeu · INKINDO</span>
          </div>
        </div>
      </footer>

      {/* RADAR SYNC & REMOTE JSON ENDPOINT MODAL */}
      <RadarSyncModal
        isOpen={isRadarModalOpen}
        onClose={() => {
          setIsRadarModalOpen(false);
          setAutoTriggerRadar(false);
        }}
        endpointUrl={endpointUrl}
        onSaveEndpointUrl={handleSaveEndpointUrl}
        currentConfig={regulationConfig}
        syncStatus={syncStatus}
        onApplySyncedConfig={handleApplySyncedConfig}
        autoStartSync={autoTriggerRadar}
      />

      {/* QR BARCODE & SHARE LINK MODAL */}
      <ShareBarcodeModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        projectName={profile.projectName}
        grandTotalFormatted={formatIDR(summary.grandTotalEstimation)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* AURA TACTICAL AI ASSISTANT CHAT MODAL */}
      <AuraTacticalAssistant
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        regulationConfig={regulationConfig}
        onApplyDraftEstimate={handleApplyDraftEstimate}
      />
    </div>
  );
}
