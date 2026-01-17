
import React from 'react';
import { PlusCircle, Home, BookOpen, Layers, Repeat, Database } from 'lucide-react';
import { AppMode } from '../types';

interface HeaderProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  onOpenUpload: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentMode, setMode, onOpenUpload }) => {
  return (
    <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-lg border-b border-silver-200 px-6 py-4 flex items-center justify-between">
      <div 
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => setMode(AppMode.HOME)}
      >
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold group-hover:rotate-6 transition-all duration-300">
          A
        </div>
        <h1 className="text-xl font-bold tracking-tight text-silver-600">Arirang Fluent</h1>
      </div>

      <nav className="flex items-center gap-8">
        {[
          { mode: AppMode.LEARN_SENTENCE, icon: BookOpen, label: '句模 Learn' },
          { mode: AppMode.LEARN_CHUNK, icon: Layers, label: '单词块 Learn' },
          { mode: AppMode.REVIEW_SHADOWING, icon: Repeat, label: 'Shadowing' },
          { mode: AppMode.LIBRARY, icon: Database, label: '语料库' }
        ].map(({ mode, icon: Icon, label }) => (
          <button 
            key={mode}
            onClick={() => setMode(mode)}
            className={`flex items-center gap-2 text-sm font-medium transition-all ${currentMode === mode ? 'text-primary-600' : 'text-silver-400 hover:text-silver-600'}`}
          >
            <Icon size={18} className={currentMode === mode ? 'animate-pulse' : ''} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <button 
        onClick={onOpenUpload}
        className="flex items-center gap-2 bg-silver-600 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-silver-700 transition-all active:scale-95 high-end-shadow"
      >
        <PlusCircle size={18} />
        语料上传
      </button>
    </header>
  );
};

export default Header;
