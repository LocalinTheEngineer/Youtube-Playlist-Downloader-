"""Dependency diagnostics must not report missing or broken tools as ready."""

import subprocess
from importlib.metadata import PackageNotFoundError
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import system_service as service


@pytest.fixture
def healthy(monkeypatch):
    monkeypatch.setattr(service, "version", lambda name: "1.0.0")
    monkeypatch.setattr(service.shutil, "which", lambda name: f"/tools/{name}")

    def run(args, **options):
        name = args[0].split("/")[-1]
        assert args == [f"/tools/{name}", "--version" if name == "node" else "-version"]
        assert options["shell"] is False
        assert options["timeout"] == 3
        return SimpleNamespace(returncode=0, stdout="v24.19.0\n" if name == "node" else f"{name} version 8.0.1\n")

    monkeypatch.setattr(service.subprocess, "run", run)


def test_report_contains_versions_and_healthy_status(healthy):
    report = service.check_system()
    assert report.ready
    versions = {item.name: item.version for item in report.components}
    assert versions == {"yt-dlp": "1.0.0", "yt-dlp-ejs": "1.0.0", "ffmpeg": "8.0.1", "ffprobe": "8.0.1", "node": "24.19.0"}


def test_missing_binary_produces_actionable_endpoint_response(healthy, monkeypatch):
    monkeypatch.setattr(service.shutil, "which", lambda name: None if name == "ffmpeg" else f"/tools/{name}")
    client = TestClient(app)
    try:
        response = client.get("/api/system/check")
    finally:
        client.close()
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is False
    missing = next(item for item in body["components"] if item["name"] == "ffmpeg")
    assert missing["version"] is None
    assert "PATH" in missing["message"]


def test_missing_python_dependency_is_not_ready(healthy, monkeypatch):
    def version(name):
        if name == "yt-dlp-ejs":
            raise PackageNotFoundError(name)
        return "1.0.0"

    monkeypatch.setattr(service, "version", version)
    report = service.check_system()
    assert not report.ready
    assert "requirements.txt" in next(item.message for item in report.components if item.name == "yt-dlp-ejs")


@pytest.mark.parametrize("mode", ["timeout", "permission", "nonzero", "unknown", "old-node"])
def test_broken_binary_is_not_ready(healthy, monkeypatch, mode):
    def run(*_args, **_kwargs):
        if mode == "timeout":
            raise subprocess.TimeoutExpired("node", 3)
        if mode == "permission":
            raise PermissionError("denied")
        return SimpleNamespace(
            returncode=1 if mode == "nonzero" else 0,
            stdout="v20.1.0" if mode == "old-node" else "unknown output",
        )

    monkeypatch.setattr(service.subprocess, "run", run)
    report = service.check_system()
    node = next(item for item in report.components if item.name == "node")
    assert not node.ready
    assert not report.ready
    assert node.message
