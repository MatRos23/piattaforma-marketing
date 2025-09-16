import React from 'react';
import { LayoutDashboard, FileText, ShoppingCart, Target, Settings, LogOut, FileSignature, BarChart3 } from 'lucide-react';

// Componente interno riutilizzabile per ogni voce di navigazione
const NavItem = ({ icon, label, isActive, onClick }) => (
    <li>
        <button
            onClick={onClick}
            className={`flex items-center w-full p-3 rounded-xl transition-all duration-300 relative ${
                isActive
                    ? 'bg-white/10 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
            }`}
        >
            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-pink-500 rounded-r-full"></div>}
            {icon}
            <span className="ml-4 font-semibold">{label}</span>
        </button>
    </li>
);

export default function Sidebar({ user, currentPage, setCurrentPage, handleLogout }) {
    return (
        <aside className="w-64 flex-shrink-0 bg-gradient-to-b from-gray-900 to-slate-800 flex flex-col p-4">
            <div className="flex items-center gap-3 px-3 mb-10 mt-2">
                <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
                    <BarChart3 className="text-white" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-wider">MarketingApp</h1>
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
                    {(user.role === 'admin' || user.role === 'manager') && (
                        <NavItem
                            icon={<FileSignature size={20} />}
                            label="Contratti"
                            isActive={currentPage === 'contracts'}
                            onClick={() => setCurrentPage('contracts')}
                        />
                    )}
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
                <div className="p-3 border-t border-white/10">
                    <p className="font-bold text-white truncate">{user.name || user.email}</p>
                    <p className="text-sm text-gray-400 truncate">{user.email}</p>
                </div>
                <button
                    onClick={handleLogout}
                    className="flex items-center w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                >
                    <LogOut size={20} />
                    <span className="ml-4 font-semibold">Logout</span>
                </button>
            </div>
        </aside>
    );
}