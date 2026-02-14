
import { User, Badge } from './types';

// Pre-generated 10-digit codes for the Identity Tags
export const IDENTITY_CODES = [
  "8472910384", "2948571039", "5019283746", "3847562910", "1029384756",
  "9384756102", "4756102938", "7561029384", "6102938475", "2039485716"
];

export const INITIAL_USERS: User[] = [
  { id: 'TAG_001', name: '', code: IDENTITY_CODES[0], points: 1000, violationHistory: [], scanCount: 0 },
  { id: 'TAG_002', name: '', code: IDENTITY_CODES[1], points: 1000, violationHistory: [], scanCount: 0 },
  { id: 'TAG_003', name: '', code: IDENTITY_CODES[2], points: 1000, violationHistory: [], scanCount: 0 },
  { id: 'TAG_004', name: '', code: IDENTITY_CODES[3], points: 1000, violationHistory: [], scanCount: 0 },
  { id: 'TAG_005', name: '', code: IDENTITY_CODES[4], points: 1000, violationHistory: [], scanCount: 0 },
  { id: 'TAG_006', name: '', code: IDENTITY_CODES[5], points: 1000, violationHistory: [], scanCount: 0 },
  { id: 'TAG_007', name: '', code: IDENTITY_CODES[6], points: 1000, violationHistory: [], scanCount: 0 },
  { id: 'TAG_008', name: '', code: IDENTITY_CODES[7], points: 1000, violationHistory: [], scanCount: 0 },
  { id: 'TAG_009', name: '', code: IDENTITY_CODES[8], points: 1000, violationHistory: [], scanCount: 0 },
  { id: 'TAG_010', name: '', code: IDENTITY_CODES[9], points: 1000, violationHistory: [], scanCount: 0 },
];

export const BADGES: Badge[] = [
  { id: 'b1', name: 'Eagle Eye', icon: '🦅', description: 'Report 1 litterer', threshold: 1 },
  { id: 'b2', name: 'Campus Guardian', icon: '🛡️', description: 'Report 5 litterers', threshold: 5 },
  { id: 'b3', name: 'Waste Warrior', icon: '⚔️', description: 'Report 10 litterers', threshold: 10 },
  { id: 'b4', name: 'Eco Legend', icon: '💎', description: 'Maintain >1200 points', threshold: 1200 },
];

export const STORAGE_KEYS = {
  USERS: 'clean_credit_users',
  SCAN_LOGS: 'clean_credit_logs',
};

export const REWARD_POINTS = 20;
export const SORTING_BONUS = 10;
export const PENALTY_POINTS = 50;
