import React, { useState, useEffect, useMemo } from 'react';
import { FileText, X, PlusCircle, Trash2, Link, List, Paperclip, ChevronDown, Check, ShoppingCart, FileSignature, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

// --- Componente MultiSelect ---
const MultiSelect = ({ options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredOptions = useMemo(() => 
        (options || []).filter(opt => opt.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [options, searchTerm]
    );

    const selectedCount = useMemo(() => (selected || []).length, [selected]);

    return (
        <div className="relative">
            <button 
                type="button" 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full h-10 px-3 text-left bg-white border-2 border-slate-200 rounded-lg flex justify-between items-center hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
            >
                <span className="block truncate text-slate-800 text-sm">
                    {selectedCount > 0 ? `${selectedCount} selezionat${selectedCount > 1 ? 'e' : 'a'}` : <span className="text-slate-400">Seleziona...</span>}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div 
                    className="absolute z-20 mt-1 w-full bg-white shadow-2xl rounded-xl border border-slate-200 max-h-60 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-2 sticky top-0 bg-white border-b border-slate-100">
                        <input 
                            type="text" 
                            placeholder="Cerca..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        />
                    </div>
                    <ul className="p-2">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => {
                                const isChecked = (selected || []).includes(option.id);
                                return (
                                    <li 
                                        key={option.id} 
                                        onClick={() => onChange(option.id)} 
                                        className="px-3 py-2.5 hover:bg-amber-50 cursor-pointer flex items-center justify-between transition-colors rounded-lg"
                                    >
                                        <span className="text-sm font-medium text-slate-800">{option.name}</span>
                                        <div className={`
                                            w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                                            ${isChecked ? 'bg-amber-600 border-amber-600' : 'bg-white border-slate-300'}
                                        `}>
                                            {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                    </li>
                                );
                            })
                        ) : (
                            <li className="px-3 py-4 text-center text-sm text-slate-500">
                                Nessuna opzione trovata
                            </li>
                        )}
                    </ul>
                </div>
            )}
            {isOpen && <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>}
        </div>
    );
};

const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '€ 0,00';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

