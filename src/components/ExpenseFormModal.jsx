import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, Trash2, Paperclip, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ExpenseFormModal({ isOpen, onClose, onSave, initialData, sectors, branches, suppliers, marketingChannels, geographicAreas }) {
    const [formData, setFormData] = useState({});
    const [invoiceFile, setInvoiceFile] = useState(null);

    const defaultLineItem = {
        description: "",
        amount: '0.00',
        marketingChannelId: "",
        assignmentId: ""
    };

    useEffect(() => {
        if (isOpen) {
            const isEditing = !!(initialData && initialData.id);
            const isDuplicating = initialData && !initialData.id;
            const isMultiBranchFlag = isEditing || isDuplicating ? (initialData.isMultiBranch || false) : false;

            let migratedLineItems = [defaultLineItem];
            if ((isEditing || isDuplicating) && initialData.lineItems?.length > 0) {
                migratedLineItems = initialData.lineItems.map(item => ({
                    ...item,
                    amount: String(item.amount || '0'),
                    assignmentId: item.assignmentId || initialData.branchId,
                }));
            }

            setFormData({
                id: initialData?.id || null,
                sectorId: initialData?.sectorId || '',
                supplierId: initialData?.supplierId || '',
                date: isDuplicating ? new Date().toISOString().split('T')[0] : (initialData?.date || new Date().toISOString().split('T')[0]),
                description: isDuplicating ? `${initialData.description || ''} (Copia)` : (initialData?.description || ''),
                isMultiBranch: isMultiBranchFlag,
                branchId: !isMultiBranchFlag ? (initialData?.branchId || '') : null,
                lineItems: migratedLineItems,
                invoicePdfUrl: isEditing ? (initialData?.invoicePdfUrl || '') : '',
            });
            setInvoiceFile(null);
        }
    }, [initialData, isOpen]);

    const filteredSuppliers = useMemo(() => {
        if (!formData.sectorId || !suppliers) return [];
        return suppliers.filter(supplier => supplier.associatedSectors?.includes(formData.sectorId));
    }, [formData.sectorId, suppliers]);

    const filteredBranches = useMemo(() => {
        if (!formData.sectorId || !branches) return [];
        return branches.filter(branch => branch.associatedSectors?.includes(formData.sectorId));
    }, [formData.sectorId, branches]);

    const filteredMarketingChannels = useMemo(() => {
        if (!formData.supplierId || !suppliers || !marketingChannels) return [];
        const selectedSupplier = suppliers.find(s => s.id === formData.supplierId);
        const offeredChannelIds = selectedSupplier?.offeredMarketingChannels || [];
        if (offeredChannelIds.length === 0) return [];
        return marketingChannels.filter(mc => offeredChannelIds.includes(mc.id));
    }, [formData.supplierId, suppliers, marketingChannels]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: type === 'checkbox' ? checked : value };
            if (name === 'sectorId') {
                newState.supplierId = '';
                newState.branchId = '';
                newState.lineItems = newState.lineItems.map(item => ({ ...item, assignmentId: '' }));
            }
            if (name === 'isMultiBranch') {
                newState.branchId = checked ? null : '';
            }
            return newState;
        });
    };

    const handleLineItemChange = (index, field, value) => {
        const updatedLineItems = [...formData.lineItems];
        updatedLineItems[index][field] = value;
        setFormData(prev => ({ ...prev, lineItems: updatedLineItems }));
    };

    const addLineItem = () => setFormData(prev => ({ ...prev, lineItems: [...(prev.lineItems || []), defaultLineItem] }));
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

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData, invoiceFile);
    };

    const totalAmount = useMemo(() => {
        return formData.lineItems?.reduce((sum, item) => {
            const value = parseFloat(String(item.amount || '0').replace(',', '.'));
            return sum + (isNaN(value) ? 0 : value);
        }, 0) || 0;
    }, [formData.lineItems]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl flex-shrink-0">
                    <h3 className="text-xl font-bold text-gray-800">{formData.id ? 'Modifica Spesa' : 'Nuova Spesa'}</h3>
                    <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="text-sm font-bold text-gray-600 block mb-1">Settore</label><select name="sectorId" value={formData.sectorId || ''} onChange={handleInputChange} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" required><option value="">Seleziona Settore</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                            <div><label className="text-sm font-bold text-gray-600 block mb-1">Fornitore</label><select name="supplierId" value={formData.supplierId || ''} onChange={handleInputChange} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" required disabled={!formData.sectorId}><option value="">{!formData.sectorId ? 'Prima seleziona settore' : 'Seleziona Fornitore'}</option>{filteredSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                            <div><label className="text-sm font-bold text-gray-600 block mb-1">Data</label><input type="date" name="date" value={formData.date || ''} onChange={handleInputChange} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" required /></div>
                        </div>
                        <div><label className="text-sm font-bold text-gray-600 block mb-1">Descrizione Fattura</label><input type="text" name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" placeholder="Es. Fattura Marketing Mensile" required /></div>
                        <div className="p-3 bg-indigo-50 rounded-lg flex items-center justify-between"><label htmlFor="multiBranchToggle" className="text-sm font-bold text-gray-700">Spesa su più filiali?</label><input type="checkbox" id="multiBranchToggle" name="isMultiBranch" checked={formData.isMultiBranch || false} onChange={handleInputChange} className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500" /></div>
                        <div className="pt-4 border-t"><h4 className="text-lg font-bold text-gray-700 mb-2">Voci di Spesa</h4>
                            <div className="space-y-3">
                                {(formData.lineItems || []).map((item, index) => (
                                    <div key={index} className="p-3 bg-gray-50 rounded-lg space-y-3">
                                        <div className="flex items-end gap-4"><div className="flex-grow"><label className="text-xs font-bold text-gray-500 block mb-1">Descrizione Voce</label><input required type="text" placeholder="Descrizione dettagliata del costo" value={item.description} onChange={e => handleLineItemChange(index, 'description', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" /></div><div className="w-40 flex-shrink-0"><label className="text-xs font-bold text-gray-500 block mb-1">Importo</label><input required type="text" placeholder="0.00" value={item.amount} onChange={e => handleLineItemChange(index, 'amount', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition text-right" /></div></div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                            <div><label className="text-xs font-bold text-gray-600 block mb-1">Canale Marketing</label><select required name="marketingChannelId" value={item.marketingChannelId} onChange={e => handleLineItemChange(index, 'marketingChannelId', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" disabled={!formData.supplierId}><option value="">{!formData.supplierId ? 'Prima seleziona fornitore' : 'Seleziona Canale'}</option>{filteredMarketingChannels.map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}</select></div>
                                            <div>
                                                {formData.isMultiBranch ? (<><label className="text-xs font-bold text-gray-500 block mb-1">Assegna a Filiale</label><select required name="assignmentId" value={item.assignmentId} onChange={e => handleLineItemChange(index, 'assignmentId', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" disabled={!formData.sectorId}><option value="">{!formData.sectorId ? 'Prima seleziona settore' : 'Seleziona Filiale'}</option>{filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></>) : (<><label className="text-xs font-bold text-gray-500 block mb-1">Filiale</label><select required name="branchId" value={formData.branchId || ''} onChange={handleInputChange} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" disabled={!formData.sectorId}><option value="">{!formData.sectorId ? 'Prima seleziona settore' : 'Seleziona Filiale'}</option>{filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></>)}
                                            </div>
                                        </div>
                                        <div className="flex justify-end"><button type="button" onClick={() => removeLineItem(index)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 size={18} /></button></div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addLineItem} className="mt-4 text-indigo-600 font-semibold flex items-center gap-2"><PlusCircle size={16} /> Aggiungi Voce</button>
                        </div>
                        <div className="pt-4 border-t"><h4 className="text-lg font-bold text-gray-700 mb-2">Allega Fattura (PDF)</h4>{formData.invoicePdfUrl && !invoiceFile && (<div className="flex items-center gap-2 text-sm"><Paperclip size={16} className="text-gray-500" /><a href={formData.invoicePdfUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Visualizza fattura corrente</a></div>)}<input type="file" accept="application/pdf" onChange={handleFileChange} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>{invoiceFile && (<div className="flex items-center gap-2 text-sm mt-2 text-green-700"><p>Nuovo file selezionato: {invoiceFile.name}</p></div>)}</div>
                    </div>
                    <div className="p-6 bg-gray-50 flex justify-between items-center rounded-b-xl border-t flex-shrink-0">
                        <div className="flex-1"><div className="text-lg font-bold">Totale Fattura: <span className="text-indigo-600">{totalAmount.toLocaleString('it-IT', { style: 'currency', 'currency': 'EUR' })}</span></div></div>
                        <div className="flex gap-3"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300">Annulla</button><button type="submit" className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Salva</button></div>
                    </div>
                </form>
            </div>
        </div>
    );
}
