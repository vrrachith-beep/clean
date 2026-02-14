
import { User, ScanLog, LedgerEntry } from '../types';
import { INITIAL_USERS } from '../constants';
import { db } from '../src/firebase/config';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  runTransaction
} from 'firebase/firestore';

// Collection references
const usersCollection = collection(db, 'users');
const scanLogsCollection = collection(db, 'scanLogs');
const ledgerCollection = collection(db, 'ledger');

// Initialize users in Firestore if empty
export const initializeUsers = async (): Promise<void> => {
  const snapshot = await getDocs(usersCollection);
  if (snapshot.empty) {
    // Add initial users to Firestore
    for (const user of INITIAL_USERS) {
      await setDoc(doc(usersCollection, user.id), user);
    }
  }
};

// Get all users from Firestore (one-time fetch)
export const getStoredUsers = async (): Promise<User[]> => {
  const snapshot = await getDocs(usersCollection);
  if (snapshot.empty) {
    // If no users, initialize them
    await initializeUsers();
    return INITIAL_USERS;
  }
  return snapshot.docs.map(doc => doc.data() as User);
};

// Save users to Firestore (updates existing or creates new)
export const saveUsers = async (users: User[]): Promise<void> => {
  for (const user of users) {
    await setDoc(doc(usersCollection, user.id), user);
  }
};

// Update a single user in Firestore
export const updateUser = async (user: User): Promise<void> => {
  await setDoc(doc(usersCollection, user.id), user);
};

// Get all scan logs from Firestore (one-time fetch)
export const getScanLogs = async (): Promise<ScanLog[]> => {
  const q = query(scanLogsCollection, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ScanLog);
};

// Add a new scan log to Firestore
export const saveScanLog = async (log: ScanLog): Promise<void> => {
  await addDoc(scanLogsCollection, log);
};

// Get all ledger entries from Firestore (one-time fetch)
export const getLedgerEntries = async (): Promise<LedgerEntry[]> => {
  const q = query(ledgerCollection, orderBy('timestamp', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as LedgerEntry);
};

// Add a new ledger entry to Firestore
export const saveLedgerEntry = async (entry: LedgerEntry): Promise<void> => {
  await addDoc(ledgerCollection, entry);
};

interface ViolationInput {
  scannerId: string;
  littererId: string;
  wasteType: string;
  description: string;
  rewardPoints: number;
  penaltyPoints: number;
  scannedValue: string;
}

interface ViolationResult {
  log: ScanLog;
  creditEntry: LedgerEntry;
  debitEntry: LedgerEntry;
}

// Apply a full violation in one transaction so online users stay consistent.
export const applyViolationTransaction = async (input: ViolationInput): Promise<ViolationResult> => {
  return runTransaction(db, async (tx) => {
    const scannerRef = doc(usersCollection, input.scannerId);
    const littererRef = doc(usersCollection, input.littererId);

    const [scannerSnap, littererSnap] = await Promise.all([
      tx.get(scannerRef),
      tx.get(littererRef),
    ]);

    if (!scannerSnap.exists() || !littererSnap.exists()) {
      throw new Error('Scanner or litterer not found');
    }

    const scanner = scannerSnap.data() as User;
    const litterer = littererSnap.data() as User;
    const nowIso = new Date().toISOString();

    const scannerPoints = (scanner.points || 0) + input.rewardPoints;
    const littererPoints = Math.max(0, (litterer.points || 0) - input.penaltyPoints);

    tx.update(scannerRef, {
      points: scannerPoints,
      scanCount: (scanner.scanCount || 0) + 1,
    });

    tx.update(littererRef, {
      points: littererPoints,
      violationHistory: [
        ...(litterer.violationHistory || []),
        `${input.wasteType || 'Trash'} left at ${new Date().toLocaleTimeString()}`,
      ],
    });

    const scanLogRef = doc(scanLogsCollection);
    const creditRef = doc(ledgerCollection);
    const debitRef = doc(ledgerCollection);

    const log: ScanLog = {
      timestamp: nowIso,
      scannerId: input.scannerId,
      littererId: input.littererId,
      wasteType: input.wasteType,
      rewardPoints: input.rewardPoints,
      penaltyPoints: input.penaltyPoints,
      scannedValue: input.scannedValue,
    };

    const creditEntry: LedgerEntry = {
      id: creditRef.id,
      timestamp: nowIso,
      userId: input.scannerId,
      type: 'credit',
      amount: input.rewardPoints,
      reason: input.description || 'Valid litter report',
      counterpartyId: input.littererId,
      wasteType: input.wasteType,
    };

    const debitEntry: LedgerEntry = {
      id: debitRef.id,
      timestamp: nowIso,
      userId: input.littererId,
      type: 'debit',
      amount: input.penaltyPoints,
      reason: input.description || 'Littering violation penalty',
      counterpartyId: input.scannerId,
      wasteType: input.wasteType,
    };

    tx.set(scanLogRef, log);
    tx.set(creditRef, creditEntry);
    tx.set(debitRef, debitEntry);

    return { log, creditEntry, debitEntry };
  });
};

// Subscribe to real-time updates for users
export const subscribeToUsers = (callback: (users: User[]) => void): (() => void) => {
  return onSnapshot(usersCollection, (snapshot) => {
    const users = snapshot.docs.map(doc => doc.data() as User);
    callback(users);
  });
};

// Subscribe to real-time updates for scan logs
export const subscribeToScanLogs = (callback: (logs: ScanLog[]) => void): (() => void) => {
  const q = query(scanLogsCollection, orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => doc.data() as ScanLog);
    callback(logs);
  });
};

// Subscribe to real-time updates for ledger entries
export const subscribeToLedger = (callback: (entries: LedgerEntry[]) => void): (() => void) => {
  const q = query(ledgerCollection, orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => doc.data() as LedgerEntry);
    callback(entries);
  });
};

// Convert timestamp to ISO string for Firestore
export const toFirestoreTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};

// Convert Firestore timestamp to ISO string
export const fromFirestoreTimestamp = (timestamp: Timestamp | string): string => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString();
  }
  return timestamp as string;
};
