import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    CheckCircle,
    Activity,
    Zap,
    ArrowUpDown,
    MapPin,
    Calendar,
    Check,
    SlidersHorizontal,
    Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import BudgetAllocationModal from '../components/BudgetAllocationModal';
import { KpiCard, MultiSelect } from '../components/SharedComponents';
import { loadFilterPresets, persistFilterPresets } from '../utils/filterPresets';
import { DEFAULT_COST_DOMAIN } from '../constants/costDomains';

const formatDateInput = (year, month, day) => new Date(Date.UTC(year, month, day)).toISOString().split('T')[0];

const SupplierTableView = ({ suppliers, onManage, sectorMap, showProjections }) => (
    <div className="overflow-hidden rounded-3xl border border-white/30 bg-white/95 shadow-xl shadow-slate-200/60">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-slate-700">
                <thead className="bg-emerald-700 text-white uppercase text-[11px] font-bold tracking-[0.16em]">
                    <tr>
                        <th className="px-4 py-3 text-left">Fornitore</th>
                        <th className="px-4 py-3 text-left hidden lg:table-cell">Settori</th>
                        <th className="px-4 py-3 text-right">Budget</th>
                        <th className="px-4 py-3 text-right">Speso</th>
                        {showProjections && <th className="px-4 py-3 text-right">Scaduto</th>}
                        {showProjections && <th className="px-4 py-3 text-right">Proiezioni</th>}
                        <th className="px-4 py-3 text-left hidden md:table-cell">Utilizzo</th>
                        <th className="px-4 py-3 text-center">Stato</th>
                        <th className="px-4 py-3 text-center">Azioni</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {suppliers.map((supplier) => {
                        const utilization = supplier.displayBudget > 0
                            ? (supplier.displaySpend / supplier.displayBudget) * 100
                            : 0;
                        const overdueAmount = supplier.overdue || 0;
                        const futureAmount = supplier.projections || 0;
                        const totalWithForecast = supplier.displaySpend + (showProjections ? overdueAmount + futureAmount : 0);
                        const supplierIconKey = (supplier.associatedSectors?.length || 0) > 1 ? 'default' : sectorMap.get(supplier.associatedSectors?.[0]);
                        const sectorNames = (supplier.associatedSectors || []).map(id => sectorMap.get(id)).filter(Boolean);

                        return (
                            <tr key={supplier.id} className="bg-white/80 hover:bg-emerald-50/30 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-inner">
                                            {getSectorIcon(supplierIconKey, "w-4 h-4")}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-900 truncate max-w-xs">{supplier.name || 'N/D'}</p>
                                            <p className="text-xs text-emerald-700/80 font-semibold">
                                                {formatCurrency(totalWithForecast)}
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 hidden lg:table-cell text-sm text-slate-600">
                                    {sectorNames.length > 0 ? sectorNames.join(', ') : '—'}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                                    {formatCurrency(supplier.displayBudget)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                                    {formatCurrency(supplier.displaySpend)}
                                </td>
                                {showProjections && (
                                    <td className="px-4 py-3 text-right font-semibold text-rose-600 whitespace-nowrap">
                                        {overdueAmount > 0 ? formatCurrency(overdueAmount) : '—'}
                                    </td>
                                )}
                                {showProjections && (
                                    <td className="px-4 py-3 text-right text-sm text-slate-600 whitespace-nowrap">
                                        {futureAmount > 0 ? formatCurrency(futureAmount) : '—'}
                                    </td>
                                )}
                                <td className="px-4 py-3 hidden md:table-cell">
                                    <div className="flex flex-col gap-1">
                                        <div className="h-2 w-full max-w-[120px] rounded-full bg-slate-100">
                                            <div
                                                className={`h-2 rounded-full ${utilization > 100 ? 'bg-rose-500' : utilization > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(utilization, 100)}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs font-bold ${utilization > 100 ? 'text-rose-600' : 'text-slate-600'}`}>
                                            {supplier.displayBudget > 0 ? `${utilization.toFixed(0)}%` : 'N/D'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <StatusBadge
                                        spend={supplier.displaySpend}
                                        budget={supplier.displayBudget}
                                        isUnexpected={supplier.isUnexpected || supplier.totalBudget === 0}
                                    />
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button
                                        onClick={() => onManage(supplier)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50"
                                    >
                                        <Settings className="w-4 h-4" />
                                        Gestisci
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

const formatCurrency = (value) => (value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

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

const StatusBadge = ({ spend, budget, isUnexpected }) => {
    const badgeBase = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border";

    if (isUnexpected && (!budget || budget === 0)) {
        return (
            <span className={`${badgeBase} bg-amber-100 text-amber-700 border-amber-200`}>
                <AlertTriangle className="w-4 h-4" />
                Extra budget
            </span>
        );
    }

    if (!budget || budget === 0) {
        return (
            <span className={`${badgeBase} bg-slate-100 text-slate-600 border-slate-200`}>
                <Activity className="w-4 h-4" />
                Senza budget
            </span>
        );
    }

    const percentage = (spend / budget) * 100;

    if (spend > budget) {
        return (
            <span className={`${badgeBase} bg-rose-100 text-rose-700 border-rose-200`}>
                <AlertTriangle className="w-4 h-4" />
                Budget superato
            </span>
        );
    }

    if (percentage > 85) {
        return (
            <span className={`${badgeBase} bg-amber-100 text-amber-700 border-amber-200`}>
                <Zap className="w-4 h-4" />
                In esaurimento
            </span>
        );
    }

    return (
        <span className={`${badgeBase} bg-emerald-100 text-emerald-700 border-emerald-200`}>
            <CheckCircle className="w-4 h-4" />
            In linea
        </span>
    );
};


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
    const [supplierFilter, setSupplierFilter] = useState([]);
    const [sortOrder, setSortOrder] = useState('spend_desc');
    const [unexpectedFilter, setUnexpectedFilter] = useState('all');
    const [showProjections, setShowProjections] = useState(true);
    const [filterPresets, setFilterPresets] = useState(() =>
        loadFilterPresets().map(preset => {
            const { showProjections: _ignored, ...rest } = preset;
            return rest;
        })
    );
    const [presetName, setPresetName] = useState('');
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
            unexpectedFilter !== 'all' ||
            searchTerm.trim() !== '' ||
            supplierFilter.length > 0;
    }, [startDate, endDate, selectedSector, selectedBranch, showProjections, unexpectedFilter, searchTerm, supplierFilter, defaultStartDate, defaultEndDate]);

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

    const { displayData, budgetStatusCounts } = useMemo(() => {
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
        
        if (supplierFilter.length > 0) {
            baseFiltered = baseFiltered.filter(s => supplierFilter.includes(s.supplierId));
        }
        
        if (searchTerm.trim() !== '') {
            baseFiltered = baseFiltered.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        const countsAccumulator = baseFiltered.reduce((acc, item) => {
            if (!item.isUnexpected && item.totalBudget > 0) {
                acc.planned += 1;
            } else if (item.isUnexpected || item.totalBudget === 0) {
                acc.unexpected += 1;
            }
            return acc;
        }, { planned: 0, unexpected: 0 });

        const counts = {
            total: baseFiltered.length,
            planned: countsAccumulator.planned,
            unexpected: countsAccumulator.unexpected
        };

        let filtered = [...baseFiltered];
        if (unexpectedFilter === 'unexpected') {
            filtered = filtered.filter(s => s.isUnexpected || s.totalBudget === 0);
        } else if (unexpectedFilter === 'planned') {
            filtered = filtered.filter(s => !s.isUnexpected && s.totalBudget > 0);
        }

        const sorted = filtered.sort((a, b) => {
            if (sortOrder === 'name_asc') {
                return (a.name || '').localeCompare(b.name || '');
            }
            const aTotal = a.displaySpend + (showProjections ? (a.projections || 0) + (a.overdue || 0) : 0);
            const bTotal = b.displaySpend + (showProjections ? (b.projections || 0) + (b.overdue || 0) : 0);
            return bTotal - aTotal;
        });
        
        return {
            displayData: sorted,
            budgetStatusCounts: counts
        };
    }, [summaries, supplierMap, selectedSector, selectedBranch, supplierFilter, searchTerm, sortOrder, unexpectedFilter, contractProjections, showProjections]);

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
        setSupplierFilter([]);
        setSelectedSector('all');
        setSelectedBranch('all');
        setUnexpectedFilter('all');
        setSortOrder('spend_desc');
        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
        setShowProjections(true);
        setPresetName('');
        toast.success("Filtri resettati!");
    };

    const savePreset = () => {
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
            selectedBranch,
            supplierFilter
        };
        setFilterPresets(prev => {
            const withoutDuplicates = prev.filter(p => p.name.toLowerCase() !== name.toLowerCase());
            return [...withoutDuplicates, preset];
        });
        setPresetName('');
        toast.success('Preset salvato');
    };

    const applyPreset = (preset) => {
        const presetStart = preset.startDate || defaultStartDate;
        const presetEnd = preset.endDate || defaultEndDate;
        setStartDate(presetStart);
        setEndDate(presetEnd);
        setSelectedSector(preset.selectedSector || 'all');
        setSelectedBranch(preset.selectedBranch || 'all');
        setSupplierFilter(preset.supplierFilter || []);
        setShowProjections(true);
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
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 text-white shadow-2xl border border-white/20 p-6 lg:p-10">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_60%)]" />
                        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-3">
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
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-white/15 rounded-2xl px-4 py-3 backdrop-blur-sm">
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                                    <Calendar className="w-4 h-4" />
                                    Anno di riferimento
                                </div>
                                <select
                                    value={year}
                                    onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
                                    className="h-11 rounded-xl bg-white/95 px-4 text-sm font-bold text-emerald-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-400/70"
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
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                    {kpiCards.map(({ key, ...card }) => (
                        <KpiCard key={key} {...card} />
                    ))}
                </div>

                {/* Filtri */}
                <div className="bg-gradient-to-br from-emerald-50 via-white to-white backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8 space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 ring-4 ring-emerald-400/20">
                            <SlidersHorizontal className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black text-slate-900">Filtri Budget</h2>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-700">
                                    <Info className="w-3 h-3" />
                                    Sincronizzati con la dashboard
                                </span>
                            </div>
                            <p className="mt-1 text-sm font-medium text-slate-600">
                                Imposta periodo, settore e filiale per mantenere una lettura coerente dei dati economici.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row">
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Cerca fornitore o note..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-12 rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
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
                                    ? `${supplierFilter.length} fornitor${supplierFilter.length === 1 ? 'e' : 'i'} selezionat${supplierFilter.length === 1 ? 'o' : 'i'}`
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
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-600 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                />
                                <span className="text-slate-400 font-semibold text-sm">→</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-600 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                />
                            </div>
                            <p className="text-[11px] font-medium text-slate-400">
                                Le proiezioni contrattuali seguono l'intervallo selezionato.
                            </p>
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
                                    <Layers className={`w-4 h-4 ${selectedSector === 'all' ? 'text-white' : 'text-emerald-600'}`} />
                                    Tutti i settori
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
                                                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-500/30'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {getSectorIcon(sector.name, `w-4 h-4 ${isActive ? 'text-white' : 'text-emerald-600'}`)}
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
                                            ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-lg shadow-slate-500/30'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <MapPin className="w-4 h-4" />
                                    Tutte le filiali
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
                                                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30'
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
                                Stato Budget
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setUnexpectedFilter('all')}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                        unexpectedFilter === 'all'
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    Tutti ({budgetStatusCounts.total})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUnexpectedFilter('planned')}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                        unexpectedFilter === 'planned'
                                            ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/30'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    Previsti ({budgetStatusCounts.planned})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUnexpectedFilter('unexpected')}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1 ${
                                        unexpectedFilter === 'unexpected'
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <AlertTriangle className="w-3 h-3" />
                                    Extra budget ({budgetStatusCounts.unexpected})
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
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            >
                                <option value="spend_desc">Spesa ↓</option>
                                <option value="name_asc">Nome A-Z</option>
                            </select>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 space-y-3">
                        <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                            Preset salvati
                        </span>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="text"
                                value={presetName}
                                onChange={(e) => setPresetName(e.target.value)}
                                placeholder="Nome preset (es. Board Q1)"
                                className="flex-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                            />
                            <button
                                type="button"
                                onClick={savePreset}
                                disabled={!presetName.trim()}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
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
                                            className="text-sm font-semibold text-slate-600 hover:text-emerald-600"
                                        >
                                            {preset.name}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deletePreset(preset.id)}
                                            className="text-slate-400 hover:text-rose-500"
                                        >
                                            <X className="w-3 h-3" />
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
                {(globalKpis.hasOverrunRisk || budgetAlerts.length > 0) && (
                    <div className="space-y-4">
                        {globalKpis.hasOverrunRisk && (
                            <div className="rounded-3xl border border-rose-100 bg-rose-50/90 p-5 lg:p-6 shadow-lg shadow-rose-200/50 flex flex-col sm:flex-row items-start gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-lg shadow-rose-500/30 flex-shrink-0">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-red-900 mb-1 text-sm sm:text-base">
                                        Attenzione: rischio sforamento budget globale
                                    </h4>
                                    <p className="text-xs sm:text-sm text-red-700">
                                        Con le proiezioni attuali dei contratti, la spesa totale prevista ({formatCurrency(globalKpis.totalForecast)}) 
                                        supera il budget disponibile ({formatCurrency(globalKpis.totalMasterBudget)}). 
                                        Considera di rivedere le allocazioni o aumentare il budget master.
                                    </p>
                                </div>
                            </div>
                        )}

                        {budgetAlerts.map(alert => {
                            const isCritical = alert.type === 'critical';
                            const isWarning = alert.type === 'warning';
                            const accentText = isCritical
                                ? 'text-rose-600'
                                : isWarning
                                    ? 'text-amber-600'
                                    : 'text-emerald-600';
                            const badgeBorder = isCritical
                                ? 'border-rose-100'
                                : isWarning
                                    ? 'border-amber-100'
                                    : 'border-emerald-100';
                            const iconBg = isCritical
                                ? 'bg-gradient-to-br from-rose-500 to-red-500'
                                : isWarning
                                    ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                                    : 'bg-gradient-to-br from-emerald-500 to-teal-500';
                            const iconElement = isCritical ? <AlertTriangle className="w-6 h-6" /> : <Info className="w-6 h-6" />;
                            return (
                                <div
                                    key={alert.key}
                                    className="rounded-3xl border border-white/40 bg-white/95 p-5 lg:p-6 shadow-xl shadow-emerald-200/40 space-y-4"
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${iconBg} shadow-emerald-500/20`}>
                                                {iconElement}
                                            </div>
                                            <div>
                                                <h4 className="text-base font-black text-slate-900">{alert.title}</h4>
                                                <p className="text-sm font-medium text-slate-600">{alert.description}</p>
                                            </div>
                                        </div>
                                        <div className={`rounded-2xl px-4 py-3 text-right shadow-inner ${badgeBorder} border`}>
                                            <p className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${accentText}`}>
                                                {alert.totalLabel}
                                            </p>
                                            <p className={`text-xl font-black ${accentText}`}>
                                                {formatCurrency(alert.totalAmount)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {alert.items.map(item => (
                                            <span
                                                key={item.id || item.name}
                                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
                                            >
                                                <span className="truncate max-w-[160px]">{item.name}</span>
                                                <span className={`font-bold ${accentText}`}>
                                                    {formatCurrency(item.amount)}
                                                </span>
                                                {isCritical && (
                                                    <span className="text-[10px] font-semibold text-slate-400">
                                                        su {formatCurrency(item.forecast || 0)}
                                                    </span>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Lista Fornitori */}
                {displayData.length > 0 ? (
                    <div className="mt-6">
                        <SupplierTableView
                            suppliers={displayData}
                            onManage={handleOpenModal}
                            sectorMap={sectorMap}
                            showProjections={showProjections}
                        />
                    </div>
                ) : (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-12 text-center mt-6">
                        <div className="p-4 rounded-2xl bg-gray-100 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Nessun Fornitore Trovato</h3>
                        <p className="text-gray-600">Non ci sono fornitori che corrispondono ai filtri attuali per l'anno {year}.</p>
                    </div>
                )}
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
