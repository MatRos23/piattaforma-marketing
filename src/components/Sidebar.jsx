import React from 'react';
import { LayoutDashboard, ShoppingCart, Target, Settings, LogOut, FileSignature, BarChart3, X, Menu } from 'lucide-react';

const NavItem = ({ icon, label, isActive, onClick }) => (
    <li>
        <button
            onClick={onClick}
            className={`flex items-center w-full p-3 lg:p-3.5 rounded-xl transition-all duration-300 relative group ${
                isActive
                    ? 'bg-gradient-to-r from-indigo-500/90 to-purple-600/90 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white hover:scale-[1.02]'
            }`}
        >
            {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-500 to-purple-500 rounded-r-full"></div>
            )}
            <span className={`transition-transform group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}>
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
            {/* Mobile Menu Button - Fixed in top-left corner */}
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-xl shadow-2xl hover:scale-110 transition-all duration-300"
                aria-label="Toggle menu"
            >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

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
                    bg-gradient-to-b from-gray-900 via-slate-900 to-slate-800
                    flex flex-col p-4 lg:p-5
                    shadow-2xl
                    transition-transform duration-300 ease-out
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
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
                    <div className="p-3 lg:p-4 mb-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white text-sm lg:text-base truncate">
                                    {user.name || user.email}
                                </p>
                                <p className="text-xs text-gray-400 truncate">{user.email}</p>
                            </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/10">
                            <span className="inline-block px-2.5 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-full text-xs font-bold text-amber-300 uppercase">
                                {user.role}
                            </span>
                        </div>
                    </div>
                    
                    <button
                        onClick={() => {
                            handleLogout();
                            closeMobileMenu();
                        }}
                        className="flex items-center justify-center w-full p-3 lg:p-3.5 rounded-xl bg-gradient-to-r from-red-500/10 to-pink-500/10 text-red-400 hover:from-red-500 hover:to-pink-600 hover:text-white border border-red-500/20 hover:border-red-500 font-semibold transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group"
                    >
                        <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
                        <span className="ml-3">Logout</span>
                    </button>
                </div>
            </aside>
        </>
    );
}