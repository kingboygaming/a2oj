let stockfishReady: Promise<Worker> | null = null;

export function loadStockfishWorker() {
  if (stockfishReady) return stockfishReady;

  const worker = new Worker("/chess-engine/stockfish-19-lite-single.js");
  stockfishReady = new Promise<Worker>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => finish(new Error("Stockfish initialization timed out.")),
      30000,
    );

    const cleanup = () => {
      window.clearTimeout(timeout);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.data === "uciok") {
        cleanup();
        resolve(worker);
      }
    };
    const handleError = (event: ErrorEvent) => {
      finish(new Error(event.message || "Stockfish worker failed to load."));
    };
    const finish = (error: Error) => {
      cleanup();
      reject(error);
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage("uci");
  }).catch((error: unknown) => {
    worker.terminate();
    stockfishReady = null;
    throw error;
  });

  return stockfishReady;
}

export function preloadStockfish() {
  return loadStockfishWorker();
}
