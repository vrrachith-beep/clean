
import { User, ScanLog } from '../types';
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
  Timestamp 
} from 'firebase/firestore';

// Collection references
const usersCollection = collection(db, 'users');
const scanLogsCollection = collection(db, 'scanLogs');

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
