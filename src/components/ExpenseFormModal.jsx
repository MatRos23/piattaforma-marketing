import React, { useState, useEffect, useMemo } from 'react';
import { FileText, X, PlusCircle, Trash2, Link, List } from 'lucide-react';
import toast from 'react-hot-toast';

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
        amount: '0.00',
        sectorld: '',
        branchld: '',
        marketingChannelld: '',
        relatedContractId: '',
    }), []);

    const defaultFormData = useMemo(() => ({
        supplierld: '',
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
                // Logica di retrocompatibilità
                const enrichedLineItems = (initialData.lineItems && initialData.lineItems.length > 0)
                    ? initialData.lineItems.map(item => ({
                        ...item,
                        _key: Math.random(),
                        // Se manca un campo nella voce, lo eredita dalla spesa "madre" (dati vecchi)
                        sectorld: item.sectorld || initialData.sectorld,
                        branchld: item.assignmentId || item.branchld || initialData.branchld,
                        marketingChannelld: item.marketingChannelld || item.marketingChannelId,
                    }))
                    : [{ ...defaultLineItem, _key: Math.random() }];

                const linkType = enrichedLineItems.some(li => li.relatedContractId) ? 'line' : 'single';

                setFormData({ 
                    ...initialData, 
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
        if (!formData.supplierld || !contracts) return [];
        return contracts.filter(c => c.supplierld === formData.supplierld);
    }, [formData.supplierld, contracts]);

    // NUOVA LOGICA: Filtra i canali marketing in base al fornitore
    const filteredMarketingChannels = useMemo(() => {
        if (!formData.supplierld || !suppliers || !marketingChannels) {
            return marketingChannels; // Ritorna tutti se non c'è un fornitore
        }
        const selectedSupplier = suppliers.find(s => s.id === formData.supplierld);
        const offeredIds = selectedSupplier?.offeredMarketingChannels || [];
        
        if (offeredIds.length === 0) return marketingChannels; // Ritorna tutti se non specificato

        return marketingChannels.filter(mc => offeredIds.includes(mc.id));
    }, [formData.supplierld, suppliers, marketingChannels]);


    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!formData.supplierld || !formData.date) {
            toast.error("Fornitore e Data sono campi obbligatori.");
            return;
        }
        
        let finalData = { ...formData };
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h3 className="text-xl font-bold text-gray-800">{formData.id ? 'Modifica Spesa' : 'Nuova Spesa'}</h3>
                    <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Fornitore</label>
                                <select name="supplierld" value={formData.supplierld || ''} onChange={handleInputChange} required className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                                    <option value="">Seleziona Fornitore</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Data Documento</label>
                                <input type="date" name="date" value={formData.date || ''} onChange={handleInputChange} required className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-600 block mb-1">Descrizione Generale</label>
                            <input type="text" name="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Descrizione generale della spesa o fattura" className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                        </div>

                        <div className="pt-4 border-t">
                            <label className="text-sm font-bold text-gray-600 block mb-1">Tipo di collegamento contratto</label>
                            <div className="flex items-center gap-6 p-2 bg-gray-100 rounded-lg">
                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                    <input type="radio" name="contractLinkType" value="single" checked={formData.contractLinkType === 'single'} onChange={handleInputChange} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
                                    <Link size={16} className="text-gray-600" />
                                    Singolo (per tutta la spesa)
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-sm">
                                    <input type="radio" name="contractLinkType" value="line" checked={formData.contractLinkType === 'line'} onChange={handleInputChange} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
                                    <List size={16} className="text-gray-600" />
                                    Per Voce di Spesa
                                </label>
                            </div>
                        </div>

                        {formData.contractLinkType === 'single' && (
                             <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <label className="text-sm font-bold text-gray-600 block mb-1">Collega Contratto (intera spesa)</label>
                                <select name="relatedContractId" value={formData.relatedContractId || ''} onChange={handleInputChange} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" disabled={!formData.supplierld}>
                                    <option value="">Nessun contratto collegato</option>
                                    {availableContracts.map(c => <option key={c.id} value={c.id}>{c.description}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="pt-4 border-t">
                            <h4 className="text-lg font-bold text-gray-700 mb-2">Voci di Spesa</h4>
                            <div className="space-y-3">
                                {formData.lineItems.map((item, index) => (
                                    <div key={item._key} className="p-4 bg-gray-50 rounded-lg border space-y-3 relative">
                                        {formData.lineItems.length > 1 && (
                                            <button type="button" onClick={() => removeLineItem(index)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                             <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Descrizione Voce</label>
                                                <input type="text" placeholder="Dettaglio della voce di spesa" value={item.description || ''} onChange={e => handleLineItemChange(index, 'description', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg" required />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Importo (€)</label>
                                                <input type="number" step="0.01" placeholder="0.00" value={item.amount || ''} onChange={e => handleLineItemChange(index, 'amount', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg" required />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Settore</label>
                                                <select value={item.sectorld || ''} onChange={e => handleLineItemChange(index, 'sectorld', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg" required>
                                                    <option value="">Seleziona</option>
                                                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Filiale</label>
                                                <select value={item.branchld || ''} onChange={e => handleLineItemChange(index, 'branchld', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg" required>
                                                    <option value="">Seleziona</option>
                                                    {branches.filter(b => b.associatedSectors?.includes(item.sectorld)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Canale Marketing</label>
                                                <select value={item.marketingChannelld || ''} onChange={e => handleLineItemChange(index, 'marketingChannelld', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg" required>
                                                    <option value="">Seleziona</option>
                                                    {filteredMarketingChannels.map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        {formData.contractLinkType === 'line' && (
                                            <div className="pt-3 border-t">
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Collega Contratto (questa voce)</label>
                                                <select value={item.relatedContractId || ''} onChange={e => handleLineItemChange(index, 'relatedContractId', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg bg-indigo-50" disabled={!formData.supplierld}>
                                                    <option value="">Nessun contratto</option>
                                                    {availableContracts.map(c => <option key={c.id} value={c.id}>{c.description}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                             <button type="button" onClick={addLineItem} className="mt-4 text-indigo-600 font-semibold flex items-center gap-2">
                                <PlusCircle size={16} /> Aggiungi Voce
                            </button>
                        </div>
                        <div className="pt-4 border-t">
                             <label className="text-lg font-bold text-gray-700 mb-2">Allegati</label>
                             <div className="mt-2">
                                <label className="text-sm font-bold text-gray-600 block mb-1">PDF Fattura/Documento</label>
                                <input type="file" accept="application/pdf" onChange={handleFileChange} className="mt-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                             </div>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 flex justify-end items-center rounded-b-xl border-t flex-shrink-0">
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300">Annulla</button>
                            <button type="submit" className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Salva Spesa</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}