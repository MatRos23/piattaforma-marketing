import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-hot-toast';
import { 
    FileSignature, 
    PlusCircle, 
    Search, 
    Filter, 
    TrendingUp, 
    Calendar, 
    DollarSign,
    Target,
    Activity,
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    XCircle,
    Building2,
    Users,
    Package,
    Car,
    Sailboat,
    Caravan
} from 'lucide-react';
import ContractFormModal from '../components/ContractFormModal';

// Funzione per ottenere l'icona del settore
const getSectorIcon = (sectorName, className = "w-4 h-4") => {
    if (!sectorName) return <Package className={className} />;
    const name = sectorName.toLowerCase();
    if (name.includes('auto')) return <Car className={className} />;
    if (name.includes('camper') || name.includes('caravan')) return <Caravan className={className} />;
    if (name.includes('yacht')) return <Sailboat className={className} />;
    if (name.includes('frattin') || name.includes('group')) return <Building2 className={className} />;
    return <Package className={className} />;
};

// Funzione per formattare valuta
const formatCurrency = (value) => {
    return new Intl.NumberFormat('it-IT', { 
        style: 'currency', 
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value || 0);
};

// Componente Badge Stato
const StatusBadge = ({ progress }) => {
    if (progress >= 100) {
        return (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                COMPLETATO
            </span>
        );
    }
    if (progress > 85) {
        return (
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                IN CORSO
            </span>
        );
    }
    if (progress > 0) {
        return (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                ATTIVO
            </span>
        );
    }
    return (
        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full">
            NON INIZIATO
        </span>
    );
};

// Componente Contract Card
const ContractCard = ({ contract, supplierMap, sectorMap, branchMap, onEdit, onDelete, expandedRows, toggleRow }) => {
    const isExpanded = expandedRows[contract.id];
    
    return (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border-2 border-white/20 p-6 hover:shadow-2xl transition-all duration-300">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-black text-gray-900">
                            {supplierMap.get(contract.supplierld) || 'N/D'}
                        </h3>
                        <StatusBadge progress={contract.progress} />
                    </div>
                    <p className="text-sm text-gray-600 font-medium">{contract.description}</p>
                    
                    {/* Date */}
                    {contract.lineItems && contract.lineItems.length > 0 && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span className="font-semibold">
                                {new Date(contract.lineItems[0]?.startDate).toLocaleDateString('it-IT')}
                            </span>
                            <span>→</span>
                            <span className="font-semibold">
                                {new Date(contract.lineItems[contract.lineItems.length - 1]?.endDate).toLocaleDateString('it-IT')}
                            </span>
                        </div>
                    )}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onEdit(contract)}
                        className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Modifica"
                    >
                        <span className="text-lg">✏️</span>
                    </button>
                    <button
                        onClick={() => onDelete(contract)}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Elimina"
                    >
                        <span className="text-lg">🗑️</span>
                    </button>
                </div>
            </div>
            
            {/* Metriche */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 border-2 border-gray-200">
                    <p className="text-xs text-gray-600 font-bold mb-1">VALORE TOTALE</p>
                    <p className="text-lg font-black text-gray-900">{formatCurrency(contract.totalAmount)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border-2 border-emerald-200">
                    <p className="text-xs text-gray-600 font-bold mb-1">SPESO</p>
                    <p className="text-lg font-black text-emerald-600">{formatCurrency(contract.spentAmount)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border-2 border-indigo-200">
                    <p className="text-xs text-gray-600 font-bold mb-1">PROIEZIONE</p>
                    <p className="text-lg font-black text-indigo-600">{formatCurrency(contract.projectionInPeriod)}</p>
                </div>
                <div className={`bg-gray-50 rounded-xl p-3 border-2 ${contract.remainingValue < 0 ? 'border-red-200' : 'border-amber-200'}`}>
                    <p className="text-xs text-gray-600 font-bold mb-1">RESIDUO</p>
                    <p className={`text-lg font-black ${contract.remainingValue < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {formatCurrency(contract.remainingValue)}
                    </p>
                </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-600 font-bold">Avanzamento</span>
                    <span className="font-black text-gray-900">{contract.progress.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${
                            contract.progress > 100 ? 'from-red-500 to-rose-600' :
                            contract.progress > 85 ? 'from-amber-500 to-orange-600' :
                            'from-emerald-500 to-green-600'
                        }`}
                        style={{ width: `${Math.min(contract.progress, 100)}%` }}
                    />
                </div>
            </div>
            
            {/* Settori */}
            <div className="flex flex-wrap gap-2 mb-4">
                {contract.effectiveSectors.map(sectorId => (
                    <span key={sectorId} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full flex items-center gap-1">
                        {getSectorIcon(sectorMap.get(sectorId), "w-3 h-3")}
                        {sectorMap.get(sectorId)}
                    </span>
                ))}
            </div>
            
            {/* Toggle Details */}
            <button
                onClick={() => toggleRow(contract.id)}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            >
                {isExpanded ? (
                    <>
                        <ChevronUp className="w-4 h-4" />
                        Nascondi Dettagli
                    </>
                ) : (
                    <>
                        <ChevronDown className="w-4 h-4" />
                        Mostra Dettagli ({contract.lineItems?.length || 0} lineItems)
                    </>
                )}
            </button>
            
            {/* Expanded Details */}
            {isExpanded && contract.lineItems && contract.lineItems.length > 0 && (
                <div className="mt-4 pt-4 border-t-2 border-gray-200 space-y-3">
                    {contract.lineItems.map((item, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-xl p-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                                <div>
                                    <p className="text-xs text-gray-500 font-bold">SETTORE</p>
                                    <p className="font-semibold text-gray-900">{sectorMap.get(item.sectorld) || 'N/D'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold">FILIALE</p>
                                    <p className="font-semibold text-gray-900">{branchMap.get(item.branchld) || 'N/D'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold">PERIODO</p>
                                    <p className="font-semibold text-gray-900">
                                        {new Date(item.startDate).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })} - {new Date(item.endDate).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-bold">IMPORTO</p>
                                    <p className="font-black text-gray-900">{formatCurrency(item.totalAmount)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function ContractsPage({ user }) {
    const [allContracts, setAllContracts] = useState([]);
    const [allExpenses, setAllExpenses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState(null);
    const [expandedRows, setExpandedRows] = useState({});
    
    // Filtri
    const [sectorFilter, setSectorFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('progress_desc');
    const [statusFilter, setStatusFilter] = useState('all');
    const [supplierFilter, setSupplierFilter] = useState([]);
    const [branchFilter, setBranchFilter] = useState([]);
    const [dateFilter, setDateFilter] = useState({
        startDate: `${new Date().getFullYear()}-01-01`,
        endDate: `${new Date().getFullYear()}-12-31`
    });
    
    // Maps
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);

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

    // Load data
    useEffect(() => {
        setIsLoading(true);
        
        let contractsQuery = query(collection(db, "contracts"), orderBy("signingDate", "desc"));
        
        if (user.role === 'collaborator' && user.assignedChannels && user.assignedChannels.length > 0) {
            if (user.assignedChannels.length <= 10) {
                contractsQuery = query(
                    collection(db, "contracts"),
                    where("supplierld", "in", user.assignedChannels),
                    orderBy("signingDate", "desc")
                );
            }
        }
        
        const unsubs = [
            onSnapshot(contractsQuery, snap => setAllContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "expenses")), snap => setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), snap => {
                setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            })
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, [user]);

    // Process contracts with projections
    const processedContracts = useMemo(() => {
        const filterStartDate = new Date(dateFilter.startDate);
        const filterEndDate = new Date(dateFilter.endDate);
        filterStartDate.setHours(0, 0, 0, 0);
        filterEndDate.setHours(23, 59, 59, 999);
        
        return allContracts.map(contract => {
            const totalAmount = (contract.lineItems || []).reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
            
            // Calcola spesa
            const spentAmount = allExpenses.reduce((sum, expense) => {
                let expenseContribution = 0;
                if (expense.relatedContractId === contract.id) {
                    expenseContribution = expense.amount || 0;
                } else if (expense.lineItems && expense.lineItems.length > 0) {
                    expenseContribution = expense.lineItems
                        .filter(li => li.relatedContractId === contract.id)
                        .reduce((lineItemSum, li) => lineItemSum + (li.amount || 0), 0);
                }
                return sum + expenseContribution;
            }, 0);
            
            const progress = totalAmount > 0 ? (spentAmount / totalAmount) * 100 : 0;
            const remainingValue = totalAmount - spentAmount; // Può essere negativo!
            
            // Calcola proiezione nel periodo filtrato
            let projectionInPeriod = 0;
            
            // Ordina lineItems per data di inizio
            const sortedLineItems = [...(contract.lineItems || [])].sort((a, b) => {
                const dateA = new Date(a.startDate || 0);
                const dateB = new Date(b.startDate || 0);
                return dateA - dateB;
            });
            
            // Distribuisci la spesa sui lineItems in ordine temporale
            let remainingToDistribute = spentAmount;
            
            sortedLineItems.forEach(lineItem => {
                if (!lineItem.startDate || !lineItem.endDate) return;
                
                const lineItemTotal = parseFloat(lineItem.totalAmount) || 0;
                
                // Calcola quanto è stato "consumato" di questo lineItem
                const consumedFromThisLineItem = Math.min(lineItemTotal, remainingToDistribute);
                remainingToDistribute -= consumedFromThisLineItem;
                
                // Residuo di questo specifico lineItem
                const lineItemRemaining = lineItemTotal - consumedFromThisLineItem;
                
                // Se non c'è residuo, passa al prossimo
                if (lineItemRemaining <= 0) return;
                
                const startDate = new Date(lineItem.startDate);
                const endDate = new Date(lineItem.endDate);
                const totalDays = Math.max(1, (endDate - startDate) / 86400000 + 1);
                
                // Costo giornaliero basato sul RESIDUO del lineItem
                const dailyCost = lineItemRemaining / totalDays;
                
                // Conta solo giorni nel periodo filtrato
                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    if (d >= filterStartDate && d <= filterEndDate) {
                        projectionInPeriod += dailyCost;
                    }
                }
            });
            
            // Settori
            let sectorsFromSource = [];
            const lineItemSectors = [...new Set((contract.lineItems || []).map(item => item.sectorld).filter(Boolean))];

            if (lineItemSectors.length > 0) {
                sectorsFromSource = lineItemSectors;
            } else if (contract.associatedSectors && contract.associatedSectors.length > 0) {
                sectorsFromSource = contract.associatedSectors;
            } else if (contract.sectorld) {
                sectorsFromSource = [contract.sectorld];
            }
            
            return { 
                ...contract, 
                totalAmount, 
                spentAmount, 
                progress, 
                remainingValue,
                projectionInPeriod,
                effectiveSectors: sectorsFromSource 
            };
        });
    }, [allContracts, allExpenses, dateFilter]);

    // Apply filters
    const filteredContracts = useMemo(() => {
        const filterStartDate = new Date(dateFilter.startDate);
        const filterEndDate = new Date(dateFilter.endDate);
        
        let filtered = [...processedContracts];

        // Filtro Settore
        if (sectorFilter !== 'all') {
            filtered = filtered.filter(c => c.effectiveSectors.includes(sectorFilter));
        }

        // Filtro Ricerca
        if (searchTerm.trim() !== '') {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(c => 
                c.description.toLowerCase().includes(lowerSearch) ||
                (supplierMap.get(c.supplierld) || '').toLowerCase().includes(lowerSearch)
            );
        }
        
        // Filtro Fornitori
        if (supplierFilter.length > 0) {
            filtered = filtered.filter(c => supplierFilter.includes(c.supplierld));
        }
        
        // Filtro Filiali
        if (branchFilter.length > 0) {
            filtered = filtered.filter(c => {
                const contractBranches = (c.lineItems || [])
                    .map(li => li.branchld)
                    .filter(Boolean);
                return branchFilter.some(bf => contractBranches.includes(bf));
            });
        }
        
        // Filtro Date (contratti che hanno lineItems nel periodo)
        filtered = filtered.filter(c => {
            return (c.lineItems || []).some(li => {
                if (!li.startDate || !li.endDate) return false;
                const liStart = new Date(li.startDate);
                const liEnd = new Date(li.endDate);
                return liStart <= filterEndDate && liEnd >= filterStartDate;
            });
        });
        
        // Filtro Stato
        if (statusFilter === 'active') {
            filtered = filtered.filter(c => c.progress > 0 && c.progress < 100);
        } else if (statusFilter === 'completed') {
            filtered = filtered.filter(c => c.progress >= 100);
        } else if (statusFilter === 'not_started') {
            filtered = filtered.filter(c => c.progress === 0);
        } else if (statusFilter === 'overrun') {
            filtered = filtered.filter(c => c.progress > 100);
        }
        
        // Ordinamento
        return filtered.sort((a, b) => {
            switch (sortOrder) {
                case 'progress_desc':
                    return b.progress - a.progress;
                case 'progress_asc':
                    return a.progress - b.progress;
                case 'date_desc':
                    return new Date(b.signingDate || 0) - new Date(a.signingDate || 0);
                case 'date_asc':
                    return new Date(a.signingDate || 0) - new Date(b.signingDate || 0);
                case 'amount_desc':
                    return b.totalAmount - a.totalAmount;
                case 'amount_asc':
                    return a.totalAmount - b.totalAmount;
                case 'projection_desc':
                    return b.projectionInPeriod - a.projectionInPeriod;
                case 'projection_asc':
                    return a.projectionInPeriod - b.projectionInPeriod;
                case 'name_asc':
                    return (supplierMap.get(a.supplierld) || '').localeCompare(supplierMap.get(b.supplierld) || '');
                case 'name_desc':
                    return (supplierMap.get(b.supplierld) || '').localeCompare(supplierMap.get(a.supplierld) || '');
                default:
                    return 0;
            }
        });
    }, [processedContracts, sectorFilter, searchTerm, supplierFilter, branchFilter, dateFilter, statusFilter, sortOrder, supplierMap]);

    // Stats
    const contractStats = useMemo(() => {
        const total = filteredContracts.length;
        const totalValue = filteredContracts.reduce((sum, c) => sum + c.totalAmount, 0);
        const totalSpent = filteredContracts.reduce((sum, c) => sum + c.spentAmount, 0);
        const totalProjections = filteredContracts.reduce((sum, c) => sum + c.projectionInPeriod, 0);
        const totalRemaining = filteredContracts.reduce((sum, c) => sum + c.remainingValue, 0);
        
        const active = filteredContracts.filter(c => c.progress > 0 && c.progress < 100).length;
        const completed = filteredContracts.filter(c => c.progress >= 100).length;
        const overrun = filteredContracts.filter(c => c.progress > 100).length;
        const avgUtilization = totalValue > 0 ? (totalSpent / totalValue) * 100 : 0;
        
        return { 
            total, 
            totalValue, 
            totalSpent, 
            totalProjections,
            totalRemaining,
            active, 
            completed, 
            overrun, 
            avgUtilization 
        };
    }, [filteredContracts]);

    const handleOpenAddModal = () => { setEditingContract(null); setIsModalOpen(true); };
    const handleOpenEditModal = (contract) => { setEditingContract(contract); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingContract(null); };
    const toggleRow = (id) => setExpandedRows(prev => ({...prev, [id]: !prev[id]}));

    const handleSaveContract = async (formData, contractFile) => {
        const isEditing = !!formData.id;
        const toastId = toast.loading(isEditing ? 'Aggiornamento...' : 'Salvataggio...');
        try {
            const { _key, ...cleanFormData } = formData;
            const cleanLineItems = cleanFormData.lineItems.map(item => {
                const { _key, ...rest } = item;
                return { ...rest, totalAmount: parseFloat(String(rest.totalAmount).replace(',', '.')) || 0 };
            });
            const contractId = isEditing ? formData.id : (await addDoc(collection(db, "contracts"), { ...cleanFormData, lineItems: cleanLineItems })).id;
            if (isEditing) await updateDoc(doc(db, "contracts", contractId), { ...cleanFormData, lineItems: cleanLineItems });
            toast.success(isEditing ? 'Contratto aggiornato!' : 'Contratto creato!', { id: toastId });
            handleCloseModal();
        } catch (error) {
            console.error("Errore salvataggio:", error);
            toast.error("Errore durante il salvataggio.", { id: toastId });
        }
    };

    const handleDeleteContract = async (contract) => {
        if (!window.confirm(`Eliminare il contratto con ${supplierMap.get(contract.supplierld)}?`)) return;
        const toastId = toast.loading('Eliminazione...');
        try {
            await deleteDoc(doc(db, "contracts", contract.id));
            toast.success("Contratto eliminato!", { id: toastId });
        } catch (error) {
            console.error("Errore eliminazione:", error);
            toast.error("Errore durante l'eliminazione.", { id: toastId });
        }
    };

    const resetFilters = () => {
        setSearchTerm(''); 
        setSectorFilter('all');
        setStatusFilter('all');
        setSortOrder('progress_desc');
        setSupplierFilter([]);
        setBranchFilter([]);
        setDateFilter({
            startDate: `${new Date().getFullYear()}-01-01`,
            endDate: `${new Date().getFullYear()}-12-31`
        });
        toast.success("Filtri resettati!");
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div className="text-xl font-semibold text-gray-700">Caricamento contratti...</div>
                </div>
            </div>
        );
    }

    const hasActiveFilters = searchTerm || sectorFilter !== 'all' || statusFilter !== 'all' || 
                            sortOrder !== 'progress_desc' || supplierFilter.length > 0 || branchFilter.length > 0 ||
                            dateFilter.startDate !== `${new Date().getFullYear()}-01-01` ||
                            dateFilter.endDate !== `${new Date().getFullYear()}-12-31`;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative">
            <div className="relative p-4 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-700 text-white shadow-lg">
                            <FileSignature className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-black text-gray-900">Gestione Contratti</h1>
                            <p className="text-gray-600 font-medium mt-1">Monitoraggio e proiezioni contratti fornitori</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleOpenAddModal} 
                        className="flex items-center justify-center gap-2 h-12 px-6 bg-gradient-to-r from-purple-600 to-pink-700 text-white font-bold rounded-xl hover:shadow-lg transition-all hover:scale-105"
                    >
                        <PlusCircle className="w-5 h-5" />
                        <span className="hidden sm:inline">Nuovo Contratto</span>
                        <span className="sm:hidden">Nuovo</span>
                    </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="bg-white rounded-2xl p-6 shadow-xl border-2 border-purple-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Valore Totale</p>
                                <p className="text-3xl font-black mt-1 text-gray-900">{formatCurrency(contractStats.totalValue)}</p>
                                <p className="text-xs text-gray-500 mt-1">{contractStats.total} contratti</p>
                            </div>
                            <DollarSign className="w-10 h-10 text-purple-500" />
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-6 shadow-xl border-2 border-emerald-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Speso</p>
                                <p className="text-3xl font-black mt-1 text-gray-900">{formatCurrency(contractStats.totalSpent)}</p>
                                <p className="text-xs text-gray-500 mt-1">{contractStats.avgUtilization.toFixed(1)}% utilizzo</p>
                            </div>
                            <TrendingUp className="w-10 h-10 text-emerald-500" />
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-6 shadow-xl border-2 border-indigo-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Proiezioni Periodo</p>
                                <p className="text-3xl font-black mt-1 text-gray-900">{formatCurrency(contractStats.totalProjections)}</p>
                                <p className="text-xs text-gray-500 mt-1">Nel periodo filtrato</p>
                            </div>
                            <Activity className="w-10 h-10 text-indigo-500" />
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-6 shadow-xl border-2 border-amber-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Residuo Totale</p>
                                <p className={`text-3xl font-black mt-1 ${contractStats.totalRemaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                    {formatCurrency(contractStats.totalRemaining)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {contractStats.totalRemaining < 0 ? 'Sforamento!' : 'Da utilizzare'}
                                </p>
                            </div>
                            <AlertTriangle className={`w-10 h-10 ${contractStats.totalRemaining < 0 ? 'text-red-500' : 'text-amber-500'}`} />
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-2xl p-6 shadow-xl border-2 border-gray-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Contratti Attivi</p>
                                <p className="text-3xl font-black mt-1 text-gray-900">{contractStats.active}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {contractStats.completed} completati · {contractStats.overrun} overrun
                                </p>
                            </div>
                            <Target className="w-10 h-10 text-gray-400" />
                        </div>
                    </div>
                </div>

                {/* Filtri */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                    <div className="space-y-4">
                        {/* Riga 1: Ricerca, Date, Ordinamento */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            {/* Ricerca */}
                            <div className="lg:col-span-4 relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca per fornitore o descrizione..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium"
                                />
                            </div>

                            {/* Date */}
                            <div className="lg:col-span-5 flex gap-2 items-center">
                                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <input
                                    type="date"
                                    value={dateFilter.startDate}
                                    onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium text-sm"
                                />
                                <span className="text-gray-400 font-bold">→</span>
                                <input
                                    type="date"
                                    value={dateFilter.endDate}
                                    onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium text-sm"
                                />
                            </div>

                            {/* Ordinamento */}
                            <div className="lg:col-span-3">
                                <select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent font-medium"
                                >
                                    <option value="progress_desc">🔽 Avanzamento ↓</option>
                                    <option value="progress_asc">🔼 Avanzamento ↑</option>
                                    <option value="projection_desc">📊 Proiezioni ↓</option>
                                    <option value="projection_asc">📊 Proiezioni ↑</option>
                                    <option value="amount_desc">💰 Importo ↓</option>
                                    <option value="amount_asc">💰 Importo ↑</option>
                                    <option value="date_desc">📅 Data ↓</option>
                                    <option value="date_asc">📅 Data ↑</option>
                                    <option value="name_asc">🔤 Nome A-Z</option>
                                    <option value="name_desc">🔤 Nome Z-A</option>
                                </select>
                            </div>
                        </div>

                        {/* Riga 2: Multi-select Fornitori e Filiali */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Fornitori */}
                            <div className="relative">
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Fornitori
                                    {supplierFilter.length > 0 && (
                                        <span className="bg-purple-600 text-white text-xs rounded-full px-2 py-0.5">
                                            {supplierFilter.length}
                                        </span>
                                    )}
                                </label>
                                <select
                                    multiple
                                    value={supplierFilter}
                                    onChange={(e) => setSupplierFilter(Array.from(e.target.selectedOptions, opt => opt.value))}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 font-medium max-h-32"
                                >
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id} className="py-1">
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Tieni premuto Ctrl/Cmd per selezione multipla</p>
                            </div>

                            {/* Filiali */}
                            <div className="relative">
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <Building2 className="w-4 h-4" />
                                    Filiali
                                    {branchFilter.length > 0 && (
                                        <span className="bg-purple-600 text-white text-xs rounded-full px-2 py-0.5">
                                            {branchFilter.length}
                                        </span>
                                    )}
                                </label>
                                <select
                                    multiple
                                    value={branchFilter}
                                    onChange={(e) => setBranchFilter(Array.from(e.target.selectedOptions, opt => opt.value))}
                                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 font-medium max-h-32"
                                >
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id} className="py-1">
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Tieni premuto Ctrl/Cmd per selezione multipla</p>
                            </div>
                        </div>

                        {/* Riga 3: Settori */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setSectorFilter('all')}
                                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${
                                    sectorFilter === 'all' 
                                        ? 'bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-lg' 
                                        : 'bg-white/80 border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <Filter className="w-4 h-4" />
                                Tutti i Settori
                            </button>
                            {orderedSectors.map(sector => {
                                const iconClassName = sectorFilter === sector.id ? "w-4 h-4" : "w-4 h-4";
                                return (
                                    <button
                                        key={sector.id}
                                        onClick={() => setSectorFilter(sector.id)}
                                        className={`px-4 py-2 rounded-xl font-bold text-sm transition-all duration-300 flex items-center gap-2 ${
                                            sectorFilter === sector.id 
                                                ? 'bg-gradient-to-r from-purple-600 to-pink-700 text-white shadow-lg' 
                                                : 'bg-white/80 border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        {getSectorIcon(sector.name, iconClassName)}
                                        <span>{sector.name}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Riga 4: Filtri Stato e Reset */}
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-t border-gray-200 pt-4">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setStatusFilter('all')}
                                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                        statusFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                    }`}
                                >
                                    Tutti ({contractStats.total})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('active')}
                                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                        statusFilter === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                    }`}
                                >
                                    Attivi ({contractStats.active})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('completed')}
                                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                        statusFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                    }`}
                                >
                                    Completati ({contractStats.completed})
                                </button>
                                {contractStats.overrun > 0 && (
                                    <button
                                        onClick={() => setStatusFilter('overrun')}
                                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                                            statusFilter === 'overrun' ? 'bg-red-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                    >
                                        Overrun ({contractStats.overrun})
                                    </button>
                                )}
                            </div>

                            {hasActiveFilters && (
                                <button 
                                    onClick={resetFilters}
                                    className="flex items-center gap-2 px-6 py-3 bg-red-100 text-red-600 hover:bg-gradient-to-r hover:from-red-500 hover:to-pink-600 hover:text-white font-bold rounded-xl transition-all hover:shadow-lg hover:scale-105"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Reset Filtri
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Lista Contratti */}
                {filteredContracts.length === 0 ? (
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border-2 border-white/20 p-12 text-center">
                        <FileSignature className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-700 mb-2">Nessun contratto trovato</h3>
                        <p className="text-gray-600">Modifica i filtri o aggiungi un nuovo contratto</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {filteredContracts.map(contract => (
                            <ContractCard
                                key={contract.id}
                                contract={contract}
                                supplierMap={supplierMap}
                                sectorMap={sectorMap}
                                branchMap={branchMap}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteContract}
                                expandedRows={expandedRows}
                                toggleRow={toggleRow}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <ContractFormModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSaveContract}
                    initialData={editingContract}
                    suppliers={suppliers}
                    sectors={sectors}
                    branches={branches}
                />
            )}
        </div>
    );
}