import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


MAX_BODY_BYTES = 2 * 1024 * 1024
MAX_RESPONSE_BYTES = 5 * 1024 * 1024
MAX_SOURCE_CHARS = 64_000
MAX_INPUT_CHARS = 16_000
MAX_SAMPLE_RUNS = 20
MAX_CONCURRENT_RUNS = 3
AUTH_WINDOW_SECONDS = 60
RUNNER_IMAGE_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,254}$")
NONCES = {}
NONCES_LOCK = threading.Lock()
LOG = logging.getLogger("tinoj-ide-runner")


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def authenticate(headers, body, secret, now=None):
    timestamp = headers.get("X-Tinoj-Timestamp", "")
    nonce = headers.get("X-Tinoj-Nonce", "")
    provided_signature = headers.get("X-Tinoj-Signature", "")
    if not re.fullmatch(r"[0-9]{1,12}", timestamp) or not re.fullmatch(
        r"[a-f0-9]{32}", nonce
    ):
        return False
    if not re.fullmatch(r"[a-f0-9]{64}", provided_signature):
        return False

    current_time = int(time.time()) if now is None else now
    request_time = int(timestamp)
    if abs(current_time - request_time) > AUTH_WINDOW_SECONDS:
        return False

    expected_signature = hmac.new(
        secret.encode("utf-8"),
        timestamp.encode("ascii") + b"." + nonce.encode("ascii") + b"." + body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, provided_signature):
        return False

    with NONCES_LOCK:
        expired = [
            used_nonce
            for used_nonce, used_at in NONCES.items()
            if current_time - used_at > AUTH_WINDOW_SECONDS * 2
        ]
        for used_nonce in expired:
            del NONCES[used_nonce]
        if nonce in NONCES:
            return False
        NONCES[nonce] = current_time
    return True


def validate_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("Request body must be an object.")
    if payload.get("language") not in ("CPP", "PYTHON"):
        raise ValueError("Unsupported language.")
    source = payload.get("source")
    if not isinstance(source, str) or not 1 <= len(source) <= MAX_SOURCE_CHARS:
        raise ValueError("Source length is invalid.")
    time_limit_ms = payload.get("timeLimitMs")
    if (
        not isinstance(time_limit_ms, int)
        or isinstance(time_limit_ms, bool)
        or not 1 <= time_limit_ms <= 3000
    ):
        raise ValueError("Time limit is invalid.")

    if "inputs" in payload:
        if set(payload) != {"language", "source", "timeLimitMs", "inputs"}:
            raise ValueError("Request fields are invalid.")
        inputs = payload["inputs"]
        if not isinstance(inputs, list) or not 1 <= len(inputs) <= MAX_SAMPLE_RUNS:
            raise ValueError("Sample count is invalid.")
        for item in inputs:
            if (
                not isinstance(item, dict)
                or set(item) != {"id", "input"}
                or not isinstance(item["id"], str)
                or len(item["id"]) > 128
                or not isinstance(item["input"], str)
                or len(item["input"]) > MAX_INPUT_CHARS
            ):
                raise ValueError("Sample input is invalid.")
        timeout_seconds = min(90, 20 + time_limit_ms * len(inputs) / 1000)
    else:
        if set(payload) != {"language", "source", "timeLimitMs", "input"}:
            raise ValueError("Request fields are invalid.")
        input_text = payload["input"]
        if not isinstance(input_text, str) or len(input_text) > MAX_INPUT_CHARS:
            raise ValueError("Input is invalid.")
        timeout_seconds = 90
    return timeout_seconds


