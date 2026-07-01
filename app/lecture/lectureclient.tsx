// app/lecture/lectureclient.tsx (or app/lecture/page.tsx)

'use client';

import { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { classifyText } from '@/lib/classifier';

// Configure the PDF worker to render PDF pages
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TranscriptEntry {
  id: string;
  text: string;
  timestamp: number;
  type: string;
  color: string;
}

export default function LecturePage() {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  // Using a ref for the speech recognition instance to manage its lifecycle safely across renders
  const recognitionRef = useRef<any>(null);

  // Debug logger
  const addDebug = (msg: string) => {
    console.log('🔍', msg);
    setDebugInfo(prev => [...prev, msg]);
  };

  // Safe localStorage transcription loader on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedTranscript = localStorage.getItem('transcriptData');
      if (!savedTranscript) return;

      const parsed = JSON.parse(savedTranscript);
      const entries = Array.isArray(parsed)
        ? parsed.map((entry: any, index: number) => ({
            id: entry.id || `${Date.now()}-${index}`,
            text: entry.text || '',
            timestamp: entry.timestamp || entry.start || Date.now(),
            type: entry.type || 'explanation',
            color: entry.color || '#94a3b8',
          }))
        : [];

      if (entries.length > 0) {
        setTranscript(entries);
        addDebug('✅ Successfully initialized transcript from upload payload');
      }
    } catch (err) {
      console.error('Failed to load saved transcript:', err);
    }
  }, []);

  // Initialize Speech Recognition
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
            addDebug(`New incoming segment: "${finalText}"`);
            const classification = classifyText(finalText);
            
            const newEntry: TranscriptEntry = {
              id: Math.random().toString(36).substring(2, 11),
              text: finalText,
              timestamp: Date.now(),
              type: classification.type,
              color: classification.color,
            };
            
            setTranscript(prev => [...prev, newEntry]);
          }
        }
      };

      rec.onstart = () => {
        addDebug('🎤 Recording active');
        setIsRecording(true);
      };

      rec.onend = () => {
        addDebug('⏹️ Recording stopped');
        setIsRecording(false);
      };

      rec.onerror = (event: any) => {
        addDebug(`❌ Error Event: ${event.error}`);
        setError(`Error: ${event.error}`);
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      addDebug('✅ Speech Engine successfully set up');
    } catch (err) {
      addDebug(`❌ Engine setup failed: ${err}`);
      setError(`Failed to initialize: ${err}`);
    }

    // Cleanup subscription on unmount to prevent browser microphone leaks
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleRecording = async () => {
    if (!recognitionRef.current) {
      setError('Speech recognition engine is not initialized.');
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
    }
  };

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setPdfFile(file);
      addDebug(`📄 PDF Loaded: ${file.name}`);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
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

      {/* Split-Pane Workspace */}
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          
          {/* Left Column: Transcript Pane */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full overflow-y-auto p-6 bg-card flex flex-col">
              <h2 className="text-lg font-semibold mb-4">Live Transcript</h2>
              
              {transcript.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground my-auto">
                  {isRecording ? '🎤 Listening... Speak into your microphone.' : 'Click "Start Recording" to begin.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {transcript.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-lg border-l-4 shadow-sm transition-all"
                      // Subtle card tinting based on categorization colors
                      style={{ 
                        borderLeftColor: entry.color || '#6b7280',
                        backgroundColor: entry.color ? `${entry.color}0a` : 'var(--background)'
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span 
                          className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase bg-muted font-bold"
                          style={{ color: entry.color || '#6b7280' }}
                        >
                          {entry.type}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{entry.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          {/* Resizable drag divider containing a centered grip visual element */}
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/50 transition-colors cursor-col-resize flex items-center justify-center relative">
            <div className="w-0.5 h-12 bg-muted-foreground/30 rounded-full" />
          </PanelResizeHandle>

          {/* Right Column: PDF Viewer Pane */}
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full overflow-y-auto p-6 bg-background">
              <h2 className="text-lg font-semibold mb-4 font-sans">Slides Panel</h2>
              
              {pdfFile ? (
                <div className="space-y-4 flex flex-col items-center">
                  <Document
                    file={pdfFile}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="flex flex-col items-center"
                  >
                    {Array.from(new Array(numPages), (_, index) => (
                      <div key={index} className="mb-6 border rounded shadow-md bg-white p-2 max-w-full">
                        <Page
                          pageNumber={index + 1}
                          width={400}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                        />
                        <p className="text-xs text-center text-muted-foreground mt-2">
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
                  <p className="text-sm mt-1">Upload slides to see them displayed here alongside the transcript</p>
                </div>
              )}
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