'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lectureTitle, setLectureTitle] = useState('');

  const handleStartLecture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lectureTitle.trim()) return;

    localStorage.setItem('currentLectureTitle', lectureTitle);
    setIsModalOpen(false);
    
    // This navigates automatically to the lecture page
    router.push('/lecture');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-6">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-4xl font-extrabold tracking-tight">StenoStack Dashboard</h1>
        <p className="text-muted-foreground">
          Create a new lecture session to start recording and transcribing your audio.
        </p>

        {/* This is the "+ New Lecture" button */}
        <Button 
          className="px-8 py-6 text-lg shadow-md hover:shadow-lg transition-all"
          onClick={() => setIsModalOpen(true)}
        >
          + New Lecture
        </Button>
      </div>

      {/* Modal Popup */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border rounded-xl shadow-lg max-w-sm w-full p-6">
            <h3 className="text-xl font-bold mb-2 text-foreground">New Lecture</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter a title to begin your live session.
            </p>

            <form onSubmit={handleStartLecture} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Lecture Title"
                className="w-full border rounded-md p-2 bg-background text-foreground text-sm"
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                autoFocus
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    setLectureTitle('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Start Recording
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}