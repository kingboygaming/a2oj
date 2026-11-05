import Stockfish from "./sf_19_smallnet.js";

try {
  const engine = await Stockfish({
    listen: (line) => self.postMessage({ type: "line", line }),
    onError: (message) => self.postMessage({ type: "error", message }),
  });
  self.postMessage({ type: "ready" });
  self.onmessage = ({ data }) => {
    if (data?.type === "command" && typeof data.command === "string") {
      engine.uci(data.command);
    }
  };
} catch (error) {
  self.postMessage({
    type: "error",
    message: error instanceof Error ? error.message : "Không thể khởi động Stockfish.",
  });
}
