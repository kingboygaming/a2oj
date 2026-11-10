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
MAX_INTERACTIVE_TESTS = 20
MAX_INTERACTIVE_CASE_CHARS = 1_000_000


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


def run_interactive_process(
    solution_command,
    interactor_command,
    timeout_ms,
    solution_cwd,
    interactor_cwd,
):
    started = time.monotonic()
    solution = subprocess.Popen(
        solution_command,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=solution_cwd,
        env={
            "HOME": TEMP_DIR,
            "LANG": "C.UTF-8",
            "PATH": "/usr/local/bin:/usr/bin:/bin",
            "PYTHONDONTWRITEBYTECODE": "1",
            "TMPDIR": TEMP_DIR,
        },
        start_new_session=True,
        bufsize=0,
        user=65534,
        group=65534,
    )
    try:
        interactor = subprocess.Popen(
            interactor_command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=interactor_cwd,
            env={
                "HOME": TEMP_DIR,
                "LANG": "C.UTF-8",
                "PATH": "/usr/local/bin:/usr/bin:/bin",
                "PYTHONDONTWRITEBYTECODE": "1",
                "TMPDIR": TEMP_DIR,
            },
            start_new_session=True,
            bufsize=0,
            user=65533,
            group=65533,
        )
    except Exception:
        kill_process_group(solution)
        solution.wait()
        raise

    selector = selectors.DefaultSelector()
    output = {"solution": bytearray(), "interactor": bytearray()}
    errors = {"solution": bytearray(), "interactor": bytearray()}
    targets = {
        interactor.stdin: bytearray(),
        solution.stdin: bytearray(),
    }
    source_targets = {
        solution.stdout: interactor.stdin,
        interactor.stdout: solution.stdin,
    }
    source_done = set()
    closed_targets = set()
    limited = False

    try:
        for source, target in source_targets.items():
            os.set_blocking(source.fileno(), False)
            selector.register(source, selectors.EVENT_READ, ("route", target))
        for owner, stream in (("solution", solution.stderr), ("interactor", interactor.stderr)):
            os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_READ, ("stderr", owner))
        for target in targets:
            os.set_blocking(target.fileno(), False)

        while selector.get_map() or solution.poll() is None or interactor.poll() is None:
            if time.monotonic() - started >= timeout_ms / 1000:
                kill_process_group(solution)
                kill_process_group(interactor)
                solution.wait()
                interactor.wait()
                return {
                    "timedOut": True,
                    "outputLimited": False,
                    "solutionCode": solution.returncode,
                    "interactorCode": interactor.returncode,
                    "solutionError": "",
                    "timeMs": round((time.monotonic() - started) * 1000),
                }

            for key, _ in selector.select(0.05):
                kind, destination = key.data
                if kind == "route":
                    chunk = os.read(key.fd, 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                        source_done.add(destination)
                        if not targets[destination] and destination not in closed_targets:
                            destination.close()
                            closed_targets.add(destination)
                    else:
                        owner = "solution" if key.fileobj is solution.stdout else "interactor"
                        output[owner].extend(chunk)
                        if len(output[owner]) > OUTPUT_LIMIT:
                            limited = True
                            break
                        if destination not in closed_targets:
                            targets[destination].extend(chunk)
                            if not selector.get_map().get(destination.fileno()):
                                selector.register(destination, selectors.EVENT_WRITE, ("write", destination))
                elif kind == "stderr":
                    chunk = os.read(key.fd, 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                    else:
                        errors[destination].extend(chunk)
                        if len(errors[destination]) > OUTPUT_LIMIT:
                            limited = True
                            break
                else:
                    pending = targets[destination]
                    try:
                        written = os.write(key.fd, pending[:65536])
                        del pending[:written]
                    except BrokenPipeError:
                        pending.clear()
                        destination.close()
                        closed_targets.add(destination)
                        selector.unregister(destination)
                        continue

                    if not pending:
                        selector.unregister(destination)
                        if destination in source_done and destination not in closed_targets:
                            destination.close()
                            closed_targets.add(destination)

            if limited:
                kill_process_group(solution)
                kill_process_group(interactor)
                break

        solution.wait()
        interactor.wait()
    finally:
        selector.close()
        for process in (solution, interactor):
            if process.poll() is None:
                kill_process_group(process)
                process.wait()
            for stream in (process.stdin, process.stdout, process.stderr):
                if stream and not stream.closed:
                    stream.close()

    return {
        "timedOut": False,
        "outputLimited": limited,
        "solutionCode": solution.returncode,
        "interactorCode": interactor.returncode,
        "solutionError": errors["solution"].decode("utf-8", errors="replace"),
        "timeMs": round((time.monotonic() - started) * 1000),
    }


def execute_interactive(payload):
    language = payload["language"]
    source = payload["source"]
    interactor_source = payload["interactorSource"]
    tests = payload["tests"]
    time_limit_ms = min(max(int(payload["timeLimitMs"]), 1), 3000)
    if not isinstance(tests, list) or not 1 <= len(tests) <= MAX_INTERACTIVE_TESTS:
        raise ValueError("Interactive test count is invalid.")
    if any(
        not isinstance(item, dict)
        or set(item) != {"id", "input", "output"}
        or not isinstance(item["id"], str)
        or len(item["id"]) > 128
        or not isinstance(item["input"], str)
        or not isinstance(item["output"], str)
        or len(item["input"]) > MAX_INTERACTIVE_CASE_CHARS
        or len(item["output"]) > MAX_INTERACTIVE_CASE_CHARS
        for item in tests
    ):
        raise ValueError("Interactive test data is invalid.")

    os.chmod(TEMP_DIR, 0o1777)
    solution_dir = os.path.join(TEMP_DIR, "participant")
    interactor_dir = os.path.join(TEMP_DIR, "judge")
    os.makedirs(solution_dir, mode=0o700, exist_ok=True)
    os.makedirs(interactor_dir, mode=0o700, exist_ok=True)
    os.chown(solution_dir, 65534, 65534)
    os.chmod(solution_dir, 0o700)
    os.chown(interactor_dir, 65533, 65533)
    os.chmod(interactor_dir, 0o700)

    solution_path = os.path.join(solution_dir, "main.py" if language == "PYTHON" else "main.cpp")
    interactor_path = os.path.join(interactor_dir, "interactor.cpp")
    solution_executable = os.path.join(solution_dir, "main")
    interactor_executable = os.path.join(interactor_dir, "interactor")
    with open(solution_path, "w", encoding="utf-8", newline="") as source_file:
        source_file.write(source)
    with open(interactor_path, "w", encoding="utf-8", newline="") as source_file:
        source_file.write(interactor_source)

    with open(os.devnull, "rb") as empty_input:
        interactor_compilation = run_process(
            ["g++", "-O2", "-std=c++17", "-pipe", interactor_path, "-o", interactor_executable],
            empty_input,
            15000,
        )
    if interactor_compilation["timedOut"] or interactor_compilation["returnCode"] != 0:
        return {
            "results": [
                {"testId": item["id"], "result": result("RTE", error="Interactor biên dịch thất bại.")}
                for item in tests
            ]
        }

    if language == "CPP":
        with open(os.devnull, "rb") as empty_input:
            solution_compilation = run_process(
                ["g++", "-O2", "-std=c++17", "-pipe", solution_path, "-o", solution_executable],
                empty_input,
                15000,
            )
        if solution_compilation["timedOut"]:
            compile_error = "Biên dịch quá thời gian cho phép."
        elif solution_compilation["outputLimited"]:
            compile_error = "Thông báo biên dịch vượt quá giới hạn."
        elif solution_compilation["returnCode"] != 0:
            compile_error = "\n".join(
                part for part in (solution_compilation["stderr"], solution_compilation["stdout"]) if part
            ) or "Biên dịch thất bại."
        else:
            compile_error = ""
        if compile_error:
            return {
                "results": [
                    {"testId": item["id"], "result": result("CE", error=compile_error)}
                    for item in tests
                ]
            }
        solution_command = [solution_executable]
    else:
        solution_command = ["python3", "-I", "-B", solution_path]

    results = []
    for index, item in enumerate(tests):
        input_path = os.path.join(interactor_dir, f"input-{index}.txt")
        answer_path = os.path.join(interactor_dir, f"answer-{index}.txt")
        with open(input_path, "w", encoding="utf-8", newline="") as input_file:
            input_file.write(item["input"])
        with open(answer_path, "w", encoding="utf-8", newline="") as answer_file:
            answer_file.write(item["output"])
        os.chown(input_path, 65533, 65533)
        os.chmod(input_path, 0o400)
        os.chown(answer_path, 65533, 65533)
        os.chmod(answer_path, 0o400)

        limit = time_limit_ms * (2 if language == "PYTHON" else 1)
        execution = run_interactive_process(
            solution_command,
            [interactor_executable, input_path, answer_path],
            limit + 500,
            solution_dir,
            interactor_dir,
        )
        if execution["timedOut"]:
            run_result = result("TLE", error="Time limit exceeded", time_ms=execution["timeMs"])
        elif execution["outputLimited"]:
            run_result = result("RTE", error="Output limit exceeded", time_ms=execution["timeMs"])
        elif language == "PYTHON" and re.search(
            r"\b(?:SyntaxError|IndentationError|TabError)\b", execution["solutionError"]
        ):
            run_result = result("CE", error=execution["solutionError"], time_ms=execution["timeMs"])
        elif execution["solutionCode"] != 0:
            run_result = result(
                "RTE",
                error=execution["solutionError"] or f"exit {execution['solutionCode']}",
                time_ms=execution["timeMs"],
            )
        elif execution["interactorCode"] == 0:
            run_result = result("AC", time_ms=execution["timeMs"])
        else:
            run_result = result("WA", time_ms=execution["timeMs"])
        results.append({"testId": item["id"], "result": run_result})

    return {"results": results}


def execute(payload):
    if payload.get("mode") == "interactive":
        return execute_interactive(payload)

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
