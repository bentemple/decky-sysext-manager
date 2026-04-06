"""System operations interface and implementation.

This module defines a Protocol for all system/OS operations, making the
extension manager testable by allowing mock implementations.
"""

from typing import Protocol, List
from dataclasses import dataclass
import subprocess
import os
import hashlib
import shutil


@dataclass
class CommandResult:
    """Result of running a shell command."""
    returncode: int
    stdout: str
    stderr: str

    @property
    def success(self) -> bool:
        return self.returncode == 0


class SystemOps(Protocol):
    """Interface for all system/OS operations.

    This protocol defines every system call the extension manager needs,
    allowing for easy mocking in tests.
    """

    # File operations
    def file_exists(self, path: str) -> bool:
        """Check if a file exists."""
        ...

    def dir_exists(self, path: str) -> bool:
        """Check if a directory exists."""
        ...

    def list_dir(self, path: str) -> List[str]:
        """List contents of a directory."""
        ...

    def make_dirs(self, path: str) -> None:
        """Create directory and parents if needed."""
        ...

    def remove_file(self, path: str) -> None:
        """Remove a file."""
        ...

    def read_file(self, path: str) -> str:
        """Read file contents as string."""
        ...

    def read_file_bytes(self, path: str) -> bytes:
        """Read file contents as bytes."""
        ...

    def write_file(self, path: str, content: str) -> None:
        """Write string content to file."""
        ...

    def copy_file(self, src: str, dest: str) -> None:
        """Copy a file from src to dest."""
        ...

    def file_hash(self, path: str) -> str:
        """Compute SHA256 hash of a file."""
        ...

    def is_executable(self, path: str) -> bool:
        """Check if file exists and is executable."""
        ...

    # Process/command operations
    def run_command(self, args: List[str], timeout: int = 30) -> CommandResult:
        """Run a shell command and return the result."""
        ...

    def sysext_list(self) -> CommandResult:
        """Run systemd-sysext list --no-legend."""
        ...

    def sysext_refresh(self) -> CommandResult:
        """Run systemd-sysext refresh."""
        ...

    def systemctl_enable(self, service: str) -> CommandResult:
        """Enable and start a systemd service."""
        ...

    def systemctl_disable(self, service: str) -> CommandResult:
        """Disable a systemd service."""
        ...

    def systemctl_is_active(self, service: str) -> bool:
        """Check if a systemd service is active."""
        ...

    def reboot(self) -> CommandResult:
        """Trigger system reboot."""
        ...


class RealSystemOps:
    """Production implementation using actual system calls."""

    def __init__(self, logger=None):
        """Initialize with optional logger for debugging."""
        self.logger = logger

    def _log(self, level: str, message: str) -> None:
        """Log a message if logger is available."""
        if self.logger:
            log_fn = getattr(self.logger, level, None)
            if log_fn:
                log_fn(message)

    # File operations

    def file_exists(self, path: str) -> bool:
        return os.path.isfile(path)

    def dir_exists(self, path: str) -> bool:
        return os.path.isdir(path)

    def list_dir(self, path: str) -> List[str]:
        return os.listdir(path)

    def make_dirs(self, path: str) -> None:
        os.makedirs(path, exist_ok=True)

    def remove_file(self, path: str) -> None:
        os.remove(path)

    def read_file(self, path: str) -> str:
        with open(path, "r") as f:
            return f.read()

    def read_file_bytes(self, path: str) -> bytes:
        with open(path, "rb") as f:
            return f.read()

    def write_file(self, path: str, content: str) -> None:
        with open(path, "w") as f:
            f.write(content)

    def copy_file(self, src: str, dest: str) -> None:
        shutil.copy2(src, dest)

    def file_hash(self, path: str) -> str:
        """Compute SHA256 hash of a file."""
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    def is_executable(self, path: str) -> bool:
        return os.path.isfile(path) and os.access(path, os.X_OK)

    # Process/command operations

    def run_command(self, args: List[str], timeout: int = 30) -> CommandResult:
        """Run a shell command and return the result."""
        cmd_str = " ".join(args)
        self._log("info", f"Running command: {cmd_str}")

        try:
            # Use clean environment to avoid sysext library conflicts
            # (e.g., readline symbol errors when bash loads wrong libreadline)
            env = os.environ.copy()
            env.pop("LD_LIBRARY_PATH", None)
            env.pop("LD_PRELOAD", None)

            result = subprocess.run(
                args,
                capture_output=True,
                text=True,
                timeout=timeout,
                env=env
            )

            if result.stdout.strip():
                self._log("info", f"Command stdout: {result.stdout.strip()}")
            if result.stderr.strip():
                self._log("warning", f"Command stderr: {result.stderr.strip()}")
            if result.returncode != 0:
                self._log("warning", f"Command exited with code {result.returncode}")

            return CommandResult(
                returncode=result.returncode,
                stdout=result.stdout,
                stderr=result.stderr
            )
        except subprocess.TimeoutExpired:
            self._log("error", f"Command timed out after {timeout}s: {cmd_str}")
            return CommandResult(
                returncode=-1,
                stdout="",
                stderr="Command timed out"
            )

    def sysext_list(self) -> CommandResult:
        return self.run_command(
            ["sudo", "systemd-sysext", "list", "--no-legend"],
            timeout=10
        )

    def sysext_refresh(self) -> CommandResult:
        return self.run_command(
            ["sudo", "systemd-sysext", "refresh"],
            timeout=30
        )

    def systemctl_enable(self, service: str) -> CommandResult:
        return self.run_command(
            ["sudo", "systemctl", "enable", "--now", service],
            timeout=30
        )

    def systemctl_disable(self, service: str) -> CommandResult:
        return self.run_command(
            ["sudo", "systemctl", "disable", service],
            timeout=30
        )

    def systemctl_is_active(self, service: str) -> bool:
        result = self.run_command(
            ["systemctl", "is-active", "--quiet", service],
            timeout=10
        )
        return result.success

    def reboot(self) -> CommandResult:
        return self.run_command(
            ["sudo", "systemctl", "reboot"],
            timeout=10
        )
