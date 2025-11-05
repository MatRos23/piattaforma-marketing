import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc, orderBy, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { Users, Layers, Building2, RadioTower, Link2, PlusCircle, Pencil, Trash2, Search, ShoppingCart, Car, Sailboat, Caravan, DollarSign, Settings, Target, X, AlertCircle, CheckCircle } from 'lucide-react';
import AssociationModal from '../components/AssociationModal';
import UserPermissionsModal from '../components/UserPermissionsModal';
import AddUserModal from '../components/AddUserModal';
import MarketingChannelModal from '../components/MarketingChannelModal';
import SimpleAddModal from '../components/SimpleAddModal';
import SectorBudgetModal from '../components/SectorBudgetModal';
import toast from 'react-hot-toast';

const SettingsListItem = ({ children, onEdit, onDelete, variant = 'default' }) => {
    const variantStyles = {
        default: 'bg-white/70 hover:border-indigo-200',
        sector: 'bg-gradient-to-br from-indigo-50/50 to-purple-50/50 hover:border-indigo-300',
        supplier: 'bg-gradient-to-br from-amber-50/50 to-orange-50/50 hover:border-amber-300',
        user: 'bg-gradient-to-br from-blue-50/50 to-cyan-50/50 hover:border-blue-300',
    };

    return (
        <li className={`flex justify-between items-center p-4 rounded-xl border-2 border-white hover:shadow-lg transition-all group ${variantStyles[variant]}`}>
            <div className="flex-1 min-w-0">{children}</div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {onEdit && (
                    <button onClick={onEdit} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all" title="Modifica">
                        <Pencil size={16} />
                    </button>
                )}
                {onDelete && (
                    <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-lg transition-all" title="Elimina">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </li>
    );
};

const sectorIcons = {
    'Auto': <Car className="w-5 h-5" />,
    'Camper&Caravan': <Caravan className="w-5 h-5" />,
    'Yachting': <Sailboat className="w-5 h-5" />,
    'Frattin Group': <Building2 className="w-5 h-5" />,
    'default': <DollarSign className="w-5 h-5" />,
};

const getSectorIcon = (sectorName) => sectorIcons[sectorName] || sectorIcons.default;

const TabButton = ({ tabKey, label, icon, activeTab, setActiveTab, count }) => {
    const isActive = activeTab === tabKey;
    const Icon = icon;
    return (
        <button 
            onClick={() => setActiveTab(tabKey)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 ${
                isActive 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-105' 
                    : 'text-gray-600 hover:bg-white/60 hover:text-indigo-700 hover:scale-105'
            }`}
        >
            <Icon size={18} />
            <span className="hidden sm:inline">{label}</span>
            {count !== undefined && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'
                }`}>
                    {count}
                </span>
            )}
        </button>
    );
};

