import React, { useState, useEffect } from 'react';
import { X, Menu } from 'lucide-react';
import { auth, db } from './firebase/config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ExpensesPage from './pages/ExpensesPage';
import BudgetPage from './pages/BudgetPage';
import SettingsPage from './pages/SettingsPage';
import Spinner from './components/Spinner';
import ContractsPage from './pages/ContractsPage';

export default function App() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [pageState, setPageState] = useState({
        currentPage: 'dashboard',
        initialFilters: {},
    });

    const navigate = (page, filters = {}) => {
        setPageState({ currentPage: page, initialFilters: filters });
        setIsMobileMenuOpen(false); // Chiudi il menu quando si naviga
    };

    const renderPage = (page, user, filters) => {
        const userPermissions = {
            manager: ['dashboard', 'budget', 'expenses', 'settings', 'contracts'],
            collaborator: ['dashboard', 'expenses'],
            admin: ['dashboard', 'expenses', 'budget', 'settings', 'contracts'],
        };
        const allowedPages = userPermissions[user.role] || [];
        if (!allowedPages.includes(page)) {
            return <DashboardPage user={user} navigate={navigate} />;
        }

        switch (page) {
            case 'dashboard':
                return <DashboardPage user={user} navigate={navigate} />;
            case 'expenses':
                return <ExpensesPage user={user} initialFilters={filters} />;
            case 'budget':
                return <BudgetPage user={user} />;
            case 'settings':
                return <SettingsPage user={user} />;
            case 'contracts':
                return <ContractsPage user={user} />;
            default:
                return <DashboardPage user={user} navigate={navigate} />;
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, 'users', firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setUser({ uid: firebaseUser.uid, ...userDoc.data() });
                } else {
                    signOut(auth);
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogout = () => {
        signOut(auth).catch(error => console.error("Errore durante il logout:", error));
    };

    if (isLoading) {
        return (
            <div className="w-screen h-screen flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    if (!user) {
        return <LoginPage />;
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar
                user={user}
                currentPage={pageState.currentPage}
                setCurrentPage={(page) => navigate(page)}
                handleLogout={handleLogout}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
            />
            <main className="flex-1 flex flex-col overflow-y-auto">
    {/* Mobile Header */}
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-20 p-4 bg-gray-50/80 backdrop-blur-sm border-b border-gray-200">
    {/* Mobile Menu Button */}
    <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="p-3 bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-xl shadow-lg"
        aria-label="Toggle menu"
    >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
    </button>

    {/* User Avatar */}
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
        {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
    </div>
</header>

    {/* Contenuto della pagina */}
    <div className="flex-1">
        {renderPage(pageState.currentPage, user, pageState.initialFilters)}
    </div>
</main>
        </div>
    );
}