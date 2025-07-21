import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { PlusCircle, Calendar, Layers, Building2, User, Pencil, Trash2, Search, ChevronDown, FileDown, Paperclip, Copy, ShoppingCart, RadioTower, AlertCircle } from 'lucide-react';
import ExpenseFormModal from '../components/ExpenseFormModal';
import toast from 'react-hot-toast';
import Spinner from '../components/Spinner';
import EmptyState from '../components/EmptyState';

const storage = getStorage();

const formatCurrency = (number) => {
    if (typeof number !== 'number') return 'N/A';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

export default function ExpensesPage({ user }) {
    const [expenses, setExpenses] = useState([]);
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
    const [invoiceFilter, setInvoiceFilter] = useState('');
    const [expandedMonths, setExpandedMonths] = useState({});
    const [expandedExpenses, setExpandedExpenses] = useState({});

    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const marketingChannelMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.name])), [marketingChannels]);
    const geoAreaMap = useMemo(() => new Map(geographicAreas.map(a => [a.id, a.name])), [geographicAreas]);

    useEffect(() => {
        const unsubs = [
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), (snap) => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), (snap) => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), (snap) => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "marketing_channels"), orderBy("name")), (snap) => setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "geographic_areas"), orderBy("name")), (snap) => setGeographicAreas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))))
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    useEffect(() => {
        if (!user) { setIsLoading(false); return; }
        let q = query(collection(db, "expenses"), orderBy("date", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setExpenses(snapshot.docs.map(doc => {
                const data = doc.data();
                data.id = doc.id;
                return data;
            }));
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(expense => {
            const lowerSearchTerm = searchTerm.toLowerCase();
            const searchTermMatch = searchTerm.trim() === '' || 
                expense.description?.toLowerCase().includes(lowerSearchTerm) || 
                supplierMap.get(expense.supplierId || expense.channelId)?.toLowerCase().includes(lowerSearchTerm) ||
                expense.lineItems?.some(item => item.description?.toLowerCase().includes(lowerSearchTerm));
            
            const supplierFilterMatch = supplierFilter === '' || (expense.supplierId || expense.channelId) === supplierFilter;
            
            const invoiceFilterMatch = invoiceFilter === '' || (invoiceFilter === 'missing' && !expense.invoicePdfUrl);

            return searchTermMatch && supplierFilterMatch && invoiceFilterMatch;
        });
    }, [expenses, searchTerm, supplierFilter, invoiceFilter, supplierMap]);

    const groupedExpenses = useMemo(() => {
        return filteredExpenses.reduce((acc, expense) => {
            const month = expense.date ? expense.date.substring(0, 7) : 'Senza Data';
            if (!acc[month]) { acc[month] = []; }
            acc[month].push(expense);
            return acc;
        }, {});
    }, [filteredExpenses]);
    
    useEffect(() => {
        if(Object.keys(groupedExpenses).length > 0) {
            const currentMonthKey = new Date().toISOString().slice(0, 7);
            setExpandedMonths(prev => ({ ...prev, [currentMonthKey]: true }));
        }
    }, [groupedExpenses]);
    
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
                if (!item.marketingChannelId) throw new Error("Ogni voce deve avere un Canale di Marketing.");
                if (!expenseData.isMultiBranch && !expenseData.branchId) throw new Error("Selezionare una filiale per la spesa.");
                if (expenseData.isMultiBranch && (!item.assignmentType || !item.assignmentId)) throw new Error("Ogni voce deve avere un'area o filiale assegnata.");
                return {
                    description: item.description.trim(),
                    amount: parseFloat(String(item.amount || '0').replace(',', '.')),
                    assignmentType: expenseData.isMultiBranch ? item.assignmentType : 'branch',
                    assignmentId: expenseData.isMultiBranch ? item.assignmentId : expenseData.branchId,
                    marketingChannelId: item.marketingChannelId,
                };
            }).filter(item => item.description);
            if (cleanLineItems.length === 0) throw new Error("Aggiungere almeno una voce di spesa valida.");
            const totalAmount = cleanLineItems.reduce((sum, item) => sum + item.amount, 0);
            
            const dataToSave = {
                date: expenseData.date,
                description: expenseData.description,
                sectorId: expenseData.sectorId,
                supplierId: expenseData.supplierId,
                isMultiBranch: expenseData.isMultiBranch,
                branchId: expenseData.isMultiBranch ? null : expenseData.branchId,
                amount: totalAmount,
                lineItems: cleanLineItems,
                invoicePdfUrl: fileURL,
            };

            if (isEditing) {
                await updateDoc(doc(db, "expenses", expenseId), dataToSave);
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
        if (!canEditOrDelete(expense)) return toast.error("Non hai i permessi per eliminare.");
        if (window.confirm(`Sei sicuro di voler eliminare la spesa:\n"${expense.description}"`)) {
            const toastId = toast.loading('Eliminazione...');
            try {
                await deleteDoc(doc(db, "expenses", expense.id));
                if (expense.invoicePdfUrl) {
                    console.log(`Spesa eliminata. File da rimuovere manualmente da Storage: ${expense.invoicePdfUrl}`);
                }
                toast.success('Spesa eliminata!', { id: toastId });
            } catch (error) {
                console.error("Errore eliminazione:", error);
                toast.error("Impossibile eliminare la spesa.", { id: toastId });
            }
        }
    };

    const handleDuplicateExpense = (expenseToDuplicate) => {
        const { id, authorId, authorName, createdAt, invoicePdfUrl, ...duplicatedData } = expenseToDuplicate;
        const newExpenseData = { ...duplicatedData, date: new Date().toISOString().split('T')[0], description: `${duplicatedData.description || ''} (Copia)`, };
        setEditingExpense(newExpenseData);
        setIsModalOpen(true);
    };

    const toggleMonth = (month) => setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
    const toggleExpense = (expenseId) => setExpandedExpenses(prev => ({ ...prev, [expenseId]: !prev[expenseId] }));
    const monthKeysSorted = Object.keys(groupedExpenses).sort((a, b) => b.localeCompare(a));
    const canEditOrDelete = (expense) => user.role === 'manager' || expense.authorId === user.uid;
    const handleOpenAddModal = () => { setEditingExpense(null); setIsModalOpen(true); };
    const handleOpenEditModal = (expense) => { if (!canEditOrDelete(expense)) { toast.error("Non hai i permessi per modificare."); return; } setEditingExpense(expense); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingExpense(null); };

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Gestione Spese</h1>
                <button onClick={handleOpenAddModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"><PlusCircle size={20} />Aggiungi Spesa</button>
            </div>

            <div className="mb-6 p-4 bg-white rounded-xl shadow-lg border">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div><label className="text-sm font-bold text-gray-600 block mb-2">Cerca</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" /><input type="text" placeholder="Fornitore, descrizione..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 pl-10 border rounded-lg"/></div></div>
                    <div><label className="text-sm font-bold text-gray-600 block mb-2">Fornitore</label><select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="w-full p-2 border rounded-lg bg-white"><option value="">Tutti i Fornitori</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                    <div><label className="text-sm font-bold text-gray-600 block mb-2">Fattura</label><select value={invoiceFilter} onChange={e => setInvoiceFilter(e.target.value)} className="w-full p-2 border rounded-lg bg-white"><option value="">Tutte</option><option value="missing">Senza Fattura</option></select></div>
                </div>
            </div>

            <div className="space-y-4">
                {isLoading ? <Spinner /> : monthKeysSorted.length > 0 ? (
                    monthKeysSorted.map(monthKey => (
                        <div key={monthKey} className="bg-white rounded-xl shadow-lg border">
                            <button onClick={() => toggleMonth(monthKey)} className="w-full flex justify-between items-center p-4 text-left"><h2 className="text-xl font-bold text-gray-700 capitalize">{new Date(monthKey + '-02').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</h2><ChevronDown className={`transition-transform duration-200 ${expandedMonths[monthKey] ? '' : '-rotate-90'}`} /></button>
                            {expandedMonths[monthKey] && (
                                <div className="p-4 border-t"><ul className="space-y-2">
                                    {groupedExpenses[monthKey].map((expense, index) => {
                                        const uniqueChannelIds = [...new Set(expense.lineItems?.map(item => item.marketingChannelId).filter(Boolean))];
                                        const channelNames = uniqueChannelIds.map(id => marketingChannelMap.get(id)).join(', ');
                                        return (
                                            <li key={expense.id || index} className="p-4 rounded-lg bg-gray-50 border">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 cursor-pointer" onClick={() => toggleExpense(expense.id)}>
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <p className="font-bold text-lg text-gray-800">{supplierMap.get(expense.supplierId || expense.channelId) || 'Fornitore N/D'}</p>
                                                                <p className="text-sm font-semibold text-indigo-600 flex items-center gap-1.5 mt-1"><RadioTower size={14} /><span>{channelNames || 'Canali non specificati'}</span></p>
                                                                <p className="text-sm text-gray-600 italic mt-2">{expense.description}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                                                {!expense.invoicePdfUrl && <AlertCircle className="text-amber-500" size={20} title="Fattura mancante"/>}
                                                                <ChevronDown className={`transition-transform duration-200 ${expandedExpenses[expense.id] ? '' : '-rotate-90'}`} />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                                                            <span className="flex items-center gap-1"><Calendar size={14} />{expense.date ? new Date(expense.date).toLocaleDateString('it-IT') : 'N/D'}</span>
                                                            <span className="flex items-center gap-1"><Layers size={14} />{sectorMap.get(expense.sectorId) || 'N/D'}</span>
                                                        </div>
                                                    </div>
                                                    <div className="w-auto md:w-48 flex-shrink-0 flex flex-col items-end justify-between self-stretch">
                                                        <span className="text-xl font-bold text-indigo-600">{formatCurrency(expense.amount)}</span>
                                                        <div className="flex items-center gap-3 mt-2">
                                                            {expense.invoicePdfUrl && (<a href={expense.invoicePdfUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-indigo-600" title="Visualizza fattura"><Paperclip size={18}/></a>)}
                                                            {canEditOrDelete(expense) && (<><button onClick={(e) => { e.stopPropagation(); handleDuplicateExpense(expense);}} className="text-gray-500 hover:text-blue-600" title="Duplica"><Copy size={18} /></button><button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(expense);}} className="text-gray-500 hover:text-indigo-600" title="Modifica"><Pencil size={18} /></button><button onClick={(e) => { e.stopPropagation(); handleDeleteExpense(expense);}} className="text-red-500 hover:text-red-700" title="Elimina"><Trash2 size={18} /></button></>)}
                                                        </div>
                                                    </div>
                                                </div>
                                                {expandedExpenses[expense.id] && (
                                                    <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-200">
                                                        <h4 className="text-sm font-bold text-gray-600 mb-2">Dettaglio Voci</h4>
                                                        <div className="pl-2 border-l-2 border-gray-200 space-y-1">
                                                            {expense.lineItems?.length > 0 ? ( expense.lineItems.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between text-sm items-center">
                                                                    <span>{item.description}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-semibold text-gray-500">({marketingChannelMap.get(item.marketingChannelId) || 'N/D'})</span>
                                                                        {expense.isMultiBranch && (() => {
                                                                            let name = 'N/D', color = 'text-gray-500';
                                                                            if (item.assignmentType === 'branch') { name = branchMap.get(item.assignmentId) || 'N/D'; color = 'text-indigo-600'; }
                                                                            else if (item.assignmentType === 'area') { name = `Area: ${geoAreaMap.get(item.assignmentId) || 'N/D'}`; color = 'text-green-600';}
                                                                            return <span className={`text-xs font-semibold ${color}`}>({name})</span>;
                                                                        })()}
                                                                        <span className="font-medium text-gray-900">{formatCurrency(item.amount)}</span>
                                                                    </div>
                                                                </div>
                                                            ))) : (<p className="text-sm text-gray-500 italic">Nessuna voce dettagliata.</p>)}
                                                        </div>
                                                    </div>
                                                )}
                                            </li>
                                        )
                                    })}
                                </ul></div>
                            )}
                        </div>
                    ))
                ) : ( <EmptyState title="Nessuna Spesa" message="Non ci sono spese che corrispondono ai filtri." /> )}
            </div>
            <ExpenseFormModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveExpense} initialData={editingExpense} sectors={sectors} branches={branches} suppliers={suppliers} marketingChannels={marketingChannels} geographicAreas={geographicAreas} />
        </div>
    );
}