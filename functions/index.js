const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");

setGlobalOptions({ region: "europe-west1" });

admin.initializeApp();

const functionOptions = {
    memory: "1GiB",
    timeoutSeconds: 120,
    cors: [/localhost:\d+$/, /piattaforma-marketing-frattin\.web\.app$/],
};

exports.createUserAccount = onCall(functionOptions, async (request) => {
  if (!request.auth) { throw new HttpsError("unauthenticated", "Devi essere autenticato."); }
  const callerUid = request.auth.uid;
  const userRecord = await admin.firestore().collection("users").doc(callerUid).get();
  if (!userRecord.exists || !['manager', 'admin'].includes(userRecord.data().role)) { 
    throw new HttpsError("permission-denied", "Solo un manager o admin può creare nuovi utenti."); 
  }
  const { email, password, name, role } = request.data;
  if (!email || !password || !name || !role || password.length < 6) { 
    throw new HttpsError("invalid-argument", "Dati mancanti o non validi."); 
  }
  try {
    const newUserRecord = await admin.auth().createUser({ email, password, displayName: name });
    
    // Imposta Custom Claims per permettere controlli nelle Storage Rules
    await admin.auth().setCustomUserClaims(newUserRecord.uid, { role: role });
    
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
  try { await admin.auth().deleteUser(uidToDelete); } catch (error) { 
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

// Nuova funzione per aggiornare i ruoli degli utenti esistenti
exports.updateUserRole = onCall(functionOptions, async (request) => {
  if (!request.auth) { throw new HttpsError("unauthenticated", "Devi essere autenticato."); }
  const callerUid = request.auth.uid;
  const userRecord = await admin.firestore().collection("users").doc(callerUid).get();
  if (!userRecord.exists || userRecord.data().role !== 'admin') { 
    throw new HttpsError("permission-denied", "Solo un admin può modificare i ruoli."); 
  }
  
  const { uid, newRole } = request.data;
  if (!uid || !newRole || !['admin', 'manager', 'collaborator'].includes(newRole)) { 
    throw new HttpsError("invalid-argument", "UID o ruolo non validi."); 
  }
  
  try {
    // Aggiorna Custom Claims in Firebase Auth
    await admin.auth().setCustomUserClaims(uid, { role: newRole });
    
    // Aggiorna il documento in Firestore
    await admin.firestore().collection("users").doc(uid).update({ role: newRole });
    
    logger.info(`Ruolo aggiornato per utente ${uid}: ${newRole}`);
    return { status: "success", message: "Ruolo aggiornato con successo." };
  } catch (error) {
    logger.error("Errore aggiornamento ruolo:", error);
    throw new HttpsError("internal", "Errore durante l'aggiornamento del ruolo.");
  }
});

const getSafeDate = (dateField) => {
    if (!dateField) return null;
    if (typeof dateField.toDate === 'function') return dateField.toDate();
    return new Date(dateField);
};

const calculateAccrualPortionServer = (item, filterStartDate, filterEndDate) => {
    const isAmortized = item.isAmortized || item.isProjection;
    const startDate = getSafeDate(item.amortizationStartDate) || getSafeDate(item.startDate);
    const endDate = getSafeDate(item.amortizationEndDate) || getSafeDate(item.endDate);
    if (!isAmortized) {
        const itemDate = getSafeDate(item.date);
        if (!itemDate || isNaN(itemDate)) return 0;
        return (itemDate >= filterStartDate && itemDate <= filterEndDate) ? (item.amount || 0) : 0;
    }
    if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) return 0;
    const expenseStart = new Date(startDate.setHours(0, 0, 0, 0));
    const expenseEnd = new Date(endDate.setHours(23, 59, 59, 999));
    const durationDays = (expenseEnd - expenseStart) / (1000 * 60 * 60 * 24) + 1;
    if (durationDays <= 0) return 0;
    const dailyCost = (item.amount || 0) / durationDays;
    const overlapStart = new Date(Math.max(filterStartDate, expenseStart));
    const overlapEnd = new Date(Math.min(filterEndDate, expenseEnd));
    if (overlapStart > overlapEnd) return 0;
    const overlapDays = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24) + 1;
    return dailyCost * overlapDays;
};

const recalculateSupplierSummary = async (supplierId, year) => {
    logger.info(`Inizio ricalcolo finale per supplier: ${supplierId}, anno: ${year}`);
    const db = admin.firestore();
    const filterStartDate = new Date(year, 0, 1);
    const filterEndDate = new Date(year, 11, 31);

    const [expensesSnap, budgetSnap, branchesSnap, sectorsSnap] = await Promise.all([
        db.collection("expenses").where("supplierId", "==", supplierId).get(),
        db.collection("budgets").where("supplierId", "==", supplierId).where("year", "==", year).limit(1).get(),
        db.collection("branches").get(),
        db.collection("sectors").get(),
    ]);

    const expenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const budgetDoc = budgetSnap.empty ? null : budgetSnap.docs[0].data();
    const branches = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sectors = sectorsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const spendMap = new Map();

    expenses.forEach(item => {
        const amountToConsider = calculateAccrualPortionServer(item, filterStartDate, filterEndDate);
        if (amountToConsider <= 0) return;

        const lineItems = (item.lineItems && item.lineItems.length > 0) ? item.lineItems : [{ 
            amount: item.amount || 0,
            marketingChannelId: item.marketingChannelId,
            assignmentId: item.branchId,
            sectorId: item.sectorId,
        }];
        const totalLineItemsAmount = lineItems.reduce((sum, li) => sum + (li.amount || 0), 0);

        lineItems.forEach(lineItem => {
            const prorationRatio = totalLineItemsAmount > 0 ? (lineItem.amount || 0) / totalLineItemsAmount : (lineItems.length > 0 ? 1 / lineItems.length : 0);
            const itemAmount = amountToConsider * prorationRatio;
            
            const genericoBranch = branches.find(b => b.name.toLowerCase() === 'generico');
            const itemBranchId = lineItem.assignmentId || item.branchId;
            const itemSectorId = lineItem.sectorId || item.sectorId;
            const itemChannelId = lineItem.marketingChannelId || item.marketingChannelId;

            if (!itemSectorId || !itemChannelId) return;

            if (itemBranchId && itemBranchId !== genericoBranch?.id) {
                const key = `${itemSectorId}-${itemChannelId}-${itemBranchId}`;
                spendMap.set(key, (spendMap.get(key) || 0) + itemAmount);
            } else if (itemBranchId === genericoBranch?.id) {
                const realBranches = branches.filter(b => b.id !== genericoBranch?.id);
                const sectorToBranchesMap = new Map(sectors.map(sector => [sector.id, realBranches.filter(b => b.associatedSectors?.includes(sector.id))]));
                const frattinGroupSector = sectors.find(s => s.name === 'Frattin Group');
                let targetBranches = (itemSectorId === frattinGroupSector?.id) ? realBranches : (sectorToBranchesMap.get(itemSectorId) || []);

                if (targetBranches.length > 0) {
                    const amountPerBranch = itemAmount / targetBranches.length;
                    targetBranches.forEach(branch => {
                        const key = `${itemSectorId}-${itemChannelId}-${branch.id}`;
                        spendMap.set(key, (spendMap.get(key) || 0) + amountPerBranch);
                    });
                }
            }
        });
    });

    const allAllocations = budgetDoc?.allocations || [];
    const detailsMap = new Map();

    allAllocations.forEach(alloc => {
        const key = `${alloc.sectorId}-${alloc.marketingChannelId}-${alloc.branchId}`;
        detailsMap.set(key, { ...alloc, detailedSpend: 0 });
    });

    spendMap.forEach((spend, key) => {
        const [sectorId, marketingChannelId, branchId] = key.split('-');
        if (detailsMap.has(key)) {
            detailsMap.get(key).detailedSpend += spend;
        } else {
            detailsMap.set(key, { sectorId, marketingChannelId, branchId, budgetAmount: 0, detailedSpend: spend });
        }
    });

    const details = Array.from(detailsMap.values());
    const totalSpend = details.reduce((sum, d) => sum + d.detailedSpend, 0);
    const totalBudget = allAllocations.reduce((sum, d) => sum + (d.budgetAmount || 0), 0);

    const summaryData = {
        supplierId,
        year,
        totalBudget,
        totalSpend,
        details,
        isUnexpected: budgetDoc?.isUnexpected || false,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const summaryDocRef = db.collection("budget_summaries").doc(`${supplierId}_${year}`);
    await summaryDocRef.set(summaryData, { merge: true });
    
    logger.info(`Sommario finale per supplier: ${supplierId}, anno: ${year} aggiornato.`);
};

exports.onExpenseChange = onDocumentWritten("expenses/{expenseId}", async (event) => {
    const data = event.data?.after.data() || event.data?.before.data();
    if (data?.supplierId && data?.date) {
        await recalculateSupplierSummary(data.supplierId, getSafeDate(data.date).getFullYear());
    }
});

exports.onContractChange = onDocumentWritten("contracts/{contractId}", async (event) => {
    const data = event.data?.after.data() || event.data?.before.data();
    if (data?.supplierId && data?.signingDate) {
        await recalculateSupplierSummary(data.supplierId, new Date(data.signingDate).getFullYear());
    }
});

exports.onBudgetChange = onDocumentWritten("budgets/{budgetId}", async (event) => {
    const data = event.data?.after.data() || event.data?.before.data();
    if (data?.supplierId && data?.year) {
        await recalculateSupplierSummary(data.supplierId, data.year);
    }
});

exports.backfillBudgetSummaries = onCall(functionOptions, async (request) => {
    if (!request.auth) { throw new HttpsError("unauthenticated", "Devi essere autenticato."); }
    const callerUid = request.auth.uid;
    const userRecord = await admin.firestore().collection("users").doc(callerUid).get();
    if (!userRecord.exists || !['manager', 'admin'].includes(userRecord.data().role)) { 
        throw new HttpsError("permission-denied", "Solo un manager o admin può eseguire questa operazione."); 
    }
    logger.info("Avvio del backfill manuale dei budget summaries...");
    const db = admin.firestore();
    const suppliersSnap = await db.collection("channels").get();
    const suppliers = suppliersSnap.docs.map(doc => doc.id);
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear + 1];
    let processedCount = 0;
    const promises = [];
    for (const supplierId of suppliers) {
        for (const year of years) {
            promises.push(recalculateSupplierSummary(supplierId, year));
            processedCount++;
        }
    }
    await Promise.all(promises);
    const message = `Backfill completato. Elaborati ${suppliers.length} fornitori per ${years.length} anni (totale ${processedCount} operazioni).`;
    logger.info(message);
    return { status: "success", message };
});