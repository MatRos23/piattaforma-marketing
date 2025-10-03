import React, { useState, useEffect } from 'react';
import { X, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SectorBudgetModal({ isOpen, onClose, onSave, sector, year }) {
    const [amount, setAmount] = useState('');

    useEffect(() => {
        if (isOpen && sector) {
            setAmount(sector.budget || '');
        }
    }, [isOpen, sector]);

    if (!isOpen) return null;

    const handleSave = () => {
        const newAmount = parseFloat(String(amount).replace(',', '.')) || 0;
        if (newAmount < 0) {
            toast.error("L'importo non può essere negativo.");
            return;
        }
        onSave(sector.id, newAmount);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity duration-300">
            <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] border border-white/30">
                <div className="p-5 border-b border-gray-200/80 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Budget per {sector.name}</h3>
                            <p className="text-sm text-gray-500 font-medium">Anno {year}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"><X /></button>
                </div>
                
                <div className="p-6">
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Tetto Massimo di Spesa (€)</label>
                    <input 
                        type="number"
                        step="0.01"
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                        className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all"
                        placeholder="0.00"
                    />
                </div>

                <div className="p-5 bg-gray-50/70 flex justify-end items-center rounded-b-2xl border-t border-gray-200/80 flex-shrink-0">
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white text-gray-800 font-semibold border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all">Annulla</button>
                        <button type="button" onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold hover:shadow-lg transition-all">
                            Salva Budget
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}