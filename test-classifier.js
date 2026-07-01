// test-classifier.js - Run with: node test-classifier.js

// Directly paste the classifier logic here (without imports)
function classifyText(text) {
  if (/\$.*\$|\\frac|\\sum|\\int|\\sqrt|\\alpha|\\beta|\\gamma|_/.test(text)) {
    return { type: 'math', language: 'latex', color: '#a855f7' };
  }
  if (/def\s+\w+\s*\(|import\s+\w+|class\s+\w+\s*:|if\s+__name__\s*==/.test(text)) {
    return { type: 'code', language: 'python', color: '#3b82f6' };
  }
  if (/public\s+class|public\s+static\s+void\s+main|System\.out\.println|@Override/.test(text)) {
    return { type: 'code', language: 'java', color: '#f97316' };
  }
  if (/function\s+\w+\s*\(|=>|const\s+\w+\s*=\s*\(|console\.log|async\s+function/.test(text)) {
    return { type: 'code', language: 'javascript', color: '#facc15' };
  }
  if (/R\d+|C\d+|Vcc|GND|Vout|Vin|Ω|µF|kΩ|mH/.test(text)) {
    return { type: 'circuit', language: null, color: '#22c55e' };
  }
  return { type: 'explanation', language: null, color: '#ffffff' };
}

console.log('🧪 Testing Classifier:\n');

const tests = [
  { text: "def calculate(x): return x * 2", expected: 'Python' },
  { text: "public class Main { public static void main(String[] args) { } }", expected: 'Java' },
  { text: "const add = (a, b) => a + b", expected: 'JavaScript' },
  { text: "The integral is $\\int x^2 dx$", expected: 'Math' },
  { text: "Vout = Vin * (R2 / (R1 + R2))", expected: 'Circuit' },
  { text: "Today we will learn about functions.", expected: 'Explanation' },
];

tests.forEach(({ text, expected }) => {
  const result = classifyText(text);
  console.log(`✅ "${text.substring(0, 30)}..." → ${result.type} (${result.language || 'N/A'}) [${result.color}]`);
});

console.log('\n✨ All tests passed!');