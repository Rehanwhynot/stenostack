// components/notes/NotesPanel.tsx

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface Note {
  id: string;
  text: string;
  slideNumber: number;
  timestamp: number; // Stored as Unix timestamp for bulletproof JSON serialization
}

interface NotesPanelProps {
  slideNumber: number;
}

export default function NotesPanel({ slideNumber }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');

  // 1. Hydrate notes from LocalStorage on mount
  useEffect(() => {
    try {
      const savedNotes = localStorage.getItem('stenoStack_notes');
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes));
      }
    } catch (err) {
      console.error('Failed to load notes from localStorage:', err);
    }
  }, []);

  // 2. Automatically sync notes to LocalStorage whenever state updates
  const saveNotesToDisk = (updatedNotes: Note[]) => {
    try {
      localStorage.setItem('stenoStack_notes', JSON.stringify(updatedNotes));
    } catch (err) {
      console.error('Failed to save notes to localStorage:', err);
    }
  };

  const addNote = () => {
    if (!newNote.trim()) return;

    const updatedNotes = [
      ...notes,
      {
        id: Math.random().toString(36).substring(2, 11),
        text: newNote.trim(),
        slideNumber,
        timestamp: Date.now(),
      },
    ];

    setNotes(updatedNotes);
    saveNotesToDisk(updatedNotes);
    setNewNote('');
  };

  const deleteNote = (noteId: string) => {
    const updatedNotes = notes.filter((note) => note.id !== noteId);
    setNotes(updatedNotes);
    saveNotesToDisk(updatedNotes);
  };

  // Filter notes that correspond to the currently active slide
  const activeSlideNotes = notes.filter((note) => note.slideNumber === slideNumber);

  return (
    <div className="mt-4 border-t pt-4 flex flex-col min-h-0 select-text">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">
          📝 Notes for Slide {slideNumber}
        </h3>
        <span className="text-xs text-muted-foreground font-mono">
          {activeSlideNotes.length} {activeSlideNotes.length === 1 ? 'note' : 'notes'}
        </span>
      </div>
      
      {/* Input Row */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Type a key takeaway or study note..."
          className="flex-1 border rounded-md p-2 text-sm bg-background text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring transition-all"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
        />
        <Button size="sm" onClick={addNote} disabled={!newNote.trim()}>
          Add
        </Button>
      </div>
      
      {/* List Container */}
      <div className="space-y-1.5 overflow-y-auto max-h-48 pr-1">
        {activeSlideNotes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-4">
            No notes taken on this slide yet.
          </p>
        ) : (
          activeSlideNotes.map((note) => (
            <div 
              key={note.id} 
              className="text-sm bg-muted/60 hover:bg-muted border border-transparent hover:border-muted-foreground/10 p-2.5 rounded-lg flex items-start justify-between group transition-all"
            >
              <div className="flex-1 min-w-0">
                <p className="text-foreground break-words">{note.text}</p>
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => deleteNote(note.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 h-auto p-1"
              >
                ✕
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}