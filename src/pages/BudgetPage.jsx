import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, writeBatch, doc } from 'firebase/firestore';
import { ChevronDown, ChevronRight, Layers, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BudgetPage() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [channels, setChannels] = useState([]);
    const [budgets, setBudgets] = useState({});
    const [collapsed, setCollapsed] = useState({});

    // Carica le definizioni di settori, filiali e canali
    useEffect(() => {
        const unsubSectors = onSnapshot(collection(db, "sectors"), snap => setSectors(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubBranches = onSnapshot(collection(db, "branches"), snap => setBranches(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubChannels = onSnapshot(collection(db, "channels"), snap => setChannels(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubSectors(); unsubBranches(); unsubChannels(); };
    }, []);

    // Carica i budget per l'anno selezionato
    useEffect(() => {
        if (!year) return;
        const q = query(collection(db, "budgets"), where("year", "==", year));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedBudgets = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const key = `${data.sectorId}-${data.branchId}-${data.channelId}`;
                loadedBudgets[key] = { id: doc.id, ...data };
            });
            setBudgets(loadedBudgets);
        });
        return () => unsubscribe();
    }, [year]);

    // NUOVO: Effect per impostare lo stato iniziale di collasso
    useEffect(() => {
        const initialState = {};
        sectors.forEach(s => initialState[s.id] = true);
        branches.forEach(b => initialState[b.id] = true);
        setCollapsed(initialState);
    }, [sectors, branches]); // Si attiva quando settori e filiali sono caricati

    // Gestisce lo stato di apertura/chiusura delle sezioni
    const toggleCollapse = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

    // ... il resto delle funzioni (invariato) ...
    const handleBudgetChange = (sectorId, branchId, channelId, field, value) => { const numericValue = parseFloat(value.replace(/[^0-9,]/g, '').replace(',', '.')) || 0; const key = `${sectorId}-${branchId}-${channelId}`; setBudgets(prev => ({ ...prev, [key]: { ...prev[key], [field]: numericValue, year, sectorId, branchId, channelId } })); };
    const handleSaveBudgets = async () => { const batch = writeBatch(db); for (const key in budgets) { const budget = budgets[key]; if ((budget.plannedAmount > 0 || budget.maxAmount > 0) || budget.id) { const { id, ...dataToSave } = budget; const ref = id ? doc(db, "budgets", id) : doc(collection(db, "budgets")); batch.set(ref, dataToSave, { merge: true }); } } await batch.commit(); toast.success('Budget salvati con successo!'); };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Gestione Budget</h1>
                <div className="flex items-center gap-4">
                    <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="p-2 border border-gray-300 rounded-lg font-semibold">
                        {[1, 0, -1].map(offset => <option key={offset}>{new Date().getFullYear() + offset}</option>)}
                    </select>
                    <button onClick={handleSaveBudgets} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
                        Salva Tutti i Budget
                    </button>
                </div>
            </div>

            <div className="space-y-8">
                {sectors.map(sector => (
                    <div key={sector.id} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                        <button onClick={() => toggleCollapse(sector.id)} className="w-full flex justify-between items-center text-left text-2xl font-bold text-gray-800">
                            <span className="flex items-center gap-2"><Layers /> {sector.name}</span>
                            {collapsed[sector.id] ? <ChevronRight/> : <ChevronDown/>}
                        </button>
                        {!collapsed[sector.id] && (
                            <div className="space-y-6 mt-4 pl-4 border-l-2">
                                {branches.filter(b => b.associatedSectors?.includes(sector.id)).map(branch => (
                                    <div key={branch.id}>
                                        <button onClick={() => toggleCollapse(branch.id)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-700">
                                            <span className="flex items-center gap-2"><Building2 size={18} /> {branch.name}</span>
                                            {collapsed[branch.id] ? <ChevronRight/> : <ChevronDown/>}
                                        </button>
                                        {!collapsed[branch.id] && (
                                            <ul className="space-y-3 mt-2 pl-4 border-l-2 border-indigo-100">
                                                {channels.filter(c => c.associatedSectors?.includes(sector.id) && c.associatedBranches?.includes(branch.id)).map(channel => {
                                                    const budgetKey = `${sector.id}-${branch.id}-${channel.id}`;
                                                    const currentBudget = budgets[budgetKey] || {};
                                                    return (
                                                        <li key={channel.id}>
                                                            <label className="font-medium text-gray-600">{channel.name}</label>
                                                            <div className="grid grid-cols-2 gap-4 mt-1 max-w-md">
                                                                <div className="relative">
                                                                    <input type="text" placeholder="Pianificato" value={currentBudget.plannedAmount?.toLocaleString('it-IT') || ''} onChange={e => handleBudgetChange(sector.id, branch.id, channel.id, 'plannedAmount', e.target.value)} className="w-full p-2 pr-6 border border-gray-300 rounded-lg text-right" />
                                                                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">€</span>
                                                                </div>
                                                                <div className="relative">
                                                                    <input type="text" placeholder="Massimo" value={currentBudget.maxAmount?.toLocaleString('it-IT') || ''} onChange={e => handleBudgetChange(sector.id, branch.id, channel.id, 'maxAmount', e.target.value)} className="w-full p-2 pr-6 border border-gray-300 rounded-lg text-right" />
                                                                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-500">€</span>
                                                                </div>
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}