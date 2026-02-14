
import { User, Badge } from './types';

// Pre-generated 10-digit codes for the Identity Tags
export const IDENTITY_CODES = [
  "8472910384", "2948571039", "5019283746", "3847562910", "1029384756",
  "9384756102", "4756102938", "7561029384", "6102938475", "2039485716",
  "7193846502", "8642057391", "5301974628", "4928601753", "6753208491",
  "3419750286", "9081327465", "1572039486", "2864095173", "7348602915"
];

export const INITIAL_USERS: User[] = IDENTITY_CODES.map((code, index) => ({
  id: `TAG_${String(index + 1).padStart(3, '0')}`,
  name: '',
  code,
  points: 1000,
  violationHistory: [],
  scanCount: 0,
}));

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
