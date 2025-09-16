import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, orderBy } from 'firebase/firestore';
import { PlusCircle, Trash2, X, DollarSign, Target, SlidersHorizontal, ChevronDown, Layers, Search, XCircle, Car, Sailboat, Caravan, Building2, Lightbulb, AlertTriangle, ArrowUpCircle, ArrowDownCircle, CheckCircle2, TrendingUp, Calendar, Filter, BarChart3, Activity, Zap, Settings, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import BudgetAllocationModal from '../components/BudgetAllocationModal';

// Funzione Helper per il calcolo della competenza
const calculateAccrualPortion = (item, filterStartDate, filterEndDate) => {
    const isAmortized = item.isAmortized || item.isProjection;
    const startDate = item.amortizationStartDate || item.startDate;
    const endDate = item.amortizationEndDate || item.endDate;
    
    if (!isAmortized) {
        const itemDate = new Date(item.date);
        return (itemDate >= filterStartDate && itemDate <= filterEndDate) ? item.amount : 0;
    }
    
    if (!startDate || !endDate) {
        return 0;
    }

    const expenseStart = new Date(startDate);
    expenseStart.setHours(0, 0, 0, 0);
    const expenseEnd = new Date(endDate);
    expenseEnd.setHours(23, 59, 59, 999);
    
    const durationDays = (expenseEnd - expenseStart) / (1000 * 60 * 60 * 24) + 1;
    if (durationDays <= 0) return 0;

    const dailyCost = item.amount / durationDays;
    const overlapStart = new Date(Math.max(filterStartDate, expenseStart));
    const overlapEnd = new Date(Math.min(filterEndDate, expenseEnd));

    if (overlapStart > overlapEnd) {
        return 0;
    }
    
    const overlapDays = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24) + 1;
    return dailyCost * overlapDays;
};

// --- COMPONENTI UI ---