export default function ExpenseFormModal({ 
    isOpen, 
    onClose, 
    onSave, 
    initialData, 
    suppliers, 
    sectors, 
    branches, 
    contracts, 
    marketingChannels 
}) {
    
    const defaultLineItem = useMemo(() => ({
        _key: Math.random(),
        description: '',
        amount: '',
        sectorId: '',
        branchIds: [],
        marketingChannelId: '',
        relatedContractId: '',
        relatedLineItemId: '', // ⭐ NUOVO CAMPO
    }), []);

    const defaultFormData = useMemo(() => ({
        supplierId: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        relatedContractId: '',
        requiresContract: true,
        isAmortized: false,
        amortizationStartDate: '',
        amortizationEndDate: '',
        lineItems: [defaultLineItem],
        contractLinkType: 'single',
    }), [defaultLineItem]);

    const [formData, setFormData] = useState(defaultFormData);
    const [invoiceFile, setInvoiceFile] = useState(null);
    
    // ⭐ NUOVO STATO: Per memorizzare i lineItems del contratto selezionato
    const [contractLineItems, setContractLineItems] = useState([]);
    const [selectedContract, setSelectedContract] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                const enrichedLineItems = (initialData.lineItems && initialData.lineItems.length > 0)
                    ? initialData.lineItems.map(item => ({
                        ...item,
                        _key: Math.random(),
                        amount: item.amount || '',
                        sectorId: item.sectorId || item.sectorld || initialData.sectorId || initialData.sectorld,
                        branchIds: item.assignmentId ? [item.assignmentId] : [],
                        marketingChannelId: item.marketingChannelId || item.marketingChannelld,
                        relatedLineItemId: item.relatedLineItemId || '', // ⭐ NUOVO
                    }))
                    : [{ ...defaultLineItem, _key: Math.random() }];

                const linkType = enrichedLineItems.some(li => li.relatedContractId) ? 'line' : 'single';
                
                setFormData({ 
                    ...initialData,
                    supplierId: initialData.supplierId || initialData.supplierld,
                    contractLinkType: linkType,
                    requiresContract: initialData.requiresContract !== undefined ? initialData.requiresContract : true,
                    lineItems: enrichedLineItems,
                });
            } else {
                setFormData(defaultFormData);
            }
            setInvoiceFile(null);
            setContractLineItems([]);
            setSelectedContract(null);
        }
    }, [isOpen, initialData, defaultFormData, defaultLineItem]);
    
    // ⭐ NUOVO useEffect: Carica i lineItems quando si seleziona un contratto
    useEffect(() => {
        if (formData.relatedContractId && contracts && formData.requiresContract) {
            const contract = contracts.find(c => c.id === formData.relatedContractId);
            if (contract && contract.lineItems) {
                setSelectedContract(contract);
                setContractLineItems(contract.lineItems);
            } else {
                setSelectedContract(null);
                setContractLineItems([]);
            }
        } else {
            setSelectedContract(null);
            setContractLineItems([]);
        }
    }, [formData.relatedContractId, contracts, formData.requiresContract]);
    
    const expenseTotal = useMemo(() => {
        return formData.lineItems?.reduce((sum, item) => {
            const amount = parseFloat(String(item.amount || '0').replace(',', '.'));
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0) || 0;
    }, [formData.lineItems]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const finalValue = type === 'checkbox' ? checked : value;
        setFormData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleLineItemChange = (index, field, value) => {
        const updatedLineItems = [...formData.lineItems];
        updatedLineItems[index][field] = value;
        setFormData(prev => ({ ...prev, lineItems: updatedLineItems }));
    };

    const handleBranchMultiSelectChange = (lineIndex, branchId) => {
        const updatedLineItems = [...formData.lineItems];
        const currentSelection = updatedLineItems[lineIndex].branchIds || [];
        const newSelection = currentSelection.includes(branchId)
            ? currentSelection.filter(id => id !== branchId)
            : [...currentSelection, branchId];
        updatedLineItems[lineIndex].branchIds = newSelection;
        setFormData(prev => ({ ...prev, lineItems: updatedLineItems }));
    };

    const addLineItem = () => {
        setFormData(prev => ({
            ...prev,
            lineItems: [...prev.lineItems, { ...defaultLineItem, _key: Math.random() }]
        }));
    };

    const removeLineItem = (index) => {
        if (formData.lineItems.length <= 1) {
            return toast.error("Deve esserci almeno una voce di spesa.");
        }
        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.filter((_, i) => i !== index)
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type === "application/pdf") {
            setInvoiceFile(file);
            toast.success(`File selezionato: ${file.name}`);
        } else {
            toast.error("Per favore, seleziona un file PDF.");
            e.target.value = null;
        }
    };
    
    const availableContracts = useMemo(() => {
        if (!formData.supplierId || !contracts) return [];
        return contracts.filter(c => c.supplierld === formData.supplierId);
    }, [formData.supplierId, contracts]);

    const filteredMarketingChannels = useMemo(() => {
        if (!formData.supplierId || !suppliers || !marketingChannels) {
            return marketingChannels;
        }
        const selectedSupplier = suppliers.find(s => s.id === formData.supplierId);
        const offeredIds = selectedSupplier?.offeredMarketingChannels || [];
        
        if (offeredIds.length === 0) return marketingChannels;

        return marketingChannels.filter(mc => offeredIds.includes(mc.id));
    }, [formData.supplierId, suppliers, marketingChannels]);

    // ⭐ NUOVA FUNZIONE: Ottieni i lineItems per un contratto specifico (per modalità "Per Singola Voce")
    const getLineItemsForContract = (contractId) => {
        if (!contractId || !contracts) return [];
        const contract = contracts.find(c => c.id === contractId);
        return contract?.lineItems || [];
    };

    // ⭐ FUNZIONE HELPER: Calcola il residuo di un lineItem
    const calculateLineItemRemaining = (lineItem) => {
        // Questa è una versione semplificata - dovresti passare le spese come prop per calcolare accuratamente
        return lineItem.totalAmount || 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.supplierId || !formData.date) {
            toast.error("Fornitore e Data sono campi obbligatori.");
            return;
        }
        
        const finalLineItems = [];
        let hasError = false;

        formData.lineItems.forEach((item, index) => {
            if (hasError) return;
            const branches = item.branchIds || [];
            if (!item.description || !item.amount || !item.sectorId || branches.length === 0 || !item.marketingChannelId) {
                toast.error(`Tutti i campi nella voce di spesa #${index + 1} sono obbligatori.`);
                hasError = true;
                return;
            }

            const amount = parseFloat(String(item.amount).replace(',', '.')) || 0;

            if (branches.length > 1) {
                const amountPerBranch = amount / branches.length;
                const splitGroupId = uuidv4();
                branches.forEach(branchId => {
                    finalLineItems.push({
                        description: item.description,
                        amount: amountPerBranch,
                        sectorId: item.sectorId,
                        assignmentId: branchId,
                        marketingChannelId: item.marketingChannelId,
                        relatedContractId: formData.contractLinkType === 'line' ? (item.relatedContractId || null) : (formData.relatedContractId || null),
                        relatedLineItemId: item.relatedLineItemId || null, // ⭐ NUOVO: Salva il lineItem collegato
                        splitGroupId,
                    });
                });
            } else {
                finalLineItems.push({
                    description: item.description,
                    amount,
                    sectorId: item.sectorId,
                    assignmentId: branches[0],
                    marketingChannelId: item.marketingChannelId,
                    relatedContractId: formData.contractLinkType === 'line' ? (item.relatedContractId || null) : (formData.relatedContractId || null),
                    relatedLineItemId: item.relatedLineItemId || null, // ⭐ NUOVO: Salva il lineItem collegato
                });
            }
        });

        if (hasError) return;

        const finalData = {
            ...formData,
            supplierId: formData.supplierId,
            lineItems: finalLineItems,
            requiresContract: formData.requiresContract,
            invoiceFile: invoiceFile || null,
        };

        onSave(finalData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center px-4" onClick={onClose}>
            <div className="w-full max-w-5xl max-h-[90vh] bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white px-6 py-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.4em] text-white/70 font-semibold">Spese</p>
                        <h2 className="text-2xl font-black">{formData.id ? 'Modifica Spesa' : 'Nuova Spesa'}</h2>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white hover:bg-white/30 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/70">
                        
                        {/* Sezione Dati Principali */}
                        <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 space-y-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <ShoppingCart className="w-5 h-5 text-amber-600" />
                                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                                    Informazioni Principali
                                </h4>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">Fornitore *</label>
                                    <select 
                                        name="supplierId" 
                                        value={formData.supplierId || ''} 
                                        onChange={handleInputChange} 
                                        required 
                                        className="w-full h-11 px-3 bg-white border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                                    >
                                        <option value="">Seleziona Fornitore</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">Data Documento *</label>
                                    <input 
                                        type="date" 
                                        name="date" 
                                        value={formData.date || ''} 
                                        onChange={handleInputChange} 
                                        required 
                                        className="w-full h-11 px-3 bg-white border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-sm font-semibold text-slate-700 block mb-2">Descrizione Generale</label>
                                <input 
                                    type="text" 
                                    name="description" 
                                    value={formData.description || ''} 
                                    onChange={handleInputChange} 
                                    placeholder="Es. Campagna marketing Q1 2025" 
                                    className="w-full h-11 px-3 bg-white border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* Sezione Voci di Spesa */}
                        <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <List className="w-5 h-5 text-amber-600" />
                                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                                    Voci di Spesa
                                </h4>
                            </div>
                            
                            <div className="space-y-4">
                                {formData.lineItems.map((item, index) => (
                                    <div key={item._key} className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border-2 border-slate-200 hover:border-amber-300 transition-all">
                                        <div className="flex items-start justify-between mb-3">
                                            <span className="text-sm font-bold text-slate-600">Voce #{index + 1}</span>
                                            {formData.lineItems.length > 1 && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeLineItem(index)} 
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Descrizione *</label>
                                                <input 
                                                    type="text" 
                                                    value={item.description || ''} 
                                                    onChange={e => handleLineItemChange(index, 'description', e.target.value)} 
                                                    placeholder="Es. Google Ads - Auto" 
                                                    className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                                    required 
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Importo (€) *</label>
                                                <input 
                                                    type="text" 
                                                    value={item.amount || ''} 
                                                    onChange={e => handleLineItemChange(index, 'amount', e.target.value)} 
                                                    placeholder="0,00" 
                                                    className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                                    required 
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Settore *</label>
                                                <select 
                                                    value={item.sectorId || ''} 
                                                    onChange={e => handleLineItemChange(index, 'sectorId', e.target.value)} 
                                                    className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                                    required
                                                >
                                                    <option value="">Seleziona...</option>
                                                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Filiali *</label>
                                                <MultiSelect 
                                                    options={branches}
                                                    selected={item.branchIds}
                                                    onChange={(branchId) => handleBranchMultiSelectChange(index, branchId)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-600 block mb-1.5">Canale Marketing *</label>
                                                <select 
                                                    value={item.marketingChannelId || ''} 
                                                    onChange={e => handleLineItemChange(index, 'marketingChannelId', e.target.value)} 
                                                    className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                                    required
                                                >
                                                    <option value="">Seleziona...</option>
                                                    {filteredMarketingChannels.map(mc => (
                                                        <option key={mc.id} value={mc.id}>{mc.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        
                                        {/* ⭐ NUOVO: Dropdown contratto e lineItems per modalità "Per Singola Voce" */}
                                        {formData.contractLinkType === 'line' && formData.requiresContract && (
                                            <div className="col-span-2 pt-3 mt-3 border-t-2 border-slate-200">
                                                <div className="space-y-3">
                                                    {/* Dropdown Contratto */}
                                                    <div>
                                                        <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                                                            Collega Contratto (questa voce) *
                                                        </label>
                                                        <select 
                                                            value={item.relatedContractId || ''} 
                                                            onChange={e => {
                                                                handleLineItemChange(index, 'relatedContractId', e.target.value);
                                                                // Reset lineItem quando cambia contratto
                                                                handleLineItemChange(index, 'relatedLineItemId', '');
                                                            }} 
                                                            className="w-full h-10 px-3 border-2 border-slate-200 rounded-lg bg-white hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                                            disabled={!formData.supplierId}
                                                        >
                                                            <option value="">Seleziona contratto...</option>
                                                            {availableContracts.map(c => (
                                                                <option key={c.id} value={c.id}>{c.description}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    
                                                    {/* ⭐ Dropdown LineItems (appare solo se c'è un contratto selezionato) */}
                                                    {item.relatedContractId && getLineItemsForContract(item.relatedContractId).length > 0 && (
                                                        <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                                                            <label className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-2">
                                                                <Info className="w-4 h-4 text-blue-600" />
                                                                Seleziona LineItem specifico (opzionale)
                                                            </label>
                                                            <select 
                                                                value={item.relatedLineItemId || ''} 
                                                                onChange={e => handleLineItemChange(index, 'relatedLineItemId', e.target.value)} 
                                                                className="w-full h-10 px-3 border-2 border-blue-200 rounded-lg bg-white hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                            >
                                                                <option value="">Nessun lineItem (usa distribuzione automatica)</option>
                                                                {getLineItemsForContract(item.relatedContractId).map(li => (
                                                                    <option key={li.id} value={li.id}>
                                                                        {li.description} • {formatCurrency(li.totalAmount)} • {new Date(li.startDate).toLocaleDateString('it-IT')} → {new Date(li.endDate).toLocaleDateString('it-IT')}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <p className="text-xs text-slate-600 mt-2 flex items-start gap-1">
                                                                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                                <span>Seleziona un lineItem per tracking preciso. Se non selezioni, verrà usata la distribuzione temporale.</span>
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            <button 
                                type="button" 
                                onClick={addLineItem} 
                                className="mt-4 text-amber-600 font-bold flex items-center gap-2 hover:text-amber-700 transition-colors"
                            >
                                <PlusCircle size={18} /> 
                                Aggiungi Voce di Spesa
                            </button>
                        </div>
                        
                        {/* Sezione Contratti e Allegati */}
                        <div className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <FileSignature className="w-5 h-5 text-amber-600" />
                                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                                    Documenti e Contratti
                                </h4>
                            </div>
                            
                            <div className="space-y-4">
                                {/* Toggle Richiede Contratto */}
                                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-100 rounded-lg">
                                                <FileSignature className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">Questa spesa richiede un contratto?</p>
                                                <p className="text-xs text-slate-600 mt-0.5">
                                                    Disattiva per spese che non necessitano contratto (es. spese una tantum)
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, requiresContract: !prev.requiresContract }))}
                                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                                                formData.requiresContract ? 'bg-indigo-600' : 'bg-slate-300'
                                            }`}
                                        >
                                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                                formData.requiresContract ? 'translate-x-8' : 'translate-x-1'
                                            }`} />
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Selezione contratto */}
                                {formData.requiresContract && (
                                    <>
                                        {/* Toggle tipo collegamento */}
                                        <div className="p-3 bg-slate-100 rounded-xl">
                                            <p className="text-xs font-bold text-slate-600 mb-2">Tipo di collegamento:</p>
                                            <div className="flex gap-2">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleInputChange({target: {name: 'contractLinkType', value: 'single'}})} 
                                                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                                                        formData.contractLinkType === 'single' 
                                                            ? 'bg-white shadow-lg text-slate-900' 
                                                            : 'text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    <Link size={16}/> 
                                                    Contratto Unico
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleInputChange({target: {name: 'contractLinkType', value: 'line'}})} 
                                                    className={`flex-1 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                                                        formData.contractLinkType === 'line' 
                                                            ? 'bg-white shadow-lg text-slate-900' 
                                                            : 'text-slate-600 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    <List size={16}/> 
                                                    Per Singola Voce
                                                </button>
                                            </div>
                                        </div>
                                        
                                        {/* Dropdown contratto */}
                                        {formData.contractLinkType === 'single' && (
                                            <div>
                                                <label className="text-sm font-semibold text-slate-700 block mb-2">
                                                    Collega Contratto (intera spesa)
                                                </label>
                                                <select 
                                                    name="relatedContractId" 
                                                    value={formData.relatedContractId || ''} 
                                                    onChange={handleInputChange} 
                                                    className="w-full h-11 px-3 bg-white border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all" 
                                                    disabled={!formData.supplierId}
                                                >
                                                    <option value="">Nessun contratto</option>
                                                    {availableContracts.map(c => (
                                                        <option key={c.id} value={c.id}>{c.description}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        
                                        {/* ⭐ NUOVO: Box selezione LineItems quando c'è un contratto selezionato */}
                                        {formData.contractLinkType === 'single' && formData.relatedContractId && contractLineItems.length > 0 && (
                                            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                                                <div className="flex items-start gap-3 mb-3">
                                                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-bold text-slate-900 mb-1">
                                                            📋 LineItems del contratto "{selectedContract?.description}"
                                                        </p>
                                                        <p className="text-xs text-slate-600 mb-3">
                                                            Seleziona quale lineItem del contratto stai pagando con questa spesa per un tracking preciso del budget
                                                        </p>
                                                        
                                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                                            {contractLineItems.map((lineItem) => {
                                                                const isSelected = formData.lineItems[0]?.relatedLineItemId === lineItem.id;
                                                                const remaining = calculateLineItemRemaining(lineItem);
                                                                const percentage = ((lineItem.totalAmount - remaining) / lineItem.totalAmount) * 100;
                                                                
                                                                return (
                                                                    <button
                                                                        key={lineItem.id}
                                                                        type="button"
                                                                        onClick={() => handleLineItemChange(0, 'relatedLineItemId', lineItem.id)}
                                                                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                                                                            isSelected 
                                                                                ? 'border-blue-500 bg-blue-100' 
                                                                                : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div className="flex-1">
                                                                                <p className="text-sm font-semibold text-slate-900">
                                                                                    {lineItem.description}
                                                                                </p>
                                                                                <p className="text-xs text-slate-600 mt-1">
                                                                                    {new Date(lineItem.startDate).toLocaleDateString('it-IT')} → {new Date(lineItem.endDate).toLocaleDateString('it-IT')}
                                                                                </p>
                                                                            </div>
                                                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-2 ${
                                                                                isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'
                                                                            }`}>
                                                                                {isSelected && <Check className="w-3 h-3 text-white" />}
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center justify-between text-xs mb-1">
                                                                            <span className="text-slate-600">Budget:</span>
                                                                            <span className="font-bold text-slate-900">
                                                                                {formatCurrency(lineItem.totalAmount)}
                                                                            </span>
                                                                        </div>
                                                                        
                                                                        <div className="flex items-center justify-between text-xs">
                                                                            <span className="text-slate-600">Residuo stimato:</span>
                                                                            <span className="font-bold text-emerald-600">
                                                                                {formatCurrency(remaining)}
                                                                            </span>
                                                                        </div>
                                                                        
                                                                        {/* Barra progresso */}
                                                                        <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                                            <div 
                                                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all"
                                                                                style={{ width: `${Math.min(percentage, 100)}%` }}
                                                                            />
                                                                        </div>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        
                                                        <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                                                            <p className="text-xs text-amber-800 flex items-start gap-2">
                                                                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                                <span>Seleziona il lineItem per un tracking preciso. Se non selezioni nulla, verrà usata la distribuzione temporale automatica.</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                                
                                {/* Upload PDF */}
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 block mb-2">
                                        <Paperclip className="w-4 h-4 inline mr-1" />
                                        Allega Fattura PDF
                                    </label>
                                    <input 
                                        type="file" 
                                        accept="application/pdf" 
                                        onChange={handleFileChange} 
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 transition-all"
                                    />
                                    <div className="mt-2 text-sm">
                                        <span className="text-slate-600">File selezionato: </span>
                                        <span className="font-medium">
                                            {invoiceFile ? (
                                                <span className="font-medium text-emerald-600">
                                                    ✓ {invoiceFile.name}
                                                </span>
                                            ) : formData.invoicePdfUrl ? (
                                                <span className="text-slate-500">File PDF già caricato</span>
                                            ) : (
                                                <span className="text-slate-400">Nessun file selezionato</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-slate-50 flex justify-between items-center border-t border-slate-200 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="text-sm text-slate-600 font-medium">Totale Spesa:</div>
                            <div className="text-2xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                                {formatCurrency(expenseTotal)}
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="px-6 py-3 rounded-xl bg-white text-slate-800 font-semibold border-2 border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all hover:scale-105"
                            >
                                Annulla
                            </button>
                            <button 
                                type="submit" 
                                className="px-7 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold hover:shadow-lg transition-all hover:scale-105 flex items-center gap-2"
                            >
                                {formData.id ? 'Salva Modifiche' : 'Crea Spesa'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}