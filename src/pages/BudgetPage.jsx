import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { PlusCircle, X, DollarSign, Target, SlidersHorizontal, ChevronDown, Layers, Search, XCircle, Car, Sailboat, Caravan, Building2, Settings, Percent, TrendingUp, AlertTriangle, CheckCircle, Activity, Zap, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import BudgetAllocationModal from '../components/BudgetAllocationModal';
import { KpiCard } from '../components/SharedComponents';

const SupplierTableView = ({ suppliers, onManage, sectorMap }) => {
    return (
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-emerald-600 to-green-700 text-white">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase">Fornitore</th>
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Stato</th>
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Speso</th>
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Budget</th>
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Utilizzo</th>
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
    {suppliers.map((supplier, index) => {
        const utilizationPercentage = supplier.displayBudget > 0 ? (supplier.displaySpend / supplier.displayBudget) * 100 : 0;
        const supplierIcon = (supplier.associatedSectors?.length || 0) > 1 ? 'default' : sectorMap.get(supplier.associatedSectors?.[0]);

        return (
            <tr key={supplier.id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>

                {/* Fornitore */}
                <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100">
                            {getSectorIcon(supplierIcon, "w-5 h-5 text-gray-600")}
                        </div>
                        <div>
                            <div className="font-bold text-gray-900">{supplier.name}</div>
                            <div className="text-xs text-gray-500">
                                {supplier.associatedSectors?.map(id => sectorMap.get(id)).join(', ')}
                            </div>
                        </div>
                    </div>
                </td>

                {/* Stato */}
                <td className="px-4 py-3">
                    <div className="flex justify-center">
                        <StatusBadge
                            spend={supplier.displaySpend}
                            budget={supplier.displayBudget}
                            isUnexpected={supplier.isUnexpected || supplier.totalBudget === 0}
                        />
                    </div>
                </td>

                {/* Speso */}
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {formatCurrency(supplier.displaySpend)}
                </td>

                {/* Budget */}
                <td className="px-4 py-3 text-right font-medium text-gray-700">
                    {formatCurrency(supplier.displayBudget)}
                </td>

                {/* Utilizzo */}
                <td className="px-4 py-3">
                    {supplier.displayBudget > 0 ? (
                        <div className="flex items-center justify-center gap-2">
    <div className="w-full max-w-[80px] bg-gray-200 rounded-full h-2">
        <div 
            className={`h-full rounded-full bg-gradient-to-r ${
                utilizationPercentage > 100 ? 'from-red-500 to-rose-600' :
                utilizationPercentage > 85 ? 'from-amber-500 to-orange-600' :
                'from-emerald-500 to-green-600'
            }`}
            style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
        />
    </div>
    <span className={`text-xs font-bold w-10 text-right ${
        utilizationPercentage > 100 ? 'text-red-600' : 'text-gray-900'
    }`}>
        {utilizationPercentage.toFixed(0)}%
    </span>
</div>
                    ) : (
                        <span className="text-xs text-gray-500 flex justify-center">-</span>
                    )}
                </td>

                {/* Azioni */}
                <td className="px-4 py-3">
                    <div className="flex items-center justify-center">
                        <button
                            onClick={() => onManage(supplier)}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Gestisci"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
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

// --- COMPONENTI UI MODERNI ---

const ProgressBar = ({ spend, budget, isUnexpected, projections = 0, showProjections = true }) => {
    const budgetValue = budget || 0;
    const spendValue = spend || 0;
    const projectionsValue = showProjections ? (projections || 0) : 0;
    const totalValue = spendValue + projectionsValue;
    
    if (isUnexpected && budgetValue === 0) {
        return (
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
                {totalValue > 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute inset-0 bg-amber-100 rounded-full"></div>
                        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(245,158,11,0.4)_6px,rgba(245,158,11,0.4)_12px)] rounded-full"></div>
                        <span className="relative z-10 text-[10px] font-bold text-amber-700">EXTRA BUDGET</span>
                    </div>
                ) : (
                    <div className="h-full bg-gray-200"></div>
                )}
            </div>
        );
    }
    
    const spendPercentage = budgetValue > 0 ? (spendValue / budgetValue) * 100 : 0;
    const totalPercentage = budgetValue > 0 ? (totalValue / budgetValue) * 100 : 0;
    
    const getSpendGradient = () => {
        if (totalValue > budgetValue && budgetValue > 0) return 'from-red-500 via-red-600 to-rose-600';
        if (totalPercentage > 85) return 'from-amber-500 via-amber-600 to-orange-600';
        return 'from-emerald-500 via-green-600 to-teal-600';
    };
    
    return (
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
            {/* Barra spesa effettiva */}
            <div 
                className={`absolute left-0 top-0 h-full bg-gradient-to-r ${getSpendGradient()} transition-all duration-700 ease-out`} 
                style={{ width: `${Math.min(spendPercentage, 100)}%` }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
            </div>
            
            {/* Barra proiezioni (più chiara) */}
            {showProjections && projectionsValue > 0 && (
                <div 
                    className={`absolute left-0 top-0 h-full bg-gradient-to-r ${getSpendGradient()} opacity-40 transition-all duration-700 ease-out`} 
                    style={{ width: `${Math.min(totalPercentage, 100)}%` }}
                />
            )}
        </div>
    );
};

const StatusBadge = ({ spend, budget, isUnexpected }) => {
    const badgeStyles = "px-3 py-1.5 text-xs font-bold rounded-full flex items-center gap-2 border-2 shadow-sm";
    
    if (isUnexpected && (!budget || budget === 0)) {
        return (
            <span className={`${badgeStyles} bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border-amber-300`}>
                <AlertTriangle className="w-4 h-4" />
                Extra Budget
            </span>
        );
    }
    if (!budget || budget === 0) {
        return (
            <span className={`${badgeStyles} bg-gray-100 text-gray-600 border-gray-300`}>
                <Activity className="w-4 h-4" />
                Senza Budget
            </span>
        );
    }
    
    const percentage = (spend / budget) * 100;
    
    if (spend > budget) {
        return (
            <span className={`${badgeStyles} bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-300`}>
                <AlertTriangle className="w-4 h-4" />
                Budget Superato
            </span>
        );
    }
    if (percentage > 85) {
        return (
            <span className={`${badgeStyles} bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-300`}>
                <Zap className="w-4 h-4" />
                In Esaurimento
            </span>
        );
    }
    return (
        <span className={`${badgeStyles} bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-300`}>
            <CheckCircle className="w-4 h-4" />
            In Linea
        </span>
    );
};

const SupplierCard = ({ supplier, sectorMap, branchMap, marketingChannelMap, onManage, onToggle, isExpanded }) => {
    const supplierIcon = (supplier.associatedSectors?.length || 0) > 1 ? 'default' : sectorMap.get(supplier.associatedSectors?.[0]);
    const utilizationPercentage = supplier.displayBudget > 0 ? (supplier.displaySpend / supplier.displayBudget) * 100 : 0;

    return (
        <div className="group bg-white/80 backdrop-blur-xl rounded-2xl lg:rounded-3xl shadow-xl border border-white/20 overflow-hidden hover:shadow-2xl transition-all duration-300">
            <div className="p-4 lg:p-5">
                {/* STRUTTURA A GRIGLIA DEFINITIVA */}
                <div className="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_384px_180px] items-center gap-4">

                    {/* Colonna 1: Info Base */}
                    <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                        <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-green-700 text-white shadow-lg flex-shrink-0">
                            {getSectorIcon(supplierIcon, "w-5 h-5")}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xl font-bold text-gray-900 truncate">{supplier.name}</h3>
                            <div className="flex items-center gap-2 mt-2">
                                <StatusBadge
                                    spend={supplier.displaySpend}
                                    budget={supplier.displayBudget}
                                    isUnexpected={supplier.isUnexpected || supplier.totalBudget === 0}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Colonna 2: Metriche */}
                    <div className="hidden lg:flex items-center justify-end gap-6">
                        {(supplier.displayBudget > 0) ? (
                            <div className="relative w-14 h-14 flex-shrink-0">
                                <svg className="transform -rotate-90 w-14 h-14">
                                    <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="none" className="text-gray-200" />
                                    <circle
                                        cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="none"
                                        strokeDasharray={`${Math.min(utilizationPercentage, 100) * 1.51} 151`}
                                        className={`transition-all duration-700 ${utilizationPercentage > 100 ? 'text-red-500' :
                                            utilizationPercentage > 85 ? 'text-amber-500' :
                                                'text-emerald-500'
                                            }`}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className={`text-xs font-bold ${utilizationPercentage > 100 ? 'text-red-600' : 'text-gray-900'}`}>
                                        {Math.round(utilizationPercentage)}%
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="w-14 h-14 flex-shrink-0 flex flex-col items-center justify-center bg-amber-100 text-amber-700 rounded-full border-2 border-amber-200" title="Spesa Extra Budget">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="text-[10px] font-bold mt-0.5">Extra</span>
                            </div>
                        )}
                        <div className="text-right w-32">
                            <div className="text-xs text-gray-500 font-medium">Speso</div>
                            <div className="text-lg font-black bg-gradient-to-r from-emerald-600 to-green-700 bg-clip-text text-transparent">
                                {formatCurrency(supplier.displaySpend)}
                            </div>
                        </div>
                        <div className="text-right w-32">
                            <div className="text-xs text-gray-500 font-medium">Budget</div>
                            <div className="text-lg font-black text-gray-900">
                                {formatCurrency(supplier.displayBudget)}
                            </div>
                        </div>
                    </div>

                    {/* Colonna 3: Azioni */}
                    <div className="flex items-center justify-end gap-2">
                        <button
                            onClick={() => onManage(supplier)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-green-700 text-white font-semibold text-sm rounded-xl hover:shadow-lg transition-all hover:scale-105"
                        >
                            <Settings className="w-4 h-4" />
                            Gestisci
                        </button>
                        {supplier.displayDetails && supplier.displayDetails.length > 0 && (
                            <button
                                onClick={() => onToggle(supplier.id)}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all"
                            >
                                <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Area Espandibile */}
            {isExpanded && supplier.displayDetails && supplier.displayDetails.length > 0 && (
                <div className="border-t border-gray-200/80 bg-gradient-to-br from-gray-50/50 to-gray-100/30 p-4 lg:p-6">
                    <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-base">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        Dettaglio Allocazioni Budget
                    </h4>
                    <div className="space-y-4">
                        {(() => {
                            const processedDetails = [];
                            const processed = new Set();
                            supplier.displayDetails.forEach((detail, index) => {
                                if (processed.has(index)) return;
                                const sectorName = sectorMap.get(detail.sectorId);
                                const siblings = supplier.displayDetails.filter((d, i) => i !== index && d.sectorId === detail.sectorId && d.marketingChannelId === detail.marketingChannelId && d.branchId !== detail.branchId);
                                if (sectorName === 'Frattin Group' && siblings.length > 0) {
                                    const allSiblings = [detail, ...siblings];
                                    allSiblings.forEach(s => processed.add(supplier.displayDetails.indexOf(s)));
                                    const totalSpend = allSiblings.reduce((sum, s) => sum + (s.detailedSpend || 0), 0);
                                    const totalBudget = allSiblings.reduce((sum, s) => sum + (s.budgetAmount || 0), 0);
                                    processedDetails.push({ ...detail, detailedSpend: totalSpend, budgetAmount: totalBudget, isGrouped: true, groupCount: allSiblings.length, branchId: 'generic' });
                                } else {
                                    processed.add(index);
                                    processedDetails.push(detail);
                                }
                            });
                            return processedDetails.map((detail, index) => {
                                const percentage = (detail.budgetAmount || 0) > 0 ? ((detail.detailedSpend || 0) / (detail.budgetAmount || 0)) * 100 : 0;
                                const branchName = detail.isGrouped ? 'Generico (distribuito)' : (branchMap.get(detail.branchId) || 'N/D');
                                const channelName = marketingChannelMap.get(detail.marketingChannelId) || 'N/D';
                                const sectorName = sectorMap.get(detail.sectorId) || 'N/D';
                                const allocationName = `${sectorName} → ${channelName} → ${branchName}`;
                                return (
                                    <div key={index} className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-emerald-300 transition-all">
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    {getSectorIcon(sectorName, "w-4 h-4 text-emerald-600")}
                                                    <p className="font-semibold text-gray-800">{allocationName}</p>
                                                    {detail.isGrouped && (<span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{detail.groupCount} filiali</span>)}
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                                    <span className="flex items-center gap-1"><span className="font-medium">Speso:</span><span className="font-bold text-gray-900">{formatCurrency(detail.detailedSpend)}</span></span>
                                                    <span className="flex items-center gap-1"><span className="font-medium">Budget:</span><span className="font-bold text-gray-900">{formatCurrency(detail.budgetAmount)}</span></span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5 flex-shrink-0">
                                                <Percent className="w-3 h-3 text-gray-600" />
                                                <span className={`text-sm font-bold ${percentage > 100 ? 'text-red-600' : percentage > 85 ? 'text-amber-600' : 'text-emerald-600'}`}>{detail.budgetAmount > 0 ? `${percentage.toFixed(1)}%` : 'N/A'}</span>
                                            </div>
                                        </div>
                                        <ProgressBar spend={detail.detailedSpend} budget={detail.budgetAmount} isUnexpected={detail.isUnexpected || (detail.budgetAmount === 0 && detail.detailedSpend > 0)} />
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function BudgetPage() {
    const [year, setYear] = useState(new Date().getFullYear());
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
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedSuppliers, setExpandedSuppliers] = useState({});
    const [sortOrder, setSortOrder] = useState('spend_desc');
    const [unexpectedFilter, setUnexpectedFilter] = useState('all');
    const [includeProjections, setIncludeProjections] = useState(true);
    const [viewMode, setViewMode] = useState('table');

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const marketingChannelMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.name])), [marketingChannels]);

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
        let staticDataLoaded = 0;
        const onStaticDataLoad = () => { 
            staticDataLoaded++; 
            if (staticDataLoaded >= 2) setIsLoading(false); 
        };
        
        const unsubSummaries = onSnapshot(query(collection(db, "budget_summaries"), where("year", "==", year)), snap => setSummaries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubContracts = onSnapshot(query(collection(db, "contracts")), snap => setContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubExpenses = onSnapshot(query(collection(db, "expenses")), snap => setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))); // NUOVO
        const unsubSectors = onSnapshot(query(collection(db, "sectors")), snap => { setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); onStaticDataLoad(); });
        const unsubSuppliers = onSnapshot(query(collection(db, "channels")), snap => { setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); onStaticDataLoad(); });
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
        if (contracts.length === 0 || allExpenses.length === 0) return { bySupplierId: {}, bySectorId: {} };
        
        const filterStartDate = new Date(year, 0, 1);
        const filterEndDate = new Date(year, 11, 31, 23, 59, 59);
        
        // STEP 1: Calcola quanto speso per ogni contratto (come nella Dashboard)
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
        
        const projectionsBySupplierId = {};
        const projectionsBySectorId = {};
        
        // STEP 2: Calcola proiezioni basate sul RESIDUO (come nella Dashboard)
        contracts.forEach(contract => {
            const totalContractValue = (contract.lineItems || []).reduce((sum, li) => sum + (parseFloat(li.totalAmount) || 0), 0);
            const totalSpentOnContract = contractSpentMap.get(contract.id) || 0;
            const remainingContractValue = Math.max(0, totalContractValue - totalSpentOnContract);
            
            // Se il contratto è completamente speso, skip
            if (remainingContractValue <= 0) return;
            
            (contract.lineItems || []).forEach(lineItem => {
                const supplierId = lineItem.supplierld || contract.supplierld;
                const sectorId = lineItem.sectorld;
                
                if (!supplierId) return;
                
                const lineItemTotal = parseFloat(lineItem.totalAmount) || 0;
                if (lineItemTotal <= 0 || !lineItem.startDate || !lineItem.endDate) return;
                
                // Calcola la proporzione di questo lineItem sul totale del contratto
                const lineItemProportion = totalContractValue > 0 ? lineItemTotal / totalContractValue : 0;
                const remainingLineItemValue = remainingContractValue * lineItemProportion;
                
                const startDate = new Date(lineItem.startDate);
                const endDate = new Date(lineItem.endDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // Proietta solo da oggi in poi
                const projectionStartDate = today > startDate ? today : startDate;
                if (projectionStartDate <= endDate) {
                    const remainingDurationDays = Math.max(1, (endDate - projectionStartDate) / (1000 * 60 * 60 * 24) + 1);
                    const futureDailyCost = remainingLineItemValue / remainingDurationDays;
                    
                    for (let d = new Date(projectionStartDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                        if (d >= filterStartDate && d <= filterEndDate) {
                            projectionsBySupplierId[supplierId] = (projectionsBySupplierId[supplierId] || 0) + futureDailyCost;
                            if (sectorId) {
                                projectionsBySectorId[sectorId] = (projectionsBySectorId[sectorId] || 0) + futureDailyCost;
                            }
                        }
                    }
                }
            });
        });
        
        return { bySupplierId: projectionsBySupplierId, bySectorId: projectionsBySectorId };
    }, [contracts, allExpenses, year]);

    const displayData = useMemo(() => {
        let enriched = summaries.map(summary => {
            const supplierInfo = supplierMap.get(summary.supplierId);
            const details = summary.details || [];
            let displaySpend = 0;
            let displayBudget = 0;
            let displayDetails = [];
            const projections = contractProjections.bySupplierId[summary.supplierId] || 0;

            if (selectedSector === 'all') {
                displaySpend = summary.totalSpend;
                displayBudget = summary.totalBudget;
                displayDetails = details;
            } else {
                displayDetails = details.filter(d => d.sectorId === selectedSector);
                displaySpend = displayDetails.reduce((sum, d) => sum + (d.detailedSpend || 0), 0);
                displayBudget = displayDetails.reduce((sum, d) => sum + (d.budgetAmount || 0), 0);
            }
            
            return { 
                ...summary, 
                ...supplierInfo, 
                displaySpend, 
                displayBudget, 
                displayDetails,
                projections
            };
        });

        let filtered = enriched.filter(s => s.displaySpend > 0 || s.displayBudget > 0 || s.projections > 0);
        
        if (selectedSector !== 'all' && filtered.length > 0) {
            filtered = filtered.filter(s => {
                const supplierInfo = supplierMap.get(s.supplierId);
                return supplierInfo?.associatedSectors?.includes(selectedSector);
            });
        }
        
        if (searchTerm.trim() !== '') {
            filtered = filtered.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        
        if (unexpectedFilter === 'unexpected') filtered = filtered.filter(s => s.isUnexpected || s.totalBudget === 0);
        if (unexpectedFilter === 'planned') filtered = filtered.filter(s => !s.isUnexpected && s.totalBudget > 0);
        
        return filtered.sort((a, b) => {
            if (sortOrder === 'name_asc') {
                return (a.name || '').localeCompare(b.name || '');
            }
            const aTotal = a.displaySpend + (includeProjections ? a.projections : 0);
            const bTotal = b.displaySpend + (includeProjections ? b.projections : 0);
            return bTotal - aTotal;
        });
    }, [summaries, supplierMap, selectedSector, searchTerm, sortOrder, unexpectedFilter, contractProjections, includeProjections]);
    
    const globalKpis = useMemo(() => {
        const totalSpend = displayData.reduce((sum, item) => sum + item.displaySpend, 0);
        const totalProjections = displayData.reduce((sum, item) => sum + (item.projections || 0), 0);
        
        let totalMasterBudget = 0;
        if (selectedSector === 'all') {
            totalMasterBudget = sectorBudgets.reduce((sum, item) => sum + (item.maxAmount || 0), 0);
        } else {
            const budgetInfo = sectorBudgets.find(b => b.sectorId === selectedSector);
            totalMasterBudget = budgetInfo?.maxAmount || 0;
        }
        
        const totalAllocatedBudget = displayData.reduce((sum, item) => sum + item.displayBudget, 0);
        const totalForecast = totalSpend + (includeProjections ? totalProjections : 0);
        const utilizationPercentage = totalMasterBudget > 0 ? (totalForecast / totalMasterBudget) * 100 : 0;
        const hasOverrunRisk = includeProjections && totalForecast > totalMasterBudget;
        
        return { totalSpend, totalProjections, totalMasterBudget, totalAllocatedBudget, utilizationPercentage, totalForecast, hasOverrunRisk };
    }, [displayData, sectorBudgets, selectedSector, includeProjections]);
    
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
    
    const toggleSupplier = (supplierId) => { 
        const supplier = displayData.find(s => s.id === supplierId); 
        if (supplier?.displayDetails?.length > 0) {
            setExpandedSuppliers(prev => ({ ...prev, [supplierId]: !prev[supplierId] })); 
        }
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
                        {[0, -1, -2].map(offset => { 
                            const y = new Date().getFullYear() + offset; 
                            return <option key={y} value={y}>{y}</option>; 
                        })}
                    </select>
                </div>
                
                {/* Filtri */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
    <div className="space-y-4">

        {/* --- RIGA 1: RICERCA E VISTA --- */}
        <div className="flex items-center gap-4">
            <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                    type="text" 
                    placeholder="Cerca fornitore..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="w-full h-12 pl-12 pr-4 bg-white border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all"
                />
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setViewMode('cards')} className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:bg-gray-100'}`} title="Vista Card">
                    <LayoutGrid className="w-5 h-5" />
                </button>
                <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:bg-gray-100'}`} title="Vista Tabella">
                    <List className="w-5 h-5" />
                </button>
            </div>
        </div>

       {/* --- RIGA 2: FILTRI SETTORE --- */}
<div className="flex items-center gap-2 lg:gap-3 flex-wrap w-full xl:w-auto">
    <button onClick={() => setSelectedSector('all')} className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-2 ${selectedSector === 'all' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' : 'bg-white/80 border-2 border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
        <Layers className="w-3 h-3 lg:w-4 lg:h-4" /> 
        <span className="hidden sm:inline">Tutti i Settori</span>
        <span className="sm:hidden">Tutti</span>
    </button>
    {orderedSectors.map(sector => {
        const isActive = selectedSector === sector.id;
        const iconClassName = `w-3 h-3 lg:w-4 lg:h-4 ${isActive ? 'text-white' : 'text-gray-400'}`;
        return (
            <button key={sector.id} onClick={() => setSelectedSector(sector.id)} className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 hover:scale-105 ${isActive ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' : 'bg-white/80 border-2 border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                {getSectorIcon(sector.name, iconClassName)}
                <span className="hidden sm:inline">{sector.name}</span>
                <span className="sm:hidden">{sector.name.includes('&') ? sector.name.split('&')[0] : sector.name}</span>
            </button>
        );
    })}
            <div className="flex items-center gap-3 p-2 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={includeProjections}
                        onChange={e => setIncludeProjections(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold text-indigo-900 text-sm">Includi Proiezioni</span>
                    </div>
                </label>
            </div>
        </div>

        {/* --- RIGA 3: FILTRI AVANZATI --- */}
        <div className="border-t border-gray-200/80 pt-4">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setUnexpectedFilter('all')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${unexpectedFilter === 'all' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-100 hover:bg-gray-200'}`}>Tutti</button>
            <button onClick={() => setUnexpectedFilter('planned')} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${unexpectedFilter === 'planned' ? 'bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-lg' : 'bg-gray-100 hover:bg-gray-200'}`}>Previsti</button>
            <button onClick={() => setUnexpectedFilter('unexpected')} className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all ${unexpectedFilter === 'unexpected' ? 'bg-amber-600 text-white shadow-lg' : 'bg-gray-100 hover:bg-gray-200'}`}><AlertTriangle className="w-4 h-4" />Extra</button>
        </div>

        <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-600 flex items-center gap-1.5">
                <ArrowUpDown className="w-4 h-4" />
                Ordina:
            </span>
            <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="h-10 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all text-sm font-semibold"
            >
                <option value="spend_desc">Spesa ↓</option>
                <option value="name_asc">A-Z</option>
            </select>
        </div>

    </div>
</div>
    </div>
</div>
                
                {/* Alert Sforamento Globale */}
                {globalKpis.hasOverrunRisk && (
                    <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-2xl p-4 lg:p-6 flex flex-col sm:flex-row items-start gap-3">
                        <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-red-900 mb-1 text-sm sm:text-base">Attenzione: Rischio Sforamento Budget</h4>
                            <p className="text-xs sm:text-sm text-red-700">
                                Con le proiezioni attuali dei contratti, la spesa totale prevista ({formatCurrency(globalKpis.totalForecast)}) 
                                supera il budget disponibile ({formatCurrency(globalKpis.totalMasterBudget)}). 
                                Considera di rivedere le allocazioni o aumentare il budget master.
                            </p>
                        </div>
                    </div>
                )}

                {/* Lista Fornitori */}
                {displayData.length > 0 ? (
    viewMode === 'cards' ? (
        <div className="space-y-4 mt-6">
            {displayData.map(supplier => (
                <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    sectorMap={sectorMap}
                    branchMap={branchMap}
                    marketingChannelMap={marketingChannelMap}
                    onManage={handleOpenModal}
                    onToggle={toggleSupplier}
                    isExpanded={expandedSuppliers[supplier.id]}
                    includeProjections={includeProjections}
                />
            ))}
        </div>
    ) : (
        <div className="mt-6">
            <SupplierTableView 
                suppliers={displayData}
                onManage={handleOpenModal}
                sectorMap={sectorMap}
            />
        </div>
    )
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
