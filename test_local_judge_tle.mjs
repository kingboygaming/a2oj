import { runReferenceCodeLocally } from './src/lib/judge.ts';

// Test with TLE (infinite loop)
const source = `
import sys
import time

def main():
    while True:
        pass

if __name__ == "__main__":
    main()
`;

const inputs = ["1\n"];

try {
  const outputs = await runReferenceCodeLocally("PYTHON", source, inputs, 100); // 100ms limit
  console.log("Outputs:", outputs);
} catch (err) {
  console.log("Expected error caught:", err.message);
}