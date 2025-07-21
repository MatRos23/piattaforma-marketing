import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import { Toaster } from 'react-hot-toast';

// Layouts
import ManagerLayout from './layouts/ManagerLayout';
import CollaboratorLayout from './layouts/CollaboratorLayout';
import AdminLayout from './layouts/AdminLayout';

// Pagine
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BudgetPage from './pages/BudgetPage';
import ExpensesPage from './pages/ExpensesPage';
import SettingsPage from './pages/SettingsPage';

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUser({ id: userDoc.id, ...userDoc.data() });
        } else {
          signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  switch (user.role) {
    case 'manager':
      return (
        <Routes>
          <Route element={<ManagerLayout user={user} />}>
            <Route index element={<DashboardPage user={user} />} />
            <Route path="budget" element={<BudgetPage user={user} />} />
            <Route path="expenses" element={<ExpensesPage user={user} />} />
            <Route path="settings" element={<SettingsPage user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      );
    case 'collaborator':
      return (
        <Routes>
          <Route element={<CollaboratorLayout user={user} />}>
            <Route index element={<DashboardPage user={user} />} />
            <Route path="expenses" element={<ExpensesPage user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Route>
        </Routes>
      );
    case 'admin':
        return (
          <Routes>
            <Route element={<AdminLayout user={user} />}>
              <Route index element={<DashboardPage user={user} />} />
              <Route path="expenses" element={<ExpensesPage user={user} />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Route>
          </Routes>
        );
    default:
        return (
            <Routes>
                <Route path="*" element={<LoginPage />} />
            </Routes>
        );
  }
}