def run_in_docker(body, timeout_seconds):
    image = os.environ.get("IDE_RUNNER_IMAGE", "tinoj-ide-runner:latest")
    if not RUNNER_IMAGE_PATTERN.fullmatch(image):
        raise ValueError("IDE_RUNNER_IMAGE is invalid.")
    docker_command = os.environ.get("IDE_DOCKER_COMMAND", "docker").strip()
    if not docker_command:
        raise ValueError("IDE_DOCKER_COMMAND is empty.")

    container_name = "tinoj-ide-" + secrets.token_hex(12)
    command = [
        docker_command,
        "run",
        "--rm",
        "--name",
        container_name,
        "--interactive",
        "--init",
        "--pull=never",
        "--network=none",
        "--memory=768m",
        "--memory-swap=768m",
        "--cpus=1",
        "--pids-limit=64",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges:true",
        "--user=65534:65534",
        "--tmpfs=/tmp:rw,nosuid,nodev,exec,size=128m,uid=65534,gid=65534,mode=700",
        "--env=PYTHONDONTWRITEBYTECODE=1",
        image,
    ]
    try:
        process = subprocess.run(
            command,
            input=body,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout_seconds,
            check=False,
            creationflags=(
                subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            ),
        )
    except subprocess.TimeoutExpired as error:
        try:
            subprocess.run(
                [docker_command, "rm", "--force", container_name],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
                check=False,
                creationflags=(
                    subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                ),
            )
        except (OSError, subprocess.TimeoutExpired):
            LOG.exception("Could not clean up timed-out runner container.")
        raise TimeoutError("Docker runner exceeded its time limit.") from error
    except FileNotFoundError as error:
        raise RuntimeError("Docker CLI was not found on the runner host.") from error

    if len(process.stdout) > MAX_RESPONSE_BYTES:
        raise RuntimeError("Docker runner response exceeded the size limit.")
    if process.returncode != 0:
        error_text = process.stderr.decode("utf-8", errors="replace").strip()
        LOG.error(
            "Docker runner exited with code %s: %s",
            process.returncode,
            error_text[:1000],
        )
        raise RuntimeError("Docker runner failed.")

    try:
        return json.loads(process.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RuntimeError("Docker runner returned invalid JSON.") from error


class RunnerHandler(BaseHTTPRequestHandler):
    server_version = "TinOJRunner"
    sys_version = ""

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, message, *args):
        LOG.info("%s - %s", self.client_address[0], message % args)

    def do_GET(self):
        if self.path != "/health":
            json_response(self, 404, {"error": "Not found."})
            return
        json_response(self, 200, {"status": "ok"})

    def do_POST(self):
        if self.path != "/run":
            json_response(self, 404, {"error": "Not found."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            json_response(self, 400, {"error": "Content-Length is invalid."})
            return
        if not 0 < content_length <= MAX_BODY_BYTES:
            json_response(self, 413, {"error": "Request body size is invalid."})
            return

        try:
            body = self.rfile.read(content_length)
        except TimeoutError:
            json_response(self, 408, {"error": "Request body timed out."})
            return
        if len(body) != content_length:
            json_response(self, 400, {"error": "Request body is incomplete."})
            return

        secret = os.environ.get("IDE_RUNNER_SECRET", "").strip()
        if len(secret) < 32 or not authenticate(self.headers, body, secret):
            json_response(self, 401, {"error": "Runner authentication failed."})
            return

        try:
            payload = json.loads(body.decode("utf-8"))
            timeout_seconds = validate_payload(payload)
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            json_response(self, 400, {"error": str(error)})
            return

        try:
            result = run_in_docker(body, timeout_seconds)
            response_body = json.dumps(result, ensure_ascii=False).encode("utf-8")
            if len(response_body) > MAX_RESPONSE_BYTES:
                raise RuntimeError("Runner response exceeded the size limit.")
            json_response(self, 200, result)
        except TimeoutError as error:
            json_response(self, 504, {"error": str(error)})
        except (RuntimeError, ValueError) as error:
            LOG.error("Runner request failed: %s", error)
            json_response(self, 502, {"error": str(error)})
        except Exception:
            LOG.exception("Unexpected runner request failure.")
            json_response(self, 500, {"error": "Unexpected runner service error."})


class RunnerHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    request_slots = threading.BoundedSemaphore(MAX_CONCURRENT_RUNS)

    def process_request(self, request, client_address):
        if not self.request_slots.acquire(blocking=False):
            try:
                request.sendall(
                    b"HTTP/1.1 503 Service Unavailable\r\n"
                    b"Content-Length: 0\r\n"
                    b"Connection: close\r\n\r\n"
                )
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.request_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.request_slots.release()


def main():
    secret = os.environ.get("IDE_RUNNER_SECRET", "")
    if len(secret) < 32:
        raise SystemExit("IDE_RUNNER_SECRET must contain at least 32 characters.")
    host = os.environ.get("IDE_RUNNER_HOST", "127.0.0.1")
    port = int(os.environ.get("IDE_RUNNER_PORT", "8787"))
    server = RunnerHTTPServer((host, port), RunnerHandler)
    server.timeout = 10
    LOG.info("IDE runner listening on %s:%s", host, port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOG.info("Stopping IDE runner.")
    finally:
        server.server_close()


if __name__ == "__main__":
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    main()
