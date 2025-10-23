import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { 
    PlusCircle, Pencil, Trash2, ChevronDown, Search, Layers, XCircle, Copy, FileSignature, 
    Paperclip, DollarSign, Calendar, Target, AlertTriangle, CheckCircle, Clock, TrendingUp, 
    Activity, Zap, Car, Sailboat, Caravan, Building2, ArrowUpDown, LayoutGrid, List,
    Download, RefreshCw, Eye, ChevronUp, Tag, Building
} from 'lucide-react';
import ContractFormModal from '../components/ContractFormModal';
import toast from 'react-hot-toast';
import { KpiCard } from '../components/SharedComponents';

const storage = getStorage();

// ===== UTILITY FUNCTIONS =====
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

// ===== UI COMPONENTS =====

// Progress Bar Component con gestione sforamenti
const ProgressBar = ({ value }) => {
    const percentage = Math.round(Math.min(Math.max(value, 0), 200) * 10) / 10;
    const displayPercentage = Math.min(percentage, 100);
    
    const getGradient = () => {
        if (percentage > 100) return 'from-red-500 to-rose-600';
        if (percentage >= 100) return 'from-green-500 to-emerald-600';
        if (percentage >= 85) return 'from-amber-500 to-orange-600';
        if (percentage > 0) return 'from-blue-500 to-indigo-600';
        return 'from-gray-300 to-gray-400';
    };
    
    return (
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden relative">
            <div 
                className={`h-full rounded-full bg-gradient-to-r ${getGradient()} transition-all duration-700 relative overflow-hidden`} 
                style={{ width: `${displayPercentage}%` }}
            >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
            </div>
            {percentage > 100 && (
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                    <span className="text-[10px] font-bold text-red-700 drop-shadow-lg">
                        +{(percentage - 100).toFixed(0)}%
                    </span>
                </div>
            )}
        </div>
    );
};

