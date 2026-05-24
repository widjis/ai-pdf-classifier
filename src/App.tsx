import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { ViewState, DocumentInfo } from './types';
import { mockDocuments } from './data';

// Placeholder imports for views
import DashboardView from './components/DashboardView';
import BatchProcessingView from './components/BatchProcessingView';
import SettingsView from './components/SettingsView';
import DocumentReviewView from './components/DocumentReviewView';
import NewBatchView from './components/NewBatchView';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('files');
  const [selectedFile, setSelectedFile] = useState<DocumentInfo | null>(mockDocuments[7]); 
  const [pendingNewBatchFiles, setPendingNewBatchFiles] = useState<File[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  // Pre-load the document review doc to simplify debugging if navigating directly

  const navigateTo = (view: ViewState) => setCurrentView(view);
  
  const handleReviewFile = (file: DocumentInfo) => {
    setSelectedFile(file);
    setCurrentView('review');
  };

  const handleCreateBatchFromDashboard = (files: File[]) => {
    setPendingNewBatchFiles(files);
    setCurrentView('newBatch');
  };

  const handleApprove = () => {
      // In a real app, update file status
      navigateTo('files');
  };

  return (
    <div className="flex h-screen bg-[#f7f9fb] font-sans text-slate-900 overflow-hidden">
      <Sidebar currentView={currentView} onNavigate={navigateTo} />
      
      <div className="flex-1 flex flex-col min-w-0 bg-white/50 h-full">
        {currentView !== 'review' && (
          <Header currentView={currentView} onNavigate={navigateTo} />
        )}
        
        <main className="flex-1 overflow-y-auto px-8 pt-8 pb-12 w-full h-full relative">
           {currentView === 'dashboard' && <DashboardView onReview={handleReviewFile} onCreateBatch={handleCreateBatchFromDashboard} />}
           {currentView === 'files' && <BatchProcessingView onReview={handleReviewFile} activeBatchId={activeBatchId} />}
           {currentView === 'newBatch' && (
             <NewBatchView
               initialFiles={pendingNewBatchFiles}
               onCancel={() => {
                 setPendingNewBatchFiles([]);
                 navigateTo('files');
               }}
               onStart={({ batchId }) => {
                 setPendingNewBatchFiles([]);
                 setActiveBatchId(batchId);
                 navigateTo('files');
               }}
             />
           )}
           {currentView === 'settings' && <SettingsView section="general" />}
           {currentView === 'aiConfiguration' && <SettingsView section="aiConfiguration" />}
           {currentView === 'review' && selectedFile && (
             <DocumentReviewView 
               file={selectedFile} 
               onBack={() => navigateTo('files')} 
               onApprove={handleApprove}
             />
           )}
        </main>
      </div>
    </div>
  );
}
