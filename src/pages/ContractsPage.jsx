import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { 
    PlusCircle, Pencil, Trash2, Search, Layers, XCircle, FileSignature, Check,
    Paperclip, DollarSign, Calendar, Target, AlertTriangle, CheckCircle,
    ArrowUpDown, MapPin, SlidersHorizontal
} from 'lucide-react';
import ContractFormModal from '../components/ContractFormModal';
import toast from 'react-hot-toast';
import { KpiCard, MultiSelect } from '../components/SharedComponents';
import { loadFilterPresets, persistFilterPresets } from '../utils/filterPresets';

const storage = getStorage();

// ===== UTILITY FUNCTIONS =====
const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return 'N/A';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

// ===== UI COMPONENTS =====

// Progress Bar Component con gestione sforamenti
const ProgressBar = ({ spentPercentage = 0, overduePercentage = 0 }) => {
    const safeSpent = Math.max(0, Math.min(spentPercentage, 100));
    const combined = Math.max(0, Math.min(spentPercentage + overduePercentage, 100));
    const overdueWidth = Math.max(0, combined - safeSpent);
    const totalPercentage = Math.max(0, spentPercentage + overduePercentage);
    const overrunValue = Math.max(0, totalPercentage - 100);

    return (
        <div className="relative w-full h-3 rounded-full bg-slate-200 overflow-hidden">
            <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700"
                style={{ width: `${safeSpent}%` }}
            />
            {overduePercentage > 0 && (
                <div
                    className="absolute inset-y-0 bg-gradient-to-r from-rose-400 to-red-500 transition-all duration-700"
                    style={{
                        left: `${safeSpent}%`,
                        width: `${overdueWidth}%`
                    }}
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
            {overrunValue > 0 && (
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                    <span className="text-[10px] font-bold text-rose-600 drop-shadow-lg">
                        +{overrunValue.toFixed(0)}%
                    </span>
                </div>
            )}
        </div>
    );
};

// Vista Tabella
const ContractsTableView = ({ contracts, sectorMap, supplierMap = new Map(), onEdit, onDelete }) => {
    return (
        <div className="overflow-hidden rounded-3xl border border-white/30 bg-white/95 shadow-xl shadow-blue-200/60">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-700">
                    <thead className="bg-blue-700/95 text-white uppercase text-[11px] font-bold tracking-[0.16em]">
                        <tr>
                            <th className="px-5 py-3 text-left">Fornitore</th>
                            <th className="px-5 py-3 text-left hidden lg:table-cell">Descrizione</th>
                            <th className="px-5 py-3 text-left hidden xl:table-cell">Settori</th>
                            <th className="px-5 py-3 text-left">Progresso</th>
                            <th className="px-5 py-3 text-right">Valore</th>
                            <th className="px-5 py-3 text-right">Speso</th>
                            <th className="px-5 py-3 text-right">Scaduto</th>
                            <th className="px-5 py-3 text-right">Residuo</th>
                            <th className="px-5 py-3 text-center">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white/70">
                        {contracts.map((contract, index) => {
                            const totalAmount = contract.totalAmount || 0;
                            const spentAmount = contract.spentAmount || 0;
                            const overdueAmount = contract.overdueAmount || 0;
                            const residualAmount = typeof contract.residualAmount === 'number'
                                ? contract.residualAmount
                                : totalAmount - (spentAmount + overdueAmount);
                            const spentPercentage = totalAmount > 0 ? (spentAmount / totalAmount) * 100 : 0;
                            const overduePercentage = totalAmount > 0 ? (overdueAmount / totalAmount) * 100 : 0;
                            const effectivePercentage = totalAmount > 0
                                ? ((spentAmount + overdueAmount) / totalAmount) * 100
                                : (spentAmount > 0 ? Infinity : 0);
                            const supplierDisplayName = contract.supplierName || supplierMap.get(contract.supplierld) || 'N/D';
                            const sectorNames = (contract.effectiveSectors || []).map(id => sectorMap.get(id)).filter(Boolean).join(', ');
                            const residualDisplay = Math.abs(residualAmount) < 0.01 ? 0 : residualAmount;

                            return (
                                <tr key={contract.id} className={`
                                    hover:bg-blue-50/40 transition-colors
                                    ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                                `}>
                                    <td className="px-5 py-4">
                                        <div className="min-w-0">
                                            <p className="max-w-[220px] truncate text-sm font-semibold text-slate-900">
                                                {supplierDisplayName}
                                            </p>
                                            {sectorNames && (
                                                <p className="text-[11px] font-medium text-slate-400 truncate sm:hidden">
                                                    {sectorNames}
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 hidden lg:table-cell">
                                        <div className="text-sm font-medium text-slate-600 truncate max-w-xs">
                                            {contract.description || '—'}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 hidden xl:table-cell text-xs font-semibold text-slate-500">
                                        {sectorNames || '—'}
                                    </td>
                                    <td className="px-5 py-4 min-w-[190px]">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 min-w-[120px]">
                                                <ProgressBar
                                                    spentPercentage={spentPercentage}
                                                    overduePercentage={overduePercentage}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700">
                                                {Number.isFinite(effectivePercentage) ? `${Math.round(effectivePercentage)}%` : 'N/D'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                                        {formatCurrency(totalAmount)}
                                    </td>
                                    <td className="px-5 py-4 text-right font-semibold text-blue-700 whitespace-nowrap">
                                        {formatCurrency(spentAmount)}
                                    </td>
                                    <td className={`px-5 py-4 text-right font-semibold whitespace-nowrap ${
                                        overdueAmount > 0 ? 'text-rose-600' : 'text-slate-500'
                                    }`}>
                                        {overdueAmount > 0 ? formatCurrency(overdueAmount) : '—'}
                                    </td>
                                    <td className={`px-5 py-4 text-right font-semibold whitespace-nowrap ${
                                        residualDisplay < 0 ? 'text-rose-600' : residualDisplay === 0 ? 'text-slate-500' : 'text-emerald-600'
                                    }`}>
                                        {formatCurrency(residualDisplay)}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <button
                                                onClick={() => onEdit(contract)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Modifica"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => onDelete(contract)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                                title="Elimina"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                            {contract.contractPdfUrl && (
                                                <a
                                                    href={contract.contractPdfUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                    title="Apri PDF"
                                                >
                                                    <Paperclip className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const STATUS_OPTIONS = [
    { id: 'all', label: 'Tutti gli stati' },
    { id: 'overrun', label: 'Sforati' },
    { id: 'active', label: 'Attivi' },
    { id: 'completed', label: 'Completati' },
    { id: 'not_started', label: 'Non iniziati' }
];

const ContractsTableSection = ({
    searchTerm,
    setSearchTerm,
    orderedBranches,
    selectedBranch,
    setSelectedBranch,
    statusFilter,
    setStatusFilter,
    presetName,
    setPresetName,
    filterPresets,
    savePreset,
    applyPreset,
    deletePreset,
    hasActiveFilters,
    resetFilters,
    processedContracts,
    supplierMap,
    sectorMap,
    handleOpenEditModal,
    handleDeleteContract,
    handleOpenAddModal,
}) => {
    const [isPresetPanelOpen, setIsPresetPanelOpen] = useState(false);

    return (
        <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-48 right-0 h-80 w-80 rounded-full bg-blue-200/25 blur-3xl" />
                <div className="absolute bottom-[-35%] left-1/4 h-72 w-72 rounded-full bg-indigo-200/20 blur-2xl" />
            </div>
            <div className="relative z-10 flex flex-col">
                <div className="flex flex-col gap-4 rounded-t-3xl border-b border-white/60 bg-gradient-to-r from-blue-100/80 via-white/95 to-blue-100/50 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-500">Elenco contratti</p>
                            <h2 className="text-lg font-black text-slate-900">Dettaglio budget &amp; stato</h2>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <div className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-2 text-blue-700 shadow-sm shadow-blue-100/40">
                                <Search className="h-4 w-4 text-blue-400" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Cerca per descrizione, fornitore..."
                                    className="appearance-none bg-transparent text-sm font-semibold text-blue-700 placeholder:text-blue-700 focus:outline-none"
                                />
                            </div>
                            <div className="flex min-w-[220px] items-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-2 text-blue-700 shadow-sm shadow-blue-100/40">
                                <MapPin className="h-4 w-4 text-blue-400" />
                                <select
                                    value={selectedBranch}
                                    onChange={(event) => setSelectedBranch(event.target.value)}
                                    className="w-full bg-transparent text-sm font-semibold text-blue-700 focus:outline-none"
                                >
                                    <option value="all">Tutte le filiali</option>
                                    {orderedBranches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name || 'N/D'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex min-w-[220px] items-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-2 text-blue-700 shadow-sm shadow-blue-100/40">
                                <CheckCircle className="h-4 w-4 text-blue-400" />
                                <select
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value)}
                                    className="w-full bg-transparent text-sm font-semibold text-blue-700 focus:outline-none"
                                >
                                    {STATUS_OPTIONS.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative">
                                {isPresetPanelOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsPresetPanelOpen(false)}
                                        />
                                        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-80 max-w-[calc(100vw-3rem)] rounded-3xl border border-white/50 bg-white/95 p-4 shadow-2xl shadow-blue-900/30 backdrop-blur">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-500">
                                                Preset salvati
                                            </span>
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                                <input
                                                    type="text"
                                                    value={presetName}
                                                    onChange={(event) => setPresetName(event.target.value)}
                                                    placeholder="Nome preset (es. Direzione Q1)"
                                                    className="w-full sm:flex-1 rounded-2xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        savePreset();
                                                        setIsPresetPanelOpen(false);
                                                    }}
                                                    disabled={!presetName.trim()}
                                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    <Check className="w-4 h-4" />
                                                    Salva
                                                </button>
                                            </div>
                                            {filterPresets.length > 0 ? (
                                                <div className="mt-2 flex flex-col gap-2">
                                                    {filterPresets.map((preset) => (
                                                        <div
                                                            key={preset.id}
                                                            className="inline-flex items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-white/95 px-3 py-1.5 text-sm font-semibold text-blue-700 shadow-sm shadow-blue-100/40"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    applyPreset(preset);
                                                                    setIsPresetPanelOpen(false);
                                                                }}
                                                                className="flex-1 text-left hover:text-indigo-600 transition-colors"
                                                            >
                                                                {preset.name}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => deletePreset(preset.id)}
                                                                className="text-blue-300 hover:text-rose-500 transition-colors"
                                                            >
                                                                <XCircle className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="mt-2 text-xs font-medium text-blue-400">
                                                    Nessun preset salvato. Crea il primo per accelerare le viste.
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsPresetPanelOpen((prev) => !prev)}
                                    aria-expanded={isPresetPanelOpen}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white/95 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-700 shadow-sm shadow-blue-100/50 transition hover:border-blue-300 hover:text-indigo-600"
                                >
                                    <SlidersHorizontal className="h-4 w-4 text-blue-400" />
                                    Preset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 px-6 pb-6 space-y-6">
                    {filterPresets.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-100/70 bg-white/85 px-4 py-3 shadow-inner shadow-blue-100/40">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">
                                Preset rapidi
                            </span>
                            {filterPresets.map((preset) => (
                                <div
                                    key={preset.id}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 shadow-sm shadow-blue-100/40"
                                >
                                    <button
                                        type="button"
                                        onClick={() => applyPreset(preset)}
                                        className="flex-1 text-left transition-colors hover:text-indigo-600"
                                    >
                                        {preset.name}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deletePreset(preset.id)}
                                        className="text-blue-300 transition-colors hover:text-rose-500"
                                    >
                                        <XCircle className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {hasActiveFilters && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="inline-flex items-center gap-2 rounded-2xl border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm shadow-blue-100/40 transition-transform hover:-translate-y-[1px] hover:border-blue-400"
                            >
                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[11px] font-bold">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="h-3.5 w-3.5"
                                    >
                                        <path d="M4 4v5h5" />
                                        <path d="M16 16v-5h-5" />
                                        <path d="M5 9a6 6 0 0 1 9-3.7L16 8" />
                                        <path d="M15 11a6 6 0 0 1-9 3.7L4 12" />
                                    </svg>
                                </span>
                                Resetta filtri
                            </button>
                        </div>
                    )}

                    <div className="overflow-hidden rounded-3xl border border-blue-100 shadow-inner shadow-blue-100/70 mt-4">
                        {processedContracts.length > 0 ? (
                            <ContractsTableView
                                contracts={processedContracts}
                                supplierMap={supplierMap}
                                sectorMap={sectorMap}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteContract}
                            />
                        ) : (
                            <div className="bg-white/85 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 p-12 text-center">
                                <div className="p-4 rounded-2xl bg-blue-100 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                                    <FileSignature className="w-8 h-8 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 mb-4">Nessun Contratto Trovato</h3>
                                <p className="text-gray-600 mb-6">Non ci sono contratti che corrispondono ai filtri selezionati.</p>
                                {hasActiveFilters ? (
                                    <>
                                        <button
                                            onClick={resetFilters}
                                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-transform hover:-translate-y-[1px]"
                                        >
                                            <XCircle className="w-5 h-5" />
                                            Resetta filtri
                                        </button>
                                        <button
                                            onClick={handleOpenAddModal}
                                            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow-sm shadow-blue-100/40 transition-transform hover:-translate-y-[1px]"
                                        >
                                            <PlusCircle className="w-5 h-5" />
                                            Nuovo contratto
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleOpenAddModal}
                                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition-transform hover:-translate-y-[1px]"
                                    >
                                        <PlusCircle className="w-5 h-5" />
                                        Crea il primo contratto
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

// ===== MAIN COMPONENT =====
export default function ContractsPage({ user }) {
    const [allContracts, setAllContracts] = useState([]);
    const [allExpenses, setAllExpenses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState(null);
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' }); // intervallo firma
    const otherPresetsRef = useRef([]);
    const [filterPresets, setFilterPresets] = useState(() => {
        const stored = loadFilterPresets() || [];
        const contractPresets = [];
        const others = [];
        stored.forEach(preset => {
            if (!preset.scope || preset.scope === 'contracts') {
                contractPresets.push(preset);
            } else {
                others.push(preset);
            }
        });
        otherPresetsRef.current = others;
        return contractPresets;
    });
    const [presetName, setPresetName] = useState('');
    const [isOverrunPanelOpen, setIsOverrunPanelOpen] = useState(false);
    const presetsMountedRef = useRef(false);
    
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const orderedBranches = useMemo(() => {
        return [...branches].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [branches]);

        useEffect(() => {
        setIsLoading(true);
        
        let contractsQuery = query(collection(db, "contracts"), orderBy("signingDate", "desc"));
        
        if (user.role === 'collaborator' && user.assignedChannels && user.assignedChannels.length > 0) {
            if (user.assignedChannels.length <= 10) {
                contractsQuery = query(
                    collection(db, "contracts"),
                    where("supplierld", "in", user.assignedChannels),
                    orderBy("signingDate", "desc")
                );
            }
        }
        
        const unsubs = [
            onSnapshot(contractsQuery, snap => setAllContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "expenses")), snap => setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), snap => {
                setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            })
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, [user]);

    useEffect(() => {
        if (presetsMountedRef.current) {
            const scopedPresets = filterPresets.map(preset => ({
                ...preset,
                scope: 'contracts'
            }));
            persistFilterPresets([
                ...otherPresetsRef.current,
                ...scopedPresets
            ]);
        } else {
            presetsMountedRef.current = true;
        }
    }, [filterPresets]);

    const processedContracts = useMemo(() => {
        const dayMs = 24 * 60 * 60 * 1000;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let filtered = allContracts.map(contract => {
            const rawLineItems = Array.isArray(contract.lineItems) ? contract.lineItems : [];
            const normalizedLineItems = rawLineItems.map((item, index) => {
                const normalizedId = item.id || item._key || `${contract.id}-line-${index}`;
                return { ...item, _normalizedId: normalizedId };
            });

            const lineItemIdLookup = new Map();
            normalizedLineItems.forEach(li => {
                lineItemIdLookup.set(li._normalizedId, li._normalizedId);
                if (li.id) lineItemIdLookup.set(li.id, li._normalizedId);
                if (li._key) lineItemIdLookup.set(li._key, li._normalizedId);
            });

            const lineItemSpent = new Map();
            const lineItemSpentToDate = new Map();
            normalizedLineItems.forEach(li => {
                lineItemSpent.set(li._normalizedId, 0);
                lineItemSpentToDate.set(li._normalizedId, 0);
            });

            const allocateToLineItem = (normalizedId, amount, isUpToToday) => {
                if (!normalizedId || amount === 0) return;
                lineItemSpent.set(normalizedId, (lineItemSpent.get(normalizedId) || 0) + amount);
                if (isUpToToday) {
                    lineItemSpentToDate.set(normalizedId, (lineItemSpentToDate.get(normalizedId) || 0) + amount);
                }
            };

            const sortedLineItems = [...normalizedLineItems].sort((a, b) => {
                const startA = a.startDate ? new Date(a.startDate) : null;
                const startB = b.startDate ? new Date(b.startDate) : null;
                if (!startA && !startB) return 0;
                if (!startA) return 1;
                if (!startB) return -1;
                return startA - startB;
            });

            const distributeAmount = (amount, expenseDate, isUpToToday) => {
                if (!sortedLineItems.length || amount === 0) return;
                const activeLineItems = expenseDate
                    ? sortedLineItems.filter(li => {
                        if (!li.startDate || !li.endDate) return false;
                        const start = new Date(li.startDate);
                        const end = new Date(li.endDate);
                        start.setHours(0, 0, 0, 0);
                        end.setHours(0, 0, 0, 0);
                        return expenseDate >= start && expenseDate <= end;
                    })
                    : [];

                if (activeLineItems.length === 0) {
                    allocateToLineItem(sortedLineItems[0]._normalizedId, amount, isUpToToday);
                    return;
                }

                const totalActive = activeLineItems.reduce((sum, li) => sum + (parseFloat(li.totalAmount) || 0), 0);
                if (totalActive <= 0) {
                    const share = amount / activeLineItems.length;
                    activeLineItems.forEach(li => allocateToLineItem(li._normalizedId, share, isUpToToday));
                    return;
                }

                activeLineItems.forEach(li => {
                    const liTotal = parseFloat(li.totalAmount) || 0;
                    const share = (liTotal / totalActive) * amount;
                    allocateToLineItem(li._normalizedId, share, isUpToToday);
                });
            };

            allExpenses.forEach(expense => {
                const expenseLineItems = Array.isArray(expense.lineItems) ? expense.lineItems : [];
                const expenseDate = expense.date ? new Date(`${expense.date}T00:00:00`) : null;
                if (expenseDate) expenseDate.setHours(0, 0, 0, 0);
                const isUpToToday = !expenseDate || expenseDate <= today;

                let handled = false;
                expenseLineItems.forEach(item => {
                    if (item.relatedContractId === contract.id) {
                        handled = true;
                        const amount = parseFloat(item.amount) || 0;
                        const normalizedId = lineItemIdLookup.get(item.relatedLineItemId || item.relatedLineItemID);
                        if (normalizedId) {
                            allocateToLineItem(normalizedId, amount, isUpToToday);
                        } else {
                            distributeAmount(amount, expenseDate, isUpToToday);
                        }
                    }
                });

                if (!handled && expense.relatedContractId === contract.id) {
                    const amount = parseFloat(expense.amount) || 0;
                    distributeAmount(amount, expenseDate, isUpToToday);
                }
            });

        const enrichedNormalizedLineItems = normalizedLineItems.map(li => {
            const total = parseFloat(li.totalAmount) || 0;
            const spent = lineItemSpent.get(li._normalizedId) || 0;
            const spentUpToToday = lineItemSpentToDate.get(li._normalizedId) || 0;
            const remaining = Math.max(0, total - spent);
            let overdue = 0;

                if (total > 0 && li.startDate && li.endDate) {
                    const start = new Date(li.startDate);
                    const end = new Date(li.endDate);
                    if (!isNaN(start) && !isNaN(end)) {
                        start.setHours(0, 0, 0, 0);
                        end.setHours(0, 0, 0, 0);
                        if (today >= start) {
                            const totalDays = Math.max(1, Math.round((end - start) / dayMs) + 1);
                            const effectiveEnd = today > end ? end : today;
                            const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((effectiveEnd - start) / dayMs) + 1));
                            if (elapsedDays > 0) {
                                const expectedToDate = (total / totalDays) * elapsedDays;
                                const shortfall = expectedToDate - Math.min(spentUpToToday, expectedToDate);
                                overdue = Math.max(0, Math.min(remaining, shortfall));
                            }
                        }
                }
            }

            const { _normalizedId, ...baseLineItem } = li;
            return {
                ...baseLineItem,
                spent,
                spentUpToToday,
                remaining,
                overdue
            };
        });

        const cleanedLineItems = enrichedNormalizedLineItems;
            const spentAmount = enrichedNormalizedLineItems.reduce((sum, li) => sum + li.spent, 0);
            const overdueAmount = enrichedNormalizedLineItems.reduce((sum, li) => sum + li.overdue, 0);
            const totalAmountFromLines = enrichedNormalizedLineItems.reduce((sum, li) => sum + (parseFloat(li.totalAmount) || 0), 0);
            const totalAmount = totalAmountFromLines || parseFloat(contract.totalAmount) || 0;
            const residualAmount = totalAmount - (spentAmount + overdueAmount);
            const progress = totalAmount > 0 ? ((spentAmount + overdueAmount) / totalAmount) * 100 : (spentAmount > 0 ? Infinity : 0);
            const actualProgress = totalAmount > 0 ? (spentAmount / totalAmount) * 100 : (spentAmount > 0 ? Infinity : 0);

            let sectorsFromSource = [];
            const lineItemSectors = [...new Set(cleanedLineItems.map(item => item.sectorld).filter(Boolean))];

            if (lineItemSectors.length > 0) {
                sectorsFromSource = lineItemSectors;
            } else if (contract.associatedSectors && contract.associatedSectors.length > 0) {
                sectorsFromSource = contract.associatedSectors;
            } else if (contract.sectorld) {
                sectorsFromSource = [contract.sectorld];
            }

            return {
                ...contract,
                totalAmount,
                spentAmount,
                overdueAmount,
                residualAmount,
                progress,
                actualProgress,
                effectiveSectors: sectorsFromSource,
                lineItems: cleanedLineItems
            };
        });

        if (searchTerm.trim() !== '') {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                (c.description || '').toLowerCase().includes(lowerSearch) ||
                (supplierMap.get(c.supplierld) || '').toLowerCase().includes(lowerSearch)
            );
        }

        if (dateFilter.startDate) {
            const start = new Date(dateFilter.startDate);
            start.setHours(0, 0, 0, 0);
            filtered = filtered.filter(c => {
                const signingDate = c.signingDate ? new Date(c.signingDate) : null;
                return signingDate ? signingDate >= start : true;
            });
        }

        if (dateFilter.endDate) {
            const end = new Date(dateFilter.endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(c => {
                const signingDate = c.signingDate ? new Date(c.signingDate) : null;
                return signingDate ? signingDate <= end : true;
            });
        }

        if (selectedBranch !== 'all') {
            filtered = filtered.filter(c => {
                if (c.branchld && c.branchld === selectedBranch) return true;
                return (c.lineItems || []).some(li => (li.branchld || li.branchId) === selectedBranch);
            });
        }

        if (statusFilter === 'overrun') {
            filtered = filtered.filter(c => c.progress > 100);
        } else if (statusFilter === 'active') {
            filtered = filtered.filter(c => c.actualProgress > 0 && c.actualProgress < 100);
        } else if (statusFilter === 'completed') {
            filtered = filtered.filter(c => c.actualProgress >= 100);
        } else if (statusFilter === 'not_started') {
            filtered = filtered.filter(c => c.actualProgress === 0);
        }

        return filtered;
    }, [
        allContracts,
        allExpenses,
        searchTerm,
        statusFilter,
        supplierMap,
        selectedBranch,
        dateFilter.startDate,
        dateFilter.endDate
    ]);
    const savePreset = useCallback(() => {
        const name = presetName.trim();
        if (!name) {
            toast.error('Inserisci un nome per il preset');
            return;
        }
        const trimmedSearch = searchTerm.trim();
        const preset = {
            id: Date.now(),
            scope: 'contracts',
            name,
            searchTerm: trimmedSearch,
            startDate: dateFilter.startDate,
            endDate: dateFilter.endDate,
            selectedBranch,
            statusFilter
        };
        setFilterPresets(prev => {
            const withoutDuplicates = prev.filter(p => p.name.toLowerCase() !== name.toLowerCase());
            return [...withoutDuplicates, preset];
        });
        setPresetName('');
        toast.success('Preset salvato');
    }, [presetName, searchTerm, dateFilter.startDate, dateFilter.endDate, selectedBranch, statusFilter]);

    const applyPreset = useCallback((preset) => {
        setSearchTerm(preset.searchTerm || '');
        setDateFilter({
            startDate: preset.startDate ?? '',
            endDate: preset.endDate ?? ''
        });
                setSelectedBranch(preset.selectedBranch || 'all');
                setStatusFilter(preset.statusFilter || 'all');
                toast.success(`Preset "${preset.name}" applicato`);
    }, []);

    const deletePreset = useCallback((id) => {
        setFilterPresets(prev => prev.filter(p => p.id !== id));
        toast.success('Preset eliminato');
    }, []);

    const contractStats = useMemo(() => {
        const total = processedContracts.length;
        const totalValue = processedContracts.reduce((sum, c) => sum + c.totalAmount, 0);
        const totalSpent = processedContracts.reduce((sum, c) => sum + c.spentAmount, 0);
        const totalOverdue = processedContracts.reduce((sum, c) => sum + (c.overdueAmount || 0), 0);
        const totalResidual = processedContracts.reduce((sum, c) => sum + (c.residualAmount || 0), 0);
        const active = processedContracts.filter(c => c.actualProgress > 0 && c.actualProgress < 100).length;
        const completed = processedContracts.filter(c => c.actualProgress >= 100).length;
        const overrun = processedContracts.filter(c => c.progress > 100).length;
        const avgUtilization = totalValue > 0 ? ((totalSpent + totalOverdue) / totalValue) * 100 : 0;

        return { total, totalValue, totalSpent, totalOverdue, totalResidual, active, completed, overrun, avgUtilization };
    }, [processedContracts]);

    const kpiCards = useMemo(() => {
        return [
            {
                key: 'total',
                title: 'Contratti Totali',
                value: contractStats.total.toString(),
                subtitle: `${contractStats.active} attivi`,
                icon: <FileSignature className="w-6 h-6" />,
                gradient: 'from-blue-500 to-indigo-600'
            },
            {
                key: 'value',
                title: 'Valore Totale',
                value: formatCurrency(contractStats.totalValue),
                subtitle: 'valore complessivo',
                icon: <DollarSign className="w-6 h-6" />,
                gradient: 'from-sky-500 to-cyan-500'
            },
            {
                key: 'spent',
                title: 'Importo Speso',
                value: formatCurrency(contractStats.totalSpent),
                subtitle: `+ Scaduto ${formatCurrency(contractStats.totalOverdue)}`,
                icon: <Target className="w-6 h-6" />,
                gradient: 'from-indigo-500 to-blue-700'
            },
            {
                key: 'residual',
                title: 'Residuo Netto',
                value: formatCurrency(contractStats.totalResidual),
                subtitle: contractStats.overrun > 0 ? `${contractStats.overrun} sforati` : 'budget disponibile',
                icon: <CheckCircle className="w-6 h-6" />,
                gradient: contractStats.overrun > 0 ? 'from-rose-500 to-red-600' : 'from-emerald-500 to-green-600'
            }
        ];
    }, [contractStats]);

    const handleOpenAddModal = () => { setEditingContract(null); setIsModalOpen(true); };
    const handleOpenEditModal = (contract) => { setEditingContract(contract); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingContract(null); };
    const handleSaveContract = async (formData, contractFile) => {
        const isEditing = !!formData.id;
        const toastId = toast.loading(isEditing ? 'Aggiornamento...' : 'Salvataggio...');
        try {
            const { _key, ...cleanFormData } = formData;
            const cleanLineItems = cleanFormData.lineItems.map(item => {
                const { _key, ...rest } = item;
                return { ...rest, totalAmount: parseFloat(String(rest.totalAmount).replace(',', '.')) || 0 };
            });
            const contractId = isEditing ? cleanFormData.id : doc(collection(db, 'contracts')).id;
            let fileURL = cleanFormData.contractPdfUrl || "";
            if (contractFile) {
                const storageRef = ref(storage, `contracts/${contractId}/${contractFile.name}`);
                await uploadBytes(storageRef, contractFile);
                fileURL = await getDownloadURL(storageRef);
            }
            
            const dataToSave = { ...cleanFormData, lineItems: cleanLineItems, contractPdfUrl: fileURL, updatedAt: serverTimestamp() };
            Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === undefined) dataToSave[key] = null; });
            (dataToSave.lineItems || []).forEach(item => Object.keys(item).forEach(key => { if (item[key] === undefined) item[key] = null; }));

            if (isEditing) {
                await updateDoc(doc(db, "contracts", contractId), dataToSave);
            } else {
                dataToSave.authorld = user.uid;
                dataToSave.authorName = user.name;
                dataToSave.createdAt = serverTimestamp();
                await setDoc(doc(db, "contracts", contractId), dataToSave);
            }
            toast.success(isEditing ? 'Contratto aggiornato!' : 'Contratto creato!', { id: toastId });
            handleCloseModal();
        } catch (error) {
            console.error("Errore nel salvare il contratto:", error);
            toast.error(error.message || 'Errore imprevisto.', { id: toastId });
        }
    };

    const handleDeleteContract = async (contract) => {
        if (!window.confirm(`Sei sicuro di voler eliminare il contratto "${contract.description}"?`)) return;
        const toastId = toast.loading("Eliminazione in corso...");
        try {
            if (contract.contractPdfUrl) {
                const fileRef = ref(storage, contract.contractPdfUrl);
                await deleteObject(fileRef).catch(err => console.warn("File non trovato:", err));
            }
            await deleteDoc(doc(db, "contracts", contract.id));
            toast.success("Contratto eliminato!", { id: toastId });
        } catch (error) {
            console.error("Errore durante l'eliminazione:", error);
            toast.error("Errore durante l'eliminazione.", { id: toastId });
        }
    };

    const resetFilters = () => {
        setSearchTerm(''); 
        setSelectedBranch('all');
        setStatusFilter('all');
        setDateFilter({ startDate: '', endDate: '' });
        setPresetName('');
        toast.success("Filtri resettati!");
    };

    const trimmedSearchTerm = searchTerm.trim();
    const hasActiveFilters = Boolean(
        trimmedSearchTerm ||
        selectedBranch !== 'all' ||
        statusFilter !== 'all' ||
        dateFilter.startDate ||
        dateFilter.endDate
    );
    const overrunContracts = processedContracts
        .filter(c => c.progress > 100)
        .map(c => ({
            ...c,
            budgetOverrun: Math.max(0, (c.spentAmount + (c.overdueAmount || 0)) - c.totalAmount)
        }));
    const totalOverrunAmount = overrunContracts.reduce((sum, c) => sum + (c.budgetOverrun || 0), 0);
    useEffect(() => {
        if (overrunContracts.length === 0 && isOverrunPanelOpen) {
            setIsOverrunPanelOpen(false);
        }
    }, [overrunContracts.length, isOverrunPanelOpen]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div className="text-xl font-semibold text-gray-700">Caricamento contratti...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative">
            <div className="relative p-4 lg:p-8 space-y-6">
                {/* Hero */}
                <div className="space-y-6">
                    <div className="relative rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-600 text-white shadow-2xl border border-white/20 p-6 lg:p-10">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_55%)]" />
                        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg shadow-blue-900/30 ring-4 ring-white/20">
                                        <FileSignature className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.4em] text-white/70 font-semibold">Contratti</p>
                                        <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black leading-tight">Gestione Contratti</h1>
                                    </div>
                                </div>
                                <p className="text-sm lg:text-base text-white/85 max-w-3xl">
                                    Monitora accordi e impegni con i fornitori mantenendo un'esperienza coerente con dashboard, spese e budget.
                                </p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="inline-flex items-center gap-3 rounded-2xl border border-white/30 bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/85 shadow-lg shadow-blue-900/30 backdrop-blur-sm">
                                        <Calendar className="w-4 h-4" />
                                        Periodo
                                        <input
                                            type="date"
                                            value={dateFilter.startDate}
                                            onChange={(event) =>
                                                setDateFilter(prev => ({ ...prev, startDate: event.target.value }))
                                            }
                                            className="rounded-xl border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur focus:border-white/70 focus:outline-none focus:ring-2 focus:ring-white/40"
                                        />
                                        <span className="text-white/50">→</span>
                                        <input
                                            type="date"
                                            value={dateFilter.endDate}
                                            onChange={(event) =>
                                                setDateFilter(prev => ({ ...prev, endDate: event.target.value }))
                                            }
                                            className="rounded-xl border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur focus:border-white/70 focus:outline-none focus:ring-2 focus:ring-white/40"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleOpenAddModal}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 backdrop-blur-sm transition-all hover:bg-white/25"
                                    >
                                        <PlusCircle className="w-4 h-4" />
                                        Nuovo contratto
                                    </button>
                                </div>
                            </div>
                        </div>
                        {overrunContracts.length > 0 && (
                            <div className="absolute bottom-6 right-6">
                                {isOverrunPanelOpen && (
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsOverrunPanelOpen(false)}
                                    />
                                )}
                                <div className="relative z-50 flex flex-col items-end gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsOverrunPanelOpen(prev => !prev)}
                                        className="group inline-flex items-center gap-3 rounded-2xl border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 backdrop-blur transition-all hover:bg-white/25"
                                    >
                                    <span className="relative">
                                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                                        <AlertTriangle className="h-4 w-4 text-rose-200 group-hover:text-rose-100 transition-colors" />
                                    </span>
                                    <span>Contratti oltre budget</span>
                                    <span className="inline-flex items-center justify-center rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                                        {overrunContracts.length}
                                    </span>
                                    <ArrowUpDown
                                        className={`h-4 w-4 transition-transform duration-200 ${isOverrunPanelOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                    {isOverrunPanelOpen && (
                                    <div className="absolute right-0 top-[calc(100%+0.75rem)] w-[calc(100vw-3rem)] max-w-xs rounded-3xl border border-white/40 bg-white/95 p-4 shadow-2xl shadow-blue-900/30 backdrop-blur sm:w-80">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500">
                                                    Oltre budget
                                                </p>
                                                <h3 className="text-sm font-black text-slate-900">
                                                    {formatCurrency(totalOverrunAmount)}
                                                </h3>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setIsOverrunPanelOpen(false)}
                                                className="rounded-full bg-rose-50 p-1 text-rose-500 transition hover:bg-rose-100"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                                            {overrunContracts.map(contract => (
                                                <div
                                                    key={contract.id}
                                                    className="flex items-center justify-between rounded-2xl border border-rose-100/80 bg-white px-3 py-2 shadow-sm shadow-rose-100/50"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-semibold text-slate-700">
                                                            {supplierMap.get(contract.supplierld) || 'N/D'}
                                                        </span>
                                                        <span className="text-[11px] font-semibold text-rose-500">
                                                            +{(contract.progress - 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-900">
                                                        {formatCurrency(contract.budgetOverrun || 0)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsOverrunPanelOpen(false)}
                                            className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-500 transition hover:bg-rose-100"
                                        >
                                            Chiudi dettagli
                                        </button>
                                    </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                    {kpiCards.map(({ key, ...card }) => (
                        <KpiCard key={key} {...card} />
                    ))}
                </div>

                <ContractsTableSection
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    orderedBranches={orderedBranches}
                    selectedBranch={selectedBranch}
                    setSelectedBranch={setSelectedBranch}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    presetName={presetName}
                    setPresetName={setPresetName}
                    filterPresets={filterPresets}
                    savePreset={savePreset}
                    applyPreset={applyPreset}
                    deletePreset={deletePreset}
                    hasActiveFilters={hasActiveFilters}
                    resetFilters={resetFilters}
                    processedContracts={processedContracts}
                    supplierMap={supplierMap}
                    sectorMap={sectorMap}
                    handleOpenEditModal={handleOpenEditModal}
                    handleDeleteContract={handleDeleteContract}
                    handleOpenAddModal={handleOpenAddModal}
                />

            {/* Modal */}
            <ContractFormModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveContract}
                initialData={editingContract}
                suppliers={suppliers}
                sectors={sectors}
                branches={branches}
            />
        </div>
    </div>
);
}
