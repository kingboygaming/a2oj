import { runReferenceCodeLocally } from './src/lib/judge.ts';

// Test with syntax error
const source = `
import sys

def main():
    n = int(sys.stdin.readline())
    arr = list(map(int, sys.stdin.readline().split()))
    print(sum(arr)  # Missing closing parenthesis

if __name__ == "__main__":
    main()
`;

const inputs = ["3\n1 2 3\n"];

try {
  const outputs = await runReferenceCodeLocally("PYTHON", source, inputs, 1000);
  console.log("Outputs:", outputs);
} catch (err) {
  console.log("Expected error caught:", err.message);
}