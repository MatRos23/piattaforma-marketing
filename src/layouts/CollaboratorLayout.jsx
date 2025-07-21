import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { User, LayoutDashboard, DollarSign, LogOut } from 'lucide-react';

function NavLink({ to, active, icon, children }) {
    return (
        <Link
            to={to}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
            active ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-200'
            }`}
        >
            {icon}
            {children}
        </Link>
    );
}

export default function CollaboratorLayout({ user }) {
    const location = useLocation();
    const navLinks = [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { to: '/expenses', label: 'Le Mie Spese', icon: <DollarSign size={20} /> },
    ];

    return (
        <div className="min-h-screen flex bg-gray-100">
            <aside className="w-64 bg-white shadow-lg flex flex-col p-4">
                <div className="text-center mb-8">
                    <User className="mx-auto h-10 w-10 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-800 mt-2">Area Collaboratore</h1>
                </div>
                <nav className="flex flex-col gap-2">
                    {navLinks.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            active={location.pathname === link.to}
                            icon={link.icon}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                </nav>
                <div className="mt-auto text-center">
                    <p className="text-gray-700 font-semibold">{user.name}</p>
                    <p className="text-sm text-gray-500 mb-4">{user.email}</p>
                    <button
                        onClick={() => signOut(auth)}
                        className="w-full bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition flex items-center justify-center gap-2"
                    >
                        <LogOut size={18} />
                        Esci
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}