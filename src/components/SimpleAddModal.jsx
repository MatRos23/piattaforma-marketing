import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SimpleAddModal({ isOpen, onClose, onSave, initialData, type }) {
    const [name, setName] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const getTitleAndLabel = () => {
        const isEditing = !!initialData;
        switch (type) {
            case 'sector': return { title: isEditing ? 'Modifica Settore' : 'Nuovo Settore', label: 'Nome Settore' };
            case 'category': return { title: isEditing ? 'Modifica Categoria' : 'Nuova Categoria', label: 'Nome Categoria' };
            default: return { title: 'Aggiungi/Modifica', label: 'Nome' };
        }
    };

    const { title, label } = getTitleAndLabel();

    const handleSave = () => {
        if (!name.trim()) {
            return toast.error("Il nome non può essere vuoto.");
        }
        onSave({ name: name.trim() });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-2xl w-full max-w-md flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
                </div>
                <div className="p-6">
                    <label className="text-sm font-bold text-gray-600 block mb-1">{label}</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" />
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300">Annulla</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Salva</button>
                </div>
            </div>
        </div>
    );
}