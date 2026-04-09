"""Unit tests for ExtensionManager."""

import pytest
from src.backend.paths import EXTENSIONS_DIR


@pytest.mark.asyncio
class TestUninstallScriptLocation:
    """Tests for uninstall script path handling."""

    async def test_uses_correct_uninstall_script_path(self, manager, mock_sys, plugin_dir):
        """Should look for uninstall script at dist/extensions/steamos-extension-{id}.uninstall."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension",
            "activation": {"mode": "auto"}
        }, plugin_dir)
        mock_sys.add_installed_raw("test-ext")

        # Add uninstall script at correct location (dist/extensions/)
        uninstall_path = f"{plugin_dir}/dist/extensions/steamos-extension-test-ext.uninstall"
        mock_sys.files[uninstall_path] = "#!/bin/bash\necho uninstalling"

        await manager.disable_extension("test-ext")

        # Verify the correct path was used
        uninstall_calls = [
            cmd for cmd in mock_sys.commands_run
            if "uninstall" in str(cmd)
        ]
        assert len(uninstall_calls) > 0


@pytest.mark.asyncio
class TestConfigPath:
    """Tests for configuration file paths."""

    async def test_config_path_uses_extension_name(self, manager, mock_sys, plugin_dir):
        """Config should be at /var/lib/extensions-config/{ext-name} not in subdirectory."""
        mock_sys.add_manifest("loader", {
            "id": "loader",
            "name": "Extension Loader",
            "config": {
                "path": "/var/lib/extensions-config/loader",
                "parameters": [
                    {"id": "auto_update", "type": "boolean", "default": True}
                ]
            }
        }, plugin_dir)

        # Create config at flat path
        mock_sys.files["/var/lib/extensions-config/loader"] = "auto_update=true"

        result = await manager.get_config("loader")

        assert "values" in result
        assert result["values"]["auto_update"] is True


@pytest.mark.asyncio
class TestConfigureExtension:
    """Tests for configuring extensions."""

    async def test_runs_configure_script_with_parameters(self, manager, mock_sys, plugin_dir):
        """Should run configure script with parameters as CLI args."""
        mock_sys.add_manifest("hibernate-after-sleep", {
            "id": "hibernate-after-sleep",
            "name": "Hibernate After Sleep",
            "config": {
                "path": "/var/lib/extensions-config/hibernate-after-sleep",
                "parameters": [
                    {"id": "HibernateDelaySec", "type": "duration", "default": 60},
                    {"id": "TargetSwapFileSizeInGbs", "type": "integer", "default": 20}
                ]
            },
            "configure": {"script": "./configure"}
        }, plugin_dir)

        # Add configure script
        configure_path = f"{plugin_dir}/dist/extensions/steamos-extension-hibernate-after-sleep.configure"
        mock_sys.files[configure_path] = "#!/bin/bash\necho configuring"

        config_values = {
            "HibernateDelaySec": 120,
            "TargetSwapFileSizeInGbs": 32
        }

        result = await manager.configure_extension("hibernate-after-sleep", config_values)

        assert result["success"]
        # Check that configure script was called with correct args
        configure_calls = [
            cmd for cmd in mock_sys.commands_run
            if "configure" in str(cmd)
        ]
        assert len(configure_calls) > 0
        # Verify parameters were passed
        call_str = str(configure_calls[0])
        assert "HibernateDelaySec=120" in call_str
        assert "TargetSwapFileSizeInGbs=32" in call_str

    async def test_converts_boolean_to_string(self, manager, mock_sys, plugin_dir):
        """Should convert boolean values to 'true'/'false' strings."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension",
            "configure": {"script": "./configure"}
        }, plugin_dir)

        configure_path = f"{plugin_dir}/dist/extensions/steamos-extension-test-ext.configure"
        mock_sys.files[configure_path] = "#!/bin/bash\necho configuring"

        config_values = {
            "enable_feature": True,
            "disable_other": False
        }

        result = await manager.configure_extension("test-ext", config_values)

        assert result["success"]
        call_str = str(mock_sys.commands_run[-1])
        assert "enable_feature=true" in call_str.lower()
        assert "disable_other=false" in call_str.lower()

    async def test_fails_when_configure_script_not_found(self, manager, mock_sys, plugin_dir):
        """Should fail gracefully when configure script doesn't exist."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension",
            "configure": {"script": "./configure"}
        }, plugin_dir)
        # Note: NOT adding configure script

        result = await manager.configure_extension("test-ext", {"param": "value"})

        assert not result["success"]
        assert "not found" in result["error"].lower()


@pytest.mark.asyncio
class TestConfigParsing:
    """Tests for configuration parsing with unit handling."""

    async def test_parses_duration_with_unit_suffix(self, manager, mock_sys, plugin_dir):
        """Should strip unit suffix from duration values (e.g., '60min' -> 60)."""
        mock_sys.add_manifest("hibernate-after-sleep", {
            "id": "hibernate-after-sleep",
            "name": "Hibernate After Sleep",
            "config": {
                "path": "/var/lib/extensions-config/hibernate-after-sleep",
                "parameters": [
                    {
                        "id": "HibernateDelaySec",
                        "type": "duration",
                        "unit": "min",
                        "default": 60
                    }
                ]
            }
        }, plugin_dir)

        # Simulate config file with unit suffix
        mock_sys.files["/var/lib/extensions-config/hibernate-after-sleep"] = "HibernateDelaySec=60min"

        result = await manager.get_config("hibernate-after-sleep")

        assert result["values"]["HibernateDelaySec"] == 60

    async def test_parses_integer_with_unit_suffix(self, manager, mock_sys, plugin_dir):
        """Should strip unit suffix from integer values (e.g., '20GB' -> 20)."""
        mock_sys.add_manifest("hibernate-after-sleep", {
            "id": "hibernate-after-sleep",
            "name": "Hibernate After Sleep",
            "config": {
                "path": "/var/lib/extensions-config/hibernate-after-sleep",
                "parameters": [
                    {
                        "id": "TargetSwapFileSizeInGbs",
                        "type": "integer",
                        "unit": "GB",
                        "default": 20
                    }
                ]
            }
        }, plugin_dir)

        mock_sys.files["/var/lib/extensions-config/hibernate-after-sleep"] = "TargetSwapFileSizeInGbs=20GB"

        result = await manager.get_config("hibernate-after-sleep")

        assert result["values"]["TargetSwapFileSizeInGbs"] == 20

    async def test_parses_plain_integer_without_suffix(self, manager, mock_sys, plugin_dir):
        """Should parse plain integers without suffix."""
        mock_sys.add_manifest("hibernate-after-sleep", {
            "id": "hibernate-after-sleep",
            "name": "Hibernate After Sleep",
            "config": {
                "path": "/var/lib/extensions-config/hibernate-after-sleep",
                "parameters": [
                    {
                        "id": "HibernateDelaySec",
                        "type": "duration",
                        "unit": "min",
                        "default": 60
                    }
                ]
            }
        }, plugin_dir)

        # Config file has plain integer (user edited manually or old version)
        mock_sys.files["/var/lib/extensions-config/hibernate-after-sleep"] = "HibernateDelaySec=120"

        result = await manager.get_config("hibernate-after-sleep")

        assert result["values"]["HibernateDelaySec"] == 120

    async def test_preserves_invalid_unit_format_as_string(self, manager, mock_sys, plugin_dir):
        """Should preserve invalid formats (e.g., '1h' when expecting 'min') as strings."""
        mock_sys.add_manifest("hibernate-after-sleep", {
            "id": "hibernate-after-sleep",
            "name": "Hibernate After Sleep",
            "config": {
                "path": "/var/lib/extensions-config/hibernate-after-sleep",
                "parameters": [
                    {
                        "id": "HibernateDelaySec",
                        "type": "duration",
                        "unit": "min",
                        "default": 60
                    }
                ]
            }
        }, plugin_dir)

        # User manually edited config with wrong unit format
        mock_sys.files["/var/lib/extensions-config/hibernate-after-sleep"] = "HibernateDelaySec=1h"

        result = await manager.get_config("hibernate-after-sleep")

        # Should preserve as string since it doesn't match expected unit
        assert result["values"]["HibernateDelaySec"] == "1h"

    async def test_returns_defaults_when_config_missing(self, manager, mock_sys, plugin_dir):
        """Should return default values when config file doesn't exist."""
        mock_sys.add_manifest("hibernate-after-sleep", {
            "id": "hibernate-after-sleep",
            "name": "Hibernate After Sleep",
            "config": {
                "path": "/var/lib/extensions-config/hibernate-after-sleep",
                "parameters": [
                    {
                        "id": "HibernateDelaySec",
                        "type": "duration",
                        "unit": "min",
                        "default": 60
                    }
                ]
            }
        }, plugin_dir)

        # Config file does not exist
        result = await manager.get_config("hibernate-after-sleep")

        assert result["values"]["HibernateDelaySec"] == 60

    async def test_handles_multiple_parameters_with_different_units(self, manager, mock_sys, plugin_dir):
        """Should correctly parse multiple parameters with different units."""
        mock_sys.add_manifest("hibernate-after-sleep", {
            "id": "hibernate-after-sleep",
            "name": "Hibernate After Sleep",
            "config": {
                "path": "/var/lib/extensions-config/hibernate-after-sleep",
                "parameters": [
                    {
                        "id": "HibernateDelaySec",
                        "type": "duration",
                        "unit": "min",
                        "default": 60
                    },
                    {
                        "id": "TargetSwapFileSizeInGbs",
                        "type": "integer",
                        "unit": "GB",
                        "default": 20
                    }
                ]
            }
        }, plugin_dir)

        mock_sys.files["/var/lib/extensions-config/hibernate-after-sleep"] = (
            "HibernateDelaySec=1440min\n"
            "TargetSwapFileSizeInGbs=32GB"
        )

        result = await manager.get_config("hibernate-after-sleep")

        assert result["values"]["HibernateDelaySec"] == 1440
        assert result["values"]["TargetSwapFileSizeInGbs"] == 32


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
        # Enable sysext service but don't add extension to active list (pending reboot)
        mock_sys.enabled_services.add("systemd-sysext")

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