// Status Badge Component con gestione sforamenti
const StatusBadge = ({ progress }) => {
    const badgeStyles = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all";
    const roundedProgress = Math.round(progress * 10) / 10;
    
    if (roundedProgress > 100) {
        return (
            <span className={`${badgeStyles} bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-300`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                Sforato +{(roundedProgress - 100).toFixed(1)}%
            </span>
        );
    } else if (roundedProgress === 100) {
        return (
            <span className={`${badgeStyles} bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-200`}>
                <CheckCircle className="w-3.5 h-3.5" />
                Completato
            </span>
        );
    } else if (roundedProgress >= 85) {
        return (
            <span className={`${badgeStyles} bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-300`}>
                <Clock className="w-3.5 h-3.5" />
                In Chiusura
            </span>
        );
    } else if (roundedProgress > 0) {
        return (
            <span className={`${badgeStyles} bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200`}>
                <Clock className="w-3.5 h-3.5" />
                In Corso
            </span>
        );
    } else {
        return (
            <span className={`${badgeStyles} bg-gray-100 text-gray-600 border-gray-200`}>
                <Clock className="w-3.5 h-3.5" />
                Non Avviato
            </span>
        );
    }
};

// Contract Card Compatto - Nuovo Design
// ===== FIX COMPLETO PER ContractCardCompact =====
// Sostituisci la funzione ContractCardCompact con questa versione corretta

const ContractCardCompact = ({ contract, sectorMap, supplierMap, branchMap, onEdit, onDelete, onDuplicate, onToggle, isExpanded }) => {
    const primarySectorName = sectorMap.get(contract.effectiveSectors[0]);
    const utilizationPercentage = contract.totalAmount > 0 
        ? Math.round((contract.spentAmount / contract.totalAmount) * 1000) / 10
        : 0;
    
    const residuo = contract.totalAmount - contract.spentAmount;
    const residuoDisplay = Math.abs(residuo) < 0.01 ? 0 : residuo;
    
    // Calcola giorni alla scadenza
    const getDaysToEnd = () => {
        const endDates = (contract.lineItems || []).map(item => item.endDate).filter(Boolean);
        if (endDates.length === 0) return null;
        
        const nearestEndDate = endDates.sort()[0];
        const days = Math.ceil((new Date(nearestEndDate) - new Date()) / (1000 * 60 * 60 * 24));
        
        return days;
    };
    
    const daysToEnd = getDaysToEnd();
    const isOverrun = utilizationPercentage > 100;
    const isCompleted = utilizationPercentage === 100;
    const isExpiring = daysToEnd && daysToEnd > 0 && daysToEnd <= 30;
    const isExpired = daysToEnd && daysToEnd <= 0;
    
    // NUOVA LOGICA: Funzione per determinare colore bordo e sfondo
    const getBorderAndBackground = () => {
        // Priorità 1: Sforato (rosso) - più critico
        if (isOverrun) {
            return 'border-red-300 bg-red-50/20';
        }
        
        // Priorità 2: Scaduto (grigio scuro) - già passato
        if (isExpired) {
            return 'border-gray-400 bg-gray-50/20';
        }
        
        // Priorità 3: In scadenza entro 30gg (ambra) - attenzione
        if (isExpiring) {
            return 'border-amber-300 bg-amber-50/20';
        }
        
        // Priorità 4: Completato esattamente al 100% (verde) - successo!
        if (isCompleted) {
            return 'border-emerald-300 bg-emerald-50/20';
        }
        
        // Priorità 5: In corso (blu chiaro)
        if (utilizationPercentage > 0 && utilizationPercentage < 100) {
            return 'border-blue-200 bg-blue-50/10';
        }
        
        // Default: Non iniziato o normale
        return 'border-white/30 bg-white/50';
    };
    
    // Badge aggiuntivo per stato temporale (solo se non sforato)
    const getTimeBadge = () => {
        if (isOverrun) return null; // Non mostrare se già sforato
        
        if (isExpired) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
                    <Clock className="w-3 h-3" />
                    Scaduto {Math.abs(daysToEnd)}gg fa
                </span>
            );
        }
        
        if (isExpiring) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                    <Clock className="w-3 h-3" />
                    Scade tra {daysToEnd}gg
                </span>
            );
        }
        
        return null;
    };
    
    // Icona del settore con colore appropriato
    const getIconBackground = () => {
        if (isOverrun) return 'bg-gradient-to-br from-red-500 to-rose-600';
        if (isCompleted) return 'bg-gradient-to-br from-emerald-500 to-green-600';
        return 'bg-gradient-to-br from-purple-500 to-pink-600';
    };
    
    return (
        <div className={`
            group bg-white/90 backdrop-blur-2xl rounded-2xl shadow-lg 
            border-2 transition-all duration-300 hover:shadow-2xl
            ${getBorderAndBackground()}
        `}>
            <div className="p-4 lg:p-5">
                <div className="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_350px_180px] items-center gap-4">
                    {/* Colonna 1: Info Base */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 rounded-xl text-white shadow-lg flex-shrink-0 ${getIconBackground()}`}>
    {contract.effectiveSectors?.length > 1 ? 
        <Layers className="w-5 h-5" /> : 
        getSectorIcon(primarySectorName, "w-5 h-5")
    }
</div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold text-gray-900 truncate">
                                    {supplierMap.get(contract.supplierld) || 'N/D'}
                                </h3>
                                <StatusBadge progress={utilizationPercentage} />
                                {getTimeBadge()}
                            </div>
                            
                            <div className="flex items-center justify-between mt-1">
    <p className="text-sm text-gray-600 truncate">
        {contract.description}
    </p>
    <div className="flex items-center gap-1.5 flex-shrink-0">
        {contract.effectiveSectors.map(sectorId => (
            <div key={sectorId} title={sectorMap.get(sectorId)}>
            </div>
        ))}
    </div>
</div>
                        </div>
                    </div>
                    
                    {/* Colonna 2: Metriche */}
<div className="hidden lg:flex items-center justify-end gap-6">
    <div className="relative w-14 h-14">
        <svg className="transform -rotate-90 w-14 h-14">
            <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="none" className="text-gray-200" />
            <circle
                cx="28"
                cy="28"
                r="24"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${Math.min(utilizationPercentage, 100) * 1.51} 151`}
                className={`transition-all duration-700 ${
                    isOverrun ? 'text-red-500' :
                    isCompleted ? 'text-emerald-500' :
                    utilizationPercentage >= 85 ? 'text-amber-500' :
                    'text-blue-500'
                }`}
            />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xs font-bold ${
                isOverrun ? 'text-red-600' : 
                isCompleted ? 'text-emerald-600' :
                'text-gray-900'
            }`}>
                {Math.round(utilizationPercentage)}%
            </span>
        </div>
    </div>

    <div className="flex items-start gap-6">
        <div className="text-right w-28">
            <div className="text-xs text-gray-500 font-medium">Valore</div>
            <div className="text-lg font-black text-gray-900">
                {formatCurrency(contract.totalAmount)}
            </div>
        </div>

        <div className="text-right w-28">
            <div className="text-xs text-gray-500 font-medium">Residuo</div>
            <div className={`text-lg font-black ${
                residuoDisplay < 0 ? 'text-red-600' : 
                residuoDisplay === 0 ? 'text-gray-600' : 
                'text-emerald-600'
            }`}>
                {formatCurrency(residuoDisplay)}
            </div>
        </div>
    </div>
</div>
                    
                    {/* Colonna 3: Azioni */}
                    <div className="flex items-center gap-1">
                        {contract.contractPdfUrl && (
                            <a href={contract.contractPdfUrl} target="_blank" rel="noopener noreferrer" 
                               className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all" 
                               title="PDF">
                                <Paperclip className="w-4 h-4" />
                            </a>
                        )}
                        
                        <button 
                            onClick={() => onDuplicate(contract)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                            title="Duplica">
                            <Copy className="w-4 h-4" />
                        </button>
                        
                        <button 
                            onClick={() => onEdit(contract)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" 
                            title="Modifica">
                            <Pencil className="w-4 h-4" />
                        </button>
                        
                        <button 
                            onClick={() => onDelete(contract)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                            title="Elimina">
                            <Trash2 className="w-4 h-4" />
                        </button>
                        
                        {(contract.lineItems || []).length > 0 && (
                            <button 
                                onClick={() => onToggle(contract.id)}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                                title="Dettagli">
                                <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Dettagli Espandibili - invariato */}
            {isExpanded && (contract.lineItems || []).length > 0 && (
                <div className="border-t border-gray-200 bg-gray-50/50 p-4 lg:p-6">
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

// Vista Tabella
const ContractsTableView = ({ contracts, supplierMap, sectorMap, onEdit, onDelete }) => {
    return (
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase">Fornitore</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase hidden lg:table-cell">Descrizione</th>
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Progresso</th>
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Valore</th>
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Speso</th>
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Residuo</th>
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {contracts.map((contract, index) => {
                            const utilizationPercentage = Math.round((contract.spentAmount / contract.totalAmount) * 1000) / 10;
                            const residuo = contract.totalAmount - contract.spentAmount;
                            const residuoDisplay = Math.abs(residuo) < 0.01 ? 0 : residuo;
                            const isOverrun = utilizationPercentage > 100;
                            
                            return (
                                <tr key={contract.id} className={`
                                    hover:bg-gray-50 transition-colors
                                    ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                                `}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-8 rounded-full ${
                                                isOverrun ? 'bg-red-500' :
                                                utilizationPercentage >= 85 ? 'bg-amber-500' :
                                                'bg-emerald-500'
                                            }`} />
                                            <div>
                                                <div className="font-bold text-gray-900">
                                                    {supplierMap.get(contract.supplierld)}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {contract.effectiveSectors.map(id => sectorMap.get(id)).join(', ')}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        <div className="text-sm text-gray-600 truncate max-w-xs">
                                            {contract.description}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-full max-w-[100px] bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className={`h-full rounded-full bg-gradient-to-r ${
                                                        isOverrun ? 'from-red-500 to-rose-600' :
                                                        utilizationPercentage >= 85 ? 'from-amber-500 to-orange-600' :
                                                        'from-emerald-500 to-green-600'
                                                    }`}
                                                    style={{ width: `${Math.min(utilizationPercentage, 100)}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-bold ${
                                                isOverrun ? 'text-red-600' : 'text-gray-900'
                                            }`}>
                                                {utilizationPercentage.toFixed(0)}%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                        {formatCurrency(contract.totalAmount)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-700">
                                        {formatCurrency(contract.spentAmount)}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold ${
                                        residuoDisplay < 0 ? 'text-red-600' : 'text-emerald-600'
                                        }`}>
                                        {formatCurrency(residuoDisplay)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <button 
                                                onClick={() => onEdit(contract)}
                                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-all">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => onDelete(contract)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all">
                                                <Trash2 className="w-3.5 h-3.5" />
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

// ===== MAIN COMPONENT =====
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
    const [sortOrder, setSortOrder] = useState('progress_desc');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState('table'); // 'cards' o 'table'
    const [supplierFilter, setSupplierFilter] = useState(''); // NUOVO
    const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' }); // NUOVO
    
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
            
            const progress = totalAmount > 0 
                ? Math.round((spentAmount / totalAmount) * 1000) / 10
                : 0;
            
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

        // Filtri
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
        
        // NUOVO: Filtro Fornitore
        if (supplierFilter) {
            filtered = filtered.filter(c => c.supplierld === supplierFilter);
        }
        
        // NUOVO: Filtro Date
        if (dateFilter.startDate || dateFilter.endDate) {
            filtered = filtered.filter(c => {
                if (!c.signingDate) return false;
                const contractDate = new Date(c.signingDate);
                if (dateFilter.startDate) {
                    const startDate = new Date(dateFilter.startDate);
                    if (contractDate < startDate) return false;
                }
                if (dateFilter.endDate) {
                    const endDate = new Date(dateFilter.endDate);
                    if (contractDate > endDate) return false;
                }
                return true;
            });
        }
        
        // Filtro stato con categorie specifiche
        if (statusFilter === 'overrun') {
            filtered = filtered.filter(c => c.progress > 100);
        } else if (statusFilter === 'active') {
            filtered = filtered.filter(c => c.progress > 0 && c.progress < 100);
        } else if (statusFilter === 'completed') {
            filtered = filtered.filter(c => c.progress === 100);
        } else if (statusFilter === 'not_started') {
            filtered = filtered.filter(c => c.progress === 0);
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
        const completed = processedContracts.filter(c => c.progress === 100).length;
        const overrun = processedContracts.filter(c => c.progress > 100).length;
        const avgUtilization = total > 0 ? (totalSpent / totalValue) * 100 : 0;
        
        return { total, totalValue, totalSpent, active, completed, overrun, avgUtilization };
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
        setSupplierFilter(''); // NUOVO
        setDateFilter({ startDate: '', endDate: '' }); // NUOVO
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

    const hasActiveFilters = searchTerm || sectorFilter !== 'all' || statusFilter !== 'all' || sortOrder !== 'progress_desc' || supplierFilter || dateFilter.startDate || dateFilter.endDate;
    const overrunContracts = processedContracts.filter(c => c.progress > 100);

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
                            
                            {/* NUOVO: Filtro Date */}
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={dateFilter.startDate}
                                    onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="h-12 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all text-sm"
                                    placeholder="Da"
                                />
                                <input
                                    type="date"
                                    value={dateFilter.endDate}
                                    onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="h-12 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all text-sm"
                                    placeholder="A"
                                />
                            </div>
                            
                            {/* NUOVO: Filtro Fornitore */}
                            <select
                                value={supplierFilter}
                                onChange={(e) => setSupplierFilter(e.target.value)}
                                className="h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all font-medium min-w-[200px]"
                            >
                                <option value="">Tutti i fornitori</option>
                                {suppliers.map(supplier => (
                                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                ))}
                            </select>
                            
                            {/* Toggle Vista */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setViewMode('cards')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'cards' 
                                        ? 'bg-purple-100 text-purple-600' 
                                        : 'text-gray-400 hover:bg-gray-100'}`}
                                    title="Vista Card"
                                >
                                    <LayoutGrid className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`p-2 rounded-lg transition-all ${viewMode === 'table' 
                                        ? 'bg-purple-100 text-purple-600' 
                                        : 'text-gray-400 hover:bg-gray-100'}`}
                                    title="Vista Tabella"
                                >
                                    <List className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Filtri Settore */}
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
                        
                        {/* Filtri Stato e Ordinamento */}
                        <div className="border-t border-gray-200 pt-4">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                {/* Filtri Stato Rapidi */}
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setStatusFilter('all')}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                                            statusFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                    >
                                        Tutti ({contractStats.total})
                                    </button>
                                    {contractStats.overrun > 0 && (
                                        <button
                                            onClick={() => setStatusFilter('overrun')}
                                            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 transition-all ${
                                                statusFilter === 'overrun' ? 'bg-red-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                            }`}
                                        >
                                            <AlertTriangle className="w-3 h-3" />
                                            Sforati ({contractStats.overrun})
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setStatusFilter('active')}
                                        className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 transition-all ${
                                            statusFilter === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                    >
                                        <Clock className="w-3 h-3" />
                                        In Corso ({contractStats.active})
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('completed')}
                                        className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 transition-all ${
                                            statusFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                    >
                                        <CheckCircle className="w-3 h-3" />
                                        Completati ({contractStats.completed})
                                    </button>
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
                        subtitle={contractStats.overrun > 0 ? `${contractStats.overrun} sforati` : "contratti al 100%"}
                        icon={<CheckCircle className="w-6 h-6" />}
                        gradient={contractStats.overrun > 0 ? "from-red-500 to-rose-600" : "from-amber-500 to-orange-600"}
                    />
                </div>

                {/* Alert Contratti Sforati */}
                {overrunContracts.length > 0 && (
                    <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-2xl p-4 lg:p-6 flex items-start gap-3">
                        <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-red-900 mb-1 text-sm lg:text-base">
                                Attenzione: {overrunContracts.length} Contratt{overrunContracts.length > 1 ? 'i Sforati' : 'o Sforato'}
                            </h4>
                            <p className="text-xs lg:text-sm text-red-700">
                                Hai superato il budget previsto in {overrunContracts.length} contratt{overrunContracts.length > 1 ? 'i' : 'o'}. 
                                Totale sforamento: {formatCurrency(
                                    overrunContracts.reduce((sum, c) => sum + (c.spentAmount - c.totalAmount), 0)
                                )}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {overrunContracts.map(c => (
                                    <span key={c.id} className="text-xs bg-white px-2 py-1 rounded-lg border border-red-200">
                                        {supplierMap.get(c.supplierld)} (+{(c.progress - 100).toFixed(1)}%)
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Lista Contratti o Tabella */}
                {processedContracts.length > 0 ? (
                    viewMode === 'cards' ? (
                        <div className="space-y-4">
                            {processedContracts.map(contract => (
                                <ContractCardCompact
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
                        <ContractsTableView
                            contracts={processedContracts}
                            supplierMap={supplierMap}
                            sectorMap={sectorMap}
                            onEdit={handleOpenEditModal}
                            onDelete={handleDeleteContract}
                        />
                    )
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