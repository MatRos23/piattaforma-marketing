import React, { useState, useEffect } from 'react';

export default function UserPermissionsModal({ isOpen, onClose, onSave, userData, channels }) {
    const [assignedChannels, setAssignedChannels] = useState([]);
    // NUOVO: Stato per il ruolo
    const [role, setRole] = useState('collaborator');

    useEffect(() => {
        if (userData) {
            setAssignedChannels(userData.assignedChannels || []);
            setRole(userData.role || 'collaborator'); // Imposta il ruolo corrente
        }
    }, [userData]);

    if (!isOpen) return null;

    const handleToggle = (channelId) => {
        setAssignedChannels(prev =>
            prev.includes(channelId)
                ? prev.filter(id => id !== channelId)
                : [...prev, channelId]
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
                <div className="p-6 border-b"><h3 className="text-xl font-bold text-gray-800">Permessi per {userData.name}</h3></div>
                <div className="p-6 space-y-4">
                    {/* NUOVO: Selettore per il ruolo */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 block mb-2">Ruolo Utente</label>
                        <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
                            <option value="collaborator">Collaboratore</option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-bold text-gray-600 block mb-2">Canali Assegnati</label>
                        <div className="p-3 border rounded-lg max-h-60 overflow-y-auto space-y-2">
                            {channels.map(channel => (
                                <div key={channel.id} className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`channel-perm-${channel.id}`}
                                        checked={assignedChannels.includes(channel.id)}
                                        onChange={() => handleToggle(channel.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor={`channel-perm-${channel.id}`} className="ml-3 text-sm text-gray-700">{channel.name}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold">Annulla</button>
                    {/* MODIFICATO: Ora onSave passa anche il ruolo */}
                    <button onClick={() => onSave(userData.id, assignedChannels, role)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-semibold">Salva Permessi</button>
                </div>
            </div>
        </div>
    );
}