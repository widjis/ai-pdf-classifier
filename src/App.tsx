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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Pre-load the document review doc to simplify debugging if navigating directly

  const navigateTo = (view: ViewState) => {
    setIsSidebarOpen(false);
    const isAdmin = authUser?.role === 'admin';
    if (!isAdmin && (view === 'settings' || view === 'aiConfiguration' || view === 'manageUsers')) {
      setCurrentView('files');
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

  const isAdmin = authUser.role === 'admin';
  const isSettingsView = currentView === 'settings' || currentView === 'aiConfiguration' || currentView === 'manageUsers';

  return (
    <div className="min-h-screen w-full relative isolate overflow-hidden bg-slate-950 px-0 sm:px-4 py-0 sm:py-6 font-sans text-slate-900">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.25)_1px,transparent_0)] [background-size:28px_28px] opacity-60" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,83,219,0.22),transparent_38%,rgba(16,185,129,0.18))]" />
        <div className="absolute -top-36 -left-40 w-[520px] h-[520px] bg-brand-600/25 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-44 w-[560px] h-[560px] bg-emerald-500/20 rounded-full blur-[130px]" />
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/60" onClick={() => setIsSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0">
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
              className="max-w-[85vw]"
              showCloseButton
              onClose={() => setIsSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="relative mx-auto min-h-[100svh] sm:min-h-0 sm:h-[calc(100vh-48px)] w-full max-w-[1480px] rounded-none sm:rounded-3xl overflow-hidden border border-white/10 bg-white/5 shadow-[0_30px_120px_-45px_rgba(0,0,0,0.85)] backdrop-blur-xl">
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
            className="hidden lg:flex"
          />

          <div className="flex-1 flex flex-col min-w-0 bg-[#f7f9fb] h-full">
            {currentView !== 'review' && (
              <Header
                currentView={currentView}
                onNavigate={navigateTo}
                onToggleSidebar={() => setIsSidebarOpen(true)}
                authUser={authUser}
                onSignOut={() => {
                  authToken.clear();
                  setAuthUser(null);
                  setCurrentView('files');
                  setSelectedFile(null);
                  setPendingNewBatchFiles([]);
                  setActiveBatchId(null);
                  setActiveCategory(null);
                  setIsSidebarOpen(false);
                }}
              />
            )}

            <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-10 sm:pb-12 w-full h-full relative">
              {currentView === 'dashboard' && <DashboardView onReview={handleReviewFile} onCreateBatch={handleCreateBatchFromDashboard} />}
              {currentView === 'files' && (
                <BatchProcessingView
                  authUser={authUser}
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
              {isSettingsView && !isAdmin ? (
                <div className="max-w-[1040px] w-full">
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Settings</h2>
                    <p className="text-[15px] text-slate-600">This section is restricted to admins.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">Access denied</div>
                    <div className="mt-1 text-sm text-slate-600">Ask an administrator to grant you admin role.</div>
                  </div>
                </div>
              ) : null}
              {currentView === 'settings' && isAdmin && <SettingsView authUser={authUser} section="general" />}
              {currentView === 'aiConfiguration' && isAdmin && <SettingsView authUser={authUser} section="aiConfiguration" />}
              {currentView === 'manageUsers' && isAdmin && <SettingsView authUser={authUser} section="manageUsers" />}
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
