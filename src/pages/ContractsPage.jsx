import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { PlusCircle, Pencil, Trash2, ChevronDown, Search, Layers, XCircle, Copy, FileSignature, Paperclip, DollarSign, Calendar, Target, AlertTriangle, CheckCircle, Clock, TrendingUp, Activity, Zap, Car, Sailboat, Caravan, Building2, ArrowUpDown } from 'lucide-react';
import ContractFormModal from '../components/ContractFormModal';
import toast from 'react-hot-toast';

const storage = getStorage();

const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return 'N/A';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/D';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
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

const StatusBadge = ({ progress }) => {
    const badgeStyles = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all";
    
    if (progress >= 100) {
        return <span className={`${badgeStyles} bg-emerald-50 text-emerald-700 border-emerald-200`}><CheckCircle className="w-3.5 h-3.5" />Completato</span>;
    } else if (progress > 0) {
        return <span className={`${badgeStyles} bg-blue-50 text-blue-700 border-blue-200`}><Clock className="w-3.5 h-3.5" />In Corso</span>;
    } else {
        return <span className={`${badgeStyles} bg-gray-100 text-gray-600 border-gray-200`}><Clock className="w-3.5 h-3.5" />Non Avviato</span>;
    }
};

const ProgressBar = ({ value }) => {
    const percentage = Math.min(Math.max(value, 0), 100);
    const getGradient = () => {
        if (percentage >= 100) return 'from-green-500 to-emerald-600';
        if (percentage >= 75) return 'from-amber-500 to-orange-600';
        if (percentage > 0) return 'from-blue-500 to-indigo-600';
        return 'from-gray-300 to-gray-400';
    };
    
    return (
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
                className={`h-full rounded-full bg-gradient-to-r ${getGradient()} transition-all duration-700 relative overflow-hidden`} 
                style={{ width: `${percentage}%` }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
            </div>
        </div>
    );
};

const ContractCard = ({ contract, sectorMap, supplierMap, branchMap, onEdit, onDelete, onDuplicate, onToggle, isExpanded }) => {
    const primarySectorName = sectorMap.get(contract.effectiveSectors[0]);
    const utilizationPercentage = contract.totalAmount > 0 ? (contract.spentAmount / contract.totalAmount) * 100 : 0;
    
    return (
        <div className="group bg-white/90 backdrop-blur-2xl rounded-2xl lg:rounded-3xl shadow-lg border border-white/30 overflow-hidden hover:shadow-2xl transition-all duration-300">
            {/* Header Card */}
            <div className="p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Colonna Sinistra - Info Principale */}
                    <div className="flex items-start gap-3 lg:gap-4 flex-1 min-w-0">
                        <div className="p-2.5 lg:p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg flex-shrink-0">
                            {getSectorIcon(primarySectorName, "w-5 h-5 lg:w-6 lg:h-6")}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <h3 className="text-lg lg:text-xl font-bold text-gray-900">
                                    {supplierMap.get(contract.supplierld) || 'N/D'}
                                </h3>
                                <StatusBadge progress={contract.progress} />
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{contract.description}</p>
                            
                            {/* Tags Settori */}
                            <div className="flex items-center flex-wrap gap-2">
                                {contract.effectiveSectors.map(sectorId => (
                                    <span key={sectorId} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                                        {getSectorIcon(sectorMap.get(sectorId), "w-3 h-3")}
                                        {sectorMap.get(sectorId) || '...'}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Colonna Destra - Importo e Azioni */}
                    <div className="flex flex-col gap-3 lg:items-end">
                        {/* Importo e Data */}
                        <div className="flex lg:flex-col items-start lg:items-end justify-between lg:justify-start gap-2">
                            <div>
                                <div className="text-2xl lg:text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-700 bg-clip-text text-transparent">
                                    {formatCurrency(contract.totalAmount)}
                                </div>
                                <div className="flex items-center gap-1.5 text-sm text-gray-500 font-medium mt-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {formatDate(contract.signingDate)}
                                </div>
                            </div>
                            
                            {/* Badge Utilizzo */}
                            {contract.totalAmount > 0 && (
                                <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
                                    <Target className="w-3.5 h-3.5 text-gray-600" />
                                    <span className={`text-sm font-bold ${
                                        utilizationPercentage >= 100 ? 'text-emerald-600' :
                                        utilizationPercentage >= 75 ? 'text-amber-600' :
                                        utilizationPercentage > 0 ? 'text-blue-600' :
                                        'text-gray-600'
                                    }`}>
                                        {utilizationPercentage.toFixed(0)}%
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        {/* Azioni */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {contract.contractPdfUrl && (
                                <a href={contract.contractPdfUrl} target="_blank" rel="noopener noreferrer" 
                                   className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-all" 
                                   title="Visualizza PDF">
                                    <Paperclip className="w-4 h-4" />
                                </a>
                            )}
                            <button onClick={() => onDuplicate(contract)} 
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                                    title="Duplica">
                                <Copy className="w-4 h-4" />
                            </button>
                            <button onClick={() => onEdit(contract)} 
                                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" 
                                    title="Modifica">
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDelete(contract)} 
                                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                                    title="Elimina">
                                <Trash2 className="w-4 h-4" />
                            </button>
                            {(contract.lineItems || []).length > 0 && (
                                <button onClick={() => onToggle(contract.id)} 
                                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                                        title="Mostra dettagli">
                                    <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Progress Bar e Info */}
                <div className="mt-4 space-y-2">
                    <ProgressBar value={contract.progress} />
                    <div className="flex flex-wrap justify-between text-sm font-medium text-gray-600 gap-2">
                        <span>Speso: <span className="font-bold text-gray-900">{formatCurrency(contract.spentAmount)}</span></span>
                        <span>Progresso: <span className="font-bold text-gray-900">{contract.progress.toFixed(1)}%</span></span>
                        <span>Residuo: <span className="font-bold text-gray-900">{formatCurrency(contract.totalAmount - contract.spentAmount)}</span></span>
                    </div>
                </div>
            </div>
            
            {/* Area Espandibile - Dettagli LineItems */}
            {isExpanded && (contract.lineItems || []).length > 0 && (
                <div className="border-t border-gray-100 bg-gradient-to-br from-gray-50/50 to-gray-100/30 p-4 lg:p-6">
                    <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-base">
                        <Activity className="w-4 h-4 text-purple-600" />
                        Dettaglio Voci Contratto
                    </h4>
                    <div className="space-y-3">
                        {(contract.lineItems || []).map((item, index) => (
                            <div key={index} className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-300 transition-all">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h5 className="font-semibold text-gray-800 mb-2">{item.description}</h5>
                                        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                            <span className="flex items-center gap-1">
                                                <Building2 className="w-3.5 h-3.5 text-purple-600" />
                                                <span className="font-medium">Filiale:</span> {branchMap.get(item.branchld) || 'N/D'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                                                <span className="font-medium">Periodo:</span> {formatDate(item.startDate)} - {formatDate(item.endDate)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-lg font-bold text-purple-600">{formatCurrency(item.totalAmount)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
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
    const [sectorFilter, setSectorFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('progress_desc'); // NUOVO
    const [statusFilter, setStatusFilter] = useState('all'); // NUOVO
    
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

    useEffect(() => {
    setIsLoading(true);
    
    // Query per contracts - filtrata per collaboratori
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
    }, []);

    const processedContracts = useMemo(() => {
        let filtered = allContracts.map(contract => {
            const totalAmount = (contract.lineItems || []).reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
            
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
            
            let sectorsFromSource = [];
            const lineItemSectors = [...new Set((contract.lineItems || []).map(item => item.sectorld).filter(Boolean))];

            if (lineItemSectors.length > 0) {
                sectorsFromSource = lineItemSectors;
            } else if (contract.associatedSectors && contract.associatedSectors.length > 0) {
                sectorsFromSource = contract.associatedSectors;
            } else if (contract.sectorld) {
                sectorsFromSource = [contract.sectorld];
            }
            
            const effectiveSectors = sectorsFromSource;

            return { ...contract, totalAmount, spentAmount, progress, effectiveSectors };
        });

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
        
        // NUOVO: Filtro Stato
        if (statusFilter === 'active') {
            filtered = filtered.filter(c => c.progress > 0 && c.progress < 100);
        } else if (statusFilter === 'completed') {
            filtered = filtered.filter(c => c.progress >= 100);
        } else if (statusFilter === 'not_started') {
            filtered = filtered.filter(c => c.progress === 0);
        }
        
        // NUOVO: Ordinamento
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
                case 'name_asc':
                    return (supplierMap.get(a.supplierld) || '').localeCompare(supplierMap.get(b.supplierld) || '');
                case 'name_desc':
                    return (supplierMap.get(b.supplierld) || '').localeCompare(supplierMap.get(a.supplierld) || '');
                default:
                    return 0;
            }
        });
    }, [allContracts, allExpenses, sectorFilter, searchTerm, statusFilter, sortOrder, supplierMap]);

    const contractStats = useMemo(() => {
        const total = processedContracts.length;
        const totalValue = processedContracts.reduce((sum, c) => sum + c.totalAmount, 0);
        const totalSpent = processedContracts.reduce((sum, c) => sum + c.spentAmount, 0);
        const active = processedContracts.filter(c => c.progress > 0 && c.progress < 100).length;
        const completed = processedContracts.filter(c => c.progress >= 100).length;
        const avgUtilization = total > 0 ? (totalSpent / totalValue) * 100 : 0;
        
        return { total, totalValue, totalSpent, active, completed, avgUtilization };
    }, [processedContracts]);

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
            const contractId = isEditing ? cleanFormData.id : doc(collection(db, 'contracts')).id;
            let fileURL = cleanFormData.contractPdfUrl || "";
            if (contractFile) {
                const storageRef = ref(storage, `contracts/${contractId}/${contractFile.name}`);
                await uploadBytes(storageRef, contractFile);
                fileURL = await getDownloadURL(storageRef);
            }
            
            const dataToSave = { ...cleanFormData, lineItems: cleanLineItems, contractPdfUrl: fileURL, updatedAt: serverTimestamp() };
            Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === undefined) dataToSave[key] = null; });
            (dataToSave.lineItems || []).forEach(item => Object.keys(item).forEach(key => { if (item[key] === undefined) item[key] = null; }));

            if (isEditing) {
                await updateDoc(doc(db, "contracts", contractId), dataToSave);
            } else {
                dataToSave.authorld = user.uid;
                dataToSave.authorName = user.name;
                dataToSave.createdAt = serverTimestamp();
                await setDoc(doc(db, "contracts", contractId), dataToSave);
            }
            toast.success(isEditing ? 'Contratto aggiornato!' : 'Contratto creato!', { id: toastId });
            handleCloseModal();
        } catch (error) {
            console.error("Errore nel salvare il contratto:", error);
            toast.error(error.message || 'Errore imprevisto.', { id: toastId });
        }
    };

    const handleDuplicateContract = (contractToDuplicate) => {
        const { id, createdAt, updatedAt, authorld, authorName, contractPdfUrl, ...restOfContract } = contractToDuplicate;
        const newContractData = {
            ...restOfContract,
            description: `${restOfContract.description || ''} (Copia)`,
            signingDate: new Date().toISOString().split('T')[0],
        };
        setEditingContract(newContractData);
        setIsModalOpen(true);
    };

    const handleDeleteContract = async (contract) => {
        if (!window.confirm(`Sei sicuro di voler eliminare il contratto "${contract.description}"?`)) return;
        const toastId = toast.loading("Eliminazione in corso...");
        try {
            if (contract.contractPdfUrl) {
                const fileRef = ref(storage, contract.contractPdfUrl);
                await deleteObject(fileRef).catch(err => console.warn("File non trovato:", err));
            }
            await deleteDoc(doc(db, "contracts", contract.id));
            toast.success("Contratto eliminato!", { id: toastId });
        } catch (error) {
            console.error("Errore durante l'eliminazione:", error);
            toast.error("Errore durante l'eliminazione.", { id: toastId });
        }
    };

    const resetFilters = () => {
        setSearchTerm(''); 
        setSectorFilter('all');
        setStatusFilter('all');
        setSortOrder('progress_desc');
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

    const hasActiveFilters = searchTerm || sectorFilter !== 'all' || statusFilter !== 'all' || sortOrder !== 'progress_desc';

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
                            <p className="text-gray-600 font-medium mt-1">Monitoraggio e gestione contratti fornitori</p>
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

                {/* Filtri */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                    <div className="space-y-4">
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="flex-1">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input 
                                        type="text" 
                                        placeholder="Cerca per descrizione o fornitore..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        className="w-full h-12 pl-12 pr-4 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                            <div className="flex items-center gap-2 lg:gap-3 flex-wrap w-full xl:w-auto">
                                <button 
                                    onClick={() => setSectorFilter('all')} 
                                    className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 hover:scale-105 ${
                                        sectorFilter === 'all' 
                                            ? 'bg-gradient-to-r from-purple-600 to-pink-700 text-white shadow-lg' 
                                            : 'bg-white/80 border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <Layers className="w-3 h-3 lg:w-4 lg:h-4" /> 
                                    <span className="hidden sm:inline">Tutti i Settori</span>
                                    <span className="sm:hidden">Tutti</span>
                                </button>
                                {orderedSectors.map(sector => {
                                    const isActive = sectorFilter === sector.id;
                                    const iconClassName = `w-3 h-3 lg:w-4 lg:h-4 ${isActive ? 'text-white' : 'text-gray-400'}`;
                                    return (
                                        <button 
                                            key={sector.id} 
                                            onClick={() => setSectorFilter(sector.id)} 
                                            className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 hover:scale-105 ${
                                                isActive 
                                                    ? 'bg-gradient-to-r from-purple-600 to-pink-700 text-white shadow-lg' 
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
                            {hasActiveFilters && (
                                <button 
                                    onClick={resetFilters}
                                    className="text-xs lg:text-sm font-bold text-red-600 hover:text-white transition-all duration-300 flex items-center gap-1 lg:gap-2 bg-red-100 hover:bg-gradient-to-r hover:from-red-500 hover:to-pink-600 px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl hover:shadow-lg hover:scale-105 w-full xl:w-auto justify-center xl:justify-start"
                                >
                                    <XCircle className="w-3 h-3 lg:w-4 lg:h-4" />Reset Filtri
                                </button>
                            )}
                        </div>
                        
                        {/* NUOVO: Filtri Avanzati - Stato e Ordinamento */}
                        <div className="border-t border-gray-200 pt-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                {/* Filtro Stato */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                    <span className="text-sm font-bold text-gray-600">Stato:</span>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setStatusFilter('all')}
                                            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                                                statusFilter === 'all'
                                                    ? 'bg-gradient-to-r from-purple-600 to-pink-700 text-white shadow-lg'
                                                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50'
                                            }`}
                                        >
                                            Tutti
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter('active')}
                                            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-1.5 ${
                                                statusFilter === 'active'
                                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                                                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
                                            }`}
                                        >
                                            <Clock className="w-3.5 h-3.5" />
                                            In Corso
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter('completed')}
                                            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-1.5 ${
                                                statusFilter === 'completed'
                                                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg'
                                                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50'
                                            }`}
                                        >
                                            <CheckCircle className="w-3.5 h-3.5" />
                                            Completati
                                        </button>
                                        <button
                                            onClick={() => setStatusFilter('not_started')}
                                            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
                                                statusFilter === 'not_started'
                                                    ? 'bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-lg'
                                                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                                            }`}
                                        >
                                            Non Iniziati
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Ordinamento */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                    <span className="text-sm font-bold text-gray-600 flex items-center gap-1.5">
                                        <ArrowUpDown className="w-4 h-4" />
                                        Ordina:
                                    </span>
                                    <select
                                        value={sortOrder}
                                        onChange={(e) => setSortOrder(e.target.value)}
                                        className="h-10 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all text-sm font-semibold"
                                    >
                                        <option value="progress_desc">Progresso ↓</option>
                                        <option value="progress_asc">Progresso ↑</option>
                                        <option value="amount_desc">Importo ↓</option>
                                        <option value="amount_asc">Importo ↑</option>
                                        <option value="date_desc">Data Firma ↓</option>
                                        <option value="date_asc">Data Firma ↑</option>
                                        <option value="name_asc">Nome A-Z</option>
                                        <option value="name_desc">Nome Z-A</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    <KpiCard 
                        title="Contratti Totali" 
                        value={contractStats.total.toString()}
                        subtitle={`${contractStats.active} attivi`}
                        icon={<FileSignature className="w-6 h-6" />}
                        gradient="from-purple-500 to-pink-600"
                    />
                    <KpiCard 
                        title="Valore Totale" 
                        value={formatCurrency(contractStats.totalValue)}
                        subtitle="valore complessivo"
                        icon={<DollarSign className="w-6 h-6" />}
                        gradient="from-blue-500 to-indigo-600"
                    />
                    <KpiCard 
                        title="Importo Speso" 
                        value={formatCurrency(contractStats.totalSpent)}
                        subtitle={`${contractStats.avgUtilization.toFixed(0)}% utilizzato`}
                        icon={<Target className="w-6 h-6" />}
                        gradient="from-emerald-500 to-green-600"
                    />
                    <KpiCard 
                        title="Completati" 
                        value={contractStats.completed.toString()}
                        subtitle="contratti al 100%"
                        icon={<CheckCircle className="w-6 h-6" />}
                        gradient="from-amber-500 to-orange-600"
                    />
                </div>

                {/* Lista Contratti */}
                {processedContracts.length > 0 ? (
                    <div className="space-y-4 lg:space-y-6">
                        {processedContracts.map(contract => (
                            <ContractCard
                                key={contract.id}
                                contract={contract}
                                sectorMap={sectorMap}
                                supplierMap={supplierMap}
                                branchMap={branchMap}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteContract}
                                onDuplicate={handleDuplicateContract}
                                onToggle={toggleRow}
                                isExpanded={expandedRows[contract.id]}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-12 text-center">
                        <div className="p-4 rounded-2xl bg-purple-100 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                            <FileSignature className="w-8 h-8 text-purple-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Nessun Contratto Trovato</h3>
                        <p className="text-gray-600 mb-6">Non ci sono contratti che corrispondono ai filtri selezionati.</p>
                        {hasActiveFilters ? (
                            <button 
                                onClick={resetFilters}
                                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-700 text-white font-semibold rounded-xl hover:shadow-lg transition-all hover:scale-105"
                            >
                                Resetta Filtri
                            </button>
                        ) : (
                            <button 
                                onClick={handleOpenAddModal}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-700 text-white font-semibold rounded-xl hover:shadow-lg transition-all hover:scale-105"
                            >
                                <PlusCircle className="w-5 h-5" />
                                Crea il primo contratto
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            {/* Modal */}
            <ContractFormModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveContract}
                initialData={editingContract}
                suppliers={suppliers}
                sectors={sectors}
                branches={branches}
            />
        </div>
    );
}