import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Link2, ChevronDown } from 'lucide-react';

const MultiSelect = ({ options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredOptions = useMemo(() => 
        (options || []).filter(opt => opt.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [options, searchTerm]
    );

    const selectedCount = useMemo(() => (selected || []).length, [selected]);

    return (
        <div className="relative">
            <button 
                type="button" 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full h-11 px-3 text-left bg-white border-2 border-gray-200 rounded-xl focus:border-slate-500 focus:ring-4 focus:ring-slate-500/20 transition-all flex justify-between items-center"
            >
                <span className="block truncate text-gray-800">
                    {selectedCount > 0 ? `${selectedCount} selezionat${selectedCount > 1 ? 'i' : 'o'}` : <span className="text-gray-400">Seleziona...</span>}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div 
                    className="absolute z-20 mt-1 w-full bg-white/90 backdrop-blur-xl shadow-2xl rounded-xl border border-white/30 max-h-60 overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-2 sticky top-0 bg-white/80 backdrop-blur-xl">
                        <input 
                            type="text" 
                            placeholder="Cerca..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20"
                        />
                    </div>
                    <ul className="p-2">
                        {filteredOptions.map(option => {
                            const isChecked = (selected || []).includes(option.id);
                            return (
                                <li 
                                    key={option.id} 
                                    onClick={() => onChange(option.id)} 
                                    className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer flex items-center justify-between"
                                >
                                    <span className="ml-3 text-sm font-medium text-gray-800">{option.name}</span>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'bg-slate-800 border-slate-800' : 'bg-white border-gray-300'}`}>
                                        {isChecked && <Check className="w-4 h-4 text-white" />}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            {isOpen && <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>}
        </div>
    );
};

export default function AssociationModal({ isOpen, onClose, onSave, initialData, title, itemLabel, associationLists = [] }) {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (isOpen) {
            const data = { name: initialData?.name || '' };
            associationLists.forEach(list => {
                data[list.key] = initialData?.[list.key] || [];
            });
            setFormData(data);
        }
    }, [isOpen, initialData, associationLists]);

    if (!isOpen) return null;

    const handleInputChange = (e) => {
        setFormData(prev => ({ ...prev, name: e.target.value }));
    };

    const handleMultiSelectChange = (key, itemId) => {
        setFormData(prev => {
            const currentSelection = prev[key] || [];
            const newSelection = currentSelection.includes(itemId)
                ? currentSelection.filter(id => id !== itemId)
                : [...currentSelection, itemId];
            
            return { ...prev, [key]: newSelection };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity duration-300">
            <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] border border-white/30">
                <form onSubmit={handleSubmit}>
                    <div className="p-5 border-b border-gray-200/80 flex justify-between items-center flex-shrink-0">
                         <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-slate-700 to-gray-900 text-white">
                                <Link2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                                <p className="text-sm text-gray-500 font-medium">Modifica le associazioni e i dettagli</p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"><X /></button>
                    </div>
                    <div className="p-6 space-y-4 overflow-y-auto flex-1">
                        <div>
                            <label className="text-sm font-semibold text-gray-700 block mb-1">{itemLabel}</label>
                            <input 
                                type="text" 
                                value={formData.name || ''} 
                                onChange={handleInputChange} 
                                className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-slate-500 focus:ring-4 focus:ring-slate-500/20 transition-all" 
                                required 
                            />
                        </div>
                        {associationLists.map(list => (
                            <div key={list.key}>
                                <label className="text-sm font-semibold text-gray-700 block mb-1">{list.label}</label>
                                <MultiSelect 
                                    options={list.items}
                                    selected={formData[list.key] || []}
                                    onChange={(itemId) => handleMultiSelectChange(list.key, itemId)}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="p-5 bg-gray-50/70 flex justify-end items-center rounded-b-2xl border-t border-gray-200/80 flex-shrink-0">
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white text-gray-800 font-semibold border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all">Annulla</button>
                            <button 
                                type="submit" 
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold hover:shadow-lg transition-all"
                            >
                                Salva
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}