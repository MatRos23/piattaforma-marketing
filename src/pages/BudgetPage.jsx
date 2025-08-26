import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs, orderBy } from 'firebase/firestore';
import { PlusCircle, Trash2, X, DollarSign, Target, SlidersHorizontal, ChevronDown, Layers, Search, XCircle, Car, Sailboat, Caravan, Building2, Lightbulb, AlertTriangle, ArrowUpCircle, ArrowDownCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '../components/EmptyState';

// --- COMPONENTI UI ---

const KpiCard = ({ title, value, icon }) => (
    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border flex items-center gap-4">
        <div className="bg-indigo-100 p-3 rounded-full">{icon}</div>
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const ProgressBar = ({ spend, budget, isUnexpected }) => {
    const budgetValue = budget || 0;
    const spendValue = spend || 0;

    if (isUnexpected) {
        const stripedStyle = {
            background: `repeating-linear-gradient(45deg, #fecaca, #fecaca 10px, #fca5a5 10px, #fca5a5 20px)`
        };
        return (
            <div className="w-full bg-gray-200 rounded-full h-5" title={`Spesa Extra: ${spendValue.toLocaleString('it-IT', {style:'currency', currency:'EUR'})}`}>
                {spendValue > 0 && <div className="h-5 rounded-full" style={stripedStyle}></div>}
            </div>
        );
    }
    
    const percentage = budgetValue > 0 ? (spendValue / budgetValue) * 100 : (spendValue > 0 ? 100 : 0);
    const getColor = () => {
        if (spendValue > budgetValue && budgetValue > 0) return 'bg-red-500';
        if (percentage > 85) return 'bg-amber-500';
        return 'bg-indigo-600';
    };

    return (
        <div className="w-full bg-gray-200 rounded-full h-5" title={`Spesa: ${spendValue.toLocaleString('it-IT', {style:'currency', currency:'EUR'})} | Budget: ${budgetValue.toLocaleString('it-IT', {style:'currency', currency:'EUR'})}`}>
            <div className={`h-5 rounded-full transition-all duration-500 ${getColor()}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
        </div>
    );
};

const TrendIndicator = ({ spend, budget, year, isUnexpected }) => {
    if (!budget || budget === 0) {
        if (spend > 0 && !isUnexpected) {
            return (
                <div className="flex items-center gap-1 text-sm font-semibold text-red-600" title="Spesa presente senza un budget impostato.">
                    <AlertTriangle size={16} />
                    <span>Fuori Budget</span>
                </div>
            );
        }
        return null;
    }

    const now = new Date();
    const start = new Date(year, 0, 1);
    const diff = now - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    const isLeap = new Date(year, 1, 29).getMonth() === 1;
    const daysInYear = isLeap ? 366 : 365;
    
    const expectedSpend = (budget / daysInYear) * dayOfYear;
    const difference = spend - expectedSpend;
    const tolerance = budget * 0.05;

    let color, Icon, text;

    if (difference < -tolerance) {
        color = 'text-green-600';
        Icon = ArrowUpCircle;
        text = 'In positivo';
    } else if (difference > tolerance) {
        color = 'text-red-600';
        Icon = ArrowDownCircle;
        text = 'In negativo';
    } else {
        color = 'text-amber-600';
        Icon = CheckCircle2;
        text = 'In linea';
    }

    const tooltipText = `Spesa attuale: ${spend.toLocaleString('it-IT', {style:'currency', currency:'EUR'})}\nSpesa prevista a oggi: ${expectedSpend.toLocaleString('it-IT', {style:'currency', currency:'EUR'})}\nDifferenza: ${difference.toLocaleString('it-IT', {style:'currency', currency:'EUR'})}`;

    return (
        <div className={`flex items-center gap-1 text-sm font-semibold ${color}`} title={tooltipText}>
            <Icon size={16} />
            <span>{text}</span>
        </div>
    );
};


const BudgetAllocationModal = ({ isOpen, onClose, onSave, supplier, year, initialAllocations, sectors, branches, marketingChannels }) => {
    const [allocations, setAllocations] = useState([]);
    const [isUnexpected, setIsUnexpected] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsUnexpected(supplier?.isUnexpected || false);
            const initialData = initialAllocations && initialAllocations.length > 0
                ? initialAllocations.map(a => ({ ...a, _key: Math.random() }))
                : [{ _key: Math.random(), marketingChannelId: '', sectorId: '', branchId: '', budgetAmount: 0 }];
            setAllocations(initialData);
        }
    }, [isOpen, initialAllocations, supplier]);

    if (!isOpen) return null;

    const handleAllocationChange = (index, field, value) => {
        const newAllocations = [...allocations];
        newAllocations[index][field] = value;
        if (field === 'sectorId') newAllocations[index]['branchId'] = '';
        setAllocations(newAllocations);
    };

    const addAllocation = () => {
        let newRow = { _key: Math.random(), marketingChannelId: '', sectorId: '', branchId: '', budgetAmount: 0 };
        if (supplier.associatedSectors?.length === 1) {
            newRow.sectorId = supplier.associatedSectors[0];
            const availableBranches = branches.filter(b => b.associatedSectors?.includes(newRow.sectorId));
            if (availableBranches.length === 1) newRow.branchId = availableBranches[0].id;
        }
        setAllocations([...allocations, newRow]);
    };

    const removeAllocation = (index) => {
        if (allocations.length <= 1) return toast.error("Deve esserci almeno una riga di budget.");
        setAllocations(allocations.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        const allocationsToSave = allocations.map(({ _key, ...rest }) => ({
            ...rest,
            budgetAmount: parseFloat(String(rest.budgetAmount || '0').replace(',', '.')) || 0
        }));
        onSave(allocationsToSave, isUnexpected);
    };

    const totalBudget = allocations.reduce((sum, alloc) => sum + (parseFloat(String(alloc.budgetAmount || '0').replace(',', '.')) || 0), 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-center"><h3 className="text-xl font-bold text-gray-800">Gestione Budget per {supplier.name} ({year})</h3><button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X /></button></div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={isUnexpected} onChange={e => setIsUnexpected(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" /><span className="font-semibold text-amber-800">Fornitore Inatteso (non previsto nel piano marketing iniziale)</span></label></div>
                    <div className="space-y-3">
                        {allocations.map((alloc, index) => {
                             const filteredBranches = branches.filter(b => b.associatedSectors?.includes(alloc.sectorId));
                             const isSectorPreselected = supplier.associatedSectors?.length === 1;
                             const isBranchPreselected = isSectorPreselected && filteredBranches.length === 1;

                            return (
                                <div key={alloc._key} className="p-4 bg-gray-50 rounded-lg grid grid-cols-1 md:grid-cols-10 gap-3 items-center">
                                    <div className="md:col-span-3"><label className="text-xs font-bold text-gray-500">Canale Marketing</label><select value={alloc.marketingChannelId} onChange={e => handleAllocationChange(index, 'marketingChannelId', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white"><option value="">Seleziona Canale</option>{marketingChannels.filter(mc => supplier.offeredMarketingChannels?.includes(mc.id)).map(mc => <option key={mc.id} value={mc.id}>{mc.name}</option>)}</select></div>
                                    <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500">Settore</label><select value={alloc.sectorId} onChange={e => handleAllocationChange(index, 'sectorId', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white" disabled={isSectorPreselected}><option value="">Seleziona Settore</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                                    <div className="md:col-span-3"><label className="text-xs font-bold text-gray-500">Filiale</label><select value={alloc.branchId} onChange={e => handleAllocationChange(index, 'branchId', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white" disabled={!alloc.sectorId || isBranchPreselected}><option value="">Seleziona Filiale</option>{filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                                    <div className="md:col-span-1"><label className="text-xs font-bold text-gray-500">Budget (€)</label><input type="number" value={alloc.budgetAmount} onChange={e => handleAllocationChange(index, 'budgetAmount', e.target.value)} className="w-full mt-1 p-2 border rounded-md" placeholder="0.00" /></div>
                                    <div className="md:col-span-1 flex items-center justify-center pt-5"><button onClick={() => removeAllocation(index)} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={18} /></button></div>
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={addAllocation} className="text-indigo-600 font-semibold flex items-center gap-2 mt-4"><PlusCircle size={16} /> Aggiungi Riga</button>
                </div>
                <div className="p-6 bg-gray-50 flex justify-between items-center rounded-b-2xl">
                    <div className="text-xl font-bold">Totale Budget: <span className="text-indigo-600">{totalBudget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span></div>
                    <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">Salva Budget</button>
                </div>
            </div>
        </div>
    );
};


const getSectorIcon = (sectorName, customClassName) => {
    const finalClassName = customClassName || "w-4 h-4 text-gray-400";
    const icons = { 'Auto': <Car className={finalClassName} />, 'Camper&Caravan': <Caravan className={finalClassName} />, 'Yachting': <Sailboat className={finalClassName} />, 'Frattin Group': <Building2 className={finalClassName} />, 'default': <DollarSign className={finalClassName} /> };
    return icons[sectorName] || icons.default;
};

// --- COMPONENTE PRINCIPALE ---
export default function BudgetPage() {
    // --- STATI ---
    const [year, setYear] = useState(new Date().getFullYear());
    const [suppliers, setSuppliers] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [selectedSector, setSelectedSector] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSuppliers, setExpandedSuppliers] = useState({});

    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const marketingChannelMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.name])), [marketingChannels]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);

    // --- CARICAMENTO DATI ---
    useEffect(() => {
        const unsubs = [
            onSnapshot(query(collection(db, "channels"), orderBy("name")), snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), snap => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "marketing_channels"), orderBy("name")), snap => setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))))
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    useEffect(() => {
        if (!year) return;
        setIsLoading(true);
        const budgetQuery = query(collection(db, "budgets"), where("year", "==", year));
        const expensesQuery = query(collection(db, "expenses"), where("date", ">=", `${year}-01-01`), where("date", "<=", `${year}-12-31`));
        
        const unsubBudget = onSnapshot(budgetQuery, snap => {
            const cleanedBudgets = snap.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id, supplierId: data.supplierId };
            });
            setBudgets(cleanedBudgets);
        });
        
        const unsubExpenses = onSnapshot(expensesQuery, snap => {
            const cleanedExpenses = snap.docs.map(doc => {
                const data = doc.data();
                const id = doc.id;
                // Logica di normalizzazione presa da ExpensesPage per coerenza
                let lineItems = [];
                if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
                    lineItems = data.lineItems.map((item, itemIndex) => ({
                        ...item,
                        marketingChannelId: item.marketingChannelId || '',
                        assignmentId: item.assignmentId || data.branchId || '',
                    }));
                } else {
                    lineItems.push({
                        description: data.description || 'Voce principale',
                        amount: data.amount || 0,
                        marketingChannelId: data.marketingChannelId || '',
                        assignmentId: data.branchId || '',
                    });
                }
                return { ...data, id, supplierId: data.supplierId || data.channelId, sectorId: data.sectorId, lineItems };
            });
            setExpenses(cleanedExpenses);
            setIsLoading(false);
        });
        return () => { unsubBudget(); unsubExpenses(); };
    }, [year]);

    // --- LOGICA DI CALCOLO ---
    const supplierData = useMemo(() => {
        const genericoBranch = branches.find(b => b.name.toLowerCase() === 'generico');
        const realBranches = branches.filter(b => b.id !== genericoBranch?.id);
        const sectorToBranchesMap = new Map();
        sectors.forEach(sector => {
            const sectorBranches = realBranches.filter(b => b.associatedSectors?.includes(sector.id));
            sectorToBranchesMap.set(sector.id, sectorBranches);
        });
        const frattinGroupSector = sectors.find(s => s.name === 'Frattin Group');

        const getSpendForAllocation = (alloc, supplierId) => {
            return expenses
                .filter(expense => expense.supplierId === supplierId && expense.sectorId === alloc.sectorId)
                .reduce((totalSum, expense) => {
                    const expenseSum = (expense.lineItems || []).reduce((itemSum, item) => {
                        if (item.marketingChannelId !== alloc.marketingChannelId) return itemSum;
                        
                        const itemAmount = item.amount || 0;
                        const targetBranchId = alloc.branchId;
                        const itemBranchId = item.assignmentId;

                        if (itemBranchId === targetBranchId) {
                            return itemSum + itemAmount;
                        }
                        
                        if (itemBranchId === genericoBranch?.id) {
                            let targetBranches = (expense.sectorId === frattinGroupSector?.id) ? realBranches : (sectorToBranchesMap.get(expense.sectorId) || []);
                            if (targetBranches.some(b => b.id === targetBranchId)) {
                                 if (targetBranches.length > 0) return itemSum + (itemAmount / targetBranches.length);
                            }
                        }
                        return itemSum;
                    }, 0);
                    return totalSum + expenseSum;
                }, 0);
        };

        let filteredSuppliers = suppliers;
        if (searchTerm.trim() !== '') filteredSuppliers = filteredSuppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
        if (selectedSector !== 'all') filteredSuppliers = filteredSuppliers.filter(s => s.associatedSectors?.includes(selectedSector));

        const processedData = filteredSuppliers.map(supplier => {
            const budgetDoc = budgets.find(b => b.supplierId === supplier.id);
            const allAllocations = budgetDoc?.allocations || [];

            const details = allAllocations.map(alloc => {
                const detailedSpend = getSpendForAllocation(alloc, supplier.id);
                const branchName = branchMap.get(alloc.branchId) || 'N/D';
                let name = `${marketingChannelMap.get(alloc.marketingChannelId) || 'N/D'} - ${branchName}`;
                return { ...alloc, totalSpend: detailedSpend, name, sectorId: alloc.sectorId };
            });
            
            const totalBudget = details.reduce((sum, d) => sum + (d.budgetAmount || 0), 0);
            const totalSpend = expenses
                .filter(e => e.supplierId === supplier.id && (selectedSector === 'all' || e.sectorId === selectedSector))
                .reduce((sum, e) => sum + e.amount, 0);

            return { ...supplier, totalBudget, totalSpend, details, isUnexpected: budgetDoc?.isUnexpected || false };
        });

        const plannedSuppliers = processedData.filter(s => !s.isUnexpected);
        const unexpectedSuppliers = processedData.filter(s => s.isUnexpected);

        return { plannedSuppliers, unexpectedSuppliers };

    }, [suppliers, budgets, expenses, selectedSector, searchTerm, branches, sectors, branchMap, marketingChannelMap, sectorMap]);
    
    const globalKpis = useMemo(() => {
        const allSuppliers = [...supplierData.plannedSuppliers, ...supplierData.unexpectedSuppliers];
        const totalSpend = allSuppliers.reduce((sum, item) => sum + item.totalSpend, 0);
        const totalBudget = allSuppliers.reduce((sum, item) => sum + item.totalBudget, 0);
        return { totalSpend, totalBudget };
    }, [supplierData]);
    
    // --- HANDLERS ---
    const handleOpenModal = (supplier) => {
        const budgetDoc = budgets.find(b => b.supplierId === supplier.id);
        setSelectedSupplier({...supplier, allocations: budgetDoc?.allocations || [], isUnexpected: budgetDoc?.isUnexpected || false });
        setIsModalOpen(true);
    };
    const handleCloseModal = () => { setIsModalOpen(false); setSelectedSupplier(null); };
    const toggleSupplier = (supplierId) => {
        const supplier = [...supplierData.plannedSuppliers, ...supplierData.unexpectedSuppliers].find(s => s.id === supplierId);
        if (supplier?.details.length > 1) {
            setExpandedSuppliers(prev => ({...prev, [supplierId]: !prev[supplierId]}));
        }
    };
    const handleSaveBudget = async (allocations, isUnexpected) => {
        if (!selectedSupplier || !year) return;
        const toastId = toast.loading("Salvataggio budget in corso...");
        try {
            const budgetQuery = query(collection(db, "budgets"), where("year", "==", year), where("supplierId", "==", selectedSupplier.id));
            const existingDocs = await getDocs(budgetQuery);
            const dataToSave = { year, supplierId: selectedSupplier.id, allocations, isUnexpected, updatedAt: serverTimestamp() };
            if (existingDocs.empty) {
                const newDocRef = doc(collection(db, "budgets"));
                await writeBatch(db).set(newDocRef, { ...dataToSave, createdAt: serverTimestamp() }).commit();
            } else {
                const docRef = existingDocs.docs[0].ref;
                await writeBatch(db).update(docRef, dataToSave).commit();
            }
            toast.success("Budget salvato con successo!", { id: toastId });
            handleCloseModal();
        } catch (error) {
            console.error("Errore nel salvataggio del budget:", error);
            toast.error("Errore durante il salvataggio.", { id: toastId });
        }
    };
    const resetFilters = () => { setSearchTerm(''); setSelectedSector('all'); toast.success("Filtri resettati!"); };

    // --- RENDER ---
    const renderSupplierList = (list) => (
        list.map(item => (
            <div key={item.id} className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border overflow-hidden transition-all duration-300">
                <div className={`p-4 flex flex-col gap-4 ${item.details.length > 1 ? 'cursor-pointer hover:bg-gray-50' : ''}`} onClick={() => toggleSupplier(item.id)}>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            {item.details.length > 1 && (<div className="p-1"><ChevronDown className={`transition-transform duration-300 ${expandedSuppliers[item.id] ? 'rotate-180' : ''}`} /></div>)}
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-bold text-gray-800">{item.name}</h3>
                                    {(item.associatedSectors || []).map(sectorId => (
                                        <span key={sectorId} title={sectorMap.get(sectorId)}>
                                            {getSectorIcon(sectorMap.get(sectorId), "w-5 h-5 text-gray-400")}
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-1">
                                    <TrendIndicator spend={item.totalSpend} budget={item.totalBudget} year={year} isUnexpected={item.isUnexpected} />
                                </div>
                            </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(item); }} className="text-sm text-indigo-600 font-semibold flex items-center gap-1.5 hover:text-indigo-800 flex-shrink-0"><SlidersHorizontal size={14}/> Gestisci</button>
                    </div>
                     <div className="space-y-2 pl-1">
                        <ProgressBar spend={item.totalSpend} budget={item.totalBudget} isUnexpected={item.isUnexpected} />
                        <div className="flex justify-between text-xs font-medium text-gray-500">
                            <span className="flex items-center gap-1">Speso: <span className="font-bold text-gray-700">{item.totalSpend.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
                                {item.totalSpend > item.totalBudget && item.totalBudget > 0 && !item.isUnexpected && <AlertTriangle className="w-4 h-4 text-red-500" title="Spesa superiore al budget"/>}
                            </span>
                            <span>Budget: <span className="font-bold text-gray-700">{item.totalBudget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span></span>
                        </div>
                    </div>
                </div>
                {expandedSuppliers[item.id] && (
                    <div className="pl-12 pr-4 pb-4 space-y-3">
                        <div className="border-t pt-3 mt-3">
                            {item.details.map((detail, index) => (
                                <div key={index} className="p-3 bg-gray-50 rounded-lg mb-2">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            {getSectorIcon(sectorMap.get(detail.sectorId), "w-5 h-5 text-gray-500")}
                                            <p className="font-semibold text-sm text-gray-700">{detail.name}</p>
                                        </div>
                                        <TrendIndicator spend={detail.totalSpend} budget={detail.budgetAmount} year={year} isUnexpected={item.isUnexpected} />
                                    </div>
                                    <div className="mt-2 space-y-2">
                                        <ProgressBar spend={detail.totalSpend} budget={detail.budgetAmount} isUnexpected={item.isUnexpected} />
                                        <div className="flex justify-between text-xs font-medium text-gray-500">
                                            <span>Speso: <span className="font-bold text-gray-700">{(detail.totalSpend || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span></span>
                                            <span>Budget: <span className="font-bold text-gray-700">{(detail.budgetAmount || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        ))
    );

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-8"><h1 className="text-3xl font-bold text-gray-800">Gestione Budget</h1></div>
            <div className="mb-6 p-4 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="md:col-span-2"><label className="text-sm font-bold text-gray-600 block mb-1">Cerca Fornitore</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="Nome fornitore..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-11 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" /></div></div>
                    <div><label className="text-sm font-bold text-gray-600 block mb-1">Anno</label><select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition">{[2, 1, 0, -1, -2].map(offset => { const y = new Date().getFullYear() + offset; return <option key={y} value={y}>{y}</option>; })}</select></div>
                </div>
                <div className="border-t border-gray-200 !my-4"></div>
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-2 flex-wrap"><button onClick={() => setSelectedSector('all')} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-2 ${selectedSector === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}><Layers size={14} /> Tutti i Settori</button>
                        {sectors.map(sector => {
                            const isActive = selectedSector === sector.id;
                            const iconClassName = `w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`;
                            return (<button key={sector.id} onClick={() => setSelectedSector(sector.id)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-2 ${isActive ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}>{getSectorIcon(sector.name, iconClassName)}{sector.name}</button>);
                        })}
                    </div>
                    <button onClick={resetFilters} className="text-sm font-semibold text-red-600 hover:text-red-800 transition flex items-center gap-2 bg-red-100 px-3 py-2 rounded-lg"><XCircle size={16} />Reset Filtri</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <KpiCard title="Spesa Totale Attuale" value={globalKpis.totalSpend.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} icon={<DollarSign className="w-6 h-6 text-indigo-600"/>} />
                <KpiCard title="Budget Totale Annuo" value={globalKpis.totalBudget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} icon={<Target className="w-6 h-6 text-indigo-600"/>} />
            </div>

            {isLoading ? <div className="text-center p-8">Caricamento...</div> : (
                <div className="space-y-8">
                    {supplierData.plannedSuppliers.length > 0 && (
                        <div>
                            <h2 className="text-xl font-bold text-gray-700 mb-4 border-b pb-2">Pianificazione Budget</h2>
                            <div className="space-y-4">{renderSupplierList(supplierData.plannedSuppliers)}</div>
                        </div>
                    )}
                    {supplierData.unexpectedSuppliers.length > 0 && (
                         <div>
                            <h2 className="text-xl font-bold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
                                <Lightbulb className="text-amber-500" />
                                Spese Extra
                            </h2>
                            <div className="space-y-4">{renderSupplierList(supplierData.unexpectedSuppliers)}</div>
                        </div>
                    )}
                    {supplierData.plannedSuppliers.length === 0 && supplierData.unexpectedSuppliers.length === 0 && (
                        <EmptyState title="Nessun Fornitore Trovato" message={`Non ci sono fornitori con spese registrate che corrispondono ai filtri per l'anno ${year}.`} />
                    )}
                </div>
            )}

            {isModalOpen && (<BudgetAllocationModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveBudget} supplier={selectedSupplier} year={year} initialAllocations={selectedSupplier?.allocations} sectors={sectors} branches={branches} marketingChannels={marketingChannels}/>)}
        </div>
    );
}
