import React from 'react';
import { Folder, Clock, Scale, HeartPulse, Building2, BarChart2, Trash2, Plus, LayoutGrid, Settings } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
}

export default function Sidebar({ currentView, onNavigate }: SidebarProps) {
  return (
    <aside className="w-[260px] bg-slate-50 border-r border-slate-200 h-full flex flex-col flex-shrink-0">
      <div className="p-5 border-b border-slate-200 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-slate-800 font-semibold mb-1">
           <div className="bg-brand-600 text-white p-1.5 rounded-md">
             <LayoutGrid className="w-4 h-4" />
           </div>
           <span className="text-[15px]">Classification</span>
        </div>
        <span className="text-xs text-slate-500 font-medium">Batch v2.4 Active</span>
      </div>

      <div className="p-4">
        <button onClick={() => onNavigate('newBatch')} className="w-full bg-brand-600 hover:bg-brand-700 text-white flex items-center justify-center gap-2 py-2 px-4 rounded-md font-medium text-sm transition-colors cursor-pointer">
          <Plus className="w-4 h-4" />
          New Batch
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <div className="px-3 space-y-0.5">
           <button onClick={() => onNavigate('files')} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${currentView === 'files' ? 'bg-[#e0e7ff] text-brand-600' : 'text-slate-600 hover:bg-slate-100'}`}>
             <Folder className="w-4 h-4" />
             All Files
           </button>
           <button onClick={() => onNavigate('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${currentView === 'dashboard' ? 'bg-[#e0e7ff] text-brand-600' : 'text-slate-600 hover:bg-slate-100'}`}>
             <Clock className="w-4 h-4" />
             Recent
           </button>
        </div>

        <div className="mt-6 px-3">
          <h3 className="px-3 text-xs font-semibold text-slate-400 tracking-wider mb-2 uppercase">Categories</h3>
          <div className="space-y-0.5">
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors">
              <Scale className="w-4 h-4 text-slate-400" /> Legal
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors">
              <Building2 className="w-4 h-4 text-slate-400" /> Finance
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors">
              <HeartPulse className="w-4 h-4 text-slate-400" /> Health
            </button>
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-slate-200 space-y-0.5">
        <button onClick={() => onNavigate('settings')} className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md cursor-pointer transition-colors ${currentView === 'settings' ? 'bg-[#e0e7ff] text-brand-600' : 'text-slate-600 hover:bg-slate-100'}`}>
          <Settings className="w-4 h-4" /> Settings
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors">
          <BarChart2 className="w-4 h-4 border border-slate-400 rounded-xs" /> System Status
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors">
          <Trash2 className="w-4 h-4 text-slate-400" /> Trash
        </button>
      </div>
    </aside>
  );
}
