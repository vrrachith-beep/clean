
import React, { useState, useEffect, useRef } from 'react';
import { User, ScanLog, LedgerEntry } from './types';
import {
  initializeUsers,
  activateUserTag,
  activateUserTagViaRest,
  saveUsers,
  subscribeToUsers,
  subscribeToScanLogs,
  subscribeToLedger,
  applyViolationTransaction,
} from './services/db';
import { Leaderboard } from './components/Leaderboard';
import { Analytics } from './components/Analytics';
import { Badges } from './components/Badges';
import { QRRegistry } from './components/QRRegistry';
import { REWARD_POINTS, PENALTY_POINTS, SORTING_BONUS, INITIAL_USERS } from './constants';
import { Html5Qrcode } from 'html5-qrcode';

const USER_ID_STORAGE_KEY = 'cleancredit_current_user_id';

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'registry' | 'profile'>('home');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error' | 'info'; message: string; data?: any } | null>(null);
  const [pendingViolation, setPendingViolation] = useState<{
    littererId: string;
    scannedValue: string;
    description: string;
    wasteType: string;
  } | null>(null);
  const [showIdentityMenu, setShowIdentityMenu] = useState(false);
  const [registrationName, setRegistrationName] = useState('');
  const [isActivatingTag, setIsActivatingTag] = useState(false);
  const [manualScanCode, setManualScanCode] = useState('');
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const scanHandledRef = useRef(false);

  const currentUser = users.find(u => u.id === currentUserId) || null;
  const currentUserLedger = ledgerEntries.filter((entry) => entry.userId === currentUserId);
  const totalCredits = currentUserLedger
    .filter((entry) => entry.type === 'credit')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalDebits = currentUserLedger
    .filter((entry) => entry.type === 'debit')
    .reduce((sum, entry) => sum + entry.amount, 0);

  useEffect(() => {
    const stored = localStorage.getItem(USER_ID_STORAGE_KEY);
    if (stored) setCurrentUserId(stored);
  }, []);

  useEffect(() => {
    let unsubUsers: (() => void) | undefined;
    let unsubLogs: (() => void) | undefined;
    let unsubLedger: (() => void) | undefined;

    const setupRealtime = async () => {
      try {
        await initializeUsers();
        unsubUsers = subscribeToUsers(setUsers);
        unsubLogs = subscribeToScanLogs(setLogs);
        unsubLedger = subscribeToLedger(setLedgerEntries);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setScanResult({
          type: 'error',
          message: `Realtime setup failed: ${message}. Check Firebase config and Firestore rules.`,
        });
      }
    };

    setupRealtime();

    return () => {
      unsubUsers?.();
      unsubLogs?.();
      unsubLedger?.();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId || users.length === 0) return;
    const exists = users.some((u) => u.id === currentUserId);
    if (!exists) {
      setCurrentUserId(null);
      localStorage.removeItem(USER_ID_STORAGE_KEY);
    }
  }, [users, currentUserId]);

  const getDbErrorMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (lower.includes('permission-denied')) {
      return 'Tag activation failed: Firestore permission denied. Update your Firestore rules.';
    }
    if (lower.includes('offline') || lower.includes('unavailable')) {
      return 'Tag activation failed: Device appears offline for Firestore. Check network and retry.';
    }
    if (lower.includes('project') || lower.includes('api key') || lower.includes('auth')) {
      return 'Tag activation failed: Firebase config is missing/invalid. Set VITE_FIREBASE_* environment values.';
    }
    return `Tag activation failed: ${message}`;
  };

  const buildQrPayload = (user: User): string => {
    return JSON.stringify({ userId: user.id, code: user.code });
  };

  const resolveUserFromScannedValue = (rawValue: string): User | undefined => {
    const value = (rawValue || '').trim();
    let normalized = value;
    try {
      normalized = decodeURIComponent(value);
    } catch {
      normalized = value;
    }

    if (!value) return undefined;

    const directCodeMatch = users.find((u) => u.code === normalized);
    if (directCodeMatch) return directCodeMatch;

    const directIdMatch = users.find((u) => u.id === normalized);
    if (directIdMatch) return directIdMatch;

    try {
      const parsed = JSON.parse(normalized) as { userId?: string; code?: string };
      if (parsed.userId && parsed.code) {
        return users.find((u) => u.id === parsed.userId && u.code === parsed.code);
      }
      if (parsed.code) {
        return users.find((u) => u.code === parsed.code);
      }
      if (parsed.userId) {
        return users.find((u) => u.id === parsed.userId);
      }
    } catch {
      return undefined;
    }

    return undefined;
  };

  const handleRegister = async () => {
    if (!registrationName.trim() || !currentUserId) return;
    setIsActivatingTag(true);
    try {
      await activateUserTag(currentUserId, registrationName.trim());
      const local = users.find((u) => u.id === currentUserId) ?? INITIAL_USERS.find((u) => u.id === currentUserId);
      if (local) {
        setUsers((prev) => {
          const next = prev.filter((u) => u.id !== currentUserId);
          return [{ ...local, name: registrationName.trim() }, ...next];
        });
      }
      setRegistrationName('');
      setScanResult({ type: 'success', message: 'Tag activated successfully.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();
      if (lower.includes('offline') || lower.includes('unavailable')) {
        try {
          const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string;
          const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string;
          if (!apiKey || !projectId) {
            throw new Error('Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID');
          }
          await activateUserTagViaRest(currentUserId, registrationName.trim(), apiKey, projectId);
          const local = users.find((u) => u.id === currentUserId) ?? INITIAL_USERS.find((u) => u.id === currentUserId);
          if (local) {
            setUsers((prev) => {
              const next = prev.filter((u) => u.id !== currentUserId);
              return [{ ...local, name: registrationName.trim() }, ...next];
            });
          }
          setRegistrationName('');
          setScanResult({ type: 'success', message: 'Tag activated successfully.' });
        } catch (fallbackError) {
          setScanResult({ type: 'error', message: getDbErrorMessage(fallbackError) });
        }
      } else {
        setScanResult({ type: 'error', message: getDbErrorMessage(error) });
      }
    } finally {
      setIsActivatingTag(false);
    }
  };

  const updateUserName = async (newName: string) => {
    if (!currentUser) return;
    const updatedUsers = users.map(u =>
      u.id === currentUserId ? { ...u, name: newName } : u
    );
    try {
      await saveUsers(updatedUsers);
    } catch (error) {
      setScanResult({ type: 'error', message: getDbErrorMessage(error) });
    }
  };

  const startCamera = () => {
    setIsScanning(true);
    setScanResult(null);
    setManualScanCode('');
  };

  const stopCamera = () => {
    setIsScanning(false);
  };

  const queueViolationFromScan = (scannedValue: string, description: string, wasteType: string) => {
    if (!currentUser) return;
    const litterer = resolveUserFromScannedValue(scannedValue);
    if (!litterer) {
      setScanResult({ type: 'error', message: `ID Code ${scannedValue} is not recognized in the campus database.` });
      return;
    }
    if (litterer.id === currentUser.id) {
      setScanResult({ type: 'error', message: "Accountability Paradox: You cannot report your own pre-assigned tag." });
      return;
    }
    setPendingViolation({
      littererId: litterer.id,
      scannedValue,
      description,
      wasteType,
    });
  };

  const handleManualScanSubmit = () => {
    const value = manualScanCode.trim();
    if (!value) return;
    stopCamera();
    queueViolationFromScan(value, 'Manual scan input', '');
    setManualScanCode('');
  };

  useEffect(() => {
    if (!isScanning) {
      const existing = html5QrRef.current;
      if (existing) {
        existing.stop().catch(() => {}).finally(() => {
          existing.clear().catch(() => {});
        });
        html5QrRef.current = null;
      }
      return;
    }

    let cancelled = false;
    scanHandledRef.current = false;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader', { verbose: false });
        html5QrRef.current = scanner;
        try {
          await scanner.start(
            { facingMode: { exact: 'environment' } },
            { fps: 10, qrbox: { width: 260, height: 260 } },
            (decodedText) => {
              if (scanHandledRef.current || cancelled) return;
              scanHandledRef.current = true;
              stopCamera();
              queueViolationFromScan(decodedText, 'Live camera QR detection', '');
            },
            () => {}
          );
        } catch {
          await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 260, height: 260 } },
            (decodedText) => {
              if (scanHandledRef.current || cancelled) return;
              scanHandledRef.current = true;
              stopCamera();
              queueViolationFromScan(decodedText, 'Live camera QR detection', '');
            },
            () => {}
          );
        }
      } catch (error) {
        console.error('Scanner init failed:', error);
        setScanResult({ type: 'error', message: 'Scanner failed to start. Use fallback code input below.' });
        setIsScanning(false);
      }
    };

    // Delay slightly so overlay container exists in DOM.
    const t = window.setTimeout(startScanner, 100);

    return () => {
      cancelled = true;
      clearTimeout(t);
      const scanner = html5QrRef.current;
      if (scanner) {
        scanner.stop().catch(() => {}).finally(() => {
          scanner.clear().catch(() => {});
        });
        html5QrRef.current = null;
      }
    };
  }, [isScanning]);

  const handleViolation = async (littererId: string, description: string, wasteType: string, scannedValue: string) => {
    if (!currentUser) return;

    const bonus = wasteType ? SORTING_BONUS : 0;
    const totalReward = REWARD_POINTS + bonus;

    await applyViolationTransaction({
      scannerId: currentUser.id,
      littererId,
      wasteType,
      description,
      rewardPoints: totalReward,
      penaltyPoints: PENALTY_POINTS,
      scannedValue,
    });

    const litterer = users.find(u => u.id === littererId);
    setScanResult({
      type: 'success',
      message: `SHAME & FAME!\nLitterer: ${litterer?.name || 'Student'}\nClass: ${wasteType}\nCredits: +${totalReward} PTS`,
      data: { litterer, bonus }
    });
  };

  const confirmPendingViolation = async () => {
    if (!pendingViolation) return;
    await handleViolation(
      pendingViolation.littererId,
      pendingViolation.description,
      pendingViolation.wasteType,
      pendingViolation.scannedValue,
    );
    setPendingViolation(null);
  };

  const copyAppLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setScanResult({ type: 'info', message: "System link copied! Share with your team." });
    });
  };

  const isRegistered = currentUser && currentUser.name !== '';
  const availableUsers = users.filter((u) => !u.name);

  const selectIdentity = (id: string) => {
    setCurrentUserId(id);
    localStorage.setItem(USER_ID_STORAGE_KEY, id);
    setShowIdentityMenu(false);
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-dark text-slate-100 flex flex-col p-4 shadow-2xl pb-24 relative overflow-x-hidden">
      {/* Header */}
      <header className="mb-6 flex justify-between items-center sticky top-0 bg-dark/80 backdrop-blur-md z-40 py-2">
        <div onClick={() => setShowIdentityMenu(!showIdentityMenu)} className="cursor-pointer active:opacity-70 transition-opacity flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center shadow-lg shadow-primary/20">
             <span className="text-xl">🏠</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary animate-gradient-x leading-none">
              CLEANCREDIT
            </h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-1">
              {currentUser?.name || "GUEST"} <span className="text-primary text-[7px]">▼</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={copyAppLink} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs border border-slate-700">🔗</button>
          <div className="text-right">
            <div className="text-sm font-black text-primary">
              {currentUser?.points || 0} <span className="text-[10px] text-slate-500 font-normal">PTS</span>
            </div>
          </div>
        </div>
      </header>

      {/* Identity Swapper (Demo Feature) */}
      {showIdentityMenu && (
        <div className="absolute top-16 left-4 right-4 bg-slate-800 border border-slate-700 rounded-3xl p-3 z-50 shadow-2xl animate-in slide-in-from-top-4 duration-200">
          <p className="text-[10px] text-slate-500 uppercase p-2 font-bold tracking-widest text-center mb-1">Demo: Select Student Identity</p>
          <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">
            {users.map(u => (
              <button 
                key={u.id}
                onClick={() => selectIdentity(u.id)}
                className={`w-full text-left p-4 rounded-2xl transition-all border ${currentUserId === u.id ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-slate-900/60 border-slate-800/50 text-slate-300 hover:bg-slate-700'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-sm font-black truncate ${!u.name && 'italic opacity-50'}`}>{u.name || "Available Tag"}</span>
                  <span className="text-[10px] font-mono opacity-50">{u.id}</span>
                </div>
                <div className="text-[9px] font-bold opacity-70">Code: {u.code}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main UI */}
      {!currentUserId && activeTab !== 'registry' ? (
        <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 py-10">
          <div className="bg-slate-800/40 p-8 rounded-[3rem] border border-slate-700 shadow-2xl text-center w-full backdrop-blur-sm">
            <h2 className="text-3xl font-black mb-4 uppercase italic tracking-tighter">Choose Your Tag</h2>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">
              Pick any available ID slot, then activate with your name.
            </p>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {availableUsers.length > 0 ? (
                availableUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => selectIdentity(u.id)}
                    className="w-full text-left p-4 rounded-2xl bg-slate-900/60 border border-slate-800/50 text-slate-300 hover:bg-slate-700 transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-black">{u.id}</span>
                      <span className="text-[10px] font-mono text-slate-500">{u.code}</span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-400">No unclaimed tags left. Ask admin to add more slots.</p>
              )}
            </div>
          </div>
        </div>
      ) : !isRegistered && activeTab !== 'registry' ? (
        <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 py-10">
           <div className="bg-slate-800/40 p-10 rounded-[3rem] border border-slate-700 shadow-2xl text-center w-full backdrop-blur-sm">
              <div className="w-24 h-24 rounded-3xl bg-primary/20 flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner border border-primary/20">📝</div>
              <h2 className="text-3xl font-black mb-4 uppercase italic tracking-tighter">Claim Your Tag</h2>
              <p className="text-sm text-slate-400 mb-10 leading-relaxed px-4">
                You have selected slot <span className="text-primary font-bold">{currentUserId}</span>.<br/>
                Enter your name to register your pre-assigned ID code.
              </p>
              
              <input 
                type="text"
                value={registrationName}
                onChange={(e) => setRegistrationName(e.target.value)}
                placeholder="Student Name"
                className="w-full bg-slate-900/80 border-2 border-slate-700 rounded-2xl px-6 py-5 text-xl font-bold text-white focus:border-primary outline-none mb-8 transition-all shadow-inner"
              />
              
              <button 
                onClick={handleRegister}
                disabled={!registrationName.trim() || isActivatingTag}
                className="w-full py-6 rounded-2xl bg-primary text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/30 disabled:opacity-30 active:scale-95 transition-all"
              >
                {isActivatingTag ? 'Activating...' : 'Activate Tag'}
              </button>
           </div>
        </div>
      ) : (
        <>
          {activeTab === 'home' && (
            <div className="animate-in fade-in duration-500">
              <Leaderboard users={users} />
              {currentUser && <Badges user={currentUser} />}
              <div className="mt-10 flex flex-col items-center">
                <button 
                  onClick={startCamera}
                  className="group relative w-full h-40 rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-primary to-emerald-800 p-[2px] shadow-2xl shadow-primary/40 active:scale-95 transition-all"
                >
                  <div className="bg-dark/60 w-full h-full rounded-[2.4rem] flex flex-col items-center justify-center backdrop-blur-2xl border border-white/10">
                    <div className="relative mb-3">
                      <span className="text-6xl block group-hover:scale-110 transition-transform">📷</span>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-4 border-dark"></div>
                    </div>
                    <span className="text-2xl font-black tracking-tighter uppercase italic">Scan Trash to Earn</span>
                    <p className="text-[10px] text-white/50 uppercase tracking-[0.3em] font-bold">Vikasit Bharat • Zero Waste</p>
                  </div>
                </button>
              </div>
              <Analytics logs={logs} />
            </div>
          )}

          {activeTab === 'registry' && <QRRegistry users={users} />}

          {activeTab === 'profile' && currentUser && (
            <div className="animate-in slide-in-from-bottom-6 duration-500">
               <div className="bg-slate-800/40 rounded-[3rem] p-10 border border-slate-700 text-center shadow-2xl backdrop-blur-sm">
                  <div className="w-28 h-28 rounded-full bg-slate-900 mx-auto mb-8 border-4 border-primary/30 flex items-center justify-center text-5xl">👤</div>
                  <div className="mb-8">
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-[0.3em] block mb-3">Campus Identity</label>
                    <input 
                      type="text" 
                      value={currentUser.name} 
                      onChange={(e) => updateUserName(e.target.value)}
                      className="bg-slate-900/80 border-2 border-slate-700 rounded-2xl px-4 py-4 text-2xl font-black text-center text-white focus:border-primary focus:shadow-[0_0_20px_rgba(16,185,129,0.3)] outline-none w-full transition-all"
                      placeholder="Student Name"
                    />
                  </div>
                  
                  <div className="bg-white rounded-2xl p-4 w-48 h-48 mx-auto mb-8 shadow-2xl border-4 border-slate-900">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(buildQrPayload(currentUser))}`} 
                      alt="My QR"
                      className="w-full h-full"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-8">
                     <div className="bg-slate-900/60 p-6 rounded-[2rem] border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Reports</p>
                        <p className="text-3xl font-black">{currentUser.scanCount}</p>
                     </div>
                     <div className="bg-slate-900/60 p-6 rounded-[2rem] border border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Credits</p>
                        <p className="text-3xl font-black text-primary">{currentUser.points}</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-slate-900/60 p-4 rounded-2xl border border-emerald-700/30">
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total Credit</p>
                      <p className="text-xl font-black text-primary">+{totalCredits}</p>
                    </div>
                    <div className="bg-slate-900/60 p-4 rounded-2xl border border-rose-700/30">
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Total Debit</p>
                      <p className="text-xl font-black text-danger">-{totalDebits}</p>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 text-left">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">Recent Credit/Debit</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {currentUserLedger.slice(0, 8).map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between bg-slate-950/60 rounded-xl px-3 py-2">
                          <div>
                            <p className="text-xs font-bold text-slate-200">{entry.reason}</p>
                            <p className="text-[10px] text-slate-500">
                              {new Date(entry.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <p className={`text-sm font-black ${entry.type === 'credit' ? 'text-primary' : 'text-danger'}`}>
                            {entry.type === 'credit' ? '+' : '-'}{entry.amount}
                          </p>
                        </div>
                      ))}
                      {currentUserLedger.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-4">No transactions yet.</p>
                      )}
                    </div>
                  </div>
               </div>
            </div>
          )}
        </>
      )}

      {/* Scanning Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-500">
          <div className="p-8 flex justify-between items-center bg-gradient-to-b from-black/90 to-transparent">
            <div>
              <h3 className="font-black text-primary uppercase text-sm tracking-[0.3em]">Scanner Active</h3>
              <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">Align QR inside frame</p>
            </div>
            <button onClick={stopCamera} className="bg-white/10 p-5 rounded-full backdrop-blur-lg">
              <span className="text-xs font-black text-white">CANCEL</span>
            </button>
          </div>
          <div className="flex-1 relative p-4">
            <div id="qr-reader" className="w-full h-full rounded-3xl overflow-hidden border-2 border-primary/40" />
          </div>
          <div className="p-6 flex justify-center bg-gradient-to-t from-black/90 to-transparent">
            <div className="w-full max-w-sm space-y-4">
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-3 space-y-2">
                <p className="text-[10px] text-slate-300 uppercase tracking-[0.2em] font-bold">Fallback: Paste QR/ID</p>
                <input
                  value={manualScanCode}
                  onChange={(e) => setManualScanCode(e.target.value)}
                  placeholder='{"userId":"TAG_001","code":"8472910384"} or 8472910384'
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
                <button
                  onClick={handleManualScanSubmit}
                  disabled={!manualScanCode.trim()}
                  className="w-full py-2 rounded-xl bg-secondary text-dark font-black uppercase text-xs tracking-[0.2em] disabled:opacity-40"
                >
                  Use Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {scanResult && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-dark/95 backdrop-blur-3xl animate-in zoom-in-95 duration-300">
          <div className={`w-full max-sm p-12 rounded-[4rem] border-4 shadow-[0_0_100px_rgba(0,0,0,0.9)] ${
            scanResult.type === 'success' ? 'border-primary bg-primary/5' : scanResult.type === 'error' ? 'border-danger bg-danger/5' : 'border-secondary bg-secondary/5'
          }`}>
            <div className="text-center">
              <div className="text-9xl mb-10 drop-shadow-2xl">
                {scanResult.type === 'success' ? '🚨' : scanResult.type === 'error' ? '⚠️' : 'ℹ️'}
              </div>
              <h2 className={`text-4xl font-black mb-4 uppercase italic tracking-tighter ${
                scanResult.type === 'success' ? 'text-primary' : scanResult.type === 'error' ? 'text-danger' : 'text-secondary'
              }`}>
                {scanResult.type === 'success' ? 'LOGGED' : 'ERROR'}
              </h2>
              <div className="h-1.5 w-32 mx-auto bg-slate-800 my-8 rounded-full"></div>
              <p className="text-xl font-black leading-tight mb-12 text-slate-100 whitespace-pre-line">
                {scanResult.message}
              </p>
              <button 
                onClick={() => setScanResult(null)}
                className={`w-full py-7 rounded-3xl font-black uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all ${
                  scanResult.type === 'success' ? 'bg-primary text-white' : scanResult.type === 'error' ? 'bg-slate-700 text-white' : 'bg-secondary text-dark'
                }`}
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingViolation && (
        <div className="fixed inset-0 z-[111] flex items-center justify-center p-8 bg-dark/95 backdrop-blur-3xl animate-in zoom-in-95 duration-300">
          <div className="w-full max-sm p-10 rounded-[3rem] border-4 border-secondary bg-secondary/5 shadow-[0_0_100px_rgba(0,0,0,0.9)]">
            <div className="text-center">
              <div className="text-7xl mb-6">🧾</div>
              <h2 className="text-3xl font-black mb-4 uppercase italic tracking-tighter text-secondary">
                Confirm Report
              </h2>
              <p className="text-lg font-black leading-tight mb-8 text-slate-100 whitespace-pre-line">
                {`Scanned ID: ${pendingViolation.scannedValue}\nApply credit/debit now?`}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setPendingViolation(null)}
                  className="py-4 rounded-2xl font-black uppercase tracking-[0.2em] bg-slate-700 text-white active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmPendingViolation}
                  className="py-4 rounded-2xl font-black uppercase tracking-[0.2em] bg-primary text-white active:scale-95 transition-all"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/95 backdrop-blur-3xl border-t border-slate-800/50 px-6 py-5 flex justify-around z-40 shadow-[0_-25px_60px_rgba(0,0,0,0.4)]">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-2 ${activeTab === 'home' ? 'text-primary' : 'text-slate-600'}`}>
          <span className="text-3xl">🏠</span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Home</span>
        </button>
        <div className="relative -top-12">
           <button onClick={() => setActiveTab('registry')} className={`w-24 h-24 rounded-full p-2 shadow-2xl border-[10px] border-dark transition-all ${activeTab === 'registry' ? 'bg-gradient-to-tr from-secondary to-yellow-600' : 'bg-gradient-to-tr from-primary to-emerald-700'}`}>
             <div className="w-full h-full rounded-full bg-dark flex items-center justify-center text-4xl">🆔</div>
           </button>
        </div>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-2 ${activeTab === 'profile' ? 'text-primary' : 'text-slate-600'}`}>
          <span className="text-3xl">👤</span>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Identity</span>
        </button>
      </nav>

      <style>{`
        @keyframes scan { 0%, 100% { top: 10%; } 50% { top: 90%; } }
        .animate-scan { animation: scan 3s ease-in-out infinite; }
        .animate-gradient-x { background-size: 200% 200%; animation: gradient-x 15s ease infinite; }
        @keyframes gradient-x { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
      `}</style>
    </div>
  );
};

export default App;
