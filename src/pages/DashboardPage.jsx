import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle, CheckCircle, Clock, Zap, Activity, Award, Building2, Layers, Car, Sailboat, Caravan, Calendar, Filter, ChevronRight, ArrowUpRight, ArrowDownRight, Percent, ShoppingCart, Eye, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '€ 0,00';
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

// HERO KPI CARD
const HeroKpiCard = ({ title, value, subtitle, icon, gradient, trend, comparison, isLoading }) => (
    <div className="group relative bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/40 p-6 lg:p-8 hover:shadow-3xl hover:-translate-y-2 transition-all duration-500 overflow-hidden">
        <div className="absolute -right-6 -top-6 text-gray-200/30 opacity-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700">
            {React.cloneElement(icon, { className: "w-28 h-28 lg:w-32 lg:h-32" })}
        </div>
        
        <div className="relative z-10">
            <div className="flex items-start justify-between mb-4 lg:mb-6">
                <div className={`p-3 lg:p-4 rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-xl`}>
                    {React.cloneElement(icon, { className: "w-6 h-6 lg:w-8 lg:h-8" })}
                </div>
                {trend && (
                    <div className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs lg:text-sm font-bold ${
                        trend.direction === 'up' ? 'bg-emerald-100 text-emerald-700' :
                        trend.direction === 'down' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                    }`}>
                        {trend.direction === 'up' ? <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4" /> : 
                         trend.direction === 'down' ? <TrendingDown className="w-3 h-3 lg:w-4 lg:h-4" /> : 
                         <Activity className="w-3 h-3 lg:w-4 lg:h-4" />}
                        <span>{trend.value}</span>
                    </div>
                )}
            </div>
            
            {isLoading ? (
                <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-10 bg-gray-200 rounded w-32"></div>
                    <div className="h-3 bg-gray-200 rounded w-28"></div>
                </div>
            ) : (
                <>
                    <p className="text-xs lg:text-sm font-bold text-gray-600 tracking-wider uppercase mb-2 lg:mb-3">{title}</p>
                    <p className="text-3xl lg:text-5xl font-black text-gray-900 mb-2 lg:mb-3 leading-none">{value}</p>
                    {subtitle && <p className="text-sm lg:text-base text-gray-600 font-medium">{subtitle}</p>}
                    {comparison && (
                        <div className="mt-3 lg:mt-4 pt-3 lg:pt-4 border-t border-gray-200">
                            <p className="text-xs lg:text-sm text-gray-500">vs anno precedente: <span className="font-bold text-gray-900">{comparison}</span></p>
                        </div>
                    )}
                </>
            )}
        </div>
    </div>
);

// SECTOR CARD
const SectorCard = ({ sector, onClick }) => {
    const utilization = sector.budget > 0 ? (sector.spent / sector.budget) * 100 : 0;
    const isOverBudget = utilization > 100;
    const isWarning = utilization > 85 && utilization <= 100;
    
    return (
        <div 
            onClick={onClick}
            className="group relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-lg border border-white/30 p-5 lg:p-6 hover:shadow-2xl hover:-translate-y-1 hover:border-indigo-300 transition-all duration-300 cursor-pointer overflow-hidden"
        >
            <div className="absolute -right-4 -top-4 text-gray-200/30 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
                {getSectorIcon(sector.name, "w-20 h-20 lg:w-24 lg:h-24")}
            </div>
            
            <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
                            {getSectorIcon(sector.name, "w-5 h-5")}
                        </div>
                        <div>
                            <h3 className="text-base lg:text-lg font-bold text-gray-900">{sector.name}</h3>
                            <p className="text-xs text-gray-500 font-medium">Business Unit</p>
                        </div>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <span className="text-2xl lg:text-3xl font-black text-gray-900">{formatCurrency(sector.spent)}</span>
                        <span className="text-xs lg:text-sm text-gray-500 font-medium">/ {formatCurrency(sector.budget)}</span>
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                            <span className="text-gray-600">Utilizzo Budget</span>
                            <span className={`${
                                isOverBudget ? 'text-red-600' :
                                isWarning ? 'text-amber-600' :
                                'text-emerald-600'
                            }`}>
                                {utilization.toFixed(1)}%
                            </span>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${
                                    isOverBudget ? 'from-red-500 to-rose-600' :
                                    isWarning ? 'from-amber-500 to-orange-600' :
                                    'from-emerald-500 to-green-600'
                                }`}
                                style={{ width: `${Math.min(utilization, 100)}%` }}
                            >
                                <div className="w-full h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="pt-3 border-t border-gray-200 flex justify-between text-xs">
                        <span className="text-gray-500 font-medium">Residuo:</span>
                        <span className="font-bold text-gray-900">{formatCurrency(Math.max(0, sector.budget - sector.spent))}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// SUPPLIER RANK ITEM (con proiezioni)
const SupplierRankItem = ({ supplier, rank }) => {
    const totalForecast = supplier.spent + (supplier.projections || 0);
    const spentUtilization = supplier.budget > 0 ? (supplier.spent / supplier.budget) * 100 : 0;
    const totalUtilization = supplier.budget > 0 ? (totalForecast / supplier.budget) * 100 : 0;
    
    return (
        <div className="flex items-center gap-3 lg:gap-4 p-3 lg:p-4 bg-white/80 rounded-xl hover:bg-white hover:shadow-md transition-all group">
            <div className={`flex items-center justify-center w-8 h-8 lg:w-10 lg:h-10 rounded-full font-black text-base lg:text-lg flex-shrink-0 ${
                rank === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' :
                rank === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                rank === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-700 text-white' :
                'bg-gray-100 text-gray-600'
            }`}>
                {rank + 1}
            </div>
            
            <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate text-sm lg:text-base">{supplier.name}</p>
                <div className="mt-2 space-y-1">
                    {/* Progress bar con spesa + proiezioni */}
                    <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                        {/* Spesa effettiva */}
                        <div 
                            className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-700"
                            style={{ width: `${Math.min(spentUtilization, 100)}%` }}
                        ></div>
                        {/* Proiezioni (overlay trasparente) */}
                        {supplier.projections > 0 && (
                            <div 
                                className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-purple-600 opacity-40 transition-all duration-700"
                                style={{ width: `${Math.min(totalUtilization, 100)}%` }}
                            ></div>
                        )}
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-600">
                            {formatCurrency(supplier.spent)}
                            {supplier.projections > 0 && <span className="text-indigo-600"> +{formatCurrency(supplier.projections)}</span>}
                        </span>
                        <span className="font-bold text-gray-600">
                            {totalUtilization > 0 ? totalUtilization.toFixed(0) : 0}%
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="text-right flex-shrink-0">
                <p className="text-base lg:text-lg font-black text-gray-900">{formatCurrency(supplier.spent)}</p>
                {supplier.budget > 0 && (
                    <p className="text-xs text-gray-500 font-medium">di {formatCurrency(supplier.budget)}</p>
                )}
            </div>
        </div>
    );
};

// BRANCH ITEM (cliccabile)
const BranchItem = ({ branch, rank, onClick }) => (
    <div 
        onClick={onClick}
        className="p-3 lg:p-4 bg-gradient-to-r from-white to-gray-50 rounded-xl border-2 border-gray-200 hover:border-indigo-300 transition-all cursor-pointer"
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`w-7 h-7 lg:w-8 lg:h-8 rounded-full text-white font-black text-xs lg:text-sm flex items-center justify-center ${
                    rank === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500' :
                    rank === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                    rank === 2 ? 'bg-gradient-to-br from-amber-600 to-orange-700' :
                    'bg-gradient-to-br from-blue-500 to-indigo-600'
                }`}>
                    {rank + 1}
                </div>
                <span className="font-bold text-gray-900 text-sm lg:text-base">{branch.name}</span>
            </div>
            <span className="text-base lg:text-lg font-black text-gray-900">{formatCurrency(branch.spent)}</span>
        </div>
    </div>
);

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
    
    const [dateFilter, setDateFilter] = useState(() => {
        const currentYear = new Date().getFullYear();
        return {
            startDate: new Date(currentYear, 0, 1).toISOString().split('T')[0],
            endDate: new Date(currentYear, 11, 31).toISOString().split('T')[0],
        };
    });

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    
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
        if (!user) return;
        
        setIsLoading(true);
        const year = new Date(dateFilter.endDate).getFullYear();
        
        let expensesQuery = query(collection(db, "expenses"));
        let contractsQuery = query(collection(db, "contracts"));
        
        if (user.role === 'collaborator' && user.assignedChannels && user.assignedChannels.length > 0) {
            if (user.assignedChannels.length <= 10) {
                expensesQuery = query(collection(db, "expenses"), where("supplierId", "in", user.assignedChannels));
                contractsQuery = query(collection(db, "contracts"), where("supplierld", "in", user.assignedChannels));
            }
        }
        
        const unsubs = [
            onSnapshot(expensesQuery, snap => setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
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
    }, [dateFilter.endDate, user]);

    const metrics = useMemo(() => {
        if (isLoading) return { 
            spesaSostenuta: 0, spesaPrevista: 0, budgetTotale: 0, 
            monthlyData: [], sectorData: [], topSuppliers: [], allBranches: [] 
        };

        const filterStartDate = new Date(dateFilter.startDate);
        const filterEndDate = new Date(dateFilter.endDate);
        const year = filterEndDate.getFullYear();
        
        const totals = { bySupplier: {}, bySector: {}, byBranch: {} };
        const supplierProjections = {};
        const monthlyTotals = Array.from({ length: 12 }, () => ({ real: 0, projected: 0 }));
        
        let spesaSostenuta = 0;
        let spesaPrevista = 0;
        
        const genericoBranchId = branches.find(b => b.name.toLowerCase() === 'generico')?.id;

        // Funzione di distribuzione SEMPLIFICATA - allineata a ExpensesPage
        const distributeAmount = (amount, item) => {
            // Totali per fornitore (uso l'ID come chiave per evitare problemi di matching)
            const supplierId = item.supplierld || 'unknown';
            totals.bySupplier[supplierId] = (totals.bySupplier[supplierId] || 0) + amount;
            
            // Totali per settore
            const sectorName = sectorMap.get(item.sectorld) || 'Non Assegnato';
            totals.bySector[sectorName] = (totals.bySector[sectorName] || 0) + amount;
            
            // Totali per filiale - SENZA DISTRIBUZIONE
            const branchId = item.branchld || item.assignmentId;
            if (branchId && branchId !== genericoBranchId) {
                totals.byBranch[branchId] = (totals.byBranch[branchId] || 0) + amount;
            }
        };

        // Calcolo spese
        allExpenses.forEach(expense => {
            const lineItems = (expense.lineItems && expense.lineItems.length > 0) ? expense.lineItems : [{}];
            lineItems.forEach(li => {
                const item = { 
                    ...expense, 
                    ...li, 
                    amount: li.amount || expense.amount,
                    sectorld: li.sectorld || expense.sectorld || expense.sectorId,
                    supplierld: li.supplierld || expense.supplierld || expense.supplierId,
                    branchld: li.branchld || li.assignmentId || expense.branchld || expense.assignmentId
                };
                
                if (selectedSector !== 'all' && item.sectorld !== selectedSector) return;

                if (item.isAmortized && item.amortizationStartDate && item.amortizationEndDate) {
                    const expenseStart = new Date(item.amortizationStartDate);
                    const expenseEnd = new Date(item.amortizationEndDate);
                    const durationDays = (expenseEnd - expenseStart) / (1000 * 60 * 60 * 24) + 1;
                    if (durationDays <= 0) return;
                    const dailyCost = (item.amount || 0) / durationDays;

                    for (let d = new Date(expenseStart); d <= expenseEnd; d.setDate(d.getDate() + 1)) {
                        if (d >= filterStartDate && d <= filterEndDate) {
                            spesaSostenuta += dailyCost;
                            distributeAmount(dailyCost, item);
                            monthlyTotals[d.getMonth()].real += dailyCost;
                        }
                    }
                } else if (item.date) {
                    const expenseDate = new Date(item.date);
                    if (expenseDate >= filterStartDate && expenseDate <= filterEndDate) {
                        const amount = item.amount || 0;
                        spesaSostenuta += amount;
                        distributeAmount(amount, item);
                        monthlyTotals[expenseDate.getMonth()].real += amount;
                    }
                }
            });
        });
        
        // Calcolo proiezioni da contratti (per settore e per fornitore ID)
        allContracts.forEach(c => {
            (c.lineItems || []).forEach(li => {
                const item = { ...li, supplierld: li.supplierld || c.supplierld, sectorld: li.sectorld };
                
                if (selectedSector !== 'all' && item.sectorld !== selectedSector) return;
                
                const contractStart = new Date(li.startDate);
                const contractEnd = new Date(li.endDate);
                const durationDays = (contractEnd - contractStart) / (1000 * 60 * 60 * 24) + 1;
                if(durationDays <= 0) return;
                const dailyCost = (li.totalAmount || 0) / durationDays;

                for (let d = new Date(contractStart); d <= contractEnd; d.setDate(d.getDate() + 1)) {
                    if (d >= filterStartDate && d <= filterEndDate) {
                        spesaPrevista += dailyCost;
                        monthlyTotals[d.getMonth()].projected += dailyCost;
                        
                        // Accumula proiezioni per fornitore (usando ID)
                        const supplierId = item.supplierld || 'unknown';
                        supplierProjections[supplierId] = (supplierProjections[supplierId] || 0) + dailyCost;
                    }
                }
            });
        });

        // Calcolo budget totale
        let budgetTotale = 0;
        if (selectedSector === 'all') {
            budgetTotale = sectorBudgets.reduce((sum, sb) => sum + (sb.maxAmount || 0), 0);
        } else {
            const selectedSectorBudget = sectorBudgets.find(sb => sb.sectorId === selectedSector);
            budgetTotale = selectedSectorBudget?.maxAmount || 0;
        }
        
        const monthlyBudget = budgetTotale > 0 ? budgetTotale / 12 : 0;
        
        const monthlyData = monthlyTotals.map((data, i) => ({
            mese: new Date(year, i).toLocaleString('it-IT', { month: 'short' }),
            real: data.real,
            projected: data.projected,
            budget: monthlyBudget,
        }));
        
        // Calcolo dati settori (include Frattin Group)
        const sectorData = (selectedSector === 'all' ? sectors : sectors.filter(s => s.id === selectedSector))
            .map(sector => {
                const budgetInfo = sectorBudgets.find(sb => sb.sectorId === sector.id);
                const spent = totals.bySector[sector.name] || 0;
                const budget = budgetInfo?.maxAmount || 0;
                return { id: sector.id, name: sector.name, spent, budget };
            })
            .filter(s => s.budget > 0 || s.spent > 0);
        
        // Calcolo top suppliers con budget e proiezioni (usando ID)
        const supplierBudgets = new Map();
        allBudgets.forEach(budget => {
            if (budget.supplierId && budget.allocations) {
                const totalBudget = budget.allocations.reduce((sum, alloc) => {
                    if (selectedSector === 'all' || alloc.sectorId === selectedSector) {
                        return sum + (alloc.amount || 0);
                    }
                    return sum;
                }, 0);
                if (totalBudget > 0) {
                    supplierBudgets.set(budget.supplierId, totalBudget);
                }
            }
        });
        
        const topSuppliers = Object.entries(totals.bySupplier)
            .map(([supplierId, spent]) => {
                const supplierName = supplierMap.get(supplierId) || 'Non definito';
                const budget = supplierBudgets.get(supplierId) || 0;
                const projections = supplierProjections[supplierId] || 0;
                return { name: supplierName, spent, budget, projections };
            })
            .sort((a, b) => b.spent - a.spent)
            .slice(0, 5); // Top 5
        
        // Tutte le filiali (usando ID come chiave)
        const allBranches = Object.entries(totals.byBranch)
            .map(([branchId, spent]) => {
                const branchName = branchMap.get(branchId) || 'N/D';
                return { name: branchName, spent, id: branchId };
            })
            .sort((a, b) => b.spent - a.spent);
        
        return { 
            spesaSostenuta, 
            spesaPrevista,
            budgetTotale, 
            monthlyData, 
            sectorData,
            topSuppliers,
            allBranches
        };
    }, [isLoading, allExpenses, allContracts, allBudgets, sectorBudgets, dateFilter, selectedSector, suppliers, sectors, branches, supplierMap, sectorMap, branchMap]);

    const totalForecast = metrics.spesaSostenuta + metrics.spesaPrevista;
    const utilizationRate = metrics.budgetTotale > 0 ? (totalForecast / metrics.budgetTotale) * 100 : 0;
    const remainingBudget = metrics.budgetTotale - totalForecast;
    const isOverBudgetRisk = totalForecast > metrics.budgetTotale;
    
    const resetFilters = () => {
        const currentYear = new Date().getFullYear();
        setDateFilter({
            startDate: new Date(currentYear, 0, 1).toISOString().split('T')[0],
            endDate: new Date(currentYear, 11, 31).toISOString().split('T')[0]
        });
        setSelectedSector('all');
        toast.success("Filtri resettati!");
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div className="text-xl font-semibold text-gray-700">Caricamento dashboard...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="relative p-4 lg:p-8 space-y-6">
                
                {/* HEADER */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 lg:p-4 rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl">
                                <BarChart3 className="w-7 h-7 lg:w-8 lg:h-8" />
                            </div>
                            <div>
                                <h1 className="text-3xl lg:text-5xl font-black text-gray-900 leading-tight">
                                    Marketing Control Center
                                </h1>
                                <p className="text-sm lg:text-lg text-gray-600 font-medium mt-1 lg:mt-2">
                                    Panoramica completa delle performance e budget marketing
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 lg:gap-4 flex-wrap">
                            <div className="flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-white/70 backdrop-blur-sm rounded-full border border-white/30">
                                <Activity className="w-3 h-3 lg:w-4 lg:h-4 text-green-500" />
                                <span className="text-xs lg:text-sm font-semibold text-gray-700">Sistema Attivo</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-white/70 backdrop-blur-sm rounded-full border border-white/30">
                                <Zap className="w-3 h-3 lg:w-4 lg:h-4 text-amber-500" />
                                <span className="text-xs lg:text-sm font-semibold text-gray-700">Aggiornato ora</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <input 
                            type="date" 
                            value={dateFilter.startDate} 
                            onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))} 
                            className="h-10 lg:h-12 px-3 lg:px-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all text-sm lg:text-base"
                        />
                        <input 
                            type="date" 
                            value={dateFilter.endDate} 
                            onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))} 
                            className="h-10 lg:h-12 px-3 lg:px-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all text-sm lg:text-base"
                        />
                    </div>
                </div>
                
                {/* FILTRI SETTORE */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-4 lg:p-6">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                        <div className="flex items-center gap-2 lg:gap-3 flex-wrap w-full xl:w-auto">
                            <button 
                                onClick={() => setSelectedSector('all')} 
                                className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 hover:scale-105 ${
                                    selectedSector === 'all' 
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                                        : 'bg-white/80 border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <Layers className="w-3 h-3 lg:w-4 lg:h-4" /> 
                                <span className="hidden sm:inline">Tutti i Settori</span>
                                <span className="sm:hidden">Tutti</span>
                            </button>
                            {orderedSectors.map(sector => {
                                const isActive = selectedSector === sector.id;
                                const iconClassName = `w-3 h-3 lg:w-4 lg:h-4 ${isActive ? 'text-white' : 'text-gray-400'}`;
                                return (
                                    <button 
                                        key={sector.id} 
                                        onClick={() => setSelectedSector(sector.id)} 
                                        className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 hover:scale-105 ${
                                            isActive 
                                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                                                : 'bg-white/80 border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {getSectorIcon(sector.name, iconClassName)}
                                        <span className="hidden sm:inline">{sector.name}</span>
                                        <span className="sm:hidden">{sector.name.includes('&') ? sector.name.split('&')[0] : sector.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                        
                        {selectedSector !== 'all' && (
                            <button 
                                onClick={resetFilters}
                                className="text-xs lg:text-sm font-bold text-red-600 hover:text-white transition-all duration-300 flex items-center gap-1 lg:gap-2 bg-red-100 hover:bg-gradient-to-r hover:from-red-500 hover:to-pink-600 px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl hover:shadow-lg hover:scale-105 w-full xl:w-auto justify-center xl:justify-start"
                            >
                                <XCircle className="w-3 h-3 lg:w-4 lg:h-4" />Reset Filtri
                            </button>
                        )}
                    </div>
                </div>
                
                {/* ALERT SFORAMENTO */}
                {isOverBudgetRisk && (
                    <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-2xl p-4 lg:p-6 flex flex-col sm:flex-row items-start gap-3">
                        <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-red-900 mb-1 text-sm lg:text-base">Attenzione: Rischio Sforamento Budget</h4>
                            <p className="text-xs lg:text-sm text-red-700">
                                Con le proiezioni attuali dei contratti, la spesa totale prevista ({formatCurrency(totalForecast)}) 
                                supera il budget disponibile ({formatCurrency(metrics.budgetTotale)}). 
                            </p>
                        </div>
                    </div>
                )}
                
                {/* HERO KPIs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                    <HeroKpiCard
                        title="Budget Totale Anno"
                        value={formatCurrency(metrics.budgetTotale)}
                        subtitle={`${metrics.sectorData.length} settori ${selectedSector !== 'all' ? 'filtrato' : 'attivi'}`}
                        icon={<Target />}
                        gradient="from-indigo-500 to-purple-600"
                        isLoading={isLoading}
                    />
                    
                    <HeroKpiCard
                        title="Spesa Effettiva"
                        value={formatCurrency(metrics.spesaSostenuta)}
                        subtitle={`${utilizationRate.toFixed(1)}% del budget utilizzato`}
                        icon={<DollarSign />}
                        gradient="from-emerald-500 to-green-600"
                        isLoading={isLoading}
                    />
                    
                    <HeroKpiCard
                        title="Proiezioni Contratti"
                        value={formatCurrency(metrics.spesaPrevista)}
                        subtitle="Da contratti attivi"
                        icon={<TrendingUp />}
                        gradient="from-cyan-500 to-blue-600"
                        isLoading={isLoading}
                    />
                    
                    <HeroKpiCard
                        title={isOverBudgetRisk ? "Sforamento Previsto" : "Budget Residuo"}
                        value={formatCurrency(Math.abs(remainingBudget))}
                        subtitle={isOverBudgetRisk ? "⚠️ Attenzione richiesta" : "Disponibile"}
                        icon={isOverBudgetRisk ? <AlertTriangle /> : <CheckCircle />}
                        gradient={isOverBudgetRisk ? "from-red-500 to-rose-600" : "from-amber-500 to-orange-600"}
                        isLoading={isLoading}
                    />
                </div>
                
                {/* ANDAMENTO MENSILE */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8">
                    <div className="flex items-center justify-between mb-6 lg:mb-8">
                        <div>
                            <h2 className="text-xl lg:text-2xl font-black text-gray-900 mb-2">Andamento Spesa Mensile</h2>
                            <p className="text-sm lg:text-base text-gray-600 font-medium">Confronto tra spesa effettiva, proiezioni e budget</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        {metrics.monthlyData.map((month, i) => {
                            const total = month.real + month.projected;
                            const percentSpent = month.budget > 0 ? (month.real / month.budget) * 100 : 0;
                            const percentTotal = month.budget > 0 ? (total / month.budget) * 100 : 0;
                            
                            return (
                                <div key={i}>
                                    <div className="flex items-center gap-3 lg:gap-4 mb-2">
                                        <span className="text-xs lg:text-sm font-bold text-gray-600 w-10 lg:w-12">{month.mese}</span>
                                        <div className="flex-1">
                                            <div className="flex justify-between text-xs font-semibold mb-1">
                                                <span className="text-gray-600">
                                                    {formatCurrency(month.real)} 
                                                    {month.projected > 0 && <span className="text-indigo-600"> + {formatCurrency(month.projected)}</span>}
                                                </span>
                                                <span className={`${
                                                    percentTotal > 100 ? 'text-red-600' :
                                                    percentTotal > 85 ? 'text-amber-600' :
                                                    'text-emerald-600'
                                                }`}>
                                                    {percentTotal.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="relative h-6 lg:h-8 bg-gray-200 rounded-lg overflow-hidden">
                                                <div 
                                                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-700"
                                                    style={{ width: `${Math.min(percentSpent, 100)}%` }}
                                                ></div>
                                                {month.projected > 0 && (
                                                    <div 
                                                        className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-purple-600 opacity-40 transition-all duration-700"
                                                        style={{ width: `${Math.min(percentTotal, 100)}%` }}
                                                    ></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="flex items-center justify-center gap-4 lg:gap-6 mt-6 lg:mt-8 pt-6 border-t border-gray-200 flex-wrap">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-gradient-to-r from-amber-500 to-orange-600"></div>
                            <span className="text-xs lg:text-sm font-medium text-gray-600">Spesa Effettiva</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-gradient-to-r from-indigo-500 to-purple-600 opacity-40"></div>
                            <span className="text-xs lg:text-sm font-medium text-gray-600">Proiezioni</span>
                        </div>
                    </div>
                </div>
                
                {/* PERFORMANCE SETTORI */}
                {selectedSector === 'all' && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl lg:text-3xl font-black text-gray-900 mb-2">Performance per Settore</h2>
                                <p className="text-sm lg:text-base text-gray-600 font-medium">Analisi dettagliata dell'utilizzo budget per business unit</p>
                            </div>
                            <button 
                                onClick={() => navigate && navigate('expenses')}
                                className="flex items-center gap-2 px-4 lg:px-6 py-2 lg:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:shadow-lg transition-all hover:scale-105 text-sm lg:text-base"
                            >
                                Vedi Spese
                                <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                            {metrics.sectorData.map(sector => (
                                <SectorCard 
                                    key={sector.id} 
                                    sector={sector} 
                                    onClick={() => setSelectedSector(sector.id)} 
                                />
                            ))}
                        </div>
                    </div>
                )}
                
                {/* TOP PERFORMERS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top 7 Suppliers */}
                    {metrics.topSuppliers.length > 0 && (
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8">
                            <div className="flex items-center justify-between mb-6 lg:mb-8">
                                <div>
                                    <h2 className="text-xl lg:text-2xl font-black text-gray-900 mb-2">Top 5 Fornitori</h2>
                                    <p className="text-sm lg:text-base text-gray-600 font-medium">Classificati per volume di spesa</p>
                                </div>
                                <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                                    <Award className="w-5 h-5 lg:w-6 lg:h-6" />
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                {metrics.topSuppliers.map((supplier, i) => (
                                    <SupplierRankItem key={i} supplier={supplier} rank={i} />
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Tutte le Filiali */}
                    {metrics.allBranches.length > 0 && (
                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8">
                            <div className="flex items-center justify-between mb-6 lg:mb-8">
                                <div>
                                    <h2 className="text-xl lg:text-2xl font-black text-gray-900 mb-2">Performance Filiali</h2>
                                    <p className="text-sm lg:text-base text-gray-600 font-medium">Tutte le sedi aziendali</p>
                                </div>
                                <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                                    <Building2 className="w-5 h-5 lg:w-6 lg:h-6" />
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                {metrics.allBranches.map((branch, i) => (
                                    <BranchItem 
                                        key={i} 
                                        branch={branch} 
                                        rank={i} 
                                        onClick={() => navigate && navigate('expenses', { branchFilter: [branch.id] })} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <style jsx>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                
                .animate-shimmer {
                    animation: shimmer 2s infinite;
                }
            `}</style>
        </div>
    );
}