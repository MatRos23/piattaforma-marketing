import React, { useState, useEffect } from 'react';
import { X, Users, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function UserPermissionsModal({ isOpen, onClose, onSave, userData }) {
    const [role, setRole] = useState('');
    const [assignedChannels, setAssignedChannels] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);

    useEffect(() => {
        if (isOpen && userData) {
            setRole(userData.role || 'collaborator');
            setAssignedChannels(userData.assignedChannels || []);
        }
    }, [isOpen, userData]);

    // Carica la lista fornitori
    useEffect(() => {
        if (isOpen) {
            setLoadingSuppliers(true);
            const unsubscribe = onSnapshot(
                query(collection(db, 'channels'), orderBy('name')),
                (snapshot) => {
                    const suppliersList = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setSuppliers(suppliersList);
                    setLoadingSuppliers(false);
                },
                (error) => {
                    console.error("Errore caricamento fornitori:", error);
                    toast.error("Errore nel caricamento dei fornitori");
                    setLoadingSuppliers(false);
                }
            );

            return () => unsubscribe();
        }
    }, [isOpen]);

    const handleSave = () => {
        // Se il ruolo non è collaborator, svuota assignedChannels
        const dataToSave = {
            role,
            assignedChannels: role === 'collaborator' ? assignedChannels : []
        };
        onSave(userData.id, dataToSave);
    };

    const toggleChannel = (channelId) => {
        setAssignedChannels(prev =>
            prev.includes(channelId)
                ? prev.filter(id => id !== channelId)
                : [...prev, channelId]
        );
    };

    const selectAllChannels = () => {
        setAssignedChannels(suppliers.map(s => s.id));
    };

    const deselectAllChannels = () => {
        setAssignedChannels([]);
    };

    if (!isOpen || !userData) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity duration-300">
            <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-white/30">
                {/* Header */}
                <div className="p-5 border-b border-gray-200/80 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-slate-700 to-gray-900 text-white">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Modifica Permessi Utente</h3>
                            <p className="text-sm text-gray-500 font-medium">Gestisci ruolo e accessi</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                        <X />
                    </button>
                </div>
                
                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    {/* Info Utente */}
                    <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-200/80">
                        <p className="text-sm text-gray-500">Stai modificando l'utente:</p>
                        <p className="font-semibold text-gray-800 text-lg">{userData.name}</p>
                        <p className="text-sm text-gray-600">{userData.email}</p>
                    </div>

                    {/* Ruolo */}
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-2">Ruolo</label>
                        <select 
                            value={role} 
                            onChange={(e) => setRole(e.target.value)} 
                            className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-slate-500 focus:ring-4 focus:ring-slate-500/20 transition-all"
                        >
                            <option value="collaborator">Collaborator</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                            {role === 'admin' && '• Accesso completo a tutte le funzionalità'}
                            {role === 'manager' && '• Può visualizzare e gestire tutte le spese e contratti'}
                            {role === 'collaborator' && '• Accesso limitato ai fornitori assegnati'}
                        </p>
                    </div>

                    {/* Fornitori Assegnati - Solo per Collaborator */}
                    {role === 'collaborator' && (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4" />
                                    Fornitori Assegnati ({assignedChannels.length})
                                </label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllChannels}
                                        className="text-xs font-semibold text-slate-600 hover:text-slate-800 underline"
                                    >
                                        Seleziona tutti
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        type="button"
                                        onClick={deselectAllChannels}
                                        className="text-xs font-semibold text-slate-600 hover:text-slate-800 underline"
                                    >
                                        Deseleziona tutti
                                    </button>
                                </div>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-3">
                                Seleziona i fornitori a cui questo collaboratore avrà accesso
                            </p>
                            
                            {loadingSuppliers ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-8 h-8 border-4 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : suppliers.length === 0 ? (
                                <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                                    <p className="text-sm text-amber-800 font-medium">
                                        ⚠️ Nessun fornitore disponibile. Aggiungili dalla pagina Impostazioni.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-64 overflow-y-auto border-2 border-gray-200 rounded-xl p-3 bg-gray-50/30">
                                    {suppliers.map(supplier => (
                                        <label
                                            key={supplier.id}
                                            className="flex items-center gap-3 p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-slate-400 hover:bg-slate-50/50 cursor-pointer transition-all"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={assignedChannels.includes(supplier.id)}
                                                onChange={() => toggleChannel(supplier.id)}
                                                className="w-5 h-5 text-slate-600 border-gray-300 rounded focus:ring-2 focus:ring-slate-500"
                                            />
                                            <span className="font-medium text-gray-800">{supplier.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {assignedChannels.length === 0 && !loadingSuppliers && suppliers.length > 0 && (
                                <div className="mt-3 p-3 bg-red-50 border-2 border-red-200 rounded-xl">
                                    <p className="text-sm text-red-800 font-medium">
                                        ⚠️ Attenzione: senza fornitori assegnati, l'utente non potrà visualizzare alcun dato
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Info per Manager/Admin */}
                    {role !== 'collaborator' && (
                        <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                            <p className="text-sm text-blue-800 font-medium">
                                ℹ️ Manager e Admin hanno accesso automatico a tutti i fornitori
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 bg-gray-50/70 flex justify-end items-center rounded-b-2xl border-t border-gray-200/80 flex-shrink-0">
                    <div className="flex gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-5 py-2.5 rounded-xl bg-white text-gray-800 font-semibold border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all"
                        >
                            Annulla
                        </button>
                        <button 
                            type="button" 
                            onClick={handleSave} 
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold hover:shadow-lg transition-all"
                        >
                            Salva Modifiche
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}