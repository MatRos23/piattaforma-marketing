import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { PlusCircle, Pencil, Trash2, ChevronDown, Search, Layers, XCircle, Copy, FileSignature, Paperclip, DollarSign, Calendar, Target, AlertTriangle, CheckCircle, Clock, Filter, Settings, BarChart3, Car, Sailboat, Caravan, Building2 } from 'lucide-react';
import ContractFormModal from '../components/ContractFormModal';
import toast from 'react-hot-toast';
import EmptyState from '../components/EmptyState';

const storage = getStorage();

const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return 'N/A';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/D';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
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
    const badgeStyles = "px-2.5 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 border";
    if (progress >= 100) {
        return <span className={`${badgeStyles} bg-emerald-50 text-emerald-700 border-emerald-200`}><CheckCircle className="w-4 h-4" />Completato</span>;
    } else if (progress > 0) {
        return <span className={`${badgeStyles} bg-blue-50 text-blue-700 border-blue-200`}><Clock className="w-4 h-4" />In Corso</span>;
    } else {
        return <span className={`${badgeStyles} bg-gray-100 text-gray-600 border-gray-200`}><Clock className="w-4 h-4" />Non Avviato</span>;
    }
};

const ProgressBar = ({ value }) => {
    const percentage = Math.min(Math.max(value, 0), 100);
    const getGradient = () => {
        if (percentage >= 100) return 'from-green-500 to-emerald-600';
        if (percentage > 0) return 'from-blue-500 to-indigo-600';
        return 'from-gray-300 to-gray-400';
    };
    return (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className={`h-full rounded-full bg-gradient-to-r ${getGradient()} transition-all duration-700`} style={{ width: `${percentage}%` }}></div>
        </div>
    );
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
    
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);

    useEffect(() => {
        setIsLoading(true);
        const unsubs = [
            onSnapshot(query(collection(db, "contracts"), orderBy("signingDate", "desc")), snap => setAllContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
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
            
            // LOGICA ROBUSTA PER ESTRARRE I SETTORI DA TUTTE LE FONTI POSSIBILI
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

        if (sectorFilter !== 'all') {
            filtered = filtered.filter(c => c.effectiveSectors.includes(sectorFilter));
        }

        if (searchTerm.trim() !== '') {
            const lowerSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(c => 
                c.description.toLowerCase().includes(lowerSearch) ||
                (supplierMap.get(c.supplierld) || '').toLowerCase().includes(lowerSearch)
            );
        }
        
        return filtered.sort((a, b) => {
            const aInProgress = a.progress > 0 && a.progress < 100;
            const bInProgress = b.progress > 0 && b.progress < 100;
            if (aInProgress && !bInProgress) return -1;
            if (!aInProgress && bInProgress) return 1;
            return new Date(b.signingDate || 0) - new Date(a.signingDate || 0);
        });
    }, [allContracts, allExpenses, sectorFilter, searchTerm, supplierMap]);

    const contractStats = useMemo(() => {
        const total = processedContracts.length;
        const totalValue = processedContracts.reduce((sum, c) => sum + c.totalAmount, 0);
        const totalSpent = processedContracts.reduce((sum, c) => sum + c.spentAmount, 0);
        const active = processedContracts.filter(c => c.progress > 0 && c.progress < 100).length;
        return { total, totalValue, totalSpent, active };
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative">
            <div className="relative p-4 lg:p-8 space-y-6">
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
                                    className={`px-3 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-xs lg:text-sm font-bold transition-all duration-300 flex items-center gap-1 lg:gap-2 ${
                                        sectorFilter === 'all' 
                                            ? 'bg-gradient-to-r from-purple-600 to-pink-700 text-white shadow-lg' 
                                            : 'bg-white/80 border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:scale-105'
                                    }`}
                                >
                                    <Layers className="w-3 h-3 lg:w-4 lg:h-4" /> 
                                    <span className="hidden sm:inline">Tutti i Settori</span>
                                    <span className="sm:hidden">Tutti</span>
                                </button>
                                {sectors.map(sector => {
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
                            {(searchTerm || sectorFilter !== 'all') && (
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
                        title="Contratti Attivi" 
                        value={contractStats.active.toString()}
                        subtitle={`su ${contractStats.total} totali`}
                        icon={<FileSignature className="w-6 h-6" />}
                        gradient="from-purple-500 to-pink-600"
                    />
                    <KpiCard 
                        title="Valore Contratti" 
                        value={formatCurrency(contractStats.totalValue)}
                        subtitle="valore complessivo"
                        icon={<DollarSign className="w-6 h-6" />}
                        gradient="from-blue-500 to-indigo-600"
                    />
                    <KpiCard 
                        title="Importo Speso" 
                        value={formatCurrency(contractStats.totalSpent)}
                        subtitle="già utilizzato dai contratti"
                        icon={<Target className="w-6 h-6" />}
                        gradient="from-emerald-500 to-green-600"
                    />
                </div>

                {processedContracts.length > 0 ? (
                    <div className="space-y-4">
                        {processedContracts.map(contract => {
                            const isExpanded = !!expandedRows[contract.id];
                            const primarySectorName = sectorMap.get(contract.effectiveSectors[0]);
                            return (
                                <div key={contract.id} className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden hover:shadow-2xl transition-all duration-300">
                                    <div className="p-4 lg:p-6">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                                <div className="p-2 lg:p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg flex-shrink-0">
                                                    {getSectorIcon(primarySectorName, "w-5 h-5")}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-xl font-bold text-gray-900 truncate">{supplierMap.get(contract.supplierld) || 'N/D'}</h3>
                                                    <p className="text-sm text-gray-600 truncate">{contract.description}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <StatusBadge progress={contract.progress} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end flex-shrink-0">
                                                <p className="text-2xl font-black bg-gradient-to-r from-purple-600 to-pink-700 bg-clip-text text-transparent">
                                                    {formatCurrency(contract.totalAmount)}
                                                </p>
                                                <p className="text-sm text-gray-500 font-medium">Valore totale contratto</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            <ProgressBar value={contract.progress} />
                                            <div className="flex justify-between text-sm font-medium text-gray-600">
                                                <span>Speso: <span className="font-bold text-gray-900">{formatCurrency(contract.spentAmount)}</span></span>
                                                <span>Progresso: <span className="font-bold text-gray-900">{contract.progress.toFixed(1)}%</span></span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-t border-gray-100 bg-gray-50/30 px-4 py-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {contract.effectiveSectors.map(sectorId => (
                                                <div key={sectorId} className="flex items-center gap-1.5 px-2 py-1 bg-gray-200/70 rounded-full text-xs font-semibold text-gray-700">
                                                    {getSectorIcon(sectorMap.get(sectorId), "w-3 h-3 text-gray-600")}
                                                    {sectorMap.get(sectorId) || '...'}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {contract.contractPdfUrl && (
                                                <a href={contract.contractPdfUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-500 hover:text-purple-600 hover:bg-white rounded-lg transition-all" title="Visualizza PDF"><Paperclip className="w-4 h-4" /></a>
                                            )}
                                            <button onClick={() => handleDuplicateContract(contract)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all" title="Duplica"><Copy className="w-4 h-4" /></button>
                                            <button onClick={() => handleOpenEditModal(contract)} className="p-2 text-gray-500 hover:text-green-600 hover:bg-white rounded-lg transition-all" title="Modifica"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteContract(contract)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-white rounded-lg transition-all" title="Elimina"><Trash2 className="w-4 h-4" /></button>
                                            {(contract.lineItems || []).length > 0 && (
                                                <button onClick={() => toggleRow(contract.id)} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-white rounded-lg transition-all"><ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button>
                                            )}
                                        </div>
                                    </div>
                                    {isExpanded && (contract.lineItems || []).length > 0 && (
                                        <div className="p-4 lg:p-6 border-t border-gray-200/80 bg-gray-50/50">
                                            <h4 className="font-bold text-gray-800 mb-4 text-base">Dettaglio Voci Contratto</h4>
                                            <div className="space-y-3">
                                                {(contract.lineItems || []).map((item, index) => (
                                                    <div key={index} className="flex items-center justify-between p-4 bg-white rounded-xl border">
                                                        <div className="flex-1">
                                                            <h5 className="font-semibold text-gray-800">{item.description}</h5>
                                                            <div className="text-sm text-gray-600 mt-1">
                                                                <span className="mr-4">Filiale: <span className="font-medium text-gray-800">{branchMap.get(item.branchld) || 'N/D'}</span></span>
                                                                <span>Periodo: <span className="font-medium text-gray-800">{formatDate(item.startDate)} - {formatDate(item.endDate)}</span></span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right ml-4">
                                                            <div className="text-lg font-bold text-gray-900">{formatCurrency(item.totalAmount)}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-12 text-center">
                        <div className="p-4 rounded-2xl bg-gray-100 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                            <FileSignature className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-4">Nessun Contratto Trovato</h3>
                        <p className="text-gray-600 mb-6">Non ci sono contratti che corrispondono ai filtri selezionati.</p>
                        <button 
                            onClick={handleOpenAddModal}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-700 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                        >
                            <PlusCircle className="w-5 h-5" />
                            Crea il primo contratto
                        </button>
                    </div>
                )}
            </div>
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