import os
import sys
import subprocess
import time
import json
import hashlib

# Add bundled dependencies to path
PLUGIN_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, os.path.join(PLUGIN_DIR, "py_modules"))

import yaml
import decky

# Paths
EXTENSIONS_DIR = "/var/lib/extensions"
BUNDLED_EXTENSIONS_DIR = os.path.join(PLUGIN_DIR, "dist", "extensions")
UPDATE_CACHE_DIR = os.path.join(PLUGIN_DIR, "cache", "update-manager")
UPDATE_CACHE_MAX_AGE = 86400  # 24 hours


class Plugin:
    def __init__(self):
        self._active_extensions = set()

    async def _main(self):
        decky.logger.info("SteamOS Extensions plugin loaded")
        await self._refresh_active_extensions()

    async def _unload(self):
        decky.logger.info("SteamOS Extensions plugin unloaded")

    async def _refresh_active_extensions(self):
        """Get list of extensions currently active via systemd-sysext."""
        self._active_extensions = set()
        try:
            # Parse text output from systemd-sysext list
            # Output format:
            # NAME                                    TYPE PATH
            # steamos-extension-loader                raw  /var/lib/extensions/...
            result = subprocess.run(
                ["sudo", "systemd-sysext", "list", "--no-legend"],
                capture_output=True, text=True, timeout=10
            )
            decky.logger.info(f"systemd-sysext list output: {result.stdout!r}")
            if result.returncode == 0:
                for line in result.stdout.strip().split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    # NAME column is first, space-separated
                    parts = line.split()
                    if parts:
                        ext_name = parts[0]
                        if ext_name.startswith("steamos-extension-"):
                            self._active_extensions.add(ext_name)
                            decky.logger.debug(f"Found active extension: {ext_name}")
                decky.logger.info(f"Active extensions: {self._active_extensions}")
            else:
                decky.logger.warning(f"systemd-sysext list failed (rc={result.returncode}): {result.stderr}")
        except Exception as e:
            decky.logger.warning(f"Failed to get active extensions: {e}")

    @staticmethod
    def _sha256(path: str) -> str:
        """Return hex SHA256 of a file."""
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    def _get_extension_status(self, ext_id: str) -> str:
        """Get status: active, pending, or disabled."""
        ext_name = f"steamos-extension-{ext_id}"
        raw_filename = f"{ext_name}.raw"
        raw_path = os.path.join(EXTENSIONS_DIR, raw_filename)
        raw_exists = os.path.isfile(raw_path)
        is_active = ext_name in self._active_extensions

        decky.logger.info(f"Status check for '{ext_id}': ext_name='{ext_name}', raw_path='{raw_path}', raw_exists={raw_exists}, is_active={is_active}, active_set={self._active_extensions}")

        if raw_exists and is_active:
            return "active"
        elif raw_exists:
            return "pending"
        else:
            return "disabled"

    async def get_extensions(self) -> list:
        """Get all available extensions with their manifests and status."""
        extensions = []

        # Refresh active extensions list
        await self._refresh_active_extensions()

        # Scan bundled extensions
        if not os.path.isdir(BUNDLED_EXTENSIONS_DIR):
            decky.logger.warning(f"Bundled extensions dir not found: {BUNDLED_EXTENSIONS_DIR}")
            return extensions

        for filename in os.listdir(BUNDLED_EXTENSIONS_DIR):
            if filename.endswith(".yaml"):
                manifest_path = os.path.join(BUNDLED_EXTENSIONS_DIR, filename)
                try:
                    with open(manifest_path, "r") as f:
                        manifest = yaml.safe_load(f)

                    ext_id = manifest.get("id", filename.replace(".yaml", ""))
                    ext_name = filename.replace(".yaml", "")
                    raw_filename = f"steamos-extension-{ext_id}.raw"
                    status = self._get_extension_status(ext_id)

                    # Check if update-manager script exists
                    ext_dir = os.path.join(PLUGIN_DIR, f"steamos-extension-{ext_id}")
                    update_manager_script = manifest.get("update_manager", {}).get("script", "")
                    has_update_manager = False
                    if update_manager_script:
                        script_path = os.path.join(ext_dir, update_manager_script.lstrip("./"))
                        has_update_manager = os.path.isfile(script_path) and os.access(script_path, os.X_OK)

                    # Read README if available
                    readme_path = os.path.join(BUNDLED_EXTENSIONS_DIR, f"{ext_name}.readme")
                    readme = ""
                    if os.path.isfile(readme_path):
                        try:
                            with open(readme_path, "r") as f:
                                readme = f.read()
                        except Exception as e:
                            decky.logger.warning(f"Error reading README for {ext_name}: {e}")

                    # Check if bundled .raw differs from installed .raw (extension itself needs updating)
                    bundled_raw_path = os.path.join(BUNDLED_EXTENSIONS_DIR, raw_filename)
                    installed_raw_path = os.path.join(EXTENSIONS_DIR, raw_filename)
                    bundled_update_available = False
                    if os.path.isfile(bundled_raw_path) and os.path.isfile(installed_raw_path):
                        try:
                            bundled_update_available = (
                                self._sha256(bundled_raw_path) != self._sha256(installed_raw_path)
                            )
                        except Exception as e:
                            decky.logger.warning(f"Could not compare .raw hashes for {ext_id}: {e}")

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
                    decky.logger.error(f"Error loading manifest {filename}: {e}")

        return extensions

    async def get_extension_status(self, ext_id: str) -> dict:
        """Get status of a specific extension."""
        raw_filename = f"steamos-extension-{ext_id}.raw"
        enabled = os.path.isfile(os.path.join(EXTENSIONS_DIR, raw_filename))

        return {
            "enabled": enabled,
            "raw_file": raw_filename,
        }

    def _get_activation_mode(self, ext_id: str) -> str:
        """Get the activation mode for an extension from its manifest."""
        ext_name = f"steamos-extension-{ext_id}"
        manifest_path = os.path.join(BUNDLED_EXTENSIONS_DIR, f"{ext_name}.yaml")
        try:
            if os.path.isfile(manifest_path):
                with open(manifest_path, "r") as f:
                    manifest = yaml.safe_load(f)
                    return manifest.get("activation", {}).get("mode", "reboot")
        except Exception as e:
            decky.logger.warning(f"Error reading manifest for {ext_id}: {e}")
        return "reboot"  # Default to requiring reboot

    async def enable_extension(self, ext_id: str) -> dict:
        """Enable an extension by copying its .raw file to /var/lib/extensions/."""
        raw_filename = f"steamos-extension-{ext_id}.raw"
        source = os.path.join(BUNDLED_EXTENSIONS_DIR, raw_filename)
        dest = os.path.join(EXTENSIONS_DIR, raw_filename)

        if not os.path.isfile(source):
            return {"success": False, "error": f"Extension file not found: {source}"}

        try:
            # Ensure extensions directory exists
            os.makedirs(EXTENSIONS_DIR, exist_ok=True)

            # Copy the extension file
            subprocess.run(["cp", source, dest], check=True)

            # Check activation mode
            activation_mode = self._get_activation_mode(ext_id)
            needs_reboot = True

            if activation_mode in ("auto", "hot-reload"):
                # Try to refresh sysext - if successful, no reboot needed
                try:
                    subprocess.run(["sudo", "systemd-sysext", "refresh"], check=True, timeout=30)
                    await self._refresh_active_extensions()
                    needs_reboot = False
                    decky.logger.info(f"Extension {ext_id} activated via hot-reload")
                except Exception as e:
                    decky.logger.warning(f"sysext refresh failed, reboot required: {e}")
                    needs_reboot = True
            else:
                # Mode is "reboot" - try refresh but always require reboot
                try:
                    subprocess.run(["sudo", "systemd-sysext", "refresh"], check=True, timeout=30)
                except Exception as e:
                    decky.logger.warning(f"sysext refresh failed: {e}")

            return {"success": True, "needs_reboot": needs_reboot}
        except Exception as e:
            decky.logger.error(f"Error enabling extension {ext_id}: {e}")
            return {"success": False, "error": str(e)}

    async def update_extension(self, ext_id: str) -> dict:
        """Update an installed extension by copying the bundled .raw over the installed one and refreshing sysext."""
        raw_filename = f"steamos-extension-{ext_id}.raw"
        source = os.path.join(BUNDLED_EXTENSIONS_DIR, raw_filename)
        dest = os.path.join(EXTENSIONS_DIR, raw_filename)

        if not os.path.isfile(source):
            return {"success": False, "error": f"Bundled extension file not found: {source}"}
        if not os.path.isfile(dest):
            return {"success": False, "error": "Extension is not installed; use enable instead"}

        try:
            subprocess.run(["cp", source, dest], check=True)

            activation_mode = self._get_activation_mode(ext_id)
            needs_reboot = True

            if activation_mode in ("auto", "hot-reload"):
                try:
                    subprocess.run(["sudo", "systemd-sysext", "refresh"], check=True, timeout=30)
                    await self._refresh_active_extensions()
                    needs_reboot = False
                    decky.logger.info(f"Extension {ext_id} updated and hot-reloaded")
                except Exception as e:
                    decky.logger.warning(f"sysext refresh failed after update, reboot required: {e}")
                    needs_reboot = True
            else:
                try:
                    subprocess.run(["sudo", "systemd-sysext", "refresh"], check=True, timeout=30)
                except Exception as e:
                    decky.logger.warning(f"sysext refresh failed: {e}")

            return {"success": True, "needs_reboot": needs_reboot}
        except Exception as e:
            decky.logger.error(f"Error updating extension {ext_id}: {e}")
            return {"success": False, "error": str(e)}

    async def disable_extension(self, ext_id: str, prompt_answers: dict = None) -> dict:
        """Disable an extension by removing its .raw file and running uninstall script."""
        raw_filename = f"steamos-extension-{ext_id}.raw"
        raw_path = os.path.join(EXTENSIONS_DIR, raw_filename)

        # Find the extension's uninstall script
        ext_dir = os.path.join(PLUGIN_DIR, f"steamos-extension-{ext_id}")
        uninstall_script = os.path.join(ext_dir, "uninstall")

        try:
            # Run uninstall script if it exists and we have prompt answers
            if os.path.isfile(uninstall_script) and prompt_answers:
                args = [uninstall_script]
                for key, value in prompt_answers.items():
                    args.append(f"--{key}={'true' if value else 'false'}")

                decky.logger.info(f"Running uninstall script: {' '.join(args)}")
                result = subprocess.run(args, capture_output=True, text=True, timeout=300)
                if result.returncode != 0:
                    decky.logger.warning(f"Uninstall script returned {result.returncode}: {result.stderr}")

            # Remove the extension file
            if os.path.isfile(raw_path):
                os.remove(raw_path)

            # Check activation mode
            activation_mode = self._get_activation_mode(ext_id)
            needs_reboot = True

            if activation_mode in ("auto", "hot-reload"):
                # Try to refresh sysext - if successful, no reboot needed
                try:
                    subprocess.run(["sudo", "systemd-sysext", "refresh"], check=True, timeout=30)
                    await self._refresh_active_extensions()
                    needs_reboot = False
                    decky.logger.info(f"Extension {ext_id} deactivated via hot-reload")
                except Exception as e:
                    decky.logger.warning(f"sysext refresh failed, reboot required: {e}")
                    needs_reboot = True
            else:
                # Mode is "reboot" - try refresh but always require reboot
                try:
                    subprocess.run(["sudo", "systemd-sysext", "refresh"], check=True, timeout=30)
                except Exception as e:
                    decky.logger.warning(f"sysext refresh failed: {e}")

            return {"success": True, "needs_reboot": needs_reboot}
        except Exception as e:
            decky.logger.error(f"Error disabling extension {ext_id}: {e}")
            return {"success": False, "error": str(e)}

    async def get_config(self, ext_id: str) -> dict:
        """Get current configuration values for an extension."""
        # Load manifest to get config path
        manifest_path = os.path.join(BUNDLED_EXTENSIONS_DIR, f"steamos-extension-{ext_id}.yaml")

        if not os.path.isfile(manifest_path):
            return {"error": "Manifest not found"}

        try:
            with open(manifest_path, "r") as f:
                manifest = yaml.safe_load(f)

            config_section = manifest.get("config")
            if not config_section:
                return {"values": {}}

            config_path = config_section.get("path")
            if not config_path or not os.path.isfile(config_path):
                # Return defaults from manifest
                defaults = {}
                for param in config_section.get("parameters", []):
                    defaults[param["id"]] = param.get("default")
                return {"values": defaults}

            # Parse config file (key=value format)
            values = {}
            with open(config_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, value = line.split("=", 1)
                        key = key.strip()
                        value = value.strip().strip('"')
                        values[key] = value

            # Merge with defaults for missing values
            for param in config_section.get("parameters", []):
                if param["id"] not in values:
                    values[param["id"]] = param.get("default")

            return {"values": values}
        except Exception as e:
            decky.logger.error(f"Error getting config for {ext_id}: {e}")
            return {"error": str(e)}

    async def configure_extension(self, ext_id: str, config: dict) -> dict:
        """Update configuration for an extension."""
        ext_dir = os.path.join(PLUGIN_DIR, f"steamos-extension-{ext_id}")
        configure_script = os.path.join(ext_dir, "configure")

        if not os.path.isfile(configure_script):
            return {"success": False, "error": "Configure script not found"}

        try:
            # Build CLI arguments
            args = [configure_script]
            for key, value in config.items():
                args.append(f"--{key}={value}")

            decky.logger.info(f"Running configure script: {' '.join(args)}")
            result = subprocess.run(args, capture_output=True, text=True, timeout=60)

            if result.returncode != 0:
                return {"success": False, "error": result.stderr}

            return {"success": True, "output": result.stdout}
        except Exception as e:
            decky.logger.error(f"Error configuring extension {ext_id}: {e}")
            return {"success": False, "error": str(e)}

    async def run_update_manager(self, ext_id: str, flag: str) -> dict:
        """Run the update-manager script for an extension with the given flag.

        For --get-latest-version, results are cached for up to 24 hours so that
        extensions don't need to implement their own caching logic.
        """
        allowed_flags = {"--get-current-version", "--get-latest-version", "--update"}
        if flag not in allowed_flags:
            return {"success": False, "error": f"Invalid flag: {flag}"}

        manifest_path = os.path.join(BUNDLED_EXTENSIONS_DIR, f"steamos-extension-{ext_id}.yaml")
        if not os.path.isfile(manifest_path):
            return {"success": False, "error": "Manifest not found"}

        try:
            with open(manifest_path, "r") as f:
                manifest = yaml.safe_load(f)

            update_manager_section = manifest.get("update_manager")
            if not update_manager_section:
                return {"success": False, "error": "Extension has no update_manager configured"}

            script_rel = update_manager_section.get("script", "")
            ext_dir = os.path.join(PLUGIN_DIR, f"steamos-extension-{ext_id}")
            script_path = os.path.join(ext_dir, script_rel.lstrip("./"))

            if not os.path.isfile(script_path):
                return {"success": False, "error": f"update-manager script not found: {script_path}"}

            # For --get-latest-version, check cache before invoking the script
            if flag == "--get-latest-version":
                cache_file = os.path.join(UPDATE_CACHE_DIR, f"{ext_id}.json")
                now = time.time()
                if os.path.isfile(cache_file):
                    try:
                        with open(cache_file, "r") as f:
                            cache = json.load(f)
                        if now - cache.get("timestamp", 0) < UPDATE_CACHE_MAX_AGE:
                            decky.logger.debug(f"Using cached latest version for {ext_id}: {cache['version']}")
                            return {"success": True, "output": cache["version"]}
                    except Exception as e:
                        decky.logger.warning(f"Could not read version cache for {ext_id}: {e}")

            # Timeouts vary by operation
            timeout = 300 if flag == "--update" else (15 if flag == "--get-latest-version" else 5)

            decky.logger.info(f"Running update-manager for {ext_id}: {script_path} {flag}")
            result = subprocess.run(
                [script_path, flag],
                capture_output=True, text=True, timeout=timeout
            )

            output = result.stdout.strip()
            if result.returncode != 0:
                return {"success": False, "output": output, "error": result.stderr.strip()}

            # Cache the result of --get-latest-version
            if flag == "--get-latest-version" and output:
                try:
                    os.makedirs(UPDATE_CACHE_DIR, exist_ok=True)
                    cache_file = os.path.join(UPDATE_CACHE_DIR, f"{ext_id}.json")
                    with open(cache_file, "w") as f:
                        json.dump({"timestamp": time.time(), "version": output}, f)
                except Exception as e:
                    decky.logger.warning(f"Could not write version cache for {ext_id}: {e}")

            # Invalidate the latest-version cache after a successful update
            if flag == "--update":
                try:
                    cache_file = os.path.join(UPDATE_CACHE_DIR, f"{ext_id}.json")
                    if os.path.isfile(cache_file):
                        os.remove(cache_file)
                except Exception:
                    pass

            return {"success": True, "output": output}
        except subprocess.TimeoutExpired:
            return {"success": False, "output": "", "error": "Timed out"}
        except Exception as e:
            decky.logger.error(f"Error running update-manager for {ext_id}: {e}")
            return {"success": False, "output": "", "error": str(e)}

    async def reboot(self) -> dict:
        try:
            subprocess.run(["sudo", "systemctl", "reboot"], check=True)
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Error triggering reboot: {e}")
            return {"success": False, "error": str(e)}
