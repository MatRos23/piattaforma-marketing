import React, { useState } from 'react';
import { getApp } from 'firebase/app'; // <-- IMPORT MANCANTE
import { getFunctions, httpsCallable } from "firebase/functions";
import toast from 'react-hot-toast';

export default function AddUserModal({ isOpen, onClose }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('collaborator');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleCreateUser = async () => {
        if (!name || !email || !password || password.length < 6) {
            setError('Tutti i campi sono obbligatori e la password deve essere di almeno 6 caratteri.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            // Specifichiamo la regione qui per essere sicuri
            const functions = getFunctions(getApp(), 'europe-west1');
            const createUser = httpsCallable(functions, 'createUserAccount');
            const result = await createUser({ name, email, password, role });
            
            toast.success(result.data.message);
            onClose(); // Chiude la modale in caso di successo
        } catch (err) {
            console.error("Errore dalla cloud function:", err);
            setError(err.message || 'Si è verificato un errore.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b"><h3 className="text-xl font-bold text-gray-800">Aggiungi Nuovo Utente</h3></div>
                <div className="p-6 space-y-4">
                    {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-center">{error}</p>}
                    <div><label className="text-sm font-bold text-gray-600 block mb-2">Nome Completo</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg"/></div>
                    <div><label className="text-sm font-bold text-gray-600 block mb-2">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg"/></div>
                    <div><label className="text-sm font-bold text-gray-600 block mb-2">Password (min. 6 caratteri)</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg"/></div>
                    <div>
                        <label className="text-sm font-bold text-gray-600 block mb-2">Ruolo</label>
                        <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
                            <option value="collaborator">Collaboratore</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                    <button type="button" onClick={onClose} disabled={loading} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 font-semibold disabled:opacity-50">Annulla</button>
                    <button onClick={handleCreateUser} disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-semibold disabled:bg-indigo-300">
                        {loading ? 'Creazione...' : 'Crea Utente'}
                    </button>
                </div>
            </div>
        </div>
    );
}