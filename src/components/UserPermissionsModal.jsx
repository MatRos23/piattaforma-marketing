import React, { useState, useEffect } from 'react';
import { X, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UserPermissionsModal({ isOpen, onClose, onSave, userData }) {
    const [role, setRole] = useState('');

    useEffect(() => {
        if (isOpen && userData) {
            setRole(userData.role || 'collaborator');
        }
    }, [isOpen, userData]);

    if (!isOpen || !userData) return null;

    const handleSave = () => {
        onSave(userData.id, { role });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity duration-300">
            <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] border border-white/30">
                <div className="p-5 border-b border-gray-200/80 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-slate-700 to-gray-900 text-white">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Modifica Ruolo Utente</h3>
                            <p className="text-sm text-gray-500 font-medium">Assegna i permessi corretti all'utente</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"><X /></button>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-200/80">
                        <p className="text-sm text-gray-500">Stai modificando l'utente:</p>
                        <p className="font-semibold text-gray-800 text-lg">{userData.name}</p>
                        <p className="text-sm text-gray-600">{userData.email}</p>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Ruolo</label>
                        <select 
                            value={role} 
                            onChange={(e) => setRole(e.target.value)} 
                            className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-slate-500 focus:ring-4 focus:ring-slate-500/20 transition-all"
                        >
                            <option value="collaborator">Collaborator</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>

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