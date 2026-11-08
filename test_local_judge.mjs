import { runReferenceCodeLocally } from './src/lib/judge.ts';

const source = `
import sys

def main():
    n = int(sys.stdin.readline())
    arr = list(map(int, sys.stdin.readline().split()))
    print(sum(arr))

if __name__ == "__main__":
    main()
`;

const inputs = ["3\n1 2 3\n", "5\n10 20 30 40 50\n"];

try {
  const outputs = await runReferenceCodeLocally("PYTHON", source, inputs, 1000);
  console.log("Outputs:", outputs);
} catch (err) {
  console.error("Error:", err.message);
}