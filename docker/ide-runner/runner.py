import json
import os
import re
import selectors
import signal
import subprocess
import sys
import time


OUTPUT_LIMIT = 2 * 1024 * 1024
TEMP_DIR = "/tmp"


def kill_process_group(process):
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def run_process(command, input_stream, timeout_ms):
    started = time.monotonic()
    process = subprocess.Popen(
        command,
        stdin=input_stream,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=TEMP_DIR,
        env={
            "HOME": TEMP_DIR,
            "LANG": "C.UTF-8",
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "PYTHONDONTWRITEBYTECODE": "1",
            "TMPDIR": TEMP_DIR,
        },
        start_new_session=True,
    )
    selector = selectors.DefaultSelector()
    output = {"stdout": bytearray(), "stderr": bytearray()}
    selector.register(process.stdout, selectors.EVENT_READ, "stdout")
    selector.register(process.stderr, selectors.EVENT_READ, "stderr")
    deadline = started + timeout_ms / 1000
    timed_out = False
    output_limited = False

    try:
        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                timed_out = True
                kill_process_group(process)
                break

            for key, _ in selector.select(min(remaining, 0.1)):
                chunk = os.read(key.fd, 65536)
                if not chunk:
                    selector.unregister(key.fileobj)
                    key.fileobj.close()
                    continue
                stream = output[key.data]
                stream.extend(chunk)
                if len(stream) > OUTPUT_LIMIT:
                    output_limited = True
                    kill_process_group(process)
                    break
            if output_limited:
                break

        if process.poll() is None:
            kill_process_group(process)
        try:
            return_code = process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            kill_process_group(process)
            return_code = process.wait(timeout=2)
    finally:
        selector.close()
        for stream in (process.stdout, process.stderr):
            if not stream.closed:
                stream.close()

    return {
        "returnCode": return_code,
        "stdout": output["stdout"].decode("utf-8", errors="replace"),
        "stderr": output["stderr"].decode("utf-8", errors="replace"),
        "timeMs": round((time.monotonic() - started) * 1000),
        "timedOut": timed_out,
        "outputLimited": output_limited,
    }


def result(verdict, output="", error="", time_ms=0):
    return {
        "verdict": verdict,
        "output": output,
        "error": error,
        "timeMs": time_ms,
    }


def execute(payload):
    language = payload["language"]
    source = payload["source"]
    batch = "inputs" in payload
    inputs = payload["inputs"] if batch else [{"id": "", "input": payload["input"]}]
    if not isinstance(inputs, list) or not 1 <= len(inputs) <= 20:
        raise ValueError("Sample count must be between 1 and 20.")
    if any(
        not isinstance(item, dict)
        or not isinstance(item.get("id"), str)
        or not isinstance(item.get("input"), str)
        for item in inputs
    ):
        raise ValueError("Sample input is invalid.")
    time_limit_ms = min(max(int(payload["timeLimitMs"]), 1), 3000)

    if language == "PYTHON":
        source_path = os.path.join(TEMP_DIR, "main.py")
        with open(source_path, "w", encoding="utf-8", newline="") as source_file:
            source_file.write(source)
        command = ["python3", "-I", "-B", source_path]
    elif language == "CPP":
        source_path = os.path.join(TEMP_DIR, "main.cpp")
        executable_path = os.path.join(TEMP_DIR, "main")
        with open(source_path, "w", encoding="utf-8", newline="") as source_file:
            source_file.write(source)
        with open(os.devnull, "rb") as empty_input:
            compilation = run_process(
                ["g++", "-O2", "-std=c++17", "-pipe", source_path, "-o", executable_path],
                empty_input,
                15000,
            )
        if compilation["timedOut"]:
            compile_error = "Biên dịch quá thời gian cho phép."
            return {
                "results": [
                    {"sampleId": item["id"], "result": result("CE", error=compile_error)}
                    for item in inputs
                ]
            } if batch else result("CE", error=compile_error)
        if compilation["outputLimited"]:
            compile_error = "Thông báo biên dịch vượt quá giới hạn."
            return {
                "results": [
                    {"sampleId": item["id"], "result": result("CE", error=compile_error)}
                    for item in inputs
                ]
            } if batch else result("CE", error=compile_error)
        if compilation["returnCode"] != 0:
            diagnostics = "\n".join(
                part for part in (compilation["stderr"], compilation["stdout"]) if part
            )
            compile_error = diagnostics or "Biên dịch thất bại."
            return {
                "results": [
                    {"sampleId": item["id"], "result": result("CE", error=compile_error)}
                    for item in inputs
                ]
            } if batch else result("CE", error=compile_error)
        command = [executable_path]
    else:
        return result("CE", error="Ngôn ngữ không được hỗ trợ.")

    results = []
    for index, item in enumerate(inputs):
        input_path = os.path.join(TEMP_DIR, f"input-{index}.txt")
        with open(input_path, "w", encoding="utf-8", newline="") as input_file:
            input_file.write(item["input"])
        with open(input_path, "rb") as program_input:
            execution = run_process(command, program_input, time_limit_ms)

        if execution["timedOut"]:
            run_result = result("TLE", execution["stdout"], "Time limit exceeded", execution["timeMs"])
        elif execution["outputLimited"]:
            run_result = result(
                "RTE",
                execution["stdout"],
                "Output limit exceeded",
                execution["timeMs"],
            )
        elif execution["returnCode"] != 0:
            is_python_syntax_error = language == "PYTHON" and re.search(
                r"\b(?:SyntaxError|IndentationError|TabError)\b", execution["stderr"]
            )
            run_result = result(
                "CE" if is_python_syntax_error else "RTE",
                execution["stdout"],
                execution["stderr"] or f"exit {execution['returnCode']}",
                execution["timeMs"],
            )
        else:
            run_result = result("OK", execution["stdout"], execution["stderr"], execution["timeMs"])
        results.append({"sampleId": item["id"], "result": run_result})

    return {"results": results} if batch else results[0]["result"]


def main():
    try:
        payload = json.load(sys.stdin)
        response = execute(payload)
    except Exception as error:
        response = result("RTE", error=f"Runner error: {error}")
    sys.stdout.write(json.dumps(response, ensure_ascii=False))


if __name__ == "__main__":
    main()
