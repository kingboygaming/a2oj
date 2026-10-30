FROM python:3.13-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends g++ \
    && rm -rf /var/lib/apt/lists/*

COPY runner.py /opt/tinoj/runner.py
RUN chmod 0555 /opt/tinoj/runner.py

USER 65534:65534
ENTRYPOINT ["python3", "-I", "-B", "/opt/tinoj/runner.py"]
