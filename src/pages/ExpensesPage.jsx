import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { PlusCircle, Search, XCircle, Wallet, Car, Sailboat, Caravan, Building2, Layers, DollarSign, FileText, Paperclip, Copy, Pencil, Trash2, AlertTriangle, CheckCircle2, Clock, Calendar, Filter, SlidersHorizontal, ChevronDown, X, TrendingUp, Activity, Zap, FileSignature } from 'lucide-react';
import ExpenseFormModal from '../components/ExpenseFormModal';
import toast from 'react-hot-toast';
import EmptyState from '../components/EmptyState';
import AdvancedFiltersModal from '../components/AdvancedFiltersModal';

const storage = getStorage();

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
    if (typeof number !== 'number') return 'N/A';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

// --- COMPONENTI UI RIDISEGNATI ---
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

const StatusBadge = ({ type, hasInvoice, hasContract, isAmortized }) => {
    const baseClass = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all";
    
    if (isAmortized) {
        return (
            <span className={`${baseClass} bg-purple-50 text-purple-700 border-purple-200`}>
                <Clock className="w-3.5 h-3.5" />
                Competenza
            </span>
        );
    }
    
    if (!hasInvoice && !hasContract) {
        return (
            <span className={`${baseClass} bg-red-50 text-red-700 border-red-200`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                Incompleta
            </span>
        );
    } else if (!hasInvoice) {
        return (
            <span className={`${baseClass} bg-amber-50 text-amber-700 border-amber-200`}>
                <FileText className="w-3.5 h-3.5" />
                No Fattura
            </span>
        );
    } else if (!hasContract) {
        return (
            <span className={`${baseClass} bg-blue-50 text-blue-700 border-blue-200`}>
                <FileSignature className="w-3.5 h-3.5" />
                No Contratto
            </span>
        );
    } else {
        return (
            <span className={`${baseClass} bg-emerald-50 text-emerald-700 border-emerald-200`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completa
            </span>
        );
    }
};

const ExpenseCard = ({ expense, sectorMap, supplierMap, branchMap, marketingChannelMap, contractMap, onEdit, onDelete, onDuplicate, canEditOrDelete, onToggleDetails, isExpanded }) => {
    const locationTags = [...new Set(expense.lineItems?.flatMap(item => 
        item.splitGroupId 
            ? expense.lineItems.filter(li => li.splitGroupId === item.splitGroupId).map(li => li.assignmentId)
            : [item.assignmentId]
    ) || [])].map(id => ({ name: branchMap.get(id), id })).filter(tag => tag.name);
    
    const relatedContract = contractMap.get(expense.relatedContractId);
    const hasInvoice = !!expense.invoicePdfUrl;
    const hasContract = !!expense.contractPdfUrl || !!expense.relatedContractId;
    const sectorName = sectorMap.get(expense.sectorId);

    return (
        <div className="group bg-white/90 backdrop-blur-2xl rounded-2xl lg:rounded-3xl shadow-lg border border-white/30 overflow-hidden hover:shadow-2xl transition-all duration-300">
            {/* Header Card */}
            <div className="p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Colonna Sinistra - Info Principale */}
                    <div className="flex items-start gap-3 lg:gap-4 flex-1 min-w-0">
                        <div className="p-2.5 lg:p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg flex-shrink-0">
                            {getSectorIcon(sectorName, "w-5 h-5 lg:w-6 lg:h-6")}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h3 className="text-lg lg:text-xl font-bold text-gray-900">
                                    {supplierMap.get(expense.supplierId) || 'N/D'}
                                </h3>
                                <StatusBadge hasInvoice={hasInvoice} hasContract={hasContract} isAmortized={expense.isAmortized} />
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{expense.description}</p>
                            
                            {/* Tags Filiali */}
                            {locationTags.length > 0 && (
                                <div className="flex items-center flex-wrap gap-2">
                                    {locationTags.map(tag => (
                                        <span key={tag.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                                            <Building2 className="w-3 h-3" />
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Colonna Destra - Importo e Azioni */}
                    <div className="flex flex-col gap-3 lg:items-end">
                        {/* Importo e Data */}
                        <div className="flex lg:flex-col items-start lg:items-end justify-between lg:justify-start gap-2">
                            <div>
                                <div className="text-2xl lg:text-3xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                                    {formatCurrency(expense.amount)}
                                </div>
                                <div className="flex items-center gap-1.5 text-sm text-gray-500 font-medium mt-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {expense.date ? new Date(expense.date + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/D'}
                                </div>
                            </div>
                        </div>
                        
                        {/* Azioni */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {hasInvoice && (
                                <a href={expense.invoicePdfUrl} target="_blank" rel="noopener noreferrer" 
                                   className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-all" 
                                   title="Visualizza fattura" onClick={e => e.stopPropagation()}>
                                    <Paperclip className="w-4 h-4" />
                                </a>
                            )}
                            {relatedContract?.contractPdfUrl && (
                                <a href={relatedContract.contractPdfUrl} target="_blank" rel="noopener noreferrer" 
                                   className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all" 
                                   title={`Contratto: ${relatedContract.description}`} onClick={e => e.stopPropagation()}>
                                    <FileSignature className="w-4 h-4" />
                                </a>
                            )}
                            {expense.lineItems && expense.lineItems.length > 0 && (
                                <button onClick={() => onToggleDetails(expense.id)} 
                                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                                        title="Mostra dettagli">
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            )}
                            {canEditOrDelete(expense) && (
                                <>
                                    <button onClick={() => onDuplicate(expense)} 
                                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                                            title="Duplica spesa">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onEdit(expense)} 
                                            className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" 
                                            title="Modifica spesa">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => onDelete(expense)} 
                                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                                            title="Elimina spesa">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Area Espandibile - Dettagli */}
            {isExpanded && expense.lineItems && expense.lineItems.length > 0 && (
                <div className="border-t border-gray-100 bg-gradient-to-br from-gray-50/50 to-gray-100/30 p-4 lg:p-6">
                    <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-base">
                        <Activity className="w-4 h-4 text-amber-600" />
                        Dettaglio Voci di Spesa
                    </h4>
                    <div className="space-y-3">
                        {expense.groupedLineItems?.map((item) => (
                            <div key={item._key || item.splitGroupId} className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-amber-300 transition-all">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-800 mb-1">{item.description}</p>
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Canale:</span> {marketingChannelMap.get(item.marketingChannelId) || 'N/D'}
                                        </p>
                                    </div>
                                    <div className="text-lg font-bold text-amber-600">
                                        {formatCurrency(item.amount)}
                                    </div>
                                </div>
                                {item.isGroup ? (
                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                                        <Building2 className="w-4 h-4 text-amber-600" />
                                        <span className="font-medium">Distribuito su {item.branchCount} filiali:</span>
                                        <span className="italic">{item.branchNames}</span>
                                    </div>
                                ) : (
                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                                        <Building2 className="w-4 h-4 text-amber-600" />
                                        <span className="font-medium">Filiale:</span>
                                        <span className="text-amber-700 font-semibold">{branchMap.get(item.assignmentId) || 'N/D'}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function ExpensesPage({ user, initialFilters }) {
    const location = useLocation();
    const [allExpenses, setAllExpenses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [geographicAreas, setGeographicAreas] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('');
    const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
    const [expandedExpenses, setExpandedExpenses] = useState({});
    const [selectedSector, setSelectedSector] = useState('all');
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [invoiceFilter, setInvoiceFilter] = useState('');
    const [contractFilter, setContractFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState([]);
    const [areaFilter, setAreaFilter] = useState('');
    const [specialFilter, setSpecialFilter] = useState(null);

    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const marketingChannelMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.name])), [marketingChannels]);
    const geoAreaMap = useMemo(() => new Map(geographicAreas.map(a => [a.id, a.name])), [geographicAreas]);
    const contractMap = useMemo(() => new Map(contracts.map(c => [c.id, c])), [contracts]);

    useEffect(() => {
        const filters = initialFilters || location.state;
        if (filters && Object.keys(filters).length > 0) {
            if (filters.branchFilter) { 
                setBranchFilter(filters.branchFilter); 
                setIsAdvancedFiltersOpen(true); 
            } else { 
                setBranchFilter([]); 
            }
            if (filters.specialFilter) { 
                setSpecialFilter(filters.specialFilter); 
            } else { 
                setSpecialFilter(null); 
            }
        } else {
            setBranchFilter([]); 
            setSpecialFilter(null);
        }
    }, [initialFilters, location.state]);

    useEffect(() => {
    setIsLoading(true);

    // Query per expenses - filtrata per collaboratori
    let expensesQuery = query(collection(db, "expenses"), orderBy("date", "desc"));
    
    // Se è un collaboratore, filtra per fornitori assegnati
    if (user.role === 'collaborator' && user.assignedChannels && user.assignedChannels.length > 0) {
        // Firestore supporta 'in' per max 10 valori, gestiamo il caso
        if (user.assignedChannels.length <= 10) {
            expensesQuery = query(
                collection(db, "expenses"),
                where("supplierId", "in", user.assignedChannels),
                orderBy("date", "desc")
            );
        }
    }

    const unsubs = [
        onSnapshot(expensesQuery, (snap) => {
                const cleanedExpenses = snap.docs.map((doc) => {
                    const data = doc.data();
                    const id = doc.id;
                    
                    let supplierId = data.supplierId || data.supplierld || data.channelId || data.channelld;
                    let sectorId = data.sectorId || data.sectorld;
                    
                    let lineItems = [];
                    if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
                        lineItems = data.lineItems.map((item, index) => ({
                            ...item,
                            assignmentId: item.assignmentId || item.assignmentid || item.branchld || data.branchId || data.branchld || "",
                            marketingChannelId: item.marketingChannelId || item.marketingChannelld || "",
                            _key: `${doc.id}-${index}`
                        }));
                    } else {
                        lineItems.push({
                            description: data.description || 'Voce principale',
                            amount: data.amount || 0,
                            marketingChannelId: data.marketingChannelId || data.marketingChannelld || "",
                            assignmentId: data.branchId || data.branchld || "",
                            _key: `${doc.id}-0`
                        });
                    }

                    if (!supplierId && lineItems.length > 0) {
                        for (const item of lineItems) {
                            if (item.supplierId || item.supplierld) {
                                supplierId = item.supplierId || item.supplierld;
                                break;
                            }
                        }
                    }
                    if (!sectorId && lineItems.length > 0) {
                        for (const item of lineItems) {
                            if (item.sectorId || item.sectorld) {
                                sectorId = item.sectorId || item.sectorld;
                                break;
                            }
                        }
                    }

                    const groupedLineItems = [];
                    const processedGroupIds = new Set();
                    
                    lineItems.forEach(item => {
                        if (item.splitGroupId) {
                            if (processedGroupIds.has(item.splitGroupId)) return;
                            const groupItems = lineItems.filter(li => li.splitGroupId === item.splitGroupId);
                            const totalGroupAmount = groupItems.reduce((sum, gi) => sum + gi.amount, 0);
                            const branchNames = groupItems.map(gi => branchMap.get(gi.assignmentId) || 'N/D').join(', ');
                            groupedLineItems.push({
                                _key: item.splitGroupId, 
                                isGroup: true, 
                                description: item.description, 
                                amount: totalGroupAmount,
                                marketingChannelId: item.marketingChannelId, 
                                branchNames: branchNames, 
                                branchCount: groupItems.length,
                            });
                            processedGroupIds.add(item.splitGroupId);
                        } else {
                            groupedLineItems.push({ ...item, isGroup: false });
                        }
                    });
                    
                    return { 
                        ...data,
                        id: doc.id, 
                        supplierId,
                        sectorId,
                        supplierld: supplierId,
                        sectorld: sectorId,
                        lineItems, 
                        groupedLineItems 
                    };
                });
                setAllExpenses(cleanedExpenses);
                setIsLoading(false);
                if (user.role === 'collaborator' && (!user.assignedChannels || user.assignedChannels.length === 0)) {
    toast.error("Nessun fornitore assegnato. Contatta un amministratore.", { duration: 5000 });
}
            }),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), (snap) => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), (snap) => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), (snap) => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "marketing_channels"), orderBy("name")), (snap) => setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "geographic_areas"), orderBy("name")), (snap) => setGeographicAreas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "contracts"), orderBy("description")), (snap) => setContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))))
        ];

        return () => unsubs.forEach(unsub => unsub());
    }, [initialFilters, location.state]);

    const filteredExpenses = useMemo(() => {
        let expensesToFilter = [...allExpenses];

        if (specialFilter === 'unassigned') {
            expensesToFilter = expensesToFilter.filter(exp => {
                if (exp.lineItems && exp.lineItems.length > 0) {
                    return exp.lineItems.some(item => {
                        const assignmentId = item.assignmentId;
                        return !assignmentId || !branchMap.has(assignmentId);
                    });
                }
                const branchId = exp.branchId;
                return !branchId || !branchMap.has(branchId);
            });
        }

        if (selectedSector !== 'all') {
            expensesToFilter = expensesToFilter.filter(exp => exp.sectorId === selectedSector);
        }
        
        if (dateFilter.startDate && dateFilter.endDate) {
            const start = new Date(dateFilter.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(dateFilter.endDate);
            end.setHours(23, 59, 59, 999);
            expensesToFilter = expensesToFilter.filter(exp => {
                const expDate = exp.date ? new Date(exp.date) : null;
                return expDate && expDate >= start && expDate <= end;
            });
        }

        if (supplierFilter) {
            expensesToFilter = expensesToFilter.filter(exp => exp.supplierId === supplierFilter);
        }
        
        if (contractFilter === 'present') expensesToFilter = expensesToFilter.filter(exp => !!exp.contractPdfUrl || !!exp.relatedContractId);
        if (contractFilter === 'missing') expensesToFilter = expensesToFilter.filter(exp => !exp.contractPdfUrl && !exp.relatedContractId);
        if (invoiceFilter === 'present') expensesToFilter = expensesToFilter.filter(exp => !!exp.invoicePdfUrl);
        if (invoiceFilter === 'missing') expensesToFilter = expensesToFilter.filter(exp => !exp.invoicePdfUrl);
        
        if (areaFilter) {
            const area = geographicAreas.find(a => a.id === areaFilter);
            const branchesInArea = area?.associatedBranches || [];
            expensesToFilter = expensesToFilter.filter(exp => 
                exp.lineItems?.some(item => branchesInArea.includes(item.assignmentId))
            );
        }
        
        if (branchFilter.length > 0) {
            expensesToFilter = expensesToFilter.filter(exp => 
                exp.lineItems?.some(item => branchFilter.includes(item.assignmentId))
            );
        }

        if (searchTerm.trim() !== '') {
            const lowerSearchTerm = searchTerm.toLowerCase();
            expensesToFilter = expensesToFilter.filter(exp => {
                const channelNames = [...new Set(exp.lineItems?.map(item => item.marketingChannelId).filter(Boolean))]
                    .map(id => marketingChannelMap.get(id) || "").join(' ');
                return exp.description?.toLowerCase().includes(lowerSearchTerm) ||
                    supplierMap.get(exp.supplierId)?.toLowerCase().includes(lowerSearchTerm) ||
                    exp.lineItems?.some(item => item.description?.toLowerCase().includes(lowerSearchTerm)) ||
                    channelNames.toLowerCase().includes(lowerSearchTerm);
            });
        }
        
        return expensesToFilter;
    }, [allExpenses, searchTerm, supplierFilter, invoiceFilter, contractFilter, dateFilter, selectedSector, branchFilter, areaFilter, specialFilter, supplierMap, marketingChannelMap, geographicAreas, branchMap]);

    const totalFilteredSpend = useMemo(() => filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0), [filteredExpenses]);
    
    const kpiData = useMemo(() => {
        const total = filteredExpenses.length;
        const withInvoice = filteredExpenses.filter(exp => exp.invoicePdfUrl).length;
        const withContract = filteredExpenses.filter(exp => exp.contractPdfUrl || exp.relatedContractId).length;
        const amortized = filteredExpenses.filter(exp => exp.isAmortized).length;
        const complete = filteredExpenses.filter(exp => exp.invoicePdfUrl && (exp.contractPdfUrl || exp.relatedContractId)).length;
        
        return {
            totalExpenses: total,
            totalSpend: totalFilteredSpend,
            withInvoicePercentage: total > 0 ? ((withInvoice / total) * 100).toFixed(1) : 0,
            withContractPercentage: total > 0 ? ((withContract / total) * 100).toFixed(1) : 0,
            completePercentage: total > 0 ? ((complete / total) * 100).toFixed(1) : 0,
            amortizedCount: amortized
        };
    }, [filteredExpenses, totalFilteredSpend]);

    const toggleExpense = (expenseId) => {
        setExpandedExpenses(prev => ({ ...prev, [expenseId]: !prev[expenseId] }));
    };

    const canEditOrDelete = (expense) => {
        return user.role === 'manager' || user.role === 'admin' || expense.authorId === user.uid;
    };

    const handleOpenAddModal = () => { 
        setEditingExpense(null); 
        setIsModalOpen(true); 
    };

    const handleCloseModal = () => { 
        setIsModalOpen(false); 
        setEditingExpense(null); 
    };

    const handleOpenEditModal = (expense) => {
        if (!canEditOrDelete(expense)) {
            return toast.error("Non hai i permessi per modificare questa spesa.");
        }
        setEditingExpense(expense);
        setIsModalOpen(true);
    };
    
    const handleSaveExpense = async (expenseData, invoiceFile, contractFile) => {
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
            
            if (expenseData.isAmortized && (!expenseData.amortizationStartDate || !expenseData.amortizationEndDate)) {
                throw new Error("Se la spesa è per competenza, le date di inizio e fine sono obbligatorie.");
            }
            
            if (expenseData.isAmortized && new Date(expenseData.amortizationStartDate) >= new Date(expenseData.amortizationEndDate)) {
                throw new Error("La data di inizio competenza deve essere precedente alla data di fine.");
            }
            
            const cleanLineItems = expenseData.lineItems;
            if (cleanLineItems.length === 0) {
                throw new Error("Aggiungere almeno una voce di spesa valida.");
            }
            
            const finalTotalAmount = cleanLineItems.reduce((sum, item) => sum + item.amount, 0);
            
            const dataToSave = {
                date: expenseData.date,
                description: expenseData.description,
                sectorId: expenseData.sectorId,
                supplierId: expenseData.supplierId,
                isMultiBranch: expenseData.isMultiBranch,
                branchId: expenseData.branchId,
                amount: finalTotalAmount,
                lineItems: cleanLineItems,
                invoicePdfUrl: invoiceURL,
                contractPdfUrl: contractURL,
                relatedContractId: expenseData.relatedContractId || null,
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
    };
    
    const handleDeleteExpense = async (expense) => {
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
            toast.success("Spesa eliminata con successo!", { id: toastId });
        } catch (error) {
            console.error("Errore durante l'eliminazione:", error);
            toast.error("Errore durante l'eliminazione.", { id: toastId });
        }
    };
    
    const handleDuplicateExpense = (expenseToDuplicate) => {
        const { id, invoicePdfUrl, contractPdfUrl, createdAt, updatedAt, authorId, authorName, ...restOfExpense } = expenseToDuplicate;
        const newExpenseData = { 
            ...restOfExpense, 
            description: `${expenseToDuplicate.description || ''} (Copia)`, 
            date: new Date().toISOString().split('T')[0] 
        };
        setEditingExpense(newExpenseData);
        setIsModalOpen(true);
    };
    
    const resetFilters = () => {
        setSearchTerm(''); 
        setSupplierFilter(''); 
        setDateFilter({ startDate: '', endDate: '' }); 
        setSelectedSector('all');
        setInvoiceFilter(''); 
        setContractFilter(''); 
        setBranchFilter([]); 
        setAreaFilter(''); 
        setSpecialFilter(null);
        toast.success("Filtri resettati!");
    };

    const areAdvancedFiltersActive = invoiceFilter || contractFilter || branchFilter.length > 0 || areaFilter;
    const hasActiveFilters = searchTerm || supplierFilter || dateFilter.startDate || dateFilter.endDate || selectedSector !== 'all' || areAdvancedFiltersActive || specialFilter;

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
                {/* Header Moderno */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 text-white shadow-lg">
                            <Wallet className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-black text-gray-900">Gestione Spese</h1>
                            <p className="text-gray-600 font-medium">Monitora e gestisci tutte le spese aziendali</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleOpenAddModal} 
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all hover:scale-105"
                    >
                        <PlusCircle className="w-5 h-5" />
                        Aggiungi Spesa
                    </button>
                </div>

                {/* Filtri Moderni */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                            <div className="lg:col-span-2">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input 
                                        type="text" 
                                        placeholder="Cerca per descrizione, fornitore, canale..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        className="w-full h-12 pl-12 pr-4 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <input 
                                    type="date" 
                                    value={dateFilter.startDate} 
                                    onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))} 
                                    className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                                    placeholder="Data inizio"
                                />
                            </div>
                            <div>
                                <input 
                                    type="date" 
                                    value={dateFilter.endDate} 
                                    onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))} 
                                    className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                                    placeholder="Data fine"
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                                <select 
                                    value={supplierFilter} 
                                    onChange={(e) => setSupplierFilter(e.target.value)} 
                                    className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                                >
                                    <option value="">Tutti i fornitori</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setIsAdvancedFiltersOpen(true)} 
                                    className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl border-2 transition-all hover:scale-105 ${
                                        areAdvancedFiltersActive 
                                            ? 'bg-amber-100 text-amber-700 border-amber-300' 
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <SlidersHorizontal className="w-4 h-4" />
                                    Filtri Avanzati
                                    {areAdvancedFiltersActive && (
                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white"></span>
                                    )}
                                </button>
                                
                                {hasActiveFilters && (
                                    <button 
                                        onClick={resetFilters}
                                        className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-red-600 hover:text-white bg-red-100 hover:bg-gradient-to-r hover:from-red-500 hover:to-pink-600 rounded-xl border-2 border-red-200 hover:border-red-500 transition-all hover:scale-105"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="border-t border-gray-200 pt-4">
                            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                                <div className="flex items-center gap-2 lg:gap-3 flex-wrap w-full xl:w-auto">
                                    <button 
                                        onClick={() => setSelectedSector('all')} 
                                        className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 hover:scale-105 ${
                                            selectedSector === 'all' 
                                                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg' 
                                                : 'bg-white/80 border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
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
                                                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg' 
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
                        </div>

                        {/* Filtri Attivi */}
                        {(areAdvancedFiltersActive || specialFilter) && (
                            <div className="pt-2 flex items-center gap-2 flex-wrap">
                                {specialFilter === 'unassigned' && (
                                    <span className="flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-semibold">
                                        <AlertTriangle className="w-3 h-3" />
                                        Spese non assegnate
                                        <button onClick={() => setSpecialFilter(null)} className="ml-1 hover:bg-amber-200 rounded-full p-0.5">
                                            <XCircle className="w-3 h-3"/>
                                        </button>
                                    </span>
                                )}
                                {contractFilter && (
                                    <span className="flex items-center gap-1 bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">
                                        Contratto: {contractFilter === 'present' ? 'Presente' : 'Mancante'}
                                        <button onClick={() => setContractFilter('')} className="ml-1 hover:bg-gray-300 rounded-full p-0.5">
                                            <XCircle className="w-3 h-3"/>
                                        </button>
                                    </span>
                                )}
                                {invoiceFilter && (
                                    <span className="flex items-center gap-1 bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">
                                        Fattura: {invoiceFilter === 'present' ? 'Presente' : 'Mancante'}
                                        <button onClick={() => setInvoiceFilter('')} className="ml-1 hover:bg-gray-300 rounded-full p-0.5">
                                            <XCircle className="w-3 h-3"/>
                                        </button>
                                    </span>
                                )}
                                {areaFilter && (
                                    <span className="flex items-center gap-1 bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">
                                        Area: {geoAreaMap.get(areaFilter)}
                                        <button onClick={() => setAreaFilter('')} className="ml-1 hover:bg-gray-300 rounded-full p-0.5">
                                            <XCircle className="w-3 h-3"/>
                                        </button>
                                    </span>
                                )}
                                {branchFilter.map(id => (
                                    <span key={id} className="flex items-center gap-1 bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">
                                        Filiale: {branchMap.get(id)}
                                        <button 
                                            onClick={() => setBranchFilter(prev => prev.filter(bId => bId !== id))}
                                            className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                                        >
                                            <XCircle className="w-3 h-3"/>
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <KpiCard 
                        title="Spese Totali" 
                        value={kpiData.totalExpenses.toString()}
                        subtitle={`${filteredExpenses.length} spese filtrate`}
                        icon={<FileText className="w-6 h-6" />}
                        gradient="from-amber-500 to-orange-600"
                    />
                    <KpiCard 
                        title="Importo Totale" 
                        value={formatCurrency(kpiData.totalSpend)}
                        subtitle="Somma spese filtrate"
                        icon={<DollarSign className="w-6 h-6" />}
                        gradient="from-emerald-500 to-green-600"
                    />
                    <KpiCard 
                        title="Con Fattura" 
                        value={`${kpiData.withInvoicePercentage}%`}
                        subtitle="Documenti completi"
                        icon={<CheckCircle2 className="w-6 h-6" />}
                        gradient="from-blue-500 to-indigo-600"
                    />
                    <KpiCard 
                        title="Complete" 
                        value={`${kpiData.completePercentage}%`}
                        subtitle="Fattura + Contratto"
                        icon={<Activity className="w-6 h-6" />}
                        gradient="from-purple-500 to-pink-600"
                    />
                </div>

                {/* Lista Spese */}
                {filteredExpenses.length > 0 ? (
                    <div className="space-y-4 lg:space-y-6">
                        {filteredExpenses.map(expense => (
                            <ExpenseCard
                                key={expense.id}
                                expense={expense}
                                sectorMap={sectorMap}
                                supplierMap={supplierMap}
                                branchMap={branchMap}
                                marketingChannelMap={marketingChannelMap}
                                contractMap={contractMap}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteExpense}
                                onDuplicate={handleDuplicateExpense}
                                canEditOrDelete={canEditOrDelete}
                                onToggleDetails={toggleExpense}
                                isExpanded={expandedExpenses[expense.id]}
                            />
                        ))}
                    </div>
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
            
            <AdvancedFiltersModal 
                isOpen={isAdvancedFiltersOpen} 
                onClose={() => setIsAdvancedFiltersOpen(false)} 
                invoiceFilter={invoiceFilter} 
                setInvoiceFilter={setInvoiceFilter} 
                contractFilter={contractFilter} 
                setContractFilter={setContractFilter} 
                branchFilter={branchFilter} 
                setBranchFilter={setBranchFilter} 
                areaFilter={areaFilter} 
                setAreaFilter={setAreaFilter} 
                branches={branches} 
                geographicAreas={geographicAreas}
            />
        </div>
    );
}