let stockfishWorker: Worker | null = null;
let stockfishReady: Promise<Worker> | null = null;

export function loadStockfishWorker() {
  if (stockfishReady) return stockfishReady;

  const worker = new Worker("/chess-engine/stockfish-worker.js", {
    type: "module",
  });
  stockfishWorker = worker;

  stockfishReady = new Promise<Worker>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };
    const handleMessage = (event: MessageEvent<{ type?: string; message?: string }>) => {
      if (event.data.type === "ready") {
        cleanup();
        resolve(worker);
      } else if (event.data.type === "error") {
        cleanup();
        reject(new Error(event.data.message || "Stockfish could not start."));
      }
    };
    const handleError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || "Stockfish worker failed to load."));
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
  }).catch((error: unknown) => {
    worker.terminate();
    if (stockfishWorker === worker) {
      stockfishWorker = null;
      stockfishReady = null;
    }
    throw error;
  });

  return stockfishReady;
}

export function preloadStockfish() {
  return loadStockfishWorker();
}
