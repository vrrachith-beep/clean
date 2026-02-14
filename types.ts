
export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  threshold: number;
}

export interface User {
  id: string;
  name: string;
  code: string; // 10-digit identification code
  points: number;
  violationHistory: string[];
  scanCount: number;
}

export interface ScanLog {
  timestamp: string;
  scannerId: string;
  littererId: string;
  wasteType?: string;
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  scanLogs: ScanLog[];
}
