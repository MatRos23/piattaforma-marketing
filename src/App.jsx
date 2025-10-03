import React, { useState, useEffect } from 'react';
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
            <main className="flex-1 overflow-y-auto">
                {/* Padding top su mobile per il menu button */}
                <div className="lg:pt-0 pt-0">
                    {renderPage(pageState.currentPage, user, pageState.initialFilters)}
                </div>
            </main>
        </div>
    );
}