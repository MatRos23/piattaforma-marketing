import React, { useState, useEffect, useMemo } from 'react';
import { FileSignature, X, PlusCircle, Trash2, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';

const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '€ 0,00';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

export default function ContractFormModal({ isOpen, onClose, onSave, initialData, suppliers, sectors, branches }) {
    
    const defaultLineItem = useMemo(() => ({
        _key: Math.random(),
        description: '',
        totalAmount: '',
        startDate: '',
        endDate: '',
        branchld: '',
        sectorld: '',
    }), []);

    const defaultFormData = useMemo(() => ({
        supplierld: '',
        signingDate: new Date().toISOString().split('T')[0],
        description: '',
        contractPdfUrl: '',
        lineItems: [defaultLineItem],
    }), [defaultLineItem]);

    const [formData, setFormData] = useState(defaultFormData);
    const [contractFile, setContractFile] = useState(null);

    useEffect(() => {
        if (isOpen) {
            const data = initialData 
                ? { ...initialData, lineItems: initialData.lineItems?.map(item => ({...item, _key: Math.random(), totalAmount: item.totalAmount || ''})) || [defaultLineItem] } 
                : defaultFormData;
            setFormData(data);
        }
        setContractFile(null);
    }, [isOpen, initialData, defaultFormData, defaultLineItem]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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
            return toast.error("Deve esserci almeno una voce di contratto.");
        }
        setFormData(prev => ({
            ...prev,
            lineItems: prev.lineItems.filter((_, i) => i !== index)
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type === "application/pdf") {
            setContractFile(file);
        } else {
            toast.error("Per favore, seleziona un file PDF.");
            e.target.value = null;
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.supplierld || !formData.description.trim() || !formData.signingDate) {
            toast.error("I campi principali (Fornitore, Data Firma, Descrizione) sono obbligatori.");
            return;
        }

        for (const [index, item] of formData.lineItems.entries()) {
            if (!item.description.trim() || !item.startDate || !item.endDate || !item.branchld || !item.sectorld) {
                toast.error(`Tutti i campi nella voce di costo #${index + 1} sono obbligatori.`);
                return;
            }
            if (new Date(item.startDate) >= new Date(item.endDate)) {
                toast.error(`Nella voce "${item.description}", la data di inizio deve essere precedente alla data di fine.`);
                return;
            }
        }
        
        onSave(formData, contractFile);
    };
    
    const contractTotal = useMemo(() => {
        return formData.lineItems?.reduce((sum, item) => {
            const amount = parseFloat(String(item.totalAmount || '0').replace(',', '.'));
            return sum + (isNaN(amount) ? 0 : amount);
        }, 0) || 0;
    }, [formData.lineItems]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity duration-300">
            <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-white/30">
                <div className="p-5 border-b border-gray-200/80 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                            <FileSignature className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">{formData.id ? 'Modifica Contratto' : 'Nuovo Contratto'}</h3>
                            <p className="text-sm text-gray-500 font-medium">Compila i dati per creare o aggiornare un contratto</p>
                        </div>
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
                                    <select name="supplierld" value={formData.supplierld || ''} onChange={handleInputChange} className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all" required>
                                        <option value="">Seleziona Fornitore</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-gray-700 block mb-1">Data Firma Contratto *</label>
                                    <input type="date" name="signingDate" value={formData.signingDate || ''} onChange={handleInputChange} className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all" required />
                                </div>
                            </div>
                             <div>
                                <label className="text-sm font-semibold text-gray-700 block mb-1">Descrizione Generale Contratto *</label>
                                <input type="text" name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all" placeholder="Es. Accordo Quadro Subito.it 2025" required />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200/80"></div>
                        
                        <div>
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Voci di Costo del Contratto</h4>
                            <div className="space-y-4">
                                {formData.lineItems?.map((item, index) => (
                                    <div key={item._key} className="p-4 bg-white/70 rounded-xl border-2 border-white space-y-3 relative">
                                        {formData.lineItems.length > 1 && (
                                            <button type="button" onClick={() => removeLineItem(index)} className="absolute -top-2 -right-2 p-1 bg-red-100 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-all"><Trash2 size={16} /></button>
                                        )}
                                        <div>
                                            <label className="text-xs font-semibold text-gray-600 block mb-1">Descrizione Voce *</label>
                                            <input type="text" placeholder="Es. Moto e Scooter - 20 annunci" value={item.description} onChange={e => handleLineItemChange(index, 'description', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg bg-white" required />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                            <div className="md:col-span-1">
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Importo (€) *</label>
                                                <input type="number" step="0.01" placeholder="0.00" value={item.totalAmount} onChange={e => handleLineItemChange(index, 'totalAmount', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg" required />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Data Inizio *</label>
                                                <input type="date" value={item.startDate} onChange={e => handleLineItemChange(index, 'startDate', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg" required />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Data Fine *</label>
                                                <input type="date" value={item.endDate} onChange={e => handleLineItemChange(index, 'endDate', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg" required />
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Settore *</label>
                                                <select value={item.sectorld} onChange={e => handleLineItemChange(index, 'sectorld', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg" required>
                                                    <option value="">Seleziona</option>
                                                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="md:col-span-1">
                                                <label className="text-xs font-semibold text-gray-600 block mb-1">Filiale *</label>
                                                <select value={item.branchld} onChange={e => handleLineItemChange(index, 'branchld', e.target.value)} className="w-full h-10 px-3 border-2 border-gray-200 rounded-lg" required>
                                                    <option value="">Seleziona</option>
                                                    {branches.filter(b => b.associatedSectors?.includes(item.sectorld)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" onClick={addLineItem} className="mt-4 text-purple-600 font-semibold flex items-center gap-2 hover:text-purple-700 transition-colors">
                                <PlusCircle size={16} /> Aggiungi Voce al Contratto
                            </button>
                        </div>
                        
                        <div className="pt-4 border-t border-gray-200/80"></div>

                        <div>
                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Allegato</h4>
                            <div className="p-4 bg-white/70 rounded-xl border-2 border-white">
                                <label htmlFor="contractUpload" className="text-sm font-semibold text-gray-700 block mb-2">PDF Contratto</label>
                                {formData.contractPdfUrl && !contractFile && (
                                    <div className="flex items-center gap-2 text-sm mb-2">
                                        <a href={formData.contractPdfUrl} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline font-semibold">Visualizza contratto corrente</a>
                                    </div>
                                )}
                                <div className="flex items-center gap-4">
                                     <label htmlFor="contractUpload" className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 text-gray-700 font-semibold text-sm rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all">
                                        <Paperclip className="w-4 h-4" />
                                        <span>{contractFile ? "Cambia file..." : "Scegli file..."}</span>
                                    </label>
                                    <input id="contractUpload" type="file" accept="application/pdf" onChange={handleFileChange} className="hidden"/>
                                    <span className="text-sm text-gray-600">{contractFile ? contractFile.name : "Nessun nuovo file selezionato"}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 bg-gray-50/70 flex justify-between items-center rounded-b-2xl border-t border-gray-200/80 flex-shrink-0">
                        <div className="text-lg font-bold">
                            <span className="text-gray-600">Valore Totale:</span> <span className="text-purple-600">{formatCurrency(contractTotal)}</span>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white text-gray-800 font-semibold border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all">Annulla</button>
                            <button type="submit" className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold hover:shadow-lg transition-all">
                                Salva Contratto
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}