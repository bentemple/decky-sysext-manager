import os
import sys
import subprocess

# Add bundled dependencies to path
PLUGIN_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, os.path.join(PLUGIN_DIR, "py_modules"))

import yaml
import decky

# Paths
EXTENSIONS_DIR = "/var/lib/extensions"
BUNDLED_EXTENSIONS_DIR = os.path.join(PLUGIN_DIR, "dist", "extensions")


class Plugin:
    _active_extensions: set = set()

    async def _main(self):
        decky.logger.info("SteamOS Extensions plugin loaded")
        await self._refresh_active_extensions()

    async def _unload(self):
        decky.logger.info("SteamOS Extensions plugin unloaded")

    async def _refresh_active_extensions(self):
        """Get list of extensions currently active via systemd-sysext."""
        try:
            result = subprocess.run(
                ["systemd-sysext", "list", "--json=short"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                import json
                data = json.loads(result.stdout)
                self._active_extensions = {ext.get("name", "") for ext in data}
            else:
                # Fallback: parse text output
                result = subprocess.run(
                    ["systemd-sysext", "list"],
                    capture_output=True, text=True, timeout=10
                )
                self._active_extensions = set()
                for line in result.stdout.strip().split("\n")[1:]:  # Skip header
                    parts = line.split()
                    if parts:
                        self._active_extensions.add(parts[0])
        except Exception as e:
            decky.logger.warning(f"Failed to get active extensions: {e}")
            self._active_extensions = set()

    def _get_extension_status(self, ext_id: str) -> str:
        """Get status: active, pending, or disabled."""
        raw_filename = f"steamos-extension-{ext_id}.raw"
        raw_exists = os.path.isfile(os.path.join(EXTENSIONS_DIR, raw_filename))
        is_active = f"steamos-extension-{ext_id}" in self._active_extensions

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
                    raw_filename = f"steamos-extension-{ext_id}.raw"
                    status = self._get_extension_status(ext_id)

                    extensions.append({
                        "manifest": manifest,
                        "enabled": status != "disabled",
                        "status": status,
                        "raw_file": raw_filename,
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

            # Try to refresh sysext
            try:
                subprocess.run(["systemd-sysext", "refresh"], check=True, timeout=30)
            except Exception as e:
                decky.logger.warning(f"sysext refresh failed (may need reboot): {e}")

            return {"success": True, "needs_reboot": True}
        except Exception as e:
            decky.logger.error(f"Error enabling extension {ext_id}: {e}")
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

            # Try to refresh sysext
            try:
                subprocess.run(["systemd-sysext", "refresh"], check=True, timeout=30)
            except Exception as e:
                decky.logger.warning(f"sysext refresh failed (may need reboot): {e}")

            return {"success": True, "needs_reboot": True}
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

    async def reboot(self) -> dict:
        """Trigger a system reboot."""
        try:
            subprocess.run(["systemctl", "reboot"], check=True)
            return {"success": True}
        except Exception as e:
            decky.logger.error(f"Error triggering reboot: {e}")
            return {"success": False, "error": str(e)}
