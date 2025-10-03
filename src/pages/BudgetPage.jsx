import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, orderBy } from 'firebase/firestore';
import { PlusCircle, X, DollarSign, Target, SlidersHorizontal, ChevronDown, Layers, Search, XCircle, Car, Sailboat, Caravan, Building2, Settings, Percent, TrendingUp, AlertTriangle, CheckCircle, Activity, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import BudgetAllocationModal from '../components/BudgetAllocationModal';

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
const KpiCard = ({ title, value, icon, gradient, subtitle, trend }) => (
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
            {trend && (
                <div className="flex items-center gap-1 mt-2">
                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-600">{trend}</span>
                </div>
            )}
        </div>
    </div>
);

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
    const projectionsPercentage = budgetValue > 0 ? (projectionsValue / budgetValue) * 100 : 0;
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
            <div className="p-4 lg:p-6">
                {/* Header Card */}
                <div className="flex items-center justify-between gap-4 mb-4">
                    {/* Colonna Sinistra */}
                    <div className="flex items-center gap-3 lg:gap-4 flex-1 min-w-0">
                        <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-green-700 text-white shadow-lg flex-shrink-0">
                            {getSectorIcon(supplierIcon, "w-5 h-5")}
                        </div>
                        <div className="flex-1 min-w-0">
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
                    
                    {/* Colonna Destra */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="text-right">
                            <p className="text-2xl lg:text-3xl font-black bg-gradient-to-r from-emerald-600 to-green-700 bg-clip-text text-transparent">
                                {formatCurrency(supplier.displaySpend)}
                            </p>
                            <p className="text-sm text-gray-500 font-medium">
                                su {formatCurrency(supplier.displayBudget)}
                            </p>
                        </div>
                        
                        {supplier.displayBudget > 0 && (
                            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1">
                                <Percent className="w-3 h-3 text-gray-600" />
                                <span className={`text-sm font-bold ${
                                    utilizationPercentage > 100 ? 'text-red-600' :
                                    utilizationPercentage > 85 ? 'text-amber-600' :
                                    'text-emerald-600'
                                }`}>
                                    {utilizationPercentage.toFixed(1)}%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mt-4">
                    <ProgressBar 
                        spend={supplier.displaySpend} 
                        budget={supplier.displayBudget} 
                        isUnexpected={supplier.isUnexpected || supplier.totalBudget === 0} 
                    />
                </div>
            </div>
            
            {/* Footer Azioni */}
            <div className="border-t border-gray-100 bg-gradient-to-r from-gray-50/50 to-gray-100/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {supplier.associatedSectors?.map(sectorId => (
                        <div key={sectorId} className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-full text-xs font-semibold text-gray-700 shadow-sm border border-gray-200">
                            {getSectorIcon(sectorMap.get(sectorId), "w-3 h-3 text-gray-600")}
                            {sectorMap.get(sectorId) || '...'}
                        </div>
                    ))}
                </div>
                
                <div className="flex items-center gap-2">
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
            
            {/* Area Espandibile - Dettagli Allocazioni */}
            {isExpanded && supplier.displayDetails && supplier.displayDetails.length > 0 && (
                <div className="border-t border-gray-200/80 bg-gradient-to-br from-gray-50/50 to-gray-100/30 p-4 lg:p-6">
                    <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-base">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        Dettaglio Allocazioni Budget
                    </h4>
                    <div className="space-y-4">
                        {(() => {
                            // Raggruppa allocazioni Frattin Group distribuite su più filiali
                            const processedDetails = [];
                            const processed = new Set();
                            
                            supplier.displayDetails.forEach((detail, index) => {
                                if (processed.has(index)) return;
                                
                                const sectorName = sectorMap.get(detail.sectorId);
                                const channelName = marketingChannelMap.get(detail.marketingChannelId);
                                
                                // Cerca se ci sono altre allocazioni con stesso settore+canale
                                const siblings = supplier.displayDetails.filter((d, i) => 
                                    i !== index &&
                                    d.sectorId === detail.sectorId &&
                                    d.marketingChannelId === detail.marketingChannelId &&
                                    d.branchId !== detail.branchId
                                );
                                
                                // Se Frattin Group + multiple branch = raggruppa
                                if (sectorName === 'Frattin Group' && siblings.length > 0) {
                                    const allSiblings = [detail, ...siblings];
                                    allSiblings.forEach((s, i) => {
                                        const siblingIndex = supplier.displayDetails.indexOf(s);
                                        processed.add(siblingIndex);
                                    });
                                    
                                    const totalSpend = allSiblings.reduce((sum, s) => sum + (s.detailedSpend || 0), 0);
                                    const totalBudget = allSiblings.reduce((sum, s) => sum + (s.budgetAmount || 0), 0);
                                    
                                    processedDetails.push({
                                        ...detail,
                                        detailedSpend: totalSpend,
                                        budgetAmount: totalBudget,
                                        isGrouped: true,
                                        groupCount: allSiblings.length,
                                        branchId: 'generic' // Marker per mostrare "Distribuzione automatica"
                                    });
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
                                                    {detail.isGrouped && (
                                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                                            {detail.groupCount} filiali
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-medium">Speso:</span>
                                                        <span className="font-bold text-gray-900">{formatCurrency(detail.detailedSpend)}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <span className="font-medium">Budget:</span>
                                                        <span className="font-bold text-gray-900">{formatCurrency(detail.budgetAmount)}</span>
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5 flex-shrink-0">
                                                <Percent className="w-3 h-3 text-gray-600" />
                                                <span className={`text-sm font-bold ${
                                                    percentage > 100 ? 'text-red-600' :
                                                    percentage > 85 ? 'text-amber-600' :
                                                    'text-emerald-600'
                                                }`}>
                                                    {detail.budgetAmount > 0 ? `${percentage.toFixed(1)}%` : 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <ProgressBar 
                                            spend={detail.detailedSpend} 
                                            budget={detail.budgetAmount} 
                                            isUnexpected={detail.isUnexpected || (detail.budgetAmount === 0 && detail.detailedSpend > 0)}
                                        />
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
    const [contracts, setContracts] = useState([]); // NUOVO: contratti per proiezioni
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
    const [includeProjections, setIncludeProjections] = useState(true); // NUOVO: toggle proiezioni

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
        const unsubContracts = onSnapshot(query(collection(db, "contracts")), snap => setContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))); // NUOVO
        const unsubSectors = onSnapshot(query(collection(db, "sectors")), snap => { setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); onStaticDataLoad(); });
        const unsubSuppliers = onSnapshot(query(collection(db, "channels")), snap => { setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); onStaticDataLoad(); });
        const unsubBranches = onSnapshot(collection(db, "branches"), snap => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubMarketingChannels = onSnapshot(collection(db, "marketing_channels"), snap => setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        const unsubSectorBudgets = onSnapshot(query(collection(db, "sector_budgets"), where("year", "==", year)), snap => setSectorBudgets(snap.docs.map(doc => doc.data())));
        
        return () => { 
            unsubSummaries(); 
            unsubContracts(); // NUOVO
            unsubSuppliers(); 
            unsubSectors(); 
            unsubBranches(); 
            unsubMarketingChannels(); 
            unsubSectorBudgets(); 
        };
    }, [year]);

    // NUOVO: Calcolo proiezioni da contratti per fornitore e settore
    const contractProjections = useMemo(() => {
        if (contracts.length === 0) return {};
        
        const filterStartDate = new Date(year, 0, 1);
        const filterEndDate = new Date(year, 11, 31, 23, 59, 59);
        const projectionsBySupplierId = {};
        const projectionsBySectorId = {};
        
        contracts.forEach(contract => {
            (contract.lineItems || []).forEach(lineItem => {
                const supplierId = lineItem.supplierld || contract.supplierld;
                const sectorId = lineItem.sectorld;
                
                if (!supplierId) return;
                
                const contractStart = new Date(lineItem.startDate);
                const contractEnd = new Date(lineItem.endDate);
                const durationDays = (contractEnd - contractStart) / (1000 * 60 * 60 * 24) + 1;
                
                if (durationDays <= 0) return;
                
                const dailyCost = (lineItem.totalAmount || 0) / durationDays;
                let projectionAmount = 0;
                
                for (let d = new Date(contractStart); d <= contractEnd; d.setDate(d.getDate() + 1)) {
                    if (d >= filterStartDate && d <= filterEndDate) {
                        projectionAmount += dailyCost;
                    }
                }
                
                if (projectionAmount > 0) {
                    projectionsBySupplierId[supplierId] = (projectionsBySupplierId[supplierId] || 0) + projectionAmount;
                    if (sectorId) {
                        projectionsBySectorId[sectorId] = (projectionsBySectorId[sectorId] || 0) + projectionAmount;
                    }
                }
            });
        });
        
        return { bySupplierId: projectionsBySupplierId, bySectorId: projectionsBySectorId };
    }, [contracts, year]);

    const displayData = useMemo(() => {
        let enriched = summaries.map(summary => {
            const supplierInfo = supplierMap.get(summary.supplierId);
            const details = summary.details || [];
            let displaySpend = 0;
            let displayBudget = 0;
            let displayDetails = [];
            const projections = contractProjections.bySupplierId[summary.supplierId] || 0; // NUOVO

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
                projections // NUOVO
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
            // 'spend_desc': ordina per spesa + proiezioni decrescente
            const aTotal = a.displaySpend + (includeProjections ? a.projections : 0);
            const bTotal = b.displaySpend + (includeProjections ? b.projections : 0);
            return bTotal - aTotal;
        });
    }, [summaries, supplierMap, selectedSector, searchTerm, sortOrder, unexpectedFilter, contractProjections, includeProjections]);
    
    const globalKpis = useMemo(() => {
        const totalSpend = displayData.reduce((sum, item) => sum + item.displaySpend, 0);
        const totalProjections = displayData.reduce((sum, item) => sum + (item.projections || 0), 0); // NUOVO
        
        let totalMasterBudget = 0;
        if (selectedSector === 'all') {
            totalMasterBudget = sectorBudgets.reduce((sum, item) => sum + (item.maxAmount || 0), 0);
        } else {
            const budgetInfo = sectorBudgets.find(b => b.sectorId === selectedSector);
            totalMasterBudget = budgetInfo?.maxAmount || 0;
        }
        
        const totalAllocatedBudget = displayData.reduce((sum, item) => sum + item.displayBudget, 0);
        const totalForecast = totalSpend + (includeProjections ? totalProjections : 0); // NUOVO
        const utilizationPercentage = totalMasterBudget > 0 ? (totalForecast / totalMasterBudget) * 100 : 0; // MODIFICATO
        const hasOverrunRisk = includeProjections && totalForecast > totalMasterBudget; // NUOVO
        
        return { totalSpend, totalProjections, totalMasterBudget, totalAllocatedBudget, utilizationPercentage, totalForecast, hasOverrunRisk };
    }, [displayData, sectorBudgets, selectedSector, includeProjections]);
    
    const sectorKpis = useMemo(() => {
        const spendBySector = summaries.reduce((acc, summary) => {
            (summary.details || []).forEach(detail => {
                if(detail.sectorId) acc[detail.sectorId] = (acc[detail.sectorId] || 0) + (detail.detailedSpend || 0);
            });
            return acc;
        }, {});
        
        // NUOVO: calcola proiezioni per settore
        const projectionsBySector = contractProjections.bySectorId || {};
        
        return orderedSectors.map(sector => {
            const budgetInfo = sectorBudgets.find(b => b.sectorId === sector.id);
            const spend = spendBySector[sector.id] || 0;
            const projections = projectionsBySector[sector.id] || 0;
            const budget = budgetInfo?.maxAmount || 0;
            return { id: sector.id, name: sector.name, spend, projections, budget };
        });
    }, [summaries, orderedSectors, sectorBudgets, contractProjections]);

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
            toast.error("Errore salvataggio.", { id: toastId }); 
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
                                
                                {orderedSectors.map(sector => {
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
                        </div>
                        
                        <div className="border-t border-gray-200/80 pt-4">
                            <div className="space-y-4">
                                {/* Toggle Proiezioni - RESPONSIVE */}
                                <div className="flex items-center justify-center sm:justify-start">
                                    <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border-2 border-indigo-200 w-full sm:w-auto">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={includeProjections}
                                                onChange={e => setIncludeProjections(e.target.checked)}
                                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4 text-indigo-600" />
                                                <span className="font-bold text-indigo-900 text-sm sm:text-base">Includi Proiezioni Contratti</span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                
                                {/* Filtri - RESPONSIVE MIGLIORATO */}
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                    {/* Filtro Tipo */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                        <span className="text-sm font-bold text-gray-600">Tipo:</span>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => setUnexpectedFilter('all')}
                                                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                                                    unexpectedFilter === 'all'
                                                        ? 'bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-lg'
                                                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50'
                                                }`}
                                            >
                                                Tutti
                                            </button>
                                            <button
                                                onClick={() => setUnexpectedFilter('planned')}
                                                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                                                    unexpectedFilter === 'planned'
                                                        ? 'bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-lg'
                                                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50'
                                                }`}
                                            >
                                                Previsti
                                            </button>
                                            <button
                                                onClick={() => setUnexpectedFilter('unexpected')}
                                                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                                    unexpectedFilter === 'unexpected'
                                                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg'
                                                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50'
                                                }`}
                                            >
                                                <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
                                                <span className="hidden xs:inline">Extra Budget</span>
                                                <span className="xs:hidden">Extra</span>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Ordinamento */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                        <span className="text-sm font-bold text-gray-600">Ordina:</span>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => setSortOrder('spend_desc')}
                                                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                                    sortOrder === 'spend_desc'
                                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                                                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                                                }`}
                                            >
                                                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                                                Spesa ↓
                                            </button>
                                            <button
                                                onClick={() => setSortOrder('name_asc')}
                                                className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                                                    sortOrder === 'name_asc'
                                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                                                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                                                }`}
                                            >
                                                A-Z
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Cards Unificata - RESPONSIVE MIGLIORATO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6">
                    {/* KPI Principali */}
                    <KpiCard 
                        title="Spesa Effettiva" 
                        value={formatCurrency(globalKpis.totalSpend)} 
                        icon={<DollarSign className="w-6 h-6" />} 
                        gradient="from-emerald-500 to-green-600" 
                        subtitle="Costi sostenuti" 
                    />
                    <KpiCard 
                        title="Proiezioni" 
                        value={formatCurrency(globalKpis.totalProjections)} 
                        icon={<TrendingUp className="w-6 h-6" />} 
                        gradient="from-indigo-500 to-purple-600" 
                        subtitle="Da contratti firmati" 
                    />
                    <KpiCard 
                        title="Budget Totale" 
                        value={formatCurrency(globalKpis.totalMasterBudget)} 
                        icon={<Target className="w-6 h-6" />} 
                        gradient="from-blue-500 to-indigo-600" 
                        subtitle={`Assegnati ${formatCurrency(globalKpis.totalAllocatedBudget)}`} 
                    />
                    <KpiCard 
                        title="Utilizzo" 
                        value={`${globalKpis.utilizationPercentage.toFixed(1)}%`} 
                        subtitle={includeProjections ? "con proiezioni" : "solo spesa effettiva"} 
                        icon={<Percent className="w-6 h-6" />} 
                        gradient={
                            globalKpis.utilizationPercentage > 100 ? "from-red-500 to-red-600" : 
                            globalKpis.utilizationPercentage > 85 ? "from-amber-500 to-orange-600" : 
                            "from-emerald-500 to-green-600"
                        } 
                    />
                    <KpiCard 
                        title="Budget Residuo" 
                        value={formatCurrency(globalKpis.totalMasterBudget - globalKpis.totalForecast)} 
                        icon={<Activity className="w-6 h-6" />} 
                        gradient={globalKpis.hasOverrunRisk ? "from-red-500 to-red-600" : "from-purple-500 to-pink-600"} 
                        subtitle={globalKpis.hasOverrunRisk ? "⚠️ Sforamento previsto!" : "disponibile"} 
                    />
                </div>
                
                {/* Alert Sforamento Globale - RESPONSIVE MIGLIORATO */}
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

                {/* Distribuzione Spesa per Settore */}
                {selectedSector === 'all' && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                <Layers className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-gray-800">Distribuzione Spesa per Settore</h2>
                                {includeProjections && (
                                    <p className="text-sm text-indigo-600 font-medium">Include proiezioni da contratti</p>
                                )}
                            </div>
                            {/* Legenda Progress Bar */}
                            {includeProjections && (
                                <div className="flex items-center gap-4 text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-2 bg-gradient-to-r from-emerald-500 to-green-600 rounded"></div>
                                        <span className="text-gray-600 font-medium">Spesa effettiva</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-2 bg-gradient-to-r from-emerald-500 to-green-600 opacity-40 rounded"></div>
                                        <span className="text-gray-600 font-medium">Proiezioni</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {sectorKpis.filter(s => s.budget > 0 || s.spend > 0 || s.projections > 0).map(kpi => {
                                const totalForecast = kpi.spend + (includeProjections ? kpi.projections : 0);
                                const percentage = kpi.budget > 0 ? (totalForecast / kpi.budget) * 100 : 0;
                                return (
                                    <div key={kpi.id} className="p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border-2 border-gray-200 hover:border-indigo-300 transition-all">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-600">
                                                {React.cloneElement(getSectorIcon(kpi.name), { className: "w-4 h-4" })}
                                            </div>
                                            <p className="text-xs font-bold text-gray-600 uppercase">{kpi.name}</p>
                                        </div>
                                        <p className="text-xl font-black text-gray-900">{formatCurrency(kpi.spend)}</p>
                                        {includeProjections && kpi.projections > 0 && (
                                            <p className="text-xs text-indigo-600 font-semibold">+ {formatCurrency(kpi.projections)} proiezioni</p>
                                        )}
                                        {kpi.budget > 0 && (
                                            <>
                                                <p className="text-xs text-gray-500 font-medium mt-1">
                                                    su {formatCurrency(kpi.budget)} ({percentage.toFixed(0)}%)
                                                </p>
                                                <div className="mt-3">
                                                    <ProgressBar 
                                                        spend={kpi.spend} 
                                                        budget={kpi.budget} 
                                                        isUnexpected={false}
                                                        projections={kpi.projections}
                                                        showProjections={includeProjections}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Lista Fornitori */}
                {displayData.length > 0 ? (
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