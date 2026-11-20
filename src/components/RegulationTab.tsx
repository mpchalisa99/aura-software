import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
} from 'lucide-react';
import { DEFAULT_REGULATION_CONFIG } from '../data/defaultRegulations';
import {
  QualificationTier,
  RegulationConfigPayload,
  RoleTariff,
  SyncStatus,
} from '../types/aura';
import { formatIDR, formatTimestampID } from '../utils/formatters';

interface RegulationTabProps {
  regulationConfig: RegulationConfigPayload;
  syncStatus: SyncStatus;
  endpointUrl: string;
  onUpdateRegulationConfig: (nextConfig: RegulationConfigPayload, status?: SyncStatus) => void;
  onOpenRadarModal: () => void;
}

const TIERS: QualificationTier[] = ['Junior', 'Middle', 'Senior', 'Lead / Principal'];

export const RegulationTab: React.FC<RegulationTabProps> = ({
  regulationConfig,
  syncStatus,
  endpointUrl,
  onUpdateRegulationConfig,
  onOpenRadarModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('TA-11');
  const [newRoleRef, setNewRoleRef] = useState('Standar Industri TI & SKKNI');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRates, setNewRates] = useState<Record<QualificationTier, number>>({
    Junior: 15000000,
    Middle: 20000000,
    Senior: 26000000,
    'Lead / Principal': 32000000,
  });

  const filteredRoles = regulationConfig.roleTariffs.filter(
    (r) =>
      r.roleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.standardReference.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRateChange = (
    roleId: string,
    tier: QualificationTier,
    newAmount: number
  ) => {
    const updatedRoles = regulationConfig.roleTariffs.map((role) => {
      if (role.id !== roleId) return role;
      return {
        ...role,
        rates: {
          ...role.rates,
          [tier]: Math.max(0, newAmount),
        },
      };
    });

    onUpdateRegulationConfig(
      {
        ...regulationConfig,
        lastUpdated: new Date().toISOString(),
        roleTariffs: updatedRoles,
      },
      'CUSTOM OVERRIDE'
    );
  };

  const handleAddCustomRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    const newRole: RoleTariff = {
      id: `role-custom-${Date.now()}`,
      code: newRoleCode.trim() || `TA-${regulationConfig.roleTariffs.length + 1}`,
      roleName: newRoleName.trim(),
      category: 'Engineering & Development',
      rates: newRates,
      standardReference: newRoleRef.trim() || 'Penyesuaian Satker',
      description: newRoleDesc.trim() || 'Spesialis pengembangan perangkat lunak.',
    };

    onUpdateRegulationConfig(
      {
        ...regulationConfig,
        lastUpdated: new Date().toISOString(),
        roleTariffs: [...regulationConfig.roleTariffs, newRole],
      },
      'CUSTOM OVERRIDE'
    );
    setNewRoleName('');
    setNewRoleDesc('');
    setShowNewRoleForm(false);
  };

  const handleResetDefaultMaster = () => {
    onUpdateRegulationConfig(
      {
        ...DEFAULT_REGULATION_CONFIG,
        lastUpdated: new Date().toISOString(),
      },
      'SYNCED'
    );
    setEditingRoleId(null);
  };

  return (
    <div className="space-y-8">
      {/* 1. Sync Telemetry & Active Legal References */}
      <section className="hud-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-cyan-500/20">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <span>BASIS DATA REGULASI PENGADAAN &amp; STANDAR BIAYA</span>
              <span aria-hidden="true">·</span>
              <span>VERSI: {regulationConfig.version}</span>
              <span aria-hidden="true">·</span>
              <span>SUMBER: {regulationConfig.sourceAuthority}</span>
            </div>
            <h2 className="text-xl font-display font-semibold text-white mt-1">
              Rujukan Regulasi Pemerintah &amp; Standar Remunerasi Aktif (Auto-Sync Berkala)
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Endpoint JSON: {endpointUrl} · Pembaruan Terakhir:{' '}
              {formatTimestampID(regulationConfig.lastUpdated)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenRadarModal}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>SYNC REGULASI RESMI SEKARANG</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaultMaster}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Tabel Bawaan</span>
            </button>
          </div>
        </div>

        {/* Active Regulation Reference List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {regulationConfig.regulations.map((reg) => (
            <div
              key={reg.id}
              className="bg-[#071224] border border-cyan-500/20 p-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-mono text-cyan-300">
                  <span>{reg.code}</span>
                  <span className="text-slate-400">
                    {reg.category} · {reg.year}
                  </span>
                </div>
                <h3 className="text-sm font-display font-semibold text-white mt-1.5">
                  {reg.title}
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {reg.summary}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Penerbit: {reg.issuer}</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Rujukan Aktif
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Master Table of Standard Man-Month Tariffs */}
      <section className="hud-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-cyan-500/20">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <span>TABEL INDUK STANDAR BIAYA PERSONEL (ORANG-BULAN / OB)</span>
              <span aria-hidden="true">·</span>
              <span>STATUS: {syncStatus}</span>
            </div>
            <h2 className="text-xl font-display font-semibold text-white mt-1">
              Matriks Tarif Remunerasi Tenaga Ahli Perangkat Lunak
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari peran atau kode TA..."
                className="pl-8 pr-3 py-1.5 text-xs bg-[#050c18] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowNewRoleForm((v) => !v)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#0f2447] hover:bg-[#173668] text-cyan-200 border border-cyan-400/40 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showNewRoleForm ? 'Tutup Form' : 'Tambah Peran Baru'}</span>
            </button>
          </div>
        </div>

        {showNewRoleForm && (
          <form
            onSubmit={handleAddCustomRole}
            className="mt-4 p-4 bg-[#050d1b] border border-cyan-400/30 space-y-4"
          >
            <div className="text-xs font-mono text-cyan-300">
              TAMBAH PERAN TENAGA AHLI KE TABEL INDUK REGULASI
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[11px] text-slate-400 mb-1">Kode</label>
                <input
                  type="text"
                  value={newRoleCode}
                  onChange={(e) => setNewRoleCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#081326] border border-cyan-500/30 text-white"
                />
              </div>
              <div className="md:col-span-5">
                <label className="block text-[11px] text-slate-400 mb-1">Nama Peran Tenaga Ahli</label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Contoh: Embedded Avionics Software Engineer"
                  className="w-full px-2.5 py-1.5 text-xs bg-[#081326] border border-cyan-500/30 text-white"
                />
              </div>
              <div className="md:col-span-5">
                <label className="block text-[11px] text-slate-400 mb-1">Rujukan Standar</label>
                <input
                  type="text"
                  value={newRoleRef}
                  onChange={(e) => setNewRoleRef(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-[#081326] border border-cyan-500/30 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TIERS.map((tier) => (
                <div key={tier}>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Tarif {tier} (Rp/OB)
                  </label>
                  <input
                    type="number"
                    step={500000}
                    value={newRates[tier]}
                    onChange={(e) =>
                      setNewRates({
                        ...newRates,
                        [tier]: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#081326] border border-cyan-500/30 text-cyan-200"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950"
              >
                Simpan Peran ke Tabel Induk
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#050e1d] border-b border-cyan-500/30 text-[11px] font-mono text-cyan-300">
                <th className="py-3 px-3">Kode</th>
                <th className="py-3 px-3">Peran Tenaga Ahli &amp; Rujukan</th>
                <th className="py-3 px-3 text-right">Junior (1-3 Thn)</th>
                <th className="py-3 px-3 text-right">Middle (4-6 Thn)</th>
                <th className="py-3 px-3 text-right">Senior (7-10 Thn)</th>
                <th className="py-3 px-3 text-right">Lead (&gt;10 Thn)</th>
                <th className="py-3 px-3 text-center">Koreksi Tarif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {filteredRoles.map((role, idx) => {
                const isEditing = editingRoleId === role.id;
                return (
                  <tr
                    key={role.id}
                    className={idx % 2 === 0 ? 'bg-[#081326]/90' : 'bg-[#0b1930]/60'}
                  >
                    <td className="py-3 px-3 font-mono text-cyan-300 align-top">
                      {role.code}
                    </td>
                    <td className="py-3 px-3 align-top max-w-xs">
                      <div className="font-semibold text-white">{role.roleName}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{role.description}</div>
                      <div className="text-[11px] font-mono text-cyan-400/80 mt-1 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 shrink-0" />
                        <span>{role.standardReference}</span>
                      </div>
                    </td>

                    {TIERS.map((tier) => (
                      <td key={tier} className="py-3 px-3 text-right font-mono align-top">
                        {isEditing ? (
                          <input
                            type="number"
                            step={500000}
                            value={role.rates[tier]}
                            onChange={(e) =>
                              handleRateChange(
                                role.id,
                                tier,
                                Number(e.target.value) || 0
                              )
                            }
                            className="w-32 px-2 py-1 text-xs font-mono text-right bg-[#040a15] border border-cyan-400 text-cyan-200"
                          />
                        ) : (
                          <span className="text-slate-100">{formatIDR(role.rates[tier])}</span>
                        )}
                      </td>
                    ))}

                    <td className="py-3 px-3 text-center align-top">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingRoleId(isEditing ? null : role.id)
                        }
                        className={`px-2.5 py-1 text-[11px] font-mono border transition-colors whitespace-nowrap shrink-0 ${
                          isEditing
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400/50'
                        }`}
                      >
                        <Settings2 className="w-3 h-3 inline mr-1" />
                        {isEditing ? 'Selesai' : 'Ubah Tarif'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
