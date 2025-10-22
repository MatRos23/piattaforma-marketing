import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { 
    PlusCircle, Search, XCircle, Wallet, Car, Sailboat, Caravan, Building2, Layers, 
    DollarSign, FileText, Paperclip, Copy, Pencil, Trash2, AlertTriangle, CheckCircle2, 
    Clock, Calendar, SlidersHorizontal, ChevronDown, TrendingUp, Activity, Zap, 
    FileSignature, GitBranch, Info, LayoutGrid, List, Percent, Eye, ArrowUpDown,
    Download, RefreshCw, Filter, TrendingDown, X, Check
} from 'lucide-react';
import ExpenseFormModal from '../components/ExpenseFormModal';
import toast from 'react-hot-toast';
import AdvancedFiltersModal from '../components/AdvancedFiltersModal';
import { MultiSelect } from '../components/SharedComponents';
import { KpiCard } from '../components/SharedComponents';

const storage = getStorage();

// ===== SHARED COMPONENTS =====
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
    if (typeof number !== 'number' || isNaN(number)) return '€ 0,00';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/D';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

// Progress Bar universale con gestione sforamenti
const ProgressBar = ({ value, max, showOverrun = true }) => {
    const percentage = max > 0 ? Math.round((value / max) * 1000) / 10 : 0;
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
            {showOverrun && percentage > 100 && (
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                    <span className="text-[10px] font-bold text-red-700 drop-shadow-lg">
                        +{(percentage - 100).toFixed(0)}%
                    </span>
                </div>
            )}
        </div>
    );
};

