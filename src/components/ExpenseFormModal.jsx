import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, Trash2, Paperclip, X } from 'lucide-react';
import toast from 'react-hot-toast';

const formatCurrency = (number) => {
  if (typeof number !== 'number') return 'N/A';
  return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

export default function ExpenseFormModal({ isOpen, onClose, onSave, initialData, sectors, branches, suppliers, marketingChannels, geographicAreas }) {
    
    const [formData, setFormData] = useState({});
    const [invoiceFile, setInvoiceFile] = useState(null);

    const totalAmount = useMemo(() => {
        return formData.lineItems?.reduce((sum, item) => {
            const value = parseFloat(String(item.amount || '0').replace(',', '.'));
            return sum + (isNaN(value) ? 0 : value);
        }, 0) || 0;
    }, [formData.lineItems]);

    const defaultLineItem = { description: '', amount: '0.00', assignmentType: 'branch', assignmentId: null, marketingChannelId: '' };

    useEffect(() => {
        if (isOpen) {
            const isEditing = !!(initialData && initialData.id);
            const isDuplicating = initialData && !initialData.id;
            
            let supplierToSet = isEditing || isDuplicating ? (initialData.supplierId || initialData.channelId) : '';
            
            const isMultiBranchFlag = isEditing || isDuplicating ? (initialData.isMultiBranch || false) : false;
            let migratedLineItems = [defaultLineItem];

            if ((isEditing || isDuplicating) && initialData.lineItems?.length > 0) {
                migratedLineItems = initialData.lineItems.map(item => {
                    let assignment = { assignmentType: item.assignmentType, assignmentId: item.assignmentId };
                    if (!item.assignmentType) {
                        assignment.assignmentType = 'branch';
                        assignment.assignmentId = isMultiBranchFlag ? item.branchId : initialData.branchId;
                    }
                    let channel = { marketingChannelId: item.marketingChannelId || initialData.marketingChannelId || '' };
                    return { ...item, amount: String(item.amount || '0'), ...assignment, ...channel };
                });
            }

            setFormData({
                id: initialData?.id || null,
                sectorId: initialData?.sectorId || '',
                supplierId: supplierToSet,
                date: isDuplicating ? new Date().toISOString().split('T')[0] : (initialData?.date || new Date().toISOString().split('T')[0]),
                description: isDuplicating ? `${initialData.description || ''} (Copia)` : (initialData?.description || ''),
                isMultiBranch: isMultiBranchFlag,
                branchId: initialData?.branchId || '',
                lineItems: migratedLineItems,
                invoicePdfUrl: isEditing ? (initialData?.invoicePdfUrl || '') : '',
            });
            setInvoiceFile(null);
        }
    }, [initialData, isOpen]);
    
    const filteredBranches = useMemo(() => {
        if (!formData.sectorId || !branches) return [];
        return branches.filter(branch => branch.associatedSectors?.includes(formData.sectorId));
    }, [formData.sectorId, branches]);

    const filteredMarketingChannels = useMemo(() => {
        if (!formData.supplierId || !suppliers.length || !marketingChannels.length) return []; 
        const selectedSupplier = suppliers.find(s => s.id === formData.supplierId);
        const offeredChannelIds = selectedSupplier?.offeredMarketingChannels || [];
        if (offeredChannelIds.length === 0) return [];
        return marketingChannels.filter(mc => offeredChannelIds.includes(mc.id));
    }, [formData.supplierId, suppliers, marketingChannels]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleLineItemChange = (index, field, value) => {
        const updatedLineItems = [...formData.lineItems];
        updatedLineItems[index][field] = value;
        setFormData(prev => ({ ...prev, lineItems: updatedLineItems }));
    };

    const handleAmountBlur = (index, value) => {
        if (!value) return;
        const numberValue = parseFloat(String(value).replace(',', '.'));
        if (isNaN(numberValue)) return;
        handleLineItemChange(index, 'amount', numberValue.toFixed(2));
    };

    const addLineItem = () => setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), { ...defaultLineItem }] }));
    const removeLineItem = (index) => {
        if (formData.lineItems.length <= 1) return toast.error("Deve esserci almeno una voce di spesa.");
        const updatedLineItems = formData.lineItems.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, lineItems: updatedLineItems }));
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
      
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData, invoiceFile); };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col h-full max-h-[95vh] overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                        <h3 className="text-xl font-bold text-gray-800">{formData.id ? 'Modifica Spesa' : 'Nuova Spesa'}</h3>
                        <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Settore</label>
                                <select name="sectorId" value={formData.sectorId || ''} onChange={handleInputChange} className="w-full p-2 border rounded-md bg-white">
                                    <option value="">Seleziona Settore</option>
                                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                             <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Fornitore</label>
                                <select name="supplierId" value={formData.supplierId || ''} onChange={handleInputChange} className="w-full p-2 border rounded-md bg-white">
                                    <option value="">Seleziona Fornitore</option>
                                    {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Data</label>
                                <input type="date" name="date" value={formData.date || ''} onChange={handleInputChange} className="w-full p-2 border rounded-md" />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-600 block mb-1">Descrizione Generale Fattura</label>
                            <input type="text" name="description" value={formData.description || ''} onChange={handleInputChange} placeholder="Es. Fattura Google Ads Giugno" className="w-full p-2 border rounded-md" />
                        </div>
                        <div className="p-3 bg-indigo-50 rounded-lg flex items-center justify-between">
                            <label htmlFor="multiBranchToggle" className="text-sm font-bold text-indigo-800">Assegna voci a più filiali o Aree Geografiche</label>
                            <input type="checkbox" id="multiBranchToggle" checked={formData.isMultiBranch || false} onChange={(e) => setFormData(prev => ({ ...prev, isMultiBranch: e.target.checked }))} />
                        </div>
                        <div className="pt-4 border-t">
                            <h4 className="text-lg font-bold text-gray-700 mb-2">Voci di Spesa</h4>
                            <div className="space-y-3">
                                {(formData.lineItems || []).map((item, index) => (
                                    <div key={index} className="p-3 bg-gray-50 rounded-lg border grid grid-cols-1 gap-3">
                                        <div className="flex items-end gap-2">
                                            <div className="flex-grow">
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Descrizione Voce</label>
                                                <input required type="text" placeholder="Descrizione dettagliata..." value={item.description} onChange={(e) => handleLineItemChange(index, 'description', e.target.value)} className="w-full p-2 border rounded-md" />
                                            </div>
                                            <div className="flex-shrink-0">
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Importo (€)</label>
                                                <input required type="text" placeholder="0.00" value={item.amount} onChange={(e) => handleLineItemChange(index, 'amount', e.target.value)} onBlur={(e) => handleAmountBlur(index, e.target.value)} className="w-32 p-2 border rounded-md text-right" />
                                            </div>
                                            <button type="button" onClick={() => removeLineItem(index)} className="p-2 text-red-500 hover:bg-red-100 rounded-md"><Trash2 size={20} /></button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-600 block mb-1">Canale di Marketing</label>
                                                <select required name="marketingChannelId" value={item.marketingChannelId || ''} onChange={(e) => handleLineItemChange(index, 'marketingChannelId', e.target.value)} className="w-full p-2 border rounded-md bg-white" disabled={!formData.supplierId}>
                                                    <option value="">{formData.supplierId ? 'Seleziona Canale' : 'Prima scegli un Fornitore'}</option>
                                                    {filteredMarketingChannels.map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Assegnazione Geografica</label>
                                                {formData.isMultiBranch ? (
                                                    <select required value={item.assignmentType && item.assignmentId ? `${item.assignmentType}:${item.assignmentId}` : ''} onChange={(e) => { const [type, id] = e.target.value.split(':'); handleLineItemChange(index, 'assignmentType', type); handleLineItemChange(index, 'assignmentId', id); }} className="w-full p-2 border rounded-md bg-white">
                                                        <option value="">Seleziona Area o Filiale</option>
                                                        <optgroup label="Aree Geografiche">{geographicAreas?.map(area => (<option key={area.id} value={`area:${area.id}`}>{area.name}</option>))}</optgroup>
                                                        <optgroup label="Filiali Singole">{branches?.map(b => (<option key={b.id} value={`branch:${b.id}`}>{b.name}</option>))}</optgroup>
                                                    </select>
                                                ) : (
                                                    <select required name="branchId" value={formData.branchId || ''} onChange={handleInputChange} className="w-full p-2 border rounded-md bg-white">
                                                        <option value="">Seleziona Filiale</option>
                                                        {filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addLineItem} className="mt-3 text-indigo-600 flex items-center gap-1 text-sm font-semibold"><PlusCircle size={16} /> Aggiungi Voce</button>
                        </div>
                        <div className="pt-4 border-t space-y-3">
                            <label className="text-lg font-bold text-gray-700 block">Allega Fattura PDF</label>
                            {formData.invoicePdfUrl && !invoiceFile && (<a href={formData.invoicePdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-green-900 flex items-center gap-1 w-fit"><Paperclip size={14} />Visualizza Fattura Esistente</a>)}
                            <input type="file" accept="application/pdf" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                            {invoiceFile && (<div className="flex items-center gap-2 text-sm text-gray-700"><Paperclip size={16}/><span>{invoiceFile.name}</span></div>)}
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-between items-center mt-auto border-t rounded-b-xl">
                        <div className="text-lg font-bold">Totale Fattura: <span className="text-indigo-600">{formatCurrency(totalAmount)}</span></div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">Annulla</button>
                            <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Salva Spesa</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}