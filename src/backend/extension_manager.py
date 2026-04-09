"""Extension manager - core business logic for managing SteamOS extensions."""

from typing import Dict, List, Any, Optional, Callable
import os
import json
import time

import yaml

from .system_ops import SystemOps
from .paths import EXTENSIONS_DIR, UPDATE_CACHE_MAX_AGE


class ExtensionManager:
    """Manages SteamOS systemd-sysext extensions.

    This class contains all business logic for enabling, disabling, and
    managing extensions. It uses a SystemOps interface for all system
    calls, making it fully testable.
    """

    def __init__(
        self,
        sys_ops: SystemOps,
        plugin_dir: str,
        logger: Optional[Any] = None
    ):
        """Initialize the extension manager.

        Args:
            sys_ops: System operations interface (real or mock)
            plugin_dir: Path to the plugin directory
            logger: Optional logger instance (e.g., decky.logger)
        """
        self.sys = sys_ops
        self.plugin_dir = plugin_dir
        self.logger = logger
        self._active_extensions: set = set()

        # Derived paths
        self.bundled_extensions_dir = os.path.join(plugin_dir, "dist", "extensions")
        self.update_cache_dir = os.path.join(plugin_dir, "cache", "update-manager")

    def _log(self, level: str, message: str) -> None:
        """Log a message if logger is available."""
        if self.logger:
            log_fn = getattr(self.logger, level, None)
            if log_fn:
                log_fn(message)

    async def refresh_active_extensions(self) -> None:
        """Get list of extensions currently active via systemd-sysext."""
        self._active_extensions = set()

        # Check if systemd-sysext service is active (overlays are mounted)
        self._sysext_active = self.sys.systemctl_is_active("systemd-sysext")
        self._log("info", f"systemd-sysext service active: {self._sysext_active}")

        try:
            result = self.sys.sysext_list()
            self._log("info", f"systemd-sysext list output: {result.stdout!r}")

            if result.success:
                for line in result.stdout.strip().split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split()
                    if parts:
                        ext_name = parts[0]
                        if ext_name.startswith("steamos-extension-"):
                            self._active_extensions.add(ext_name)
                            self._log("debug", f"Found extension in list: {ext_name}")
                self._log("info", f"Extensions in sysext list: {self._active_extensions}")
            else:
                self._log("warning", f"systemd-sysext list failed: {result.stderr}")
        except Exception as e:
            self._log("warning", f"Failed to get active extensions: {e}")

    def _get_extension_status(self, ext_id: str) -> str:
        """Get status: active, pending, unloaded, or disabled."""
        ext_name = f"steamos-extension-{ext_id}"
        raw_filename = f"{ext_name}.raw"
        raw_path = os.path.join(EXTENSIONS_DIR, raw_filename)
        raw_exists = self.sys.file_exists(raw_path)
        in_sysext_list = ext_name in self._active_extensions
        sysext_running = getattr(self, '_sysext_active', False)

        self._log(
            "info",
            f"Status check for '{ext_id}': raw_exists={raw_exists}, "
            f"in_sysext_list={in_sysext_list}, sysext_running={sysext_running}"
        )

        if raw_exists:
            if sysext_running and in_sysext_list:
                return "active"
            elif sysext_running:
                # Service running but extension not in list - needs reboot
                return "pending"
            else:
                # Service not running - extensions are unloaded
                return "unloaded"
        else:
            return "disabled"

    def _get_activation_mode(self, ext_id: str) -> str:
        """Get the activation mode for an extension from its manifest."""
        ext_name = f"steamos-extension-{ext_id}"
        manifest_path = os.path.join(
            self.bundled_extensions_dir, f"{ext_name}.yaml"
        )
        try:
            if self.sys.file_exists(manifest_path):
                content = self.sys.read_file(manifest_path)
                manifest = yaml.safe_load(content)
                return manifest.get("activation", {}).get("mode", "reboot")
        except Exception as e:
            self._log("warning", f"Error reading manifest for {ext_id}: {e}")
        return "reboot"

    def _count_raw_files(self) -> int:
        """Count .raw files in the extensions directory."""
        if not self.sys.dir_exists(EXTENSIONS_DIR):
            return 0
        files = self.sys.list_dir(EXTENSIONS_DIR)
        return len([f for f in files if f.endswith(".raw")])

    async def get_extensions(self) -> List[Dict[str, Any]]:
        """Get all available extensions with their manifests and status."""
        extensions = []

        await self.refresh_active_extensions()

        if not self.sys.dir_exists(self.bundled_extensions_dir):
            self._log(
                "warning",
                f"Bundled extensions dir not found: {self.bundled_extensions_dir}"
            )
            return extensions

        for filename in self.sys.list_dir(self.bundled_extensions_dir):
            if not filename.endswith(".yaml"):
                continue

            manifest_path = os.path.join(self.bundled_extensions_dir, filename)
            try:
                content = self.sys.read_file(manifest_path)
                manifest = yaml.safe_load(content)

                ext_id = manifest.get("id", filename.replace(".yaml", ""))
                ext_name = filename.replace(".yaml", "")
                raw_filename = f"steamos-extension-{ext_id}.raw"
                status = self._get_extension_status(ext_id)

                # Check if update-manager script exists
                has_update_manager = False
                if manifest.get("update_manager", {}).get("script"):
                    script_path = os.path.join(
                        self.bundled_extensions_dir, f"steamos-extension-{ext_id}.update-manager"
                    )
                    has_update_manager = self.sys.is_executable(script_path)

                # Read README if available
                readme_path = os.path.join(self.bundled_extensions_dir, f"{ext_name}.readme")
                readme = ""
                if self.sys.file_exists(readme_path):
                    try:
                        readme = self.sys.read_file(readme_path)
                    except Exception as e:
                        self._log("warning", f"Error reading README for {ext_name}: {e}")

                # Check if bundled .raw differs from installed .raw
                bundled_raw_path = os.path.join(self.bundled_extensions_dir, raw_filename)
                installed_raw_path = os.path.join(EXTENSIONS_DIR, raw_filename)
                bundled_update_available = False
                if (self.sys.file_exists(bundled_raw_path) and
                        self.sys.file_exists(installed_raw_path)):
                    try:
                        bundled_update_available = (
                            self.sys.file_hash(bundled_raw_path) !=
                            self.sys.file_hash(installed_raw_path)
                        )
                    except Exception as e:
                        self._log("warning", f"Could not compare .raw hashes for {ext_id}: {e}")

                extensions.append({
                    "manifest": manifest,
                    "enabled": status != "disabled",
                    "status": status,
                    "raw_file": raw_filename,
                    "readme": readme,
                    "has_update_manager": has_update_manager,
                    "bundled_update_available": bundled_update_available,
                })
            except Exception as e:
                self._log("error", f"Error loading manifest {filename}: {e}")

        return extensions

    async def get_extension_status(self, ext_id: str) -> Dict[str, Any]:
        """Get status of a specific extension."""
        raw_filename = f"steamos-extension-{ext_id}.raw"
        enabled = self.sys.file_exists(os.path.join(EXTENSIONS_DIR, raw_filename))

        return {
            "enabled": enabled,
            "raw_file": raw_filename,
        }

    async def enable_extension(self, ext_id: str) -> Dict[str, Any]:
        """Enable an extension by copying its .raw file to /var/lib/extensions/."""
        raw_filename = f"steamos-extension-{ext_id}.raw"
        source = os.path.join(self.bundled_extensions_dir, raw_filename)
        dest = os.path.join(EXTENSIONS_DIR, raw_filename)

        if not self.sys.file_exists(source):
            return {"success": False, "error": f"Extension file not found: {source}"}

        try:
            # Ensure extensions directory exists
            self.sys.make_dirs(EXTENSIONS_DIR)

            # Copy the extension file
            self.sys.copy_file(source, dest)

            # If enabling the loader, ensure systemd-sysext is enabled
            if ext_id == "loader":
                result = self.sys.systemctl_enable("systemd-sysext")
                if result.success:
                    self._log("info", "Enabled systemd-sysext service")
                else:
                    self._log("warning", f"Failed to enable systemd-sysext: {result.stderr}")

            # Check activation mode
            activation_mode = self._get_activation_mode(ext_id)
            needs_reboot = True

            if activation_mode in ("auto", "hot-reload"):
                result = self.sys.sysext_refresh()
                if result.success:
                    await self.refresh_active_extensions()
                    needs_reboot = False
                    self._log("info", f"Extension {ext_id} activated via hot-reload")
                else:
                    self._log("warning", f"sysext refresh failed, reboot required: {result.stderr}")
                    needs_reboot = True
            else:
                # Mode is "reboot" - try refresh but always require reboot
                self.sys.sysext_refresh()

            return {"success": True, "needs_reboot": needs_reboot}
        except Exception as e:
            self._log("error", f"Error enabling extension {ext_id}: {e}")
            return {"success": False, "error": str(e)}

    async def update_extension(self, ext_id: str) -> Dict[str, Any]:
        """Update an installed extension by copying the bundled .raw over the installed one."""
        raw_filename = f"steamos-extension-{ext_id}.raw"
        source = os.path.join(self.bundled_extensions_dir, raw_filename)
        dest = os.path.join(EXTENSIONS_DIR, raw_filename)

        if not self.sys.file_exists(source):
            return {"success": False, "error": f"Bundled extension file not found: {source}"}
        if not self.sys.file_exists(dest):
            return {"success": False, "error": "Extension is not installed; use enable instead"}

        try:
            self.sys.copy_file(source, dest)

            activation_mode = self._get_activation_mode(ext_id)
            needs_reboot = True

            if activation_mode in ("auto", "hot-reload"):
                result = self.sys.sysext_refresh()
                if result.success:
                    await self.refresh_active_extensions()
                    needs_reboot = False
                    self._log("info", f"Extension {ext_id} updated and hot-reloaded")
                else:
                    self._log("warning", f"sysext refresh failed after update: {result.stderr}")
                    needs_reboot = True
            else:
                self.sys.sysext_refresh()

            return {"success": True, "needs_reboot": needs_reboot}
        except Exception as e:
            self._log("error", f"Error updating extension {ext_id}: {e}")
            return {"success": False, "error": str(e)}

    async def disable_extension(
        self,
        ext_id: str,
        prompt_answers: Optional[Dict[str, bool]] = None
    ) -> Dict[str, Any]:
        """Disable an extension by removing its .raw file and running uninstall script."""
        raw_filename = f"steamos-extension-{ext_id}.raw"
        raw_path = os.path.join(EXTENSIONS_DIR, raw_filename)

        # Find the extension's uninstall script
        uninstall_script = os.path.join(
            self.bundled_extensions_dir, f"steamos-extension-{ext_id}.uninstall"
        )

        try:
            # Run uninstall script if it exists
            if self.sys.file_exists(uninstall_script):
                args = [uninstall_script]
                if prompt_answers:
                    for key, value in prompt_answers.items():
                        args.append(f"--{key}={'true' if value else 'false'}")

                result = self.sys.run_command(args, timeout=300)
                if not result.success:
                    self._log("warning", f"Uninstall script returned {result.returncode}: {result.stderr}")

            # Remove the extension file
            if self.sys.file_exists(raw_path):
                self.sys.remove_file(raw_path)

            # If disabling the loader and no other extensions exist, disable systemd-sysext
            if ext_id == "loader" and self._count_raw_files() == 0:
                result = self.sys.systemctl_disable("systemd-sysext")
                if result.success:
                    self._log("info", "Disabled systemd-sysext service (no extensions remaining)")
                else:
                    self._log("warning", f"Failed to disable systemd-sysext: {result.stderr}")

            # Check activation mode
            activation_mode = self._get_activation_mode(ext_id)
            needs_reboot = True

            if activation_mode in ("auto", "hot-reload"):
                result = self.sys.sysext_refresh()
                if result.success:
                    await self.refresh_active_extensions()
                    needs_reboot = False
                    self._log("info", f"Extension {ext_id} deactivated via hot-reload")
                else:
                    self._log("warning", f"sysext refresh failed, reboot required: {result.stderr}")
                    needs_reboot = True
            else:
                self.sys.sysext_refresh()

            return {"success": True, "needs_reboot": needs_reboot}
        except Exception as e:
            self._log("error", f"Error disabling extension {ext_id}: {e}")
            return {"success": False, "error": str(e)}

    async def get_config(self, ext_id: str) -> Dict[str, Any]:
        """Get current configuration values for an extension."""
        manifest_path = os.path.join(
            self.bundled_extensions_dir, f"steamos-extension-{ext_id}.yaml"
        )

        if not self.sys.file_exists(manifest_path):
            return {"error": "Manifest not found"}

        try:
            content = self.sys.read_file(manifest_path)
            manifest = yaml.safe_load(content)

            config_section = manifest.get("config")
            if not config_section:
                return {"values": {}}

            config_path = config_section.get("path")
            if not config_path or not self.sys.file_exists(config_path):
                # Return defaults from manifest
                defaults = {}
                for param in config_section.get("parameters", []):
                    defaults[param["id"]] = param.get("default")
                return {"values": defaults}

            # Build a map of parameter types and units
            param_types = {}
            param_units = {}
            for param in config_section.get("parameters", []):
                param_types[param["id"]] = param.get("type", "string")
                param_units[param["id"]] = param.get("unit", "")

            # Parse config file (key=value format)
            values = {}
            config_content = self.sys.read_file(config_path)
            for line in config_content.split("\n"):
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip().strip('"')
                    # Convert value based on parameter type
                    param_type = param_types.get(key, "string")
                    if param_type == "boolean":
                        values[key] = value.lower() in ("true", "1", "yes")
                    elif param_type in ("integer", "duration"):
                        try:
                            # For duration/integer types, strip unit suffix before parsing
                            # e.g. "60min" -> 60, "20GB" -> 20
                            unit = param_units.get(key, "")
                            if unit and value.endswith(unit):
                                numeric_value = value[:-len(unit)].strip()
                                values[key] = int(numeric_value)
                            else:
                                values[key] = int(value)
                        except ValueError:
                            values[key] = value
                    else:
                        values[key] = value

            # Merge with defaults for missing values
            for param in config_section.get("parameters", []):
                if param["id"] not in values:
                    values[param["id"]] = param.get("default")

            return {"values": values}
        except Exception as e:
            self._log("error", f"Error getting config for {ext_id}: {e}")
            return {"error": str(e)}

    async def configure_extension(
        self,
        ext_id: str,
        config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update configuration for an extension."""
        configure_script = os.path.join(
            self.bundled_extensions_dir, f"steamos-extension-{ext_id}.configure"
        )

        if not self.sys.file_exists(configure_script):
            return {"success": False, "error": "Configure script not found"}

        try:
            args = [configure_script]
            for key, value in config.items():
                # Convert booleans to lowercase strings for shell script consistency
                if isinstance(value, bool):
                    value = "true" if value else "false"
                args.append(f"--{key}={value}")

            result = self.sys.run_command(args, timeout=60)

            if not result.success:
                return {"success": False, "error": result.stderr}

            return {"success": True, "output": result.stdout}
        except Exception as e:
            self._log("error", f"Error configuring extension {ext_id}: {e}")
            return {"success": False, "error": str(e)}

    async def run_update_manager(self, ext_id: str, flag: str) -> Dict[str, Any]:
        """Run the update-manager script for an extension with the given flag."""
        allowed_flags = {"--get-current-version", "--get-latest-version", "--update"}
        if flag not in allowed_flags:
            return {"success": False, "error": f"Invalid flag: {flag}"}

        manifest_path = os.path.join(
            self.bundled_extensions_dir, f"steamos-extension-{ext_id}.yaml"
        )
        if not self.sys.file_exists(manifest_path):
            return {"success": False, "error": "Manifest not found"}

        try:
            content = self.sys.read_file(manifest_path)
            manifest = yaml.safe_load(content)

            update_manager_section = manifest.get("update_manager")
            if not update_manager_section:
                return {"success": False, "error": "Extension has no update_manager configured"}

            script_path = os.path.join(
                self.bundled_extensions_dir, f"steamos-extension-{ext_id}.update-manager"
            )

            if not self.sys.file_exists(script_path):
                return {"success": False, "error": f"update-manager script not found: {script_path}"}

            # For --get-latest-version, check cache before invoking the script
            if flag == "--get-latest-version":
                cache_file = os.path.join(self.update_cache_dir, f"{ext_id}.json")
                now = time.time()
                if self.sys.file_exists(cache_file):
                    try:
                        cache_content = self.sys.read_file(cache_file)
                        cache = json.loads(cache_content)
                        if now - cache.get("timestamp", 0) < UPDATE_CACHE_MAX_AGE:
                            self._log("debug", f"Using cached latest version for {ext_id}: {cache['version']}")
                            return {"success": True, "output": cache["version"]}
                    except Exception as e:
                        self._log("warning", f"Could not read version cache for {ext_id}: {e}")

            # Timeouts vary by operation
            timeout = 300 if flag == "--update" else (15 if flag == "--get-latest-version" else 5)

            result = self.sys.run_command([script_path, flag], timeout=timeout)

            output = result.stdout.strip()
            if not result.success:
                return {"success": False, "output": output, "error": result.stderr.strip()}

            # Cache the result of --get-latest-version
            if flag == "--get-latest-version" and output:
                try:
                    self.sys.make_dirs(self.update_cache_dir)
                    cache_file = os.path.join(self.update_cache_dir, f"{ext_id}.json")
                    cache_content = json.dumps({"timestamp": time.time(), "version": output})
                    self.sys.write_file(cache_file, cache_content)
                except Exception as e:
                    self._log("warning", f"Could not write version cache for {ext_id}: {e}")

            # Invalidate the latest-version cache after a successful update
            if flag == "--update":
                try:
                    cache_file = os.path.join(self.update_cache_dir, f"{ext_id}.json")
                    if self.sys.file_exists(cache_file):
                        self.sys.remove_file(cache_file)
                except Exception:
                    pass

            return {"success": True, "output": output}
        except Exception as e:
            self._log("error", f"Error running update-manager for {ext_id}: {e}")
            return {"success": False, "output": "", "error": str(e)}

    async def reboot(self) -> Dict[str, Any]:
        """Trigger system reboot."""
        try:
            result = self.sys.reboot()
            if result.success:
                return {"success": True}
            else:
                return {"success": False, "error": result.stderr}
        except Exception as e:
            self._log("error", f"Error triggering reboot: {e}")
            return {"success": False, "error": str(e)}

    def get_sysext_status(self) -> Dict[str, Any]:
        """Get the status of the systemd-sysext service."""
        is_active = self.sys.systemctl_is_active("systemd-sysext")
        return {
            "active": is_active,
            "status": "active" if is_active else "inactive"
        }

    async def enable_sysext(self) -> Dict[str, Any]:
        """Enable and start the systemd-sysext service."""
        try:
            result = self.sys.systemctl_enable("systemd-sysext")
            if result.success:
                await self.refresh_active_extensions()
                self._log("info", "Enabled systemd-sysext service")
                return {"success": True}
            else:
                self._log("error", f"Failed to enable systemd-sysext: {result.stderr}")
                return {"success": False, "error": result.stderr}
        except Exception as e:
            self._log("error", f"Error enabling systemd-sysext: {e}")
            return {"success": False, "error": str(e)}