const KpiCard = ({ title, value, icon, gradient, subtitle }) => (
    <div className="group relative bg-white/90 backdrop-blur-2xl rounded-2xl lg:rounded-3xl shadow-lg border border-white/30 p-5 lg:p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
        <div className="absolute -right-4 -top-4 text-gray-200/50 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
            {React.cloneElement(icon, { className: "w-20 h-20 lg:w-24 lg:h-24" })}
        </div>
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} text-white shadow-md`}>
                    {React.cloneElement(icon, { className: "w-5 h-5" })}
                </div>
                <p className="text-sm font-bold text-gray-600 tracking-wide uppercase">{title}</p>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-gray-900 leading-tight">{value}</p>
            {subtitle && <p className="text-sm text-gray-500 font-medium mt-1">{subtitle}</p>}
        </div>
    </div>
);

const ProgressBar = ({ spend, budget, isUnexpected }) => {
    const budgetValue = budget || 0;
    const spendValue = spend || 0;
    
    if (isUnexpected) {
        return (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                {spendValue > 0 && (
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.3)_8px,rgba(255,255,255,0.3)_16px)]"></div>
                    </div>
                )}
            </div>
        );
    }
    
    const percentage = budgetValue > 0 ? (spendValue / budgetValue) * 100 : (spendValue > 0 ? 100 : 0);
    
    const getColor = () => {
        if (spendValue > budgetValue && budgetValue > 0) return 'from-red-500 to-red-600';
        if (percentage > 85) return 'from-amber-500 to-orange-500';
        return 'from-emerald-500 to-green-600';
    };

    return (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className={`h-full rounded-full bg-gradient-to-r ${getColor()} transition-all duration-700`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
        </div>
    );
};

const StatusBadge = ({ spend, budget, isUnexpected }) => {
    const badgeStyles = "px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 border";
    if (isUnexpected) {
        return <span className={`${badgeStyles} bg-amber-50 text-amber-700 border-amber-200`}>Extra Budget</span>;
    }
    if (!budget || budget === 0) {
        return <span className={`${badgeStyles} bg-gray-100 text-gray-600 border-gray-200`}>Senza Budget</span>;
    }
    const percentage = (spend / budget) * 100;
    if (spend > budget) {
        return <span className={`${badgeStyles} bg-red-50 text-red-700 border-red-200`}>Superato</span>;
    } else if (percentage > 85) {
        return <span className={`${badgeStyles} bg-amber-50 text-amber-700 border-amber-200`}>In Esaurimento</span>;
    } else {
        return <span className={`${badgeStyles} bg-emerald-50 text-emerald-700 border-emerald-200`}>In Linea</span>;
    }
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

export default function BudgetPage() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [suppliers, setSuppliers] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [selectedSector, setSelectedSector] = useState('all');
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedSuppliers, setExpandedSuppliers] = useState({});

    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const marketingChannelMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.name])), [marketingChannels]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);

    useEffect(() => {
        setIsLoading(true);
        const unsubs = [
            onSnapshot(query(collection(db, "channels"), orderBy("name")), snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), snap => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "marketing_channels"), orderBy("name")), snap => setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "contracts")), snap => setContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "budgets"), where("year", "==", year)), snap => {
                const cleanedBudgets = snap.docs.map(doc => ({ ...doc.data(), id: doc.id, supplierId: doc.data().supplierId }));
                setBudgets(cleanedBudgets);
            }),
            onSnapshot(query(collection(db, "expenses")), snap => {
                const cleanedExpenses = snap.docs.map(doc => {
                    const data = doc.data();
                    const id = doc.id;
                    let lineItems = [];
                    if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
                        lineItems = data.lineItems.map((item) => ({ ...item, assignmentId: item.assignmentId || data.branchId || "" }));
                    } else {
                        lineItems.push({ description: data.description || 'Voce principale', amount: data.amount || 0, marketingChannelId: data.marketingChannelId || "", assignmentId: data.branchId || "" });
                    }
                    return { ...data, id, supplierId: data.supplierId || data.channelId, lineItems };
                });
                setExpenses(cleanedExpenses);
            })
        ];

        const checkLoading = onSnapshot(query(collection(db, "channels")), (snap) => {
            if (!snap.empty) {
                setIsLoading(false);
                checkLoading();
            }
        });

        return () => unsubs.forEach(unsub => unsub());
    }, [year]);

    const supplierData = useMemo(() => {
        if (isLoading) return { allSuppliers: [] };
        
        const filterStartDate = new Date(year, 0, 1);
        const filterEndDate = new Date(year, 11, 31);

        const actualExpenses = expenses.map(exp => ({ ...exp, isProjection: false }));
        const contractProjections = contracts.map(contract => {
            const spentOnContract = expenses
                .filter(exp => exp.relatedContractId === contract.id)
                .reduce((sum, exp) => sum + exp.amount, 0);
            const remainingAmount = contract.totalAmount - spentOnContract;
            if (remainingAmount <= 0) return null;
            return {
                id: `proj_${contract.id}`, amount: remainingAmount,
                startDate: contract.startDate, endDate: contract.endDate,
                supplierId: contract.supplierId, sectorId: contract.sectorId,
                branchId: contract.branchId,
                isProjection: true,
            };
        }).filter(Boolean);

        const combinedData = [...actualExpenses, ...contractProjections];

        let filteredSuppliers = suppliers;
        if (searchTerm.trim() !== '') filteredSuppliers = filteredSuppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedSector !== 'all') filteredSuppliers = filteredSuppliers.filter(s => s.associatedSectors?.includes(selectedSector));

        const processedData = filteredSuppliers.map(supplier => {
            const budgetDoc = budgets.find(b => b.supplierId === supplier.id);
            const allAllocations = budgetDoc?.allocations || [];
            const supplierItems = combinedData.filter(item => item.supplierId === supplier.id);
            const totalSpend = supplierItems.reduce((sum, item) => sum + calculateAccrualPortion(item, filterStartDate, filterEndDate), 0);
            
            const details = allAllocations.map(alloc => {
                let detailedSpend = 0;
                const relevantItems = supplierItems.filter(item => item.sectorId === alloc.sectorId);

                relevantItems.forEach(item => {
                    const amountToConsider = calculateAccrualPortion(item, filterStartDate, filterEndDate);
                    if (amountToConsider <= 0) return;
                    
                    if (item.isProjection) {
                        if (item.branchId === alloc.branchId) {
                            detailedSpend += amountToConsider;
                        }
                    } else {
                        const prorationRatio = item.amount > 0 ? amountToConsider / item.amount : 0;
                        (item.lineItems || []).forEach(lineItem => {
                            if (lineItem.marketingChannelId !== alloc.marketingChannelId) return;
                            const itemAmount = (lineItem.amount || 0) * prorationRatio;
                            
                            const genericoBranch = branches.find(b => b.name.toLowerCase() === 'generico');
                            const targetBranchId = alloc.branchId;
                            const itemBranchId = lineItem.assignmentId;

                            if (itemBranchId === targetBranchId) {
                                detailedSpend += itemAmount;
                            } else if (itemBranchId === genericoBranch?.id) {
                                const realBranches = branches.filter(b => b.id !== genericoBranch?.id);
                                const sectorToBranchesMap = new Map(sectors.map(sector => [sector.id, realBranches.filter(b => b.associatedSectors?.includes(sector.id))]));
                                const frattinGroupSector = sectors.find(s => s.name === 'Frattin Group');
                                let targetBranches = (item.sectorId === frattinGroupSector?.id) ? realBranches : (sectorToBranchesMap.get(item.sectorId) || []);
                                if (targetBranches.some(b => b.id === targetBranchId)) {
                                    if (targetBranches.length > 0) {
                                        detailedSpend += (itemAmount / targetBranches.length);
                                    }
                                }
                            }
                        });
                    }
                });
                const branchName = branchMap.get(alloc.branchId) || 'N/D';
                const channelName = marketingChannelMap.get(alloc.marketingChannelId) || 'N/D';
                const name = `${channelName} - ${branchName}`;
                return { ...alloc, totalSpend: detailedSpend, name };
            });

            const totalBudget = details.reduce((sum, d) => sum + (d.budgetAmount || 0), 0);
            return { ...supplier, totalBudget, totalSpend, details, isUnexpected: budgetDoc?.isUnexpected || false };
        });

        const sortedData = processedData.sort((a, b) => {
            const aHasIssues = a.isUnexpected || (a.totalSpend > a.totalBudget && a.totalBudget > 0);
            const bHasIssues = b.isUnexpected || (b.totalSpend > b.totalBudget && b.totalBudget > 0);
            if (aHasIssues && !bHasIssues) return -1;
            if (!aHasIssues && bHasIssues) return 1;
            return b.totalSpend - a.totalSpend;
        });

        return { allSuppliers: sortedData };
    }, [isLoading, suppliers, budgets, expenses, contracts, selectedSector, searchTerm, branches, sectors, year, branchMap, marketingChannelMap, sectorMap]);

    const globalKpis = useMemo(() => {
        const totalSpend = supplierData.allSuppliers.reduce((sum, item) => sum + item.totalSpend, 0);
        const totalBudget = supplierData.allSuppliers.reduce((sum, item) => sum + item.totalBudget, 0);
        const utilizationPercentage = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
        return { totalSpend, totalBudget, utilizationPercentage };
    }, [supplierData]);

    const handleOpenModal = (supplier) => {
        const budgetDoc = budgets.find(b => b.supplierId === supplier.id);
        setSelectedSupplier({ ...supplier, allocations: budgetDoc?.allocations || [], isUnexpected: budgetDoc?.isUnexpected || false });
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedSupplier(null);
    };

    const toggleSupplier = (supplierId) => {
        const supplier = supplierData.allSuppliers.find(s => s.id === supplierId);
        if (supplier?.details.length > 0) {
            setExpandedSuppliers(prev => ({ ...prev, [supplierId]: !prev[supplierId] }));
        }
    };

    const handleSaveBudget = async (allocations, isUnexpected) => {
        if (!selectedSupplier || !year) return;
        const toastId = toast.loading("Salvataggio budget in corso...");
        try {
            const budgetQuery = query(collection(db, "budgets"), where("year", "==", year), where("supplierId", "==", selectedSupplier.id));
            const existingDocs = await getDocs(budgetQuery);
            const dataToSave = { year, supplierId: selectedSupplier.id, allocations, isUnexpected, updatedAt: serverTimestamp() };
            const batch = writeBatch(db);
            if (existingDocs.empty) {
                const newDocRef = doc(collection(db, "budgets"));
                batch.set(newDocRef, { ...dataToSave, createdAt: serverTimestamp() });
            } else {
                const docRef = existingDocs.docs[0].ref;
                batch.update(docRef, dataToSave);
            }
            await batch.commit();
            toast.success("Budget salvato con successo!", { id: toastId });
            handleCloseModal();
        } catch (error) {
            console.error("Errore nel salvataggio del budget:", error);
            toast.error("Errore durante il salvataggio.", { id: toastId });
        }
    };

    const resetFilters = () => { 
        setSearchTerm(''); 
        setSelectedSector('all'); 
        toast.success("Filtri resettati!"); 
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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 text-white shadow-lg">
                            <Target className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-black text-gray-900">Controllo Budget</h1>
                            <p className="text-gray-600 font-medium mt-1">Analisi e gestione budget per fornitore e settore</p>
                        </div>
                    </div>
                    <select 
                        value={year} 
                        onChange={e => setYear(parseInt(e.target.value))} 
                        className="h-12 px-4 bg-white/80 backdrop-blur-sm border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all font-semibold text-lg"
                    >
                        {[2, 1, 0, -1, -2].map(offset => { 
                            const y = new Date().getFullYear() + offset;
                            return <option key={y} value={y}>{y}</option>; 
                        })}
                    </select>
                </div>

                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                    <div className="space-y-4">
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="flex-1">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input 
                                        type="text" 
                                        placeholder="Cerca fornitore..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        className="w-full h-12 pl-12 pr-4 bg-white border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                            <div className="flex items-center gap-2 lg:gap-3 flex-wrap w-full xl:w-auto">
                                <button 
                                    onClick={() => setSelectedSector('all')} 
                                    className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 ${
                                        selectedSector === 'all' 
                                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' 
                                            : 'bg-white/80 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:scale-105'
                                    }`}
                                >
                                    <Layers className="w-3 h-3 lg:w-4 lg:h-4" /> 
                                    <span className="hidden sm:inline">Tutti i Settori</span>
                                    <span className="sm:hidden">Tutti</span>
                                </button>
                                {sectors.map(sector => {
                                    const isActive = selectedSector === sector.id;
                                    const iconClassName = `w-3 h-3 lg:w-4 lg:h-4 ${isActive ? 'text-white' : 'text-gray-400'}`;
                                    return (
                                        <button 
                                            key={sector.id} 
                                            onClick={() => setSelectedSector(sector.id)} 
                                            className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 hover:scale-105 ${
                                                isActive 
                                                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' 
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
                            {(searchTerm || selectedSector !== 'all') && (
                                <button 
                                    onClick={resetFilters}
                                    className="text-xs lg:text-sm font-bold text-red-600 hover:text-white transition-all duration-300 flex items-center gap-1 lg:gap-2 bg-red-100 hover:bg-gradient-to-r hover:from-red-500 hover:to-pink-600 px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl hover:shadow-lg hover:scale-105 w-full xl:w-auto justify-center xl:justify-start"
                                >
                                    <XCircle className="w-3 h-3 lg:w-4 lg:h-4" />Reset Filtri
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <KpiCard 
                        title="Spesa Totale" 
                        value={globalKpis.totalSpend.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} 
                        icon={<DollarSign className="w-6 h-6" />}
                        gradient="from-emerald-500 to-green-600"
                        subtitle="Costi a competenza"
                    />
                    <KpiCard 
                        title="Budget Totale" 
                        value={globalKpis.totalBudget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} 
                        icon={<Target className="w-6 h-6" />}
                        gradient="from-blue-500 to-indigo-600"
                        subtitle={`per l'anno ${year}`}
                    />
                    <KpiCard 
                        title="Utilizzo Budget" 
                        value={`${globalKpis.utilizationPercentage.toFixed(1)}%`}
                        subtitle={globalKpis.utilizationPercentage > 100 ? "Budget superato" : "del budget utilizzato"}
                        icon={<Percent className="w-6 h-6" />}
                        gradient={globalKpis.utilizationPercentage > 100 ? "from-red-500 to-red-600" : globalKpis.utilizationPercentage > 85 ? "from-amber-500 to-orange-600" : "from-emerald-500 to-green-600"}
                    />
                </div>

                {supplierData.allSuppliers.length > 0 ? (
                    <div className="space-y-4">
                        {supplierData.allSuppliers.map(supplier => {
                            const isExpanded = !!expandedSuppliers[supplier.id];
                            return (
                                <div key={supplier.id} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden hover:shadow-2xl transition-all duration-300">
                                    <div className="p-4 lg:p-6">
                                        <div className="flex items-center justify-between gap-6">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-green-700 text-white shadow-lg flex-shrink-0">
                                                    {getSectorIcon(sectorMap.get(supplier.associatedSectors?.[0]), "w-5 h-5")}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-xl font-bold text-gray-900 truncate">{supplier.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <StatusBadge spend={supplier.totalSpend} budget={supplier.totalBudget} isUnexpected={supplier.isUnexpected} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end flex-shrink-0">
                                                 <p className="text-2xl font-black bg-gradient-to-r from-emerald-600 to-green-700 bg-clip-text text-transparent">
                                                    {supplier.totalSpend.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                                 </p>
                                                 <p className="text-sm text-gray-500 font-medium">
                                                    su budget di {supplier.totalBudget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                                 </p>
                                            </div>
                                        </div>
                                        <div className="mt-4">
                                            <ProgressBar spend={supplier.totalSpend} budget={supplier.totalBudget} isUnexpected={supplier.isUnexpected} />
                                        </div>
                                    </div>
                                    
                                    <div className="border-t border-gray-100 bg-gray-50/30 px-4 py-2 flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => handleOpenModal(supplier)}
                                            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 font-semibold text-sm rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
                                        >
                                            <Settings className="w-4 h-4" />
                                            Gestisci
                                        </button>
                                        {supplier.details.length > 0 && (
                                            <button 
                                                onClick={() => toggleSupplier(supplier.id)}
                                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200/70 rounded-lg transition-all"
                                            >
                                                <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        )}
                                    </div>

                                    {isExpanded && (
                                        <div className="p-4 lg:p-6 border-t border-gray-200/80 bg-gray-50/50">
                                            <h4 className="font-bold text-gray-800 mb-4 text-base">Dettaglio Allocazioni</h4>
                                            <div className="space-y-4">
                                                {supplier.details.map((detail, index) => {
                                                    const percentage = detail.budgetAmount > 0 ? (detail.totalSpend / detail.budgetAmount) * 100 : 0;
                                                    return(
                                                        <div key={index} className="p-4 bg-white rounded-xl border">
                                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                                                                <p className="font-semibold text-gray-800">{detail.name}</p>
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <span className="font-bold text-gray-900">{detail.totalSpend.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                                                                    <span className="text-gray-500">/</span>
                                                                    <span className="text-gray-600">{detail.budgetAmount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                                                                    <span className={`font-bold ml-2 ${percentage > 100 ? 'text-red-600' : 'text-gray-600'}`}>{percentage.toFixed(1)}%</span>
                                                                </div>
                                                            </div>
                                                            <ProgressBar spend={detail.totalSpend} budget={detail.budgetAmount} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-12 text-center">
                        <div className="p-4 rounded-2xl bg-gray-100 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                            <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Nessun Fornitore Trovato</h3>
                        <p className="text-gray-600">Non ci sono fornitori che corrispondono ai filtri per l'anno {year}.</p>
                    </div>
                )}
            </div>

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