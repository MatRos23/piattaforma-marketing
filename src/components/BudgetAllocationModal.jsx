import React, { useState, useEffect, useMemo } from 'react';
import { PlusCircle, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BudgetAllocationModal({ isOpen, onClose, onSave, supplier, year, initialAllocations, sectors, branches, marketingChannels }) {
    const [allocations, setAllocations] = useState([]);
    const [isUnexpected, setIsUnexpected] = useState(false);

    // Questo useEffect si attiva quando il popup viene aperto
    useEffect(() => {
        if (isOpen) {
            setIsUnexpected(supplier?.isUnexpected || false);
            const initialData = initialAllocations && initialAllocations.length > 0
                ? initialAllocations.map(a => ({ ...a, _key: Math.random() }))
                : [{ _key: Math.random(), marketingChannelId: '', sectorId: '', branchId: '', budgetAmount: 0 }];
            setAllocations(initialData);
        }
    }, [isOpen, initialAllocations, supplier]);

    if (!isOpen) return null;

    // Gestore per modificare i valori nelle righe di allocazione
    const handleAllocationChange = (index, field, value) => {
        const newAllocations = [...allocations];
        newAllocations[index][field] = value;
        // Se cambia il settore, resetta la filiale perché la lista di opzioni cambierà
        if (field === 'sectorId') {
            newAllocations[index]['branchId'] = '';
        }
        setAllocations(newAllocations);
    };

    // Aggiunge una nuova riga di allocazione vuota
    const addAllocation = () => {
        setAllocations([...allocations, { _key: Math.random(), marketingChannelId: '', sectorId: '', branchId: '', budgetAmount: 0 }]);
    };

    // Rimuove una riga di allocazione
    const removeAllocation = (index) => {
        if (allocations.length <= 1) {
            return toast.error("Deve esserci almeno una riga di budget.");
        }
        setAllocations(allocations.filter((_, i) => i !== index));
    };

    // Prepara i dati e chiama la funzione onSave passata da BudgetPage
    const handleSave = () => {
        const allocationsToSave = allocations.map(({ _key, ...rest }) => ({
            ...rest,
            budgetAmount: parseFloat(String(rest.budgetAmount || '0').replace(',', '.')) || 0,
        }));

        // Controlla se ci sono righe incomplete
        for (const alloc of allocationsToSave) {
            if (!alloc.marketingChannelId || !alloc.sectorId || !alloc.branchId) {
                toast.error("Tutte le righe devono avere Canale, Settore e Filiale selezionati.");
                return;
            }
        }
        
        onSave(allocationsToSave, isUnexpected);
    };

    // Calcola il budget totale in tempo reale
    const totalBudget = useMemo(() => {
        return allocations.reduce((sum, alloc) => sum + (parseFloat(String(alloc.budgetAmount || '0').replace(',', '.')) || 0), 0);
    }, [allocations]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800">Gestione Budget per {supplier.name} ({year})</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isUnexpected}
                                onChange={e => setIsUnexpected(e.target.checked)}
                                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="font-semibold text-amber-800">Fornitore Inatteso (non previsto nel piano marketing iniziale)</span>
                        </label>
                    </div>
                    <div className="space-y-3">
                        {allocations.map((alloc, index) => {
                            // Filtra i canali marketing in base a quelli offerti dal fornitore
                            const availableChannels = marketingChannels.filter(mc => supplier.offeredMarketingChannels?.includes(mc.id));
                            // Filtra le filiali in base al settore selezionato nella riga corrente
                            const filteredBranches = branches.filter(b => b.associatedSectors?.includes(alloc.sectorId));

                            return (
                                <div key={alloc._key} className="p-4 bg-gray-50 rounded-lg grid grid-cols-1 md:grid-cols-10 gap-3 items-center">
                                    <div className="md:col-span-3">
                                        <label className="text-xs font-bold text-gray-500">Canale Marketing</label>
                                        <select value={alloc.marketingChannelId} onChange={e => handleAllocationChange(index, 'marketingChannelId', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white">
                                            <option value="">Seleziona Canale</option>
                                            {availableChannels.map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-xs font-bold text-gray-500">Settore</label>
                                        <select value={alloc.sectorId} onChange={e => handleAllocationChange(index, 'sectorId', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white">
                                            <option value="">Seleziona Settore</option>
                                            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-3">
                                        <label className="text-xs font-bold text-gray-500">Filiale</label>
                                        <select value={alloc.branchId} onChange={e => handleAllocationChange(index, 'branchId', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white" disabled={!alloc.sectorId}>
                                            <option value="">Seleziona Filiale</option>
                                            {filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="text-xs font-bold text-gray-500">Budget (€)</label>
                                        <input type="number" value={alloc.budgetAmount} onChange={e => handleAllocationChange(index, 'budgetAmount', e.target.value)} className="w-full mt-1 p-2 border rounded-md" placeholder="0.00" />
                                    </div>
                                    <div className="md:col-span-1 flex items-center justify-center pt-5">
                                        <button onClick={() => removeAllocation(index)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={addAllocation} className="text-indigo-600 font-semibold flex items-center gap-2 mt-4">
                        <PlusCircle size={16} /> Aggiungi Riga
                    </button>
                </div>
                <div className="p-6 bg-gray-50 flex justify-between items-center rounded-b-2xl">
                    <div className="text-xl font-bold">
                        Totale Budget: <span className="text-indigo-600">{totalBudget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                    <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
                        Salva Budget
                    </button>
                </div>
            </div>
        </div>
    );
}