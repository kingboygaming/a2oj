import { runReferenceCodeLocally } from './src/lib/judge.ts';

const source = `
#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    if (!(cin >> n)) return 0;
    long long sum = 0;
    for (int i = 0; i < n; i++) {
        int x;
        cin >> x;
        sum += x;
    }
    cout << sum << "\\n";
    return 0;
}
`;

const inputs = ["3\n1 2 3\n", "5\n10 20 30 40 50\n"];

try {
  const outputs = await runReferenceCodeLocally("CPP", source, inputs, 1000);
  console.log("Outputs:", outputs);
} catch (err) {
  console.error("Error:", err.message);
}