import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { PlusCircle, SlidersHorizontal, Pencil, Trash2, Search, ChevronDown, Paperclip, Copy, AlertCircle, XCircle, Wallet, X, Car, Sailboat, Caravan, Building2, Layers, DollarSign } from 'lucide-react';
import ExpenseFormModal from '../components/ExpenseFormModal';
import toast from 'react-hot-toast';
import EmptyState from '../components/EmptyState';

const storage = getStorage();

const getSectorIcon = (sectorName, customClassName) => {
    const baseClassName = "w-5 h-5";
    const finalClassName = customClassName || `${baseClassName} text-gray-500`;
    const icons = {
        'Auto': <Car className={finalClassName} />,
        'Camper&Caravan': <Caravan className={finalClassName} />,
        'Yachting': <Sailboat className={finalClassName} />,
        'Frattin Group': <Building2 className={finalClassName} />,
        'default': <DollarSign className={finalClassName} />,
    };
    return icons[sectorName] || icons.default;
};


const formatCurrency = (number) => {
    if (typeof number !== 'number') return 'N/A';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const ExpenseSkeleton = () => (
    <div className="space-y-6">
        {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-md border overflow-hidden">
                <div className="p-4"><div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div></div>
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                        <tr><th className="p-3 w-12"></th><th className="p-3 w-2/12"></th><th className="p-3 w-6/12"></th><th className="p-3 w-2/12"></th><th className="p-3 w-2/12"></th></tr>
                    </thead>
                    <tbody>
                        {[...Array(3)].map((_, j) => (
                            <tr key={j} className="border-b last:border-b-0">
                                <td className="p-3 text-center align-middle"><div className="h-5 w-5 bg-gray-200 rounded-full mx-auto animate-pulse"></div></td>
                                <td className="p-3 whitespace-nowrap align-middle"><div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div></td>
                                <td className="p-3 align-middle"><div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div><div className="h-3 bg-gray-200 rounded w-1/3 mt-2 animate-pulse"></div></td>
                                <td className="p-3 text-right font-bold text-indigo-600 whitespace-nowrap align-middle"><div className="h-4 bg-gray-200 rounded w-1/2 ml-auto animate-pulse"></div></td>
                                <td className="p-3 align-middle"><div className="flex items-center justify-center gap-3"><div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div><div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div><div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div></div></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ))}
    </div>
);

const AdvancedFiltersModal = ({ isOpen, onClose, invoiceFilter, setInvoiceFilter, branchFilter, setBranchFilter, areaFilter, setAreaFilter, branches, geographicAreas }) => {
    if (!isOpen) return null;
    const handleBranchChange = (branchId) => setBranchFilter(prev => prev.includes(branchId) ? prev.filter(id => id !== branchId) : [...prev, branchId]);
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start pt-20">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-4 border-b flex justify-between items-center"><h3 className="text-lg font-semibold">Filtri Avanzati</h3><button onClick={onClose}><X size={20}/></button></div>
                <div className="p-4 space-y-4">
                    <div><label htmlFor="invoice-filter-modal" className="text-sm font-bold text-gray-600 block mb-1">Stato Fattura</label><select id="invoice-filter-modal" value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"><option value="">Tutte</option><option value="missing">Mancante</option><option value="present">Presente</option></select></div>
                    <div><label htmlFor="area-filter-modal" className="text-sm font-bold text-gray-600 block mb-1">Area Geografica</label><select id="area-filter-modal" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"><option value="">Tutte</option>{geographicAreas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                    <div><label className="text-sm font-bold text-gray-600 block mb-1">Filiali Specifiche</label><div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">{branches.map(b => (<label key={b.id} className="flex items-center space-x-2 p-1 rounded-md hover:bg-gray-100 cursor-pointer"><input type="checkbox" checked={branchFilter.includes(b.id)} onChange={() => handleBranchChange(b.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/><span>{b.name}</span></label>))}</div></div>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end rounded-b-xl"><button onClick={onClose} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Applica e Chiudi</button></div>
            </div>
        </div>
    );
};


export default function ExpensesPage({ user, initialFilters = {} }) {
    const [allExpenses, setAllExpenses] = useState([]);
    const [branches, setBranches] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [geographicAreas, setGeographicAreas] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [supplierFilter, setSupplierFilter] = useState('');
    const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
    const [expandedExpenses, setExpandedExpenses] = useState({});
    const [expandedMonths, setExpandedMonths] = useState({});
    const [selectedSector, setSelectedSector] = useState('all');
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [invoiceFilter, setInvoiceFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState([]);
    const [areaFilter, setAreaFilter] = useState('');
    const [specialFilter, setSpecialFilter] = useState(null);

    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const marketingChannelMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.name])), [marketingChannels]);
    const geoAreaMap = useMemo(() => new Map(geographicAreas.map(a => [a.id, a.name])), [geographicAreas]);

    useEffect(() => {
        if (initialFilters && Object.keys(initialFilters).length > 0) {
            if (initialFilters.branchFilter) {
                setBranchFilter(initialFilters.branchFilter);
                setIsAdvancedFiltersOpen(true);
            }
            if (initialFilters.specialFilter) setSpecialFilter(initialFilters.specialFilter);
        }
    }, [initialFilters]);

    useEffect(() => {
        setIsLoading(true);
        const unsubs = [
            onSnapshot(query(collection(db, "expenses"), orderBy("date", "desc")), (snap) => {
                const cleanedExpenses = snap.docs.map((doc) => {
                    const data = doc.data();
                    const id = doc.id;
                    let lineItems = [];
                    if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
                        lineItems = data.lineItems.map((item, itemIndex) => ({
                            description: item.description || '',
                            amount: item.amount || 0,
                            marketingChannelId: item.marketingChannelId || '',
                            assignmentType: item.assignmentType || 'branch',
                            assignmentId: item.assignmentId || data.branchId || '',
                            _key: `${id}-${itemIndex}` 
                        }));
                    } else {
                        lineItems.push({
                            description: data.description || 'Voce principale',
                            amount: data.amount || 0,
                            marketingChannelId: data.marketingChannelId || '',
                            assignmentType: 'branch',
                            assignmentId: data.branchId || '',
                            _key: `${id}-0`
                        });
                    }
                    return { ...data, id, supplierId: data.supplierId || data.channelId, lineItems, branchId: data.branchId || null };
                });
                setAllExpenses(cleanedExpenses);
                setIsLoading(false);
            }),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), (snap) => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), (snap) => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), (snap) => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "marketing_channels"), orderBy("name")), (snap) => setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "geographic_areas"), orderBy("name")), (snap) => setGeographicAreas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))))
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const filteredExpenses = useMemo(() => {
        let expensesToFilter = [...allExpenses];
        if (specialFilter === 'unassigned') {
            expensesToFilter = expensesToFilter.filter(exp => exp.isMultiBranch ? exp.lineItems.some(item => !item.assignmentId || !branchMap.has(item.assignmentId)) : !exp.branchId || !branchMap.has(exp.branchId));
        }
        if (selectedSector !== 'all') expensesToFilter = expensesToFilter.filter(exp => exp.sectorId === selectedSector);
        if (dateFilter.startDate && dateFilter.endDate) {
            const start = new Date(dateFilter.startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(dateFilter.endDate); end.setHours(23, 59, 59, 999);
            expensesToFilter = expensesToFilter.filter(exp => { const expDate = exp.date ? new Date(exp.date) : null; return expDate && expDate >= start && expDate <= end; });
        }
        if (supplierFilter) expensesToFilter = expensesToFilter.filter(exp => exp.supplierId === supplierFilter);
        if (invoiceFilter === 'missing') expensesToFilter = expensesToFilter.filter(exp => !exp.invoicePdfUrl);
        if (invoiceFilter === 'present') expensesToFilter = expensesToFilter.filter(exp => !!exp.invoicePdfUrl);
        if (areaFilter) {
            const area = geographicAreas.find(a => a.id === areaFilter);
            const branchesInArea = area?.associatedBranches || [];
            expensesToFilter = expensesToFilter.filter(exp => !exp.isMultiBranch ? branchesInArea.includes(exp.branchId) : exp.lineItems.some(item => branchesInArea.includes(item.assignmentId)));
        }
        if (branchFilter.length > 0) {
            expensesToFilter = expensesToFilter.filter(exp => !exp.isMultiBranch ? branchFilter.includes(exp.branchId) : exp.lineItems.some(item => item.assignmentType === 'branch' && branchFilter.includes(item.assignmentId)));
        }
        if (searchTerm.trim() !== '') {
            const lowerSearchTerm = searchTerm.toLowerCase();
            expensesToFilter = expensesToFilter.filter(exp => {
                const channelNames = [...new Set(exp.lineItems?.map(item => item.marketingChannelId).filter(Boolean))].map(id => marketingChannelMap.get(id) || '').join(' ');
                return exp.description?.toLowerCase().includes(lowerSearchTerm) || supplierMap.get(exp.supplierId)?.toLowerCase().includes(lowerSearchTerm) || exp.lineItems?.some(item => item.description?.toLowerCase().includes(lowerSearchTerm)) || channelNames.toLowerCase().includes(lowerSearchTerm);
            });
        }
        return expensesToFilter;
    }, [allExpenses, searchTerm, supplierFilter, invoiceFilter, dateFilter, selectedSector, branchFilter, areaFilter, specialFilter, supplierMap, marketingChannelMap, geographicAreas, branchMap]);

    const totalFilteredSpend = useMemo(() => filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0), [filteredExpenses]);
    
    const groupedByMonth = useMemo(() => {
        return filteredExpenses.reduce((acc, expense) => {
            const month = expense.date ? expense.date.substring(0, 7) : 'Senza Data';
            if (!acc[month]) acc[month] = [];
            acc[month].push(expense);
            return acc;
        }, {});
    }, [filteredExpenses]);
    
    useEffect(() => {
        if(Object.keys(groupedByMonth).length > 0) {
            const currentMonthKey = new Date().toISOString().slice(0, 7);
            if(!expandedMonths[currentMonthKey]) setExpandedMonths(prev => ({ ...prev, [currentMonthKey]: true }));
        }
    }, [groupedByMonth]);
    
    const toggleMonth = (month) => setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
    const toggleExpense = (expenseId) => setExpandedExpenses(prev => ({ ...prev, [expenseId]: !prev[expenseId] }));
    const monthKeysSorted = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));
    const canEditOrDelete = (expense) => user.role === 'manager' || expense.authorId === user.uid;
    const handleOpenAddModal = () => { setEditingExpense(null); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingExpense(null); };

    const handleOpenEditModal = (expense) => {
        if (!canEditOrDelete(expense)) return toast.error("Non hai i permessi per modificare.");
        setEditingExpense(expense);
        setIsModalOpen(true);
    };
    
    const handleSaveExpense = async (expenseData, invoiceFile) => {
        const isEditing = !!expenseData.id;
        const toastId = toast.loading(isEditing ? 'Aggiornamento...' : 'Salvataggio...');
        
        try {
            const expenseId = isEditing ? expenseData.id : doc(collection(db, 'expenses')).id;
            let fileURL = expenseData.invoicePdfUrl || "";
            if (invoiceFile) {
                const storageRef = ref(storage, `invoices/${expenseId}/${invoiceFile.name}`);
                await uploadBytes(storageRef, invoiceFile);
                fileURL = await getDownloadURL(storageRef);
            }

            const cleanLineItems = (expenseData.lineItems || []).map(item => {
                const assignmentId = expenseData.isMultiBranch ? item.assignmentId : expenseData.branchId;
                if (!assignmentId) {
                    throw new Error(`Assegnazione filiale mancante per la voce: "${item.description || '(voce senza nome)'}"`);
                }
                return {
                    description: (item.description || '').trim(),
                    amount: parseFloat(String(item.amount || '0').replace(',', '.')),
                    assignmentType: 'branch',
                    assignmentId: assignmentId,
                    marketingChannelId: item.marketingChannelId,
                };
            });

            if (cleanLineItems.length === 0) throw new Error("Aggiungere almeno una voce di spesa valida.");
            const finalTotalAmount = cleanLineItems.reduce((sum, item) => sum + item.amount, 0);
            
            const dataToSave = {
                date: expenseData.date,
                description: expenseData.description,
                sectorId: expenseData.sectorId,
                supplierId: expenseData.supplierId,
                isMultiBranch: expenseData.isMultiBranch,
                branchId: expenseData.isMultiBranch ? null : expenseData.branchId,
                amount: finalTotalAmount,
                lineItems: cleanLineItems,
                invoicePdfUrl: fileURL,
            };

            if (isEditing) {
                await updateDoc(doc(db, "expenses", expenseId), { ...dataToSave, updatedAt: serverTimestamp() });
            } else {
                dataToSave.authorId = user.uid;
                dataToSave.authorName = user.name;
                dataToSave.createdAt = serverTimestamp();
                await setDoc(doc(db, "expenses", expenseId), dataToSave);
            }
            toast.success(isEditing ? 'Spesa aggiornata!' : 'Spesa creata!', { id: toastId });
            handleCloseModal();
        } catch (error) {
            console.error("Errore nel salvare la spesa:", error);
            toast.error(error.message || 'Errore imprevisto.', { id: toastId });
        }
    };
    
    const handleDeleteExpense = async (expense) => {
        if (!canEditOrDelete(expense)) return toast.error("Non hai i permessi per eliminare questa spesa.");
        const toastId = toast.loading("Eliminazione in corso...");
        try {
            if (expense.invoicePdfUrl) {
                const fileRef = ref(storage, expense.invoicePdfUrl);
                await deleteObject(fileRef).catch(err => console.warn("File non trovato, potrebbe essere già stato eliminato:", err));
            }
            await deleteDoc(doc(db, "expenses", expense.id));
            toast.success("Spesa eliminata con successo!", { id: toastId });
        } catch (error) {
            console.error("Errore durante l'eliminazione:", error);
            toast.error("Errore durante l'eliminazione.", { id: toastId });
        }
    };
    
    const handleDuplicateExpense = (expenseToDuplicate) => {
        const { id, invoicePdfUrl, createdAt, updatedAt, authorId, authorName, ...restOfExpense } = expenseToDuplicate;
        const newExpenseData = { ...restOfExpense, description: `${expenseToDuplicate.description || ''} (Copia)`, date: new Date().toISOString().split('T')[0] };
        setEditingExpense(newExpenseData);
        setIsModalOpen(true);
    };
    
    const resetFilters = () => {
        setSearchTerm(''); setSupplierFilter(''); setDateFilter({ startDate: '', endDate: '' }); setSelectedSector('all');
        setInvoiceFilter(''); setBranchFilter([]); setAreaFilter(''); setSpecialFilter(null);
    };

    const areAdvancedFiltersActive = invoiceFilter || branchFilter.length > 0 || areaFilter;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8"><h1 className="text-3xl font-bold text-gray-800">Gestione Spese</h1><button onClick={handleOpenAddModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 h-full shadow-sm"><PlusCircle size={20} />Aggiungi Spesa</button></div>
            <div className="mb-6 p-4 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-10 gap-4 items-end">
                    <div className="md:col-span-4"><label htmlFor="search-input" className="text-sm font-bold text-gray-600 block mb-1">Cerca</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input id="search-input" type="text" placeholder="Descrizione, fornitore, canale..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-11 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" /></div></div>
                    <div className="md:col-span-2"><label htmlFor="startDate-input" className="text-sm font-bold text-gray-600 block mb-1">Data Inizio</label><input id="startDate-input" type="date" value={dateFilter.startDate} onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" /></div>
                    <div className="md:col-span-2"><label htmlFor="endDate-input" className="text-sm font-bold text-gray-600 block mb-1">Data Fine</label><input id="endDate-input" type="date" value={dateFilter.endDate} onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" /></div>
                    <div className="md:col-span-2"><label htmlFor="supplier-filter" className="text-sm font-bold text-gray-600 block mb-1">Fornitore</label><select id="supplier-filter" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"><option value="">Tutti</option>{suppliers.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}</select></div>
                </div>
                <div className="border-t border-gray-200 !my-4"></div>
                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setSelectedSector('all')} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-2 ${selectedSector === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}><Layers size={14} /> Tutti i Settori</button>
                        {sectors.map(sector => {
                            const isActive = selectedSector === sector.id;
                            const iconClassName = `w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`;
                            return (<button key={sector.id} onClick={() => setSelectedSector(sector.id)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-2 ${isActive ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}>{getSectorIcon(sector.name, iconClassName)}{sector.name}</button>);
                        })}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsAdvancedFiltersOpen(true)} className={`relative flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border transition ${areAdvancedFiltersActive ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-gray-600 hover:bg-gray-100'}`}><SlidersHorizontal size={16} />Filtri Avanzati{areAdvancedFiltersActive && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white"></span>}</button>
                        <button onClick={resetFilters} title="Resetta tutti i filtri" className="text-sm font-semibold text-red-600 hover:text-red-800 transition flex items-center gap-2 bg-red-100 px-3 py-2 rounded-lg"><XCircle size={16} />Reset Filtri</button>
                    </div>
                </div>
                 {(areAdvancedFiltersActive || specialFilter) && (<div className="pt-2 flex items-center gap-2 flex-wrap">{specialFilter === 'unassigned' && <span className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs">Filtro: Spese non assegnate <button onClick={() => setSpecialFilter(null)}><XCircle size={14}/></button></span>}{invoiceFilter && <span className="flex items-center gap-1 bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">Fattura: {invoiceFilter} <button onClick={() => setInvoiceFilter('')}><XCircle size={14}/></button></span>}{areaFilter && <span className="flex items-center gap-1 bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">Area: {geoAreaMap.get(areaFilter)} <button onClick={() => setAreaFilter('')}><XCircle size={14}/></button></span>}{branchFilter.map(id => <span key={id} className="flex items-center gap-1 bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">Filiale: {branchMap.get(id)} <button onClick={() => setBranchFilter(prev => prev.filter(bId => bId !== id))}><XCircle size={14}/></button></span>)}</div>)}
            </div>
            <div className="mb-8 p-4 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border flex justify-between items-center">
                <div><h3 className="text-lg font-semibold text-gray-800">Riepilogo Filtri</h3><p className="text-sm text-gray-500">{filteredExpenses.length} spese trovate</p></div>
                <div className="text-right"><p className="text-sm text-gray-500">Spesa Totale</p><p className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">{formatCurrency(totalFilteredSpend)}</p></div>
            </div>
            <div className="space-y-6">
                {isLoading ? <ExpenseSkeleton /> : monthKeysSorted.length > 0 ? (monthKeysSorted.map(monthKey => (<div key={monthKey} className="bg-white rounded-2xl shadow-md border overflow-hidden"><div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleMonth(monthKey)}><h3 className="text-xl font-bold text-gray-800 capitalize">{new Date(monthKey + '-02').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</h3><ChevronDown className={`transition-transform duration-200 ${expandedMonths[monthKey] ? 'rotate-180' : ''}`} /></div>{expandedMonths[monthKey] && (<table className="w-full text-sm"><thead className="bg-gray-100 border-b"><tr><th className="p-3 text-left font-semibold text-gray-600 w-12"></th><th className="p-3 text-left font-semibold text-gray-600 w-2/12">Data</th><th className="p-3 text-left font-semibold text-gray-600 w-6/12">Fornitore</th><th className="p-3 text-right font-semibold text-gray-600 w-2/12">Importo</th><th className="p-3 text-center font-semibold text-gray-600 w-2/12">Azioni</th></tr></thead><tbody>{groupedByMonth[monthKey].map((expense) => {const locationTags = expense.isMultiBranch ? [...new Map(expense.lineItems.map(item => [item.assignmentId, item])).values()].map(item => {const name = branchMap.get(item.assignmentId); const color = 'bg-indigo-100 text-indigo-800'; return name ? { name, color, id: item.assignmentId } : null;}).filter(Boolean) : expense.branchId ? [{ name: branchMap.get(expense.branchId), color: 'bg-indigo-100 text-indigo-800', id: expense.branchId }] : []; return (<React.Fragment key={expense.id}><tr className="border-b last:border-b-0 hover:bg-indigo-50/50 transition-colors cursor-pointer" onClick={() => toggleExpense(expense.id)}><td className="p-3 text-center align-middle">{getSectorIcon(sectorMap.get(expense.sectorId))}</td><td className="p-3 whitespace-nowrap align-middle">{expense.date ? new Date(expense.date + 'T00:00:00').toLocaleDateString('it-IT') : 'N/D'}</td><td className="p-3 align-middle"><p className="font-bold text-gray-800 truncate">{supplierMap.get(expense.supplierId) || 'N/D'}</p><div className="flex items-center gap-1 flex-wrap mt-1">{locationTags.map(tag => (tag && <span key={tag.id} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tag.color}`}>{tag.name}</span>))}</div></td><td className="p-3 text-right font-bold text-indigo-600 whitespace-nowrap align-middle">{formatCurrency(expense.amount)}</td><td className="p-3 align-middle"><div className="flex items-center justify-center gap-3 text-gray-400"><ChevronDown className={`transition-transform duration-200 ${expandedExpenses[expense.id] ? 'rotate-180' : ''}`} />{!expense.invoicePdfUrl && <AlertCircle className="text-amber-500" size={18} title="Fattura mancante"/>}{expense.invoicePdfUrl && (<a href={expense.invoicePdfUrl} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600" onClick={e => e.stopPropagation()}><Paperclip size={18}/></a>)}{canEditOrDelete(expense) && (<><button className="hover:text-indigo-600" onClick={(e) => {e.stopPropagation(); handleDuplicateExpense(expense)}}><Copy size={18} /></button><button className="hover:text-indigo-600" onClick={(e) => {e.stopPropagation(); handleOpenEditModal(expense)}}><Pencil size={18} /></button><button className="hover:text-red-500" onClick={(e) => {e.stopPropagation(); handleDeleteExpense(expense)}}><Trash2 size={18} /></button></>)}</div></td></tr>{expandedExpenses[expense.id] && (<tr className="bg-gray-50"><td colSpan="5" className="p-4 text-xs"><div className="mb-3"><h4 className="font-bold text-gray-600">Descrizione Fattura</h4><p className="italic text-gray-800">{expense.description}</p></div><h4 className="font-bold text-gray-600 mb-2">Dettaglio Voci</h4><div className="pl-2 border-l-2 border-gray-300 space-y-1">{expense.lineItems.map((item, idx) => (<div key={item._key || idx} className="flex justify-between items-center pr-2"><span>{item.description}</span><div className="flex items-center gap-2"><span className="font-semibold text-gray-500">({marketingChannelMap.get(item.marketingChannelId) || 'N/D'})</span>{expense.isMultiBranch && (() => {let name = branchMap.get(item.assignmentId) || 'N/D'; let color = 'text-indigo-600'; return <span className={`font-semibold ${color}`}>({name})</span>;})()}<span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span></div></div>))}</div></td></tr>)}</React.Fragment>);})}</tbody></table>)}</div>))) : ( <EmptyState title="Nessuna Spesa" message="Non ci sono spese che corrispondono ai filtri." /> )}
            </div>
            
            <ExpenseFormModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveExpense} initialData={editingExpense} sectors={sectors} branches={branches} suppliers={suppliers} marketingChannels={marketingChannels} geographicAreas={geographicAreas} />
            <AdvancedFiltersModal isOpen={isAdvancedFiltersOpen} onClose={() => setIsAdvancedFiltersOpen(false)} invoiceFilter={invoiceFilter} setInvoiceFilter={setInvoiceFilter} branchFilter={branchFilter} setBranchFilter={setBranchFilter} areaFilter={areaFilter} setAreaFilter={setAreaFilter} branches={branches} geographicAreas={geographicAreas}/>
        </div>
    );
}
