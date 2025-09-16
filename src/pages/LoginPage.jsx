import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { BarChart3, LogIn, UserPlus } from 'lucide-react';

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
        if (!name) { 
            setError('Il campo nome è obbligatorio.');
            setLoading(false); 
            return; 
        }
        
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-2xl shadow-2xl rounded-2xl lg:rounded-3xl p-8 border border-white/30">
          <div className="text-center mb-8">
            <div className="inline-block p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-lg">
                <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-black text-gray-900 mt-4">Marketing Platform</h1>
            <p className="text-gray-600 font-medium mt-1">{isRegistering ? 'Crea un nuovo account per iniziare' : 'Accedi al tuo account'}</p>
          </div>

          {error && <p className="bg-red-100/70 text-red-700 p-3 rounded-xl mb-6 text-center font-semibold border border-red-200">{error}</p>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1">Nome Completo</label>
                <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all" 
                    placeholder="Es. Mario Rossi" 
                />
              </div>
            )}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all" 
                placeholder="tu@frattin-auto.it" 
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full h-12 px-4 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all" 
                placeholder="••••••••" 
              />
            </div>
            <button 
                type="submit" 
                disabled={loading} 
                className="w-full flex items-center justify-center gap-2 h-12 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition-all hover:scale-105 disabled:opacity-70 disabled:scale-100"
            >
                {loading 
                    ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> 
                    : (isRegistering ? <><UserPlus size={20}/>Registrati</> : <><LogIn size={20}/>Accedi</>)
                }
            </button>
          </form>
          
          <div className="text-center mt-6">
            <button 
                onClick={() => { setIsRegistering(!isRegistering); setError(''); }} 
                className="text-sm font-semibold text-purple-600 hover:text-purple-800 hover:underline transition-colors"
            >
                {isRegistering ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}