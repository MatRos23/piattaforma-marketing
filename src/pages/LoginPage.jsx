import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { BarChart3 } from 'lucide-react';

const getFriendlyErrorMessage = (code) => {
  return {
    'auth/user-not-found': 'Nessun utente trovato con questa email.',
    'auth/wrong-password': 'Password errata. Riprova.',
    'auth/email-already-in-use': 'Questa email è già stata registrata.',
    'auth/weak-password': 'La password deve essere di almeno 6 caratteri.'
  }[code] || 'Si è verificato un errore. Riprova.';
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegistering) {
        if (!name) { setError('Il campo nome è obbligatorio.'); setLoading(false); return; }
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        let role = 'collaborator';
        if (email.toLowerCase() === 'marketing@frattin-auto.it') role = 'manager';
        else if (email.toLowerCase() === 'luca@frattin-auto.it') role = 'admin';

        await setDoc(doc(db, 'users', user.uid), { 
          uid: user.uid, 
          name: name, 
          email: user.email, 
          role: role, 
          assignedChannels: [] 
        });
        // Non c'è bisogno di fare altro, l'onAuthStateChanged in App.jsx gestirà il redirect
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
      <div className="w-full max-w-md">
        <div className="bg-white shadow-2xl rounded-xl p-8">
          <div className="text-center mb-8">
            <BarChart3 className="mx-auto h-12 w-12 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800 mt-4">Marketing Platform</h1>
            <p className="text-gray-500 mt-1">{isRegistering ? 'Crea un nuovo account' : 'Accedi al tuo account'}</p>
          </div>
          {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-6">
            {isRegistering && (
              <div><label className="text-sm font-bold text-gray-600 block mb-2">Nome Completo</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" placeholder="Es. Mario Rossi" /></div>
            )}
            <div><label className="text-sm font-bold text-gray-600 block mb-2">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" placeholder="tu@frattin-auto.it" /></div>
            <div><label className="text-sm font-bold text-gray-600 block mb-2">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" placeholder="........" /></div>
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold text-lg hover:bg-indigo-700 transition disabled:bg-indigo-300 flex items-center justify-center">{loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : (isRegistering ? 'Registrati' : 'Accedi')}</button>
          </form>
          <div className="text-center mt-6">
            <button onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="text-sm text-indigo-600 hover:underline">{isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}