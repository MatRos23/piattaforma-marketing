import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

// Nuova palette di colori predefinita ed elegante
const COLOR_PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#9CA3AF'];

export default function SimpleAddModal({ isOpen, onClose, onSave, initialData, type }) {
    const [name, setName] = useState('');
    const [color, setColor] = useState(COLOR_PALETTE[0]);

    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
            setColor(initialData?.color || COLOR_PALETTE[0]);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const getTitleAndLabel = () => {
        const isEditing = !!initialData;
        switch (type) {
            case 'sector': return { title: isEditing ? 'Modifica Settore' : 'Nuovo Settore', label: 'Nome Settore' };
            case 'category': return { title: isEditing ? 'Modifica Categoria' : 'Nuova Categoria', label: 'Nome Categoria' };
            case 'area': return { title: isEditing ? 'Modifica Area' : 'Nuova Area', label: 'Nome Area Geografica' };
            default: return { title: 'Aggiungi/Modifica', label: 'Nome' };
        }
    };

    const { title, label } = getTitleAndLabel();

    const handleSave = () => {
        if (!name.trim()) {
            return toast.error("Il nome non può essere vuoto.");
        }
        const dataToSave = type === 'sector' ? { name: name.trim(), color } : { name: name.trim() };
        onSave(dataToSave);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-bold text-gray-600 block mb-1">{label}</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-md" />
                    </div>
                    {type === 'sector' && (
                        <div>
                            <label className="text-sm font-bold text-gray-600 block mb-1">Colore Associato</label>
                            <div className="flex items-center gap-2 pt-2">
                                {COLOR_PALETTE.map(c => (
                                    <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`} style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">Annulla</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Salva</button>
                </div>
            </div>
        </div>
    );
}