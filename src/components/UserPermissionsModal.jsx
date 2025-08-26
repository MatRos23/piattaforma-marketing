import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-2xl w-full max-w-md flex flex-col">
                <div className="p-6 border-b flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-800">Modifica Ruolo Utente</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <p className="text-sm text-gray-500">Utente</p>
                        <p className="font-semibold text-gray-800">{userData.name} ({userData.email})</p>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-600 block mb-1">Ruolo</label>
                        <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition">
                            <option value="collaborator">Collaborator</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl border-t">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300">Annulla</button>
                    <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Salva Modifiche</button>
                </div>
            </div>
        </div>
    );
}