
import React from 'react';
import { User } from '../types';

interface LeaderboardProps {
  users: User[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ users }) => {
  // Only show users with names
  const registeredUsers = users.filter(u => u.name !== '');
  const sortedUsers = [...registeredUsers].sort((a, b) => b.points - a.points);

  return (
    <div className="bg-slate-800/50 rounded-[2.5rem] p-6 backdrop-blur-md border border-slate-700/50 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black flex items-center gap-3">
          <span className="text-secondary text-2xl drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]">🏆</span> 
          Clean Leaderboard
        </h2>
        <span className="text-[9px] bg-slate-700 px-3 py-1 rounded-full text-slate-400 uppercase font-black tracking-widest">Live Updates</span>
      </div>
      
      {sortedUsers.length === 0 ? (
        <div className="text-center py-10">
           <p className="text-sm text-slate-500 italic">No registered students yet.</p>
           <p className="text-[10px] text-slate-600 uppercase mt-2">Claim a tag to join the leaderboard</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-2">
          {sortedUsers.map((user, index) => (
            <div 
              key={user.id} 
              className={`flex items-center justify-between p-4 rounded-[1.5rem] border transition-all duration-300 ${
                index === 0 ? 'bg-secondary/10 border-secondary/40 shadow-lg shadow-secondary/5' : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                  index === 0 ? 'bg-secondary text-dark' : 'bg-slate-800 text-slate-500'
                }`}>
                  {index + 1}
                </span>
                <div className="flex flex-col">
                  <span className="font-black text-white tracking-tight leading-tight">{user.name}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{user.id}</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-black text-lg leading-none ${user.points >= 1000 ? 'text-primary' : 'text-danger'}`}>
                  {user.points}
                </div>
                <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mt-1">Credits</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
