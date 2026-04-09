"""Pytest fixtures and MockSystemOps implementation for testing."""

import pytest
from typing import Dict, List, Any, Optional
import yaml
import os

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.backend.system_ops import CommandResult
from src.backend.extension_manager import ExtensionManager
from src.backend.paths import EXTENSIONS_DIR


class MockSystemOps:
    """Mock implementation of SystemOps for testing.

    This class simulates file system and subprocess operations,
    allowing tests to run without actual system calls.
    """

    def __init__(self):
        # File system simulation
        self.files: Dict[str, str] = {}  # path -> content
        self.binary_files: Dict[str, bytes] = {}  # path -> bytes
        self.dirs: set = set()
        self.executable_files: set = set()  # Explicitly track executable files

        # Command tracking
        self.commands_run: List[List[str]] = []
        self.command_outputs: Dict[str, tuple] = {}  # "cmd args" -> (stdout, stderr, returncode)
        self.enabled_services: set = set()
        self.disabled_services: set = set()

        # Sysext state
        self._active_extensions: set = set()
        self._sysext_refresh_succeeds = True

        # Tracking for assertions
        self.reboot_called = False
        self.files_removed: List[str] = []
        self.files_copied: List[tuple] = []  # (src, dest)

    @property
    def sysext_refresh_success(self) -> bool:
        """Get sysext refresh success state."""
        return self._sysext_refresh_succeeds

    @sysext_refresh_success.setter
    def sysext_refresh_success(self, value: bool) -> None:
        """Set sysext refresh success state."""
        self._sysext_refresh_succeeds = value

    @property
    def sysext_refresh_called(self) -> bool:
        """Check if sysext refresh was called."""
        return any("systemd-sysext" in str(cmd) and "refresh" in str(cmd) for cmd in self.commands_run)

    # File operations

    def file_exists(self, path: str) -> bool:
        return path in self.files or path in self.binary_files

    def dir_exists(self, path: str) -> bool:
        # Check if path is in dirs or if any file has this as a prefix
        if path in self.dirs:
            return True
        for file_path in list(self.files.keys()) + list(self.binary_files.keys()):
            if file_path.startswith(path + "/"):
                return True
        return False

    def list_dir(self, path: str) -> List[str]:
        results = set()
        all_files = list(self.files.keys()) + list(self.binary_files.keys())
        for file_path in all_files:
            if file_path.startswith(path + "/"):
                # Get the next path component
                remainder = file_path[len(path) + 1:]
                if "/" in remainder:
                    results.add(remainder.split("/")[0])
                else:
                    results.add(remainder)
        return list(results)

    def make_dirs(self, path: str) -> None:
        self.dirs.add(path)

    def remove_file(self, path: str) -> None:
        self.files_removed.append(path)
        if path in self.files:
            del self.files[path]
        if path in self.binary_files:
            del self.binary_files[path]

    def read_file(self, path: str) -> str:
        if path not in self.files:
            raise FileNotFoundError(f"Mock file not found: {path}")
        return self.files[path]

    def read_file_bytes(self, path: str) -> bytes:
        if path in self.binary_files:
            return self.binary_files[path]
        if path in self.files:
            return self.files[path].encode()
        raise FileNotFoundError(f"Mock file not found: {path}")

    def write_file(self, path: str, content: str) -> None:
        self.files[path] = content

    def copy_file(self, src: str, dest: str) -> None:
        self.files_copied.append((src, dest))
        if src in self.files:
            self.files[dest] = self.files[src]
        elif src in self.binary_files:
            self.binary_files[dest] = self.binary_files[src]

    def file_hash(self, path: str) -> str:
        # Return a simple hash for testing
        content = self.read_file_bytes(path)
        return f"hash_{hash(content)}"

    def is_executable(self, path: str) -> bool:
        return path in self.executable_files

    def make_executable(self, path: str) -> None:
        """Mark a file as executable."""
        self.executable_files.add(path)

    # Process/command operations

    def run_command(self, args: List[str], timeout: int = 30) -> CommandResult:
        self.commands_run.append(args)
        # Check if we have a mock output for this command
        cmd_str = " ".join(args)
        if cmd_str in self.command_outputs:
            stdout, stderr, returncode = self.command_outputs[cmd_str]
            return CommandResult(returncode, stdout, stderr)
        return CommandResult(0, "", "")

    def sysext_list(self) -> CommandResult:
        # Generate output matching systemd-sysext list format
        lines = []
        for ext_name in self._active_extensions:
            lines.append(f"{ext_name}    raw  /var/lib/extensions/{ext_name}.raw")
        return CommandResult(0, "\n".join(lines), "")

    def sysext_refresh(self) -> CommandResult:
        self.commands_run.append(["sudo", "systemd-sysext", "refresh"])
        if self._sysext_refresh_succeeds:
            return CommandResult(0, "", "")
        else:
            return CommandResult(1, "", "sysext refresh failed")

    def systemctl_enable(self, service: str) -> CommandResult:
        self.commands_run.append(["sudo", "systemctl", "enable", "--now", service])
        self.enabled_services.add(service)
        return CommandResult(0, "", "")

    def systemctl_disable(self, service: str) -> CommandResult:
        self.commands_run.append(["sudo", "systemctl", "disable", service])
        self.disabled_services.add(service)
        return CommandResult(0, "", "")

    def systemctl_is_active(self, service: str) -> bool:
        """Check if a systemd service is active."""
        return service in self.enabled_services

    def reboot(self) -> CommandResult:
        self.reboot_called = True
        self.commands_run.append(["sudo", "systemctl", "reboot"])
        return CommandResult(0, "", "")

    # Helper methods for test setup

    def add_manifest(self, ext_id: str, manifest: dict, plugin_dir: str = "/fake/plugin") -> None:
        """Add a manifest file for an extension."""
        ext_name = f"steamos-extension-{ext_id}"
        manifest_path = f"{plugin_dir}/dist/extensions/{ext_name}.yaml"
        self.files[manifest_path] = yaml.dump(manifest)

    def add_bundled_raw(self, ext_id: str, plugin_dir: str = "/fake/plugin") -> None:
        """Add a bundled .raw file for an extension."""
        ext_name = f"steamos-extension-{ext_id}"
        raw_path = f"{plugin_dir}/dist/extensions/{ext_name}.raw"
        self.binary_files[raw_path] = f"raw content for {ext_id}".encode()

    def add_installed_raw(self, ext_id: str) -> None:
        """Add an installed .raw file in /var/lib/extensions/."""
        ext_name = f"steamos-extension-{ext_id}"
        raw_path = f"{EXTENSIONS_DIR}/{ext_name}.raw"
        self.binary_files[raw_path] = f"installed raw content for {ext_id}".encode()

    def set_active_extensions(self, ext_names: List[str]) -> None:
        """Set which extensions appear as active in sysext list."""
        self._active_extensions = set(ext_names)
        # Also enable systemd-sysext service when extensions are active
        if ext_names:
            self.enabled_services.add("systemd-sysext")

    def set_sysext_refresh_fails(self, fails: bool = True) -> None:
        """Configure whether sysext refresh succeeds or fails."""
        self._sysext_refresh_succeeds = not fails

    def add_uninstall_script(self, ext_id: str, plugin_dir: str = "/fake/plugin") -> None:
        """Add an uninstall script for an extension."""
        script_path = f"{plugin_dir}/dist/extensions/steamos-extension-{ext_id}.uninstall"
        self.files[script_path] = "#!/bin/bash\necho uninstalling"

    # Assertion helpers

    def systemctl_enable_called_with(self, service: str) -> bool:
        """Check if systemctl enable was called for a service."""
        return service in self.enabled_services

    def systemctl_disable_called_with(self, service: str) -> bool:
        """Check if systemctl disable was called for a service."""
        return service in self.disabled_services

    def get_remove_order(self) -> List[str]:
        """Get the order in which files were removed (ext_id only)."""
        order = []
        for path in self.files_removed:
            if path.startswith(EXTENSIONS_DIR) and path.endswith(".raw"):
                # Extract ext_id from path
                filename = os.path.basename(path)
                ext_name = filename.replace(".raw", "")
                ext_id = ext_name.replace("steamos-extension-", "")
                order.append(ext_id)
        return order


@pytest.fixture
def mock_sys():
    """Create a fresh MockSystemOps instance."""
    return MockSystemOps()


@pytest.fixture
def plugin_dir():
    """Return the fake plugin directory path."""
    return "/fake/plugin"


@pytest.fixture
def manager(mock_sys, plugin_dir):
    """Create an ExtensionManager with mock system ops."""
    return ExtensionManager(mock_sys, plugin_dir)
