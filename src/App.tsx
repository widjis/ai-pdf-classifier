import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { ViewState, DocumentInfo } from './types';
import { mockDocuments } from './data';
import { api, authToken } from './lib/api/client';
import type { AuthUser } from './lib/api/types';

// Placeholder imports for views
import DashboardView from './components/DashboardView';
import BatchProcessingView from './components/BatchProcessingView';
import SettingsView from './components/SettingsView';
import DocumentReviewView from './components/DocumentReviewView';
import NewBatchView from './components/NewBatchView';
import LoginView from './components/LoginView';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('files');
  const [selectedFile, setSelectedFile] = useState<DocumentInfo | null>(mockDocuments[7]); 
  const [pendingNewBatchFiles, setPendingNewBatchFiles] = useState<File[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthBootstrapping, setIsAuthBootstrapping] = useState(true);
  // Pre-load the document review doc to simplify debugging if navigating directly

  const navigateTo = (view: ViewState) => {
    if (view === 'manageUsers' && authUser?.role !== 'admin') {
      setCurrentView('settings');
      return;
    }
    setCurrentView(view);
  };
  
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

  useEffect(() => {
    const token = authToken.get();
    if (!token) {
      setIsAuthBootstrapping(false);
      return;
    }

    let cancelled = false;
    void api.auth
      .me()
      .then((res) => {
        if (!cancelled) setAuthUser(res.user);
      })
      .catch(() => {
        authToken.clear();
        if (!cancelled) setAuthUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsAuthBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isAuthBootstrapping) {
    return (
      <div className="min-h-screen w-full relative isolate overflow-hidden bg-slate-950 flex items-center justify-center px-4 py-12">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.25)_1px,transparent_0)] [background-size:28px_28px] opacity-60" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,83,219,0.22),transparent_38%,rgba(16,185,129,0.18))]" />
          <div className="absolute -top-36 -left-40 w-[520px] h-[520px] bg-brand-600/25 rounded-full blur-[120px]" />
          <div className="absolute -bottom-40 -right-44 w-[560px] h-[560px] bg-emerald-500/20 rounded-full blur-[130px]" />
        </div>
        <div className="relative rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/75 backdrop-blur-xl">
          Loading…
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <LoginView
        onSuccess={(user) => {
          setAuthUser(user);
          setCurrentView('files');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full relative isolate overflow-hidden bg-slate-950 px-4 py-6 font-sans text-slate-900">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.25)_1px,transparent_0)] [background-size:28px_28px] opacity-60" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,83,219,0.22),transparent_38%,rgba(16,185,129,0.18))]" />
        <div className="absolute -top-36 -left-40 w-[520px] h-[520px] bg-brand-600/25 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-44 w-[560px] h-[560px] bg-emerald-500/20 rounded-full blur-[130px]" />
      </div>

      <div className="relative mx-auto h-[calc(100vh-48px)] w-full max-w-[1480px] rounded-3xl overflow-hidden border border-white/10 bg-white/5 shadow-[0_30px_120px_-45px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        <div className="flex h-full overflow-hidden">
          <Sidebar
            authUser={authUser}
            currentView={currentView}
            onNavigate={navigateTo}
            activeCategory={activeCategory}
            onSelectCategory={(category) => {
              setActiveCategory(category);
              setActiveBatchId(null);
              navigateTo('files');
            }}
          />

          <div className="flex-1 flex flex-col min-w-0 bg-[#f7f9fb] h-full">
            {currentView !== 'review' && (
              <Header currentView={currentView} onNavigate={navigateTo} />
            )}

            <main className="flex-1 overflow-y-auto px-8 pt-8 pb-12 w-full h-full relative">
              {currentView === 'dashboard' && <DashboardView onReview={handleReviewFile} onCreateBatch={handleCreateBatchFromDashboard} />}
              {currentView === 'files' && (
                <BatchProcessingView
                  onReview={handleReviewFile}
                  activeBatchId={activeBatchId}
                  categoryFilter={activeCategory}
                  onClearCategoryFilter={() => setActiveCategory(null)}
                />
              )}
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
                    setActiveCategory(null);
                    navigateTo('files');
                  }}
                />
              )}
              {currentView === 'settings' && <SettingsView authUser={authUser} section="general" />}
              {currentView === 'aiConfiguration' && <SettingsView authUser={authUser} section="aiConfiguration" />}
              {currentView === 'manageUsers' && <SettingsView authUser={authUser} section="manageUsers" />}
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
      </div>
    </div>
  );
}
