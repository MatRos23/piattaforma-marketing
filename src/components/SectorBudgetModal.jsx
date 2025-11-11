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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200/60 bg-white/98 shadow-[0_35px_95px_-45px_rgba(15,23,42,0.75)] transition-transform">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white">
                    <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-white shadow-inner shadow-black/20">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black">Budget per {sector.name}</h3>
                            <p className="text-sm font-medium text-white/80">Anno fiscale {year}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/80 transition-all hover:bg-white/20 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                
                <div className="space-y-4 bg-white px-6 py-6">
                    <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 block">
                        Tetto massimo di spesa (€)
                    </label>
                    <input 
                        type="number"
                        step="0.01"
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                        className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                        placeholder="0.00"
                    />
                    <p className="text-xs font-medium text-slate-400">
                        Imposta l’importo totale disponibile per il settore selezionato nel periodo indicato.
                    </p>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200/60 bg-slate-50/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        Operazione impostazioni
                    </div>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-100"
                        >
                            Annulla
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-transform hover:-translate-y-[1px] hover:bg-slate-800"
                        >
                            Salva budget
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
