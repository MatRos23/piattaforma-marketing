import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddUserModal({ isOpen, onClose, onSave }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('collaborator');

    const handleSave = () => {
        if (!name.trim() || !email.trim() || !password.trim()) {
            return toast.error("Tutti i campi sono obbligatori.");
        }
        if (password.length < 6) {
            return toast.error("La password deve essere di almeno 6 caratteri.");
        }
        onSave({ name, email, password, role });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 transition-opacity duration-300">
            <div className="bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] border border-white/30">
                <div className="p-5 border-b border-gray-200/80 flex justify-between items-center flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-slate-700 to-gray-900 text-white">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Nuovo Utente</h3>
                            <p className="text-sm text-gray-500 font-medium">Inserisci i dati per creare un nuovo account</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"><X /></button>
                </div>
                
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Nome Completo</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-slate-500 focus:ring-4 focus:ring-slate-500/20 transition-all" 
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Email</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-slate-500 focus:ring-4 focus:ring-slate-500/20 transition-all" 
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 block mb-1">Password</label>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            className="w-full h-11 px-3 bg-white border-2 border-gray-200 rounded-xl focus:border-slate-500 focus:ring-4 focus:ring-slate-500/20 transition-all" 
                            placeholder="Minimo 6 caratteri" 
                        />
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
                        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl bg-white text-gray-800 font-semibold border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all">Annulla</button>
                        <button 
                            type="button" 
                            onClick={handleSave} 
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white font-bold hover:shadow-lg transition-all"
                        >
                            Crea Utente
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}