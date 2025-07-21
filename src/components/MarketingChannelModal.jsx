import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MarketingChannelModal({ isOpen, onClose, onSave, initialData, categories }) {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');

    useEffect(() => {
        if (initialData) {
            setName(initialData.name || '');
            setCategoryId(initialData.categoryId || '');
        } else {
            setName('');
            setCategoryId('');
        }
    }, [initialData]);

    if (!isOpen) return null;

    const handleSave = () => {
        if (!name.trim() || !categoryId) {
            return toast.error("Per favore, compila sia il nome che la categoria.");
        }
        onSave({ name: name.trim(), categoryId });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800">{initialData ? 'Modifica Canale di Marketing' : 'Nuovo Canale di Marketing'}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-bold text-gray-600 block mb-1">Nome Canale</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-600 block mb-1">Categoria di Appartenenza</label>
                        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full p-2 border rounded-md bg-white">
                            <option value="">Seleziona una categoria</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">Annulla</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Salva</button>
                </div>
            </div>
        </div>
    );
}