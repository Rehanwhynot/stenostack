// app/lecture/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { classifyText } from '@/lib/classifier';
// This configuration is mandatory for react-pdf to process files
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
  const [recognition, setRecognition] = useState<any>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Debug logger
  const addDebug = (msg: string) => {
    console.log('🔍', msg);
    setDebugInfo(prev => [...prev, msg]);
  };

  // Initialize Speech Recognition
  useEffect(() => {
    addDebug('useEffect called');

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

      // Updated to target only the latest finalized speech index to avoid duplicates
      rec.onresult = (event: any) => {
        addDebug('onresult triggered');
        
        const currentResultIndex = event.resultIndex;
        const result = event.results[currentResultIndex];
        
        if (result.isFinal) {
          const finalText = result[0].transcript.trim();
          
          if (finalText) {
            addDebug(`Transcript text received: "${finalText}"`);
            
            // Use classifier to extract types and color mappings
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
        addDebug('🎤 Recording started!');
        setIsRecording(true);
      };

      rec.onend = () => {
        addDebug('⏹️ Recording ended');
        setIsRecording(false);
      };

      rec.onerror = (event: any) => {
        addDebug(`❌ Error: ${event.error}`);
        setError(`Error: ${event.error}`);
        setIsRecording(false);
      };

      setRecognition(rec);
      addDebug('✅ Speech Engine initialized');
    } catch (err) {
      addDebug(`❌ Exception: ${err}`);
      setError(`Failed to initialize: ${err}`);
    }
  }, []);

  const toggleRecording = async () => {
    if (!recognition) {
      setError('Speech recognition not available.');
      return;
    }

    if (isRecording) {
      try {
        recognition.stop();
      } catch (err) {
        addDebug(`❌ Error stopping: ${err}`);
      }
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognition.start();
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
                      className="p-3 rounded-lg border-l-4 bg-background shadow-sm"
                      style={{ borderLeftColor: entry.color || '#6b7280' }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span 
                          className="text-xs px-2 py-0.5 rounded-full font-mono uppercase bg-muted"
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

          {/* Resizable drag divider */}
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

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