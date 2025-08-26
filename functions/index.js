const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

admin.initializeApp();

// Manteniamo le tue opzioni di configurazione
const functionOptions = {
    region: "europe-west1",
    memory: "512MiB",
    timeoutSeconds: 60,
    cors: [/localhost:\d+$/, /piattaforma-marketing-frattin\.web\.app$/],
};

// La tua funzione, leggermente migliorata
exports.createUserAccount = onCall(functionOptions, async (request) => {
  if (!request.auth) { 
    throw new HttpsError("unauthenticated", "Devi essere autenticato."); 
  }

  const callerUid = request.auth.uid;
  const userRecord = await admin.firestore().collection("users").doc(callerUid).get();
  
  // MODIFICA: Ora sia manager che admin possono creare utenti
  if (!userRecord.exists || !['manager', 'admin'].includes(userRecord.data().role)) { 
    throw new HttpsError("permission-denied", "Solo un manager o admin può creare nuovi utenti."); 
  }

  const { email, password, name, role } = request.data;
  if (!email || !password || !name || !role || password.length < 6) { 
    throw new HttpsError("invalid-argument", "Dati mancanti o non validi."); 
  }

  try {
    const newUserRecord = await admin.auth().createUser({ email, password, displayName: name });
    
    // MODIFICA: Aggiunto il campo createdAt per coerenza
    await admin.firestore().collection("users").doc(newUserRecord.uid).set({ 
        uid: newUserRecord.uid, 
        name, 
        email, 
        role, 
        assignedChannels: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
    });

    return { status: "success", message: `Utente ${name} creato con successo.` };
  } catch (error) {
    logger.error("Errore creazione utente:", error);
    if (error.code === 'auth/email-already-exists') { 
      throw new HttpsError("already-exists", "Questa email è già registrata."); 
    }
    throw new HttpsError("internal", "Errore imprevisto durante la creazione.");
  }
});

// Manteniamo la tua utilissima funzione per eliminare gli utenti
exports.deleteUserAccount = onCall(functionOptions, async (request) => {
  if (!request.auth) { throw new HttpsError("unauthenticated", "Devi essere autenticato."); }
  
  const callerUid = request.auth.uid;
  const userRecord = await admin.firestore().collection("users").doc(callerUid).get();
  
  if (!userRecord.exists || !['manager', 'admin'].includes(userRecord.data().role)) { 
    throw new HttpsError("permission-denied", "Solo un manager o admin può eliminare utenti."); 
  }
  
  const { uidToDelete } = request.data;
  if (!uidToDelete) { throw new HttpsError("invalid-argument", "ID utente mancante."); }
  if (uidToDelete === callerUid) { throw new HttpsError("permission-denied", "Non puoi eliminare te stesso."); }
  
  try { 
    await admin.auth().deleteUser(uidToDelete); 
  } catch (error) { 
    if (error.code === 'auth/user-not-found') { 
      logger.warn(`Utente ${uidToDelete} non trovato in Auth... procedo con Firestore.`); 
    } else { 
      logger.error("Errore eliminazione da Auth:", error); 
      throw new HttpsError("internal", "Errore eliminazione da Authentication."); 
    } 
  }
  
  try { 
    await admin.firestore().collection("users").doc(uidToDelete).delete(); 
    return { status: "success", message: "Utente eliminato con successo." }; 
  } catch (error) { 
    logger.error("Errore eliminazione da Firestore:", error); 
    throw new HttpsError("internal", "Errore eliminazione dal database."); 
  }
});
