import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { PlusCircle, Pencil, Trash2, ChevronDown, Search, Layers, XCircle, Copy, FileSignature, Paperclip } from 'lucide-react';
import ContractFormModal from '../components/ContractFormModal';
import toast from 'react-hot-toast';
import EmptyState from '../components/EmptyState';

const storage = getStorage();

const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return 'N/A';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/D';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
};

const ProgressBar = ({ value, spent, total }) => {
    const percentage = Math.min(Math.max(value, 0), 100);
    const getColor = () => {
        if (percentage > 95) return 'bg-red-500';
        if (percentage > 75) return 'bg-amber-500';
        return 'bg-green-500';
    };
    return (
        <div className="w-full" title={`Speso: ${formatCurrency(spent)} / ${formatCurrency(total)}`}>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full transition-all duration-500 ${getColor()}`} style={{ width: `${percentage}%` }}></div>
            </div>
        </div>
    );
};

export default function ContractsPage({ user }) {
    const [allContracts, setAllContracts] = useState([]);
    const [allExpenses, setAllExpenses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContract, setEditingContract] = useState(null);
    const [expandedRows, setExpandedRows] = useState({});
    
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
    const [sectorFilter, setSectorFilter] = useState('all');
    const [supplierFilter, setSupplierFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);

    useEffect(() => {
        setIsLoading(true);
        const unsubs = [
            onSnapshot(query(collection(db, "contracts"), orderBy("signingDate", "desc")), snap => setAllContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "expenses")), snap => setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), snap => {
                setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            })
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const processedContracts = useMemo(() => {
    let filtered = allContracts.map(contract => {
        const totalAmount = (contract.lineItems || []).reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
        
        const spentAmount = allExpenses.reduce((sum, expense) => {
            let expenseContribution = 0;
            if (expense.relatedContractId === contract.id) {
                expenseContribution = expense.amount || 0;
            } else if (expense.lineItems && expense.lineItems.length > 0) {
                expenseContribution = expense.lineItems
                    .filter(li => li.relatedContractId === contract.id)
                    .reduce((lineItemSum, li) => lineItemSum + (li.amount || 0), 0);
            }
            return sum + expenseContribution;
        }, 0);
        
        const progress = totalAmount > 0 ? (spentAmount / totalAmount) * 100 : 0;
        
        return { ...contract, totalAmount, spentAmount, progress };
    });

    if (yearFilter !== 'all') {
        const year = parseInt(yearFilter);
        filtered = filtered.filter(c => {
            const items = c.lineItems || [{ startDate: c.startDate, endDate: c.endDate }];
            return items.some(item => {
                if (!item || !item.startDate || !item.endDate) return false;
                const startYear = new Date(item.startDate).getFullYear();
                const endYear = new Date(item.endDate).getFullYear();
                return year >= startYear && year <= endYear;
            });
        });
    }
    
    if (sectorFilter !== 'all') {
        filtered = filtered.filter(c => {
            const contractSectors = c.associatedSectors || (c.sectorld ? [c.sectorld] : []);
            return contractSectors.includes(sectorFilter);
        });
    }

    if (supplierFilter !== 'all') {
        filtered = filtered.filter(c => c.supplierld === supplierFilter);
    }

    if (searchTerm.trim() !== '') {
        const lowerSearch = searchTerm.toLowerCase();
        filtered = filtered.filter(c => 
            c.description.toLowerCase().includes(lowerSearch) ||
            (supplierMap.get(c.supplierld) || '').toLowerCase().includes(lowerSearch)
        );
    }
    
    return filtered;
}, [allContracts, allExpenses, yearFilter, sectorFilter, supplierFilter, searchTerm, supplierMap]);

    const groupedByMonth = useMemo(() => {
        return processedContracts.reduce((acc, contract) => {
            const month = contract.signingDate ? contract.signingDate.substring(0, 7) : 'Senza Data';
            if (!acc[month]) acc[month] = [];
            acc[month].push(contract);
            return acc;
        }, {});
    }, [processedContracts]);

    const monthKeysSorted = useMemo(() => Object.keys(groupedByMonth).sort().reverse(), [groupedByMonth]);
    
    const handleOpenAddModal = () => { setEditingContract(null); setIsModalOpen(true); };
    const handleOpenEditModal = (contract) => { setEditingContract(contract); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingContract(null); };
    const toggleRow = (id) => setExpandedRows(prev => ({...prev, [id]: !prev[id]}));

    const handleSaveContract = async (formData, contractFile) => {
        const isEditing = !!formData.id;
        const toastId = toast.loading(isEditing ? 'Aggiornamento...' : 'Salvataggio...');
        try {
            const { _key, ...cleanFormData } = formData;
            const cleanLineItems = cleanFormData.lineItems.map(item => {
                const { _key, ...rest } = item;
                return { ...rest, totalAmount: parseFloat(String(rest.totalAmount).replace(',', '.')) || 0 };
            });

            const contractId = isEditing ? cleanFormData.id : doc(collection(db, 'contracts')).id;
            let fileURL = cleanFormData.contractPdfUrl || "";

            if (contractFile) {
                const storageRef = ref(storage, `contracts/${contractId}/${contractFile.name}`);
                await uploadBytes(storageRef, contractFile);
                fileURL = await getDownloadURL(storageRef);
            }
            
            const dataToSave = { ...cleanFormData, lineItems: cleanLineItems, contractPdfUrl: fileURL, updatedAt: serverTimestamp() };
            Object.keys(dataToSave).forEach(key => { if (dataToSave[key] === undefined) dataToSave[key] = null; });
            (dataToSave.lineItems || []).forEach(item => Object.keys(item).forEach(key => { if (item[key] === undefined) item[key] = null; }));

            if (isEditing) {
                await updateDoc(doc(db, "contracts", contractId), dataToSave);
            } else {
                dataToSave.authorld = user.uid;
                dataToSave.authorName = user.name;
                dataToSave.createdAt = serverTimestamp();
                await setDoc(doc(db, "contracts", contractId), dataToSave);
            }
            toast.success(isEditing ? 'Contratto aggiornato!' : 'Contratto creato!', { id: toastId });
            handleCloseModal();
        } catch (error) {
            console.error("Errore nel salvare il contratto:", error);
            toast.error(error.message || 'Errore imprevisto.', { id: toastId });
        }
    };
    
    // --- NUOVA FUNZIONE DUPLICA ---
    const handleDuplicateContract = (contractToDuplicate) => {
        const { id, createdAt, updatedAt, authorld, authorName, contractPdfUrl, ...restOfContract } = contractToDuplicate;
        const newContractData = {
            ...restOfContract,
            description: `${restOfContract.description || ''} (Copia)`,
            signingDate: new Date().toISOString().split('T')[0],
        };
        setEditingContract(newContractData);
        setIsModalOpen(true);
    };

    const handleDeleteContract = async (contract) => {
        if (!window.confirm(`Sei sicuro di voler eliminare il contratto "${contract.description}"?`)) return;
        const toastId = toast.loading("Eliminazione in corso...");
        try {
            if (contract.contractPdfUrl) {
                const fileRef = ref(storage, contract.contractPdfUrl);
                await deleteObject(fileRef).catch(err => console.warn("File non trovato:", err));
            }
            await deleteDoc(doc(db, "contracts", contract.id));
            toast.success("Contratto eliminato!", { id: toastId });
        } catch (error) {
            console.error("Errore durante l'eliminazione:", error);
            toast.error("Errore durante l'eliminazione.", { id: toastId });
        }
    };

    const resetFilters = () => {
        setSearchTerm(''); setSectorFilter('all'); setSupplierFilter('all'); setYearFilter(new Date().getFullYear());
    };

    if (isLoading) {
        return <div className="p-8 text-center">Caricamento...</div>;
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800">Gestione Contratti</h1>
                <button onClick={handleOpenAddModal} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 h-full shadow-sm">
                    <PlusCircle size={20} />Aggiungi Contratto
                </button>
            </div>

            <div className="mb-6 p-4 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 space-y-4">
                {/* ... Filtri ... */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><label className="text-sm font-bold text-gray-600 block mb-1">Cerca</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="Descrizione o Fornitore..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full h-11 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" /></div></div>
                    <div><label className="text-sm font-bold text-gray-600 block mb-1">Fornitore</label><select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"><option value="all">Tutti i Fornitori</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                    <div><label className="text-sm font-bold text-gray-600 block mb-1">Settore</label><select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"><option value="all">Tutti i Settori</option>{sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                    <div><label className="text-sm font-bold text-gray-600 block mb-1">Anno</label><select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"><option value="all">Tutti gli Anni</option>{[...Array(5)].map((_, i) => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}</select></div>
                </div>
                <div className="flex justify-end border-t pt-4">
                    <button onClick={resetFilters} className="text-sm font-semibold text-red-600 hover:text-red-800 transition flex items-center gap-2 bg-red-100 px-3 py-2 rounded-lg"><XCircle size={16} />Reset Filtri</button>
                </div>
            </div>

            <div className="space-y-6">
                {monthKeysSorted.length === 0 && !isLoading && (
                    <EmptyState title="Nessun Contratto Trovato" message="Non ci sono contratti che corrispondono ai filtri selezionati." />
                )}
                {monthKeysSorted.map(monthKey => (
                    <div key={monthKey} className="bg-white rounded-xl shadow-md border overflow-hidden">
                        <div className="p-4"><h3 className="text-lg font-bold text-gray-700 capitalize">{new Date(monthKey + '-02').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</h3></div>
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-y">
                                <tr>
                                    <th className="p-3 text-left font-semibold text-gray-600 w-4/12">Fornitore / Descrizione</th>
                                    <th className="p-3 text-left font-semibold text-gray-600 w-2/12">Settori</th>
                                    <th className="p-3 text-left font-semibold text-gray-600 w-1/12">Data Firma</th>
                                    <th className="p-3 text-left font-semibold text-gray-600 w-3/12">Importo e Stato</th>
                                    <th className="p-3 text-center font-semibold text-gray-600 w-2/12">Azioni</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupedByMonth[monthKey].map(contract => (
                                    <React.Fragment key={contract.id}>
                                        <tr className="border-b last:border-b-0 hover:bg-indigo-50/50 transition-colors cursor-pointer" onClick={() => toggleRow(contract.id)}>
                                            <td className="p-3 align-top">
                                                <p className="font-bold text-gray-800">{supplierMap.get(contract.supplierld) || 'N/D'}</p>
                                                <p className="text-xs text-gray-600">{contract.description}</p>
                                            </td>
                                            <td className="p-3 align-top">
                                                <div className="flex flex-wrap gap-1">
                                                    {(contract.associatedSectors || (contract.sectorld ? [contract.sectorld] : [])).map(sectorId => (
                                                        <span key={sectorId} className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{sectorMap.get(sectorId) || '...'}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-3 align-top whitespace-nowrap">{formatDate(contract.signingDate)}</td>
                                            <td className="p-3 align-top">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-800">{formatCurrency(contract.totalAmount)}</span>
                                                    <ProgressBar value={contract.progress} spent={contract.spentAmount} total={contract.totalAmount} />
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">Speso: {formatCurrency(contract.spentAmount)}</div>
                                            </td>
                                            <td className="p-3 align-top">
                                                <div className="flex items-center justify-center gap-3 text-gray-400">
                                                    {contract.contractPdfUrl && <a href={contract.contractPdfUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-indigo-600" title="Visualizza PDF"><Paperclip size={16}/></a>}
                                                    <button onClick={(e) => { e.stopPropagation(); handleDuplicateContract(contract); }} className="hover:text-indigo-600" title="Duplica"><Copy size={16} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(contract); }} className="hover:text-indigo-600" title="Modifica"><Pencil size={16} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteContract(contract); }} className="hover:text-red-500" title="Elimina"><Trash2 size={16} /></button>
                                                    <ChevronDown className={`transition-transform duration-200 ${expandedRows[contract.id] ? 'rotate-180' : ''}`} />
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedRows[contract.id] && (
                                            <tr className="bg-gray-50">
                                                <td colSpan="5" className="p-4">
                                                    <h4 className="font-bold text-xs text-gray-700 mb-2">Dettaglio Voci Contratto</h4>
                                                    <div className="space-y-1">
                                                        {(contract.lineItems || []).map((item, index) => (
                                                             <div key={index} className="grid grid-cols-6 gap-4 text-xs p-2 bg-white rounded-md border">
                                                                <div className="col-span-3 font-semibold text-gray-800">{item.description}</div>
                                                                <div className="text-gray-600">{branchMap.get(item.branchld) || 'N/D'}</div>
                                                                <div className="text-gray-600 whitespace-nowrap">{formatDate(item.startDate)} - {formatDate(item.endDate)}</div>
                                                                <div className="font-semibold text-right text-gray-800">{formatCurrency(item.totalAmount)}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>

            <ContractFormModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveContract}
                initialData={editingContract}
                suppliers={suppliers}
                sectors={sectors}
                branches={branches}
            />
        </div>
    );
}