const KpiCard = ({ title, value, icon, gradient }) => (
    <div className="group relative bg-white/90 backdrop-blur-2xl rounded-2xl shadow-lg border border-white/30 p-5 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
        <div className="absolute -right-4 -top-4 text-gray-200/50 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
            {React.cloneElement(icon, { className: "w-20 h-20" })}
        </div>
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} text-white shadow-md`}>
                    {React.cloneElement(icon, { className: "w-5 h-5" })}
                </div>
                <p className="text-xs font-bold text-gray-600 tracking-wide uppercase">{title}</p>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-gray-900">{value}</p>
        </div>
    </div>
);

export default function SettingsPage({ user }) {
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [channelCategories, setChannelCategories] = useState([]);
    const [modalState, setModalState] = useState({ isOpen: false, type: null, data: null });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('sector_budgets');
    const [searchTerms, setSearchTerms] = useState({});
    
    const [sectorBudgets, setSectorBudgets] = useState(new Map());
    const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());
    const [editingSectorBudget, setEditingSectorBudget] = useState(null);

    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);

    useEffect(() => {
        setLoading(true);
        const collectionsConfig = {
            sectors: { setter: setSectors, collectionName: "sectors" },
            branches: { setter: setBranches, collectionName: "branches" },
            suppliers: { setter: setSuppliers, collectionName: "channels" },
            marketingChannels: { setter: setMarketingChannels, collectionName: "marketing_channels" },
            allUsers: { setter: setAllUsers, collectionName: "users" },
            channelCategories: { setter: setChannelCategories, collectionName: "channel_categories" },
        };
        const unsubs = Object.values(collectionsConfig).map(({ setter, collectionName }) => 
            onSnapshot(query(collection(db, collectionName), orderBy("name")), (snap) => {
                setter(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            })
        );
        setTimeout(() => setLoading(false), 800);
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'sector_budgets'), where('year', '==', budgetYear));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const budgets = new Map(snapshot.docs.map(doc => [doc.data().sectorId, doc.data()]));
            setSectorBudgets(budgets);
        });
        return () => unsubscribe();
    }, [budgetYear]);

    const combinedSectorData = useMemo(() => {
        return sectors.map(sector => ({
            ...sector,
            budget: sectorBudgets.get(sector.id)?.maxAmount || 0,
        }));
    }, [sectors, sectorBudgets]);

    const handleOpenModal = (type, data = null) => setModalState({ isOpen: true, type, data });
    const handleCloseModal = () => { setModalState({ isOpen: false, type: null, data: null }); setEditingSectorBudget(null); };
    const handleSearchChange = (e) => setSearchTerms(prev => ({ ...prev, [activeTab]: e.target.value }));
    
    const handleOpenSectorBudgetModal = (sector) => setEditingSectorBudget(sector);
    
    const handleSaveSectorBudget = async (sectorId, newAmount) => {
        const toastId = toast.loading("Salvataggio budget settore...");
        try {
            const docId = `${sectorId}_${budgetYear}`;
            const docRef = doc(db, 'sector_budgets', docId);
            await setDoc(docRef, {
                sectorId: sectorId,
                year: budgetYear,
                maxAmount: newAmount,
            }, { merge: true });
            toast.success("Budget del settore salvato!", { id: toastId });
            setEditingSectorBudget(null);
        } catch (error) {
            console.error("Errore salvataggio budget settore:", error);
            toast.error("Errore durante il salvataggio.", { id: toastId });
        }
    };

    const handleDelete = async (collectionName, id) => {
        if (window.confirm("Sei sicuro di voler eliminare questo elemento? L'azione è irreversibile.")) {
            const toastId = toast.loading("Eliminazione in corso...");
            try {
                await deleteDoc(doc(db, collectionName, id));
                toast.success("Elemento eliminato!", { id: toastId });
            } catch (error) {
                console.error("Errore durante l'eliminazione:", error);
                toast.error("Errore durante l'eliminazione.", { id: toastId });
            }
        }
    };

    const handleDeleteUser = async (userIdToDelete) => {
        if (userIdToDelete === user.uid) {
            toast.error("Non puoi eliminare te stesso.");
            return;
        }
        if (window.confirm("Sei sicuro di voler eliminare questo utente?")) {
            const toastId = toast.loading("Eliminazione utente...");
            try {
                const functions = getFunctions(getApp(), 'europe-west1');
                const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
                const result = await deleteUserAccount({ uidToDelete: userIdToDelete });
                if (result.data.status === 'success') {
                    toast.success("Utente eliminato!", { id: toastId });
                } else {
                    throw new Error(result.data.message);
                }
            } catch (error) {
                toast.error(`Errore: ${error.message}`, { id: toastId });
            }
        }
    };

    const handleSave = async (collectionName, formData) => {
        const { data } = modalState;
        const isEditing = !!(data && data.id);
        const toastId = toast.loading("Salvataggio...");
        try {
            if (!formData.name?.trim()) throw new Error("Il nome è obbligatorio.");
            if (isEditing) {
                await updateDoc(doc(db, collectionName, data.id), formData);
            } else {
                await addDoc(collection(db, collectionName), { ...formData, createdAt: serverTimestamp() });
            }
            toast.success("Salvato!", { id: toastId });
            handleCloseModal();
        } catch (error) {
            toast.error(error.message, { id: toastId });
        }
    };
    
    const handleSaveSimple = async (collectionName, formData) => {
        const { data } = modalState;
        const isEditing = !!(data && data.id);
        const toastId = toast.loading("Salvataggio...");
        try {
            if (!formData.name?.trim()) throw new Error("Il nome è obbligatorio.");
            const dataToSave = { name: formData.name };
            
            if (isEditing) {
                await updateDoc(doc(db, collectionName, data.id), dataToSave);
            } else {
                await addDoc(collection(db, collectionName), { ...dataToSave, createdAt: serverTimestamp() });
            }
            toast.success("Salvato!", { id: toastId });
            handleCloseModal();
        } catch (error) {
            toast.error(error.message, { id: toastId });
        }
    };

    const handleSaveUserRole = async (userId, data) => {
    const toastId = toast.loading("Aggiornamento...");
    try {
        // 1. Aggiorna Custom Claims tramite Cloud Function
        const functions = getFunctions(getApp(), 'europe-west1');
        const updateUserRole = httpsCallable(functions, 'updateUserRole');
        const result = await updateUserRole({ 
            uid: userId, 
            newRole: data.role 
        });
        
        if (result.data.status !== 'success') {
            throw new Error(result.data.message || 'Errore aggiornamento ruolo');
        }
        
        // 2. Aggiorna assignedChannels direttamente in Firestore
        if (data.assignedChannels !== undefined) {
            await updateDoc(doc(db, 'users', userId), { 
                assignedChannels: data.assignedChannels 
            });
        }
        
        toast.success("Permessi aggiornati! L'utente deve fare logout/login.", { id: toastId, duration: 5000 });
        handleCloseModal();
    } catch (error) {
        console.error("Errore aggiornamento permessi:", error);
        toast.error(`Errore: ${error.message}`, { id: toastId });
    }
};

    const handleCreateUser = async (userData) => {
        const toastId = toast.loading("Creazione utente...");
        try {
            const functions = getFunctions(getApp(), 'europe-west1');
            const createUserAccount = httpsCallable(functions, 'createUserAccount');
            const result = await createUserAccount(userData);
            if (result.data.status === 'success') {
                toast.success("Utente creato!", { id: toastId });
                handleCloseModal();
            } else {
                throw new Error(result.data.message);
            }
        } catch (error) {
            toast.error(`Errore: ${error.message}`, { id: toastId });
        }
    };

    const TABS = {
        sector_budgets: { label: 'Budget Settori', icon: Target },
        suppliers: { label: 'Fornitori', icon: ShoppingCart, modalType: 'supplier', collectionName: 'channels' },
        branches: { label: 'Filiali', icon: Building2, modalType: 'branch', collectionName: 'branches' },
        sectors: { label: 'Settori', icon: Layers, modalType: 'sector', collectionName: 'sectors' },
        marketing_channels: { label: 'Canali Marketing', icon: RadioTower, modalType: 'marketing_channel', collectionName: 'marketing_channels' },
        channel_categories: { label: 'Categorie', icon: Link2, modalType: 'category', collectionName: 'channel_categories' },
        users: { label: 'Utenti', icon: Users, modalType: 'user_permissions', addModalType: 'add_user', collectionName: 'users' },
    };

    const currentSearchTerm = searchTerms[activeTab] || '';
    const filterItems = (items) => items.filter(item => item.name?.toLowerCase().includes(currentSearchTerm.toLowerCase()));

    const renderTabContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-12">
                    <div className="text-center space-y-4">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="text-gray-600 font-medium">Caricamento...</p>
                    </div>
                </div>
            );
        }
        
        const renderList = (items, collectionName, modalType, renderItemContent, variant = 'default') => (
            <ul className="space-y-3">
                {filterItems(items).map(item => (
                    <SettingsListItem 
                        key={item.id} 
                        onEdit={() => handleOpenModal(modalType, item)} 
                        onDelete={() => handleDelete(collectionName, item.id)}
                        variant={variant}
                    >
                        {renderItemContent(item)}
                    </SettingsListItem>
                ))}
            </ul>
        );
        
        const renderAssociationList = (items, collectionName, modalType, defaultIcon, variant = 'default') => {
            return renderList(items, collectionName, modalType, (item) => {
                const primarySectorId = item.associatedSectors?.[0];
                const primarySectorName = sectorMap.get(primarySectorId);
                const associatedSectorNames = item.associatedSectors?.map(id => sectorMap.get(id)).filter(Boolean).join(', ');
                
                return (
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex-shrink-0">
                            {primarySectorName ? getSectorIcon(primarySectorName) : defaultIcon}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 truncate text-lg">{item.name}</p>
                            {associatedSectorNames && (
                                <p className="text-sm text-gray-600 truncate mt-1">
                                    <span className="font-semibold">Settori:</span> {associatedSectorNames}
                                </p>
                            )}
                        </div>
                    </div>
                );
            }, variant);
        };

        switch (activeTab) {
            case 'sector_budgets':
                return (
                    <div>
                        <div className="flex justify-end mb-6">
                            <select 
                                value={budgetYear} 
                                onChange={e => setBudgetYear(parseInt(e.target.value))} 
                                className="h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all font-semibold"
                            >
                                {[0, -1, -2].map(offset => { 
                                    const y = new Date().getFullYear() + offset; 
                                    return <option key={y} value={y}>{y}</option>; 
                                })}
                            </select>
                        </div>
                        <ul className="space-y-3">
                            {combinedSectorData.map(item => (
                                <SettingsListItem key={item.id} onEdit={() => handleOpenSectorBudgetModal(item)} variant="sector">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                                                {getSectorIcon(item.name)}
                                            </div>
                                            <p className="font-bold text-gray-900 text-lg">{item.name}</p>
                                        </div>
                                        <span className="font-black text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                            {item.budget.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                        </span>
                                    </div>
                                </SettingsListItem>
                            ))}
                        </ul>
                    </div>
                );
            case 'suppliers':
                return renderAssociationList(suppliers, TABS.suppliers.collectionName, TABS.suppliers.modalType, <ShoppingCart className="w-5 h-5 text-indigo-600" />, 'supplier');
            case 'branches':
                return renderAssociationList(branches, TABS.branches.collectionName, TABS.branches.modalType, <Building2 className="w-5 h-5 text-indigo-600" />, 'default');
            case 'sectors':
                return renderList(sectors, TABS.sectors.collectionName, TABS.sectors.modalType, (item) => (
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                            {getSectorIcon(item.name)}
                        </div>
                        <p className="font-bold text-gray-900 text-lg">{item.name}</p>
                    </div>
                ), 'sector');
            case 'marketing_channels':
            case 'channel_categories': {
                const channelItems = activeTab === 'marketing_channels' ? marketingChannels : channelCategories;
                return renderList(channelItems, TABS[activeTab].collectionName, TABS[activeTab].modalType, (item) => (
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                            <RadioTower className="w-5 h-5 text-indigo-600" />
                        </div>
                        <p className="font-bold text-gray-900 text-lg">{item.name}</p>
                    </div>
                ), 'default');
            }
            case 'users':
                return (
                    <ul className="space-y-3">
                        {filterItems(allUsers).map(item => (
                            <SettingsListItem key={item.id} onEdit={() => handleOpenModal('user_permissions', item)} onDelete={() => handleDeleteUser(item.id)} variant="user">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                            {item.name?.charAt(0)?.toUpperCase() || item.email?.charAt(0)?.toUpperCase() || 'U'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 text-lg">{item.name}</p>
                                            <p className="text-sm text-gray-600">{item.email}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold uppercase bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800 px-4 py-2 rounded-xl border-2 border-indigo-200">
                                        {item.role}
                                    </span>
                                </div>
                            </SettingsListItem>
                        ))}
                    </ul>
                );
            default:
                return null;
        }
    };

    const stats = useMemo(() => ({
        totalSectors: sectors.length,
        totalSuppliers: suppliers.length,
        totalBranches: branches.length,
        totalUsers: allUsers.length,
    }), [sectors, suppliers, branches, allUsers]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="relative p-4 lg:p-8 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg">
                        <Settings className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl lg:text-4xl font-black text-gray-900">Impostazioni</h1>
                        <p className="text-gray-600 font-medium mt-1">Gestisci le entità principali della piattaforma</p>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard 
                        title="Settori" 
                        value={stats.totalSectors.toString()} 
                        icon={<Layers className="w-6 h-6" />} 
                        gradient="from-indigo-500 to-purple-600" 
                    />
                    <KpiCard 
                        title="Fornitori" 
                        value={stats.totalSuppliers.toString()} 
                        icon={<ShoppingCart className="w-6 h-6" />} 
                        gradient="from-amber-500 to-orange-600" 
                    />
                    <KpiCard 
                        title="Filiali" 
                        value={stats.totalBranches.toString()} 
                        icon={<Building2 className="w-6 h-6" />} 
                        gradient="from-emerald-500 to-green-600" 
                    />
                    <KpiCard 
                        title="Utenti" 
                        value={stats.totalUsers.toString()} 
                        icon={<Users className="w-6 h-6" />} 
                        gradient="from-blue-500 to-cyan-600" 
                    />
                </div>

                {/* Tabs */}
                <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 p-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                        {Object.entries(TABS).map(([key, { label, icon }]) => ( 
                            <TabButton 
                                key={key} 
                                tabKey={key} 
                                label={label} 
                                icon={icon} 
                                activeTab={activeTab} 
                                setActiveTab={setActiveTab}
                                count={
                                    key === 'sector_budgets' ? sectors.length :
                                    key === 'suppliers' ? suppliers.length :
                                    key === 'branches' ? branches.length :
                                    key === 'sectors' ? sectors.length :
                                    key === 'marketing_channels' ? marketingChannels.length :
                                    key === 'channel_categories' ? channelCategories.length :
                                    key === 'users' ? allUsers.length : undefined
                                }
                            />
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-6">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                        <div className="relative flex-grow">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder={`Cerca in ${TABS[activeTab].label}...`} 
                                value={currentSearchTerm} 
                                onChange={handleSearchChange} 
                                className="w-full md:w-96 h-12 pl-11 pr-4 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all"
                            />
                        </div>
                        {activeTab !== 'sector_budgets' && (
                            <button 
                                onClick={() => handleOpenModal(TABS[activeTab].addModalType || TABS[activeTab].modalType)} 
                                className="h-12 flex items-center justify-center gap-2 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all hover:scale-105"
                            >
                                <PlusCircle size={20} />
                                <span className="hidden sm:inline">Aggiungi</span>
                            </button>
                        )}
                    </div>
                    {renderTabContent()}
                </div>
            </div>

            {/* Modals */}
            {modalState.isOpen && (
                <>
                    {modalState.type === 'supplier' && (
                        <AssociationModal 
                            isOpen={modalState.isOpen} 
                            onClose={handleCloseModal} 
                            onSave={(data) => handleSave('channels', data)} 
                            initialData={modalState.data} 
                            title={modalState.data ? 'Modifica Fornitore' : 'Nuovo Fornitore'} 
                            itemLabel="Nome Fornitore" 
                            associationLists={[
                                { key: 'associatedSectors', label: 'Settori di Competenza', items: sectors }, 
                                { key: 'offeredMarketingChannels', label: 'Canali di Marketing Offerti', items: marketingChannels }
                            ]} 
                        />
                    )}
                    {modalState.type === 'branch' && (
                        <AssociationModal 
                            isOpen={modalState.isOpen} 
                            onClose={handleCloseModal} 
                            onSave={(data) => handleSave('branches', data)} 
                            initialData={modalState.data} 
                            title={modalState.data ? 'Modifica Filiale' : 'Nuova Filiale'} 
                            itemLabel="Nome Filiale" 
                            associationLists={[
                                { key: 'associatedSectors', label: 'Settori di Competenza', items: sectors }
                            ]} 
                        />
                    )}
                    {(modalState.type === 'sector' || modalState.type === 'category') && (
                        <SimpleAddModal 
                            isOpen={modalState.isOpen} 
                            onClose={handleCloseModal} 
                            onSave={(data) => handleSaveSimple(modalState.type === 'sector' ? 'sectors' : 'channel_categories', data)} 
                            initialData={modalState.data} 
                            type={modalState.type} 
                        />
                    )}
                    {modalState.type === 'marketing_channel' && (
                        <MarketingChannelModal 
                            isOpen={modalState.isOpen} 
                            onClose={handleCloseModal} 
                            onSave={(data) => handleSave('marketing_channels', data)} 
                            initialData={modalState.data} 
                            categories={channelCategories} 
                        />
                    )}
                    {modalState.type === 'user_permissions' && (
                        <UserPermissionsModal 
                            isOpen={modalState.isOpen} 
                            onClose={handleCloseModal} 
                            onSave={handleSaveUserRole} 
                            userData={modalState.data} 
                        />
                    )}
                    {modalState.type === 'add_user' && (
                        <AddUserModal 
                            isOpen={modalState.isOpen} 
                            onClose={handleCloseModal} 
                            onSave={handleCreateUser} 
                        />
                    )}
                </>
            )}

            {editingSectorBudget && (
                <SectorBudgetModal
                    isOpen={!!editingSectorBudget}
                    onClose={() => setEditingSectorBudget(null)}
                    onSave={handleSaveSectorBudget}
                    sector={editingSectorBudget}
                    year={budgetYear}
                />
            )}
        </div>
    );
}
