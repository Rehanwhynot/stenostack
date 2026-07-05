// app/api/transcribe/route.ts - WORKING VERSION

import { NextRequest, NextResponse } from 'next/server';
import { classifySegments } from '@/lib/classifier';

export async function POST(request: NextRequest) {
  try {
    console.log('📢 API endpoint hit!');
    
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      console.log('❌ No audio file provided');
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('📁 Audio file received:', audioFile.name);
    console.log('📁 File size:', audioFile.size, 'bytes');

    // Mock transcript data (works without OpenAI API key)
    const mockTranscript = [
      { text: "Hello and welcome to the lecture on Python programming.", start: 0, end: 3.5 },
      { text: "Today we'll learn about functions and how to define them.", start: 3.5, end: 7.2 },
      { text: "We use the def keyword to define a function in Python.", start: 7.2, end: 11.8 },
      { text: "For example: def calculate(x): return x * 2", start: 11.8, end: 16.5 },
      { text: "This function takes a number and returns its double.", start: 16.5, end: 20.0 },
      { text: "We can also use lambdas: lambda x: x * 2", start: 20.0, end: 24.5 },
      { text: "In Java we use public static void main instead.", start: 24.5, end: 28.0 },
      { text: "The circuit voltage is Vout = Vin * (R2 / (R1 + R2))", start: 28.0, end: 32.5 },
      { text: "The integral of x squared is $\\int x^2 dx = x^3/3$", start: 32.5, end: 37.0 },
    ];

    // Classify using your regex classifier
    const classifiedSegments = classifySegments(mockTranscript);

    return NextResponse.json({
      success: true,
      segments: classifiedSegments,
      message: 'Transcription complete! (Mock data)',
      metadata: {
        audioFileName: audioFile.name,
        totalSegments: classifiedSegments.length,
      }
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process audio', 
        details: String(error),
        message: 'Check terminal for details'
      },
      { status: 500 }
    );
  }
}