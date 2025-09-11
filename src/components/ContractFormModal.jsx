import React, { useState, useEffect, useMemo } from 'react';
import { FileText, X, PlusCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Select from 'react-select';

const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '€ 0,00';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

export default function ContractFormModal({ isOpen, onClose, onSave, initialData, suppliers, sectors, branches }) {
    
    const defaultLineItem = {
        _key: Math.random(),
        description: '',
        totalAmount: '0.00',
        startDate: '',
        endDate: '',
        branchld: '',
        sectorld: '', // --- NUOVO CAMPO FONDAMENTALE ---
    };

    const defaultFormData = {
        supplierld: '',
        signingDate: '',
        description: '',
        contractPdfUrl: '',
        lineItems: [defaultLineItem],
    };

    const [formData, setFormData] = useState(defaultFormData);
    const [contractFile, setContractFile] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setFormData(initialData ? { ...initialData, lineItems: initialData.lineItems?.map(item => ({...item, _key: Math.random()})) || [defaultLineItem] } : defaultFormData);
        }
        setContractFile(null);
    }, [isOpen, initialData]);

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
        console.log("--- Inizio processo di salvataggio ---");
        console.log("Dati del form al momento del click:", formData);

        if (!formData.supplierld || !formData.description.trim() || !formData.signingDate) {
            console.error("VALIDAZIONE FALLITA: Uno dei campi principali (Fornitore, Descrizione, Data Firma) è vuoto.");
            toast.error("I campi principali del contratto (Fornitore, Data Firma, Descrizione) sono obbligatori.");
            return;
        }

        for (const [index, item] of formData.lineItems.entries()) {
            console.log(`Controllo la voce di costo #${index + 1}...`);
            if (!item.description.trim() || !item.startDate || !item.endDate || !item.branchld || !item.sectorld) {
                console.error(`VALIDAZIONE FALLITA sulla voce di costo #${index + 1}. Dati della voce:`, item);
                toast.error(`Tutti i campi nella voce di costo #${index + 1} (incluso il settore) sono obbligatori.`);
                return;
            }
            if (new Date(item.startDate) >= new Date(item.endDate)) {
                console.error(`VALIDAZIONE FALLITA sulle date della voce di costo #${index + 1}.`);
                toast.error(`Nella voce "${item.description}", la data di inizio deve essere precedente alla data di fine.`);
                return;
            }
        }
        
        console.log("VALIDAZIONE COMPLETATA CON SUCCESSO. Eseguo onSave...");
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl flex-shrink-0">
                    <h3 className="text-xl font-bold text-gray-800">{formData.id ? 'Modifica Contratto' : 'Nuovo Contratto'}</h3>
                    <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Fornitore</label>
                                <select name="supplierld" value={formData.supplierld || ''} onChange={handleInputChange} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" required>
                                    <option value="">Seleziona Fornitore</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-gray-600 block mb-1">Data Firma Contratto</label>
                                <input type="date" name="signingDate" value={formData.signingDate || ''} onChange={handleInputChange} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" required />
                            </div>
                        </div>
                         <div>
                            <label className="text-sm font-bold text-gray-600 block mb-1">Descrizione Generale Contratto</label>
                            <input type="text" name="description" value={formData.description || ''} onChange={handleInputChange} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" placeholder="Es. Accordo Quadro Subito.it 2025" required />
                        </div>
                        <div className="pt-4 border-t">
                            <h4 className="text-lg font-bold text-gray-700 mb-2">Voci di Costo del Contratto</h4>
                            <div className="space-y-3">
                                {formData.lineItems?.map((item, index) => (
                                    <div key={item._key} className="p-4 bg-gray-50 rounded-lg border space-y-3 relative">
                                        {formData.lineItems.length > 1 && (
                                            <button type="button" onClick={() => removeLineItem(index)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={18} /></button>
                                        )}
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 block mb-1">Descrizione Voce</label>
                                            <input type="text" placeholder="Es. Moto e Scooter - 20 annunci" value={item.description} onChange={e => handleLineItemChange(index, 'description', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" required />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Importo (€)</label>
                                                <input type="number" step="0.01" placeholder="0.00" value={item.totalAmount} onChange={e => handleLineItemChange(index, 'totalAmount', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg" required />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Data Inizio</label>
                                                <input type="date" value={item.startDate} onChange={e => handleLineItemChange(index, 'startDate', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg" required />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Data Fine</label>
                                                <input type="date" value={item.endDate} onChange={e => handleLineItemChange(index, 'endDate', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg" required />
                                            </div>
                                            {/* --- NUOVO MENU A TENDINA PER IL SETTORE --- */}
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Settore</label>
                                                <select value={item.sectorld} onChange={e => handleLineItemChange(index, 'sectorld', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg" required>
                                                    <option value="">Seleziona</option>
                                                    {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">Filiale</label>
                                                <select value={item.branchld} onChange={e => handleLineItemChange(index, 'branchld', e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg" required>
                                                    <option value="">Seleziona</option>
                                                    {branches.filter(b => b.associatedSectors?.includes(item.sectorld)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                             <button type="button" onClick={addLineItem} className="mt-4 text-indigo-600 font-semibold flex items-center gap-2">
                                <PlusCircle size={16} /> Aggiungi Voce al Contratto
                            </button>
                        </div>
                        
                        {/* --- BLOCCO AGGIUNTO --- */}
                        <div className="pt-4 border-t">
                            <h4 className="text-lg font-bold text-gray-700 mb-2">Allega PDF Contratto</h4>
                            {formData.contractPdfUrl && !contractFile && (
                                <div className="flex items-center gap-2 text-sm mb-2">
                                    <FileText size={16} className="text-gray-500" />
                                    <a href={formData.contractPdfUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Visualizza contratto corrente</a>
                                </div>
                            )}
                            <input type="file" accept="application/pdf" onChange={handleFileChange} className="mt-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                            {contractFile && (
                                <div className="flex items-center gap-2 text-sm mt-2 text-green-700">
                                    <p>Nuovo file selezionato: {contractFile.name}</p>
                                </div>
                            )}
                        </div>
                        {/* --- FINE BLOCCO AGGIUNTO --- */}

                    </div>
                    <div className="p-6 bg-gray-50 flex justify-between items-center rounded-b-xl border-t flex-shrink-0">
                        <div className="text-xl font-bold">
                            Valore Totale Contratto: <span className="text-indigo-600">{formatCurrency(contractTotal)}</span>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300">Annulla</button>
                            <button type="submit" className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Salva Contratto</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}