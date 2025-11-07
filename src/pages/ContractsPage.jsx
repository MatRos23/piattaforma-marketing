import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { 
    PlusCircle, Pencil, Trash2, Search, Layers, XCircle, FileSignature, Check,
    Paperclip, DollarSign, Calendar, Target, AlertTriangle, CheckCircle, Clock,
    Car, Sailboat, Caravan, Building2, ArrowUpDown, SlidersHorizontal, Info, MapPin
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

const getSectorIcon = (sectorName, className = "w-4 h-4") => {
    const icons = { 
        'Auto': <Car className={className} />, 
        'Camper&Caravan': <Caravan className={className} />, 
        'Yachting': <Sailboat className={className} />, 
        'Frattin Group': <Building2 className={className} />, 
        'default': <DollarSign className={className} /> 
    };
    return icons[sectorName] || icons.default;
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
const ContractsTableView = ({ contracts, supplierMap, sectorMap, onEdit, onDelete }) => {
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
                            const primarySectorId = contract.effectiveSectors?.[0];
                            const primarySectorName = primarySectorId ? sectorMap.get(primarySectorId) : 'default';
                            const sectorNames = (contract.effectiveSectors || []).map(id => sectorMap.get(id)).filter(Boolean).join(', ');
                            const residualDisplay = Math.abs(residualAmount) < 0.01 ? 0 : residualAmount;

                            return (
                                <tr key={contract.id} className={`
                                    hover:bg-blue-50/40 transition-colors
                                    ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}
                                `}>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-inner ring-1 ring-blue-100">
                                                {getSectorIcon(primarySectorName || 'default', 'w-4 h-4 text-blue-600')}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">
                                                    {supplierMap.get(contract.supplierld) || 'N/D'}
                                                </p>
                                                {sectorNames && (
                                                    <p className="text-[11px] font-medium text-slate-400 truncate sm:hidden">
                                                        {sectorNames}
                                                    </p>
                                                )}
                                            </div>
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
    const [sectorFilter, setSectorFilter] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('progress_desc');
    const [statusFilter, setStatusFilter] = useState('all');
    const [supplierFilter, setSupplierFilter] = useState([]); // multi-select fornitori
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
    const presetsMountedRef = useRef(false);
    
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const orderedBranches = useMemo(() => {
        return [...branches].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [branches]);

    const orderedSectors = useMemo(() => {
        const order = ['Auto', 'Camper&Caravan', 'Yachting', 'Frattin Group'];
        return [...sectors].sort((a, b) => {
            const indexA = order.indexOf(a.name); 
            const indexB = order.indexOf(b.name);
            if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
            if (indexA === -1) return 1; 
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }, [sectors]);

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

        if (sectorFilter !== 'all') {
            filtered = filtered.filter(c => c.effectiveSectors.includes(sectorFilter));
        }

        if (searchTerm.trim() !== '') {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                (c.description || '').toLowerCase().includes(lowerSearch) ||
                (supplierMap.get(c.supplierld) || '').toLowerCase().includes(lowerSearch)
            );
        }

        if (supplierFilter.length > 0) {
            filtered = filtered.filter(c => supplierFilter.includes(c.supplierld));
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

        return filtered.sort((a, b) => {
            switch (sortOrder) {
                case 'progress_desc':
                    return b.progress - a.progress;
                case 'progress_asc':
                    return a.progress - b.progress;
                case 'date_desc':
                    return new Date(b.signingDate || 0) - new Date(a.signingDate || 0);
                case 'date_asc':
                    return new Date(a.signingDate || 0) - new Date(b.signingDate || 0);
                case 'amount_desc':
                    return b.totalAmount - a.totalAmount;
                case 'amount_asc':
                    return a.totalAmount - b.totalAmount;
                case 'name_asc':
                    return (supplierMap.get(a.supplierld) || '').localeCompare(supplierMap.get(b.supplierld) || '');
                case 'name_desc':
                    return (supplierMap.get(b.supplierld) || '').localeCompare(supplierMap.get(a.supplierld) || '');
                default:
                    return 0;
            }
        });
    }, [
        allContracts,
        allExpenses,
        sectorFilter,
        searchTerm,
        statusFilter,
        sortOrder,
        supplierMap,
        supplierFilter,
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
            selectedSector: sectorFilter,
            selectedBranch,
            supplierFilter,
            statusFilter,
            sortOrder
        };
        setFilterPresets(prev => {
            const withoutDuplicates = prev.filter(p => p.name.toLowerCase() !== name.toLowerCase());
            return [...withoutDuplicates, preset];
        });
        setPresetName('');
        toast.success('Preset salvato');
    }, [presetName, searchTerm, dateFilter.startDate, dateFilter.endDate, sectorFilter, selectedBranch, supplierFilter, statusFilter, sortOrder]);

    const applyPreset = useCallback((preset) => {
        setSearchTerm(preset.searchTerm || '');
        setDateFilter({
            startDate: preset.startDate ?? '',
            endDate: preset.endDate ?? ''
        });
        setSectorFilter(preset.selectedSector || 'all');
        setSelectedBranch(preset.selectedBranch || 'all');
        setSupplierFilter(preset.supplierFilter || []);
        setStatusFilter(preset.statusFilter || 'all');
        setSortOrder(preset.sortOrder || 'progress_desc');
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
        setSectorFilter('all');
        setSelectedBranch('all');
        setStatusFilter('all');
        setSortOrder('progress_desc');
        setSupplierFilter([]);
        setDateFilter({ startDate: '', endDate: '' });
        setPresetName('');
        toast.success("Filtri resettati!");
    };

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

    const trimmedSearchTerm = searchTerm.trim();
    const hasActiveFilters = Boolean(
        trimmedSearchTerm ||
        sectorFilter !== 'all' ||
        selectedBranch !== 'all' ||
        statusFilter !== 'all' ||
        sortOrder !== 'progress_desc' ||
        supplierFilter.length > 0 ||
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative">
            <div className="relative p-4 lg:p-8 space-y-6">
                {/* Hero */}
                <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-600 text-white shadow-2xl border border-white/20 p-6 lg:p-10">
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
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                    {kpiCards.map(({ key, ...card }) => (
                        <KpiCard key={key} {...card} />
                    ))}
                </div>

                {/* Filtri */}
                <div className="bg-gradient-to-br from-blue-50 via-white to-white backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8 space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-sky-500 text-white shadow-lg shadow-blue-500/20 ring-4 ring-blue-400/20">
                            <SlidersHorizontal className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black text-slate-900">Filtri Contratti</h2>
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[11px] font-bold text-blue-700">
                                    <Info className="w-3 h-3" />
                                    Allineati alla dashboard
                                </span>
                            </div>
                            <p className="mt-1 text-sm font-medium text-slate-600">
                                Definisci ricerche e intervalli temporali per uniformare la lettura dei contratti con le altre sezioni.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex flex-col gap-3 lg:flex-row">
                            <div className="relative flex-1 min-w-[220px]">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Cerca per descrizione, fornitore..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-12 rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium text-slate-700 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                />
                            </div>
                            <div className="flex-1 min-w-[220px]">
                                <MultiSelect
                                    options={suppliers}
                                    selected={supplierFilter}
                                    onChange={(supplierId) => {
                                        setSupplierFilter(prev =>
                                            prev.includes(supplierId)
                                                ? prev.filter(id => id !== supplierId)
                                                : [...prev, supplierId]
                                        );
                                    }}
                                    placeholder="Tutti i fornitori"
                                    selectedText={supplierFilter.length
                                        ? `${supplierFilter.length} fornitore${supplierFilter.length === 1 ? '' : 'i'} selezionat${supplierFilter.length === 1 ? 'o' : 'i'}`
                                        : undefined}
                                    searchPlaceholder="Cerca fornitore..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                            <div className="flex flex-col gap-3">
                                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    Periodo
                                </span>
                                <div className="flex flex-wrap items-center gap-3">
                                    <input
                                        type="date"
                                        value={dateFilter.startDate}
                                        onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                                        className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-600 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                    <span className="text-slate-400 font-semibold text-sm">→</span>
                                    <input
                                        type="date"
                                        value={dateFilter.endDate}
                                        onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                                        className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-600 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    Settori
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSectorFilter('all')}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                                            sectorFilter === 'all'
                                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Layers className={`w-4 h-4 ${sectorFilter === 'all' ? 'text-white' : 'text-blue-600'}`} />
                                        Tutti i settori
                                    </button>
                                    {orderedSectors.map(sector => {
                                        const isActive = sectorFilter === sector.id;
                                        const iconClassName = `w-4 h-4 ${isActive ? 'text-white' : 'text-blue-600'}`;
                                        return (
                                            <button
                                                key={sector.id}
                                                type="button"
                                                onClick={() => setSectorFilter(sector.id)}
                                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                                                    isActive
                                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {getSectorIcon(sector.name, iconClassName)}
                                                {sector.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    Filiali
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedBranch('all')}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                                            selectedBranch === 'all'
                                                ? 'bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-lg shadow-slate-500/30'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <MapPin className="w-4 h-4" />
                                        Tutte le Filiali
                                    </button>
                                    {orderedBranches.map(branch => {
                                        const isActive = selectedBranch === branch.id;
                                        return (
                                            <button
                                                key={branch.id}
                                                type="button"
                                                onClick={() => setSelectedBranch(branch.id)}
                                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                                                    isActive
                                                        ? 'bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-lg shadow-slate-500/30'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <MapPin className="w-4 h-4" />
                                                {branch.name || 'N/D'}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                    Stato contratti
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('all')}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                            statusFilter === 'all'
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Tutti ({contractStats.total})
                                    </button>
                                    {contractStats.overrun > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setStatusFilter('overrun')}
                                            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1 transition-all ${
                                                statusFilter === 'overrun'
                                                    ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/30'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <AlertTriangle className="w-3 h-3" />
                                            Sforati ({contractStats.overrun})
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('active')}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1 transition-all ${
                                            statusFilter === 'active'
                                                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Clock className="w-3 h-3" />
                                        In corso ({contractStats.active})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatusFilter('completed')}
                                        className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1 transition-all ${
                                            statusFilter === 'completed'
                                                ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <CheckCircle className="w-3 h-3" />
                                        Completati ({contractStats.completed})
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
                                    <ArrowUpDown className="w-4 h-4" />
                                    Ordina:
                                </span>
                                <select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value)}
                                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                >
                                    <option value="progress_desc">Progresso ↓</option>
                                    <option value="progress_asc">Progresso ↑</option>
                                    <option value="amount_desc">Importo ↓</option>
                                    <option value="amount_asc">Importo ↑</option>
                                    <option value="date_desc">Data firma ↓</option>
                                    <option value="date_asc">Data firma ↑</option>
                                    <option value="name_asc">Nome A-Z</option>
                                    <option value="name_desc">Nome Z-A</option>
                                </select>
                            </div>
                        </div>
                        <div className="border-t border-slate-200 pt-4 space-y-3">
                            <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                Preset salvati
                            </span>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                <input
                                    type="text"
                                    value={presetName}
                                    onChange={(e) => setPresetName(e.target.value)}
                                    placeholder="Nome preset (es. Direzione Q1)"
                                    className="w-full sm:flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                />
                                <button
                                    type="button"
                                    onClick={savePreset}
                                    disabled={!presetName.trim()}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Check className="w-4 h-4" />
                                    Salva preset
                                </button>
                            </div>
                            {filterPresets.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {filterPresets.map(preset => (
                                        <div
                                            key={preset.id}
                                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => applyPreset(preset)}
                                                className="hover:text-blue-600 transition-colors"
                                            >
                                                {preset.name}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deletePreset(preset.id)}
                                                className="text-slate-400 hover:text-rose-500 transition-colors"
                                            >
                                                <XCircle className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs font-medium text-slate-400">
                                    Salva le combinazioni di filtri per riutilizzarle rapidamente nelle altre pagine.
                                </p>
                            )}
                        </div>

                        {hasActiveFilters && (
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition-all hover:scale-105"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Resetta filtri
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Alert Contratti Sforati */}
                {overrunContracts.length > 0 && (
                    <div className="rounded-3xl border border-white/40 bg-white/95 shadow-xl shadow-blue-200/50 p-5 lg:p-7 space-y-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/30">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-base font-black text-slate-900">
                                        {overrunContracts.length} contratt{overrunContracts.length > 1 ? 'i' : 'o'} oltre budget
                                    </h4>
                                    <p className="text-sm font-medium text-slate-600">
                                        Rivedi impegni e condizioni per riportare le spese entro i limiti pianificati.
                                    </p>
                                </div>
                            </div>
                            <div className="rounded-2xl border border-rose-100 px-4 py-3 text-right bg-white">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500">
                                    Sforamento complessivo
                                </p>
                                <p className="text-xl font-black text-rose-600">
                                    {formatCurrency(totalOverrunAmount)}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {overrunContracts.map(c => (
                                <span
                                    key={c.id}
                                    className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                                >
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm ring-1 ring-blue-100">
                                        {getSectorIcon(
                                            sectorMap.get(c.effectiveSectors?.[0]) || 'default',
                                            'w-3.5 h-3.5 text-blue-600'
                                        )}
                                    </span>
                                    <div className="flex flex-col">
                                        <span className="truncate max-w-[150px]">{supplierMap.get(c.supplierld) || 'N/D'}</span>
                                        <div className="flex items-center gap-1 text-[11px]">
                                        <span className="font-bold text-rose-600">{formatCurrency(c.budgetOverrun || 0)}</span>
                                            <span className="font-semibold text-rose-400">+{(c.progress - 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Lista Contratti o Tabella */}
                {processedContracts.length > 0 ? (
                    <ContractsTableView
                        contracts={processedContracts}
                        supplierMap={supplierMap}
                        sectorMap={sectorMap}
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteContract}
                    />
                ) : (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-12 text-center">
                        <div className="p-4 rounded-2xl bg-blue-100 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                            <FileSignature className="w-8 h-8 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Nessun Contratto Trovato</h3>
                        <p className="text-gray-600 mb-6">Non ci sono contratti che corrispondono ai filtri selezionati.</p>
                        {hasActiveFilters ? (
                            <button 
                                onClick={resetFilters}
                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all hover:scale-105"
                            >
                                Resetta Filtri
                            </button>
                        ) : (
                            <button 
                                onClick={handleOpenAddModal}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all hover:scale-105"
                            >
                                <PlusCircle className="w-5 h-5" />
                                Crea il primo contratto
                            </button>
                        )}
                    </div>
                )}
            </div>
            
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
    );
}
