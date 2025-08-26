import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Settings,
  BarChart3,
  LogOut,
  UserCircle,
  PiggyBank
} from 'lucide-react';

// Componente per un singolo link nella sidebar
const NavLink = ({ icon, text, active, onClick }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-200
      ${active
        ? 'bg-indigo-600 text-white shadow-md'
        : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
      }
    `}
  >
    {icon}
    <span className="ml-3">{text}</span>
  </button>
);

// Componente principale della Sidebar
export default function Sidebar({ user, currentPage, setCurrentPage, handleLogout }) {
  
  // *** LOGICA PER MOSTRARE I LINK IN BASE AL RUOLO ***
  const allNavItems = [
    { id: 'dashboard', text: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: ['manager', 'collaborator', 'admin'] },
    { id: 'expenses', text: 'Spese', icon: <Receipt size={20} />, roles: ['manager', 'collaborator', 'admin'] },
    { id: 'budget', text: 'Budget', icon: <PiggyBank size={20} />, roles: ['manager', 'admin'] },
    { id: 'settings', text: 'Impostazioni', icon: <Settings size={20} />, roles: ['manager', 'admin'] }
  ];

  // Filtra i link di navigazione in base al ruolo dell'utente corrente
  const navItems = allNavItems.filter(item => item.roles.includes(user.role));

  return (
    <aside className="w-64 h-screen p-4 bg-white border-r border-slate-200 flex flex-col flex-shrink-0">
      {/* Sezione Logo */}
      <div className="flex items-center h-16 px-2 mb-6">
        <BarChart3 className="w-8 h-8 text-indigo-600" />
        <h1 className="ml-2 text-xl font-bold text-slate-800">MarketingApp</h1>
      </div>

      {/* Sezione Navigazione (ora mostra solo i link permessi) */}
      <nav className="flex-grow space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.id}
            text={item.text}
            icon={item.icon}
            active={currentPage === item.id}
            onClick={() => setCurrentPage(item.id)}
          />
        ))}
      </nav>

      {/* Sezione Utente e Logout */}
      <div className="mt-auto">
        <div className="p-3 mb-2 bg-slate-100 rounded-lg">
          <div className="flex items-center">
            <UserCircle size={36} className="text-slate-500" />
            <div className="ml-3">
              <p className="text-sm font-semibold text-slate-700 truncate">{user?.name || 'Utente'}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
        <NavLink
          text="Logout"
          icon={<LogOut size={20} />}
          onClick={handleLogout}
        />
      </div>
    </aside>
  );
}
