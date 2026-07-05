// app/page.tsx - Dashboard Page

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lectureTitle, setLectureTitle] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Helper to ensure a new session is a clean slate by wiping previous cache
  const clearPreviousSession = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('transcriptData');
    localStorage.removeItem('pdfData');
    localStorage.removeItem('pdfFileName');
    localStorage.removeItem('stenoStack_notes');
  };

  const handleStartLecture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lectureTitle.trim() || isRedirecting) return;

    setIsRedirecting(true);
    clearPreviousSession();

    // Save the new lecture title
    localStorage.setItem('currentLectureTitle', lectureTitle.trim());
    setIsModalOpen(false);
    
    router.push('/lecture');
  };

  const goToLiveLecture = () => {
    if (isRedirecting) return;
    
    setIsRedirecting(true);
    clearPreviousSession();

    localStorage.setItem('currentLectureTitle', 'Live Lecture Session');
    router.push('/lecture');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6 select-none relative overflow-hidden">
      
      {/* Subtle Background Glow Decors */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Dashboard Card */}
      <div className="max-w-md w-full text-center space-y-6 bg-card border rounded-2xl p-8 shadow-md relative z-10">
        
        {/* Header Section */}
        <div className="space-y-2">
          <div className="text-5xl mb-2 animate-bounce duration-1000">🎓</div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">StenoStack</h1>
          <p className="text-muted-foreground text-md font-medium">
            AI-Powered Lecture Transcription
          </p>
          <div className="inline-block bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full mt-2">
            No upfront files required
          </div>
        </div>

        {/* Action Button Stack */}
        <div className="flex flex-col gap-3 w-full pt-4">
          
          {/* Option 1: Standard Guided Start */}
          <Button 
            className="px-8 py-6 text-base font-semibold shadow hover:shadow-md transition-all w-full flex items-center justify-center gap-2"
            onClick={() => setIsModalOpen(true)}
            disabled={isRedirecting}
          >
            <span>📝</span> Start New Lecture
          </Button>

          {/* Option 2: Quick Start Bypass */}
          <Button 
            className="px-8 py-6 text-base font-semibold transition-all w-full flex items-center justify-center gap-2"
            variant="outline"
            onClick={goToLiveLecture}
            disabled={isRedirecting}
          >
            <span>🎙️</span> Quick Start (Live Recording)
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          💡 You can upload slides and take notes later inside the workspace.
        </p>
      </div>

      {/* High-Value Feature Grid (communicates key capabilities immediately) */}
      <div className="max-w-3xl w-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 relative z-10">
        <div className="border bg-card/50 p-4 rounded-xl text-center space-y-1">
          <span className="text-xl">🎙️</span>
          <h4 className="text-sm font-semibold text-foreground">Live Dictation</h4>
          <p className="text-xs text-muted-foreground">Zero-latency speech capture directly from your browser mic.</p>
        </div>
        <div className="border bg-card/50 p-4 rounded-xl text-center space-y-1">
          <span className="text-xl">🎨</span>
          <h4 className="text-sm font-semibold text-foreground">Semantic Color Tags</h4>
          <p className="text-xs text-muted-foreground">Speech is classified into color-coded Code, Math, and Diagrams.</p>
        </div>
        <div className="border bg-card/50 p-4 rounded-xl text-center space-y-1">
          <span className="text-xl">📝</span>
          <h4 className="text-sm font-semibold text-foreground">Interactive Notes</h4>
          <p className="text-xs text-muted-foreground">Take persistent study notes linked directly to your active slides.</p>
        </div>
      </div>

      {/* Modal: Enter Lecture Title */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-background border rounded-xl shadow-lg max-w-sm w-full p-6 relative">
            <h3 className="text-xl font-bold mb-1 text-foreground">Start New Lecture</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter a session title to initialize your workspace.
            </p>

            <form onSubmit={handleStartLecture} className="space-y-4">
              <input
                type="text"
                required
                placeholder="e.g., Physics 101 - Lecture 1"
                className="w-full border rounded-md p-2.5 bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all duration-200"
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                autoFocus
                disabled={isRedirecting}
              />

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isRedirecting}
                  onClick={() => {
                    setIsModalOpen(false);
                    setLectureTitle('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isRedirecting}>
                  {isRedirecting ? 'Starting...' : 'Start Lecture'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}