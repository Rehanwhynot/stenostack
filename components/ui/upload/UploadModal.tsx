// components/upload/UploadModal.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const router = useRouter();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpload = async () => {
    if (!audioFile || !pdfFile) {
      setError('Please select both an audio file and a PDF slide file.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Package files into FormData
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('pdf', pdfFile);

      // Send files to your API route
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Transcription successful:', data);
        
        // Save the received segments to local storage so the lecture page can read them
        localStorage.setItem('transcriptData', JSON.stringify(data.segments));
        
        // Close modal and navigate to the live lecture page
        onClose();
        router.push('/lecture');
      } else {
        setError(data.error || 'Transcription failed');
      }
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError('Failed to upload files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border rounded-xl shadow-lg max-w-md w-full p-6 relative">
        <h3 className="text-xl font-bold mb-2">Create New Lecture</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Upload your lecture audio recording and corresponding PDF slides to start.
        </p>

        <div className="space-y-4 mb-6">
          {/* Audio Input */}
          <div>
            <label className="text-sm font-medium block mb-2">
              🎙️ Lecture Audio File (.mp3, .wav, .m4a)
            </label>
            <input
              type="file"
              accept="audio/*"
              className="w-full text-sm border rounded-md p-2 bg-background cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
            />
            {audioFile && (
              <p className="text-xs text-green-600 mt-1">✓ Selected: {audioFile.name}</p>
            )}
          </div>

          {/* PDF Input */}
          <div>
            <label className="text-sm font-medium block mb-2">
              📄 PDF Slide File (.pdf)
            </label>
            <input
              type="file"
              accept=".pdf"
              className="w-full text-sm border rounded-md p-2 bg-background cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            />
            {pdfFile && (
              <p className="text-xs text-green-600 mt-1">✓ Selected: {pdfFile.name}</p>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 text-red-800 p-3 rounded-lg mb-4 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            variant="outline"
            disabled={isUploading}
            onClick={() => {
              setAudioFile(null);
              setPdfFile(null);
              setError(null);
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!audioFile || !pdfFile || isUploading}
          >
            {isUploading ? 'Processing...' : 'Upload & Transcribe'}
          </Button>
        </div>
      </div>
    </div>
  );
}