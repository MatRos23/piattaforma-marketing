import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import {
    BarChart3, TrendingUp, DollarSign, Target, AlertTriangle,
    CheckCircle, Layers, Car, Sailboat, Caravan, Building2,
    ChevronRight, Activity, Award, XCircle, ArrowUpDown, MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import { KpiCard } from '../components/SharedComponents';

// Utility functions
const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '€ 0';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
};

const getSectorIcon = (sectorName, className = "w-5 h-5") => {
    const icons = {
        'Auto': <Car className={className} />,
        'Camper&Caravan': <Caravan className={className} />,
        'Yachting': <Sailboat className={className} />,
        'Frattin Group': <Building2 className={className} />,
        default: <DollarSign className={className} />
    };
    return icons[sectorName] || icons.default;
};

// --- COMPONENTI UI DEFINITIVI ---

const SectorCard = React.memo(({ sector, onClick }) => {
    const totalValue = sector.spent + (sector.projections || 0);
    const hasBudget = sector.budget > 0;
    const utilization = hasBudget ? (totalValue / sector.budget) * 100 : (totalValue > 0 ? Infinity : 0);
    const isOverBudget = !hasBudget ? totalValue > 0 : utilization > 100;
    const isWarning = hasBudget && utilization > 85 && !isOverBudget;
    
    const spendPercentage = hasBudget ? (sector.spent / sector.budget) * 100 : 0;
    const projectionPercentage = hasBudget ? ((sector.projections || 0) / sector.budget) * 100 : 0;

    return (
        <div 
            onClick={onClick} 
            className="group bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-5 hover:shadow-2xl hover:-translate-y-1 hover:border-indigo-300 transition-all duration-300 cursor-pointer flex flex-col h-full"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg flex-shrink-0">
                        {getSectorIcon(sector.name, "w-6 h-6")}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-black text-gray-900 truncate">{sector.name}</h3>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${ isOverBudget ? 'bg-red-100 text-red-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700' }`}>
                    {!hasBudget && totalValue > 0 ? 'Extra' : utilization === Infinity ? 'Extra' : `${utilization.toFixed(0)}%`}
                </div>
            </div>

            <div className="flex-1 space-y-3 mb-4">
                <div>
                    <p className="text-xs text-gray-500 font-semibold mb-1">SPESA EFFETTIVA</p>
                    <p className="text-2xl font-black text-gray-900">{formatCurrency(sector.spent)}</p>
                </div>
                {sector.projections > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg">
                        <TrendingUp className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-indigo-600 font-semibold">Proiezioni</p>
                            <p className="text-sm font-black text-indigo-900">{formatCurrency(sector.projections)}</p>
                        </div>
                    </div>
                )}
                <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 font-semibold mb-1">BUDGET</p>
                    <p className="text-lg font-bold text-gray-700">{hasBudget ? formatCurrency(sector.budget) : 'Non definito'}</p>
                </div>
            </div>

            <div className="mt-auto">
                 {hasBudget && (
                    <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                            className={`absolute left-0 top-0 h-full bg-gradient-to-r ${isOverBudget ? 'from-red-500 to-rose-600' : isWarning ? 'from-amber-500 to-orange-600' : 'from-emerald-500 to-green-600'} transition-all duration-700 ease-out`} 
                            style={{ width: `${Math.min(spendPercentage + projectionPercentage, 100)}%`}}
                        >
                            <div className={`h-full bg-gradient-to-r ${isOverBudget ? 'from-red-500 to-rose-600' : isWarning ? 'from-amber-500 to-orange-600' : 'from-emerald-500 to-green-600'} brightness-75`} style={{ width: `${spendPercentage > 0 ? (spendPercentage / (spendPercentage + projectionPercentage)) * 100 : 0}%`}}/>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

const SupplierRankItem = React.memo(({ supplier, rank, totalSpent }) => {
    const percentage = totalSpent > 0 ? ((supplier.spent + supplier.projections) / totalSpent * 100) : 0;
    
    return (
        <div className="group relative p-4 lg:p-5 bg-gradient-to-br from-white to-gray-50/50 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full font-black text-base flex-shrink-0 shadow-lg ${ rank === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' : rank === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' : rank === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white' : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700' }`}>
                        {rank + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="font-black text-gray-900 text-sm lg:text-base truncate">{supplier.name}</h4>
                        <p className="text-xs text-gray-500 font-semibold">{percentage.toFixed(1)}% del totale</p>
                    </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                    <span className="text-lg lg:text-xl font-black text-gray-900 block">{formatCurrency(supplier.spent)}</span>
                    {supplier.projections > 0 && (
                        <span className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full mt-1">
                            <TrendingUp className="w-3 h-3" />
                            {formatCurrency(supplier.projections)}
                        </span>
                    )}
                </div>
            </div>
            <div className="relative w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-700" style={{ width: `${Math.min(percentage, 100)}%` }} />
            </div>
        </div>
    );
});

const BranchItem = React.memo(({ branch, rank, onClick, totalSpent }) => {
    const branchTotal = branch.spent + (branch.projections || 0);
    const percentage = totalSpent > 0 ? (branchTotal / totalSpent * 100) : 0;
    
    return (
        <div onClick={onClick} className="group relative p-4 lg:p-5 bg-gradient-to-br from-white to-blue-50/30 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full font-black text-base flex-shrink-0 shadow-lg bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700`}>
                        {rank + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <h4 className="font-black text-gray-900 text-sm lg:text-base truncate">{branch.name}</h4>
                        </div>
                        <p className="text-xs text-gray-500 font-semibold ml-5">{percentage.toFixed(1)}% del totale</p>
                    </div>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                    <span className="text-lg lg:text-xl font-black text-gray-900 block">{formatCurrency(branch.spent)}</span>
                    {branch.projections > 0 && (
                        <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full mt-1">
                            <TrendingUp className="w-3 h-3" />
                            {formatCurrency(branch.projections)}
                        </span>
                    )}
                </div>
            </div>
            <div className="relative w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700" style={{ width: `${Math.min(percentage, 100)}%` }} />
            </div>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-2 transition-all">
                <ChevronRight className="w-5 h-5 text-blue-600" />
            </div>
        </div>
    );
});


export default function DashboardPage({ navigate, user }) {
    const [allExpenses, setAllExpenses] = useState([]);
    const [allContracts, setAllContracts] = useState([]);
    const [allBudgets, setAllBudgets] = useState([]);
    const [sectorBudgets, setSectorBudgets] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSector, setSelectedSector] = useState('all');
    const [showProjections, setShowProjections] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [startDate, setStartDate] = useState(() => new Date(new Date().getFullYear(), 0, 2).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(() => new Date(new Date().getFullYear(), 11, 32).toISOString().split('T')[0]);
    
    const [year, setYear] = useState(() => new Date().getFullYear());
    const defaultStartDate = useMemo(() => new Date(new Date().getFullYear(), 0, 2).toISOString().split('T')[0], []);
    const defaultEndDate = useMemo(() => new Date(new Date().getFullYear(), 11, 32).toISOString().split('T')[0], []);
    const hasActiveFilters = useMemo(() => {
        return startDate !== defaultStartDate ||
               endDate !== defaultEndDate ||
               selectedSector !== 'all' ||
               !showProjections;
    }, [startDate, endDate, selectedSector, showProjections, defaultStartDate, defaultEndDate]);

    useEffect(() => {
        const endYear = new Date(endDate).getFullYear();
        if (endYear !== year) {
            setYear(endYear);
        }
    }, [endDate, year]);

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const orderedSectors = useMemo(() => {
        const order = ['Auto', 'Camper&Caravan', 'Yachting', 'Frattin Group'];
        return [...sectors].sort((a, b) => {
            const indexA = order.indexOf(a.name); const indexB = order.indexOf(b.name);
            if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
            if (indexA === -1) return 1; if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }, [sectors]);

    useEffect(() => {
        if (!user) return;
        setIsLoading(true);
        let expensesQuery = query(collection(db, "expenses"));
        let contractsQuery = query(collection(db, "contracts"));
        if (user.role === 'collaborator' && user.assignedChannels && user.assignedChannels.length > 0) {
            if (user.assignedChannels.length <= 10) {
                expensesQuery = query(collection(db, "expenses"), where("supplierId", "in", user.assignedChannels));
                contractsQuery = query(collection(db, "contracts"), where("supplierld", "in", user.assignedChannels));
            }
        }
        const unsubs = [
            onSnapshot(expensesQuery, snap => { setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); setLastUpdate(new Date()); }),
            onSnapshot(contractsQuery, snap => setAllContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "budgets"), where("year", "==", year)), snap => setAllBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sector_budgets"), where("year", "==", year)), snap => setSectorBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), snap => {
                setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            })
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, [year, user]);

    const handleQuickDateChange = (period) => {
        const end = new Date();
        let start = new Date();
        if (period === 'last_month') start.setMonth(end.getMonth() - 1);
        else if (period === 'last_quarter') start.setMonth(end.getMonth() - 3);
        else if (period === 'last_6_months') start.setMonth(end.getMonth() - 6);
        else if (period === 'last_12_months') start.setFullYear(end.getFullYear() - 1);
        setStartDate(new Date(start.getTime() + 86400000).toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
        toast.success(`Filtro impostato: ${period.replace('_', ' ')}`);
    };
    
    const resetFilters = useCallback(() => {
        const currentYear = new Date().getFullYear();
        setStartDate(new Date(currentYear, 0, 2).toISOString().split('T')[0]);
        setEndDate(new Date(currentYear, 11, 32).toISOString().split('T')[0]);
        setSelectedSector('all');
        setShowProjections(true);
        toast.success("Filtri resettati!");
    }, []);

    const metrics = useMemo(() => {
        if (isLoading) return { spesaSostenuta: 0, spesaPrevista: 0, budgetTotale: 0, annualBudgetTotal: 0, currentSectorBudget: 0, monthlyData: Array.from({ length: 12 }, () => ({ real: 0, projected: 0, budget: 0 })), sectorData: [], topSuppliers: [], allBranches: [], isFullYear: true, totalSuppliersSpent: 0, totalBranchesSpent: 0 };

        const filterStartDate = new Date(startDate);
        const filterEndDate = new Date(endDate);
        
        const totals = { bySupplier: {}, bySector: {}, byBranch: {} };
        const supplierProjections = {};
        const branchProjections = {};
        const sectorProjections = {};
        const monthlyTotals = Array.from({ length: 12 }, () => ({ real: 0, projected: 0 }));
        
        let spesaSostenuta = 0;
        let spesaPrevista = 0;
        
        const genericoBranchId = branches.find(b => b.name.toLowerCase() === 'generico')?.id;
        const branchesPerSector = new Map();
        sectors.forEach(sector => {
            const sectorBranches = branches.filter(b => b.associatedSectors?.includes(sector.id) && b.id !== genericoBranchId);
            branchesPerSector.set(sector.id, sectorBranches);
        });

        const contractSpentMap = new Map();
        allExpenses.forEach(expense => {
            (expense.lineItems || []).forEach(item => {
                if (item.relatedContractId) {
                    const currentSpent = contractSpentMap.get(item.relatedContractId) || 0;
                    contractSpentMap.set(item.relatedContractId, currentSpent + (parseFloat(item.amount) || 0));
                }
            });
            if (expense.relatedContractId) {
                 const currentSpent = contractSpentMap.get(expense.relatedContractId) || 0;
                 contractSpentMap.set(expense.relatedContractId, currentSpent + (parseFloat(expense.amount) || 0));
            }
        });

        allExpenses.forEach((expense) => {
            const expenseDate = expense.date ? new Date(expense.date) : null;
            if (!expenseDate) return;
            const lineItems = (Array.isArray(expense.lineItems) && expense.lineItems.length > 0) ? expense.lineItems : [{...expense}];
            lineItems.forEach(item => {
                const itemAmount = parseFloat(item.amount) || 0;
                if (itemAmount <= 0) return;
                const itemSectorId = item.sectorId || item.sectorld || expense.sectorId || expense.sectorld;
                if (selectedSector !== 'all' && itemSectorId !== selectedSector) return;
                const supplierId = item.supplierId || item.supplierld || expense.supplierId || expense.supplierld;
                const processAmount = (amount, date) => {
                    if (date >= filterStartDate && date <= filterEndDate) {
                        spesaSostenuta += amount;
                        if (supplierId) totals.bySupplier[supplierId] = (totals.bySupplier[supplierId] || 0) + amount;
                        const sectorName = sectorMap.get(itemSectorId);
                        if(sectorName) totals.bySector[sectorName] = (totals.bySector[sectorName] || 0) + amount;
                        monthlyTotals[date.getMonth()].real += amount;
                    }
                };
                const assignmentId = item.assignmentId || item.assignmentid || item.branchld || expense.branchId || expense.branchld;
                const processBranchAmount = (amount, date, assignmentId, sectorId) => {
                    if (date < filterStartDate || date > filterEndDate) return;
                    if (assignmentId === genericoBranchId && sectorId) {
                        const sectorBranches = branchesPerSector.get(sectorId) || [];
                        if (sectorBranches.length > 0) {
                            const amountPerBranch = amount / sectorBranches.length;
                            sectorBranches.forEach(branch => {
                                totals.byBranch[branch.id] = (totals.byBranch[branch.id] || 0) + amountPerBranch;
                            });
                        }
                    } else if (assignmentId && branchMap.has(assignmentId)) {
                        totals.byBranch[assignmentId] = (totals.byBranch[assignmentId] || 0) + amount;
                    }
                }
                if (expense.isAmortized && expense.amortizationStartDate && expense.amortizationEndDate) {
                    const startDate = new Date(expense.amortizationStartDate);
                    const endDate = new Date(expense.amortizationEndDate);
                    const durationDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24) + 1);
                    const dailyAmount = itemAmount / durationDays;
                    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                        const currentDate = new Date(d);
                        processAmount(dailyAmount, currentDate);
                        processBranchAmount(dailyAmount, currentDate, assignmentId, itemSectorId);
                    }
                } else {
                    processAmount(itemAmount, expenseDate);
                    processBranchAmount(itemAmount, expenseDate, assignmentId, itemSectorId);
                }
            });
        });

        if (showProjections) {
            allContracts.forEach(contract => {
                const totalContractValue = (contract.lineItems || []).reduce((sum, li) => sum + (parseFloat(li.totalAmount) || 0), 0);
                const totalSpentOnContract = contractSpentMap.get(contract.id) || 0;
                const remainingContractValue = Math.max(0, totalContractValue - totalSpentOnContract);
                if (remainingContractValue <= 0) return;

                (contract.lineItems || []).forEach((lineItem) => {
                    const supplierId = lineItem.supplierld || contract.supplierld;
                    const sectorId = lineItem.sectorld;
                    const branchId = lineItem.branchld;
                    if (selectedSector !== 'all' && sectorId !== selectedSector) return;
                    const lineItemTotal = parseFloat(lineItem.totalAmount) || 0;
                    if (lineItemTotal <= 0 || !lineItem.startDate || !lineItem.endDate) return;

                    const lineItemProportion = totalContractValue > 0 ? lineItemTotal / totalContractValue : 0;
                    const remainingLineItemValue = remainingContractValue * lineItemProportion;
                    
                    const startDate = new Date(lineItem.startDate);
                    const endDate = new Date(lineItem.endDate);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    
                    // Logica per totali KPI (da oggi in poi)
                    const projectionStartDate = today > startDate ? today : startDate;
                    if (projectionStartDate <= endDate) {
                        const remainingDurationDays = Math.max(1, (endDate - projectionStartDate) / (1000 * 60 * 60 * 24) + 1);
                        const futureDailyCost = remainingLineItemValue / remainingDurationDays;
                        for (let d = new Date(projectionStartDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                             if (d >= filterStartDate && d <= filterEndDate) {
                                spesaPrevista += futureDailyCost;
                                if (supplierId) supplierProjections[supplierId] = (supplierProjections[supplierId] || 0) + futureDailyCost;
                                if (sectorId) sectorProjections[sectorId] = (sectorProjections[sectorId] || 0) + futureDailyCost;
                                if (branchId === genericoBranchId && sectorId) {
                                    const sectorBranches = branchesPerSector.get(sectorId) || [];
                                    if (sectorBranches.length > 0) {
                                        const costPerBranch = futureDailyCost / sectorBranches.length;
                                        sectorBranches.forEach(branch => { branchProjections[branch.id] = (branchProjections[branch.id] || 0) + costPerBranch; });
                                    }
                                 } else if (branchId) {
                                    branchProjections[branchId] = (branchProjections[branchId] || 0) + futureDailyCost;
                                 }
                             }
                        }
                    }

                    // Logica separata per il grafico mensile (storico)
                    const totalDurationDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24) + 1);
                    const historicalDailyCost = remainingLineItemValue / totalDurationDays;
                    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                         if (d >= filterStartDate && d <= filterEndDate) {
                            monthlyTotals[d.getMonth()].projected += historicalDailyCost;
                         }
                    }
                });
            });
        }
        
        const annualBudgetTotal = sectorBudgets.reduce((sum, sb) => sum + (sb.maxAmount || 0), 0);
        let currentSectorBudget = annualBudgetTotal;
        if (selectedSector !== 'all') {
            const sectorBudgetInfo = sectorBudgets.find(sb => sb.sectorId === selectedSector);
            currentSectorBudget = sectorBudgetInfo?.maxAmount || 0;
        }
        
        let budgetTotale = 0;
        const numberOfDays = (filterEndDate - filterStartDate) / (1000 * 60 * 60 * 24) + 1;
        const isFullYear = numberOfDays > 360; 

        if (selectedSector === 'all') {
            budgetTotale = isFullYear ? annualBudgetTotal : (annualBudgetTotal / 365) * numberOfDays;
        } else {
            const sectorBudgetInfo = sectorBudgets.find(sb => sb.sectorId === selectedSector);
            const annualSectorBudget = sectorBudgetInfo?.maxAmount || 0;
            budgetTotale = isFullYear ? annualSectorBudget : (annualSectorBudget / 365) * numberOfDays;
        }

        const monthlyData = monthlyTotals.map((data, i) => ({
            mese: new Date(new Date().getFullYear(), i).toLocaleString('it-IT', { month: 'short' }),
            real: data.real,
            projected: data.projected,
        }));
        
        const sectorData = orderedSectors.map(sector => {
            const budgetInfo = sectorBudgets.find(sb => sb.sectorId === sector.id);
            const spent = totals.bySector[sector.name] || 0;
            const projections = sectorProjections[sector.id] || 0;
            let budget = budgetInfo?.maxAmount || 0;
            if (!isFullYear) {
                 budget = (budget / 365) * numberOfDays;
            }
            return { id: sector.id, name: sector.name, spent, budget, projections };
        }).filter(s => s.budget > 0 || s.spent > 0 || s.projections > 0);
            
        const topSuppliers = Object.entries(totals.bySupplier)
            .map(([supplierId, spent]) => ({ id: supplierId, name: supplierMap.get(supplierId) || 'N/D', spent, projections: supplierProjections[supplierId] || 0 }))
            .filter(s => s.name !== 'N/D').sort((a, b) => (b.spent + (b.projections || 0)) - (a.spent + (a.projections || 0))).slice(0, 5);
        const totalSuppliersSpent = topSuppliers.reduce((sum, s) => sum + s.spent + (s.projections || 0), 0);
        
        const allBranches = Object.entries(totals.byBranch)
            .map(([branchId, spent]) => ({ id: branchId, name: branchMap.get(branchId) || 'N/D', spent, projections: branchProjections[branchId] || 0 }))
            .filter(b => b.name !== 'N/D').sort((a, b) => (b.spent + (b.projections || 0)) - (a.spent + (a.projections || 0)));
        const totalBranchesSpent = allBranches.reduce((sum, b) => sum + b.spent + (b.projections || 0), 0);

        return { spesaSostenuta, spesaPrevista, budgetTotale, monthlyData, sectorData, topSuppliers, allBranches, isFullYear, annualBudgetTotal, currentSectorBudget, totalSuppliersSpent, totalBranchesSpent };
    }, [isLoading, allExpenses, allContracts, allBudgets, sectorBudgets, startDate, endDate, selectedSector, suppliers, sectors, branches, showProjections, supplierMap, sectorMap, branchMap, orderedSectors]);
    
    const totalForecast = metrics.spesaSostenuta + (showProjections ? metrics.spesaPrevista : 0);
    const utilizationRate = metrics.budgetTotale > 0 ? (totalForecast / metrics.budgetTotale) * 100 : 0;
    const remainingBudget = metrics.budgetTotale - totalForecast;
    const isOverBudgetRisk = totalForecast > metrics.budgetTotale;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="relative p-4 lg:p-8 space-y-6">
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg"><BarChart3 className="w-7 h-7" /></div>
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-black text-gray-900">Dashboard</h1>
                            <p className="text-gray-600 font-medium mt-1">Panoramica performance e budget marketing</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/70 backdrop-blur-sm rounded-full border border-white/30">
                        <Activity className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-semibold text-gray-700">Aggiornato: {lastUpdate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                    <div className="space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all" />
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all" />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button onClick={() => handleQuickDateChange('last_month')} className="px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200 transition-colors">Ultimo mese</button>
                                <button onClick={() => handleQuickDateChange('last_quarter')} className="px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200 transition-colors">Trimestre</button>
                                <button onClick={() => handleQuickDateChange('last_6_months')} className="px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200 transition-colors">6 mesi</button>
                                <button onClick={() => handleQuickDateChange('last_12_months')} className="px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200 transition-colors">12 mesi</button>
                                {hasActiveFilters && (
                                    <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 bg-red-100 hover:bg-red-200 rounded-full transition-all">
                                        <XCircle className="w-4 h-4" />
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="border-t border-gray-200/80 pt-4">
                           <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                               <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
                                   <button onClick={() => setSelectedSector('all')} className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all flex items-center gap-2 ${selectedSector === 'all' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                       <Layers className="w-4 h-4" /> 
                                       <span className="hidden sm:inline">Tutti i Settori</span><span className="sm:hidden">Tutti</span>
                                   </button>
                                   {orderedSectors.map(sector => {
                                       const isActive = selectedSector === sector.id;
                                       return (
                                           <button key={sector.id} onClick={() => setSelectedSector(sector.id)} className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all flex items-center gap-2 ${isActive ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                                               {getSectorIcon(sector.name, `w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`)}
                                               <span className="hidden sm:inline">{sector.name}</span><span className="sm:hidden">{sector.name.includes('&') ? sector.name.split('&')[0] : sector.name}</span>
                                           </button>
                                       );
                                   })}
                               </div>
                               <div className="flex items-center gap-3 p-2 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                                   <label className="flex items-center gap-2 cursor-pointer">
                                       <input type="checkbox" checked={showProjections} onChange={(e) => setShowProjections(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                       <div className="flex items-center gap-1.5">
                                           <TrendingUp className="w-4 h-4 text-indigo-600" />
                                           <span className="font-semibold text-indigo-900 text-sm">Includi Proiezioni</span>
                                       </div>
                                   </label>
                               </div>
                           </div>
                        </div>
                    </div>
                </div>

                {isOverBudgetRisk && (
                    <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-2xl p-4 lg:p-6 flex flex-col sm:flex-row items-start gap-3">
                        <div className="p-2 bg-red-100 rounded-lg flex-shrink-0"> <AlertTriangle className="w-5 h-5 text-red-600" /> </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-red-900 mb-1 text-sm lg:text-base">Attenzione: Rischio Sforamento Budget</h4>
                            <p className="text-xs lg:text-sm text-red-700">Con le proiezioni attuali, la spesa totale prevista ({formatCurrency(totalForecast)}) supera il budget del periodo ({formatCurrency(metrics.budgetTotale)}). <span className="font-semibold">Sforamento: {formatCurrency(Math.abs(remainingBudget))}</span></p>
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                    <KpiCard title={metrics.isFullYear ? "Budget Totale Anno" : "Budget del Periodo"} value={formatCurrency(metrics.budgetTotale)} subtitle={`${metrics.sectorData.length} settori attivi`} icon={<Target />} gradient="from-indigo-500 to-purple-600" />
                    <KpiCard title="Spesa Effettiva" value={formatCurrency(metrics.spesaSostenuta)} subtitle={`${utilizationRate.toFixed(1)}% utilizzato`} icon={<DollarSign />} gradient="from-emerald-500 to-green-600" />
                    <KpiCard title="Proiezioni Contratti" value={formatCurrency(showProjections ? metrics.spesaPrevista : 0)} subtitle={showProjections ? "Da contratti attivi" : "Disabilitate"} icon={<TrendingUp />} gradient="from-cyan-500 to-blue-600" />
                    <KpiCard title={isOverBudgetRisk ? "Sforamento Previsto" : "Budget Residuo"} value={formatCurrency(Math.abs(remainingBudget))} subtitle={isOverBudgetRisk ? "⚠️ Attenzione richiesta" : "Disponibile"} icon={isOverBudgetRisk ? <AlertTriangle /> : <CheckCircle />} gradient={isOverBudgetRisk ? "from-red-500 to-rose-600" : "from-amber-500 to-orange-600"} />
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 lg:mb-8">
                        <div>
                            <h2 className="text-xl lg:text-2xl font-black text-gray-900 mb-2">Andamento Spesa Mensile</h2>
                            <p className="text-sm lg:text-base text-gray-600 font-medium">Confronto tra spesa effettiva{showProjections ? ', proiezioni' : ''} e budget mensile medio</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs mt-3 sm:mt-0">
                            <div className="flex items-center gap-2"><div className="w-4 h-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded"></div><span className="text-gray-600 font-medium">Effettiva</span></div>
                            {showProjections && (<div className="flex items-center gap-2"><div className="w-4 h-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded"></div><span className="text-gray-600 font-medium">Proiezioni</span></div>)}
                        </div>
                    </div>
                    {(() => {
                        const monthlyDataWithTotal = metrics.monthlyData.map(m => ({ ...m, total: m.real + (showProjections ? m.projected : 0) }));
                        const monthlyAvgBudget = metrics.currentSectorBudget / 12;
                        const maxMonthValue = Math.max(...monthlyDataWithTotal.map(m => m.total), 0);
                        const maxValue = Math.max(maxMonthValue, monthlyAvgBudget * 1.05); 
                        const chartMaxValue = maxValue * 1.15;
                        const budgetLinePosition = (monthlyAvgBudget / chartMaxValue) * 100;
                        return (
                            <div className="relative pt-4 border-t border-gray-200/80">
                                {monthlyAvgBudget > 0 && (
                                    <div className="absolute left-0 right-0 border-t-2 border-dashed border-red-400/70 z-[1]" style={{ bottom: `calc(${budgetLinePosition}% + 1.75rem)` }}>
                                        <span className="absolute -top-2 right-0 text-xs text-red-500 font-bold bg-white/50 backdrop-blur-sm px-1 rounded">Budget Medio</span>
                                    </div>
                                )}
                                <div className="h-64 flex items-end justify-between gap-2">
                                    {monthlyDataWithTotal.map((month, i) => {
                                        const barHeight = chartMaxValue > 0 ? (month.total / chartMaxValue) * 100 : 0;
                                        const realHeight = month.total > 0 ? (month.real / month.total) * 100 : 0;
                                        const isCurrentMonth = i === new Date().getMonth() && new Date().getFullYear() === new Date(endDate).getFullYear();
                                        return (
                                            <div key={month.mese} className="h-full w-full flex flex-col items-center justify-end group text-center">
                                                <div className="relative w-full h-full flex items-end justify-center">
                                                    <div className="absolute bottom-full mb-2 w-max max-w-[200px] p-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                                        <p className="font-bold">{formatCurrency(month.total)}</p>
                                                        <p>Budget Medio: {formatCurrency(monthlyAvgBudget)}</p>
                                                        <hr className="border-gray-600 my-1" />
                                                        <p>Effettiva: {formatCurrency(month.real)}</p>
                                                        {showProjections && <p>Proiezioni: {formatCurrency(month.projected)}</p>}
                                                    </div>
                                                    <div className="w-[65%] bg-gradient-to-t from-indigo-500 to-purple-600 rounded-t-lg hover:shadow-lg hover:brightness-110 transition-all z-[2] relative" style={{ height: `${barHeight}%` }}>
                                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-500 to-orange-600 rounded-t-lg" style={{ height: `${realHeight}%` }} />
                                                    </div>
                                                </div>
                                                <span className={`h-7 pt-2 text-xs font-bold ${isCurrentMonth ? 'text-indigo-600' : 'text-gray-500'}`}>{month.mese.toUpperCase()}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {selectedSector === 'all' && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-xl lg:text-2xl font-black text-gray-900 mb-2">Performance per Settore</h2>
                                <p className="text-sm lg:text-base text-gray-600 font-medium">Analisi utilizzo budget per business unit</p>
                            </div>
                            <button onClick={() => navigate && navigate('expenses')} className="flex items-center gap-2 px-4 lg:px-6 py-2 lg:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all hover:scale-105 text-sm">
                                Vedi Spese Dettaglio
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                            {metrics.sectorData.map(sector => (<SectorCard key={sector.id} sector={sector} onClick={() => setSelectedSector(sector.id)} />))}
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {metrics.topSuppliers.length > 0 && (
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8">
                            <div className="flex items-center justify-between mb-6 lg:mb-8">
                                <div>
                                    <h2 className="text-xl lg:text-2xl font-black text-gray-900 mb-2">Top 5 Fornitori</h2>
                                    <p className="text-sm lg:text-base text-gray-600 font-medium">Classificati per volume di spesa{showProjections ? ' e proiezioni' : ''}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                                    <Award className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                {metrics.topSuppliers.map((supplier, i) => (<SupplierRankItem key={i} supplier={supplier} rank={i} totalSpent={metrics.totalSuppliersSpent} />))}
                            </div>
                        </div>
                    )}
                    
                    {metrics.allBranches.length > 0 && (
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8">
                            <div className="flex items-center justify-between mb-6 lg:mb-8">
                                <div>
                                    <h2 className="text-xl lg:text-2xl font-black text-gray-900 mb-2">Performance Filiali</h2>
                                    <p className="text-sm lg:text-base text-gray-600 font-medium">Tutte le sedi aziendali ordinate per spesa</p>
                                </div>
                                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
                                    <Building2 className="w-6 h-6" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                {metrics.allBranches.map((branch, i) => (<BranchItem key={i} branch={branch} rank={i} onClick={() => navigate && navigate('expenses', { branchFilter: [branch.id] })} totalSpent={metrics.totalBranchesSpent} />))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}