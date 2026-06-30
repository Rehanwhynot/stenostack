 // lib/classifier.ts - Complete Regex Classifier (No tree-sitter needed!)

export type SegmentType = 'code' | 'math' | 'circuit' | 'explanation';
export type Language = 'python' | 'javascript' | 'java' | 'latex' | null;

export interface ClassifiedSegment {
  type: SegmentType;
  language: Language;
  color: string;
}

export function classifyText(text: string): ClassifiedSegment {
  // 1. Detect LaTeX Math (purple)
  if (/\$.*\$|\\frac|\\sum|\\int|\\sqrt|\\alpha|\\beta|\\gamma|_/.test(text)) {
    return { type: 'math', language: 'latex', color: '#a855f7' };
  }

  // 2. Detect Python (blue)
  if (/def\s+\w+\s*\(|import\s+\w+|class\s+\w+\s*:|if\s+__name__\s*==/.test(text)) {
    return { type: 'code', language: 'python', color: '#3b82f6' };
  }

  // 3. Detect Java (orange)
  if (/public\s+class|public\s+static\s+void\s+main|System\.out\.println|@Override/.test(text)) {
    return { type: 'code', language: 'java', color: '#f97316' };
  }

  // 4. Detect JavaScript (yellow)
  if (/function\s+\w+\s*\(|=>|const\s+\w+\s*=\s*\(|console\.log|async\s+function/.test(text)) {
    return { type: 'code', language: 'javascript', color: '#facc15' };
  }

  // 5. Detect Circuits (green)
  if (/R\d+|C\d+|Vcc|GND|Vout|Vin|Ω|µF|kΩ|mH/.test(text)) {
    return { type: 'circuit', language: null, color: '#22c55e' };
  }

  // 6. Default: Explanation (white)
  return { type: 'explanation', language: null, color: '#ffffff' };
}

// Process an array of transcript segments
export function classifySegments(segments: { text: string; start: number; end: number }[]): any[] {
  return segments.map((seg) => ({
    ...seg,
    ...classifyText(seg.text),
    matchedPage: 1, // Placeholder - will be replaced by the semantic matcher later
  }));
}
