import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';

export default function AssociationModal({ isOpen, onClose, onSave, initialData, title, itemLabel, associationLists = [], channelCategories = [] }) {
    const [name, setName] = useState('');
    const [associations, setAssociations] = useState({});
    const [category, setCategory] = useState(''); // Aggiunto per gestire la categoria del fornitore

    useEffect(() => {
        if (isOpen) {
            setName(initialData?.name || '');
            setCategory(initialData?.category || ''); // Inizializza la categoria
            const initialAssociations = {};
            associationLists.forEach(list => {
                initialAssociations[list.key] = initialData?.[list.key] || [];
            });
            setAssociations(initialAssociations);
        }
    }, [isOpen, initialData, associationLists]);

    const groupedMarketingChannels = useMemo(() => {
        const marketingChannelList = associationLists.find(l => l.key === 'offeredMarketingChannels');
        if (!marketingChannelList) return null;

        return channelCategories.map(cat => ({
            name: cat.name,
            channels: marketingChannelList.items.filter(channel => channel.categoryId === cat.id)
        })).filter(group => group.channels.length > 0);
    }, [associationLists, channelCategories]);

    if (!isOpen) return null;

    const handleSave = () => {
        const formData = { ...associations };
        if (itemLabel.includes("Nome")) {
            formData.name = name;
        }
        // Aggiungi la categoria al salvataggio solo se stiamo modificando un fornitore
        if (title.toLowerCase().includes('fornitore')) {
            formData.category = category;
        }
        onSave(formData);
    };

    const handleAssociationChange = (key, itemId) => {
        setAssociations(prev => {
            const currentList = prev[key] || [];
            const newList = currentList.includes(itemId)
                ? currentList.filter(id => id !== itemId)
                : [...currentList, itemId];
            return { ...prev, [key]: newList };
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {itemLabel.includes("Nome") && (
                        <div>
                            <label className="text-sm font-bold text-gray-600 block mb-1">{itemLabel}</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-md" />
                        </div>
                    )}
                    
                    {title.toLowerCase().includes('fornitore') && (
                         <div>
                            <label className="text-sm font-bold text-gray-600 block mb-1">Categoria Fornitore</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-2 border rounded-md bg-white">
                                <option value="">Seleziona Categoria</option>
                                {channelCategories.map(cat => (
                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {associationLists.map(list => (
                        <div key={list.key}>
                            <h4 className="text-md font-bold text-gray-700 mb-2">{list.label}</h4>
                            {list.key === 'offeredMarketingChannels' && groupedMarketingChannels ? (
                                <div className="space-y-4">
                                    {groupedMarketingChannels.map(group => (
                                        <div key={group.name} className="p-3 bg-gray-50 rounded-lg border">
                                            <p className="font-semibold text-gray-600 text-sm mb-2">{group.name}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {group.channels.map(item => {
                                                    const isChecked = associations[list.key]?.includes(item.id) || false;
                                                    return (
                                                        <div key={item.id}>
                                                            <input type="checkbox" id={`${list.key}-${item.id}`} checked={isChecked} onChange={() => handleAssociationChange(list.key, item.id)} className="sr-only"/>
                                                            <label htmlFor={`${list.key}-${item.id}`} className={`px-3 py-1 text-sm rounded-full border cursor-pointer transition-colors ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white hover:bg-gray-200'}`}>{item.name}</label>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {list.items.map(item => {
                                        const isChecked = associations[list.key]?.includes(item.id) || false;
                                        return (
                                            <div key={item.id}>
                                                <input type="checkbox" id={`${list.key}-${item.id}`} checked={isChecked} onChange={() => handleAssociationChange(list.key, item.id)} className="sr-only"/>
                                                <label htmlFor={`${list.key}-${item.id}`} className={`px-3 py-1 text-sm rounded-full border cursor-pointer transition-colors ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white hover:bg-gray-200'}`}>{item.name}</label>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">Annulla</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Salva Associazioni</button>
                </div>
            </div>
        </div>
    );
}