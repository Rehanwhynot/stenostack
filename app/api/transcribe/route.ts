// app/api/transcribe/route.ts - Transcription API

import { NextRequest, NextResponse } from 'next/server';
import { classifySegments } from '@/lib/classifier';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const pdfFile = formData.get('pdf') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('📁 Received audio file:', audioFile.name);
    console.log('📁 Received PDF file:', pdfFile ? pdfFile.name : 'None');

    // Mock transcript for hackathon demo
    const mockTranscript = [
      { text: "Hello and welcome to the lecture on Python programming.", start: 0, end: 3.5 },
      { text: "Today we'll learn about functions and how to define them.", start: 3.5, end: 7.2 },
      { text: "We use the def keyword to define a function in Python.", start: 7.2, end: 11.8 },
      { text: "For example: def calculate(x): return x * 2", start: 11.8, end: 16.5 },
      { text: "This function takes a number and returns its double.", start: 16.5, end: 20.0 },
      { text: "We can also use lambdas for simple functions like lambda x: x * 2", start: 20.0, end: 24.5 },
      { text: "In Java, we use public static void main instead.", start: 24.5, end: 28.0 },
      { text: "The circuit voltage is Vout = Vin * (R2 / (R1 + R2))", start: 28.0, end: 32.5 },
      { text: "And finally, the integral of x squared is $\\int x^2 dx = x^3/3$", start: 32.5, end: 37.0 },
    ];

    // Use the regex classifier
    const classifiedSegments = classifySegments(mockTranscript);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return NextResponse.json({
      success: true,
      segments: classifiedSegments,
      message: 'Transcription complete!',
      metadata: {
        audioFileName: audioFile.name,
        totalSegments: classifiedSegments.length,
        processingTime: '1.5s'
      }
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process audio', details: String(error) },
      { status: 500 }
    );
  }
}