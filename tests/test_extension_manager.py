"""Unit tests for ExtensionManager."""

import pytest
from src.backend.paths import EXTENSIONS_DIR


@pytest.mark.asyncio
class TestEnableLoader:
    """Tests for enabling the loader extension."""

    async def test_enables_sysext_service(self, manager, mock_sys, plugin_dir):
        """Enabling loader should enable systemd-sysext service."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("loader", plugin_dir)

        result = await manager.enable_extension("loader")

        assert result["success"]
        assert mock_sys.systemctl_enable_called_with("systemd-sysext")

    async def test_copies_raw_file(self, manager, mock_sys, plugin_dir):
        """Enabling extension should copy .raw file to extensions dir."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("loader", plugin_dir)

        await manager.enable_extension("loader")

        assert mock_sys.file_exists(f"{EXTENSIONS_DIR}/steamos-extension-loader.raw")

    async def test_returns_needs_reboot_for_reboot_mode(self, manager, mock_sys, plugin_dir):
        """Reboot mode extension should indicate reboot needed."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("loader", plugin_dir)

        result = await manager.enable_extension("loader")

        assert result["success"]
        assert result["needs_reboot"] is True

    async def test_fails_when_raw_not_found(self, manager, mock_sys, plugin_dir):
        """Should fail gracefully when .raw file doesn't exist."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        # Note: NOT adding bundled raw file

        result = await manager.enable_extension("loader")

        assert not result["success"]
        assert "not found" in result["error"]


@pytest.mark.asyncio
class TestEnableRegularExtension:
    """Tests for enabling non-loader extensions."""

    async def test_does_not_enable_sysext_service(self, manager, mock_sys, plugin_dir):
        """Non-loader extensions should not enable systemd-sysext service."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale VPN",
            "activation": {"mode": "auto"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("tailscale", plugin_dir)

        await manager.enable_extension("tailscale")

        assert not mock_sys.systemctl_enable_called_with("systemd-sysext")

    async def test_hot_reload_mode_no_reboot(self, manager, mock_sys, plugin_dir):
        """Auto/hot-reload mode should not require reboot if refresh succeeds."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale VPN",
            "activation": {"mode": "auto"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("tailscale", plugin_dir)

        result = await manager.enable_extension("tailscale")

        assert result["success"]
        assert result["needs_reboot"] is False

    async def test_hot_reload_fails_needs_reboot(self, manager, mock_sys, plugin_dir):
        """If sysext refresh fails, should indicate reboot needed."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale VPN",
            "activation": {"mode": "auto"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("tailscale", plugin_dir)
        mock_sys.set_sysext_refresh_fails(True)

        result = await manager.enable_extension("tailscale")

        assert result["success"]
        assert result["needs_reboot"] is True


@pytest.mark.asyncio
class TestDisableLoader:
    """Tests for disabling the loader extension."""

    async def test_disables_sysext_when_no_other_extensions(self, manager, mock_sys, plugin_dir):
        """Should disable systemd-sysext when loader is last extension."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_installed_raw("loader")

        await manager.disable_extension("loader")

        assert mock_sys.systemctl_disable_called_with("systemd-sysext")

    async def test_keeps_sysext_when_other_extensions_exist(self, manager, mock_sys, plugin_dir):
        """Should NOT disable systemd-sysext when other extensions remain."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_installed_raw("loader")
        mock_sys.add_installed_raw("tailscale")  # Another extension exists

        await manager.disable_extension("loader")

        assert not mock_sys.systemctl_disable_called_with("systemd-sysext")

    async def test_removes_raw_file(self, manager, mock_sys, plugin_dir):
        """Should remove the .raw file when disabling."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_installed_raw("loader")

        await manager.disable_extension("loader")

        assert f"{EXTENSIONS_DIR}/steamos-extension-loader.raw" in mock_sys.files_removed


@pytest.mark.asyncio
class TestDisableRegularExtension:
    """Tests for disabling non-loader extensions."""

    async def test_runs_uninstall_script(self, manager, mock_sys, plugin_dir):
        """Should run uninstall script if it exists."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale VPN",
            "activation": {"mode": "auto"}
        }, plugin_dir)
        mock_sys.add_installed_raw("tailscale")
        mock_sys.add_uninstall_script("tailscale", plugin_dir)

        await manager.disable_extension("tailscale")

        # Check that the uninstall script was called
        uninstall_calls = [
            cmd for cmd in mock_sys.commands_run
            if "uninstall" in str(cmd)
        ]
        assert len(uninstall_calls) > 0

    async def test_does_not_disable_sysext_service(self, manager, mock_sys, plugin_dir):
        """Non-loader extensions should never disable systemd-sysext."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale VPN",
            "activation": {"mode": "auto"}
        }, plugin_dir)
        mock_sys.add_installed_raw("tailscale")

        await manager.disable_extension("tailscale")

        assert not mock_sys.systemctl_disable_called_with("systemd-sysext")


@pytest.mark.asyncio
class TestGetExtensions:
    """Tests for listing extensions."""

    async def test_returns_installed_extension_as_active(self, manager, mock_sys, plugin_dir):
        """Installed and active extension should have 'active' status."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("loader", plugin_dir)
        mock_sys.add_installed_raw("loader")
        mock_sys.set_active_extensions(["steamos-extension-loader"])

        extensions = await manager.get_extensions()

        loader = next(e for e in extensions if e["manifest"]["id"] == "loader")
        assert loader["status"] == "active"
        assert loader["enabled"] is True

    async def test_returns_installed_not_active_as_pending(self, manager, mock_sys, plugin_dir):
        """Installed but not active extension should have 'pending' status."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("loader", plugin_dir)
        mock_sys.add_installed_raw("loader")
        # Note: NOT setting as active

        extensions = await manager.get_extensions()

        loader = next(e for e in extensions if e["manifest"]["id"] == "loader")
        assert loader["status"] == "pending"
        assert loader["enabled"] is True

    async def test_returns_not_installed_as_disabled(self, manager, mock_sys, plugin_dir):
        """Not installed extension should have 'disabled' status."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("loader", plugin_dir)
        # Note: NOT adding installed raw

        extensions = await manager.get_extensions()

        loader = next(e for e in extensions if e["manifest"]["id"] == "loader")
        assert loader["status"] == "disabled"
        assert loader["enabled"] is False


@pytest.mark.asyncio
class TestUpdateExtension:
    """Tests for updating extensions."""

    async def test_copies_bundled_over_installed(self, manager, mock_sys, plugin_dir):
        """Should copy bundled .raw over installed .raw."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("loader", plugin_dir)
        mock_sys.add_installed_raw("loader")

        result = await manager.update_extension("loader")

        assert result["success"]
        # Check that copy was called
        copies = [c for c in mock_sys.files_copied if "loader.raw" in c[1]]
        assert len(copies) > 0

    async def test_fails_if_not_installed(self, manager, mock_sys, plugin_dir):
        """Should fail if extension is not installed."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "activation": {"mode": "reboot"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("loader", plugin_dir)
        # Note: NOT adding installed raw

        result = await manager.update_extension("loader")

        assert not result["success"]
        assert "not installed" in result["error"]
