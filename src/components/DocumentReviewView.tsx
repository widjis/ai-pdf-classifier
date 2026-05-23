import React from 'react';
import { ArrowLeft, ZoomIn, ZoomOut, Search, Info, Settings2, CheckCircle2 } from 'lucide-react';
import { DocumentInfo } from '../types';

interface DocumentReviewViewProps {
  file: DocumentInfo;
  onBack: () => void;
  onApprove: () => void;
}

export default function DocumentReviewView({ file, onBack, onApprove }: DocumentReviewViewProps) {
  return (
    <div className="absolute inset-0 bg-[#f8fafc] flex flex-col z-20 w-full h-full">
      {/* Top Bar replacing Main Header */}
      <header className="h-[52px] border-b border-slate-200 bg-white flex items-center justify-between px-4 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
             <div className="bg-brand-600 text-white p-1 rounded-sm">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
             </div>
             <span className="font-semibold text-slate-900 text-[15px] tracking-tight">{file.name}</span>
          </div>
          <div className="w-px h-5 bg-slate-300 ml-1"></div>
          <span className="text-[13px] font-medium text-slate-500 ml-1">Page 1 of 4</span>
        </div>
        
        <div className="flex items-center gap-2.5 text-slate-500 mr-2">
           <button className="p-1.5 hover:bg-slate-100 rounded transition-colors cursor-pointer"><Search className="w-4 h-4" /></button>
           <span className="text-[13px] font-medium w-10 text-center text-slate-700">100%</span>
           <button className="p-1.5 hover:bg-slate-100 rounded transition-colors cursor-pointer"><ZoomOut className="w-4 h-4" /></button>
           <button className="p-1.5 hover:bg-slate-100 rounded transition-colors cursor-pointer"><ZoomIn className="w-4 h-4" /></button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex min-h-0 bg-[#eef1f4]">
        {/* Left Side: Document Viewer */}
        <div className="flex-1 p-8 overflow-y-auto flex justify-center custom-scrollbar">
            <div className="max-w-[750px] w-full bg-white shadow-lg border border-slate-300 relative h-max min-h-[1000px]">
               <img src={file.imageUrl} alt="Document" className="w-full h-full object-cover object-top opacity-90 blur-[1px] p-16" style={{ filter: 'grayscale(0.3) blur(0.5px)' }} />
               <div className="absolute inset-0 bg-white/20 pointer-events-none mix-blend-overlay"></div>
            </div>
        </div>

        {/* Right Side: Analysis Panel */}
        <div className="w-[360px] bg-white border-l border-slate-200 flex flex-col flex-shrink-0 z-10 relative">
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar pb-10">
             <h2 className="text-[19px] font-semibold text-brand-700 tracking-tight mb-2 leading-tight">AI Analysis Complete</h2>
             <p className="text-[13px] text-slate-500 mb-8 leading-relaxed font-medium">
               The document has been processed and matched against active schema definitions. Review the extraction confidence before approval.
             </p>

             <div className="space-y-6">
                 <div>
                   <label className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-2 block">Detected Category</label>
                   <div className="border border-slate-200 rounded-lg relative overflow-hidden bg-white shadow-sm">
                       <div className="p-4 border-b border-slate-100">
                         <div className="inline-flex items-center gap-1.5 bg-[#e0e7ff] px-2.5 py-1 rounded text-brand-700 text-[13px] font-semibold font-mono tracking-tight">
                           {file.category} <Info className="w-3.5 h-3.5 opacity-60 ml-1" />
                         </div>
                       </div>
                       
                       <div className="p-4 bg-slate-50/50">
                          <label className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-1.5 block">Recommended Mapping</label>
                          <div className="flex items-start justify-between">
                             <div>
                                <span className="font-bold text-slate-900 tracking-tight text-[18px]">{file.mappedCode}</span>
                                <p className="text-[12px] text-slate-500 mt-1.5 font-mono leading-snug">Maps to target table:<br/>dbo.ict_bak_records</p>
                             </div>
                             <div className="w-6 h-6 rounded-full bg-[#10b981] flex items-center justify-center text-white shadow-sm mt-1">
                                <CheckCircle2 className="w-4 h-4" strokeWidth={3} />
                             </div>
                          </div>
                       </div>
                   </div>
                 </div>

                 <div className="border border-slate-200 rounded-lg p-4 shadow-sm bg-white">
                     <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase flex items-center gap-1.5">
                           <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                           Confidence Score
                        </label>
                     </div>
                     <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[34px] font-bold text-slate-900 tracking-tighter tabular-nums leading-none flex items-start">
                          {file.confidence}
                          <span className="text-[18px] font-semibold text-slate-400 ml-0.5 mt-1">%</span>
                        </span>
                        <span className="bg-[#e2f5ec] text-[#006242] text-[11px] font-bold px-2 py-1 rounded uppercase tracking-wider relative -top-1">High Match</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-4">
                        <div className="h-full bg-[#10b981] rounded-full transition-all duration-700 ease-out" style={{ width: `${file.confidence}%` }}></div>
                     </div>
                 </div>

                 <div>
                    <label className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase mb-2.5 block">Key Extracted Fields</label>
                    <div className="border border-slate-200 rounded-md overflow-hidden bg-white shadow-sm">
                       <table className="w-full text-left">
                         <tbody className="divide-y divide-slate-100">
                           {file.extractedFields && Object.entries(file.extractedFields).map(([key, value]) => (
                             <tr key={key} className="hover:bg-slate-50 transition-colors">
                               <td className="py-2.5 px-3 text-slate-500 font-medium w-[130px] border-r border-slate-100 text-[13px]">{key}</td>
                               <td className="py-2.5 px-4 text-slate-900 font-medium text-[13px]">{value}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                    </div>
                 </div>
             </div>
          </div>
          
          <div className="p-4 border-t border-slate-200 bg-white flex gap-3 flex-shrink-0 z-20">
             <button className="px-5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-md flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm text-[14px] py-2.5">
               <Settings2 className="w-4 h-4 text-slate-500" />
               Re-classify
             </button>
             <button onClick={onApprove} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-md flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer text-[14px]">
               <CheckCircle2 className="w-4 h-4" /> Approve
             </button>
          </div>
        </div>
      </div>
      
      {/* Required for the custom scrollbar in Tailwind */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
      `}</style>
    </div>
  );
}
