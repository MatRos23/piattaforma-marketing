import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { 
    PlusCircle, Search, Wallet, Car, Sailboat, Caravan, Building2, Layers, MapPin,
    DollarSign, FileText, Paperclip, Copy, Pencil, Trash2, AlertTriangle, CheckCircle2, 
    SlidersHorizontal, Activity, ArrowUpDown, TrendingUp, TrendingDown,
    FileSignature, Info, X, Check
} from 'lucide-react';
import ExpenseFormModal from '../components/ExpenseFormModal';
import toast from 'react-hot-toast';
import { MultiSelect } from '../components/SharedComponents';
import { loadFilterPresets, persistFilterPresets } from '../utils/filterPresets';

const storage = getStorage();

// ===== SHARED COMPONENTS =====
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

const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '€ 0,00';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/D';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

const KpiCard = React.memo(({ title, value, icon, gradient, subtitle, trend }) => (
    <div className="group relative flex flex-col gap-4 rounded-3xl border border-slate-200/60 bg-white/95 p-5 lg:p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl overflow-hidden">
        <div className={`absolute inset-x-0 top-0 h-[6px] bg-gradient-to-r ${gradient}`} />
        <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg shadow-indigo-500/20 ring-4 ring-white/60`}>
                {React.cloneElement(icon, { className: "w-6 h-6" })}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                    {title}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl lg:text-3xl font-black text-slate-900">
                        {value}
                    </span>
                    {trend && (
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                            trend.direction === 'up'
                                ? 'text-emerald-500'
                                : trend.direction === 'down'
                                    ? 'text-rose-500'
                                    : 'text-slate-400'
                        }`}>
                            {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '■'} {trend.label || trend.value || ''}
                        </span>
                    )}
                </div>
                {subtitle && <p className="text-sm font-semibold text-slate-500">{subtitle}</p>}
            </div>
        </div>
    </div>
));

const getDefaultStartDate = () => {
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, 0, 1).toISOString().split('T')[0];
};

const getDefaultEndDate = () => {
    const currentYear = new Date().getFullYear();
    return new Date(currentYear, 11, 31).toISOString().split('T')[0];
};

