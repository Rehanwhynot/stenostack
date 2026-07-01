// lib/classifier.ts

export type SegmentType = 'code' | 'math' | 'circuit' | 'explanation';
export type Language = 'python' | 'javascript' | 'java' | 'latex' | null;

export interface ClassifiedSegment {
  type: SegmentType;
  language: Language;
  color: string;
}

export function classifyText(text: string): ClassifiedSegment {
  const lower = text.toLowerCase();

  // 1. Spoken LaTeX Math (purple)
  if (
    lower.includes('math') ||
    lower.includes('equation') ||
    lower.includes('fraction') || 
    lower.includes('integral') || 
    lower.includes('square root') || 
    lower.includes('sum of') ||
    lower.includes('alpha') || 
    lower.includes('beta') ||
    lower.includes('gamma') ||
    lower.includes('divided by')
  ) {
    return { type: 'math', language: 'latex', color: '#a855f7' };
  }

  // 2. Spoken Python (blue)
  if (
    lower.includes('python') || 
    lower.includes('def ') || 
    lower.includes('define function') || 
    lower.includes('import ') ||
    lower.includes('numpy') ||
    lower.includes('pandas')
  ) {
    return { type: 'code', language: 'python', color: '#3b82f6' };
  }

  // 3. Spoken Java (orange)
  if (
    lower.includes('java') || 
    lower.includes('public class') || 
    lower.includes('public static') || 
    lower.includes('system out') || 
    lower.includes('override')
  ) {
    return { type: 'code', language: 'java', color: '#f97316' };
  }

  // 4. Spoken JavaScript (yellow)
  if (
    lower.includes('javascript') || 
    lower.includes('const ') || 
    lower.includes('let ') || 
    lower.includes('arrow function') || 
    lower.includes('console log') || 
    lower.includes('async function')
  ) {
    return { type: 'code', language: 'javascript', color: '#eab308' };
  }

  // 5. Spoken Circuits (green)
  if (
    lower.includes('circuit') || 
    lower.includes('resistor') || 
    lower.includes('capacitor') || 
    lower.includes('ground') || 
    lower.includes('voltage') || 
    lower.includes('vcc') || 
    lower.includes('gnd') || 
    lower.includes('ohms') || 
    lower.includes('microfarad')
  ) {
    return { type: 'circuit', language: null, color: '#22c55e' };
  }

  // 6. Default: Explanation (slate gray to ensure it is visible)
  return { type: 'explanation', language: null, color: '#94a3b8' };
}

// Process an array of transcript segments
export function classifySegments(segments: { text: string; start: number; end: number }[]): any[] {
  return segments.map((seg) => ({
    ...seg,
    ...classifyText(seg.text),
    matchedPage: 1,
  }));
}