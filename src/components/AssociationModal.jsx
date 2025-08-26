import React, { useState, useEffect, useMemo } from 'react';
import { X, Check } from 'lucide-react';

const MultiSelect = ({ options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredOptions = useMemo(() => 
        (options || []).filter(opt => opt.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [options, searchTerm]
    );

    const selectedNames = useMemo(() => 
        (options || []).filter(opt => (selected || []).includes(opt.id)).map(opt => opt.name).join(', '),
        [options, selected]
    );

    return (
        <div className="relative">
            <button type="button" onClick={() => setIsOpen(!isOpen)} className="w-full h-11 px-3 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition bg-white">
                <span className="block truncate text-gray-700">
                    {selected && selected.length > 0 ? selectedNames : <span className="text-gray-400">Seleziona...</span>}
                </span>
            </button>
            {isOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white shadow-lg rounded-lg border max-h-60 overflow-y-auto">
                    <div className="p-2">
                        <input type="text" placeholder="Cerca..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md"/>
                    </div>
                    <ul className="p-1">
                        {filteredOptions.map(option => {
                            const isChecked = (selected || []).includes(option.id);
                            return (
                                <li key={option.id} onClick={() => onChange(option.id)} className="p-2 rounded-md hover:bg-indigo-50 cursor-pointer flex items-center">
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                                        {isChecked && <Check className="w-4 h-4 text-white" />}
                                    </div>
                                    <span className="ml-3 text-sm text-gray-700">{option.name}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                        <button type="button" onClick={onClose}><X size={24}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-sm font-bold text-gray-600 block mb-1">{itemLabel}</label>
                            <input type="text" value={formData.name || ''} onChange={handleInputChange} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" required />
                        </div>
                        {associationLists.map(list => (
                            <div key={list.key}>
                                <label className="text-sm font-bold text-gray-600 block mb-1">{list.label}</label>
                                <MultiSelect 
                                    options={list.items}
                                    selected={formData[list.key] || []}
                                    onChange={(itemId) => handleMultiSelectChange(list.key, itemId)}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300">Annulla</button>
                        <button type="submit" className="px-6 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Salva</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