// Progress Bar universale con gestione sforamenti
const ProgressBar = ({ value, max, showOverrun = true }) => {
    const percentage = max > 0 ? Math.round((value / max) * 1000) / 10 : 0;
    const displayPercentage = Math.min(percentage, 100);
    
    const getGradient = () => {
        if (percentage > 100) return 'from-red-500 to-rose-600';
        if (percentage >= 100) return 'from-green-500 to-emerald-600';
        if (percentage >= 85) return 'from-amber-500 to-orange-600';
        if (percentage > 0) return 'from-blue-500 to-indigo-600';
        return 'from-gray-300 to-gray-400';
    };
    
    return (
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
            <div 
                className={`h-full rounded-full bg-gradient-to-r ${getGradient()} transition-all duration-700 relative overflow-hidden`} 
                style={{ width: `${displayPercentage}%` }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
            </div>
            {showOverrun && percentage > 100 && (
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                    <span className="text-[10px] font-bold text-red-700 drop-shadow-lg">
                        +{(percentage - 100).toFixed(0)}%
                    </span>
                </div>
            )}
        </div>
    );
};

// Status Badge aggiornato con supporto requiresContract
// Vista Tabella
const ExpenseTableView = React.memo(({ 
    expenses, 
    sectorMap, 
    supplierMap, 
    branchMap,
    contractMap,
    onEdit, 
    onDelete,
    onDuplicate,
    canEditOrDelete
}) => {
    const [sortState, setSortState] = useState({ column: null, direction: null });

    const sortedExpenses = useMemo(() => {
        if (!sortState.column) return expenses;
        const sorted = [...expenses];
        const { column, direction } = sortState;
        sorted.sort((a, b) => {
            let valueA;
            let valueB;
            switch (column) {
                case 'supplier':
                    valueA = supplierMap.get(a.supplierId) || '';
                    valueB = supplierMap.get(b.supplierId) || '';
                    return direction === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
                case 'date':
                    valueA = new Date(a.date || 0).getTime();
                    valueB = new Date(b.date || 0).getTime();
                    return direction === 'asc' ? valueA - valueB : valueB - valueA;
                case 'amount':
                    valueA = a.displayAmount || a.amount || 0;
                    valueB = b.displayAmount || b.amount || 0;
                    return direction === 'asc' ? valueA - valueB : valueB - valueA;
                default:
                    return 0;
            }
        });
        return sorted;
    }, [expenses, sortState, supplierMap]);

    const handleSort = (column) => {
        setSortState(prev => {
            if (prev.column === column) {
                const nextDirection = prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc';
                return { column: nextDirection ? column : null, direction: nextDirection };
            }
            return { column, direction: 'asc' };
        });
    };

    const getSortIndicator = (column) => {
        if (sortState.column !== column || !sortState.direction) {
            return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />;
        }
        return sortState.direction === 'asc'
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            : <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
    };

    const buildBranchName = (expense) => {
        if (expense.lineItems && expense.lineItems.length > 0) {
            const item = expense.lineItems[0];
            if (item.branchNames) return item.branchNames;
            if (item.assignmentId) return branchMap.get(item.assignmentId) || '—';
        }
        return branchMap.get(expense.branchId) || '—';
    };

    return (
        <div className="overflow-hidden rounded-3xl border border-white/30 bg-white/95 shadow-xl shadow-slate-200/60">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-700">
                    <thead className="bg-slate-900/95 text-white uppercase text-[11px] font-bold tracking-[0.16em]">
                        <tr>
                            <th className="px-4 py-3 text-left">
                                <button type="button" onClick={() => handleSort('supplier')} className="inline-flex items-center gap-2">
                                    Fornitore
                                    {getSortIndicator('supplier')}
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left hidden lg:table-cell">Descrizione</th>
                            <th className="px-4 py-3 text-left hidden xl:table-cell">Settore</th>
                            <th className="px-4 py-3 text-left hidden xl:table-cell">Filiale</th>
                            <th className="px-4 py-3 text-left">
                                <button type="button" onClick={() => handleSort('date')} className="inline-flex items-center gap-2">
                                    Data
                                    {getSortIndicator('date')}
                                </button>
                            </th>
                            <th className="px-4 py-3 text-right">
                                <button type="button" onClick={() => handleSort('amount')} className="inline-flex items-center gap-2">
                                    Importo
                                    {getSortIndicator('amount')}
                                </button>
                            </th>
                            <th className="px-4 py-3 text-center">Documenti</th>
                            <th className="px-4 py-3 text-center">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedExpenses.map((expense) => {
                            const sectorIdentifier = expense.sectorId || expense.lineItems?.[0]?.sectorId || null;
                            const sectorName = sectorMap.get(sectorIdentifier) || '—';
                            const branchName = buildBranchName(expense);
                            const hasInvoice = !!expense.invoicePdfUrl;
                            const hasContract = expense.isContractSatisfied;
                            const requiresContract = expense.requiresContract !== false;

                            return (
                                <tr key={expense.id} className="bg-white/70 hover:bg-indigo-50/20 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 shadow-inner">
                                                <Wallet className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900 truncate max-w-[220px]">
                                                    {supplierMap.get(expense.supplierId) || 'N/D'}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        <p className="text-sm text-slate-600 truncate max-w-xs">
                                            {expense.description || '—'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 hidden xl:table-cell text-sm text-slate-600">{sectorName}</td>
                                    <td className="px-4 py-3 hidden xl:table-cell text-sm text-slate-600">{branchName}</td>
                            <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                                {formatDate(expense.date)}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                                {formatCurrency(expense.displayAmount || expense.amount)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            {hasInvoice ? (
                                                <a
                                                    href={expense.invoicePdfUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50"
                                                    title="Apri fattura"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </a>
                                            ) : (
                                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-300">
                                                    <FileText className="w-4 h-4" />
                                                </span>
                                            )}
                                            {requiresContract && (
                                                hasContract ? (
                                                    <a
                                                        href={expense.contractPdfUrl || contractMap.get(expense.relatedContractId)?.contractPdfUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
                                                        title="Apri contratto"
                                                    >
                                                        <FileSignature className="w-4 h-4" />
                                                    </a>
                                                ) : (
                                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-dashed border-slate-200 text-slate-300">
                                                        <FileSignature className="w-4 h-4" />
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {canEditOrDelete(expense) && (
                                                <>
                                                    <button 
                                                        onClick={() => onDuplicate(expense)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all"
                                                        title="Duplica spesa"
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                        Duplica
                                                    </button>
                                                    <button 
                                                        onClick={() => onEdit(expense)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-all"
                                                        title="Modifica spesa"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        Modifica
                                                    </button>
                                                    <button 
                                                        onClick={() => onDelete(expense)}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all"
                                                        title="Elimina spesa"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Elimina
                                                    </button>
                                                </>
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
});

// ===== MAIN COMPONENT - EXPENSES PAGE =====
export default function ExpensesPage({ user, initialFilters }) {
    const location = useLocation();
    
    // Stati principali
    const [rawExpenses, setRawExpenses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [geographicAreas, setGeographicAreas] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [sectorBudgets, setSectorBudgets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Stati UI
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    
    // Stati filtri
    const [searchTerm, setSearchTerm] = useState('');
    const [supplierFilter, setSupplierFilter] = useState([]);
    const [dateFilter, setDateFilter] = useState(() => ({
        startDate: getDefaultStartDate(),
        endDate: getDefaultEndDate()
    }));
    const [selectedSector, setSelectedSector] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [invoiceFilter, setInvoiceFilter] = useState('');
    const [contractFilter, setContractFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState([]);
    const [specialFilter, setSpecialFilter] = useState(null);
    const [sortOrder, setSortOrder] = useState('date_desc');
    const [statusFilter, setStatusFilter] = useState('all');
    const [filterPresets, setFilterPresets] = useState(() => loadFilterPresets());
    const [presetName, setPresetName] = useState('');
    
    // Debounce search per performance
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);
    
    // Map per lookup rapidi con memoizzazione aggressiva
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const marketingChannelMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.name])), [marketingChannels]);
    const contractMap = useMemo(() => new Map(contracts.map(c => [c.id, c])), [contracts]);
    const defaultStartDate = useMemo(() => getDefaultStartDate(), []);
    const defaultEndDate = useMemo(() => getDefaultEndDate(), []);
    
    // Ordinamento settori
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
    
    // ID filiale "Generico" memoizzato
    const genericoBranchId = useMemo(() => 
        branches.find(b => b.name.toLowerCase() === 'generico')?.id, 
        [branches]
    );
    
    // Cache filiali per settore
    const branchesPerSector = useMemo(() => {
        const cache = new Map();
        sectors.forEach(sector => {
            const sectorBranches = branches.filter(b => 
                b.associatedSectors?.includes(sector.id) && 
                b.id !== genericoBranchId
            );
            cache.set(sector.id, sectorBranches);
        });
        return cache;
    }, [sectors, branches, genericoBranchId]);

    const effectiveBranchFilter = useMemo(() => {
        const combined = new Set(branchFilter);
        if (selectedBranch !== 'all') {
            combined.add(selectedBranch);
        }
        return Array.from(combined);
    }, [branchFilter, selectedBranch]);

    const orderedBranches = useMemo(() => {
        return [...branches].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [branches]);
    
    // Budget per fornitore/settore
    const budgetInfoMap = useMemo(() => {
        const map = new Map();
        const currentYear = new Date().getFullYear();
        
        budgets.forEach(budget => {
            if (budget.year === currentYear && budget.allocations) {
                budget.allocations.forEach(allocation => {
                    const key = `${budget.supplierId}-${allocation.sectorId}`;
                    map.set(key, {
                        budget: allocation.budgetAmount || 0,
                        spent: 0
                    });
                });
            }
        });
        
        return map;
    }, [budgets]);
    
    // Inizializzazione filtri da props/location
    useEffect(() => {
        const filters = initialFilters || location.state;
        if (filters && Object.keys(filters).length > 0) {
            if (filters.branchFilter) { 
                setBranchFilter(filters.branchFilter); 
            }
            if (filters.specialFilter) { 
                setSpecialFilter(filters.specialFilter); 
            }
        }
    }, [initialFilters, location.state]);

    const hasMounted = useRef(false);
    useEffect(() => {
        if (hasMounted.current) {
            persistFilterPresets(filterPresets);
        } else {
            hasMounted.current = true;
        }
    }, [filterPresets]);
    
    // Caricamento dati da Firebase
    useEffect(() => {
        setIsLoading(true);
        
        let expensesQuery = query(collection(db, "expenses"), orderBy("date", "desc"));
        
        if (user.role === 'collaborator' && user.assignedChannels?.length > 0 && user.assignedChannels.length <= 10) {
            expensesQuery = query(
                collection(db, "expenses"),
                where("supplierId", "in", user.assignedChannels),
                orderBy("date", "desc")
            );
        }
        
        const currentYear = new Date().getFullYear();
        
        const unsubscribes = [
            onSnapshot(expensesQuery, (snap) => {
                const expenses = snap.docs.map(doc => ({ 
                    ...doc.data(), 
                    id: doc.id 
                }));
                setRawExpenses(expenses);
            }),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), 
                snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), 
                snap => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), 
                snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "marketing_channels"), orderBy("name")), 
                snap => setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "geographic_areas"), orderBy("name")), 
                snap => setGeographicAreas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "contracts"), orderBy("description")), 
                snap => setContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "budgets"), where("year", "==", currentYear)), 
                snap => setBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sector_budgets"), where("year", "==", currentYear)), 
                snap => {
                    setSectorBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    setIsLoading(false);
                })
        ];
        
        return () => unsubscribes.forEach(unsub => unsub());
    }, [user]);
    
    // PROCESSAMENTO SPESE OTTIMIZZATO con memoizzazione aggressiva
    const processedExpenses = useMemo(() => {
        // 1. NORMALIZZAZIONE
        let normalized = rawExpenses.map(expense => {
            // Normalizza IDs
            let supplierId = expense.supplierId || expense.supplierld || expense.channelId || expense.channelld;
            let sectorId = expense.sectorId || expense.sectorld;
            
            // Prepara lineItems
            let lineItems = [];
            if (Array.isArray(expense.lineItems) && expense.lineItems.length > 0) {
                lineItems = expense.lineItems.map((item, index) => ({
                    ...item,
                    assignmentId: item.assignmentId || item.assignmentid || item.branchld || expense.branchId || expense.branchld || "",
                    marketingChannelId: item.marketingChannelId || item.marketingChannelld || "",
                    sectorId: item.sectorId || item.sectorld || sectorId,
                    amount: parseFloat(item.amount) || 0,
                    _key: `${expense.id}-${index}`
                }));
            } else {
                lineItems.push({
                    description: expense.description || 'Voce principale',
                    amount: parseFloat(expense.amount) || 0,
                    marketingChannelId: expense.marketingChannelId || expense.marketingChannelld || "",
                    assignmentId: expense.branchId || expense.branchld || "",
                    sectorId: sectorId,
                    _key: `${expense.id}-0`
                });
            }
            
            // Calcola totale
            const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
            
            // Processa lineItems per display
            const processedLineItems = [];
            const processedGroupIds = new Set();
            
            lineItems.forEach(item => {
                if (item.splitGroupId && !processedGroupIds.has(item.splitGroupId)) {
                    const groupItems = lineItems.filter(li => li.splitGroupId === item.splitGroupId);
                    const totalGroupAmount = groupItems.reduce((sum, gi) => sum + gi.amount, 0);
                    const branchNames = groupItems.map(gi => branchMap.get(gi.assignmentId) || 'N/D').join(', ');
                    
                    processedLineItems.push({
                        _key: item.splitGroupId,
                        isGroup: true,
                        description: item.description,
                        amount: totalGroupAmount,
                        displayAmount: totalGroupAmount,
                        marketingChannelId: item.marketingChannelId,
                        branchNames: branchNames,
                        branchCount: groupItems.length,
                    });
                    processedGroupIds.add(item.splitGroupId);
                } else if (!item.splitGroupId) {
                    if (item.assignmentId === genericoBranchId) {
                        const sectorBranches = branchesPerSector.get(item.sectorId) || [];
                        processedLineItems.push({
                            ...item,
                            isGenerico: true,
                            displayAmount: item.amount,
                            distributedTo: sectorBranches.length > 0 
                                ? `${sectorBranches.length} filiali: ${sectorBranches.map(b => b.name).join(', ')}` 
                                : 'Nessuna filiale associata'
                        });
                    } else {
                        processedLineItems.push({
                            ...item,
                            displayAmount: item.amount
                        });
                    }
                }
            });
            
            // Aggiungi info budget
            const budgetKey = `${supplierId}-${sectorId}`;
            const budgetInfo = budgetInfoMap.get(budgetKey);
            
            const hasTopLevelContract = !!expense.contractPdfUrl || !!expense.relatedContractId;
            const allLineItemsHaveContract = lineItems.length > 0 && lineItems.every(li => !!li.relatedContractId);
            const isContractSatisfied = hasTopLevelContract || allLineItemsHaveContract;
            
            return {
                ...expense,
                isContractSatisfied,
                supplierId,
                sectorId,
                amount: totalAmount,
                lineItems,
                processedLineItems,
                displayAmount: totalAmount,
                budgetInfo,
                requiresContract: expense.requiresContract !== undefined ? expense.requiresContract : true
            };
        });
        
        // 2. FILTRAGGIO
        
        // Filtro per settore
        if (selectedSector !== 'all') {
            normalized = normalized.filter(exp => exp.sectorId === selectedSector);
        }
        
        // Filtro per fornitore (multi-selezione)
if (supplierFilter.length > 0) {
    normalized = normalized.filter(exp => supplierFilter.includes(exp.supplierId));
}
        
        // Filtro per date
        if (dateFilter.startDate && dateFilter.endDate) {
            const start = new Date(dateFilter.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(dateFilter.endDate);
            end.setHours(23, 59, 59, 999);
            
            normalized = normalized.filter(exp => {
                const expDate = exp.date ? new Date(exp.date) : null;
                return expDate && expDate >= start && expDate <= end;
            });
        }
        
        // Filtro stato
        if (statusFilter === 'complete') {
            normalized = normalized.filter(exp => {
                const requiresContract = exp.requiresContract !== false;
                return exp.invoicePdfUrl && (!requiresContract || exp.contractPdfUrl || exp.relatedContractId);
            });
        } else if (statusFilter === 'incomplete') {
         normalized = normalized.filter(exp => {
        const requiresContract = exp.requiresContract !== false;
        return !exp.invoicePdfUrl || (requiresContract && !exp.isContractSatisfied);
        });
        }else if (statusFilter === 'amortized') {
            normalized = normalized.filter(exp => exp.isAmortized);
        }
        
        // Altri filtri esistenti...
        if (invoiceFilter === 'present') {
            normalized = normalized.filter(exp => !!exp.invoicePdfUrl);
        } else if (invoiceFilter === 'missing') {
            normalized = normalized.filter(exp => !exp.invoicePdfUrl);
        }
        
        if (contractFilter === 'present') {
            normalized = normalized.filter(exp => !!exp.contractPdfUrl || !!exp.relatedContractId);
        } else if (contractFilter === 'missing') {
            normalized = normalized.filter(exp => !exp.contractPdfUrl && !exp.relatedContractId);
        }
        
        // Filtro filiale con calcolo distribuito
        if (effectiveBranchFilter.length > 0) {
            normalized = normalized.filter(exp => 
                exp.lineItems?.some(item => {
                    if (effectiveBranchFilter.includes(item.assignmentId)) return true;
                    
                    if (item.assignmentId === genericoBranchId) {
                        const sectorBranches = branchesPerSector.get(item.sectorId || exp.sectorId) || [];
                        return sectorBranches.some(b => effectiveBranchFilter.includes(b.id));
                    }
                    
                    return false;
                })
            );
            
            // Ricalcola displayAmount per filiali filtrate
            normalized = normalized.map(exp => {
                let displayAmount = 0;
                let hasDistributedAmount = false;
                const distributedDetails = [];
                
                (exp.lineItems || []).forEach(item => {
                    const itemAmount = item.amount || 0;
                    
                    if (effectiveBranchFilter.includes(item.assignmentId)) {
                        displayAmount += itemAmount;
                    } else if (item.assignmentId === genericoBranchId) {
                        const sectorBranches = branchesPerSector.get(item.sectorId || exp.sectorId) || [];
                        const filteredBranchesInSector = sectorBranches.filter(b => effectiveBranchFilter.includes(b.id));
                        
                        if (filteredBranchesInSector.length > 0 && sectorBranches.length > 0) {
                            const quotaPerBranch = itemAmount / sectorBranches.length;
                            const quotaForFiltered = quotaPerBranch * filteredBranchesInSector.length;
                            displayAmount += quotaForFiltered;
                            hasDistributedAmount = true;
                            
                            distributedDetails.push(`${formatCurrency(quotaPerBranch)} x ${filteredBranchesInSector.length} filiali`);
                        }
                    }
                });
                
                return {
                    ...exp,
                    displayAmount,
                    hasDistributedAmount,
                    distributedInfo: hasDistributedAmount ? { details: distributedDetails.join(' + ') } : null
                };
            });
        }
        
        // Filtro ricerca testuale con debounce
        if (debouncedSearchTerm.trim()) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            normalized = normalized.filter(exp => {
                const supplierName = supplierMap.get(exp.supplierId) || '';
                const channelNames = exp.lineItems?.map(item => 
                    marketingChannelMap.get(item.marketingChannelId) || ''
                ).join(' ');
                
                return exp.description?.toLowerCase().includes(lowerSearch) ||
                       supplierName.toLowerCase().includes(lowerSearch) ||
                       channelNames?.toLowerCase().includes(lowerSearch) ||
                       exp.lineItems?.some(item => item.description?.toLowerCase().includes(lowerSearch));
            });
        }
        
        // Filtri speciali
        if (specialFilter === 'unassigned') {
            normalized = normalized.filter(exp => {
                if (exp.lineItems && exp.lineItems.length > 0) {
                    return exp.lineItems.some(item => !item.assignmentId || !branchMap.has(item.assignmentId));
                }
                return !exp.branchId || !branchMap.has(exp.branchId);
            });
        } else if (specialFilter === 'withissues') {
            normalized = normalized.filter(exp => {
                const requiresContract = exp.requiresContract !== false;
                return !exp.invoicePdfUrl || (requiresContract && !exp.isContractSatisfied);
            });
        }
        
        // 3. ORDINAMENTO
        normalized.sort((a, b) => {
            switch (sortOrder) {
                case 'amount_desc':
                    return b.displayAmount - a.displayAmount;
                case 'amount_asc':
                    return a.displayAmount - b.displayAmount;
                case 'date_desc':
                    return new Date(b.date || 0) - new Date(a.date || 0);
                case 'date_asc':
                    return new Date(a.date || 0) - new Date(b.date || 0);
                case 'name_asc':
                    return (supplierMap.get(a.supplierId) || '').localeCompare(supplierMap.get(b.supplierId) || '');
                case 'name_desc':
                    return (supplierMap.get(b.supplierId) || '').localeCompare(supplierMap.get(a.supplierId) || '');
                default:
                    return 0;
            }
        });
        
        return normalized;
    }, [
        rawExpenses, 
        selectedSector, 
        supplierFilter, 
        dateFilter, 
        statusFilter,
        invoiceFilter, 
        contractFilter,
        effectiveBranchFilter, 
        debouncedSearchTerm, 
        specialFilter,
        sortOrder,
        supplierMap, 
        marketingChannelMap, 
        branchMap,
        genericoBranchId, 
        branchesPerSector,
        budgetInfoMap
    ]);
    
    // Calcolo KPI ottimizzato
    const kpiData = useMemo(() => {
        const total = processedExpenses.length;
        const totalSpend = effectiveBranchFilter.length > 0 
            ? processedExpenses.reduce((sum, exp) => sum + (exp.displayAmount || 0), 0)
            : processedExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        const withInvoice = processedExpenses.filter(exp => exp.invoicePdfUrl).length;
        const withContract = processedExpenses.filter(exp => exp.contractPdfUrl || exp.relatedContractId).length;
        const complete = processedExpenses.filter(exp => {
        const requiresContract = exp.requiresContract !== false;
        return exp.invoicePdfUrl && (!requiresContract || exp.isContractSatisfied);
        }).length;
        const incomplete = processedExpenses.filter(exp => {
        const requiresContract = exp.requiresContract !== false;
        return !exp.invoicePdfUrl || (requiresContract && !exp.isContractSatisfied);
        }).length;
        
        // Calcola budget totale per spese visualizzate
        let totalBudget = 0;
        if (selectedSector === 'all') {
            totalBudget = sectorBudgets.reduce((sum, sb) => sum + (sb.maxAmount || 0), 0);
        } else {
            const sectorBudget = sectorBudgets.find(sb => sb.sectorId === selectedSector);
            totalBudget = sectorBudget?.maxAmount || 0;
        }
        
        const budgetUtilization = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
        
        // Calcolo trend
        const currentMonth = new Date().getMonth();
        const currentMonthSpend = processedExpenses.filter(exp => {
            const expDate = exp.date ? new Date(exp.date) : null;
            return expDate && expDate.getMonth() === currentMonth;
        }).reduce((sum, exp) => sum + exp.displayAmount, 0);
        
        const lastMonth = currentMonth - 1;
        const lastMonthSpend = processedExpenses.filter(exp => {
            const expDate = exp.date ? new Date(exp.date) : null;
            return expDate && expDate.getMonth() === lastMonth;
        }).reduce((sum, exp) => sum + exp.displayAmount, 0);
        
        const trend = lastMonthSpend > 0 ? 
            ((currentMonthSpend - lastMonthSpend) / lastMonthSpend * 100).toFixed(1) : 0;
        
        return {
            totalExpenses: total,
            totalSpend,
            totalBudget,
            budgetUtilization,
            withInvoicePercentage: total > 0 ? ((withInvoice / total) * 100).toFixed(1) : 0,
            withContractPercentage: total > 0 ? ((withContract / total) * 100).toFixed(1) : 0,
            complete,
            completePercentage: total > 0 ? ((complete / total) * 100).toFixed(1) : 0,
            incomplete,
            trend: {
                direction: parseFloat(trend) >= 0 ? 'up' : 'down',
                value: `${Math.abs(parseFloat(trend))}%`
            }
        };
    }, [processedExpenses, effectiveBranchFilter, sectorBudgets, selectedSector]);
    

    // Callbacks ottimizzati

    
    const canEditOrDelete = useCallback((expense) => {
        return user.role === 'manager' || user.role === 'admin' || expense.authorId === user.uid;
    }, [user.role, user.uid]);
    
    const handleOpenAddModal = useCallback(() => { 
        setEditingExpense(null); 
        setIsModalOpen(true); 
    }, []);
    
    const handleCloseModal = useCallback(() => { 
        setIsModalOpen(false); 
        setEditingExpense(null); 
    }, []);
    
    const handleOpenEditModal = useCallback((expense) => {
        if (!canEditOrDelete(expense)) {
            return toast.error("Non hai i permessi per modificare questa spesa.");
        }
        setEditingExpense(expense);
        setIsModalOpen(true);
    }, [canEditOrDelete]);
    
    const handleSaveExpense = useCallback(async (expenseData, invoiceFile, contractFile) => {
        const isEditing = !!expenseData.id;
        const toastId = toast.loading(isEditing ? 'Aggiornamento...' : 'Salvataggio...');
        
        try {
            const expenseId = isEditing ? expenseData.id : doc(collection(db, 'expenses')).id;
            let invoiceURL = expenseData.invoicePdfUrl || "";
            let contractURL = expenseData.contractPdfUrl || "";
            
            if (invoiceFile) {
                const invoiceRef = ref(storage, `invoices/${expenseId}/${invoiceFile.name}`);
                await uploadBytes(invoiceRef, invoiceFile);
                invoiceURL = await getDownloadURL(invoiceRef);
            }
            
            if (contractFile) {
                const contractRef = ref(storage, `contracts_on_expenses/${expenseId}/${contractFile.name}`);
                await uploadBytes(contractRef, contractFile);
                contractURL = await getDownloadURL(contractRef);
            }
            
            const dataToSave = {
                date: expenseData.date,
                description: expenseData.description,
                sectorId: expenseData.sectorId,
                supplierId: expenseData.supplierId,
                amount: expenseData.lineItems.reduce((sum, item) => sum + item.amount, 0),
                lineItems: expenseData.lineItems,
                invoicePdfUrl: invoiceURL,
                contractPdfUrl: contractURL,
                relatedContractId: expenseData.relatedContractId || null,
                requiresContract: expenseData.requiresContract !== undefined ? expenseData.requiresContract : true,
                isAmortized: expenseData.isAmortized || false,
                amortizationStartDate: expenseData.isAmortized ? expenseData.amortizationStartDate : null,
                amortizationEndDate: expenseData.isAmortized ? expenseData.amortizationEndDate : null,
            };
            
            if (isEditing) {
                await updateDoc(doc(db, "expenses", expenseId), { 
                    ...dataToSave, 
                    updatedAt: serverTimestamp() 
                });
            } else {
                dataToSave.authorId = user.uid;
                dataToSave.authorName = user.name;
                dataToSave.createdAt = serverTimestamp();
                await setDoc(doc(db, "expenses", expenseId), dataToSave);
            }
            
            toast.success(isEditing ? 'Spesa aggiornata!' : 'Spesa creata!', { id: toastId });
            handleCloseModal();
        } catch (error) {
            console.error("Errore nel salvare la spesa:", error);
            toast.error(error.message || 'Errore imprevisto.', { id: toastId });
        }
    }, [user.uid, user.name, handleCloseModal]);
    
    const handleDeleteExpense = useCallback(async (expense) => {
        if (!canEditOrDelete(expense)) {
            return toast.error("Non hai i permessi per eliminare questa spesa.");
        }
        
        if (!window.confirm(`Sei sicuro di voler eliminare la spesa "${expense.description}"?`)) return;
        
        const toastId = toast.loading("Eliminazione in corso...");
        
        try {
            if (expense.invoicePdfUrl) {
                const fileRef = ref(storage, expense.invoicePdfUrl);
                await deleteObject(fileRef).catch(err => console.warn("File non trovato:", err));
            }
            
            if (expense.contractPdfUrl) {
                const fileRef = ref(storage, expense.contractPdfUrl);
                await deleteObject(fileRef).catch(err => console.warn("File non trovato:", err));
            }
            
            await deleteDoc(doc(db, "expenses", expense.id));
            toast.success("Spesa eliminata!", { id: toastId });
        } catch (error) {
            console.error("Errore durante l'eliminazione della spesa:", error);
            toast.error("Errore durante l'eliminazione.", { id: toastId });
        }
    }, [canEditOrDelete]);
    
    const handleDuplicateExpense = useCallback((expense) => {
        const {
            id: _ID,
            invoicePdfUrl: _INVOICE_PDF_URL,
            contractPdfUrl: _CONTRACT_PDF_URL,
            createdAt: _CREATED_AT,
            updatedAt: _UPDATED_AT,
            authorId: _AUTHOR_ID,
            authorName: _AUTHOR_NAME,
            ...rest
        } = expense;
        setEditingExpense({ 
            ...rest, 
            description: `${expense.description || ''} (Copia)`, 
            date: new Date().toISOString().split('T')[0] 
        });
        setIsModalOpen(true);
    }, []);
    
    const savePreset = useCallback(() => {
        const name = presetName.trim();
        if (!name) {
            toast.error('Inserisci un nome per il preset');
            return;
        }
        const preset = {
            id: Date.now(),
            name,
            startDate: dateFilter.startDate,
            endDate: dateFilter.endDate,
            selectedSector,
            selectedBranch,
            supplierFilter,
            branchFilter,
            statusFilter,
            invoiceFilter,
            contractFilter,
            specialFilter,
            sortOrder
        };
        setFilterPresets(prev => {
            const withoutDuplicates = prev.filter(p => p.name.toLowerCase() !== name.toLowerCase());
            return [...withoutDuplicates, preset];
        });
        setPresetName('');
        toast.success('Preset salvato');
    }, [presetName, dateFilter.startDate, dateFilter.endDate, selectedSector, selectedBranch, supplierFilter, branchFilter, statusFilter, invoiceFilter, contractFilter, specialFilter, sortOrder]);

    const applyPreset = useCallback((preset) => {
        setDateFilter({
            startDate: preset.startDate || defaultStartDate,
            endDate: preset.endDate || defaultEndDate
        });
        setSelectedSector(preset.selectedSector || 'all');
        setSelectedBranch(preset.selectedBranch || 'all');
        setSupplierFilter(preset.supplierFilter || []);
        setBranchFilter(preset.branchFilter || []);
        setInvoiceFilter(preset.invoiceFilter || '');
        setContractFilter(preset.contractFilter || '');
        setStatusFilter(preset.statusFilter || 'all');
        setSpecialFilter(preset.specialFilter || null);
        setSortOrder(preset.sortOrder || 'date_desc');
        toast.success(`Preset "${preset.name}" applicato`);
    }, [defaultStartDate, defaultEndDate]);

    const deletePreset = useCallback((id) => {
        setFilterPresets(prev => prev.filter(p => p.id !== id));
        toast.success('Preset eliminato');
    }, []);
    
    const resetFilters = useCallback(() => {
        setSearchTerm('');
        setSupplierFilter([]);
        setDateFilter({ startDate: defaultStartDate, endDate: defaultEndDate });
        setSelectedSector('all');
        setSelectedBranch('all');
        setInvoiceFilter('');
        setContractFilter('');
        setBranchFilter([]);
        setSpecialFilter(null);
        setStatusFilter('all');
        setSortOrder('date_desc');
        setPresetName('');
        toast.success("Filtri resettati!");
    }, [defaultStartDate, defaultEndDate]);
    

    
    // Check filtri attivi
    const hasActiveFilters = Boolean(
        (searchTerm && searchTerm.trim().length > 0) ||
        supplierFilter.length > 0 ||
        (dateFilter.startDate && dateFilter.startDate !== defaultStartDate) ||
        (dateFilter.endDate && dateFilter.endDate !== defaultEndDate) ||
        selectedSector !== 'all' ||
        selectedBranch !== 'all' ||
        invoiceFilter ||
        contractFilter ||
        branchFilter.length > 0 ||
        specialFilter ||
        statusFilter !== 'all' ||
        sortOrder !== 'date_desc'
    );
    
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div className="text-xl font-semibold text-gray-700">Caricamento spese...</div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative">
            <div className="relative p-4 lg:p-8 space-y-6">
                {/* HERO & FILTERS */}
                <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl border border-white/20 p-6 lg:p-10">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_55%)]" />
                        <div className="relative flex flex-col gap-5">
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg shadow-indigo-900/30 ring-4 ring-white/25">
                                    <Wallet className="w-7 h-7 lg:w-8 lg:h-8" />
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.4em] text-white/70 font-semibold">Spese</p>
                                    <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black leading-tight">
                                        Centro di Controllo Spese
                                    </h1>
                                </div>
                            </div>
                            <p className="text-sm lg:text-base text-white/85 max-w-3xl">
                                Analizza le spese operative con gli stessi filtri condivisi della dashboard. Salva preset per riutilizzarli rapidamente nelle altre sezioni.
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleOpenAddModal}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 backdrop-blur-sm transition-all hover:bg-white/25"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    Nuova spesa
                                </button>
                                <span className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
                                    Aggiorna in tempo reale
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="w-full bg-gradient-to-br from-slate-50 via-white to-white backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-5 lg:p-6 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/15">
                                <SlidersHorizontal className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-black text-slate-900">Filtri Spesa</h2>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-bold text-indigo-700">
                                        <Info className="w-3 h-3" />
                                        Sincronizzati con la dashboard
                                    </span>
                                </div>
                                <p className="mt-1 text-sm font-medium text-slate-600">
                                    Definisci intervallo temporale, settore e filiale per uniformare la lettura dei dati economici.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex flex-col gap-3 lg:flex-row">
                                <div className="relative flex-1 min-w-[220px]">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Cerca per descrizione, fornitore, canale..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full h-12 rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium text-slate-700 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
                                    <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                        Periodo
                                    </span>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <input
                                            type="date"
                                            value={dateFilter.startDate}
                                            onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                                            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-600 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        />
                                        <span className="text-slate-400 font-semibold text-sm">→</span>
                                        <input
                                            type="date"
                                            value={dateFilter.endDate}
                                            onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                                            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-600 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                        Settori
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedSector('all')}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                                selectedSector === 'all'
                                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Layers className="w-4 h-4" />
                                            Tutti i Settori
                                        </button>
                                        {orderedSectors.map(sector => {
                                            const isActive = selectedSector === sector.id;
                                            return (
                                                <button
                                                    key={sector.id}
                                                    type="button"
                                                    onClick={() => setSelectedSector(sector.id)}
                                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                                        isActive
                                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {getSectorIcon(sector.name, `w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`)}
                                                    {sector.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                        Filiali
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedBranch('all')}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
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
                                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
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

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                                <div className="flex flex-col gap-3">
                                    <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                        Stato fattura
                                    </span>
                                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setInvoiceFilter('')}
                                            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                                                invoiceFilter === ''
                                                    ? 'bg-white text-slate-900 shadow'
                                                    : 'text-slate-500 hover:bg-slate-100'
                                            }`}
                                        >
                                            Tutte
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setInvoiceFilter('present')}
                                            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                                                invoiceFilter === 'present'
                                                    ? 'bg-indigo-100 text-indigo-700 shadow'
                                                    : 'text-slate-500 hover:bg-slate-100'
                                            }`}
                                        >
                                            Con fattura
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setInvoiceFilter('missing')}
                                            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                                                invoiceFilter === 'missing'
                                                    ? 'bg-rose-100 text-rose-600 shadow'
                                                    : 'text-slate-500 hover:bg-slate-100'
                                            }`}
                                        >
                                            Mancante
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                        Stato contratto
                                    </span>
                                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setContractFilter('')}
                                            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                                                contractFilter === ''
                                                    ? 'bg-white text-slate-900 shadow'
                                                    : 'text-slate-500 hover:bg-slate-100'
                                            }`}
                                        >
                                            Tutti
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setContractFilter('present')}
                                            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                                                contractFilter === 'present'
                                                    ? 'bg-indigo-100 text-indigo-700 shadow'
                                                    : 'text-slate-500 hover:bg-slate-100'
                                            }`}
                                        >
                                            Con contratto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setContractFilter('missing')}
                                            className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                                                contractFilter === 'missing'
                                                    ? 'bg-rose-100 text-rose-600 shadow'
                                                    : 'text-slate-500 hover:bg-slate-100'
                                            }`}
                                        >
                                            Mancante
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                        Stato documentazione
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSpecialFilter(null)}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${
                                                !specialFilter
                                                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-500/30'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            Tutte
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSpecialFilter('withissues')}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                                specialFilter === 'withissues'
                                                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <AlertTriangle className="w-4 h-4" />
                                            Documenti mancanti
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSpecialFilter('unassigned')}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                                specialFilter === 'unassigned'
                                                    ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/30'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <AlertTriangle className="w-4 h-4" />
                                            Senza filiale
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {hasActiveFilters && (
                                <div className="flex flex-wrap items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition-all hover:scale-105"
                                    >
                                        <X className="w-4 h-4" />
                                        Reset filtri
                                    </button>
                                </div>
                            )}

                            <div className="space-y-3">
                                <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                    Preset salvati
                                </span>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <input
                                        type="text"
                                        value={presetName}
                                        onChange={(e) => setPresetName(e.target.value)}
                                        placeholder="Nome preset (es. Q1 Board)"
                                        className="flex-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                    />
                                    <button
                                        type="button"
                                        onClick={savePreset}
                                        disabled={!presetName.trim()}
                                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Check className="w-4 h-4" />
                                        Salva preset
                                    </button>
                                </div>
                                {filterPresets.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {filterPresets.map(preset => (
                                            <div key={preset.id} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-1.5 shadow-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => applyPreset(preset)}
                                                    className="text-sm font-semibold text-slate-600 hover:text-indigo-600"
                                                >
                                                    {preset.name}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => deletePreset(preset.id)}
                                                    className="text-slate-400 transition-colors hover:text-rose-500"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs font-medium text-slate-400">
                                        Salva una combinazione di filtri per riutilizzarla rapidamente nelle altre pagine.
                                    </p>
                                )}
                            </div>

                            <div className="border-t border-slate-200 pt-4">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setStatusFilter('all')}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                                statusFilter === 'all'
                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            Tutte ({kpiData.totalExpenses})
                                        </button>
                                        {kpiData.incomplete > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setStatusFilter('incomplete')}
                                                className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 transition-all ${
                                                    statusFilter === 'incomplete'
                                                        ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/30'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                <AlertTriangle className="w-3 h-3" />
                                                Incomplete ({kpiData.incomplete})
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setStatusFilter('complete')}
                                            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 transition-all ${
                                                statusFilter === 'complete'
                                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                        >
                                            <CheckCircle2 className="w-3 h-3" />
                                            Complete ({kpiData.complete})
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <select
                                            value={sortOrder}
                                            onChange={(e) => setSortOrder(e.target.value)}
                                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                                        >
                                            <option value="date_desc">Data ↓</option>
                                            <option value="date_asc">Data ↑</option>
                                            <option value="amount_desc">Importo ↓</option>
                                            <option value="amount_asc">Importo ↑</option>
                                            <option value="name_asc">Nome A-Z</option>
                                            <option value="name_desc">Nome Z-A</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Cards migliorate */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 xl:gap-6">
                    <KpiCard 
                        title="Spese Totali" 
                        value={kpiData.totalExpenses.toString()}
                        subtitle={`${processedExpenses.length} spese filtrate`}
                        icon={<FileText className="w-6 h-6" />}
                        gradient="from-amber-500 to-orange-600"
                    />
                    <KpiCard 
                        title="Importo Totale" 
                        value={formatCurrency(kpiData.totalSpend)}
                        subtitle={`Budget: ${formatCurrency(kpiData.totalBudget)}`}
                        icon={<DollarSign className="w-6 h-6" />}
                        gradient="from-emerald-500 to-green-600"
                    />
                    <KpiCard 
                        title="Con Fattura" 
                        value={`${kpiData.withInvoicePercentage}%`}
                        subtitle="Documenti fiscali"
                        icon={<CheckCircle2 className="w-6 h-6" />}
                        gradient="from-blue-500 to-indigo-600"
                    />
                    <KpiCard 
                        title="Complete" 
                        value={`${kpiData.completePercentage}%`}
                        subtitle="Tutti i documenti"
                        icon={<Activity className="w-6 h-6" />}
                        gradient="from-purple-500 to-pink-600"
                    />
                </div>
                
                {/* Lista Spese */}
                {processedExpenses.length > 0 ? (
                    <ExpenseTableView
                        expenses={processedExpenses}
                        sectorMap={sectorMap}
                        supplierMap={supplierMap}
                        branchMap={branchMap}
                        contractMap={contractMap}
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteExpense}
                        onDuplicate={handleDuplicateExpense}
                        canEditOrDelete={canEditOrDelete}
                    />
                ) : (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-12 text-center">
                        <div className="p-4 rounded-2xl bg-amber-100 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                            <Search className="w-8 h-8 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Nessuna Spesa Trovata</h3>
                        <p className="text-gray-600 mb-6">Non ci sono spese che corrispondono ai filtri selezionati.</p>
                        {hasActiveFilters && (
                            <button 
                                onClick={resetFilters}
                                className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                            >
                                Resetta Filtri
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            {/* Modali */}
            {isModalOpen && (
                <ExpenseFormModal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    onSave={handleSaveExpense} 
                    initialData={editingExpense} 
                    sectors={sectors} 
                    branches={branches} 
                    suppliers={suppliers} 
                    marketingChannels={marketingChannels} 
                    contracts={contracts} 
                    geographicAreas={geographicAreas} 
                />
            )}
            
        </div>
    );
}
