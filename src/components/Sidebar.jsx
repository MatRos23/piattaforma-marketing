import React from 'react';
import { LayoutDashboard, ShoppingCart, Target, Settings, LogOut, FileSignature, BarChart3} from 'lucide-react';

const NavItem = ({ icon, label, isActive, onClick }) => (
    <li>
        <button
            onClick={onClick}
            className={`flex items-center w-full p-3 lg:p-3.5 rounded-xl transition-all duration-300 group ${
                isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-gray-400 hover:bg-white/20 hover:text-white'
            }`}
        >
            {isActive && (
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-5 w-1.5 bg-white rounded-r-full shadow-lg" />
            )}
            <span className="group-hover:scale-110 transition-transform">
                {icon}
            </span>
            <span className="ml-3 lg:ml-4 font-semibold text-sm lg:text-base">{label}</span>
        </button>
    </li>
);

export default function Sidebar({ user, currentPage, setCurrentPage, handleLogout, isMobileMenuOpen, setIsMobileMenuOpen }) {
    const closeMobileMenu = () => setIsMobileMenuOpen(false);
    
    const handleNavClick = (page) => {
        setCurrentPage(page);
        closeMobileMenu();
    };

    return (
        <>
            {/* Backdrop - Only on mobile */}
            {isMobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed lg:static inset-y-0 left-0 z-40
                    w-72 lg:w-64 xl:w-72
                    bg-gray-900/80 backdrop-blur-xl border-r border-white/10
                    flex flex-col p-4 lg:p-5
                    shadow-2xl
                    transition-transform duration-300 ease-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
`               }
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-3 mb-8 lg:mb-10 mt-2 lg:mt-0">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 rounded-xl shadow-lg">
                        <BarChart3 className="text-white w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl lg:text-2xl font-black text-white tracking-wider truncate">
                            MarketingApp
                        </h1>
                        <p className="text-xs text-gray-400 font-medium">Budget Platform</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    <ul className="space-y-2">
                        <NavItem
                            icon={<LayoutDashboard size={20} />}
                            label="Dashboard"
                            isActive={currentPage === 'dashboard'}
                            onClick={() => handleNavClick('dashboard')}
                        />
                        <NavItem
                            icon={<ShoppingCart size={20} />}
                            label="Spese"
                            isActive={currentPage === 'expenses'}
                            onClick={() => handleNavClick('expenses')}
                        />
                        {(user.role === 'admin' || user.role === 'manager') && (
                            <>
                                <NavItem
                                    icon={<Target size={20} />}
                                    label="Budget"
                                    isActive={currentPage === 'budget'}
                                    onClick={() => handleNavClick('budget')}
                                />
                                <NavItem
                                    icon={<FileSignature size={20} />}
                                    label="Contratti"
                                    isActive={currentPage === 'contracts'}
                                    onClick={() => handleNavClick('contracts')}
                                />
                                <NavItem
                                    icon={<Settings size={20} />}
                                    label="Impostazioni"
                                    isActive={currentPage === 'settings'}
                                    onClick={() => handleNavClick('settings')}
                                />
                            </>
                        )}
                    </ul>
                </nav>

                {/* User Section */}
<div className="mt-auto pt-4 border-t border-white/10">
    <div className="flex items-center gap-3 p-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="min-w-0 flex-1">
            <p className="font-bold text-white text-sm truncate">{user.name || user.email}</p>
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">{user.role}</span>
        </div>
        <button
            onClick={() => {
                handleLogout();
                closeMobileMenu();
            }}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
            title="Logout"
        >
            <LogOut size={20} />
        </button>
    </div>
</div>
            </aside>
        </>
    );
}