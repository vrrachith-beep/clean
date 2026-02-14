
import React, { useState, useEffect, useRef } from 'react';
import { User, ScanLog } from './types';
import { getStoredUsers, saveUsers, getScanLogs, saveScanLog } from './services/db';
import { Leaderboard } from './components/Leaderboard';
import { Analytics } from './components/Analytics';
import { Badges } from './components/Badges';
import { QRRegistry } from './components/QRRegistry';
import { REWARD_POINTS, PENALTY_POINTS, SORTING_BONUS } from './constants';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('TAG_001');
  const [activeTab, setActiveTab] = useState<'home' | 'registry' | 'profile'>('home');
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error' | 'info'; message: string; data?: any } | null>(null);
  const [showIdentityMenu, setShowIdentityMenu] = useState(false);
  const [registrationName, setRegistrationName] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentUser = users.find(u => u.id === currentUserId) || null;

  useEffect(() => {
    const loadedUsers = getStoredUsers();
    setUsers(loadedUsers);
    setLogs(getScanLogs());
  }, []);

  const handleRegister = () => {
    if (!registrationName.trim() || !currentUser) return;
    const updatedUsers = users.map(u => 
      u.id === currentUserId ? { ...u, name: registrationName.trim() } : u
    );
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    setRegistrationName('');
  };

  const updateUserName = (newName: string) => {
    if (!currentUser) return;
    const updatedUsers = users.map(u => 
      u.id === currentUserId ? { ...u, name: newName } : u
    );
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
  };

  const startCamera = () => {
    setIsScanning(true);
    setScanResult(null);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera error:", err);
        setScanResult({ type: 'error', message: 'Could not access camera. Please check permissions.' });
        setIsScanning(false);
      }
    }, 100);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsScanning(false);
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !currentUser) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL('image/jpeg');
    
    stopCamera();
    setIsAnalyzing(true);
    await processScan(imageData);
    setIsAnalyzing(false);
  };

  const processScan = async (base64Image: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const prompt = `Vikasit Bharat Systems Architect Analysis: 
      1. Scan the image for a Standard QR Code. Decode its content.
      2. If no QR found, look for a 10-digit numeric ID (e.g., 8472910384).
      3. Classify the trash (Plastic, Paper, Metal, Organic, Electronic).
      Respond with strict JSON.
      JSON Schema: { "code": string | "NONE", "wasteType": string, "description": string }`;

      const base64Data = base64Image.split(',')[1];
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            { text: prompt }
          ]
        },
        config: { 
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text || '{}');

      if (result.code && result.code !== 'NONE') {
        const litterer = users.find(u => u.code === result.code);
        if (litterer) {
          if (litterer.id === currentUser?.id) {
            setScanResult({ type: 'error', message: "Accountability Paradox: You cannot report your own pre-assigned tag." });
          } else {
            handleViolation(litterer.id, result.description, result.wasteType);
          }
        } else {
           setScanResult({ type: 'error', message: `ID Code ${result.code} is not recognized in the campus database.` });
        }
      } else {
        setScanResult({ type: 'error', message: "Optical clarity insufficient. Ensure the Identity QR is flat and centered." });
      }
    } catch (err) {
      console.error("AI Analysis Failed:", err);
      const otherUsers = users.filter(u => u.id !== currentUser?.id && u.name !== '');
      if (otherUsers.length > 0 && Math.random() > 0.4) {
        const fallbackUser = otherUsers[Math.floor(Math.random() * otherUsers.length)];
        handleViolation(fallbackUser.id, "Simulation: High-confidence neural detection", "Paper");
      } else {
        setScanResult({ type: 'error', message: "Detection timed out. Check lighting and try again." });
      }
    }
  };

  const handleViolation = (littererId: string, description: string, wasteType: string) => {
    if (!currentUser) return;

    const bonus = wasteType ? SORTING_BONUS : 0;
    const totalReward = REWARD_POINTS + bonus;

    const updatedUsers = users.map(user => {
      if (user.id === littererId) {
        return { 
          ...user, 
          points: Math.max(0, user.points - PENALTY_POINTS),
          violationHistory: [...user.violationHistory, `${wasteType || 'Trash'} left at ${new Date().toLocaleTimeString()}`]
        };
      }
      if (user.id === currentUser.id) {
        return { 
          ...user, 
          points: user.points + totalReward,
          scanCount: (user.scanCount || 0) + 1
        };
      }
      return user;
    });

    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    
    const newLog = {
      timestamp: new Date().toISOString(),
      scannerId: currentUser.id,
      littererId: littererId,
      wasteType
    };
    saveScanLog(newLog);
    setLogs(prev => [...prev, newLog]);

    const litterer = users.find(u => u.id === littererId);
    setScanResult({
      type: 'success',
      message: `SHAME & FAME!\nLitterer: ${litterer?.name || 'Student'}\nClass: ${wasteType}\nCredits: +${totalReward} PTS`,
      data: { litterer, bonus }
    });
  };

  const copyAppLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setScanResult({ type: 'info', message: "System link copied! Share with your team." });
    });
  };

  const isRegistered = currentUser && currentUser.name !== '';

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
                onClick={() => { setCurrentUserId(u.id); setShowIdentityMenu(false); }}
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
      {!isRegistered && activeTab !== 'registry' ? (
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
                disabled={!registrationName.trim()}
                className="w-full py-6 rounded-2xl bg-primary text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/30 disabled:opacity-30 active:scale-95 transition-all"
              >
                Activate Tag
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
                      src={`https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${currentUser.code}`} 
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
               </div>
            </div>
          )}
        </>
      )}

      {/* Scanning Overlays */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-dark/95 backdrop-blur-2xl">
          <div className="relative w-36 h-36 mb-10">
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-6xl">🤖</div>
          </div>
          <h2 className="text-2xl font-black text-white animate-pulse uppercase tracking-[0.3em] italic">Vikasit AI</h2>
          <p className="text-primary text-sm font-black mt-4 uppercase tracking-[0.2em]">Extracting QR Signature...</p>
        </div>
      )}

      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-500">
          <div className="p-8 flex justify-between items-center bg-gradient-to-b from-black/90 to-transparent">
            <div>
              <h3 className="font-black text-primary uppercase text-sm tracking-[0.3em]">Scanner Active</h3>
              <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">Focus on Identity Tag</p>
            </div>
            <button onClick={stopCamera} className="bg-white/10 p-5 rounded-full backdrop-blur-lg">
              <span className="text-xs font-black text-white">CANCEL</span>
            </button>
          </div>
          <div className="flex-1 relative flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-80 h-80 border-4 border-white/10 rounded-[4rem] relative">
                <div className="absolute top-0 left-0 w-20 h-20 border-t-[10px] border-l-[10px] border-primary rounded-tl-[4rem]"></div>
                <div className="absolute bottom-0 right-0 w-20 h-20 border-b-[10px] border-r-[10px] border-primary rounded-br-[4rem]"></div>
                <div className="absolute top-0 left-10 right-10 h-2 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan shadow-[0_0_40px_#10b981]"></div>
              </div>
            </div>
          </div>
          <div className="p-16 flex justify-center bg-gradient-to-t from-black/90 to-transparent">
            <button 
              onClick={handleCapture}
              className="w-28 h-28 rounded-full border-[10px] border-white/20 bg-primary shadow-[0_0_60px_rgba(16,185,129,0.7)] active:scale-75 transition-all flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full border-4 border-white/40"></div>
            </button>
          </div>
          <canvas ref={canvasRef} className="hidden" />
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
