import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, addDoc, doc, deleteDoc, updateDoc, orderBy } from 'firebase/firestore';
import { Users, Layers, Building2, RadioTower, MapPin, PlusCircle, Pencil, Trash2, KeyRound, ShoppingCart } from 'lucide-react';
import AssociationModal from '../components/AssociationModal';
import UserPermissionsModal from '../components/UserPermissionsModal';
import AddUserModal from '../components/AddUserModal';
import MarketingChannelModal from '../components/MarketingChannelModal';
import SimpleAddModal from '../components/SimpleAddModal';
import Spinner from '../components/Spinner';
import SettingsListItem from '../components/SettingsListItem';
import toast from 'react-hot-toast';

const SettingsCard = ({ title, icon: Icon, onAdd, children, isLoading }) => (
    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Icon size={22} /> {title}</h3>
            {onAdd && <button onClick={onAdd} className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition-transform hover:scale-110" title={`Aggiungi ${title}`}><PlusCircle size={20} /></button>}
        </div>
        {isLoading ? <Spinner /> : children}
    </div>
);

export default function SettingsPage({ user }) {
    // STATI
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [channelCategories, setChannelCategories] = useState([]);
    const [geographicAreas, setGeographicAreas] = useState([]);
    
    const [modalState, setModalState] = useState({ isOpen: false, type: null, data: null });
    const [loading, setLoading] = useState({ sectors: true, branches: true, suppliers: true, users: true, categories: true, areas: true, marketingChannels: true });
    
    const [searchTerm, setSearchTerm] = useState({ suppliers: '', branches: '', marketingChannels: '' });

    // MAPPE
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const marketingChannelMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.name])), [marketingChannels]);
    const categoryMap = useMemo(() => new Map(channelCategories.map(c => [c.id, c.name])), [channelCategories]);

    // CARICAMENTO DATI
    useEffect(() => {
        const collections = {
            sectors: { setter: setSectors, name: "sectors" },
            branches: { setter: setBranches, name: "branches" },
            suppliers: { setter: setSuppliers, name: "channels" },
            marketingChannels: { setter: setMarketingChannels, name: "marketing_channels" },
            users: { setter: setAllUsers, name: "users" },
            categories: { setter: setChannelCategories, name: "channel_categories" },
            areas: { setter: setGeographicAreas, name: "geographic_areas" },
        };
        const unsubs = Object.entries(collections).map(([key, { setter, name }]) => 
            onSnapshot(query(collection(db, name), orderBy("name")), snap => {
                setter(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setLoading(prev => ({ ...prev, [key]: false }));
            })
        );
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    // FUNZIONI HANDLER
    const handleOpenModal = (type, data = null) => setModalState({ isOpen: true, type, data });
    const handleCloseModal = () => setModalState({ isOpen: false, type: null, data: null });

    const handleDeleteSimple = async (collectionName, id) => {
        if (window.confirm("Sei sicuro di voler eliminare questo elemento?")) {
            await deleteDoc(doc(db, collectionName, id));
            toast.success("Elemento eliminato.");
        }
    };
    
    const handleSaveAssociation = async (formData) => {
        const { type, data } = modalState;
        const isEditing = !!(data && data.id);
        const collNameMap = {'branch':'branches', 'supplier':'channels', 'area':'geographic_areas', 'marketing_channel': 'marketing_channels', 'sector': 'sectors', 'category': 'channel_categories'};
        const collName = collNameMap[type];
        if (!collName) return toast.error("Tipo di entità non valido.");

        const toastId = toast.loading("Salvataggio...");
        try {
            if (isEditing) {
                await updateDoc(doc(db, collName, data.id), formData);
            } else {
                if (!formData.name?.trim()) throw new Error("Il nome è obbligatorio.");
                await addDoc(collection(db, collName), formData);
            }
            toast.success("Salvataggio completato!", { id: toastId });
            handleCloseModal();
        } catch (error) {
            toast.error(error.message || "Errore imprevisto.", { id: toastId });
        }
    };

    const handleSavePermissions = async (userId, assignedChannels, role) => {
        const toastId = toast.loading("Salvataggio permessi...");
        try {
            const userDocRef = doc(db, "users", userId);
            await updateDoc(userDocRef, { role: role, assignedChannels: assignedChannels });
            toast.success("Permessi aggiornati!", { id: toastId });
            handleCloseModal();
        } catch (error) { toast.error("Errore durante il salvataggio.", { id: toastId }); }
    };

    const handleDeleteUser = async (userToDelete) => {
        if (userToDelete.id === user.uid) return toast.error("Non puoi eliminare te stesso.");
        if (window.confirm(`ATTENZIONE: Stai per eliminare l'utente ${userToDelete.name}. Sei sicuro?`)) {
            const toastId = toast.loading("Eliminazione utente...");
            try {
                const functions = getFunctions(undefined, 'europe-west1');
                const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
                await deleteUserAccount({ uidToDelete: userToDelete.id });
                toast.success("Utente eliminato.", { id: toastId });
            } catch (error) { toast.error(error.message || "Errore durante l'eliminazione.", { id: toastId }); }
        }
    };

    // LISTE FILTRATE PER LA RICERCA
    const filteredSuppliers = useMemo(() => suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.suppliers.toLowerCase())), [suppliers, searchTerm.suppliers]);
    const filteredBranches = useMemo(() => branches.filter(b => b.name.toLowerCase().includes(searchTerm.branches.toLowerCase())), [branches, searchTerm.branches]);
    const filteredMarketingChannels = useMemo(() => marketingChannels.filter(mc => mc.name.toLowerCase().includes(searchTerm.marketingChannels.toLowerCase())), [marketingChannels, searchTerm.marketingChannels]);

   return (
        <div className="p-8 space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Impostazioni</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <SettingsCard title="Gestione Settori" icon={Layers} onAdd={() => handleOpenModal('sector')} isLoading={loading.sectors}>
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{sectors.map(s => <SettingsListItem key={s.id} onEdit={() => handleOpenModal('sector', s)} onDelete={() => handleDeleteSimple('sectors', s.id)}><div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full border" style={{ backgroundColor: s.color || '#E5E7EB' }}></div><span className="font-medium">{s.name}</span></div></SettingsListItem>)}</ul>
                </SettingsCard>

                <SettingsCard title="Gestione Utenti" icon={Users} onAdd={() => handleOpenModal('addUser')} isLoading={loading.users}>
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{allUsers.filter(u => u.id !== user.id).map(u => (<SettingsListItem key={u.id} onEdit={() => handleOpenModal('user', u)} onDelete={() => handleDeleteUser(u)}><div><p className="font-medium text-gray-800">{u.name}</p><p className="text-sm text-gray-500 capitalize">{u.role}</p>{u.assignedChannels && u.assignedChannels.length > 0 && (<p className="text-xs text-indigo-600 mt-1 font-semibold">{u.assignedChannels.length} {u.assignedChannels.length > 1 ? 'fornitori assegnati' : 'fornitore assegnato'}</p>)}</div></SettingsListItem>))}</ul>
                </SettingsCard>
                
                <SettingsCard title="Gestione Categorie Canali" icon={KeyRound} onAdd={() => handleOpenModal('category')} isLoading={loading.categories}>
                     <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{channelCategories.map(cat => <SettingsListItem key={cat.id} onEdit={() => handleOpenModal('category', cat)} onDelete={() => handleDeleteSimple('channel_categories', cat.id)}><span>{cat.name}</span></SettingsListItem>)}</ul>
                </SettingsCard>

                <SettingsCard title="Gestione Canali di Marketing" icon={RadioTower} onAdd={() => handleOpenModal('marketing_channel')} isLoading={loading.marketingChannels}>
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{marketingChannels.map(mc => <SettingsListItem key={mc.id} onEdit={() => handleOpenModal('marketing_channel', mc)} onDelete={() => handleDeleteSimple('marketing_channels', mc.id)}><div><span className="font-medium">{mc.name}</span><p className="text-xs text-gray-500">{categoryMap.get(mc.categoryId) || 'Nessuna categoria'}</p></div></SettingsListItem>)}</ul>
                </SettingsCard>

                <div className="lg:col-span-2">
                    <SettingsCard title="Gestione Filiali" icon={Building2} onAdd={() => handleOpenModal('branch')} isLoading={loading.branches}>
                         <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{branches.map(b => <SettingsListItem key={b.id} onEdit={() => handleOpenModal('branch', b)} onDelete={() => handleDeleteSimple('branches', b.id)}><div><span className="font-medium">{b.name}</span><p className="text-xs text-gray-500 mt-1">Settori: {b.associatedSectors?.map(sId => sectorMap.get(sId)).join(', ') || 'Nessuno'}</p></div></SettingsListItem>)}</ul>
                    </SettingsCard>
                </div>

                <div className="lg:col-span-2">
                    <SettingsCard title="Gestione Fornitori" icon={ShoppingCart} onAdd={() => handleOpenModal('supplier')} isLoading={loading.suppliers}>
                        <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">{suppliers.map(s => <SettingsListItem key={s.id} onEdit={() => handleOpenModal('supplier', s)} onDelete={() => handleDeleteSimple('channels', s.id)}><div><span className="font-medium">{s.name}</span><p className="text-xs text-gray-500 mt-1">Canali Offerti: {s.offeredMarketingChannels?.map(id => marketingChannelMap.get(id)).join(', ') || 'Nessuno'}</p></div></SettingsListItem>)}</ul>
                    </SettingsCard>
                </div>
            </div>
            
            {/* Sezione Modali */}
            {modalState.isOpen && (modalState.type === 'sector' || modalState.type === 'category' || modalState.type === 'area') && (<SimpleAddModal isOpen={true} onClose={handleCloseModal} onSave={handleSaveAssociation} initialData={modalState.data} type={modalState.type}/>)}
            {modalState.isOpen && modalState.type === 'marketing_channel' && (<MarketingChannelModal isOpen={true} onClose={handleCloseModal} onSave={handleSaveAssociation} initialData={modalState.data} categories={channelCategories}/>)}
            {modalState.isOpen && modalState.type === 'branch' && (<AssociationModal isOpen={true} onClose={handleCloseModal} onSave={handleSaveAssociation} initialData={modalState.data} associationLists={[{ key: 'associatedSectors', label: 'Seleziona i settori da associare:', items: sectors }]} title={modalState.data ? 'Modifica Filiale' : 'Aggiungi Filiale'} itemLabel="Nome Filiale" />)}
            {modalState.isOpen && modalState.type === 'supplier' && (<AssociationModal isOpen={true} onClose={handleCloseModal} onSave={handleSaveAssociation} initialData={modalState.data} associationLists={[{ key: 'offeredMarketingChannels', label: 'Canali di Marketing Offerti:', items: marketingChannels }]} title={modalState.data ? 'Modifica Fornitore' : 'Aggiungi Fornitore'} itemLabel="Nome Fornitore" channelCategories={channelCategories}/>)}
            {modalState.isOpen && modalState.type === 'user' && (<UserPermissionsModal isOpen={true} onClose={handleCloseModal} onSave={handleSavePermissions} userData={modalState.data} channels={suppliers} />)}
            {modalState.isOpen && modalState.type === 'addUser' && (<AddUserModal isOpen={true} onClose={handleCloseModal} />)}
        </div>
    );
}