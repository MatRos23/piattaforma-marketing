import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ComposedChart, Line } from 'recharts';
import { DollarSign, Target, Wallet, Building2, Layers, FileText, PiggyBank, SlidersHorizontal, XCircle, ChevronRight, Car, Sailboat, Caravan, TrendingUp, Calendar, Filter, BarChart3, Activity, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

// --- COSTANTI E HELPERS ---
const CHART_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '€ 0,00';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const getSectorIcon = (sectorName, className = "w-4 h-4") => {
    const icons = {
        'Auto': <Car className={className} />,
        'Camper&Caravan': <Caravan className={className} />,
        'Yachting': <Sailboat className={className} />,
        'Frattin Group': <Building2 className={className} />,
        default: <DollarSign className={className} />
    };
    return icons[sectorName] || icons.default;
};

// --- COMPONENTI UI ---
const HarmoniousKpiCard = ({ title, value, subtitle, icon, gradient, isLoading = false }) => {
    return (
        <div className="group relative bg-white/90 backdrop-blur-2xl rounded-2xl lg:rounded-3xl shadow-lg border border-white/30 p-5 lg:p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className="absolute -right-4 -top-4 text-gray-200/50 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
                {React.cloneElement(icon, { className: "w-20 h-20 lg:w-24 lg:h-24" })}
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} text-white shadow-md`}>
                        {React.cloneElement(icon, { className: "w-5 h-5" })}
                    </div>
                    <p className="text-sm font-bold text-gray-600 tracking-wide uppercase">{title}</p>
                </div>
                {isLoading ? (
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-200 rounded-lg w-32 mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                    </div>
                ) : (
                    <>
                        <p className="text-3xl lg:text-4xl font-black text-gray-900 mb-1 leading-tight">
                            {value}
                        </p>
                        {subtitle && (
                            <p className="text-sm text-gray-500 font-medium leading-tight">{subtitle}</p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

const ModernTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-2xl border border-white/20">
                <p className="font-bold text-gray-800 mb-3 text-lg">{label}</p>
                {payload.map((entry, index) => (
                    <div key={index} className="flex items-center justify-between gap-6 text-sm mb-2 last:mb-0">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: entry.color || entry.fill }}></div>
                            <span className="text-gray-600 font-medium">{entry.name}:</span>
                        </div>
                        <span className="font-bold text-gray-900 text-lg">{formatCurrency(entry.value)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

// --- COMPONENTE PRINCIPALE ---
export default function DashboardPage({ navigate }) {
    // Stati dei dati
    const [allExpenses, setAllExpenses] = useState([]);
    const [allContracts, setAllContracts] = useState([]);
    const [allBudgets, setAllBudgets] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    // Stati dei filtri
    const [dateFilter, setDateFilter] = useState(() => {
        const currentYear = new Date().getFullYear();
        return {
            startDate: new Date(currentYear, 0, 1).toISOString().split('T')[0],
            endDate: new Date(currentYear, 11, 31).toISOString().split('T')[0],
        };
    });
    const [selectedSupplier, setSelectedSupplier] = useState('all');
    const [selectedSector, setSelectedSector] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [selectedChannel, setSelectedChannel] = useState('all');
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

    // Mappe per lookup veloci
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    
    // Caricamento dati da Firebase
    useEffect(() => {
        setIsLoading(true);
        const year = new Date(dateFilter.endDate).getFullYear();
        
        const unsubs = [
            onSnapshot(query(collection(db, "expenses")), snap => setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "contracts")), snap => setAllContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "budgets"), where("year", "==", year)), snap => setAllBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), snap => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "marketing_channels"), orderBy("name")), snap => {
                setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            })
        ];
        
        return () => unsubs.forEach(unsub => unsub());
    }, [dateFilter.endDate]);

    // Calcolo delle metriche
    const metrics = useMemo(() => {
        if (isLoading) return { spesaSostenuta: 0, spesaPrevista: 0, budgetTotale: 0, monthlyData: [], sectorData: [], branchData: [], supplierData: [] };

        const filterStartDate = new Date(dateFilter.startDate);
        const filterEndDate = new Date(dateFilter.endDate);
        const year = filterEndDate.getFullYear();
        
        const totals = { bySupplier: {}, bySector: {}, byBranch: {} };
        const supplierTotals = { real: {}, projected: {} }; // Nuovo: tracciamo separatamente reale e proiezioni per fornitore
        const monthlyTotals = Array.from({ length: 12 }, () => ({ real: 0, projected: 0 }));
        
        let spesaSostenuta = 0;
        let spesaPrevista = 0;
        
        const frattinGroupSectorId = sectors.find(s => s.name === 'Frattin Group')?.id;
        const genericoBranchId = branches.find(b => b.name.toLowerCase() === 'generico')?.id;

        const distributeAmount = (amount, item, isForTotals = true, isProjected = false) => {
            // Se è per i totali generali, usa la logica di distribuzione esistente
            if (isForTotals) {
                const supplierName = supplierMap.get(item.supplierld || item.supplierId) || 'Non definito';
                totals.bySupplier[supplierName] = (totals.bySupplier[supplierName] || 0) + amount;
                
                // Traccia separatamente spese reali e proiezioni per fornitore
                if (isProjected) {
                    supplierTotals.projected[supplierName] = (supplierTotals.projected[supplierName] || 0) + amount;
                } else {
                    supplierTotals.real[supplierName] = (supplierTotals.real[supplierName] || 0) + amount;
                }

                // Logica di distribuzione per i totali generali (rimane invariata per i grafici settore/filiale)
                if (selectedSector === 'all') {
                    // Se "tutti i settori" è selezionato, distribuisci Frattin Group
                    if (item.sectorld === frattinGroupSectorId) {
                        const businessSectors = sectors.filter(s => s.id !== frattinGroupSectorId);
                        if (businessSectors.length > 0) {
                            const amountPerSector = amount / businessSectors.length;
                            businessSectors.forEach(sector => {
                                totals.bySector[sector.name] = (totals.bySector[sector.name] || 0) + amountPerSector;
                                const sectorBranches = branches.filter(b => b.id !== genericoBranchId && b.associatedSectors?.includes(sector.id));
                                if (sectorBranches.length > 0) {
                                    const amountPerBranch = amountPerSector / sectorBranches.length;
                                    sectorBranches.forEach(branch => totals.byBranch[branch.name] = (totals.byBranch[branch.name] || 0) + amountPerBranch);
                                }
                            });
                        }
                    } else if ((item.branchld || item.assignmentId) === genericoBranchId) {
                        const sectorName = sectorMap.get(item.sectorld) || 'Non Assegnato';
                        totals.bySector[sectorName] = (totals.bySector[sectorName] || 0) + amount;
                        const targetBranches = branches.filter(b => b.id !== genericoBranchId && b.associatedSectors?.includes(item.sectorld));
                        if (targetBranches.length > 0) {
                            const amountPerBranch = amount / targetBranches.length;
                            targetBranches.forEach(branch => totals.byBranch[branch.name] = (totals.byBranch[branch.name] || 0) + amountPerBranch);
                        } else {
                            totals.byBranch['Non assegnata'] = (totals.byBranch['Non assegnata'] || 0) + amount;
                        }
                    } else {
                        const sectorName = sectorMap.get(item.sectorld) || 'Non Assegnato';
                        const branchName = branchMap.get(item.branchld || item.assignmentId) || 'Non Assegnata';
                        totals.bySector[sectorName] = (totals.bySector[sectorName] || 0) + amount;
                        totals.byBranch[branchName] = (totals.byBranch[branchName] || 0) + amount;
                    }
                } else {
                    // Se un settore specifico è selezionato, conta solo le spese di quel settore
                    const sectorName = sectorMap.get(item.sectorld) || 'Non Assegnato';
                    const branchName = branchMap.get(item.branchld || item.assignmentId) || 'Non Assegnata';
                    totals.bySector[sectorName] = (totals.bySector[sectorName] || 0) + amount;
                    totals.byBranch[branchName] = (totals.byBranch[branchName] || 0) + amount;
                }
            }
            
            // Ritorna true se l'item deve essere incluso nel calcolo mensile filtrato
            if (selectedSector === 'all') {
                return true;
            } else {
                // Per il grafico mensile, includi solo le spese del settore selezionato
                // Frattin Group viene mostrato SOLO se è il settore selezionato
                return item.sectorld === selectedSector;
            }
        };

        allExpenses.forEach(expense => {
            const lineItems = (expense.lineItems && expense.lineItems.length > 0) ? expense.lineItems : [{}];
            lineItems.forEach(li => {
                const item = { 
                    ...expense, 
                    ...li, 
                    amount: li.amount || expense.amount,
                    sectorld: li.sectorld || expense.sectorld || expense.sectorId,
                    branchld: li.branchld || li.assignmentId || expense.branchld || expense.assignmentId
                };
                
                if (selectedSupplier !== 'all' && (item.supplierld || item.supplierId) !== selectedSupplier) return;
                if (selectedBranch !== 'all' && (item.branchld || item.assignmentId) !== selectedBranch) return;
                if (selectedChannel !== 'all' && item.marketingChannelld !== selectedChannel) return;

                // Controllo settore per il grafico mensile
                const shouldIncludeInMonthly = distributeAmount(0, item, false);
                if (selectedSector !== 'all' && !shouldIncludeInMonthly) return;

                if (item.isAmortized && item.amortizationStartDate && item.amortizationEndDate) {
                    const expenseStart = new Date(item.amortizationStartDate);
                    const expenseEnd = new Date(item.amortizationEndDate);
                    const durationDays = (expenseEnd - expenseStart) / (1000 * 60 * 60 * 24) + 1;
                    if (durationDays <= 0) return;
                    const dailyCost = (item.amount || 0) / durationDays;

                    for (let d = new Date(expenseStart); d <= expenseEnd; d.setDate(d.getDate() + 1)) {
                        if (d >= filterStartDate && d <= filterEndDate) {
                            spesaSostenuta += dailyCost;
                            distributeAmount(dailyCost, item, true, false); // false = non è proiezione
                            monthlyTotals[d.getMonth()].real += dailyCost;
                        }
                    }
                } else if (item.date) {
                    const expenseDate = new Date(item.date);
                    if (expenseDate >= filterStartDate && expenseDate <= filterEndDate) {
                        const amount = item.amount || 0;
                        spesaSostenuta += amount;
                        distributeAmount(amount, item, true, false); // false = non è proiezione
                        monthlyTotals[expenseDate.getMonth()].real += amount;
                    }
                }
            });
        });
        
        allContracts.forEach(c => {
            (c.lineItems || []).forEach(li => {
                const item = {...c, ...li, totalAmount: li.totalAmount || 0, startDate: li.startDate, endDate: li.endDate, supplierld: li.supplierld || c.supplierld };
                if (selectedSupplier !== 'all' && item.supplierld !== selectedSupplier) return;
                if (selectedBranch !== 'all' && item.branchld !== selectedBranch) return;
                
                // Controllo settore per proiezioni
                if (selectedSector !== 'all' && item.sectorld !== selectedSector) return;

                const contractStart = new Date(item.startDate);
                const contractEnd = new Date(item.endDate);
                const durationDays = (contractEnd - contractStart) / (1000 * 60 * 60 * 24) + 1;
                if(durationDays <= 0) return;
                const dailyCost = item.totalAmount / durationDays;

                for (let d = new Date(contractStart); d <= contractEnd; d.setDate(d.getDate() + 1)) {
                    if (d >= filterStartDate && d <= filterEndDate) {
                        spesaPrevista += dailyCost;
                        // Aggiungi anche ai totali per fornitore (come proiezione)
                        const supplierName = supplierMap.get(item.supplierld) || 'Non definito';
                        totals.bySupplier[supplierName] = (totals.bySupplier[supplierName] || 0) + dailyCost;
                        supplierTotals.projected[supplierName] = (supplierTotals.projected[supplierName] || 0) + dailyCost;
                        monthlyTotals[d.getMonth()].projected += dailyCost;
                    }
                }
            });
        });

        // Calcolo budget dinamico per settore
        let budgetTotale = 0;
        let monthlyBudget = 0;
        
        if (selectedSector === 'all') {
            // Budget totale quando tutti i settori sono selezionati
            budgetTotale = allBudgets.reduce((sum, budget) => 
                sum + (budget.allocations || []).reduce((allocSum, alloc) => 
                    allocSum + (alloc.budgetAmount || 0), 0), 0);
        } else {
            // Budget specifico per il settore selezionato
            allBudgets.forEach(budget => {
                (budget.allocations || []).forEach(alloc => {
                    if (alloc.sectorId === selectedSector) {
                        budgetTotale += (alloc.budgetAmount || 0);
                    }
                });
            });
        }
        
        monthlyBudget = budgetTotale > 0 ? budgetTotale / 12 : 0;
        
        const spesaTotale = spesaSostenuta + spesaPrevista;

        const monthlyData = monthlyTotals.map((data, i) => ({
            mese: new Date(year, i).toLocaleString('it-IT', { month: 'short' }),
            'Spese Effettive': data.real,
            'Proiezioni': data.projected,
            'Budget Mensile': monthlyBudget,
        }));
        
        return { 
            spesaSostenuta, 
            spesaPrevista,
            budgetTotale, 
            budgetResiduo: budgetTotale - spesaTotale,
            percentualeUtilizzo: budgetTotale > 0 ? (spesaTotale / budgetTotale) * 100 : 0,
            monthlyData, 
            sectorData: Object.entries(totals.bySector).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5), 
            branchData: Object.entries(totals.byBranch).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value), 
            supplierData: Object.entries(totals.bySupplier)
                .map(([name, value]) => ({ 
                    name, 
                    'Spese Effettive': supplierTotals.real[name] || 0,
                    'Proiezioni': supplierTotals.projected[name] || 0,
                    totale: value 
                }))
                .sort((a,b) => b.totale - a.totale)
                .slice(0, 5) 
        };
    }, [isLoading, allExpenses, allContracts, allBudgets, dateFilter, selectedSupplier, selectedSector, selectedBranch, selectedChannel, suppliers, sectors, branches, supplierMap, sectorMap, branchMap]);

    const resetFilters = () => {
        const currentYear = new Date().getFullYear();
        setDateFilter({
            startDate: new Date(currentYear, 0, 1).toISOString().split('T')[0],
            endDate: new Date(currentYear, 11, 31).toISOString().split('T')[0]
        });
        setSelectedSupplier('all');
        setSelectedSector('all');
        setSelectedBranch('all');
        setSelectedChannel('all');
        setIsAdvancedFiltersOpen(false);
        toast.success("Filtri resettati!");
    };
    
    const areAdvancedFiltersActive = selectedChannel !== 'all' || selectedBranch !== 'all';

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div className="text-xl font-semibold text-gray-700">Caricamento dati in corso...</div>
                    <div className="text-gray-500">Sincronizzazione con Firebase</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden">
            <div className="relative p-3 md:p-4 lg:p-6 xl:p-8 space-y-4 md:space-y-5 lg:space-y-6 xl:space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 lg:gap-6">
                    <div className="space-y-3 lg:space-y-4">
                        <div className="flex items-center gap-3 lg:gap-4">
                            <div className="p-2 sm:p-3 lg:p-4 rounded-xl sm:rounded-2xl lg:rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl">
                                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 leading-tight">
                                    Centro di Controllo
                                </h1>
                                <p className="text-sm sm:text-base lg:text-lg text-gray-600 font-medium mt-1 lg:mt-2">
                                    Dashboard avanzato per il monitoraggio budget e performance marketing
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 flex-wrap">
                            <div className="flex items-center gap-2 px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 bg-white/70 backdrop-blur-sm rounded-full border border-white/20">
                                <Activity className="w-3 h-3 lg:w-4 lg:h-4 text-green-500" />
                                <span className="text-xs lg:text-sm font-semibold text-gray-700">Sistema Attivo</span>
                            </div>
                            <div className="flex items-center gap-2 px-2 sm:px-3 lg:px-4 py-1 sm:py-1.5 lg:py-2 bg-white/70 backdrop-blur-sm rounded-full border border-white/20">
                                <Zap className="w-3 h-3 lg:w-4 lg:h-4 text-amber-500" />
                                <span className="text-xs lg:text-sm font-semibold text-gray-700">Ultimo aggiornamento: ora</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="relative bg-white/70 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-2xl border border-white/30 p-4 lg:p-8 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 opacity-50"></div>
                    
                    <div className="relative space-y-4 lg:space-y-6">
                        <div className="flex items-center gap-3 mb-4 lg:mb-6">
                            <div className="p-2 lg:p-3 rounded-xl lg:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                <Filter className="w-5 h-5 lg:w-6 lg:h-6" />
                            </div>
                            <h3 className="text-xl lg:text-2xl font-bold text-gray-800">Filtri Avanzati</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-end">
                            <div className="lg:col-span-5">
                                <label className="text-xs lg:text-sm font-bold text-gray-700 block mb-2 lg:mb-3 flex items-center gap-2">
                                    <Calendar className="w-3 h-3 lg:w-4 lg:h-4" />
                                    Periodo
                                </label>
                                <div className="flex items-center gap-2 lg:gap-3">
                                    <input 
                                        type="date" 
                                        value={dateFilter.startDate} 
                                        onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))} 
                                        className="flex-1 h-10 lg:h-12 px-3 lg:px-4 border-2 border-gray-200 rounded-xl lg:rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-white/80 backdrop-blur-sm text-sm lg:text-base"
                                    />
                                    <span className="text-gray-500 font-semibold text-sm lg:text-base">al</span>
                                    <input 
                                        type="date" 
                                        value={dateFilter.endDate} 
                                        onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))} 
                                        className="flex-1 h-10 lg:h-12 px-3 lg:px-4 border-2 border-gray-200 rounded-xl lg:rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-white/80 backdrop-blur-sm text-sm lg:text-base"
                                    />
                                </div>
                            </div>
                            
                            <div className="lg:col-span-4">
                                <label className="text-xs lg:text-sm font-bold text-gray-700 block mb-2 lg:mb-3">Fornitore</label>
                                <select 
                                    value={selectedSupplier} 
                                    onChange={e => setSelectedSupplier(e.target.value)} 
                                    className="w-full h-10 lg:h-12 px-3 lg:px-4 border-2 border-gray-200 rounded-xl lg:rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-white/80 backdrop-blur-sm text-sm lg:text-base"
                                >
                                    <option value="all">Tutti i Fornitori</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            
                            <div className="lg:col-span-3 flex items-end">
                                <button 
                                    onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)} 
                                    className={`relative w-full h-10 lg:h-12 flex items-center justify-center gap-2 lg:gap-3 px-4 lg:px-6 py-2 lg:py-3 text-xs lg:text-sm font-bold rounded-xl lg:rounded-2xl border-2 transition-all duration-300 ${
                                        areAdvancedFiltersActive 
                                            ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-indigo-500 shadow-lg' 
                                            : 'bg-white/80 text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                                    }`}
                                >
                                    <SlidersHorizontal className="w-4 h-4 lg:w-5 lg:h-5" /> 
                                    <span className="hidden sm:inline">Filtri Avanzati</span>
                                    <span className="sm:hidden">Filtri</span>
                                    {areAdvancedFiltersActive && (
                                        <span className="absolute -top-1 lg:-top-2 -right-1 lg:-right-2 w-3 h-3 lg:w-4 lg:h-4 bg-gradient-to-r from-pink-500 to-red-500 rounded-full border-2 border-white"></span>
                                    )}
                                </button>
                            </div>
                        </div>
                        
                        <div className="border-t-2 border-gray-100 pt-4 lg:pt-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                            <div className="flex items-center gap-2 lg:gap-3 flex-wrap w-full xl:w-auto">
                                <button 
                                    onClick={() => setSelectedSector('all')} 
                                    className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 ${
                                        selectedSector === 'all' 
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                                            : 'bg-transparent border-2 border-transparent text-gray-500 hover:bg-white/70 hover:text-gray-800 hover:border-gray-200'
                                    }`}
                                >
                                    <Layers className="w-3 h-3 lg:w-4 lg:h-4" /> 
                                    <span className="hidden sm:inline">Tutti i Settori</span>
                                    <span className="sm:hidden">Tutti</span>
                                </button>
                                {sectors.map(sector => (
                                    <button 
                                        key={sector.id} 
                                        onClick={() => setSelectedSector(sector.id)} 
                                        className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 hover:scale-105 ${
                                            selectedSector === sector.id 
                                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' 
                                                : 'bg-transparent border-2 border-transparent text-gray-500 hover:bg-white/70 hover:text-gray-800 hover:border-gray-200'
                                        }`}
                                    >
                                        {getSectorIcon(sector.name, "w-3 h-3 lg:w-4 lg:h-4")}
                                        <span className="hidden sm:inline">{sector.name}</span>
                                        <span className="sm:hidden">{sector.name.includes('&') ? sector.name.split('&')[0] : sector.name}</span>
                                    </button>
                                ))}
                            </div>
                            
                            <button 
                                onClick={resetFilters} 
                                className="text-xs lg:text-sm font-bold text-red-600 hover:text-white transition-all duration-300 flex items-center gap-1 lg:gap-2 bg-red-100 hover:bg-gradient-to-r hover:from-red-500 hover:to-pink-600 px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl hover:shadow-lg hover:scale-105 w-full xl:w-auto justify-center xl:justify-start"
                            >
                                <XCircle className="w-3 h-3 lg:w-4 lg:h-4" />Reset Filtri
                            </button>
                        </div>
                        
                        {isAdvancedFiltersOpen && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 border-t-2 border-gray-100 pt-4 lg:pt-6">
                                <div>
                                    <label className="text-xs lg:text-sm font-bold text-gray-700 block mb-2 lg:mb-3">Canale Marketing</label>
                                    <select 
                                        value={selectedChannel} 
                                        onChange={e => setSelectedChannel(e.target.value)} 
                                        className="w-full h-10 lg:h-12 px-3 lg:px-4 border-2 border-gray-200 rounded-xl lg:rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-white/80 backdrop-blur-sm text-sm lg:text-base"
                                    >
                                        <option value="all">Tutti i Canali</option>
                                        {marketingChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="text-xs lg:text-sm font-bold text-gray-700 block mb-2 lg:mb-3">Filiale</label>
                                    <select 
                                        value={selectedBranch} 
                                        onChange={e => setSelectedBranch(e.target.value)} 
                                        className="w-full h-10 lg:h-12 px-3 lg:px-4 border-2 border-gray-200 rounded-xl lg:rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-white/80 backdrop-blur-sm text-sm lg:text-base"
                                    >
                                        <option value="all">Tutte le Filiali</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4 lg:gap-6">
                    <HarmoniousKpiCard 
                        title="Spesa Sostenuta" 
                        value={formatCurrency(metrics.spesaSostenuta)} 
                        subtitle="Spese registrate nel periodo" 
                        icon={<Wallet className="w-6 h-6 lg:w-7 lg:h-7" />}
                        gradient="from-indigo-500 to-purple-600"
                        isLoading={isLoading}
                    />
                    <HarmoniousKpiCard 
                        title="Proiezioni Contratti" 
                        value={formatCurrency(metrics.spesaPrevista)} 
                        subtitle="Costi futuri da contratti" 
                        icon={<FileText className="w-6 h-6 lg:w-7 lg:h-7" />}
                        gradient="from-cyan-500 to-blue-500"
                        isLoading={isLoading}
                    />
                    <HarmoniousKpiCard 
                        title="Budget Totale" 
                        value={formatCurrency(metrics.budgetTotale)} 
                        subtitle={`Anno ${new Date(dateFilter.endDate).getFullYear()} ${selectedSector !== 'all' ? '- ' + sectorMap.get(selectedSector) : ''}`}
                        icon={<Target className="w-6 h-6 lg:w-7 lg:h-7" />}
                        gradient="from-emerald-500 to-green-600"
                        isLoading={isLoading}
                    />
                    <HarmoniousKpiCard 
                        title="Budget Residuo" 
                        value={formatCurrency(metrics.budgetResiduo)} 
                        subtitle={`${(metrics.percentualeUtilizzo || 0).toFixed(1)}% utilizzato`} 
                        icon={<PiggyBank className="w-6 h-6 lg:w-7 lg:h-7" />}
                        gradient="from-amber-500 to-orange-500"
                        isLoading={isLoading}
                    />
                </div>

                {/* Monthly Chart */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-2xl border border-white/20 p-4 lg:p-8 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-pink-50/50"></div>
                    <div className="relative">
                        <div className="flex items-center justify-between mb-6 lg:mb-8">
                            <div className="flex items-center gap-3 lg:gap-4">
                                <div className="p-2 lg:p-3 rounded-xl lg:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                    <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl lg:text-2xl font-bold text-gray-800">
                                        Andamento Mensile {selectedSector !== 'all' && `- ${sectorMap.get(selectedSector)}`}
                                    </h3>
                                    <p className="text-sm lg:text-base text-gray-600">Performance delle spese nel tempo</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white/50 rounded-full px-3 lg:px-4 py-1.5 lg:py-2">
                                <div className="w-2 h-2 lg:w-3 lg:h-3 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                                <span className="text-xs lg:text-sm font-semibold text-gray-700">Dati Real-time</span>
                            </div>
                        </div>
                        
                        <ResponsiveContainer width="100%" height={350}>
                            <ComposedChart data={metrics.monthlyData}>
                                <defs>
                                    <linearGradient id="speseFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={1}/>
                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                    </linearGradient>
                                    <linearGradient id="proiezioniFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9}/>
                                        <stop offset="100%" stopColor="#c084fc" stopOpacity={0.7}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" opacity={0.6} />
                                <XAxis dataKey="mese" tick={{ fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fontWeight: 500 }} tickFormatter={(value) => `€${(value/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                                <Tooltip content={<ModernTooltip />} />
                                <Legend />
                                <Bar dataKey="Spese Effettive" stackId="a" fill="url(#speseFill)" radius={[0, 0, 0, 0]} stroke="#6366f1" strokeWidth={1} />
                                <Bar dataKey="Proiezioni" stackId="a" fill="url(#proiezioniFill)" radius={[6, 6, 0, 0]} stroke="#a78bfa" strokeWidth={1} />
                                <Line type="monotone" dataKey="Budget Mensile" stroke="#ef4444" strokeWidth={2.5} strokeDasharray="6 3" dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2, fill: '#ffffff' }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {/* Sector Chart */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-2xl border border-white/20 p-4 lg:p-8 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/50 via-blue-50/30 to-indigo-50/50"></div>
                        <div className="relative">
                            <div className="flex items-center gap-3 lg:gap-4 mb-6 lg:mb-8">
                                <div className="p-2 lg:p-3 rounded-xl lg:rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                                    <Layers className="w-5 h-5 lg:w-6 lg:h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl lg:text-2xl font-bold text-gray-800">Distribuzione per Settore</h3>
                                    <p className="text-sm lg:text-base text-gray-600">Analisi delle spese per business unit</p>
                                </div>
                            </div>
                            
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie 
                                        data={metrics.sectorData} 
                                        cx="50%" 
                                        cy="50%" 
                                        labelLine={false} 
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} 
                                        outerRadius={90}
                                        innerRadius={35}
                                        fill="#8884d8" 
                                        dataKey="value"
                                        stroke="rgba(255,255,255,0.8)"
                                        strokeWidth={2}
                                    >
                                        {metrics.sectorData.map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<ModernTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Suppliers Chart */}
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-2xl border border-white/20 p-4 lg:p-8 overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-green-50/30 to-teal-50/50"></div>
                        <div className="relative">
                            <div className="flex items-center gap-3 lg:gap-4 mb-6 lg:mb-8">
                                <div className="p-2 lg:p-3 rounded-xl lg:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                                    <Building2 className="w-5 h-5 lg:w-6 lg:h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl lg:text-2xl font-bold text-gray-800">Top Fornitori</h3>
                                    <p className="text-sm lg:text-base text-gray-600">Spese effettive e proiezioni per partner</p>
                                </div>
                            </div>
                            
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={metrics.supplierData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis type="number" tick={{ fontSize: 11, fontWeight: 500 }} tickFormatter={(value) => `€${(value/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<ModernTooltip />} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="Spese Effettive" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="Proiezioni" stackId="a" fill="#6ee7b7" radius={[0, 6, 6, 0]} opacity={0.7} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Branch Details Table */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-2xl border border-white/20 p-4 lg:p-8 overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 via-pink-50/30 to-rose-50/50"></div>
                    <div className="relative">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 lg:mb-8">
                            <div className="flex items-center gap-3 lg:gap-4">
                                <div className="p-2 lg:p-3 rounded-xl lg:rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                                    <Building2 className="w-5 h-5 lg:w-6 lg:h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl lg:text-2xl font-bold text-gray-800">Dettaglio Spese per Filiale</h3>
                                    <p className="text-sm lg:text-base text-gray-600">Breakdown dettagliato delle performance locali</p>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => navigate('expenses')} 
                                className="group flex items-center gap-2 lg:gap-3 px-4 lg:px-6 py-2 lg:py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl lg:rounded-2xl hover:shadow-lg hover:scale-105 transition-all duration-300 text-sm lg:text-base"
                            >
                                Vedi tutte le spese 
                                <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                        
                        <div className="overflow-hidden rounded-xl lg:rounded-2xl border border-gray-200/50">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                        <tr>
                                            <th className="p-4 lg:p-6 text-left font-bold text-gray-800 text-base lg:text-lg">Filiale</th>
                                            <th className="p-4 lg:p-6 text-right font-bold text-gray-800 text-base lg:text-lg">Spesa Totale</th>
                                            <th className="p-4 lg:p-6 text-right font-bold text-gray-800 text-base lg:text-lg">% sul Totale</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {metrics.branchData && metrics.branchData.map((branch, index) => {
                                            const percentage = metrics.spesaSostenuta > 0 ? ((branch.value / metrics.spesaSostenuta) * 100).toFixed(1) : 'N/A';
                                            return (
                                                <tr key={index} className="hover:bg-indigo-50/50 transition-colors duration-200 group">
                                                    <td className="p-4 lg:p-6">
                                                        <div className="flex items-center gap-3 lg:gap-4">
                                                            <div className={`w-3 h-3 lg:w-4 lg:h-4 rounded-full ${
                                                                index === 0 ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
                                                                index === 1 ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
                                                                index === 2 ? 'bg-gradient-to-r from-purple-400 to-pink-500' :
                                                                'bg-gradient-to-r from-amber-400 to-orange-500'
                                                            }`}></div>
                                                            <span className="font-bold text-gray-900 text-base lg:text-lg group-hover:text-indigo-600 transition-colors">
                                                                {branch.name}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 lg:p-6 text-right">
                                                        <span className="font-bold text-lg lg:text-xl text-gray-900">
                                                            {formatCurrency(branch.value)}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 lg:p-6 text-right">
                                                        <div className="flex items-center justify-end gap-2 lg:gap-3">
                                                            <div className="w-full max-w-[80px] lg:max-w-[100px] bg-gray-200 rounded-full h-2 lg:h-3 overflow-hidden">
                                                                <div 
                                                                    className={`h-full transition-all duration-1000 ease-out ${
                                                                        index === 0 ? 'bg-gradient-to-r from-emerald-400 to-green-500' :
                                                                        index === 1 ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
                                                                        index === 2 ? 'bg-gradient-to-r from-purple-400 to-pink-500' :
                                                                        'bg-gradient-to-r from-amber-400 to-orange-500'
                                                                    }`}
                                                                    style={{ width: `${Math.min(parseFloat(percentage) * 2, 100)}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="font-semibold text-gray-700 min-w-[50px] lg:min-w-[60px] text-sm lg:text-base">
                                                                {percentage}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}