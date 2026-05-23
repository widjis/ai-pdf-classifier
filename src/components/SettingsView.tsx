import React from 'react';
import { ArrowRight, Download, Plus } from 'lucide-react';
import { mockMappings } from '../data';

export default function SettingsView() {
  return (
    <div className="max-w-[800px] w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Export Settings</h2>
        <p className="text-[15px] text-slate-600">Configure prefix mappings and prepare classified files for final export.</p>
      </div>

      <div className="mb-10">
         <div className="flex items-center justify-between mb-4">
            <div>
               <h3 className="text-[17px] font-semibold text-slate-900 mb-0.5">Prefix Mappings</h3>
               <p className="text-[14px] text-slate-500">Rules for renaming files based on classification output.</p>
            </div>
            <button className="text-brand-600 hover:text-brand-700 font-medium text-sm flex items-center gap-1 cursor-pointer transition-colors">
              <Plus className="w-4 h-4" /> Add Mapping
            </button>
         </div>

         <div className="flex flex-wrap gap-4">
           {mockMappings.map(mapping => (
             <div key={mapping.id} className="border border-slate-200 bg-white rounded-md p-3 flex items-center justify-center gap-4 shadow-sm min-w-[200px]">
               <div className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-600 text-[13px] font-mono tracking-wide font-medium w-32 text-center truncate">
                 {mapping.source}
               </div>
               <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
               <div className="bg-[#e0e7ff] border border-blue-100 rounded px-2.5 py-1.5 text-brand-700 text-[13px] font-mono tracking-wide font-medium w-32 text-center truncate shadow-inner">
                 {mapping.target}
               </div>
             </div>
           ))}
         </div>
      </div>

      <div className="bg-[#f8fafc] border border-blue-100/60 rounded-xl p-8 shadow-sm relative overflow-hidden mt-6">
         <div className="flex items-start justify-between">
           <div className="max-w-[460px]">
             <div className="flex items-center gap-3 mb-2.5">
                 <div className="w-9 h-9 rounded bg-[#e0e7ff] text-brand-600 flex items-center justify-center -ml-1">
                    <Download className="w-4 h-4" />
                 </div>
                 <h3 className="text-[19px] font-bold text-slate-900 tracking-tight">Download Prepared ZIP</h3>
             </div>
             <p className="text-[15px] text-slate-600 mb-6 leading-relaxed ml-11">
               The system has finished processing the current batch applying your prefix rules.
             </p>
             
             <div className="flex items-center gap-4 ml-11">
                <div className="bg-[#e2f5ec] border border-[#a7f3d0] text-[#006242] text-[13px] font-medium px-3 py-1.5 rounded flex items-center gap-2 shadow-sm">
                   <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></div>
                   120 Files ready for export
                </div>
                <div className="w-px h-5 bg-slate-300"></div>
                <span className="text-[14px] text-slate-500 font-medium">Total Size: 45.2 MB</span>
             </div>
           </div>

           <button className="bg-brand-600 hover:bg-brand-700 text-white font-medium px-6 py-3 rounded-md flex items-center justify-center gap-3 transition-colors mt-2 shadow-sm cursor-pointer whitespace-nowrap min-w-[200px] flex-col">
             <Download className="w-5 h-5 mb-1" />
             Download Archive
           </button>
         </div>
      </div>
    </div>
  );
}
