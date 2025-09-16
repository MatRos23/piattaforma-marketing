import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { Users, Layers, Building2, RadioTower, Link2, PlusCircle, Pencil, Trash2, Search, ShoppingCart, Car, Sailboat, Caravan, DollarSign, Settings } from 'lucide-react';
import AssociationModal from '../components/AssociationModal';
import UserPermissionsModal from '../components/UserPermissionsModal';
import AddUserModal from '../components/AddUserModal';
import MarketingChannelModal from '../components/MarketingChannelModal';
import SimpleAddModal from '../components/SimpleAddModal';
import toast from 'react-hot-toast';

// --- COMPONENTI INTERNI ---

const SettingsSkeleton = () => (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 p-6 animate-pulse">
        <div className="flex justify-between items-center mb-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-10 bg-gray-200 rounded-lg w-32"></div>
        </div>
        <div className="h-11 bg-gray-200 rounded-lg w-1/2 mb-6"></div>
        <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg"></div>
            ))}
        </div>
    </div>
);

const SettingsListItem = ({ children, onEdit, onDelete }) => (
    <li className="flex justify-between items-center p-4 bg-white/60 rounded-xl border-2 border-white hover:shadow-lg hover:border-indigo-200/50 transition-all group">
        <div className="flex-1 min-w-0">{children}</div>
        <div className="flex items-center gap-2 ml-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {onEdit && (
                <button onClick={onEdit} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg" title="Modifica">
                    <Pencil size={16} />
                </button>
            )}
            {onDelete && (
                <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-lg" title="Elimina">
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    </li>
);

const sectorIcons = {
    'Auto': <Car className="w-5 h-5 text-gray-600" />,
    'Camper&Caravan': <Caravan className="w-5 h-5 text-gray-600" />,
    'Yachting': <Sailboat className="w-5 h-5 text-gray-600" />,
    'Frattin Group': <Building2 className="w-5 h-5 text-gray-600" />,
    'default': <DollarSign className="w-5 h-5 text-gray-600" />,
};

const getSectorIcon = (sectorName) => sectorIcons[sectorName] || sectorIcons.default;

const TabButton = ({ tabKey, label, icon: Icon, activeTab, setActiveTab }) => {
    const isActive = activeTab === tabKey;
    return (
        <button 
            onClick={() => setActiveTab(tabKey)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${
                isActive 
                    ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md' 
                    : 'text-gray-500 hover:bg-white/60 hover:text-slate-800'
            }`}
        >
            <Icon size={18} />
            <span>{label}</span>
        </button>
    );
};

// --- COMPONENTE PRINCIPALE ---

export default function SettingsPage({ user }) {
    // STATI
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [channelCategories, setChannelCategories] = useState([]);
    
    const [modalState, setModalState] = useState({ isOpen: false, type: null, data: null });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('suppliers');
    const [searchTerms, setSearchTerms] = useState({});

    // MAPPE PER PERFORMANCE
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    
    // CARICAMENTO DATI
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
        
        setTimeout(() => setLoading(false), 500);
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    // FUNZIONI HANDLER
    const handleOpenModal = (type, data = null) => setModalState({ isOpen: true, type, data });
    const handleCloseModal = () => setModalState({ isOpen: false, type: null, data: null });
    const handleSearchChange = (e) => setSearchTerms(prev => ({ ...prev, [activeTab]: e.target.value }));

    const handleDelete = async (collectionName, id) => {
        if (window.confirm("Sei sicuro di voler eliminare questo elemento? L'azione è irreversibile.")) {
            const toastId = toast.loading("Eliminazione in corso...");
            try {
                await deleteDoc(doc(db, collectionName, id));
                toast.success("Elemento eliminato!", { id: toastId });
            } catch (error) {
                toast.error("Errore durante l'eliminazione.", { id: toastId });
                console.error("Deletion error:", error);
            }
        }
    };

    const handleDeleteUser = async (userIdToDelete) => {
        if (userIdToDelete === user.uid) {
            toast.error("Non puoi eliminare te stesso.");
            return;
        }
        if (window.confirm("Sei sicuro di voler eliminare questo utente? L'azione è irreversibile e rimuoverà l'utente da tutti i sistemi.")) {
            const toastId = toast.loading("Eliminazione utente in corso...");
            try {
                const functions = getFunctions(getApp(), 'europe-west1');
                const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
                const result = await deleteUserAccount({ uidToDelete: userIdToDelete });
                if (result.data.status === 'success') {
                    toast.success("Utente eliminato con successo!", { id: toastId });
                } else {
                    throw new Error(result.data.message || 'Errore sconosciuto');
                }
            } catch (error) {
                console.error("Errore eliminazione utente:", error);
                toast.error(`Errore: ${error.message}`, { id: toastId });
            }
        }
    };

    const handleSave = async (collectionName, formData) => {
        const { data } = modalState;
        const isEditing = !!(data && data.id);
        const toastId = toast.loading("Salvataggio in corso...");
        try {
            if (!formData.name?.trim()) throw new Error("Il nome è obbligatorio.");
            let dataToSave = formData;
            
            if (isEditing) {
                await updateDoc(doc(db, collectionName, data.id), dataToSave);
            } else {
                await addDoc(collection(db, collectionName), { ...dataToSave, createdAt: serverTimestamp() });
            }
            toast.success("Salvataggio completato!", { id: toastId });
            handleCloseModal();
        } catch (error) {
            toast.error(error.message || "Errore imprevisto.", { id: toastId });
        }
    };

    const handleSaveSimple = async (collectionName, formData) => {
        const { data } = modalState;
        const isEditing = !!(data && data.id);
        const toastId = toast.loading("Salvataggio in corso...");
        try {
            if (!formData.name?.trim()) throw new Error("Il nome è obbligatorio.");
            const dataToSave = { name: formData.name };
            
            if (isEditing) {
                await updateDoc(doc(db, collectionName, data.id), dataToSave);
            } else {
                await addDoc(collection(db, collectionName), { ...dataToSave, createdAt: serverTimestamp() });
            }
            toast.success("Salvataggio completato!", { id: toastId });
            handleCloseModal();
        } catch (error) {
            toast.error(error.message || "Errore imprevisto.", { id: toastId });
        }
    };

    const handleSaveUserRole = async (userId, data) => {
        const toastId = toast.loading("Aggiornamento ruolo...");
        try {
            await updateDoc(doc(db, 'users', userId), data);
            toast.success("Ruolo aggiornato!", { id: toastId });
            handleCloseModal();
        } catch (error) {
            toast.error("Errore nell'aggiornamento del ruolo.", { id: toastId });
        }
    };

    const handleCreateUser = async (userData) => {
        const toastId = toast.loading("Creazione utente in corso...");
        try {
            const functions = getFunctions(getApp(), 'europe-west1');
            const createUserAccount = httpsCallable(functions, 'createUserAccount');
            const result = await createUserAccount(userData);
            if (result.data.status === 'success') {
                toast.success("Utente creato con successo!", { id: toastId });
                handleCloseModal();
            } else {
                throw new Error(result.data.message || 'Errore sconosciuto');
            }
        } catch (error) {
            console.error("Errore creazione utente:", error);
            toast.error(`Errore: ${error.message}`, { id: toastId });
        }
    };

    const TABS = {
        suppliers: { label: 'Fornitori', icon: ShoppingCart, modalType: 'supplier', collectionName: 'channels' },
        branches: { label: 'Filiali', icon: Building2, modalType: 'branch', collectionName: 'branches' },
        sectors: { label: 'Settori', icon: Layers, modalType: 'sector', collectionName: 'sectors' },
        marketing_channels: { label: 'Canali Marketing', icon: RadioTower, modalType: 'marketing_channel', collectionName: 'marketing_channels' },
        channel_categories: { label: 'Categorie Canali', icon: Link2, modalType: 'category', collectionName: 'channel_categories' },
        users: { label: 'Utenti', icon: Users, modalType: 'user_permissions', addModalType: 'add_user', collectionName: 'users' },
    };

    const currentSearchTerm = searchTerms[activeTab] || '';
    const filterItems = (items) => items.filter(item => item.name?.toLowerCase().includes(currentSearchTerm.toLowerCase()));

    const renderTabContent = () => {
        if (loading) return <SettingsSkeleton />;

        const renderList = (items, collectionName, modalType, renderItemContent) => (
            <ul className="space-y-2">
                {filterItems(items).map(item => (
                    <SettingsListItem key={item.id} onEdit={() => handleOpenModal(modalType, item)} onDelete={() => handleDelete(collectionName, item.id)}>
                        {renderItemContent(item)}
                    </SettingsListItem>
                ))}
            </ul>
        );
        
        const renderAssociationList = (items, collectionName, modalType, defaultIcon) => {
             return renderList(items, collectionName, modalType, (item) => {
                const primarySectorId = item.associatedSectors?.[0];
                const primarySectorName = sectorMap.get(primarySectorId);
                const associatedSectorNames = item.associatedSectors?.map(id => sectorMap.get(id)).filter(Boolean).join(', ');
                
                return (
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gray-100 rounded-xl flex-shrink-0">
                            {primarySectorName ? getSectorIcon(primarySectorName) : defaultIcon}
                        </div>
                        <div className="min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                            {associatedSectorNames && (
                                <p className="text-sm text-gray-500 truncate">
                                    Settori: {associatedSectorNames}
                                </p>
                            )}
                        </div>
                    </div>
                );
            });
        };

        switch (activeTab) {
            case 'suppliers':
                return renderAssociationList(suppliers, TABS.suppliers.collectionName, TABS.suppliers.modalType, <ShoppingCart className="w-5 h-5 text-gray-600" />);
            case 'branches':
                 return renderAssociationList(branches, TABS.branches.collectionName, TABS.branches.modalType, <Building2 className="w-5 h-5 text-gray-600" />);
            case 'sectors':
                return renderList(sectors, TABS.sectors.collectionName, TABS.sectors.modalType, (item) => (
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gray-100 rounded-xl">{getSectorIcon(item.name, 'w-5 h-5 text-gray-600')}</div>
                        <p className="font-semibold text-gray-800">{item.name}</p>
                    </div>
                ));
            case 'marketing_channels':
            case 'channel_categories':
                const channelItems = activeTab === 'marketing_channels' ? marketingChannels : channelCategories;
                return renderList(channelItems, TABS[activeTab].collectionName, TABS[activeTab].modalType, (item) => (
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-gray-100 rounded-xl"><RadioTower className="w-5 h-5 text-gray-600" /></div>
                        <p className="font-semibold text-gray-800">{item.name}</p>
                    </div>
                ));
            case 'users':
                return (
                     <ul className="space-y-2">
                        {filterItems(allUsers).map(item => (
                            <SettingsListItem 
                                key={item.id} 
                                onEdit={() => handleOpenModal('user_permissions', item)}
                                onDelete={() => handleDeleteUser(item.id)}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div>
                                        <p className="font-semibold text-gray-800">{item.name}</p>
                                        <p className="text-sm text-gray-500">{item.email}</p>
                                    </div>
                                    <span className="text-xs font-bold uppercase bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">{item.role}</span>
                                </div>
                            </SettingsListItem>
                        ))}
                    </ul>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100">
            <div className="relative p-4 lg:p-8 space-y-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-700 to-gray-900 text-white shadow-lg">
                        <Settings className="w-7 h-7" />
                    </div>
                    <div>
                        <h1 className="text-3xl lg:text-4xl font-black text-gray-900">Impostazioni</h1>
                        <p className="text-gray-600 font-medium mt-1">Gestisci le entità principali della tua applicazione</p>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30 p-2">
                    <div className="flex items-center gap-2 overflow-x-auto">
                        {Object.entries(TABS).map(([key, { label, icon }]) => (
                            <TabButton 
                                key={key} 
                                tabKey={key} 
                                label={label} 
                                icon={icon} 
                                activeTab={activeTab} 
                                setActiveTab={setActiveTab} 
                            />
                        ))}
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 p-6">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                         <div className="relative flex-grow">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder={`Cerca in ${TABS[activeTab].label}...`}
                                value={currentSearchTerm}
                                onChange={handleSearchChange}
                                className="w-full md:w-72 h-11 pl-11 pr-4 bg-white border-2 border-gray-200 rounded-xl focus:border-slate-500 focus:ring-4 focus:ring-slate-500/20 transition-all" 
                            />
                        </div>
                        <button onClick={() => handleOpenModal(TABS[activeTab].addModalType || TABS[activeTab].modalType)} className="h-11 flex items-center justify-center gap-2 px-5 bg-gradient-to-r from-slate-800 to-slate-900 text-white font-semibold rounded-xl hover:shadow-lg transition-all hover:scale-105">
                            <PlusCircle size={20} />
                            <span className="hidden sm:inline">Aggiungi {TABS[activeTab].label}</span>
                        </button>
                    </div>
                    {renderTabContent()}
                </div>
            </div>

            {modalState.isOpen && (
                <>
                    {modalState.type === 'supplier' && (
                         <AssociationModal isOpen={modalState.isOpen} onClose={handleCloseModal} onSave={(data) => handleSave('channels', data)} initialData={modalState.data} title={modalState.data ? 'Modifica Fornitore' : 'Nuovo Fornitore'} itemLabel="Nome Fornitore" associationLists={[{ key: 'associatedSectors', label: 'Settori di Competenza', items: sectors }, { key: 'offeredMarketingChannels', label: 'Canali di Marketing Offerti', items: marketingChannels }]} />
                    )}
                    {modalState.type === 'branch' && (
                         <AssociationModal isOpen={modalState.isOpen} onClose={handleCloseModal} onSave={(data) => handleSave('branches', data)} initialData={modalState.data} title={modalState.data ? 'Modifica Filiale' : 'Nuova Filiale'} itemLabel="Nome Filiale" associationLists={[{ key: 'associatedSectors', label: 'Settori di Competenza', items: sectors }]} />
                    )}
                    {(modalState.type === 'sector' || modalState.type === 'category') && (
                        <SimpleAddModal isOpen={modalState.isOpen} onClose={handleCloseModal} onSave={(data) => handleSaveSimple(modalState.type === 'sector' ? 'sectors' : 'channel_categories', data)} initialData={modalState.data} type={modalState.type} />
                    )}
                    {modalState.type === 'marketing_channel' && (
                        <MarketingChannelModal isOpen={modalState.isOpen} onClose={handleCloseModal} onSave={(data) => handleSave('marketing_channels', data)} initialData={modalState.data} categories={channelCategories} />
                    )}
                    {modalState.type === 'user_permissions' && (
                        <UserPermissionsModal isOpen={modalState.isOpen} onClose={handleCloseModal} onSave={handleSaveUserRole} userData={modalState.data} />
                    )}
                    {modalState.type === 'add_user' && (
                        <AddUserModal isOpen={modalState.isOpen} onClose={handleCloseModal} onSave={handleCreateUser} />
                    )}
                </>
            )}
        </div>
    );
}