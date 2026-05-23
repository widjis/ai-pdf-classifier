import React, { useEffect, useState } from 'react';
import { CloudUpload, FileText, ExternalLink, RefreshCw } from 'lucide-react';
import { mockDocuments } from '../data';
import { DocumentInfo } from '../types';
import { api } from '../lib/api/client';

interface DashboardViewProps {
  onReview: (file: DocumentInfo) => void;
}

export default function DashboardView({ onReview }: DashboardViewProps) {
  const recentDocs = [mockDocuments[5], mockDocuments[6], mockDocuments[1]];
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'degraded'>('checking');
  
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await api.health();
        const db = await api.dbPing();
        if (!cancelled) setApiStatus(health.status === 'ok' && db.ok ? 'ok' : 'degraded');
      } catch {
        if (!cancelled) setApiStatus('degraded');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-[1024px] w-full">
      <div className="mb-6 border-b border-slate-200 pb-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[18px] font-semibold text-slate-900 mb-0.5">Overview</h2>
          <div
            className={`px-2.5 py-1 rounded text-[12px] font-semibold ${
              apiStatus === 'ok'
                ? 'bg-[#e2f5ec] text-[#006242]'
                : apiStatus === 'checking'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-red-50 text-red-700'
            }`}
          >
            {apiStatus === 'ok' ? 'API: Connected' : apiStatus === 'checking' ? 'API: Checking…' : 'API: Unavailable'}
          </div>
        </div>
        <p className="text-[14px] text-slate-500">Drop files to classify or review recent activity.</p>
      </div>

      <div className="grid grid-cols-[1fr_280px] gap-6 mb-8 items-stretch">
        <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-brand-500 hover:bg-slate-50 transition-colors py-14">
          <div className="bg-[#e0e7ff] w-14 h-14 rounded-xl flex items-center justify-center mb-5 shadow-sm">
             <CloudUpload className="w-7 h-7 text-brand-600" />
          </div>
          <h3 className="font-semibold text-slate-800 text-lg mb-1.5">Drag & Drop PDFs</h3>
          <p className="text-[14px] text-slate-500 max-w-[340px] leading-relaxed mb-6">Support for standard PDF, OCR PDF, and scanned image documents up to 50MB per file.</p>
          <button className="px-6 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded text-sm transition-colors border border-slate-200 shadow-sm">
            Browse Files
          </button>
        </div>

        <div className="border border-slate-200 bg-white rounded-xl p-6 shadow-sm flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-[11px] font-bold text-slate-500 tracking-widest uppercase">Processing Queue</h3>
             <button className="text-brand-600 hover:bg-slate-50 p-1.5 rounded transition-colors"><ExternalLink className="w-4 h-4" /></button>
          </div>
          <div className="text-6xl font-light text-slate-900 tracking-tighter mb-4 mt-auto">12</div>
          <p className="text-[14px] text-slate-500 leading-relaxed mb-8">
            Files currently in classification pipeline.
          </p>
          
          <div className="mt-auto">
            <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
               <span>Compute Load</span>
               <span>42%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
               <div className="h-full bg-brand-600 rounded-full transition-all duration-700 ease-out" style={{ width: '42%' }}></div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[16px] font-semibold text-slate-800">Recent Activity</h3>
          <button className="text-[13px] font-semibold text-brand-600 hover:text-brand-700 tracking-wide transition-colors">View All</button>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
            <thead>
                <tr className="text-[13px] font-semibold text-slate-500 border-b border-slate-200 bg-slate-50/50">
                    <th className="py-3 px-4 font-medium w-full">File Name</th>
                    <th className="py-3 px-4 font-medium w-28">Size</th>
                    <th className="py-3 px-4 font-medium w-48">Status</th>
                    <th className="py-3 px-4 font-medium w-32 text-right">Time</th>
                </tr>
            </thead>
            <tbody className="text-[14px]">
                {recentDocs.map((doc, idx) => (
                    <tr key={idx} className="border-b border-slate-100 group hover:bg-slate-50/80 transition-colors last:border-0 cursor-pointer" onClick={() => (doc.status === 'Ready for Review' || doc.category === 'BA_HALO') ? onReview(doc) : null}>
                    <td className="py-4 px-4 font-medium text-slate-700 truncate max-w-[320px]">
                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded border shadow-sm ${doc.category === 'BA_HALO' ? 'bg-[#e2f5ec] border-[#a7f3d0]' : 'bg-slate-100 border-slate-200'}`}>
                              <FileText className={`w-4 h-4 ${doc.category === 'BA_HALO' ? 'text-[#006242]' : 'text-slate-400'}`} />
                            </div>
                            {doc.name}
                        </div>
                    </td>
                    <td className="py-4 px-4 text-slate-500 tabular-nums font-medium text-[13px]">{doc.size}</td>
                    <td className="py-4 px-4">
                        {doc.status === 'Processing' && (
                            <div className="flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-brand-600 animate-spin" />
                            <span className="text-brand-600 font-semibold text-[13px]">Analyzing...</span>
                            <div className="w-full max-w-[120px] h-0.5 bg-slate-200 mt-1 absolute bottom-0 left-0 hidden group-hover:block"><div className="w-1/3 h-full bg-brand-600 animate-pulse"></div></div>
                            </div>
                        )}
                        {doc.status === 'Ready for Review' && (
                            <span className="px-2.5 py-1 bg-[#e0e7ff] text-brand-700 font-semibold rounded text-[12px] flex items-center gap-1.5 w-max">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-600 block"></span> Ready for Review
                            </span>
                        )}
                        {doc.category === 'BA_HALO' && (
                            <span className="flex items-center gap-1.5 text-[#006242] font-semibold text-[13px] bg-[#e2f5ec] px-2.5 py-1 rounded w-max">
                                <svg className="w-4 h-4 text-[#10B981]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                {doc.category}
                            </span>
                        )}
                    </td>
                    <td className="py-4 px-4 text-slate-400 text-right text-[13px] font-medium">{doc.time}</td>
                    </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
