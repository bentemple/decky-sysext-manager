"""Decky plugin entry point for SteamOS Extensions.

This is a thin wrapper around ExtensionManager that provides the Decky
plugin interface. All business logic lives in backend/extension_manager.py.
"""

import os
import sys

# Add bundled dependencies and backend modules to path
PLUGIN_DIR = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, os.path.join(PLUGIN_DIR, "py_modules"))
sys.path.insert(0, PLUGIN_DIR)

import decky

from backend.system_ops import RealSystemOps
from backend.extension_manager import ExtensionManager


class Plugin:
    """Decky plugin class - delegates to ExtensionManager."""

    def __init__(self):
        self.manager = ExtensionManager(
            sys_ops=RealSystemOps(),
            plugin_dir=PLUGIN_DIR,
            logger=decky.logger
        )

    async def _main(self):
        decky.logger.info("SteamOS Extensions plugin loaded")
        await self.manager.refresh_active_extensions()

    async def _unload(self):
        decky.logger.info("SteamOS Extensions plugin unloaded")

    # Extension management

    async def get_extensions(self) -> list:
        """Get all available extensions with their manifests and status."""
        return await self.manager.get_extensions()

    async def get_extension_status(self, ext_id: str) -> dict:
        """Get status of a specific extension."""
        return await self.manager.get_extension_status(ext_id)

    async def enable_extension(self, ext_id: str) -> dict:
        """Enable an extension by copying its .raw file."""
        return await self.manager.enable_extension(ext_id)

    async def update_extension(self, ext_id: str) -> dict:
        """Update an installed extension."""
        return await self.manager.update_extension(ext_id)

    async def disable_extension(self, ext_id: str, prompt_answers: dict = None) -> dict:
        """Disable an extension by removing its .raw file."""
        return await self.manager.disable_extension(ext_id, prompt_answers)

    # Configuration

    async def get_config(self, ext_id: str) -> dict:
        """Get current configuration values for an extension."""
        return await self.manager.get_config(ext_id)

    async def configure_extension(self, ext_id: str, config: dict) -> dict:
        """Update configuration for an extension."""
        return await self.manager.configure_extension(ext_id, config)

    # Update management

    async def run_update_manager(self, ext_id: str, flag: str) -> dict:
        """Run the update-manager script for an extension."""
        return await self.manager.run_update_manager(ext_id, flag)

    # System operations

    async def reboot(self) -> dict:
        """Trigger system reboot."""
        return await self.manager.reboot()
