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

// Fallback keyword map (used if a PDF does not contain extractable text, e.g., image-only PDFs)
const FALLBACK_SLIDE_KEYWORDS = [
  {
    slideNumber: 1,
    keywords: ["digital", "systems", "lab", "logisim", "circuits", "welcome", "introduction", "lab 6"]
  },
  {
    slideNumber: 2,
    keywords: ["led", "pushbutton", "push button", "control", "experiment", "button", "off", "on", "released"]
  },
  {
    slideNumber: 3,
    keywords: ["code", "void setup", "void loop", "pinmode", "digitalwrite", "arduino", "sketch", "int "]
  },
  {
    slideNumber: 4,
    keywords: ["breadboard", "diagram", "wire", "connection", "gnd", "resistor", "pin", "wiring"]
  }
];

export default function LecturePage() {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Slide Tracking States
  const [currentSlide, setCurrentSlide] = useState<number>(1);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TranscriptEntry[]>([]);

  // Dynamic slide indexes extracted from the uploaded PDF
  const [dynamicSlideKeywords, setDynamicSlideKeywords] = useState<{ slideNumber: number; keywords: string[] }[]>([]);

  // Refs for tracking mutable states inside asynchronous listeners
  const currentSlideRef = useRef<number>(1);
  const isScrollingRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Sync the slide ref whenever state changes
  useEffect(() => {
    currentSlideRef.current = currentSlide;
  }, [currentSlide]);

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
        }
      }

      // 2. Load PDF Base64 Data and auto-initialize the Slides panel
      const savedPdfBase64 = localStorage.getItem('pdfData');
      const savedPdfName = localStorage.getItem('pdfFileName') || 'uploaded_slides.pdf';
      
      if (savedPdfBase64) {
        const pdfDataUri = `data:application/pdf;base64,${savedPdfBase64}`;
        setPdfFile(pdfDataUri as unknown as File);
      }
    } catch (err) {
      console.error('Failed to load saved session data:', err);
    }
  }, []);

  // EFFECT 2: Initialize Speech Recognition engine
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
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
            // 🤖 AUTO-SYNC: Calculate which slide matches this speech semantically
            const matchedSlide = matchTranscriptToSlide(finalText, currentSlideRef.current);
            
            // Automatically scroll PDF view if we matched to a different slide!
            if (matchedSlide !== currentSlideRef.current) {
              handleTranscriptClick(matchedSlide);
            }

            const classification = classifyText(finalText);
            
            const newEntry: TranscriptEntry = {
              id: Math.random().toString(36).substring(2, 11),
              text: finalText,
              timestamp: Date.now(),
              type: classification.type,
              color: classification.color,
              slideNumber: matchedSlide, // Tagged with the semantically matched slide
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
    } catch (err) {
      setError(`Failed to initialize: ${err}`);
    }

    // Cleanup subscription on unmount to prevent browser microphone leaks
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [dynamicSlideKeywords]); // Rebind listener if keywords update

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
      rootMargin: '-10% 0px -40% 0px', // Focus search area in the upper-middle section of the container
      threshold: 0.1, // Triggers immediately as soon as 10% of the slide enters the zone
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

  // Keyword search filter utility (searches through transcript entries)
  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results = transcript.filter(entry =>
      entry.text.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(results);
  };

  // AI SEMANTIC MATCHING ALGORITHM
  // Scans input text and returns the most relevant slide number based on density
  const matchTranscriptToSlide = (text: string, fallbackSlide: number): number => {
    const lowerText = text.toLowerCase();
    let bestSlide = fallbackSlide;
    let maxMatches = 0;

    // Use dynamically parsed PDF keywords if available; otherwise, use fallback dictionary
    const activeKeywordsMap = dynamicSlideKeywords.length > 0 ? dynamicSlideKeywords : FALLBACK_SLIDE_KEYWORDS;

    activeKeywordsMap.forEach((slide) => {
      let matches = 0;
      slide.keywords.forEach((keyword) => {
        if (lowerText.includes(keyword)) {
          matches++;
        }
      });

      if (matches > maxMatches) {
        maxMatches = matches;
        bestSlide = slide.slideNumber;
      }
    });

    return maxMatches > 0 ? bestSlide : fallbackSlide;
  };

  const toggleRecording = async () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not available.');
      return;
    }

    if (isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Error stopping:', err);
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
    }
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setError('Please select an audio file.');
      return;
    }
    
    setIsUploading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('audio', file);
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        const newEntries = data.segments.map((seg: any, index: number) => {
          // 🤖 Auto-match each segment from the uploaded file to the most relevant slide
          const matchedSlide = matchTranscriptToSlide(seg.text || '', 1);

          return {
            id: Math.random().toString(36).substring(2, 11) + index,
            text: seg.text || '',
            timestamp: Date.now() + index,
            type: seg.type || 'explanation',
            color: seg.color || '#94a3b8',
            slideNumber: matchedSlide, // Tagged with the dynamically matched slide
          };
        });
        
        setTranscript(prev => [...prev, ...newEntries]);
      } else {
        setError(data.error || 'Transcription failed');
      }
    } catch (err) {
      setError('Failed to process audio.');
    } finally {
      setIsUploading(false);
    }
  };

  const onDocumentLoadSuccess = async (pdf: any) => {
    setNumPages(pdf.numPages);
    const extractedKeywordsMap: { slideNumber: number; keywords: string[] }[] = [];
    
    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .toLowerCase();
        
        const words: string[] = pageText
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .split(/\s+/)
          .filter((word: string) => 
            word.length > 3 && 
            !['with', 'this', 'that', 'from', 'your', 'have', 'were', 'then', 'should', 'about', 'here'].includes(word)
          );
        
        const uniqueKeywords: string[] = Array.from(new Set<string>(words));
        
        extractedKeywordsMap.push({
          slideNumber: i,
          keywords: uniqueKeywords
        });
      }
      setDynamicSlideKeywords(extractedKeywordsMap);
    } catch (err) {
      console.error('Dynamic text extraction failed:', err);
    }
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

    setTimeout(() => {
      isScrollingRef.current = false;
    }, 800);
  };

  // Compile and export notes & transcript to a clean markdown document
  const handleExportNotes = () => {
    try {
      const savedNotesRaw = localStorage.getItem('stenoStack_notes');
      const savedNotes = savedNotesRaw ? JSON.parse(savedNotesRaw) : [];

      let content = `# StenoStack Lecture Notes Summary\n`;
      content += `Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n`;
      content += `==================================================\n\n`;

      content += `## 🎙️ Lecture Transcript Timeline\n\n`;
      if (transcript.length === 0) {
        content += `*No transcript was recorded during this session.*\n`;
      } else {
        transcript.forEach((entry) => {
          const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          content += `**[${time}] [Slide ${entry.slideNumber}] [${entry.type.toUpperCase()}]:**  \n${entry.text}\n\n`;
        });
      }

      content += `\n==================================================\n`;
      content += `## 📝 Study Notes by Slide\n\n`;

      if (savedNotes.length === 0) {
        content += `*No manual notes were saved during this session.*\n`;
      } else {
        const sortedNotes = [...savedNotes].sort((a, b) => a.slideNumber - b.slideNumber);
        sortedNotes.forEach((note: any) => {
          const time = new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          content += `**[Slide ${note.slideNumber}]** (${time}):  \n- ${note.text}\n\n`;
        });
      }

      // Generate text file download in the browser
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'StenoStack-Lecture-Summary.md');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError('Failed to export lecture files.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col h-screen overflow-hidden">
      
      {/* Sleek Custom Scrollbars Injection */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.15);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.35);
        }
      `}</style>

      {/* Header */}
      <header className="border-b px-6 py-4 flex-shrink-0 bg-background">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">StenoStack</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportNotes}>
              Export Notes
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/'}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Controls Bar (Hierarchical Action Grouping) */}
      <div className="border-b px-6 py-3 flex-shrink-0 flex items-center justify-between bg-muted/10">
        
        {/* Left Side: Critical Primary Recording Action */}
        <Button
          variant={isRecording ? "destructive" : "default"}
          onClick={toggleRecording}
          className="px-6 font-semibold shadow-sm"
        >
          {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
        </Button>

        {/* Right Side: Grouped Utility Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
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
          <div className="w-[1px] h-6 bg-border mx-1" /> {/* Divider */}
          <Button variant="ghost" size="sm" onClick={clearTranscript} className="text-muted-foreground hover:text-destructive">
            🗑️ Clear All
          </Button>
        </div>

        {/* Hidden File Inputs */}
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

      {/* Split-Pane Workspace (Asymmetric Proportions: 20% | 55% | 25%) */}
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          
          {/* Column 1: Live Transcript Pane (Narrower 20% split) */}
          <Panel defaultSize={20} minSize={15}>
            <div className="h-full overflow-y-auto p-6 bg-card flex flex-col custom-scrollbar relative">
              <h2 className="text-lg font-semibold mb-2 font-sans">Live Transcript</h2>
              
              {/* 🔍 COMPACT INTEGRATED SEARCH INTERFACE (Hybrid UX Approach) */}
              <div className="relative mb-4 z-20">
                <input
                  type="text"
                  placeholder="🔍 Search keywords..."
                  className="w-full border rounded-md px-3 py-1.5 text-xs bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch(e.target.value);
                  }}
                />
                
                {/* Floating Contextual Results Sub-menu */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto z-50 custom-scrollbar select-none">
                    <div className="p-1 bg-muted/30 border-b border-border flex items-center justify-between text-[8px] font-bold text-muted-foreground">
                      <span>{searchResults.length} Matches Found</span>
                      <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="hover:text-destructive">Dismiss</button>
                    </div>
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="p-2.5 hover:bg-muted/70 cursor-pointer border-b border-border last:border-0 flex flex-col gap-1 transition-all"
                        onClick={() => {
                          handleTranscriptClick(result.slideNumber);
                          setSearchResults([]);
                          setSearchQuery('');
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                            Slide {result.slideNumber}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {result.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {transcript.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground my-auto">
                  {isRecording ? '🎤 Listening...' : 'Click "Start Recording" to begin.'}
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
                      <div className="flex flex-col gap-1.5 mb-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                            Slide {entry.slideNumber}
                          </span>
                        </div>
                        <span 
                          className="text-[9px] w-fit px-2 py-0.5 rounded-full font-mono uppercase bg-muted font-bold"
                          style={{ color: entry.color || '#6b7280' }}
                        >
                          {entry.type}
                        </span>
                      </div>
                      
                      {/* High-Performance, live search highlighting mapping */}
                      <p className="text-xs text-foreground leading-relaxed mt-1">
                        {searchQuery ? (
                          entry.text.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                            part.toLowerCase() === searchQuery.toLowerCase() ? (
                              <mark key={i} className="bg-yellow-200 text-black dark:bg-yellow-500/40 rounded px-0.5">
                                {part}
                              </mark>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )
                        ) : (
                          entry.text
                        )}
                      </p>
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

          {/* Column 2: PDF Slides Panel (Middle Column - Spaced 55% split) */}
          <Panel defaultSize={55} minSize={40}>
            <div className="h-full flex flex-col bg-background">
              
              {/* FIXED IMMOVABLE SLIDE HEADER */}
              <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0 bg-background z-10">
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
              
              {/* SCROLLABLE SLIDES PANEL */}
              <div 
                ref={pdfContainerRef} 
                className="flex-1 overflow-y-auto p-6 scroll-smooth custom-scrollbar"
              >
                {pdfFile ? (
                  <div className="space-y-4 flex flex-col items-center">
                    <Document
                      file={pdfFile}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={() => setError('Failed to render PDF file.')}
                      className="flex flex-col items-center w-full"
                    >
                      {Array.from(new Array(numPages), (_, index) => (
                        <div 
                          key={index} 
                          id={`slide-${index + 1}`}
                          onClick={() => handleTranscriptClick(index + 1)}
                          className={`mb-6 border rounded shadow-md p-2 max-w-full transition-all duration-300 cursor-pointer ${
                            currentSlide === index + 1 
                              ? 'ring-2 ring-primary border-primary bg-primary/5 scale-[1.01]' 
                              : 'bg-white border-border hover:border-primary/50'
                          }`}
                        >
                          <Page
                            pageNumber={index + 1}
                            width={500} // Expanded slide rendering size for readability
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
            </div>
          </Panel>

          {/* Second drag divider */}
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/50 transition-colors cursor-col-resize flex items-center justify-center relative">
            <div className="w-0.5 h-12 bg-muted-foreground/30 rounded-full" />
          </PanelResizeHandle>

          {/* Column 3: Slide-Locked Notes Panel (Right Column - 25% split) */}
          <Panel defaultSize={25} minSize={20}>
            <div className="h-full overflow-y-auto p-6 bg-card border-l select-text custom-scrollbar">
              <NotesPanel slideNumber={currentSlide} />
            </div>
          </Panel>
          
        </PanelGroup>
      </div>
    </div>
  );
}