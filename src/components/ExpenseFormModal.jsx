import React, { useState, useEffect, useMemo } from 'react';
import { 
    FileText, X, PlusCircle, Trash2, Link, List, Paperclip, ChevronDown, 
    Check, Calendar, DollarSign, Building2, Layers, ShoppingCart, 
    GitBranch, FileSignature, ToggleLeft, ToggleRight, Info, AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

// Componente MultiSelect migliorato
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
                className="w-full h-11 px-3 text-left bg-white border-2 border-gray-200 rounded-xl hover:border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all flex justify-between items-center"
            >
                <span className="block truncate text-gray-800 text-sm">
                    {selectedCount > 0 ? (
                        <span className="font-medium">{selectedCount} selezionat{selectedCount > 1 ? 'e' : 'a'}</span>
                    ) : (
                        <span className="text-gray-400">Seleziona filiali...</span>
                    )}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white/95 backdrop-blur-xl shadow-2xl rounded-xl border border-white/30 max-h-60 overflow-hidden">
                    <div className="p-2 sticky top-0 bg-white/95 backdrop-blur-xl border-b border-gray-200">
                        <input 
                            type="text" 
                            placeholder="Cerca filiale..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                        />
                    </div>
                    <ul className="overflow-y-auto max-h-48">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => {
                                const isChecked = (selected || []).includes(option.id);
                                return (
                                    <li 
                                        key={option.id} 
                                        onClick={() => onChange(option.id)} 
                                        className="px-3 py-2.5 hover:bg-amber-50 cursor-pointer flex items-center justify-between transition-colors"
                                    >
                                        <span className="text-sm font-medium text-gray-800">{option.name}</span>
                                        <div className={`
                                            w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                                            ${isChecked ? 'bg-amber-600 border-amber-600' : 'bg-white border-gray-300'}
                                        `}>
                                            {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                    </li>
                                );
                            })
                        ) : (
                            <li className="px-3 py-4 text-center text-sm text-gray-500">
                                Nessuna filiale trovata
                            </li>
                        )}
                    </ul>
                </div>
            )}
            {isOpen && <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>}
        </div>
    );
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
    }), []);

    const defaultFormData = useMemo(() => ({
        supplierId: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        relatedContractId: '',
        requiresContract: true, // NUOVO campo
        isAmortized: false,
        amortizationStartDate: '',
        amortizationEndDate: '',
        lineItems: [defaultLineItem],
        contractLinkType: 'single',
    }), [defaultLineItem]);

    const [formData, setFormData] = useState(defaultFormData);
    const [invoiceFile, setInvoiceFile] = useState(null);

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
                    }))
                    : [{ ...defaultLineItem, _key: Math.random() }];

                const linkType = enrichedLineItems.some(li => li.relatedContractId) ? 'line' : 'single';
                
                setFormData({ 
                    ...initialData,
                    supplierId: initialData.supplierId || initialData.supplierld,
                    requiresContract: initialData.requiresContract !== undefined ? initialData.requiresContract : true,
                    contractLinkType: linkType,
                    lineItems: enrichedLineItems,
                });
            } else {
                setFormData(defaultFormData);
            }
        } else {
            setFormData(defaultFormData);
            setInvoiceFile(null);
        }
    }, [isOpen, initialData, defaultFormData, defaultLineItem]);
    
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
                        relatedContractId: formData.contractLinkType === 'line' ? (item.relatedContractId || null) : null,
                        splitGroupId: splitGroupId,
                    });
                });
            } else {
                finalLineItems.push({
                    description: item.description,
                    amount: amount,
                    sectorId: item.sectorId,
                    assignmentId: branches[0] || null,
                    marketingChannelId: item.marketingChannelId,
                    relatedContractId: formData.contractLinkType === 'line' ? (item.relatedContractId || null) : null,
                });
            }
        });

        if (hasError) return;

        let finalData = { ...formData, lineItems: finalLineItems };
        
        if (finalData.lineItems.length > 0) {
            finalData.sectorId = finalData.lineItems[0].sectorId;
            finalData.branchId = finalData.lineItems[0].assignmentId;
        }

        finalData.isMultiBranch = finalData.lineItems.some(item => item.splitGroupId);

        if (finalData.contractLinkType === 'single') {
            finalData.lineItems = finalData.lineItems.map(li => {
                const { relatedContractId, ...rest } = li;
                return rest;
            });
        } else {
            finalData.relatedContractId = '';
        }
        
        onSave(finalData, invoiceFile, null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity duration-300">
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] border border-white/30 overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-200/80 flex justify-between items-center flex-shrink-0 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 text-white shadow-lg">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-gray-900">
                                {formData.id ? 'Modifica Spesa' : 'Nuova Spesa'}
                            </h3>
                            <p className="text-sm text-gray-600 font-medium">
                                Compila tutti i campi richiesti
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="p-2.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-white/80 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-gradient-to-br from-gray-50/30 to-white">
                        
                        {/* Sezione Dati Principali */}
                        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 space-y-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <ShoppingCart className="w-5 h-5 text-amber-600" />
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                                    Informazioni Principali
                                </h4>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 block mb-2">
                                        Fornitore *
                                    </label>
                                    <select 
                                        name="supplierId" 
                                        value={formData.supplierId || ''} 
                                        onChange={handleInputChange} 
                                        required 
                                        className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl hover:border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all font-medium"
                                    >
                                        <option value="">Seleziona Fornitore...</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 block mb-2">
                                        Data Documento *
                                    </label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input 
                                            type="date" 
                                            name="date" 
                                            value={formData.date || ''} 
                                            onChange={handleInputChange} 
                                            required 
                                            className="w-full h-11 pl-10 pr-3 bg-white border-2 border-gray-200 rounded-xl hover:border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all font-medium"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-2">
                                    Descrizione Generale
                                </label>
                                <input 
                                    type="text" 
                                    name="description" 
                                    value={formData.description || ''} 
                                    onChange={handleInputChange} 
                                    placeholder="Es. Fattura N. 123/2024, Campagna pubblicitaria..." 
                                    className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl hover:border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* Sezione Voci di Spesa */}
                        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <List className="w-5 h-5 text-amber-600" />
                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
                                        Dettaglio Voci di Spesa
                                    </h4>
                                </div>
                                <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">
                                    {formData.lineItems.length} voc{formData.lineItems.length === 1 ? 'e' : 'i'}
                                </span>
                            </div>
                            
                            <div className="space-y-4">
                                {formData.lineItems.map((item, index) => (
                                    <div key={item._key} className="relative p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border-2 border-gray-200 hover:border-amber-300 transition-all">
                                        {formData.lineItems.length > 1 && (
                                            <button 
                                                type="button" 
                                                onClick={() => removeLineItem(index)} 
                                                className="absolute -top-2 -right-2 p-1.5 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white rounded-full transition-all shadow-md"
                                                title="Rimuovi voce"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                        
                                        <div className="text-xs font-bold text-gray-500 mb-3">
                                            Voce #{index + 1}
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                                                    Descrizione Voce *
                                                </label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Dettaglio servizio/prodotto" 
                                                    value={item.description || ''} 
                                                    onChange={e => handleLineItemChange(index, 'description', e.target.value)} 
                                                    className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                                    required 
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                                                    Importo (€) *
                                                </label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        placeholder="0.00" 
                                                        value={item.amount || ''} 
                                                        onChange={e => handleLineItemChange(index, 'amount', e.target.value)} 
                                                        className="w-full h-10 pl-10 pr-3 border-2 border-gray-200 rounded-lg hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                                        required 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                                                    Settore *
                                                </label>
                                                <select 
                                                    value={item.sectorId || ''} 
                                                    onChange={e => handleLineItemChange(index, 'sectorId', e.target.value)} 
                                                    className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                                    required
                                                >
                                                    <option value="">Seleziona...</option>
                                                    {sectors.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                                                    Filiale/i *
                                                </label>
                                                <MultiSelect
                                                    options={branches.filter(b => b.associatedSectors?.includes(item.sectorId))}
                                                    selected={item.branchIds}
                                                    onChange={(branchId) => handleBranchMultiSelectChange(index, branchId)}
                                                />
                                            </div>
                                            
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                                                    Canale Marketing *
                                                </label>
                                                <select 
                                                    value={item.marketingChannelId || ''} 
                                                    onChange={e => handleLineItemChange(index, 'marketingChannelId', e.target.value)} 
                                                    className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg hover:border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                                    required
                                                >
                                                    <option value="">Seleziona...</option>
                                                    {filteredMarketingChannels.map(mc => (
                                                        <option key={mc.id} value={mc.id}>{mc.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        
                                        {formData.contractLinkType === 'line' && formData.requiresContract && (
                                            <div className="mt-3 pt-3 border-t border-gray-200/80">
                                                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                                                    Collega Contratto (questa voce)
                                                </label>
                                                <select 
                                                    value={item.relatedContractId || ''} 
                                                    onChange={e => handleLineItemChange(index, 'relatedContractId', e.target.value)} 
                                                    className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg bg-gray-50 hover:border-amber-300 focus:border-amber-500 transition-all" 
                                                    disabled={!formData.supplierId}
                                                >
                                                    <option value="">Nessun contratto</option>
                                                    {availableContracts.map(c => (
                                                        <option key={c.id} value={c.id}>{c.description}</option>
                                                    ))}
                                                </select>
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
                        <div className="bg-white rounded-2xl border-2 border-gray-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <FileSignature className="w-5 h-5 text-amber-600" />
                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
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
                                                <p className="font-bold text-gray-900">Questa spesa richiede un contratto?</p>
                                                <p className="text-xs text-gray-600 mt-0.5">
                                                    Disattiva per spese che non necessitano contratto (es. spese una tantum)
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, requiresContract: !prev.requiresContract }))}
                                            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                                                formData.requiresContract ? 'bg-indigo-600' : 'bg-gray-300'
                                            }`}
                                        >
                                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                                formData.requiresContract ? 'translate-x-8' : 'translate-x-1'
                                            }`} />
                                        </button>
                                    </div>
                                    
                                    {!formData.requiresContract && (
                                        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                                                <p className="text-xs text-amber-800">
                                                    <span className="font-semibold">Nota:</span> La spesa non sarà segnalata come incompleta 
                                                    se manca il contratto, ma la fattura rimane obbligatoria.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Tipo collegamento contratto */}
                                {formData.requiresContract && (
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 block mb-2">
                                            Modalità collegamento contratto
                                        </label>
                                        <div className="flex items-center gap-2 p-1.5 bg-gray-100 rounded-xl">
                                            <button 
                                                type="button" 
                                                onClick={() => handleInputChange({target: {name: 'contractLinkType', value: 'single'}})} 
                                                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                                                    formData.contractLinkType === 'single' 
                                                        ? 'bg-white shadow-md text-gray-900' 
                                                        : 'text-gray-600 hover:bg-gray-200'
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
                                                        ? 'bg-white shadow-md text-gray-900' 
                                                        : 'text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                <List size={16}/> 
                                                Per Singola Voce
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {/* Selezione contratto */}
                                {formData.requiresContract && formData.contractLinkType === 'single' && (
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 block mb-2">
                                            Collega Contratto (intera spesa)
                                        </label>
                                        <select 
                                            name="relatedContractId" 
                                            value={formData.relatedContractId || ''} 
                                            onChange={handleInputChange} 
                                            className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl hover:border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all" 
                                            disabled={!formData.supplierId}
                                        >
                                            <option value="">Nessun contratto collegato</option>
                                            {availableContracts.map(c => (
                                                <option key={c.id} value={c.id}>{c.description}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                
                                {/* Upload Fattura */}
                                <div className="pt-4 border-t border-gray-200">
                                    <label htmlFor="invoiceUpload" className="text-sm font-semibold text-gray-700 block mb-2">
                                        PDF Fattura/Documento *
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <label 
                                            htmlFor="invoiceUpload" 
                                            className="cursor-pointer flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold text-sm rounded-xl hover:shadow-lg transition-all hover:scale-105"
                                        >
                                            <Paperclip className="w-4 h-4" />
                                            <span>Carica PDF</span>
                                        </label>
                                        <input 
                                            id="invoiceUpload" 
                                            type="file" 
                                            accept="application/pdf" 
                                            onChange={handleFileChange} 
                                            className="hidden"
                                        />
                                        <span className="text-sm text-gray-600 flex-1">
                                            {invoiceFile ? (
                                                <span className="font-medium text-emerald-600">
                                                    ✓ {invoiceFile.name}
                                                </span>
                                            ) : formData.invoicePdfUrl ? (
                                                <span className="text-gray-500">File PDF già caricato</span>
                                            ) : (
                                                <span className="text-gray-400">Nessun file selezionato</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 flex justify-between items-center border-t border-gray-200 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="text-sm text-gray-600 font-medium">Totale Spesa:</div>
                            <div className="text-2xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                                {expenseTotal.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                            </div>
                        </div>
                        
                        <div className="flex gap-3">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="px-6 py-3 rounded-xl bg-white text-gray-800 font-semibold border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all hover:scale-105"
                            >
                                Annulla
                            </button>
                            <button 
                                type="submit" 
                                className="px-7 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold hover:shadow-lg transition-all hover:scale-105 flex items-center gap-2"
                            >
                                {formData.id ? (
                                    <>
                                        <Check className="w-5 h-5" />
                                        Salva Modifiche
                                    </>
                                ) : (
                                    <>
                                        <PlusCircle className="w-5 h-5" />
                                        Crea Spesa
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}