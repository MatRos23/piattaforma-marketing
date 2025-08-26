import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { Users, Layers, Building2, RadioTower, MapPin, PlusCircle, Pencil, Trash2, Search, ShoppingCart, Link2, Car, Sailboat, Caravan, DollarSign } from 'lucide-react';
import AssociationModal from '../components/AssociationModal';
import UserPermissionsModal from '../components/UserPermissionsModal';
import AddUserModal from '../components/AddUserModal';
import MarketingChannelModal from '../components/MarketingChannelModal';
import SimpleAddModal from '../components/SimpleAddModal';
import toast from 'react-hot-toast';

// --- COMPONENTI INTERNI ---

const SettingsSkeleton = () => (
    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl shadow-lg border animate-pulse">
        <div className="flex justify-between items-center mb-4">
            <div className="h-7 bg-gray-200 rounded w-1/4"></div>
            <div className="h-9 bg-gray-200 rounded-full w-24"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg"></div>
            ))}
        </div>
    </div>
);

const SettingsListItem = ({ children, onEdit, onDelete }) => (
    <li className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
        <div className="flex-1 min-w-0">{children}</div>
        <div className="flex items-center gap-2 ml-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
                <button onClick={onEdit} className="text-gray-400 hover:text-indigo-600" title="Modifica">
                    <Pencil size={16} />
                </button>
            )}
            {onDelete && (
                <button onClick={onDelete} className="text-gray-400 hover:text-red-500" title="Elimina">
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    </li>
);

const sectorIcons = {
    'Auto': <Car className="w-5 h-5 text-gray-500" />,
    'Camper&Caravan': <Caravan className="w-5 h-5 text-gray-500" />,
    'Yachting': <Sailboat className="w-5 h-5 text-gray-500" />,
    'Frattin Group': <Building2 className="w-5 h-5 text-gray-500" />,
    'default': <DollarSign className="w-5 h-5 text-gray-500" />,
};
const getSectorIcon = (sectorName) => sectorIcons[sectorName] || sectorIcons.default;


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
        
        setLoading(false);
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
        suppliers: { label: 'Fornitori', icon: <ShoppingCart size={18} />, modalType: 'supplier' },
        branches: { label: 'Filiali', icon: <Building2 size={18} />, modalType: 'branch' },
        sectors: { label: 'Settori', icon: <Layers size={18} />, modalType: 'sector' },
        marketing_channels: { label: 'Canali Marketing', icon: <RadioTower size={18} />, modalType: 'marketing_channel' },
        channel_categories: { label: 'Categorie Canali', icon: <Link2 size={18} />, modalType: 'category' },
        users: { label: 'Utenti', icon: <Users size={18} />, modalType: 'user_permissions', addModalType: 'add_user' },
    };
    
    const currentSearchTerm = searchTerms[activeTab] || '';
    const filterItems = (items) => items.filter(item => item.name?.toLowerCase().includes(currentSearchTerm.toLowerCase()));

    const renderTabContent = () => {
        if (loading) return <SettingsSkeleton />;

        switch (activeTab) {
            case 'suppliers':
                return (
                    <ul className="space-y-2">
                        {filterItems(suppliers).map(item => (
                            <SettingsListItem key={item.id} onEdit={() => handleOpenModal('supplier', item)} onDelete={() => handleDelete('channels', item.id)}>
                                <p className="font-semibold text-gray-800">{item.name}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {item.associatedSectors?.map(id => <span key={id} className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{sectorMap.get(id) || '...'}</span>)}
                                </div>
                            </SettingsListItem>
                        ))}
                    </ul>
                );
            case 'branches':
                 return (
                    <ul className="space-y-2">
                        {filterItems(branches).map(item => (
                            <SettingsListItem key={item.id} onEdit={() => handleOpenModal('branch', item)} onDelete={() => handleDelete('branches', item.id)}>
                                <p className="font-semibold text-gray-800">{item.name}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {item.associatedSectors?.map(id => <span key={id} className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{sectorMap.get(id) || '...'}</span>)}
                                </div>
                            </SettingsListItem>
                        ))}
                    </ul>
                );
            case 'sectors':
                 return (
                    <ul className="space-y-2">
                        {filterItems(sectors).map(item => (
                            <SettingsListItem key={item.id} onEdit={() => handleOpenModal('sector', item)} onDelete={() => handleDelete('sectors', item.id)}>
                                <div className="flex items-center gap-3">
                                    {getSectorIcon(item.name)}
                                    <p className="font-semibold text-gray-800">{item.name}</p>
                                </div>
                            </SettingsListItem>
                        ))}
                    </ul>
                );
            case 'marketing_channels':
                 return (
                    <ul className="space-y-2">
                        {filterItems(marketingChannels).map(item => (
                            <SettingsListItem key={item.id} onEdit={() => handleOpenModal('marketing_channel', item)} onDelete={() => handleDelete('marketing_channels', item.id)}>
                                <p className="font-semibold text-gray-800">{item.name}</p>
                            </SettingsListItem>
                        ))}
                    </ul>
                );
            case 'channel_categories':
                 return (
                    <ul className="space-y-2">
                        {filterItems(channelCategories).map(item => (
                            <SettingsListItem key={item.id} onEdit={() => handleOpenModal('category', item)} onDelete={() => handleDelete('channel_categories', item.id)}>
                                <p className="font-semibold text-gray-800">{item.name}</p>
                            </SettingsListItem>
                        ))}
                    </ul>
                );
            case 'users':
                 return (
                    <ul className="space-y-2">
                        {filterItems(allUsers).map(item => (
                            <SettingsListItem 
                                key={item.id} 
                                onEdit={() => handleOpenModal('user_permissions', item)}
                                onDelete={() => handleDeleteUser(item.id)}
                            >
                                <div>
                                    <p className="font-semibold text-gray-800">{item.name}</p>
                                    <p className="text-sm text-gray-500">{item.email}</p>
                                </div>
                                <span className="text-xs font-bold uppercase bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{item.role}</span>
                            </SettingsListItem>
                        ))}
                    </ul>
                );
            default:
                return null;
        }
    };

    return (
        <div className="p-8 space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Impostazioni</h1>
            
            <div className="flex border-b border-gray-200 overflow-x-auto">
                {Object.entries(TABS).map(([key, { label, icon }]) => (
                    <button 
                        key={key} 
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors flex-shrink-0 ${activeTab === key ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        {icon}
                        {label}
                    </button>
                ))}
            </div>

            <div className="bg-white/70 backdrop-blur-sm p-6 rounded-xl shadow-lg border">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder={`Cerca in ${TABS[activeTab].label}...`}
                            value={currentSearchTerm}
                            onChange={handleSearchChange}
                            className="w-full md:w-80 h-11 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" 
                        />
                    </div>
                    <button onClick={() => handleOpenModal(TABS[activeTab].addModalType || TABS[activeTab].modalType)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 h-full shadow-sm w-full md:w-auto justify-center">
                        <PlusCircle size={20} />Aggiungi
                    </button>
                </div>
                {renderTabContent()}
            </div>

            {/* Logica di rendering dei Modal */}
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
