import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import {
    X,
    XCircle,
    DollarSign,
    Target,
    Layers,
    Search,
    Car,
    Sailboat,
    Caravan,
    Building2,
    Settings,
    Percent,
    TrendingUp,
    AlertTriangle,
    ArrowUpDown,
    MapPin,
    Calendar,
    Check,
    SlidersHorizontal,
    Info,
    Bell
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { getSectorColor } from '../constants/sectorColors';
import BudgetAllocationModal from '../components/BudgetAllocationModal';
import { KpiCard } from '../components/SharedComponents';
import { loadFilterPresets, persistFilterPresets } from '../utils/filterPresets';
import { DEFAULT_COST_DOMAIN } from '../constants/costDomains';
import { getTooltipContainerClass } from '../utils/chartTooltipStyles';

const formatDateInput = (year, month, day) => new Date(Date.UTC(year, month, day)).toISOString().split('T')[0];

const BudgetDateRangeDropdown = ({
    isOpen,
    setIsOpen,
    startDate,
    endDate,
    onChange,
    hasActiveRange,
    onClear,
    onToggle
}) => {
    const formatDateLabel = (value) => {
        if (!value) return '—';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return parsed.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const label = hasActiveRange
        ? `${formatDateLabel(startDate)} → ${formatDateLabel(endDate)}`
        : 'Seleziona periodo';

    return (
        <div className="relative">
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
            <button
                type="button"
                onClick={() => {
                    if (onToggle) {
                        onToggle();
                    }
                    setIsOpen(prev => !prev);
                }}
                aria-expanded={isOpen}
                className={`inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm shadow-emerald-100/40 transition hover:border-emerald-300 hover:text-emerald-600 ${
                    hasActiveRange ? 'ring-2 ring-emerald-200' : ''
                }`}
            >
                <Calendar className="h-4 w-4 text-emerald-400" />
                <span>{label}</span>
                <ArrowUpDown
                    className={`h-4 w-4 text-emerald-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[calc(100vw-3rem)] max-w-xs rounded-3xl border border-white/60 bg-white/95 p-4 shadow-2xl shadow-emerald-900/25 backdrop-blur">
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-500">
                                intervallo temporale
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                                Definisci il periodo di analisi per budget e proiezioni.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                                Da
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(event) =>
                                        onChange({
                                            startDate: event.target.value,
                                            endDate
                                        })
                                    }
                                    className="rounded-xl border border-emerald-200 bg-white px-2 py-2 text-xs font-semibold text-emerald-700 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                                A
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(event) =>
                                        onChange({
                                            startDate,
                                            endDate: event.target.value
                                        })
                                    }
                                    className="rounded-xl border border-emerald-200 bg-white px-2 py-2 text-xs font-semibold text-emerald-700 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                                />
                            </label>
                        </div>
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={onClear}
                                className="text-xs font-semibold text-emerald-400 transition hover:text-rose-500"
                            >
                                Pulisci
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-100"
                            >
                                <Check className="h-3.5 w-3.5" />
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SupplierTableView = ({ suppliers, onManage, sectorMap, showProjections, sortConfig, onSort }) => {
    const columns = [
        { key: "supplier", label: "Fornitore", className: "px-4 py-3 text-left", sortable: true },
        { key: "sector", label: "Settori", className: "px-4 py-3 text-left hidden lg:table-cell", sortable: true },
        { key: "utilization", label: "Utilizzo", className: "px-4 py-3 text-left hidden md:table-cell", sortable: true },
        { key: "budget", label: "Budget", className: "px-4 py-3 text-right", sortable: true },
        { key: "spend", label: "Speso", className: "px-4 py-3 text-right", sortable: true },
    ];
    if (showProjections) {
        columns.push({ key: "overdue", label: "Scaduto", className: "px-4 py-3 text-right", sortable: true });
        columns.push({ key: "forecast", label: "Proiezioni", className: "px-4 py-3 text-right", sortable: true });
    }
    columns.push({ key: "actions", label: "Azioni", className: "px-4 py-3 text-center", sortable: false });

    const handleSort = (key) => {
        if (typeof onSort === "function") {
            onSort(key);
        }
    };

    const renderIndicator = (columnKey) => {
        const isActive = sortConfig?.key === columnKey;
        const direction = sortConfig?.direction || "asc";
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 12 12"
                className={`h-3 w-3 text-white transition-opacity ${isActive ? "opacity-100" : "opacity-40"}`}
            >
                <path
                    d={direction === "asc" ? "M6 2l3.5 4h-7L6 2z" : "M6 10l-3.5-4h7L6 10z"}
                    fill="currentColor"
                />
            </svg>
        );
    };

    return (
        <div className="overflow-hidden rounded-3xl border border-white/30 bg-white/95 shadow-xl shadow-slate-200/60">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-700">
                    <thead className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white uppercase text-[11px] font-bold tracking-[0.16em]">
                        <tr>
                            {columns.map((column) => {
                                if (!column.sortable) {
                                    return (
                                        <th key={column.key} className={column.className}>
                                            {column.label}
                                        </th>
                                    );
                                }

                                const isActive = sortConfig?.key === column.key;
                                const direction = sortConfig?.direction || 'asc';
                                const isRightAligned = column.className.includes('text-right');

                                return (
                                    <th
                                        key={column.key}
                                        className={column.className}
                                        aria-sort={
                                            isActive
                                                ? direction === 'asc'
                                                    ? 'ascending'
                                                    : 'descending'
                                                : 'none'
                                        }
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleSort(column.key)}
                                            className={`group flex w-full items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/90 transition hover:text-white ${
                                                isRightAligned ? 'justify-end' : 'justify-start'
                                            }`}
                                        >
                                            <span className="truncate">{column.label}</span>
                                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-white group-hover:bg-white/20">
                                                {renderIndicator(column.key)}
                                            </span>
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                <tbody className="divide-y divide-slate-100">
                    {suppliers.map((supplier) => {
                        const budgetValue = supplier.displayBudget || 0;
                        const spendPercent = budgetValue > 0
                            ? (supplier.displaySpend / budgetValue) * 100
                            : 0;
                        const overdueAmount = supplier.overdue || 0;
                        const sectorNames = (supplier.associatedSectors || []).map(id => sectorMap.get(id)).filter(Boolean);
                        const futureAmount = supplier.projections || 0;
                        const overduePercent = budgetValue > 0
                            ? (overdueAmount / budgetValue) * 100
                            : 0;
                        const totalPercent = spendPercent + overduePercent;
                        const spendWidth = Math.min(Math.max(spendPercent, 0), 100);
                        const overdueWidth = Math.min(
                            Math.max(overduePercent, 0),
                            Math.max(0, 100 - spendWidth)
                        );
                        const isOverrun = totalPercent >= 101;
                        const hasMeaningfulOverdue = overduePercent >= 0.5;
                        const utilizationLabel = hasMeaningfulOverdue
                            ? `${Math.round(spendPercent)}% + ${Math.round(overduePercent)}%`
                            : `${Math.round(totalPercent)}%`;

                        return (
                            <tr key={supplier.id} className="bg-white/80 hover:bg-emerald-50/30 transition-colors">
                                <td className="px-4 py-3">
                                    <p className="min-w-0 max-w-xs truncate font-semibold text-slate-900">{supplier.name || 'N/D'}</p>
                                </td>
                                <td className="px-4 py-3 hidden lg:table-cell text-sm text-slate-600">
                                    {sectorNames.length > 0 ? sectorNames.join(', ') : '—'}
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                    {supplier.displayBudget > 0 ? (
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="relative h-[10px] w-40 rounded-full bg-slate-200/60 shadow-inner shadow-slate-300/60 overflow-hidden"
                                                role="progressbar"
                                                aria-valuenow={Math.round(Math.min(totalPercent, 130))}
                                                aria-valuemin={0}
                                                aria-valuemax={100}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-transparent to-white/30 pointer-events-none" />
                                                {isOverrun ? (
                                                    <div
                                                        className="absolute inset-y-0 left-0 z-[2] rounded-full bg-gradient-to-r from-rose-500 via-rose-600 to-rose-700 transition-all duration-500 ease-out"
                                                        style={{ width: '100%' }}
                                                    />
                                                ) : (
                                                    <>
                                                        <div
                                                            className="absolute inset-y-0 left-0 z-[1] rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 transition-all duration-500 ease-out"
                                                            style={{ width: `${spendWidth}%` }}
                                                        />
                                                        <div
                                                            className="absolute inset-y-0 z-[2] rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 transition-all duration-500 ease-out"
                                                            style={{
                                                                left: `${spendWidth}%`,
                                                                width: `${overdueWidth}%`
                                                            }}
                                                        />
                                                    </>
                                                )}
                                                <div className="absolute inset-0 z-[5] rounded-full border border-white/30" aria-hidden="true" />
                                            </div>
                                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${isOverrun ? 'text-rose-600' : 'text-slate-600'}`}>
                                                {isOverrun && (
                                                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                                                )}
                                                {utilizationLabel}
                                            </span>
                                        </div>
                                    ) : supplier.displaySpend > 0 ? (
                                        <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-600 shadow-sm shadow-amber-100/40">
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                                            Extra Budget
                                        </span>
                                    ) : (
                                        <span className="text-xs font-semibold text-slate-400">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                                    {formatCurrency(supplier.displayBudget)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                                    {formatCurrency(supplier.displaySpend)}
                                </td>
                                {showProjections && (
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                                        {overdueAmount > 0 ? formatCurrency(overdueAmount) : '—'}
                                    </td>
                                )}
                                {showProjections && (
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                                        {futureAmount > 0 ? formatCurrency(futureAmount) : '—'}
                                    </td>
                                )}
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={() => onManage(supplier)}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-600 transition-all hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                                        title="Gestisci allocazione"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </button>
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

const formatCurrency = (value) => (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

export default function BudgetPage() {
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [startDate, setStartDate] = useState(() => {
        const currentYear = new Date().getFullYear();
        return formatDateInput(currentYear, 0, 1);
    });
    const [endDate, setEndDate] = useState(() => {
        const currentYear = new Date().getFullYear();
        return formatDateInput(currentYear, 11, 31);
    });
    const [summaries, setSummaries] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [allExpenses, setAllExpenses] = useState([]); // NUOVO: per calcolare contractSpentMap
    const [suppliers, setSuppliers] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [sectorBudgets, setSectorBudgets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [selectedSector, setSelectedSector] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [searchTerm, setSearchTerm] = useState("");
    const showProjections = true;
    const [sortConfig, setSortConfig] = useState({ key: 'spend', direction: 'desc' });
    const [filterPresets, setFilterPresets] = useState(() =>
        loadFilterPresets().map(preset => {
            const {
                showProjections: _ignoredShow,
                supplierFilter: _ignoredSuppliers,
                sortOrder: _ignoredSort,
                ...rest
            } = preset;
            return rest;
        })
    );
    const [presetName, setPresetName] = useState('');
    const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
    const [isFiltersPresetPanelOpen, setIsFiltersPresetPanelOpen] = useState(false);
    const [isDatePanelOpen, setIsDatePanelOpen] = useState(false);
    const marketingExpenses = useMemo(
        () =>
            allExpenses.filter(
                expense => (expense.costDomain || DEFAULT_COST_DOMAIN) === DEFAULT_COST_DOMAIN
            ),
        [allExpenses]
    );

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);

    const defaultStartDate = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return formatDateInput(currentYear, 0, 1);
    }, []);

    const defaultEndDate = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return formatDateInput(currentYear, 11, 31);
    }, []);

    const hasActiveFilters = useMemo(() => {
        return startDate !== defaultStartDate ||
            endDate !== defaultEndDate ||
            selectedSector !== 'all' ||
            selectedBranch !== 'all' ||
            !showProjections ||
            searchTerm.trim() !== '';
    }, [startDate, endDate, selectedSector, selectedBranch, showProjections, searchTerm, defaultStartDate, defaultEndDate]);

    const filtersLoaded = useRef(false);
    useEffect(() => {
        if (filtersLoaded.current) {
            persistFilterPresets(filterPresets);
        } else {
            filtersLoaded.current = true;
        }
    }, [filterPresets]);


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

    const orderedBranches = useMemo(() => {
        return [...branches].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [branches]);

    useEffect(() => {
        const endYear = new Date(endDate).getFullYear();
        if (!Number.isNaN(endYear) && endYear !== year) {
            setYear(endYear);
        }
    }, [endDate, year]);

    useEffect(() => {
        setIsLoading(true);
        let staticDataLoaded = 0;
        const onStaticDataLoad = () => { 
            staticDataLoaded++; 
            if (staticDataLoaded >= 2) setIsLoading(false); 
        };
        
        const unsubSummaries = onSnapshot(query(collection(db, "budget_summaries"), where("year", "==", year)), snap => setSummaries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubContracts = onSnapshot(query(collection(db, "contracts")), snap => setContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubExpenses = onSnapshot(query(collection(db, "expenses")), snap => setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))); // NUOVO
        const unsubSectors = onSnapshot(query(collection(db, "sectors")), snap => { setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); onStaticDataLoad(); });
        const unsubSuppliers = onSnapshot(
            query(collection(db, "channels")),
            snap => {
                const orderedSuppliers = snap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setSuppliers(orderedSuppliers);
                onStaticDataLoad();
            }
        );
        const unsubBranches = onSnapshot(collection(db, "branches"), snap => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubMarketingChannels = onSnapshot(collection(db, "marketing_channels"), snap => setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubSectorBudgets = onSnapshot(query(collection(db, "sector_budgets"), where("year", "==", year)), snap => setSectorBudgets(snap.docs.map(doc => doc.data())));
        
        return () => { 
            unsubSummaries(); 
            unsubContracts();
            unsubExpenses(); // NUOVO
            unsubSuppliers(); 
            unsubSectors(); 
            unsubBranches(); 
            unsubMarketingChannels(); 
            unsubSectorBudgets(); 
        };
    }, [year]);

    // LOGICA CORRETTA: Calcolo proiezioni come nella Dashboard
    const contractProjections = useMemo(() => {
        if (contracts.length === 0) {
            return { futureBySupplierId: {}, futureBySectorId: {}, overdueBySupplierId: {} };
        }

        const filterStartDate = (() => {
            if (startDate) {
                const d = new Date(startDate);
                d.setHours(0, 0, 0, 0);
                return d;
            }
            return new Date(year, 0, 1);
        })();

        const filterEndDate = (() => {
            if (endDate) {
                const d = new Date(endDate);
                d.setHours(23, 59, 59, 999);
                return d;
            }
            return new Date(year, 11, 31, 23, 59, 59);
        })();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayMs = 24 * 60 * 60 * 1000;

        const normalizeDate = (value) => {
            if (!value) return null;
            const parsed = new Date(value);
            if (isNaN(parsed)) return null;
            parsed.setHours(0, 0, 0, 0);
            return parsed;
        };

        const contractSpentMap = new Map();
        const lineItemSpentTotal = new Map();
        const lineItemSpentUpToToday = new Map();
        const fallbackContractSpent = new Map();
        const fallbackContractSpentUpToToday = new Map();

        marketingExpenses.forEach(expense => {
            const expenseDate = normalizeDate(expense.date);
            (expense.lineItems || []).forEach(item => {
                if (item.relatedContractId) {
                    const currentSpent = contractSpentMap.get(item.relatedContractId) || 0;
                    const amount = parseFloat(item.amount) || 0;
                    contractSpentMap.set(item.relatedContractId, currentSpent + amount);

                    const lineItemId = item.relatedLineItemId || item.lineItemId || item._key || null;
                    if (lineItemId) {
                        lineItemSpentTotal.set(lineItemId, (lineItemSpentTotal.get(lineItemId) || 0) + amount);
                        if (expenseDate && expenseDate <= today) {
                            lineItemSpentUpToToday.set(lineItemId, (lineItemSpentUpToToday.get(lineItemId) || 0) + amount);
                        }
                    } else {
                        fallbackContractSpent.set(item.relatedContractId, (fallbackContractSpent.get(item.relatedContractId) || 0) + amount);
                        if (expenseDate && expenseDate <= today) {
                            fallbackContractSpentUpToToday.set(item.relatedContractId, (fallbackContractSpentUpToToday.get(item.relatedContractId) || 0) + amount);
                        }
                    }
                }
            });
            if (expense.relatedContractId) {
                const amount = parseFloat(expense.amount) || 0;
                const currentSpent = contractSpentMap.get(expense.relatedContractId) || 0;
                contractSpentMap.set(expense.relatedContractId, currentSpent + amount);
                fallbackContractSpent.set(expense.relatedContractId, (fallbackContractSpent.get(expense.relatedContractId) || 0) + amount);
                if (expenseDate && expenseDate <= today) {
                    fallbackContractSpentUpToToday.set(expense.relatedContractId, (fallbackContractSpentUpToToday.get(expense.relatedContractId) || 0) + amount);
                }
            }
        });

        const futureBySupplierId = {};
        const futureBySectorId = {};
        const overdueBySupplierId = {};

        contracts.forEach(contract => {
            const totalContractValue = (contract.lineItems || []).reduce((sum, li) => sum + (parseFloat(li.totalAmount) || 0), 0);
            const totalSpentOnContract = contractSpentMap.get(contract.id) || 0;
            const remainingContractValue = Math.max(0, totalContractValue - totalSpentOnContract);

            if (remainingContractValue <= 0) return;

            const supplierFallback = contract.supplierId || contract.supplierld;
            const contractFallbackTotal = fallbackContractSpent.get(contract.id) || 0;
            const contractFallbackUpToToday = fallbackContractSpentUpToToday.get(contract.id) || 0;

            (contract.lineItems || []).forEach(lineItem => {
                const supplierId = lineItem.supplierId || lineItem.supplierld || supplierFallback;
                const sectorId = lineItem.sectorId || lineItem.sectorld;

                if (!supplierId) return;

                const lineItemTotal = parseFloat(lineItem.totalAmount) || 0;
                if (lineItemTotal <= 0 || !lineItem.startDate || !lineItem.endDate) return;

                const lineItemProportion = totalContractValue > 0 ? lineItemTotal / totalContractValue : 0;

                const lineItemId = lineItem.id || lineItem.lineItemId || lineItem._key || null;
                const start = normalizeDate(lineItem.startDate);
                const end = normalizeDate(lineItem.endDate);
                if (!start || !end) return;

                let spentTotal = lineItemId ? (lineItemSpentTotal.get(lineItemId) || 0) : 0;
                let spentUpToToday = lineItemId ? (lineItemSpentUpToToday.get(lineItemId) || 0) : 0;

                if (!lineItemId) {
                    spentTotal += contractFallbackTotal * lineItemProportion;
                    spentUpToToday += contractFallbackUpToToday * lineItemProportion;
                }

                let remaining = Math.max(0, lineItemTotal - spentTotal);
                if (remaining <= 0) return;

                const overlapStart = new Date(Math.max(start.getTime(), filterStartDate.getTime()));
                const overlapEnd = new Date(Math.min(end.getTime(), filterEndDate.getTime()));
                if (overlapEnd < overlapStart) return;

                const totalDays = Math.max(1, Math.round((end - start) / dayMs) + 1);
                const dailyAmount = lineItemTotal / totalDays;

                let adjustedSpentUpToToday = spentUpToToday;
                if (start < overlapStart) {
                    const preOverlapDays = Math.max(0, Math.round((overlapStart - start) / dayMs));
                    const expectedPreOverlap = dailyAmount * preOverlapDays;
                    adjustedSpentUpToToday = Math.max(0, adjustedSpentUpToToday - expectedPreOverlap);
                }

                const overlapTotalDays = Math.max(1, Math.round((overlapEnd - overlapStart) / dayMs) + 1);
                const overlapPotential = dailyAmount * overlapTotalDays;
                adjustedSpentUpToToday = Math.min(adjustedSpentUpToToday, overlapPotential);

                let overdueDays = 0;
                if (today >= overlapStart) {
                    const overdueEnd = today < overlapEnd ? today : overlapEnd;
                    overdueDays = Math.max(0, Math.round((overdueEnd - overlapStart) / dayMs) + 1);
                    overdueDays = Math.min(overdueDays, overlapTotalDays);
                }

                const futureDays = Math.max(0, overlapTotalDays - overdueDays);
                const expectedOverlapSpentToDate = dailyAmount * overdueDays;
                const overdueShortfall = Math.max(0, expectedOverlapSpentToDate - Math.min(adjustedSpentUpToToday, expectedOverlapSpentToDate));
                const overdueAmount = Math.min(remaining, overdueShortfall);

                remaining = Math.max(0, remaining - overdueAmount);
                const futurePotential = dailyAmount * futureDays;
                const futureAmount = Math.max(0, Math.min(remaining, futurePotential));

                if (futureAmount > 0) {
                    futureBySupplierId[supplierId] = (futureBySupplierId[supplierId] || 0) + futureAmount;
                    if (sectorId) {
                        futureBySectorId[sectorId] = (futureBySectorId[sectorId] || 0) + futureAmount;
                    }
                }

                if (overdueAmount > 0) {
                    overdueBySupplierId[supplierId] = (overdueBySupplierId[supplierId] || 0) + overdueAmount;
                }
            });
        });

        return { futureBySupplierId, futureBySectorId, overdueBySupplierId };
    }, [contracts, marketingExpenses, startDate, endDate, year]);

    const displayData = useMemo(() => {
        let enriched = summaries.map(summary => {
            const supplierInfo = supplierMap.get(summary.supplierId);
            const details = summary.details || [];
            const projections = contractProjections.futureBySupplierId[summary.supplierId] || 0;
            const overdue = contractProjections.overdueBySupplierId[summary.supplierId] || 0;

            let displayDetails = [...details];

            if (selectedSector !== 'all') {
                displayDetails = displayDetails.filter(d => d.sectorId === selectedSector);
            }

            if (selectedBranch !== 'all') {
                displayDetails = displayDetails.filter(d => (d.branchId || '') === selectedBranch);
            }

            let displaySpend = 0;
            let displayBudget = 0;

            if (selectedSector === 'all' && selectedBranch === 'all') {
                displaySpend = summary.totalSpend;
                displayBudget = summary.totalBudget;
            } else {
                displaySpend = displayDetails.reduce((sum, d) => sum + (d.detailedSpend || 0), 0);
                displayBudget = displayDetails.reduce((sum, d) => sum + (d.budgetAmount || 0), 0);
            }
            
            return { 
                ...summary, 
                ...supplierInfo, 
                displaySpend, 
                displayBudget, 
                displayDetails,
                projections,
                overdue
            };
        });

        let baseFiltered = enriched.filter(s => s.displaySpend > 0 || s.displayBudget > 0 || s.projections > 0 || s.overdue > 0);
        
        if (selectedSector !== 'all' && baseFiltered.length > 0) {
            baseFiltered = baseFiltered.filter(s => {
                const supplierInfo = supplierMap.get(s.supplierId);
                return supplierInfo?.associatedSectors?.includes(selectedSector);
            });
        }

        if (selectedBranch !== 'all') {
            baseFiltered = baseFiltered.filter(s => (s.displayDetails || []).length > 0);
        }
        
        if (searchTerm.trim() !== '') {
            baseFiltered = baseFiltered.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        const filtered = [...baseFiltered];

        const { key: sortKey = 'spend', direction = 'desc' } = sortConfig || {};
        const directionMultiplier = direction === 'asc' ? 1 : -1;

        const getSectorNames = (item) => {
            return (item.associatedSectors || [])
                .map(id => sectorMap.get(id))
                .filter(Boolean)
                .join(', ') || '';
        };

        const getUtilization = (item) => {
            if (item.displayBudget > 0) {
                return (item.displaySpend / item.displayBudget) * 100;
            }
            return 0;
        };

        const getSortValue = (item, key) => {
            switch (key) {
                case 'supplier':
                    return (item.name || '').toLowerCase();
                case 'sector':
                    return getSectorNames(item).toLowerCase();
                case 'budget':
                    return item.displayBudget || 0;
                case 'spend':
                    return item.displaySpend || 0;
                case 'overdue':
                    return item.overdue || 0;
                case 'forecast':
                    return item.projections || 0;
                case 'utilization':
                    return getUtilization(item);
                default:
                    return (item.name || '').toLowerCase();
            }
        };

        return filtered.sort((a, b) => {
            const aValue = getSortValue(a, sortKey);
            const bValue = getSortValue(b, sortKey);

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                const difference = aValue - bValue;
                if (difference === 0) {
                    return directionMultiplier * (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base' });
                }
                return difference * directionMultiplier;
            }

            return directionMultiplier * String(aValue ?? '').localeCompare(String(bValue ?? ''), 'it', { sensitivity: 'base' });
        });
    }, [
        summaries,
        supplierMap,
        selectedSector,
        selectedBranch,
        searchTerm,
        contractProjections,
        sortConfig,
        sectorMap
    ]);

    const supplierBarPalette = useMemo(
        () => ['#10B981', '#059669', '#047857', '#14B8A6', '#22D3EE', '#2DD4BF'],
        []
    );

    const supplierBarData = useMemo(() => {
        return displayData
            .filter(item => (item.displaySpend || 0) > 0 || (showProjections && ((item.overdue || 0) > 0)))
            .slice(0, 6)
            .map((item, index) => ({
                id: item.supplierId || item.id || index,
                name: item.name || 'N/D',
                spend: item.displaySpend || 0,
                overdue: showProjections ? (item.overdue || 0) : 0,
                budget: item.displayBudget || 0,
                color: supplierBarPalette[index % supplierBarPalette.length]
            }));
    }, [displayData, showProjections, supplierBarPalette]);

    const sectorDistributionData = useMemo(() => {
        const totals = new Map();

        displayData.forEach(item => {
            const details = Array.isArray(item.displayDetails) ? item.displayDetails : [];

            if (details.length > 0) {
                details.forEach(detail => {
                    const sectorId = detail.sectorId || item.associatedSectors?.[0];
                    if (!sectorId) return;
                    const amount = detail.detailedSpend || detail.spend || 0;
                    if (amount <= 0) return;
                    totals.set(sectorId, (totals.get(sectorId) || 0) + amount);
                });
            } else if (Array.isArray(item.associatedSectors) && item.associatedSectors.length > 0) {
                const share = (item.displaySpend || 0) / item.associatedSectors.length;
                if (share <= 0) return;
                item.associatedSectors.forEach(sectorId => {
                    if (!sectorId) return;
                    totals.set(sectorId, (totals.get(sectorId) || 0) + share);
                });
            } else if ((item.displaySpend || 0) > 0) {
                totals.set('unassigned', (totals.get('unassigned') || 0) + item.displaySpend);
            }
        });

        return Array.from(totals.entries())
            .map(([sectorId, value], index) => {
                const name = sectorId === 'unassigned'
                    ? 'Non classificato'
                    : (sectorMap.get(sectorId) || 'Non classificato');
                return {
                    id: sectorId,
                    name,
                    value,
                    color: getSectorColor(name, index)
                };
            })
            .filter(entry => entry.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [displayData, sectorMap]);

    const sectorDistributionTotal = useMemo(
        () => sectorDistributionData.reduce((sum, entry) => sum + entry.value, 0),
        [sectorDistributionData]
    );

    const renderSupplierTooltip = useCallback(({ active, payload }) => {
        if (!active || !payload || payload.length === 0) {
            return null;
        }

        const spendEntry = payload.find(item => item.dataKey === 'spend');
        const overdueEntry = payload.find(item => item.dataKey === 'overdue');
        const budget = payload[0]?.payload?.budget || 0;
        const total = (payload[0]?.payload?.spend || 0) + (payload[0]?.payload?.overdue || 0);

        return (
            <div className={getTooltipContainerClass('emerald')}>
                <p className="text-sm font-bold text-slate-900">
                    {payload[0]?.payload?.name}
                </p>
                <div className="mt-2 space-y-1 text-xs font-semibold text-slate-600">
                    <div className="flex items-center justify-between gap-6">
                        <span className="flex items-center gap-2 text-emerald-600">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            Speso
                        </span>
                        <span>{formatCurrency(spendEntry?.value || 0)}</span>
                    </div>
                    {showProjections && (
                        <div className="flex items-center justify-between gap-6">
                            <span className="flex items-center gap-2 text-amber-600">
                                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                                Scaduto
                            </span>
                            <span>{formatCurrency(overdueEntry?.value || 0)}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between gap-6">
                        <span className="flex items-center gap-2 text-slate-500">
                            <span className="inline-block h-2 w-2 rounded-full bg-slate-300" />
                            Budget
                        </span>
                        <span>{formatCurrency(budget)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-6 border-t border-slate-100 pt-2">
                        <span className="text-slate-500">Totale</span>
                        <span className="text-slate-900">{formatCurrency(total)}</span>
                    </div>
                </div>
            </div>
        );
    }, [showProjections]);

    const renderSectorTooltip = useCallback(({ active, payload }) => {
        if (!active || !payload || payload.length === 0) {
            return null;
        }

        const entry = payload[0]?.payload;
        if (!entry) return null;

        const percentage = sectorDistributionTotal > 0
            ? ((entry.value / sectorDistributionTotal) * 100).toFixed(1)
            : '0.0';

        return (
            <div className={getTooltipContainerClass('emerald')}>
                <p className="text-sm font-bold text-slate-900">
                    {entry.name}
                </p>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                    {formatCurrency(entry.value)} · {percentage}%
                </p>
            </div>
        );
    }, [sectorDistributionTotal]);

    const budgetAlerts = useMemo(() => {
        if (displayData.length === 0) return [];

        const suppliersWithForecast = displayData.map(supplier => {
            const forecast = supplier.displaySpend + (showProjections ? ((supplier.projections || 0) + (supplier.overdue || 0)) : 0);
            const overAmount = forecast - (supplier.displayBudget || 0);
            return {
                supplier,
                forecast,
                overAmount
            };
        });

        const alerts = [];

        const overBudgetSuppliers = suppliersWithForecast.filter(item => (item.supplier.displayBudget || 0) > 0 && item.overAmount > 0.01);
        if (overBudgetSuppliers.length > 0) {
            const totalOverrun = overBudgetSuppliers.reduce((sum, item) => sum + item.overAmount, 0);
            alerts.push({
                key: 'overBudget',
                type: 'critical',
                title: `${overBudgetSuppliers.length} fornitori oltre budget`,
                description: 'Valuta una riallocazione o riduci la spesa prevista.',
                totalLabel: 'Sforamento complessivo',
                totalAmount: totalOverrun,
                items: overBudgetSuppliers
                    .sort((a, b) => b.overAmount - a.overAmount)
                    .slice(0, 6)
                    .map(item => ({
                        id: item.supplier.supplierId || item.supplier.id,
                        name: item.supplier.name || 'N/D',
                        amount: item.overAmount,
                        forecast: item.forecast
                    }))
            });
        }

        const unbudgetedSuppliers = suppliersWithForecast.filter(item => (item.supplier.displayBudget || 0) <= 0 && item.forecast > 0);
        if (unbudgetedSuppliers.length > 0) {
            const totalUnbudgeted = unbudgetedSuppliers.reduce((sum, item) => sum + item.forecast, 0);
            alerts.push({
                key: 'unbudgeted',
                type: 'warning',
                title: `${unbudgetedSuppliers.length} fornitori senza budget allocato`,
                description: 'Assegna un budget per allineare la spesa registrata.',
                totalLabel: 'Spesa non allocata',
                totalAmount: totalUnbudgeted,
                items: unbudgetedSuppliers
                    .sort((a, b) => b.forecast - a.forecast)
                    .slice(0, 6)
                    .map(item => ({
                        id: item.supplier.supplierId || item.supplier.id,
                        name: item.supplier.name || 'N/D',
                        amount: item.forecast
                    }))
            });
        }

        return alerts;
    }, [displayData, showProjections]);
    
    const globalKpis = useMemo(() => {
        const totalSpend = displayData.reduce((sum, item) => sum + item.displaySpend, 0);
        const totalFutureProjections = displayData.reduce((sum, item) => sum + (item.projections || 0), 0);
        const totalOverdueProjections = displayData.reduce((sum, item) => sum + (item.overdue || 0), 0);
        
        let totalMasterBudget = 0;
        if (selectedSector === 'all') {
            totalMasterBudget = sectorBudgets.reduce((sum, item) => sum + (item.maxAmount || 0), 0);
        } else {
            const budgetInfo = sectorBudgets.find(b => b.sectorId === selectedSector);
            totalMasterBudget = budgetInfo?.maxAmount || 0;
        }
        
        const totalAllocatedBudget = displayData.reduce((sum, item) => sum + item.displayBudget, 0);
        const projectionsCombined = totalFutureProjections + totalOverdueProjections;
        const totalForecast = totalSpend + (showProjections ? projectionsCombined : 0);
        const utilizationPercentage = totalMasterBudget > 0 ? (totalForecast / totalMasterBudget) * 100 : 0;
        const hasOverrunRisk = showProjections && totalForecast > totalMasterBudget;
        
        return { totalSpend, totalFutureProjections, totalOverdueProjections, totalMasterBudget, totalAllocatedBudget, utilizationPercentage, totalForecast, hasOverrunRisk };
    }, [displayData, sectorBudgets, selectedSector, showProjections]);
    
    const kpiCards = useMemo(() => {
        const supplierCount = displayData.length;
        const utilizationPct = globalKpis.totalMasterBudget > 0
            ? Math.round((globalKpis.totalForecast / globalKpis.totalMasterBudget) * 100)
            : 0;
        const utilizationTrend = globalKpis.totalForecast >= globalKpis.totalMasterBudget ? 'up' : 'down';

        return [
            {
                key: 'spesa',
                title: 'Spesa Effettiva',
                value: formatCurrency(globalKpis.totalSpend),
                subtitle: supplierCount > 0 ? `${supplierCount} fornitori monitorati` : 'Nessun fornitore filtrato',
                icon: <DollarSign className="w-6 h-6" />,
                gradient: 'from-emerald-500 to-green-600'
            },
            {
                key: 'allocato',
                title: 'Budget Allocato',
                value: formatCurrency(globalKpis.totalAllocatedBudget),
                subtitle: 'Distribuito sui canali attivi',
                icon: <Target className="w-6 h-6" />,
                gradient: 'from-emerald-400 to-lime-500'
            },
            {
                key: 'forecast',
                title: 'Forecast Totale',
                value: formatCurrency(globalKpis.totalForecast),
                subtitle: showProjections ? 'Incluse proiezioni contrattuali' : 'Solo spesa registrata',
                icon: <TrendingUp className="w-6 h-6" />,
                gradient: 'from-teal-500 to-cyan-500'
            },
            {
                key: 'master',
                title: 'Master Budget',
                value: formatCurrency(globalKpis.totalMasterBudget),
                subtitle: 'Cap residuo organizzativo',
                icon: <Percent className="w-6 h-6" />,
                gradient: 'from-emerald-600 to-slate-700',
                trend: globalKpis.totalMasterBudget > 0 ? {
                    direction: utilizationTrend,
                    value: `${utilizationPct}%`
                } : undefined
            }
        ];
    }, [globalKpis, showProjections, displayData.length]);
    const globalOverrunAmount = useMemo(() => {
        const forecast = globalKpis.totalForecast || 0;
        const master = globalKpis.totalMasterBudget || 0;
        return forecast > master ? forecast - master : 0;
    }, [globalKpis.totalForecast, globalKpis.totalMasterBudget]);
    const totalBudgetAlertsAmount = useMemo(
        () => budgetAlerts.reduce((sum, alert) => sum + (alert.totalAmount || 0), 0),
        [budgetAlerts]
    );
    const notificationCount = (globalKpis.hasOverrunRisk ? 1 : 0) + budgetAlerts.length;

    useEffect(() => {
        if (notificationCount === 0 && isNotificationsPanelOpen) {
            setIsNotificationsPanelOpen(false);
        }
    }, [notificationCount, isNotificationsPanelOpen]);
    
    const handleOpenModal = (supplier) => { 
        setIsModalOpen(true); 
        const summary = summaries.find(s => s.supplierId === supplier.id); 
        setSelectedSupplier({ 
            ...supplier, 
            allocations: summary?.details || [], 
            isUnexpected: summary?.isUnexpected || false 
        }); 
    };
    
    const handleCloseModal = () => { 
        setIsModalOpen(false); 
        setSelectedSupplier(null); 
    };
    
    const handleSaveBudget = async (allocations, isUnexpected) => {
        if (!selectedSupplier || !year) return;
        const toastId = toast.loading("Salvataggio budget...");
        
        try {
            const budgetQuery = query(collection(db, "budgets"), where("year", "==", year), where("supplierId", "==", selectedSupplier.id));
            const existingDocs = await getDocs(budgetQuery);
            const dataToSave = { 
                year, 
                supplierId: selectedSupplier.id, 
                allocations, 
                isUnexpected, 
                updatedAt: serverTimestamp() 
            };
            
            const batch = writeBatch(db);
            if (existingDocs.empty) {
                const newDocRef = doc(collection(db, "budgets"));
                batch.set(newDocRef, { ...dataToSave, createdAt: serverTimestamp() });
            } else {
                batch.update(existingDocs.docs[0].ref, dataToSave);
            }
            
            await batch.commit();
            toast.success("Budget salvato!", { id: toastId });
            handleCloseModal();
        } catch (error) { 
            console.error("Errore durante il salvataggio del budget:", error);
            toast.error("Errore salvataggio.", { id: toastId }); 
        }
    };
    
    const resetFilters = () => {
        setSearchTerm('');
        setSelectedSector('all');
        setSelectedBranch('all');
        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
        setPresetName('');
        setIsFiltersPresetPanelOpen(false);
        setIsDatePanelOpen(false);
        toast.success("Filtri resettati!");
    };

    const applyPreset = (preset) => {
        const presetStart = preset.startDate || defaultStartDate;
        const presetEnd = preset.endDate || defaultEndDate;
        setStartDate(presetStart);
        setEndDate(presetEnd);
        setSelectedSector(preset.selectedSector || 'all');
        setSelectedBranch(preset.selectedBranch || 'all');
        setPresetName('');

        const derivedYear = new Date(presetEnd).getFullYear();
        if (!Number.isNaN(derivedYear)) {
            setYear(derivedYear);
        }

        toast.success(`Preset "${preset.name}" applicato`);
    };

    const deletePreset = (id) => {
        setFilterPresets(prev => prev.filter(p => p.id !== id));
        toast.success('Preset eliminato');
    };

    const handleYearChange = (newYear) => {
        setYear(newYear);
        const start = formatDateInput(newYear, 0, 1);
        const end = formatDateInput(newYear, 11, 31);
        setStartDate(start);
        setEndDate(end);
    };

    const handleSortChange = useCallback((columnKey) => {
        setSortConfig((prev) => {
            if (prev?.key === columnKey) {
                return {
                    key: columnKey,
                    direction: prev.direction === 'asc' ? 'desc' : 'asc'
                };
            }
            const defaultDirection = ['supplier', 'sector'].includes(columnKey) ? 'asc' : 'desc';
            return {
                key: columnKey,
                direction: defaultDirection
            };
        });
    }, []);
    
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div className="text-xl font-semibold text-gray-700">Caricamento budget...</div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative">
            <div className="relative p-4 lg:p-8 space-y-6">
                {/* Header */}
                <div className="space-y-6">
                    <div className="relative rounded-3xl bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 text-white shadow-2xl border border-white/20 p-6 lg:p-10">
                        <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_60%)] pointer-events-none" />
                        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg shadow-emerald-900/30 ring-4 ring-white/25">
                                        <Target className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.4em] text-white/70 font-semibold">Budget</p>
                                        <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black leading-tight">
                                            Controllo Budget
                                        </h1>
                                    </div>
                                </div>
                                <p className="text-sm lg:text-base text-white/85 max-w-3xl">
                                    Pianifica e monitora spesa, allocazioni e impegni contrattuali con la stessa logica applicata alle altre aree della piattaforma.
                                </p>
                                <div className="flex flex-wrap items-center gap-3" />
                            </div>
                            <div className="flex items-center justify-end">
                                <div className="flex flex-col items-end gap-3">
                                    <div className="inline-flex items-center gap-3 rounded-2xl border border-white/30 bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/85 shadow-lg shadow-emerald-900/20 backdrop-blur-sm">
                                        <Calendar className="w-4 h-4" />
                                        Anno
                                        <select
                                            value={year}
                                            onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                                            className="bg-transparent text-[11px] font-bold uppercase tracking-[0.2em] text-white focus:outline-none"
                                        >
                                            {[0, -1, -2].map(offset => {
                                                const y = new Date().getFullYear() + offset;
                                                return (
                                                    <option key={y} value={y}>
                                                        {y}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsNotificationsPanelOpen((prev) => !prev)}
                                            className={`inline-flex items-center gap-2 rounded-2xl border border-white/30 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] shadow-lg backdrop-blur-sm transition-all ${
                                                notificationCount > 0
                                                    ? 'bg-white/15 text-white hover:bg-white/25 shadow-emerald-900/30'
                                                    : 'bg-white/10 text-white/60 hover:bg-white/15 shadow-emerald-900/10'
                                            }`}
                                        >
                                            <Bell className="w-4 h-4" />
                                            {notificationCount} Notifiche
                                        </button>
                                        {isNotificationsPanelOpen && (
                                            <>
                                                <div
                                                    className="absolute inset-0 z-40"
                                                    onClick={() => setIsNotificationsPanelOpen(false)}
                                                />
                                                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[calc(100vw-3rem)] max-w-md rounded-3xl border border-white/40 bg-white/95 p-5 shadow-2xl shadow-emerald-900/30 backdrop-blur sm:w-[24rem] space-y-4">
                                                    {globalKpis.hasOverrunRisk && (
                                                        <div className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50/80 p-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-500">
                                                                        Rischio budget globale
                                                                    </p>
                                                                    <h3 className="text-sm font-black text-slate-900">
                                                                        {formatCurrency(globalKpis.totalForecast)} previsti · Master {formatCurrency(globalKpis.totalMasterBudget)}
                                                                    </h3>
                                                                </div>
                                                                <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600">
                                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                                    {formatCurrency(globalOverrunAmount)}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs font-medium text-slate-600">
                                                                Con le proiezioni attuali potresti superare il budget master disponibile. Valuta una riallocazione o una revisione degli importi assegnati.
                                                            </p>
                                                        </div>
                                                    )}
                                                    {budgetAlerts.length > 0 && (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-500">
                                                                    Alert attivi
                                                                </p>
                                                                <span className="text-xs font-bold text-emerald-600">
                                                                    Totale {formatCurrency(totalBudgetAlertsAmount)}
                                                                </span>
                                                            </div>
                                                            <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
                                                                {budgetAlerts.map(alert => {
                                                                    const isCritical = alert.type === 'critical';
                                                                    const isWarning = alert.type === 'warning';
                                                                    const accent = isCritical
                                                                        ? 'text-rose-600'
                                                                        : isWarning
                                                                            ? 'text-amber-600'
                                                                            : 'text-emerald-600';
                                                                    const badgeBg = isCritical
                                                                        ? 'bg-rose-50 border-rose-100'
                                                                        : isWarning
                                                                            ? 'bg-amber-50 border-amber-100'
                                                                            : 'bg-emerald-50 border-emerald-100';
                                                                    return (
                                                                        <div
                                                                            key={alert.key}
                                                                            className="space-y-2 rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-inner shadow-slate-100/60"
                                                                        >
                                                                            <div className="space-y-1">
                                                                                <h4 className="text-sm font-black text-slate-900">{alert.title}</h4>
                                                                                <p className="text-xs font-medium text-slate-600">
                                                                                    {alert.description}
                                                                                </p>
                                                                            </div>
                                                                            <div className={`rounded-xl px-3 py-2 text-right ${badgeBg}`}>
                                                                                <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${accent}`}>
                                                                                    {alert.totalLabel}
                                                                                </p>
                                                                                <p className={`text-base font-black ${accent}`}>
                                                                                    {formatCurrency(alert.totalAmount)}
                                                                                </p>
                                                                            </div>
                                                                            {alert.items?.length > 0 && (
                                                                                <div className="grid grid-cols-1 gap-2">
                                                                                    {alert.items.map(item => (
                                                                                        <div
                                                                                            key={item.id || item.name}
                                                                                            className="flex items-center justify-between rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
                                                                                        >
                                                                                            <span className="truncate max-w-[160px]">{item.name}</span>
                                                                                            <span className={`font-bold ${accent}`}>
                                                                                                {formatCurrency(item.amount)}
                                                                                            </span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {notificationCount === 0 && (
                                                        <p className="text-sm font-semibold text-slate-600">
                                                            Nessuna notifica disponibile.
                                                        </p>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsNotificationsPanelOpen(false)}
                                                        className="w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 transition hover:bg-emerald-100"
                                                    >
                                                        Chiudi notifiche
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
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

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <section className="relative flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
                        <div className="flex flex-col">
                            <div className="rounded-t-3xl border-b border-white/60 bg-gradient-to-r from-emerald-100/70 via-white/90 to-teal-100/50 px-6 py-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-500">
                                    Analisi fornitori
                                </p>
                                <h2 className="text-lg font-black text-slate-900">
                                    Principali canali · Spesa vs scostamenti
                                </h2>
                            </div>
                            <div className="flex flex-1 flex-col px-6 py-6">
                                <div className="flex-1">
                                    {supplierBarData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={320}>
                                            <BarChart
                                                data={supplierBarData}
                                                layout="vertical"
                                                margin={{ top: 12, right: 16, left: 0, bottom: 12 }}
                                                barGap={0}
                                                barCategoryGap={20}
                                            >
                                                <defs>
                                                    {supplierBarData.map((entry) => (
                                                        <linearGradient
                                                            key={`supplier-gradient-${entry.id}`}
                                                            id={`supplier-gradient-${entry.id}`}
                                                            x1="0"
                                                            y1="1"
                                                            x2="1"
                                                            y2="1"
                                                        >
                                                            <stop offset="0%" stopColor={entry.color} stopOpacity={0.7} />
                                                            <stop offset="100%" stopColor={entry.color} stopOpacity={1} />
                                                        </linearGradient>
                                                    ))}
                                                    <linearGradient id="supplier-overdue-gradient" x1="0" y1="1" x2="1" y2="1">
                                                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.7} />
                                                        <stop offset="100%" stopColor="#f97316" stopOpacity={1} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid stroke="rgba(15,23,42,0.05)" vertical={false} />
                                                <XAxis
                                                    type="number"
                                                    tickFormatter={value => formatCurrency(value)}
                                                    stroke="#0f172a"
                                                    fontSize={12}
                                                    tickLine={false}
                                                    axisLine={false}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="name"
                                                    width={140}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tick={{ fill: '#0f172a', fontWeight: 600, fontSize: 12 }}
                                                />
                                                <RechartsTooltip content={renderSupplierTooltip} cursor={{ fill: 'rgba(15,118,110,0.08)' }} />
                                                <Bar
                                                    dataKey="spend"
                                                    stackId="a"
                                                    barSize={26}
                                                >
                                                    {supplierBarData.map((entry) => (
                                                        <Cell
                                                            key={`spend-${entry.id}`}
                                                            fill={`url(#supplier-gradient-${entry.id})`}
                                                            stroke="none"
                                                            radius={showProjections && entry.overdue > 0 ? [0, 0, 0, 0] : [0, 12, 12, 0]}
                                                        />
                                                    ))}
                                                </Bar>
                                                {showProjections && (
                                                    <Bar dataKey="overdue" stackId="a" radius={[0, 12, 12, 0]} barSize={26}>
                                                        {supplierBarData.map((entry) => (
                                                            <Cell key={`overdue-${entry.id}`} fill="url(#supplier-overdue-gradient)" stroke="none" />
                                                        ))}
                                                    </Bar>
                                                )}
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200/60 bg-white/60 p-10 text-center text-sm font-semibold text-emerald-600">
                                            Non ci sono spese registrate per i filtri selezionati.
                                        </div>
                                    )}
                                </div>
                                {supplierBarData.length > 0 && (
                                    <div className="mt-6">
                                        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                            {supplierBarData.slice(0, 6).map((entry) => {
                                                const total = entry.spend + entry.overdue;
                                                return (
                                                    <li
                                                        key={`supplier-summary-${entry.id}`}
                                                        className="flex items-center justify-between rounded-2xl border border-emerald-100/70 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm shadow-emerald-100/40"
                                                    >
                                                        <span className="flex items-center gap-3">
                                                            <span
                                                                className="inline-flex h-2.5 w-2.5 rounded-full"
                                                                style={{ backgroundColor: entry.color }}
                                                            />
                                                            {entry.name}
                                                        </span>
                                                        <span className="text-slate-900">
                                                            {formatCurrency(total)}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="relative flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
                        <div className="flex flex-col">
                            <div className="rounded-t-3xl border-b border-white/60 bg-gradient-to-r from-teal-100/70 via-white/90 to-emerald-100/50 px-6 py-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-500">
                                    Ripartizione settoriale
                                </p>
                                <h2 className="text-lg font-black text-slate-900">
                                    Contributo sui costi filtrati
                                </h2>
                            </div>
                            <div className="flex flex-1 flex-col px-6 py-6">
                                <div className="flex-1">
                                    {sectorDistributionData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={320}>
                                            <PieChart>
                                                <Pie
                                                    data={sectorDistributionData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius="60%"
                                                    outerRadius="80%"
                                                    paddingAngle={4}
                                                    strokeWidth={0}
                                                >
                                                    {sectorDistributionData.map((entry) => (
                                                        <Cell key={`sector-${entry.id}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip content={renderSectorTooltip} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200/60 bg-white/60 p-10 text-center text-sm font-semibold text-emerald-600">
                                            Nessun dato disponibile per generare la ripartizione settoriale.
                                        </div>
                                    )}
                                </div>
                                {sectorDistributionData.length > 0 && (
                                    <div className="mt-6">
                                        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {sectorDistributionData.slice(0, 4).map((entry) => {
                                                const percentage = sectorDistributionTotal > 0
                                                    ? `${Math.round((entry.value / sectorDistributionTotal) * 100)}%`
                                                    : '0%';
                                                return (
                                                    <li
                                                        key={`sector-summary-${entry.id}`}
                                                        className="flex items-center justify-between rounded-2xl border border-emerald-100/70 bg-white px-3 py-2 shadow-sm shadow-emerald-100/40"
                                                    >
                                                        <span className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                                                            <span
                                                                className="inline-flex h-2.5 w-2.5 rounded-full"
                                                                style={{ backgroundColor: entry.color }}
                                                            />
                                                            {entry.name}
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-900">
                                                            {percentage}
                                                        </span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                </div>

                {/* Lista Fornitori */}
                <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-2xl mt-6">
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute -top-40 right-0 h-72 w-72 rounded-full bg-emerald-200/25 blur-3xl" />
                        <div className="absolute bottom-[-35%] left-1/4 h-72 w-72 rounded-full bg-teal-200/20 blur-2xl" />
                    </div>
                    <div className="relative z-10 flex flex-col">
                        <div className="flex flex-col gap-3 rounded-t-3xl border-b border-white/60 bg-gradient-to-r from-emerald-100/70 via-white/90 to-teal-100/50 px-6 py-5 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-500">
                                    Fornitori & allocazioni
                                </p>
                                <h2 className="text-lg font-black text-slate-900">
                                    Budget per canale e stato di utilizzo
                                </h2>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 justify-end">
                                <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-emerald-700 shadow-sm shadow-emerald-100/40">
                                    <Search className="h-4 w-4 text-emerald-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(event) => setSearchTerm(event.target.value)}
                                        placeholder="Ricerca libera"
                                        className="appearance-none bg-transparent text-sm font-semibold text-emerald-700 placeholder:text-emerald-600 focus:outline-none"
                                    />
                                </div>
                                <div className="flex min-w-[200px] items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-emerald-700 shadow-sm shadow-emerald-100/40">
                                    <Layers className="h-4 w-4 text-emerald-400" />
                                    <select
                                        value={selectedSector}
                                        onChange={(event) => setSelectedSector(event.target.value)}
                                        className="w-full bg-transparent text-sm font-semibold text-emerald-700 focus:outline-none"
                                    >
                                        <option value="all">Tutti i settori</option>
                                        {orderedSectors.map((sector) => (
                                            <option key={sector.id} value={sector.id}>
                                                {sector.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex min-w-[200px] items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-emerald-700 shadow-sm shadow-emerald-100/40">
                                    <MapPin className="h-4 w-4 text-emerald-400" />
                                    <select
                                        value={selectedBranch}
                                        onChange={(event) => setSelectedBranch(event.target.value)}
                                        className="w-full bg-transparent text-sm font-semibold text-emerald-700 focus:outline-none"
                                    >
                                        <option value="all">Tutte le filiali</option>
                                        {orderedBranches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {branch.name || 'N/D'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <BudgetDateRangeDropdown
                                    isOpen={isDatePanelOpen}
                                    setIsOpen={(next) => setIsDatePanelOpen(typeof next === 'boolean' ? next : !isDatePanelOpen)}
                                    startDate={startDate}
                                    endDate={endDate}
                                    hasActiveRange={startDate !== defaultStartDate || endDate !== defaultEndDate}
                                    onChange={({ startDate: newStart, endDate: newEnd }) => {
                                        setStartDate(newStart);
                                        setEndDate(newEnd);
                                    }}
                                    onClear={() => {
                                        setStartDate(defaultStartDate);
                                        setEndDate(defaultEndDate);
                                    }}
                                    onToggle={() => setIsFiltersPresetPanelOpen(false)}
                                />
                                <div className="relative">
                                    {isFiltersPresetPanelOpen && (
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsFiltersPresetPanelOpen(false)}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsFiltersPresetPanelOpen(prev => !prev);
                                            setIsDatePanelOpen(false);
                                        }}
                                        aria-expanded={isFiltersPresetPanelOpen}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm shadow-emerald-100/40 transition hover:border-emerald-300 hover:text-emerald-600"
                                    >
                                        <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                                        Preset
                                    </button>
                                    {isFiltersPresetPanelOpen && (
                                        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-80 max-w-[calc(100vw-3rem)] rounded-3xl border border-white/50 bg-white/95 p-4 shadow-2xl shadow-emerald-900/30 backdrop-blur">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-500">
                                                Preset salvati
                                            </span>
                                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                                <input
                                                    type="text"
                                                    value={presetName}
                                                    onChange={(event) => setPresetName(event.target.value)}
                                                    placeholder="Nome preset (es. Consiglio Q1)"
                                                    className="w-full sm:flex-1 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/40"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const name = presetName.trim();
                                                        if (!name) {
                                                            toast.error('Inserisci un nome per il preset');
                                                            return;
                                                        }
                                                        const preset = {
                                                            id: Date.now(),
                                                            name,
                                                            startDate,
                                                            endDate,
                                                            selectedSector,
                                                            selectedBranch
                                                        };
                                                        setFilterPresets(prev => {
                                                            const withoutDuplicates = prev.filter(p => p.name.toLowerCase() !== name.toLowerCase());
                                                            return [...withoutDuplicates, preset];
                                                        });
                                                        setPresetName('');
                                                        setIsFiltersPresetPanelOpen(false);
                                                        toast.success('Preset salvato');
                                                    }}
                                                    disabled={!presetName.trim()}
                                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Check className="h-4 w-4" />
                                                    Salva
                                                </button>
                                            </div>
                                            {filterPresets.length > 0 ? (
                                                <div className="mt-3 flex flex-col gap-2">
                                                    {filterPresets.map((preset) => (
                                                        <div
                                                            key={preset.id}
                                                            className="inline-flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-white/95 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm shadow-emerald-100/40"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    applyPreset(preset);
                                                                    setIsFiltersPresetPanelOpen(false);
                                                                }}
                                                                className="flex-1 text-left hover:text-teal-600 transition-colors"
                                                            >
                                                                {preset.name}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => deletePreset(preset.id)}
                                                                className="text-emerald-200 hover:text-rose-500 transition-colors"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="mt-3 text-xs font-medium text-emerald-400">
                                                    Salva una combinazione per richiamarla rapidamente nelle altre pagine.
                                                </p>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setIsFiltersPresetPanelOpen(false)}
                                                className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600 transition hover:bg-emerald-100"
                                            >
                                                Chiudi preset
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={resetFilters}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm shadow-rose-100/40 transition hover:border-rose-300 hover:bg-rose-100"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Resetta filtri
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="relative z-10 px-6 pb-6 mt-4">
                            {displayData.length > 0 ? (
                                <SupplierTableView
                                    suppliers={displayData}
                                    onManage={handleOpenModal}
                                    sectorMap={sectorMap}
                                    showProjections={showProjections}
                                    sortConfig={sortConfig}
                                    onSort={handleSortChange}
                                />
                            ) : (
                                <div className="bg-white/85 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 p-12 text-center">
                                    <div className="p-4 rounded-2xl bg-emerald-100 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                                        <Search className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-4">Nessun Fornitore Trovato</h3>
                                    <p className="text-slate-600">
                                        Non ci sono fornitori che corrispondono ai filtri attuali per l&apos;anno {year}.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <BudgetAllocationModal 
                    isOpen={isModalOpen} 
                    onClose={handleCloseModal} 
                    onSave={handleSaveBudget} 
                    supplier={selectedSupplier} 
                    year={year} 
                    initialAllocations={selectedSupplier?.allocations} 
                    sectors={sectors} 
                    branches={branches} 
                    marketingChannels={marketingChannels}
                />
            )}
        </div>
    );
}
