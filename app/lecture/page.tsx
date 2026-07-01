// app/lecture/page.tsx

'use client';

import dynamic from 'next/dynamic';

// Disable Server-Side Rendering (SSR) for the lecture screen to prevent DOMMatrix errors
// Import using the all-lowercase filename to avoid case-only filename conflicts on Windows
const LectureClient = dynamic(() => import('./lectureclient'), {
  ssr: false,
});

export default function Page() {
  return <LectureClient />;
}