// Status Badge aggiornato con supporto requiresContract
const StatusBadge = ({ hasInvoice, hasContract, isAmortized, requiresContract = true }) => {
    const baseClass = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all shadow-sm";
    
    if (isAmortized) {
        return (
            <span className={`${baseClass} bg-gradient-to-r from-purple-50 to-violet-50 text-purple-700 border-purple-200`}>
                <Clock className="w-3.5 h-3.5" />
                Competenza
            </span>
        );
    }
    
    // Se non richiede contratto, verifica solo la fattura
    if (!requiresContract) {
        if (!hasInvoice) {
            return (
                <span className={`${baseClass} bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200`}>
                    <FileText className="w-3.5 h-3.5" />
                    Manca Fattura
                </span>
            );
        } else {
            return (
                <span className={`${baseClass} bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-200`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completa
                </span>
            );
        }
    }
    
    // Logica originale per spese che richiedono contratto
    if (!hasInvoice && !hasContract) {
        return (
            <span className={`${baseClass} bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border-red-200`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                Documenti Mancanti
            </span>
        );
    } else if (!hasInvoice) {
        return (
            <span className={`${baseClass} bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200`}>
                <FileText className="w-3.5 h-3.5" />
                Manca Fattura
            </span>
        );
    } else if (!hasContract) {
        return (
            <span className={`${baseClass} bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-blue-200`}>
                <FileSignature className="w-3.5 h-3.5" />
                Manca Contratto
            </span>
        );
    } else {
        return (
            <span className={`${baseClass} bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border-emerald-200`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completa
            </span>
        );
    }
};

// ExpenseCard Compatta Redesign (stile ContractsPage)
const ExpenseCardCompact = React.memo(({ 
    expense, 
    sectorMap, 
    supplierMap, 
    branchMap, 
    marketingChannelMap, 
    contractMap, 
    budgetInfo,
    onEdit, 
    onDelete, 
    onDuplicate, 
    canEditOrDelete, 
    onToggleDetails, 
    isExpanded
}) => {
    const [showDistributedInfo, setShowDistributedInfo] = useState(false);
    
    const sectorName = sectorMap.get(expense.sectorId);
    const hasInvoice = !!expense.invoicePdfUrl;
    const hasContract = expense.isContractSatisfied;
    const requiresContract = expense.requiresContract !== false;
    const relatedContract = contractMap.get(expense.relatedContractId);
    
    // Calcolo utilizzo budget se disponibile
    const utilizationPercentage = budgetInfo?.budget > 0 
        ? Math.round((expense.displayAmount / budgetInfo.budget) * 1000) / 10
        : 0;
    
    // Determina stato e colori bordo
    const getBorderAndBackground = () => {
        if (!hasInvoice && (requiresContract && !hasContract)) {
            return 'border-red-300 bg-red-50/20';
        }
        if (expense.isAmortized) {
            return 'border-purple-300 bg-purple-50/20';
        }
        if (expense.hasDistributedAmount) {
            return 'border-indigo-300 bg-indigo-50/20';
        }
        if (hasInvoice && (!requiresContract || hasContract)) {
            return 'border-emerald-300 bg-emerald-50/20';
        }
        return 'border-white/30 bg-white/50';
    };
    
    const getIconBackground = () => {
        if (!hasInvoice || (requiresContract && !hasContract)) return 'bg-gradient-to-br from-amber-500 to-orange-600';
        if (expense.isAmortized) return 'bg-gradient-to-br from-purple-500 to-violet-600';
        return 'bg-gradient-to-br from-emerald-500 to-green-600';
    };
    
    // Calcola giorni dalla data
    const getDaysFromDate = () => {
        if (!expense.date) return null;
        const days = Math.ceil((new Date() - new Date(expense.date)) / (1000 * 60 * 60 * 24));
        return days;
    };
    
    const daysAgo = getDaysFromDate();
    
    return (
        <div className={`
            group bg-white/90 backdrop-blur-2xl rounded-2xl shadow-lg 
            border-2 transition-all duration-300 hover:shadow-2xl
            ${getBorderAndBackground()}
        `}>
            <div className="p-4 lg:p-5">
                <div className="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_220px_220px] items-center gap-4">
                    {/* Colonna 1: Info Base */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`
                            p-2.5 rounded-xl text-white shadow-lg flex-shrink-0
                            ${getIconBackground()}
                        `}>
                            {getSectorIcon(sectorName, "w-5 h-5")}
                        </div>
                        
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h3 className="text-lg font-bold text-gray-900 truncate">
                                    {supplierMap.get(expense.supplierId) || 'N/D'}
                                </h3>
                                <StatusBadge 
                                    hasInvoice={hasInvoice} 
                                    hasContract={hasContract}
                                    requiresContract={requiresContract}
                                    isAmortized={expense.isAmortized} 
                                />
                                {expense.hasDistributedAmount && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowDistributedInfo(!showDistributedInfo);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold hover:bg-indigo-200 transition-colors"
                                    >
                                        <GitBranch className="w-3 h-3" />
                                        Distribuito
                                    </button>
                                )}
                                {!requiresContract && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                                        <X className="w-3 h-3" />
                                        No Contratto
                                    </span>
                                )}
                            </div>
                            
                            <p className="text-sm text-gray-600 truncate">
                                {expense.description}
                            </p>
                            
                            {/* Data con giorni passati */}
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                <Calendar className="w-3 h-3" />
                                <span>{formatDate(expense.date)}</span>
                                {daysAgo !== null && (
                                    <span className="text-gray-400">
                                        ({daysAgo === 0 ? 'oggi' : `${daysAgo}gg fa`})
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {/* Colonna 2: Metriche */}
<div className="hidden lg:flex items-center justify-end gap-6 w-56">
    {/* Cerchio di progresso o Placeholder 'Extra' */}
    {(budgetInfo && budgetInfo.budget > 0) ? (
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
                        utilizationPercentage > 100 ? 'text-red-500' :
                        utilizationPercentage >= 85 ? 'text-amber-500' :
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
        <div className="w-14 h-14 flex flex-col items-center justify-center bg-amber-100 text-amber-700 rounded-full border-2 border-amber-200" title="Spesa Extra Budget">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-0.5">Extra</span>
        </div>
    )}

    {/* Importo */}
    <div className="text-right w-32">
        <div className="text-xs text-gray-500 font-medium">Importo</div>
        <div className="text-lg font-black text-gray-900">
            {formatCurrency(expense.displayAmount || expense.amount)}
        </div>
        {expense.hasDistributedAmount && expense.amount !== expense.displayAmount && (
            <div className="text-xs text-gray-500">
                Tot: {formatCurrency(expense.amount)}
            </div>
        )}
    </div>
</div>
                    
                    {/* Colonna 3: Azioni */}
                    <div className="flex items-center justify-end gap-1">
                        {hasInvoice && (
                            <a href={expense.invoicePdfUrl} target="_blank" rel="noopener noreferrer" 
                               className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                               title="Fattura">
                                <Paperclip className="w-4 h-4" />
                            </a>
                        )}
                        
                        {relatedContract?.contractPdfUrl && (
                            <a href={relatedContract.contractPdfUrl} target="_blank" rel="noopener noreferrer" 
                               className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                               title="Contratto">
                                <FileSignature className="w-4 h-4" />
                            </a>
                        )}
                        
                        {canEditOrDelete(expense) && (
                            <>
                                <button 
                                    onClick={() => onDuplicate(expense)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" 
                                    title="Duplica">
                                    <Copy className="w-4 h-4" />
                                </button>
                                
                                <button 
                                    onClick={() => onEdit(expense)}
                                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all" 
                                    title="Modifica">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                
                                <button 
                                    onClick={() => onDelete(expense)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title="Elimina">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        
                        {expense.processedLineItems && expense.processedLineItems.length > 0 && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleDetails(expense.id);
                                }}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                                title="Dettagli">
                                <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                        )}
                    </div>
                </div>
                
                {/* Info distribuzione inline */}
                {showDistributedInfo && expense.distributedInfo && (
                    <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <div className="text-xs font-bold text-indigo-800 mb-1">Quote distribuite:</div>
                        <div className="text-xs text-indigo-700">{expense.distributedInfo.details}</div>
                    </div>
                )}
                
            </div>
            
            {/* Area Espandibile - Dettagli */}
            {isExpanded && expense.processedLineItems && expense.processedLineItems.length > 0 && (
                <div className="border-t border-gray-200 bg-gradient-to-br from-gray-50/50 to-gray-100/30 p-4 lg:p-6">
                    <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-base">
                        <Activity className="w-4 h-4 text-amber-600" />
                        Dettaglio Voci di Spesa
                    </h4>
                    <div className="space-y-3">
                        {expense.processedLineItems.map((item, index) => (
                            <div key={item._key || index} className="p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-amber-300 transition-all">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-800 mb-1">{item.description}</p>
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">Canale:</span> {marketingChannelMap.get(item.marketingChannelId) || 'N/D'}
                                        </p>
                                    </div>
                                    <div className="text-lg font-bold text-amber-600">
                                        {formatCurrency(item.displayAmount || item.amount)}
                                    </div>
                                </div>
                                {item.isGroup ? (
                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                                        <Building2 className="w-4 h-4 text-amber-600" />
                                        <span className="font-medium">Distribuito su {item.branchCount} filiali:</span>
                                        <span className="italic">{item.branchNames}</span>
                                    </div>
                                ) : item.isGenerico ? (
                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                            <GitBranch className="w-4 h-4 text-indigo-600" />
                                            <span className="font-medium">Distribuito automaticamente su:</span>
                                        </div>
                                        <div className="ml-6 text-xs text-gray-500">
                                            {item.distributedTo}
                                        </div>
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
});

// Vista Tabella
const ExpenseTableView = React.memo(({ 
    expenses, 
    sectorMap, 
    supplierMap, 
    branchMap,
    marketingChannelMap,
    contractMap,
    onEdit, 
    onDelete,
    onDuplicate,
    canEditOrDelete
}) => {
    return (
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-amber-600 to-orange-600 text-white">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase">Fornitore</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase hidden lg:table-cell">Descrizione</th>
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Stato</th>
                            <th className="px-4 py-3 text-left text-xs font-bold uppercase">Data</th>
                            <th className="px-4 py-3 text-right text-xs font-bold uppercase">Importo</th>
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Documenti</th>
                            <th className="px-4 py-3 text-center text-xs font-bold uppercase">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {expenses.map((expense, index) => {
                            const sectorName = sectorMap.get(expense.sectorId);
                            const hasInvoice = !!expense.invoicePdfUrl;
                            const hasContract = expense.isContractSatisfied;
                            const requiresContract = expense.requiresContract !== false;
                            const isComplete = hasInvoice && (!requiresContract || hasContract);
                            
                            return (
                                <tr key={expense.id} className={`
                                    hover:bg-gray-50 transition-colors
                                    ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                                `}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-8 rounded-full ${
                                                !isComplete ? 'bg-red-500' :
                                                expense.isAmortized ? 'bg-purple-500' :
                                                'bg-emerald-500'
                                            }`} />
                                            <div>
                                                <div className="font-bold text-gray-900">
                                                    {supplierMap.get(expense.supplierId) || 'N/D'}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {sectorName}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                        <div className="text-sm text-gray-600 truncate max-w-xs">
                                            {expense.description}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-center">
                                            <StatusBadge 
                                                hasInvoice={hasInvoice} 
                                                hasContract={hasContract}
                                                requiresContract={requiresContract}
                                                isAmortized={expense.isAmortized}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                        {formatDate(expense.date)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                        {formatCurrency(expense.displayAmount || expense.amount)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            {hasInvoice && (
                                                <a href={expense.invoicePdfUrl} target="_blank" rel="noopener noreferrer"
                                                   className="text-emerald-600 hover:text-emerald-700">
                                                    <Paperclip className="w-4 h-4" />
                                                </a>
                                            )}
                                            {hasContract && (
                                                <a href={expense.contractPdfUrl || contractMap.get(expense.relatedContractId)?.contractPdfUrl} 
                                                   target="_blank" rel="noopener noreferrer"
                                                   className="text-blue-600 hover:text-blue-700">
                                                    <FileSignature className="w-4 h-4" />
                                                </a>
                                            )}
                                            {!requiresContract && (
                                                <span className="text-gray-400" title="Contratto non richiesto">
                                                    <X className="w-4 h-4" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            {canEditOrDelete(expense) && (
                                                <>
                                                    <button 
                                                        onClick={() => onDuplicate(expense)}
                                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all">
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => onEdit(expense)}
                                                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-all">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => onDelete(expense)}
                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            )}
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
});

// ===== MAIN COMPONENT - EXPENSES PAGE =====
export default function ExpensesPage({ user, initialFilters }) {
    const location = useLocation();
    
    // Stati principali
    const [rawExpenses, setRawExpenses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [geographicAreas, setGeographicAreas] = useState([]);
    const [contracts, setContracts] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [sectorBudgets, setSectorBudgets] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Stati UI
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [expandedExpenses, setExpandedExpenses] = useState({});
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [viewMode, setViewMode] = useState('table');
    
    // Stati filtri
    const [searchTerm, setSearchTerm] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('');
    const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
    const [selectedSector, setSelectedSector] = useState('all');
    const [invoiceFilter, setInvoiceFilter] = useState('');
    const [contractFilter, setContractFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState([]);
    const [areaFilter, setAreaFilter] = useState('');
    const [specialFilter, setSpecialFilter] = useState(null);
    const [sortOrder, setSortOrder] = useState('date_desc');
    const [statusFilter, setStatusFilter] = useState('all');
    
    // Debounce search per performance
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);
    
    // Map per lookup rapidi con memoizzazione aggressiva
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const marketingChannelMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.name])), [marketingChannels]);
    const contractMap = useMemo(() => new Map(contracts.map(c => [c.id, c])), [contracts]);
    
    // Ordinamento settori
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
    
    // ID filiale "Generico" memoizzato
    const genericoBranchId = useMemo(() => 
        branches.find(b => b.name.toLowerCase() === 'generico')?.id, 
        [branches]
    );
    
    // Cache filiali per settore
    const branchesPerSector = useMemo(() => {
        const cache = new Map();
        sectors.forEach(sector => {
            const sectorBranches = branches.filter(b => 
                b.associatedSectors?.includes(sector.id) && 
                b.id !== genericoBranchId
            );
            cache.set(sector.id, sectorBranches);
        });
        return cache;
    }, [sectors, branches, genericoBranchId]);
    
    // Budget per fornitore/settore
    const budgetInfoMap = useMemo(() => {
        const map = new Map();
        const currentYear = new Date().getFullYear();
        
        budgets.forEach(budget => {
            if (budget.year === currentYear && budget.allocations) {
                budget.allocations.forEach(allocation => {
                    const key = `${budget.supplierId}-${allocation.sectorId}`;
                    map.set(key, {
                        budget: allocation.budgetAmount || 0,
                        spent: 0
                    });
                });
            }
        });
        
        return map;
    }, [budgets]);
    
    // Inizializzazione filtri da props/location
    useEffect(() => {
        const filters = initialFilters || location.state;
        if (filters && Object.keys(filters).length > 0) {
            if (filters.branchFilter) { 
                setBranchFilter(filters.branchFilter); 
                setIsAdvancedFiltersOpen(true); 
            }
            if (filters.specialFilter) { 
                setSpecialFilter(filters.specialFilter); 
            }
        }
    }, [initialFilters, location.state]);
    
    // Caricamento dati da Firebase
    useEffect(() => {
        setIsLoading(true);
        
        let expensesQuery = query(collection(db, "expenses"), orderBy("date", "desc"));
        
        if (user.role === 'collaborator' && user.assignedChannels?.length > 0 && user.assignedChannels.length <= 10) {
            expensesQuery = query(
                collection(db, "expenses"),
                where("supplierId", "in", user.assignedChannels),
                orderBy("date", "desc")
            );
        }
        
        const currentYear = new Date().getFullYear();
        
        const unsubscribes = [
            onSnapshot(expensesQuery, (snap) => {
                const expenses = snap.docs.map(doc => ({ 
                    ...doc.data(), 
                    id: doc.id 
                }));
                setRawExpenses(expenses);
            }),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), 
                snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), 
                snap => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), 
                snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "marketing_channels"), orderBy("name")), 
                snap => setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "geographic_areas"), orderBy("name")), 
                snap => setGeographicAreas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "contracts"), orderBy("description")), 
                snap => setContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "budgets"), where("year", "==", currentYear)), 
                snap => setBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sector_budgets"), where("year", "==", currentYear)), 
                snap => {
                    setSectorBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    setIsLoading(false);
                })
        ];
        
        return () => unsubscribes.forEach(unsub => unsub());
    }, [user]);
    
    // PROCESSAMENTO SPESE OTTIMIZZATO con memoizzazione aggressiva
    const processedExpenses = useMemo(() => {
        // 1. NORMALIZZAZIONE
        let normalized = rawExpenses.map(expense => {
            // Normalizza IDs
            let supplierId = expense.supplierId || expense.supplierld || expense.channelId || expense.channelld;
            let sectorId = expense.sectorId || expense.sectorld;
            
            // Prepara lineItems
            let lineItems = [];
            if (Array.isArray(expense.lineItems) && expense.lineItems.length > 0) {
                lineItems = expense.lineItems.map((item, index) => ({
                    ...item,
                    assignmentId: item.assignmentId || item.assignmentid || item.branchld || expense.branchId || expense.branchld || "",
                    marketingChannelId: item.marketingChannelId || item.marketingChannelld || "",
                    sectorId: item.sectorId || item.sectorld || sectorId,
                    amount: parseFloat(item.amount) || 0,
                    _key: `${expense.id}-${index}`
                }));
            } else {
                lineItems.push({
                    description: expense.description || 'Voce principale',
                    amount: parseFloat(expense.amount) || 0,
                    marketingChannelId: expense.marketingChannelId || expense.marketingChannelld || "",
                    assignmentId: expense.branchId || expense.branchld || "",
                    sectorId: sectorId,
                    _key: `${expense.id}-0`
                });
            }
            
            // Calcola totale
            const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
            
            // Processa lineItems per display
            const processedLineItems = [];
            const processedGroupIds = new Set();
            
            lineItems.forEach(item => {
                if (item.splitGroupId && !processedGroupIds.has(item.splitGroupId)) {
                    const groupItems = lineItems.filter(li => li.splitGroupId === item.splitGroupId);
                    const totalGroupAmount = groupItems.reduce((sum, gi) => sum + gi.amount, 0);
                    const branchNames = groupItems.map(gi => branchMap.get(gi.assignmentId) || 'N/D').join(', ');
                    
                    processedLineItems.push({
                        _key: item.splitGroupId,
                        isGroup: true,
                        description: item.description,
                        amount: totalGroupAmount,
                        displayAmount: totalGroupAmount,
                        marketingChannelId: item.marketingChannelId,
                        branchNames: branchNames,
                        branchCount: groupItems.length,
                    });
                    processedGroupIds.add(item.splitGroupId);
                } else if (!item.splitGroupId) {
                    if (item.assignmentId === genericoBranchId) {
                        const sectorBranches = branchesPerSector.get(item.sectorId) || [];
                        processedLineItems.push({
                            ...item,
                            isGenerico: true,
                            displayAmount: item.amount,
                            distributedTo: sectorBranches.length > 0 
                                ? `${sectorBranches.length} filiali: ${sectorBranches.map(b => b.name).join(', ')}` 
                                : 'Nessuna filiale associata'
                        });
                    } else {
                        processedLineItems.push({
                            ...item,
                            displayAmount: item.amount
                        });
                    }
                }
            });
            
            // Aggiungi info budget
            const budgetKey = `${supplierId}-${sectorId}`;
            const budgetInfo = budgetInfoMap.get(budgetKey);
            
            const hasTopLevelContract = !!expense.contractPdfUrl || !!expense.relatedContractId;
            const allLineItemsHaveContract = lineItems.length > 0 && lineItems.every(li => !!li.relatedContractId);
            const isContractSatisfied = hasTopLevelContract || allLineItemsHaveContract;
            
            return {
                ...expense,
                isContractSatisfied,
                supplierId,
                sectorId,
                amount: totalAmount,
                lineItems,
                processedLineItems,
                displayAmount: totalAmount,
                budgetInfo,
                requiresContract: expense.requiresContract !== undefined ? expense.requiresContract : true
            };
        });
        
        // 2. FILTRAGGIO
        
        // Filtro per settore
        if (selectedSector !== 'all') {
            normalized = normalized.filter(exp => exp.sectorId === selectedSector);
        }
        
        // Filtro per fornitore (multi-selezione)
if (supplierFilter.length > 0) {
    normalized = normalized.filter(exp => supplierFilter.includes(exp.supplierId));
}
        
        // Filtro per date
        if (dateFilter.startDate && dateFilter.endDate) {
            const start = new Date(dateFilter.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(dateFilter.endDate);
            end.setHours(23, 59, 59, 999);
            
            normalized = normalized.filter(exp => {
                const expDate = exp.date ? new Date(exp.date) : null;
                return expDate && expDate >= start && expDate <= end;
            });
        }
        
        // Filtro stato
        if (statusFilter === 'complete') {
            normalized = normalized.filter(exp => {
                const requiresContract = exp.requiresContract !== false;
                return exp.invoicePdfUrl && (!requiresContract || exp.contractPdfUrl || exp.relatedContractId);
            });
        } else if (statusFilter === 'incomplete') {
         normalized = normalized.filter(exp => {
        const requiresContract = exp.requiresContract !== false;
        return !exp.invoicePdfUrl || (requiresContract && !exp.isContractSatisfied);
        });
        }else if (statusFilter === 'amortized') {
            normalized = normalized.filter(exp => exp.isAmortized);
        }
        
        // Altri filtri esistenti...
        if (invoiceFilter === 'present') {
            normalized = normalized.filter(exp => !!exp.invoicePdfUrl);
        } else if (invoiceFilter === 'missing') {
            normalized = normalized.filter(exp => !exp.invoicePdfUrl);
        }
        
        if (contractFilter === 'present') {
            normalized = normalized.filter(exp => !!exp.contractPdfUrl || !!exp.relatedContractId);
        } else if (contractFilter === 'missing') {
            normalized = normalized.filter(exp => !exp.contractPdfUrl && !exp.relatedContractId);
        }
        
        // Filtro filiale con calcolo distribuito
        if (branchFilter.length > 0) {
            normalized = normalized.filter(exp => 
                exp.lineItems?.some(item => {
                    if (branchFilter.includes(item.assignmentId)) return true;
                    
                    if (item.assignmentId === genericoBranchId) {
                        const sectorBranches = branchesPerSector.get(item.sectorId || exp.sectorId) || [];
                        return sectorBranches.some(b => branchFilter.includes(b.id));
                    }
                    
                    return false;
                })
            );
            
            // Ricalcola displayAmount per filiali filtrate
            normalized = normalized.map(exp => {
                let displayAmount = 0;
                let hasDistributedAmount = false;
                const distributedDetails = [];
                
                (exp.lineItems || []).forEach(item => {
                    const itemAmount = item.amount || 0;
                    
                    if (branchFilter.includes(item.assignmentId)) {
                        displayAmount += itemAmount;
                    } else if (item.assignmentId === genericoBranchId) {
                        const sectorBranches = branchesPerSector.get(item.sectorId || exp.sectorId) || [];
                        const filteredBranchesInSector = sectorBranches.filter(b => branchFilter.includes(b.id));
                        
                        if (filteredBranchesInSector.length > 0 && sectorBranches.length > 0) {
                            const quotaPerBranch = itemAmount / sectorBranches.length;
                            const quotaForFiltered = quotaPerBranch * filteredBranchesInSector.length;
                            displayAmount += quotaForFiltered;
                            hasDistributedAmount = true;
                            
                            distributedDetails.push(`${formatCurrency(quotaPerBranch)} x ${filteredBranchesInSector.length} filiali`);
                        }
                    }
                });
                
                return {
                    ...exp,
                    displayAmount,
                    hasDistributedAmount,
                    distributedInfo: hasDistributedAmount ? { details: distributedDetails.join(' + ') } : null
                };
            });
        }
        
        // Filtro ricerca testuale con debounce
        if (debouncedSearchTerm.trim()) {
            const lowerSearch = debouncedSearchTerm.toLowerCase();
            normalized = normalized.filter(exp => {
                const supplierName = supplierMap.get(exp.supplierId) || '';
                const channelNames = exp.lineItems?.map(item => 
                    marketingChannelMap.get(item.marketingChannelId) || ''
                ).join(' ');
                
                return exp.description?.toLowerCase().includes(lowerSearch) ||
                       supplierName.toLowerCase().includes(lowerSearch) ||
                       channelNames?.toLowerCase().includes(lowerSearch) ||
                       exp.lineItems?.some(item => item.description?.toLowerCase().includes(lowerSearch));
            });
        }
        
        // Filtri speciali
        if (specialFilter === 'unassigned') {
            normalized = normalized.filter(exp => {
                if (exp.lineItems && exp.lineItems.length > 0) {
                    return exp.lineItems.some(item => !item.assignmentId || !branchMap.has(item.assignmentId));
                }
                return !exp.branchId || !branchMap.has(exp.branchId);
            });
        }
        
        // 3. ORDINAMENTO
        normalized.sort((a, b) => {
            switch (sortOrder) {
                case 'amount_desc':
                    return b.displayAmount - a.displayAmount;
                case 'amount_asc':
                    return a.displayAmount - b.displayAmount;
                case 'date_desc':
                    return new Date(b.date || 0) - new Date(a.date || 0);
                case 'date_asc':
                    return new Date(a.date || 0) - new Date(b.date || 0);
                case 'name_asc':
                    return (supplierMap.get(a.supplierId) || '').localeCompare(supplierMap.get(b.supplierId) || '');
                case 'name_desc':
                    return (supplierMap.get(b.supplierId) || '').localeCompare(supplierMap.get(a.supplierId) || '');
                default:
                    return 0;
            }
        });
        
        return normalized;
    }, [
        rawExpenses, 
        selectedSector, 
        supplierFilter, 
        dateFilter, 
        statusFilter,
        invoiceFilter, 
        contractFilter,
        areaFilter, 
        branchFilter, 
        debouncedSearchTerm, 
        specialFilter,
        sortOrder,
        supplierMap, 
        marketingChannelMap, 
        geographicAreas, 
        branchMap,
        genericoBranchId, 
        branchesPerSector,
        budgetInfoMap
    ]);
    
    // Calcolo KPI ottimizzato
    const kpiData = useMemo(() => {
        const total = processedExpenses.length;
        const totalSpend = branchFilter.length > 0 
            ? processedExpenses.reduce((sum, exp) => sum + (exp.displayAmount || 0), 0)
            : processedExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
        
        const withInvoice = processedExpenses.filter(exp => exp.invoicePdfUrl).length;
        const withContract = processedExpenses.filter(exp => exp.contractPdfUrl || exp.relatedContractId).length;
        const complete = processedExpenses.filter(exp => {
        const requiresContract = exp.requiresContract !== false;
        return exp.invoicePdfUrl && (!requiresContract || exp.isContractSatisfied);
        }).length;
        const incomplete = processedExpenses.filter(exp => {
        const requiresContract = exp.requiresContract !== false;
        return !exp.invoicePdfUrl || (requiresContract && !exp.isContractSatisfied);
        }).length;
        
        // Calcola budget totale per spese visualizzate
        let totalBudget = 0;
        if (selectedSector === 'all') {
            totalBudget = sectorBudgets.reduce((sum, sb) => sum + (sb.maxAmount || 0), 0);
        } else {
            const sectorBudget = sectorBudgets.find(sb => sb.sectorId === selectedSector);
            totalBudget = sectorBudget?.maxAmount || 0;
        }
        
        const budgetUtilization = totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0;
        
        // Calcolo trend
        const currentMonth = new Date().getMonth();
        const currentMonthSpend = processedExpenses.filter(exp => {
            const expDate = exp.date ? new Date(exp.date) : null;
            return expDate && expDate.getMonth() === currentMonth;
        }).reduce((sum, exp) => sum + exp.displayAmount, 0);
        
        const lastMonth = currentMonth - 1;
        const lastMonthSpend = processedExpenses.filter(exp => {
            const expDate = exp.date ? new Date(exp.date) : null;
            return expDate && expDate.getMonth() === lastMonth;
        }).reduce((sum, exp) => sum + exp.displayAmount, 0);
        
        const trend = lastMonthSpend > 0 ? 
            ((currentMonthSpend - lastMonthSpend) / lastMonthSpend * 100).toFixed(1) : 0;
        
        return {
            totalExpenses: total,
            totalSpend,
            totalBudget,
            budgetUtilization,
            withInvoicePercentage: total > 0 ? ((withInvoice / total) * 100).toFixed(1) : 0,
            withContractPercentage: total > 0 ? ((withContract / total) * 100).toFixed(1) : 0,
            completePercentage: total > 0 ? ((complete / total) * 100).toFixed(1) : 0,
            incomplete,
            trend: {
                direction: parseFloat(trend) >= 0 ? 'up' : 'down',
                value: `${Math.abs(parseFloat(trend))}%`
            }
        };
    }, [processedExpenses, branchFilter, sectorBudgets, selectedSector]);
    
    // Check spese con problemi (aggiornato per requiresContract)
    const expensesWithIssues = useMemo(() => {
        return processedExpenses.filter(exp => {
    const requiresContract = exp.requiresContract !== false;
    const hasInvoice = !!exp.invoicePdfUrl;

    return !hasInvoice || (requiresContract && !exp.isContractSatisfied);
    });
    }, [processedExpenses]);
    
    // Callbacks ottimizzati
    const toggleExpense = useCallback((expenseId) => {
        setExpandedExpenses(prev => ({ ...prev, [expenseId]: !prev[expenseId] }));
    }, []);
    
    const canEditOrDelete = useCallback((expense) => {
        return user.role === 'manager' || user.role === 'admin' || expense.authorId === user.uid;
    }, [user.role, user.uid]);
    
    const handleOpenAddModal = useCallback(() => { 
        setEditingExpense(null); 
        setIsModalOpen(true); 
    }, []);
    
    const handleCloseModal = useCallback(() => { 
        setIsModalOpen(false); 
        setEditingExpense(null); 
    }, []);
    
    const handleOpenEditModal = useCallback((expense) => {
        if (!canEditOrDelete(expense)) {
            return toast.error("Non hai i permessi per modificare questa spesa.");
        }
        setEditingExpense(expense);
        setIsModalOpen(true);
    }, [canEditOrDelete]);
    
    const handleSaveExpense = useCallback(async (expenseData, invoiceFile, contractFile) => {
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
            
            const dataToSave = {
                date: expenseData.date,
                description: expenseData.description,
                sectorId: expenseData.sectorId,
                supplierId: expenseData.supplierId,
                amount: expenseData.lineItems.reduce((sum, item) => sum + item.amount, 0),
                lineItems: expenseData.lineItems,
                invoicePdfUrl: invoiceURL,
                contractPdfUrl: contractURL,
                relatedContractId: expenseData.relatedContractId || null,
                requiresContract: expenseData.requiresContract !== undefined ? expenseData.requiresContract : true,
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
    }, [user.uid, user.name, handleCloseModal]);
    
    const handleDeleteExpense = useCallback(async (expense) => {
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
            toast.success("Spesa eliminata!", { id: toastId });
        } catch (error) {
            toast.error("Errore durante l'eliminazione.", { id: toastId });
        }
    }, [canEditOrDelete]);
    
    const handleDuplicateExpense = useCallback((expense) => {
        const { id, invoicePdfUrl, contractPdfUrl, createdAt, updatedAt, authorId, authorName, ...rest } = expense;
        setEditingExpense({ 
            ...rest, 
            description: `${expense.description || ''} (Copia)`, 
            date: new Date().toISOString().split('T')[0] 
        });
        setIsModalOpen(true);
    }, []);
    
    const resetFilters = useCallback(() => {
        setSearchTerm(''); 
        setSupplierFilter(''); 
        setDateFilter({ startDate: '', endDate: '' }); 
        setSelectedSector('all');
        setInvoiceFilter(''); 
        setContractFilter(''); 
        setBranchFilter([]); 
        setAreaFilter(''); 
        setSpecialFilter(null);
        setStatusFilter('all');
        setSortOrder('date_desc');
        toast.success("Filtri resettati!");
    }, []);
    
    const handleExportExcel = useCallback(() => {
        toast.info("Export Excel in sviluppo...");
    }, [processedExpenses]);
    
    // Check filtri attivi
    const areAdvancedFiltersActive = invoiceFilter || contractFilter || branchFilter.length > 0 || areaFilter;
    const hasActiveFilters = searchTerm || supplierFilter || dateFilter.startDate || dateFilter.endDate || 
                           selectedSector !== 'all' || areAdvancedFiltersActive || specialFilter || 
                           statusFilter !== 'all' || sortOrder !== 'date_desc';
    
    const hasOverBudget = kpiData.budgetUtilization > 100;
    
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
                {/* Header migliorato */}
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
                    
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleExportExcel}
                            className="hidden lg:flex items-center gap-2 px-4 py-3 bg-white/80 text-gray-700 font-semibold rounded-xl hover:bg-white hover:shadow-lg transition-all"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                        
                        <button 
                            onClick={handleOpenAddModal} 
                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all hover:scale-105"
                        >
                            <PlusCircle className="w-5 h-5" />
                            Aggiungi Spesa
                        </button>
                    </div>
                </div>
                
                {/* Filtri migliorati */}
                <div className="relative z-40 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 p-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
    {/* Barra di ricerca (occupa 2 colonne) */}
    <div className="relative lg:col-span-2">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input 
            type="text" 
            placeholder="Cerca per descrizione, fornitore, canale..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full h-12 pl-12 pr-4 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
        />
    </div>

    {/* Selettore Data Inizio */}
    <div>
        <input 
            type="date" 
            value={dateFilter.startDate} 
            onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))} 
            className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
        />
    </div>

    {/* Selettore Data Fine */}
    <div>
        <input 
            type="date" 
            value={dateFilter.endDate} 
            onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))} 
            className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
        />
    </div>

    {/* Toggle Vista (allineato a destra) */}
    <div className="flex justify-end">
        <div className="flex items-center gap-2">
            <button onClick={() => setViewMode('cards')} className={`p-2 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-amber-100 text-amber-600' : 'text-gray-400 hover:bg-gray-100'}`} title="Vista Card">
                <LayoutGrid className="w-5 h-5" />
            </button>
            <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-amber-100 text-amber-600' : 'text-gray-400 hover:bg-gray-100'}`} title="Vista Tabella">
                <List className="w-5 h-5" />
            </button>
        </div>
    </div>
</div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
    <MultiSelect
        options={suppliers}
        selected={supplierFilter}
        onChange={(supplierId) => {
            setSupplierFilter(prev => 
                prev.includes(supplierId) 
                    ? prev.filter(id => id !== supplierId) 
                    : [...prev, supplierId]
            );
        }}
        placeholder="Tutti i fornitori"
        selectedText={`${supplierFilter.length} fornitore${supplierFilter.length > 1 ? 'i' : ''} selezionat${supplierFilter.length > 1 ? 'i' : 'o'}`}
        searchPlaceholder="Cerca fornitore..."
    />
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
                                {/* Filtri Settore */}
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
                                    {orderedSectors.map(sector => {
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
                                
                                {/* Filtri Stato Rapidi e Ordinamento */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                    {/* Filtri Stato */}
                                    <div className="flex flex-wrap gap-2">
    <button
        onClick={() => setStatusFilter('all')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            statusFilter === 'all' ? 'bg-amber-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
        }`}
    >
        Tutte ({kpiData.totalExpenses})
    </button>
    {kpiData.incomplete > 0 && (
        <button
            onClick={() => setStatusFilter('incomplete')}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 transition-all ${
                statusFilter === 'incomplete' ? 'bg-red-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
        >
            <AlertTriangle className="w-3 h-3" />
            Incomplete ({kpiData.incomplete})
        </button>
    )}
    <button
        onClick={() => setStatusFilter('complete')}
        className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1 transition-all ${
            statusFilter === 'complete' ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
        }`}
    >
        <CheckCircle2 className="w-3 h-3" />
        Complete ({kpiData.complete})
    </button>
</div>
                                    
                                    {/* Ordinamento */}
                                    <select
                                        value={sortOrder}
                                        onChange={(e) => setSortOrder(e.target.value)}
                                        className="h-10 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all text-sm font-semibold"
                                    >
                                        <option value="date_desc">Data ↓</option>
                                        <option value="date_asc">Data ↑</option>
                                        <option value="amount_desc">Importo ↓</option>
                                        <option value="amount_asc">Importo ↑</option>
                                        <option value="name_asc">Nome A-Z</option>
                                        <option value="name_desc">Nome Z-A</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Alert Sforamento Budget */}
                {hasOverBudget && (
                    <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-2xl p-4 lg:p-6 flex flex-col sm:flex-row items-start gap-3">
                        <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-red-900 mb-1 text-sm lg:text-base">
                                Attenzione: Budget Superato
                            </h4>
                            <p className="text-xs lg:text-sm text-red-700">
                                Hai superato il budget previsto per {selectedSector === 'all' ? 'l\'anno' : 'questo settore'}. 
                                Speso: {formatCurrency(kpiData.totalSpend)} su {formatCurrency(kpiData.totalBudget)} disponibili.
                                <span className="font-semibold"> Sforamento: {formatCurrency(kpiData.totalSpend - kpiData.totalBudget)}</span>
                            </p>
                        </div>
                    </div>
                )}
                
                {/* Alert Documenti Mancanti */}
                {expensesWithIssues.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 lg:p-6 flex flex-col sm:flex-row items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-amber-900 mb-1 text-sm lg:text-base">
                                {expensesWithIssues.length} Spese con Documenti Mancanti
                            </h4>
                            <p className="text-xs lg:text-sm text-amber-700">
                                Alcune spese non hanno fattura o contratto allegato (quando richiesto). 
                                Completa la documentazione per la conformità fiscale.
                            </p>
                        </div>
                    </div>
                )}
                
                {/* KPI Cards migliorate */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
                    <KpiCard 
                        title="Spese Totali" 
                        value={kpiData.totalExpenses.toString()}
                        subtitle={`${processedExpenses.length} spese filtrate`}
                        icon={<FileText className="w-6 h-6" />}
                        gradient="from-amber-500 to-orange-600"
                    />
                    <KpiCard 
                        title="Importo Totale" 
                        value={formatCurrency(kpiData.totalSpend)}
                        subtitle={`Budget: ${formatCurrency(kpiData.totalBudget)}`}
                        icon={<DollarSign className="w-6 h-6" />}
                        gradient="from-emerald-500 to-green-600"
                        trend={kpiData.trend}
                    />
                    <KpiCard 
                        title="Utilizzo Budget" 
                        value={`${kpiData.budgetUtilization.toFixed(1)}%`}
                        subtitle={kpiData.budgetUtilization > 100 ? "Sforato!" : "In linea"}
                        icon={<Percent className="w-6 h-6" />}
                        gradient={
                            kpiData.budgetUtilization > 100 ? "from-red-500 to-rose-600" :
                            kpiData.budgetUtilization > 85 ? "from-amber-500 to-orange-600" :
                            "from-blue-500 to-indigo-600"
                        }
                    />
                    <KpiCard 
                        title="Con Fattura" 
                        value={`${kpiData.withInvoicePercentage}%`}
                        subtitle="Documenti fiscali"
                        icon={<CheckCircle2 className="w-6 h-6" />}
                        gradient="from-blue-500 to-indigo-600"
                    />
                    <KpiCard 
                        title="Complete" 
                        value={`${kpiData.completePercentage}%`}
                        subtitle="Tutti i documenti"
                        icon={<Activity className="w-6 h-6" />}
                        gradient="from-purple-500 to-pink-600"
                    />
                </div>
                
                {/* Lista Spese con nuovo design o tabella */}
                {processedExpenses.length > 0 ? (
                    viewMode === 'cards' ? (
                        <div className="space-y-4 lg:space-y-4">
                            {processedExpenses.map(expense => (
                                <ExpenseCardCompact
                                    key={expense.id}
                                    expense={expense}
                                    sectorMap={sectorMap}
                                    supplierMap={supplierMap}
                                    branchMap={branchMap}
                                    marketingChannelMap={marketingChannelMap}
                                    contractMap={contractMap}
                                    budgetInfo={expense.budgetInfo}
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
                        <ExpenseTableView
                            expenses={processedExpenses}
                            sectorMap={sectorMap}
                            supplierMap={supplierMap}
                            branchMap={branchMap}
                            marketingChannelMap={marketingChannelMap}
                            contractMap={contractMap}
                            onEdit={handleOpenEditModal}
                            onDelete={handleDeleteExpense}
                            onDuplicate={handleDuplicateExpense}
                            canEditOrDelete={canEditOrDelete}
                        />
                    )
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
                branches={branches}
            />
        </div>
    );
}