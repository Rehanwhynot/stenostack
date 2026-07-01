// app/page.tsx - Dashboard Page

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import UploadModal from '../components/ui/upload/UploadModal';

export default function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

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

      {/* Renders the new file upload modal instead of the old simple text popup */}
      <UploadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}