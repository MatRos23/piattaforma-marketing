// Importa le funzioni che ci servono dagli SDK
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// La configurazione del tuo NUOVO progetto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAR6_nvIwof0FRgcd6I2XLrDjsP3ckHW28",
  authDomain: "piattaforma-marketing-frattin.firebaseapp.com",
  projectId: "piattaforma-marketing-frattin",
  storageBucket: "piattaforma-marketing-frattin.firebasestorage.app",
  messagingSenderId: "555547298506",
  appId: "1:555547298506:web:34b24b843004d925a74233"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);

// Inizializza e esporta i singoli servizi di Firebase per poterli usare nel resto dell'app
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'europe-west1'); // Specifichiamo la regione per le functions

// Esportiamo anche la config, ci servirà per una delle funzioni
export { firebaseConfig };