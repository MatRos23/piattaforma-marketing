import React from 'react';
import { X, SlidersHorizontal, Check } from 'lucide-react';

export default function AdvancedFiltersModal({ 
    isOpen, 
    onClose, 
    invoiceFilter, 
    setInvoiceFilter, 
    contractFilter, 
    setContractFilter, 
    branchFilter, 
    setBranchFilter, 
    branches, 
}) {
    if (!isOpen) return null;

    const handleBranchChange = (branchId) => {
        setBranchFilter(prev => prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] border border-white/30 overflow-hidden">
                <div className="p-6 border-b border-gray-200/80 flex justify-between items-center flex-shrink-0 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-2xl">
    <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-600 to-orange-700 text-white shadow-lg">
            <SlidersHorizontal className="w-6 h-6" />
        </div>
        <div>
            <h3 className="text-2xl font-black text-gray-900">
                Filtri Avanzati
            </h3>
            <p className="text-sm text-gray-600 font-medium">
                Affina la tua ricerca
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

                <div className="p-6 space-y-6 overflow-y-auto">
                    <div>
    <label className="text-sm font-bold text-gray-700 block mb-2">Stato Contratto</label>
    <div className="flex items-center gap-2 p-1 bg-white border-2 border-gray-200 rounded-xl">
        <button
            type="button"
            onClick={() => setContractFilter('')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${contractFilter === '' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-200'}`}
        >
            Tutti
        </button>
        <button
            type="button"
            onClick={() => setContractFilter('present')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${contractFilter === 'present' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-200'}`}
        >
            Con Contratto
        </button>
        <button
            type="button"
            onClick={() => setContractFilter('missing')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${contractFilter === 'missing' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-200'}`}
        >
            Senza Contratto
        </button>
    </div>
</div>

                    <div>
    <label className="text-sm font-bold text-gray-700 block mb-2">Stato Fattura</label>
    <div className="flex items-center gap-2 p-1 bg-white border-2 border-gray-200 rounded-xl">
        <button
            type="button"
            onClick={() => setInvoiceFilter('')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${invoiceFilter === '' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-200'}`}
        >
            Tutte
        </button>
        <button
            type="button"
            onClick={() => setInvoiceFilter('present')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${invoiceFilter === 'present' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-200'}`}
        >
            Presente
        </button>
        <button
            type="button"
            onClick={() => setInvoiceFilter('missing')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${invoiceFilter === 'missing' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:bg-gray-200'}`}
        >
            Mancante
        </button>
    </div>
</div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-2">Filiali Specifiche</label>
                        <div className="p-4 bg-white rounded-xl border-2 border-gray-200">
                            {branches.map(b => (
                                <label key={b.id} onClick={() => handleBranchChange(b.id)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${branchFilter.includes(b.id) ? 'bg-amber-600 border-amber-600' : 'bg-white border-gray-300'}`}>
    {branchFilter.includes(b.id) && <Check className="w-3.5 h-3.5 text-white" />}
</div>
                                    <span className="text-sm font-medium text-gray-700">{b.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 flex justify-end border-t border-gray-200">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                    >
                        Applica Filtri
                    </button>
                </div>
            </div>
        </div>
    );
}