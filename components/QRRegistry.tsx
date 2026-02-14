
import React from 'react';
import { User } from '../types';

interface QRRegistryProps {
  users: User[];
}

export const QRRegistry: React.FC<QRRegistryProps> = ({ users }) => {
  const buildQrPayload = (user: User): string => {
    return JSON.stringify({ userId: user.id, code: user.code });
  };

  // Sorting: Registered students alphabetically, then unclaimed slots at the bottom
  const sortedUsers = [...users].sort((a, b) => {
    if (a.name === '' && b.name !== '') return 1;
    if (a.name !== '' && b.name === '') return -1;
    if (a.name === '' && b.name === '') return a.id.localeCompare(b.id);
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="bg-slate-800/40 rounded-[2.5rem] p-6 backdrop-blur-md border border-slate-700/50 shadow-2xl mt-6 animate-in slide-in-from-bottom-8 duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-black flex items-center gap-3">
            <span className="text-primary text-2xl">🆔</span> Student Tags
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold mt-1">Identity QR Registry</p>
        </div>
        <div className="bg-slate-900 px-3 py-1.5 rounded-full border border-slate-700">
           <span className="text-[10px] text-primary font-black uppercase tracking-widest">Active</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {sortedUsers.map((user) => (
          <div 
            key={user.id} 
            className={`border-2 rounded-[2rem] p-4 flex flex-col items-center group active:scale-95 transition-all duration-300 shadow-lg ${
              user.name 
                ? 'bg-slate-900/60 border-slate-800/80 hover:border-primary/30' 
                : 'bg-slate-900/20 border-slate-800/30 opacity-60'
            }`}
          >
            {/* Real scannable QR Code */}
            <div className={`relative w-full aspect-square bg-white rounded-2xl mb-4 flex items-center justify-center p-2 shadow-inner overflow-hidden ${!user.name && 'grayscale'}`}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(buildQrPayload(user))}`} 
                alt={`QR for ${user.code}`}
                className="w-full h-full object-contain"
              />
              {user.name && (
                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                  <span className="text-[10px] font-black text-dark bg-primary px-2 py-0.5 rounded shadow-lg uppercase tracking-widest">REGISTERED</span>
                </div>
              )}
            </div>
            
            <span className={`text-sm font-black truncate w-full text-center transition-colors tracking-tight ${user.name ? 'text-white group-hover:text-primary' : 'text-slate-600 italic'}`}>
              {user.name || "Unclaimed Tag"}
            </span>
            <div className="flex flex-col items-center gap-0.5 mt-2 bg-slate-800/50 px-3 py-1 rounded-lg">
              <span className="text-[10px] font-mono font-bold text-slate-400 tracking-[0.1em]">{user.code}</span>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{user.id}</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
         <p className="text-[11px] text-slate-400 text-center leading-relaxed italic">
           <span className="font-black text-primary uppercase not-italic">Identity Verification:</span> Unclaimed tags are ready for registration. Select a slot from the identity menu to claim your student code.
         </p>
      </div>
    </div>
  );
};
