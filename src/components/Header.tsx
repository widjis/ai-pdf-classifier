import React from 'react';
import { Bell, HelpCircle, Search } from 'lucide-react';
import { ViewState } from '../types';

interface HeaderProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

export default function Header({ currentView, onNavigate }: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 flex-shrink-0">
      <div className="flex items-center gap-10 h-full">
        <h1 className="text-xl font-bold text-brand-600 tracking-tight flex items-center">PDF.AI</h1>
        <nav className="flex space-x-6 h-full">
          {(['dashboard', 'files', 'settings'] as ViewState[]).map((tab) => (
            <button
              key={tab}
              onClick={() => onNavigate(tab)}
              className={`h-full px-2 text-sm font-medium border-b-2 transition-colors capitalize cursor-pointer flex items-center mt-[1px] ${
                currentView === tab
                  ? 'border-brand-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-5">
        {currentView === 'dashboard' && (
          <div className="relative relative flex items-center h-full">
            <Search className="w-4 h-4 absolute left-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              className="pl-9 pr-4 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 w-64 text-slate-800 placeholder-slate-400 bg-slate-50"
            />
          </div>
        )}
        <div className="flex items-center gap-4 text-slate-500 ml-2">
          <button className="hover:text-slate-800 transition-colors cursor-pointer relative">
            <Bell className="w-5 h-5" />
             <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          </button>
          <button className="hover:text-slate-800 transition-colors cursor-pointer">
            <HelpCircle className="w-5 h-5" />
          </button>
          <button className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-slate-200 cursor-pointer">
             <img src="https://i.pravatar.cc/150?u=a042581f4e" alt="User" className="w-full h-full object-cover" />
          </button>
        </div>
      </div>
    </header>
  );
}
