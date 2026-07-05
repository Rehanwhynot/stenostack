// app/lecture/lectureclient.tsx

'use client';

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { classifyText } from '@/lib/classifier';
import NotesPanel from '@/components/notes/NotesPanel';

// Configure the PDF worker to render PDF pages
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: number;
  type: string;
  color: string;
  slideNumber: number;
}

export default function LecturePage() {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // Slide Tracking States
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  
  // Refs for tracking mutable states inside asynchronous listeners
  const currentSlideRef = useRef<number>(1);
  const isScrollingRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Sync the slide ref whenever state changes
  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

  // Debug logger
  const addDebug = (msg: string) => {
    console.log('🔍', msg);
    setDebugInfo(prev => [...prev.slice(-49), msg]); // Cap log arrays at 50
  };

  // EFFECT 1: Safely load saved Transcript and PDF Base64 string on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // 1. Load Transcription Data
      const savedTranscript = localStorage.getItem('transcriptData');
      if (savedTranscript) {
        const parsed = JSON.parse(savedTranscript);
        const entries = Array.isArray(parsed)
          ? parsed.map((entry: any, index: number) => ({
              id: entry.id || `${Date.now()}-${index}`,
              text: entry.text || '',
              timestamp: entry.timestamp || entry.start || Date.now(),
              type: entry.type || 'explanation',
              color: entry.color || '#94a3b8',
              slideNumber: entry.slideNumber || 1,
            }))
          : [];

        if (entries.length > 0) {
          setTranscript(entries);
          addDebug('✅ Successfully initialized transcript from local storage');
        }
      }

      // 2. Load PDF Base64 Data and auto-initialize the Slides panel
      const savedPdfBase64 = localStorage.getItem('pdfData');
      const savedPdfName = localStorage.getItem('pdfFileName') || 'uploaded_slides.pdf';
      
      if (savedPdfBase64) {
        const pdfDataUri = `data:application/pdf;base64,${savedPdfBase64}`;
        setPdfFile(pdfDataUri as unknown as File);
        addDebug(`✅ Auto-loaded PDF slides: ${savedPdfName}`);
      }
    } catch (err) {
      console.error('Failed to load saved session data:', err);
    }
  }, []);

  // EFFECT 2: Initialize Speech Recognition engine
  useEffect(() => {
    addDebug('Initializing Speech Engine...');

    if (typeof window === 'undefined') {
      addDebug('window is undefined (SSR)');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addDebug('❌ SpeechRecognition NOT supported');
      setError('Speech recognition not supported. Please use Chrome.');
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      // Capture only the latest finalized spoken index to avoid list duplication
      rec.onresult = (event: any) => {
        const currentResultIndex = event.resultIndex;
        const result = event.results[currentResultIndex];
        
        if (result.isFinal) {
          const finalText = result[0].transcript.trim();
          
          if (finalText) {
            addDebug(`Transcript text received: "${finalText}"`);
            const classification = classifyText(finalText);
            
            const newEntry: TranscriptEntry = {
              id: Math.random().toString(36).substring(2, 11),
              text: finalText,
              timestamp: Date.now(),
              type: classification.type,
              color: classification.color,
              slideNumber: currentSlideRef.current, // Tag live transcripts with the current active slide
            };
            
            setTranscript(prev => [...prev, newEntry]);
          }
        }
      };

      rec.onstart = () => setIsRecording(true);
      rec.onend = () => setIsRecording(false);
      rec.onerror = (event: any) => {
        setError(`Error: ${event.error}`);
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      addDebug('✅ Speech Engine initialized');
    } catch (err) {
      setError(`Failed to initialize: ${err}`);
    }

    // Cleanup subscription on unmount to prevent browser microphone leaks
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // EFFECT 3: Global Keyboard listeners for navigation (Arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || !numPages) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleTranscriptClick(Math.max(1, currentSlide - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleTranscriptClick(Math.min(numPages, currentSlide + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, numPages]);

  // EFFECT 4: Intersection Observer to sync manual scrolling with the page indicators
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container || !numPages) return;

    const options = {
      root: container,
      rootMargin: '0px',
      threshold: 0.5, // Slide is considered active when 50% visible
    };

    const callback = (entries: IntersectionObserverEntry[]) => {
      // Bypasses sync checks if we are mid-smooth-scroll from a transcript click
      if (isScrollingRef.current) return;

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          const slideNum = parseInt(id.replace('slide-', ''), 10);
          if (!isNaN(slideNum)) {
            setCurrentSlide(slideNum);
          }
        }
      });
    };

    const observer = new IntersectionObserver(callback, options);

    // Watch each slide container
    for (let i = 1; i <= numPages; i++) {
      const el = document.getElementById(`slide-${i}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [numPages]);

  const toggleRecording = async () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not available.');
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        addDebug(`❌ Error stopping: ${err}`);
      }
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognitionRef.current.start();
        setError(null);
      } catch (err) {
        setError('Microphone access denied. Please allow microphone permissions.');
      }
    }
  };

  const clearTranscript = () => {
    setTranscript([]);
    setError(null);
    setDebugInfo([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('transcriptData');
      localStorage.removeItem('pdfData');
      localStorage.removeItem('pdfFileName');
      localStorage.removeItem('stenoStack_notes');
    }
  };



  const handlePdfUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPdfFile(file);
      addDebug(`📄 PDF Loaded: ${file.name}`);
    }
  };
  // Add this AFTER handlePdfUpload
const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  
  // Debug: Log the file
  console.log('🔍 File selected:', file ? file.name : 'No file');
  
  if (!file) {
    console.log('❌ No file selected');
    setError('Please select an audio file.');
    return;
  }
  
  console.log('✅ Audio file:', file.name, 'Size:', file.size, 'bytes');
  
  setIsUploading(true);
  setError(null);
  addDebug(`🎧 Uploading: ${file.name}`);
  
  try {
    const formData = new FormData();
    formData.append('audio', file);
    
    console.log('📤 Sending to /api/transcribe...');
    
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    });
    
    console.log('📥 Response status:', response.status);
    
    const data = await response.json();
    console.log('📦 Response data:', data);
    
    if (data.success) {
      console.log('✅ Transcription success!');
      addDebug(`✅ Transcribed: ${data.segments.length} segments`);
      
      const newEntries = data.segments.map((seg: any, index: number) => ({
        id: Math.random().toString(36).substring(2, 11) + index,
        text: seg.text || '',
        timestamp: Date.now() + index,
        type: seg.type || 'explanation',
        color: seg.color || '#94a3b8',
        slideNumber: seg.slideNumber || 1,
      }));
      
      setTranscript(prev => [...prev, ...newEntries]);
    } else {
      console.error('❌ API error:', data.error);
      setError(data.error || 'Transcription failed');
    }
  } catch (err) {
    console.error('❌ Upload error:', err);
    setError('Failed to process audio. Check console for details.');
  } finally {
    setIsUploading(false);
    console.log('🏁 Upload complete');
  }
};

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  // Smooth-scroll handle to focus right panel on target slide page
  const handleTranscriptClick = (slideNumber: number) => {
    isScrollingRef.current = true;
    setCurrentSlide(slideNumber);

    if (pdfContainerRef.current) {
      const slideElement = document.getElementById(`slide-${slideNumber}`);
      if (slideElement) {
        slideElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Reset scroll lock after smooth scroll animation completes
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">StenoStack</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/'}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Controls Bar */}
      <div className="border-b px-6 py-3 flex-shrink-0 flex flex-wrap items-center gap-3 bg-muted/10">
        <Button
          variant={isRecording ? "destructive" : "default"}
          onClick={toggleRecording}
        >
          {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
        </Button>
        <Button variant="outline" onClick={clearTranscript}>
          🗑️ Clear All
        </Button>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          📄 Upload PDF Slides
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('audioUpload')?.click()}
          disabled={isUploading}
        >
          {isUploading ? '⏳ Processing...' : '📁 Upload Audio'}
        </Button>

        <input
  id="audioUpload"
  type="file"
  accept=".mp3,.mp4,.wav,.m4a"
  className="hidden"
  onChange={handleAudioUpload}
/>
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf"
          onChange={handlePdfUpload}
          className="hidden"
        />
        {error && (
          <span className="text-red-600 text-sm ml-2">❌ {error}</span>
        )}
      </div>

      {/* Split-Pane Workspace (Now splits horizontally into 3 columns!) */}
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          
          {/* Column 1: Live Transcript Pane */}
          <Panel defaultSize={33} minSize={20}>
            <div className="h-full overflow-y-auto p-6 bg-card flex flex-col">
              <h2 className="text-lg font-semibold mb-4 font-sans">Live Transcript</h2>
              
              {transcript.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground my-auto">
                  {isRecording ? '🎤 Listening... Speak into your microphone.' : 'Click "Start Recording" to begin.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {transcript.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => handleTranscriptClick(entry.slideNumber)}
                      className={`p-3 rounded-lg border-l-4 shadow-sm transition-all cursor-pointer hover:bg-muted/40 hover:scale-[1.01] active:scale-[0.99] ${
                        currentSlide === entry.slideNumber ? 'bg-muted/30 shadow-md' : 'bg-background'
                      }`}
                      style={{ 
                        borderLeftColor: entry.color || '#6b7280',
                        backgroundColor: entry.color ? `${entry.color}0a` : undefined
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        
                        <div className="flex gap-1.5 items-center">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                            Slide {entry.slideNumber}
                          </span>
                          <span 
                            className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase bg-muted font-bold"
                            style={{ color: entry.color || '#6b7280' }}
                          >
                            {entry.type}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{entry.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          {/* First drag divider */}
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/50 transition-colors cursor-col-resize flex items-center justify-center relative">
            <div className="w-0.5 h-12 bg-muted-foreground/30 rounded-full" />
          </PanelResizeHandle>

          {/* Column 2: PDF Slides Panel (Middle Column) */}
          <Panel defaultSize={34} minSize={20}>
            <div 
              ref={pdfContainerRef} 
              className="h-full overflow-y-auto p-6 bg-background scroll-smooth"
            >
              <div className="flex items-center justify-between mb-4 border-b pb-2 flex-shrink-0">
                <h2 className="text-lg font-semibold font-sans">Slides Panel</h2>
                {numPages && (
                  <div className="flex gap-2 items-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleTranscriptClick(Math.max(1, currentSlide - 1))}
                      disabled={currentSlide === 1}
                    >
                      ←
                    </Button>
                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-muted rounded min-w-[50px] text-center">
                      {currentSlide} / {numPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleTranscriptClick(Math.min(numPages, currentSlide + 1))}
                      disabled={currentSlide === numPages}
                    >
                      →
                    </Button>
                  </div>
                )}
              </div>
              
              {pdfFile ? (
                <div className="space-y-4 flex flex-col items-center">
                  <Document
                    file={pdfFile}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={() => setError('Failed to render PDF file. Check encoding.')}
                    className="flex flex-col items-center w-full"
                  >
                    {Array.from(new Array(numPages), (_, index) => (
                      <div 
                        key={index} 
                        id={`slide-${index + 1}`}
                        className={`mb-6 border rounded shadow-md p-2 max-w-full transition-all duration-300 ${
                          currentSlide === index + 1 
                            ? 'ring-2 ring-primary border-primary bg-primary/5 scale-[1.01]' 
                            : 'bg-white border-border'
                        }`}
                      >
                        <Page
                          pageNumber={index + 1}
                          width={400}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                        />
                        <p className="text-xs text-center text-muted-foreground mt-2 font-mono">
                          Page {index + 1} of {numPages}
                        </p>
                      </div>
                    ))}
                  </Document>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground h-full flex flex-col justify-center items-center">
                  <p className="text-5xl mb-4">📄</p>
                  <p className="font-medium">No PDF uploaded</p>
                  <p className="text-sm mt-1">Upload slides to see them displayed here.</p>
                </div>
              )}
            </div>
          </Panel>

          {/* Second drag divider */}
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/50 transition-colors cursor-col-resize flex items-center justify-center relative">
            <div className="w-0.5 h-12 bg-muted-foreground/30 rounded-full" />
          </PanelResizeHandle>

          {/* Column 3: Slide-Locked Notes Panel (Right Column) */}
          <Panel defaultSize={33} minSize={20}>
            <div className="h-full overflow-y-auto p-6 bg-card border-l select-text">
              <NotesPanel slideNumber={currentSlide} />
            </div>
          </Panel>
          
        </PanelGroup>
      </div>

      {/* Debug Console Log drawer at the bottom */}
      <div className="bg-muted/50 border-t text-xs px-6 py-2 font-mono max-h-24 overflow-y-auto flex-shrink-0">
        <span className="font-bold text-muted-foreground mr-2">System Status:</span>
        {debugInfo.length === 0 ? 'Engine Idle' : debugInfo[debugInfo.length - 1]}
      </div>
    </div>
  );
}