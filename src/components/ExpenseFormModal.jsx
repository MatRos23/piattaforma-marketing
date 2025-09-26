import React, { useState, useEffect, useMemo } from 'react';
import { FileText, X, PlusCircle, Trash2, Link, List, Paperclip, ChevronDown, Check } from 'lucide-react';
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
                className="w-full h-10 px-3 text-left bg-white border-2 border-gray-200 rounded-lg flex justify-between items-center"
            >
                <span className="block truncate text-gray-800 text-sm">
                    {selectedCount > 0 ? `${selectedCount} selezionat${selectedCount > 1 ? 'e' : 'a'}` : <span className="text-gray-400">Seleziona...</span>}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div 
                    className="absolute z-20 mt-1 w-full bg-white/95 backdrop-blur-xl shadow-2xl rounded-xl border border-white/30 max-h-60 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-2 sticky top-0 bg-white/80 backdrop-blur-xl">
                        <input type="text" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg"/>
                    </div>
                    <ul className="p-2">
                        {filteredOptions.map(option => {
                            const isChecked = (selected || []).includes(option.id);
                            return (
                                <li key={option.id} onClick={() => onChange(option.id)} className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer flex items-center justify-between">
                                    <span className="ml-3 text-sm font-medium text-gray-800">{option.name}</span>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'bg-slate-800 border-slate-800' : 'bg-white border-gray-300'}`}>
                                        {isChecked && <Check className="w-4 h-4 text-white" />}
                                    </div>
                                </li>
                            );
                        })}
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
        } else {
            toast.error("Per favore, seleziona un file PDF.");
            e.target.value = null;
        }
    };
    
    const availableContracts = useMemo(() => {
        if (!formData.supplierId || !contracts) return [];
        // **LA CORREZIONE**: Usa 'supplierld' per i dati dei contratti, e 'supplierId' per i dati del form
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
            <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-white/30">
                <div className="p-5 border-b border-gray-200/80 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                            <FileText className="w-5 h-5" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800">{formData.id ? 'Modifica Spesa' : 'Nuova Spesa'}</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"><X /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 space-y-6 overflow-y-auto flex-1">
                        
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Dati Principali</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 block mb-1">Fornitore *</label>
                                    <select name="supplierId" value={formData.supplierId || ''} onChange={handleInputChange} required className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all">
                                        <option value="">Seleziona Fornitore</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 block mb-1">Data Documento *</label>
                                    <input type="date" name="date" value={formData.date || ''} onChange={handleInputChange} required className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-1">Descrizione Generale</label>
                                <input type="text" name="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Es. Fattura N. 123, Acquisto materiale..." className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all" />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200/80"></div>

                        <div>
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Dettaglio Voci di Spesa</h4>
                            <div className="space-y-4">
                                {formData.lineItems.map((item, index) => (
                                    <div key={item._key} className="p-4 bg-white/70 rounded-xl border-2 border-white space-y-3 relative">
                                        {formData.lineItems.length > 1 && (
                                            <button type="button" onClick={() => removeLineItem(index)} className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-all"><Trash2 size={16} /></button>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <div>
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Descrizione Voce *</label>
                                                <input type="text" placeholder="Dettaglio servizio/prodotto" value={item.description || ''} onChange={e => handleLineItemChange(index, 'description', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg bg-white" required />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Importo (€) *</label>
                                                <input type="number" step="0.01" placeholder="0.00" value={item.amount || ''} onChange={e => handleLineItemChange(index, 'amount', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg bg-white" required />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Settore *</label>
                                                <select value={item.sectorId || ''} onChange={e => handleLineItemChange(index, 'sectorId', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg bg-white" required>
                                                    <option value="">Seleziona</option>
                                                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Filiale/i *</label>
                                                <MultiSelect
                                                    options={branches.filter(b => b.associatedSectors?.includes(item.sectorId))}
                                                    selected={item.branchIds}
                                                    onChange={(branchId) => handleBranchMultiSelectChange(index, branchId)}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Canale Marketing *</label>
                                                <select value={item.marketingChannelId || ''} onChange={e => handleLineItemChange(index, 'marketingChannelId', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg bg-white" required>
                                                    <option value="">Seleziona</option>
                                                    {filteredMarketingChannels.map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        {formData.contractLinkType === 'line' && (
                                            <div className="pt-3 border-t border-gray-200/80">
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Collega Contratto (questa voce)</label>
                                                <select value={item.relatedContractId || ''} onChange={e => handleLineItemChange(index, 'relatedContractId', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg bg-gray-50" disabled={!formData.supplierId}>
                                                    <option value="">Nessun contratto</option>
                                                    {availableContracts.map(c => <option key={c.id} value={c.id}>{c.description}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addLineItem} className="mt-4 text-amber-600 font-semibold flex items-center gap-2 hover:text-amber-700 transition-colors">
                                <PlusCircle size={16} /> Aggiungi Voce di Spesa
                            </button>
                        </div>
                        
                        <div className="pt-4 border-t border-gray-200/80"></div>
                        
                        <div>
                             <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Contratti e Allegati</h4>
                             <div className="p-4 bg-white/70 rounded-xl border-2 border-white space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 block mb-2">Tipo di collegamento contratto</label>
                                    <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl">
                                        <button type="button" onClick={() => handleInputChange({target: {name: 'contractLinkType', value: 'single'}})} className={`flex-1 py-2 text-sm rounded-lg flex items-center justify-center gap-2 transition-colors ${formData.contractLinkType === 'single' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}>
                                            <Link size={16}/> Singolo
                                        </button>
                                        <button type="button" onClick={() => handleInputChange({target: {name: 'contractLinkType', value: 'line'}})} className={`flex-1 py-2 text-sm rounded-lg flex items-center justify-center gap-2 transition-colors ${formData.contractLinkType === 'line' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}>
                                            <List size={16}/> Per Voce
                                        </button>
                                    </div>
                                </div>
                                {formData.contractLinkType === 'single' && (
                                    <div>
                                        <label className="text-sm font-semibold text-gray-700 block mb-1">Collega Contratto (intera spesa)</label>
                                        <select name="relatedContractId" value={formData.relatedContractId || ''} onChange={handleInputChange} className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all" disabled={!formData.supplierId}>
                                            <option value="">Nessun contratto collegato</option>
                                            {availableContracts.map(c => <option key={c.id} value={c.id}>{c.description}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="pt-4 border-t border-gray-200/50">
                                    <label htmlFor="invoiceUpload" className="text-sm font-semibold text-gray-700 block mb-2">PDF Fattura/Documento</label>
                                    <div className="flex items-center gap-4">
                                        <label htmlFor="invoiceUpload" className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 font-semibold text-sm rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all">
                                            <Paperclip className="w-4 h-4" />
                                            <span>Scegli file...</span>
                                        </label>
                                        <input id="invoiceUpload" type="file" accept="application/pdf" onChange={handleFileChange} className="hidden"/>
                                        <span className="text-sm text-gray-600">{invoiceFile ? invoiceFile.name : (formData.invoicePdfUrl ? "File PDF già caricato" : "Nessun file selezionato")}</span>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>

                    <div className="p-5 bg-gray-50/70 flex justify-between items-center rounded-b-2xl border-t border-gray-200/80 flex-shrink-0">
                        <div className="text-lg font-bold">
                            <span className="text-gray-600">Totale Spesa:</span>
                            <span className="text-amber-600 ml-2">{expenseTotal.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white text-gray-800 font-semibold border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all">Annulla</button>
                            <button type="submit" className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold hover:shadow-lg transition-all">
                                {formData.id ? 'Salva Modifiche' : 'Crea Spesa'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}