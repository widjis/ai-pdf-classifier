import React, { useState } from 'react';
import { CheckCircle2, RefreshCw, AlertTriangle, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { mockDocuments } from '../data';
import { DocumentInfo } from '../types';

interface BatchProcessingViewProps {
  onReview: (file: DocumentInfo) => void;
}

export default function BatchProcessingView({ onReview }: BatchProcessingViewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    const newDocs = new Set(selectedIds);
    if (newDocs.has(id)) newDocs.delete(id);
    else newDocs.add(id);
    setSelectedIds(newDocs);
  };

  const displayDocs = mockDocuments.slice(0, 5);

  const toggleAll = () => {
    if (selectedIds.size === displayDocs.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayDocs.map(d => d.id)));
  };

  return (
    <div className="max-w-[1100px] w-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Batch Processing</h2>
        <p className="text-[15px] text-slate-500">Processing 12 documents in Batch-REQ-90210.</p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-end mb-2">
           <span className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase">Progress</span>
           <span className="text-[13px] font-semibold text-brand-600">8/12 Classified (66%)</span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-brand-600 rounded-full transition-all duration-500" style={{ width: '66%' }}></div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#f8fafc]">
                <th className="py-2.5 px-4 w-12 text-center">
                  <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" 
                    checked={selectedIds.size > 0 && selectedIds.size === displayDocs.length} 
                    onChange={toggleAll} />
                </th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Original Filename</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">AI Category</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mapped Code</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Requester</th>
                <th className="py-2.5 px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[13px]">
              {displayDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => onReview(doc)}>
                  <td className="py-3.5 px-4 w-12 text-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      checked={selectedIds.has(doc.id)} onChange={() => toggleSelect(doc.id)} />
                  </td>
                  <td className="py-3.5 px-4">
                     <div className="flex items-center gap-2.5 text-slate-700">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${doc.status === 'Failed' ? 'text-red-400' : 'text-slate-400'}`} />
                        <span className="font-medium truncate max-w-[240px] text-slate-800">{doc.name}</span>
                     </div>
                  </td>
                  <td className="py-3.5 px-4">
                     <span className={`px-2 py-0.5 rounded textxs font-medium ${
                       doc.status === 'Classified' ? 'bg-[#e2f5ec] text-[#006242]' :
                       doc.status === 'Processing' ? 'bg-[#e0e7ff] text-brand-700' :
                       'bg-red-50 text-red-700'
                     }`}>
                       {doc.category}
                     </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono tracking-tight text-xs font-semibold">
                    {doc.mappedCode}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {doc.requester}
                  </td>
                  <td className="py-3.5 px-4">
                     <div className="flex items-center gap-1.5 font-medium">
                       {doc.status === 'Classified' && (
                         <>
                           <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                           <span className="text-slate-600">Classified</span>
                         </>
                       )}
                       {doc.status === 'Processing' && (
                         <>
                           <RefreshCw className="w-4 h-4 text-brand-600 animate-spin" />
                           <span className="text-brand-600">Processing</span>
                         </>
                       )}
                       {doc.status === 'Failed' && (
                         <>
                           <AlertTriangle className="w-4 h-4 text-red-500" />
                           <span className="text-red-500">Failed</span>
                         </>
                       )}
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="bg-slate-50/80 border-t border-slate-200 p-3 px-4 flex items-center justify-between text-[13px] text-slate-500 font-medium">
           <span>Showing 1-5 of 12 files</span>
           <div className="flex items-center gap-1.5">
              <button className="px-1.5 py-1.5 bg-white border border-slate-200 rounded text-slate-400 hover:bg-slate-100 cursor-pointer disabled:opacity-50 transition-colors" disabled>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="px-1.5 py-1.5 bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-100 cursor-pointer shadow-sm transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
