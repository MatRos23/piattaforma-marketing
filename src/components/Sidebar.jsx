import React from 'react';
import { LayoutDashboard, FileText, ShoppingCart, Target, Settings, LogOut, FileSignature } from 'lucide-react';

// Componente interno riutilizzabile per ogni voce di navigazione
const NavItem = ({ icon, label, isActive, onClick }) => (
    <li>
        <button
            onClick={onClick}
            className={`flex items-center w-full p-3 rounded-lg transition-colors ${
                isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
        >
            {icon}
            <span className="ml-3 font-semibold">{label}</span>
        </button>
    </li>
);

export default function Sidebar({ user, currentPage, setCurrentPage, handleLogout }) {
    return (
        <aside className="w-64 flex-shrink-0 bg-white border-r flex flex-col p-4 shadow-lg">
            <div className="px-3 mb-8">
                <h1 className="text-2xl font-bold text-indigo-700">MarketingApp</h1>
            </div>

            <nav className="flex-1">
                <ul className="space-y-2">
                    <NavItem
                        icon={<LayoutDashboard size={20} />}
                        label="Dashboard"
                        isActive={currentPage === 'dashboard'}
                        onClick={() => setCurrentPage('dashboard')}
                    />
                    <NavItem
                        icon={<ShoppingCart size={20} />}
                        label="Spese"
                        isActive={currentPage === 'expenses'}
                        onClick={() => setCurrentPage('expenses')}
                    />
                    {(user.role === 'admin' || user.role === 'manager') && (
                        <NavItem
                            icon={<Target size={20} />}
                            label="Budget"
                            isActive={currentPage === 'budget'}
                            onClick={() => setCurrentPage('budget')}
                        />
                    )}
                    {/* --- NUOVO LINK PER I CONTRATTI --- */}
                    {(user.role === 'admin' || user.role === 'manager') && (
                        <NavItem
                            icon={<FileSignature size={20} />}
                            label="Contratti"
                            isActive={currentPage === 'contracts'}
                            onClick={() => setCurrentPage('contracts')}
                        />
                    )}
                    {/* --- FINE NUOVO LINK --- */}
                    {(user.role === 'admin' || user.role === 'manager') && (
                        <NavItem
                            icon={<Settings size={20} />}
                            label="Impostazioni"
                            isActive={currentPage === 'settings'}
                            onClick={() => setCurrentPage('settings')}
                        />
                    )}
                </ul>
            </nav>

            <div className="mt-auto">
                <div className="p-3 border-t">
                    <p className="font-bold text-gray-800 truncate">{user.name || user.email}</p>
                    <p className="text-sm text-gray-500 truncate">{user.email}</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full p-3 rounded-lg text-red-600 hover:bg-red-50"
                >
                    <LogOut size={20} />
                    <span className="ml-3 font-semibold">Logout</span>
                </button>
            </div>
        </aside>
    );
}