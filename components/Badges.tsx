
import React from 'react';
import { Badge, User } from '../types';
import { BADGES } from '../constants';

interface BadgesProps {
  user: User;
}

export const Badges: React.FC<BadgesProps> = ({ user }) => {
  return (
    <div className="bg-slate-800/50 rounded-2xl p-4 backdrop-blur-sm border border-slate-700 shadow-xl mt-6">
      <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span className="text-secondary">🎖️</span> My Achievements
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {BADGES.map((badge) => {
          const isEarned = badge.id === 'b4' ? user.points >= badge.threshold : user.scanCount >= badge.threshold;
          return (
            <div 
              key={badge.id} 
              title={badge.description}
              className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                isEarned 
                  ? 'bg-secondary/20 border-secondary border-2 scale-105 shadow-lg shadow-secondary/10' 
                  : 'bg-slate-900/50 border-slate-800 grayscale opacity-50'
              }`}
            >
              <span className="text-2xl mb-1">{badge.icon}</span>
              <span className="text-[8px] font-bold text-center uppercase leading-tight">{badge.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
