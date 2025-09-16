import React from 'react';
import { X, SlidersHorizontal } from 'lucide-react';

export default function AdvancedFiltersModal({ 
    isOpen, 
    onClose, 
    invoiceFilter, 
    setInvoiceFilter, 
    contractFilter, 
    setContractFilter, 
    branchFilter, 
    setBranchFilter, 
    areaFilter, 
    setAreaFilter, 
    branches, 
    geographicAreas 
}) {
    if (!isOpen) return null;

    const handleBranchChange = (branchId) => {
        setBranchFilter(prev => prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <SlidersHorizontal className="w-5 h-5" />
                        Filtri Avanzati
                    </h3>
                    <button 
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-2">Stato Contratto</label>
                        <select 
                            value={contractFilter} 
                            onChange={(e) => setContractFilter(e.target.value)} 
                            className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                        >
                            <option value="">Tutti</option>
                            <option value="present">Con Contratto</option>
                            <option value="missing">Senza Contratto</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-2">Stato Fattura</label>
                        <select 
                            value={invoiceFilter} 
                            onChange={(e) => setInvoiceFilter(e.target.value)} 
                            className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                        >
                            <option value="">Tutte</option>
                            <option value="missing">Mancante</option>
                            <option value="present">Presente</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-2">Area Geografica</label>
                        <select 
                            value={areaFilter} 
                            onChange={(e) => setAreaFilter(e.target.value)} 
                            className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all"
                        >
                            <option value="">Tutte</option>
                            {geographicAreas.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-700 block mb-2">Filiali Specifiche</label>
                        <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-xl p-3 space-y-2">
                            {branches.map(b => (
                                <label key={b.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={branchFilter.includes(b.id)} 
                                        onChange={() => handleBranchChange(b.id)} 
                                        className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">{b.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-gray-50/50 rounded-b-2xl flex justify-end">
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