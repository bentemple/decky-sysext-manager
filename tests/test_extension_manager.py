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

    async def test_fails_when_configure_script_returns_error(self, manager, mock_sys, plugin_dir):
        """Should fail when configure script exits with non-zero status."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension",
            "config": {
                "path": "/var/lib/extensions-config/test-ext",
                "parameters": [{"id": "param1", "type": "string"}]
            }
        }, plugin_dir)

        configure_script = f"{plugin_dir}/dist/extensions/steamos-extension-test-ext.configure"
        mock_sys.files[configure_script] = "#!/bin/bash\nexit 1"

        # Mock command to return failure
        mock_sys.command_outputs[f"{configure_script} --param1=value"] = ("", "Configuration failed: invalid value", 1)

        result = await manager.configure_extension("test-ext", {"param1": "value"})

        assert not result["success"]
        assert "failed" in result["error"].lower()


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


@pytest.mark.asyncio
class TestUpdateManagerGetCurrentVersion:
    """Tests for update manager --get-current-version."""

    async def test_runs_script_with_get_current_version_flag(self, manager, mock_sys, plugin_dir):
        """Should run update-manager script with --get-current-version flag."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale",
            "update_manager": {"script": "./update-manager"}
        }, plugin_dir)

        script_path = f"{plugin_dir}/dist/extensions/steamos-extension-tailscale.update-manager"
        mock_sys.files[script_path] = "#!/bin/bash\necho 1.2.3"
        mock_sys.make_executable(script_path)
        mock_sys.command_outputs[f"{script_path} --get-current-version"] = ("1.2.3", "", 0)

        result = await manager.run_update_manager("tailscale", "--get-current-version")

        assert result["success"]
        assert result["output"] == "1.2.3"
        assert any("--get-current-version" in str(cmd) for cmd in mock_sys.commands_run)

    async def test_fails_when_script_not_found(self, manager, mock_sys, plugin_dir):
        """Should fail when update-manager script doesn't exist."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale",
            "update_manager": {"script": "./update-manager"}
        }, plugin_dir)
        # Note: NOT adding the script file

        result = await manager.run_update_manager("tailscale", "--get-current-version")

        assert not result["success"]
        assert "not found" in result["error"]

    async def test_fails_when_manifest_missing(self, manager, mock_sys, plugin_dir):
        """Should fail when extension manifest doesn't exist."""
        result = await manager.run_update_manager("nonexistent", "--get-current-version")

        assert not result["success"]
        assert "not found" in result["error"]

    async def test_fails_for_invalid_flag(self, manager, mock_sys, plugin_dir):
        """Should reject invalid flags."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale",
            "update_manager": {"script": "./update-manager"}
        }, plugin_dir)

        result = await manager.run_update_manager("tailscale", "--invalid-flag")

        assert not result["success"]
        assert "Invalid flag" in result["error"]


@pytest.mark.asyncio
class TestUpdateManagerGetLatestVersion:
    """Tests for update manager --get-latest-version with caching."""

    async def test_runs_script_and_caches_result(self, manager, mock_sys, plugin_dir):
        """Should run script and cache the result."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale",
            "update_manager": {"script": "./update-manager"}
        }, plugin_dir)

        script_path = f"{plugin_dir}/dist/extensions/steamos-extension-tailscale.update-manager"
        mock_sys.files[script_path] = "#!/bin/bash\necho 1.3.0"
        mock_sys.make_executable(script_path)
        mock_sys.command_outputs[f"{script_path} --get-latest-version"] = ("1.3.0", "", 0)

        result = await manager.run_update_manager("tailscale", "--get-latest-version")

        assert result["success"]
        assert result["output"] == "1.3.0"

        # Check cache was written
        cache_file = f"{plugin_dir}/cache/update-manager/tailscale.json"
        assert cache_file in mock_sys.files
        import json
        cache = json.loads(mock_sys.files[cache_file])
        assert cache["version"] == "1.3.0"
        assert "timestamp" in cache

    async def test_uses_cached_version_when_fresh(self, manager, mock_sys, plugin_dir):
        """Should return cached version without running script when cache is fresh."""
        import json
        import time

        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale",
            "update_manager": {"script": "./update-manager"}
        }, plugin_dir)

        # Add the script (even though it won't be called)
        script_path = f"{plugin_dir}/dist/extensions/steamos-extension-tailscale.update-manager"
        mock_sys.files[script_path] = "#!/bin/bash\necho 1.3.0"
        mock_sys.make_executable(script_path)

        # Add fresh cache (within 6 hour window)
        cache_file = f"{plugin_dir}/cache/update-manager/tailscale.json"
        mock_sys.files[cache_file] = json.dumps({
            "timestamp": time.time() - 3600,  # 1 hour ago
            "version": "1.3.0"
        })

        result = await manager.run_update_manager("tailscale", "--get-latest-version")

        assert result["success"]
        assert result["output"] == "1.3.0"
        # Script should NOT have been called
        assert not any("update-manager" in str(cmd) for cmd in mock_sys.commands_run)


@pytest.mark.asyncio
class TestUpdateManagerUpdate:
    """Tests for update manager --update operation."""

    async def test_runs_update_and_invalidates_cache(self, manager, mock_sys, plugin_dir):
        """Should run update script and invalidate version cache."""
        import json
        import time

        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale",
            "update_manager": {"script": "./update-manager"}
        }, plugin_dir)

        script_path = f"{plugin_dir}/dist/extensions/steamos-extension-tailscale.update-manager"
        mock_sys.files[script_path] = "#!/bin/bash\necho updated"
        mock_sys.make_executable(script_path)
        mock_sys.command_outputs[f"{script_path} --update"] = ("updated to 1.4.0", "", 0)

        # Add cache that should be invalidated
        cache_file = f"{plugin_dir}/cache/update-manager/tailscale.json"
        mock_sys.files[cache_file] = json.dumps({
            "timestamp": time.time(),
            "version": "1.3.0"
        })

        result = await manager.run_update_manager("tailscale", "--update")

        assert result["success"]
        assert "update" in result["output"].lower()
        # Cache should be removed
        assert cache_file not in mock_sys.files


@pytest.mark.asyncio
class TestUpdateManagerErrorCases:
    """Tests for update manager error handling."""

    async def test_fails_when_script_returns_nonzero(self, manager, mock_sys, plugin_dir):
        """Should fail when update-manager script exits with error."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale",
            "update_manager": {"script": "./update-manager"}
        }, plugin_dir)

        script_path = f"{plugin_dir}/dist/extensions/steamos-extension-tailscale.update-manager"
        mock_sys.files[script_path] = "#!/bin/bash\nexit 1"
        mock_sys.make_executable(script_path)
        mock_sys.command_outputs[f"{script_path} --get-current-version"] = ("", "Failed to get version", 1)

        result = await manager.run_update_manager("tailscale", "--get-current-version")

        assert not result["success"]
        assert "error" in result
        assert result["output"] == ""

    async def test_handles_script_output_on_failure(self, manager, mock_sys, plugin_dir):
        """Should return both output and error when script fails."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale",
            "update_manager": {"script": "./update-manager"}
        }, plugin_dir)

        script_path = f"{plugin_dir}/dist/extensions/steamos-extension-tailscale.update-manager"
        mock_sys.files[script_path] = "#!/bin/bash\necho 'partial output'\nexit 1"
        mock_sys.make_executable(script_path)
        mock_sys.command_outputs[f"{script_path} --update"] = ("partial output", "update failed: network error", 1)

        result = await manager.run_update_manager("tailscale", "--update")

        assert not result["success"]
        assert result["output"] == "partial output"
        assert "error" in result
        assert "network error" in result["error"]

    async def test_no_update_manager_configured(self, manager, mock_sys, plugin_dir):
        """Should fail when extension has no update_manager section in manifest."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension"
            # No update_manager section
        }, plugin_dir)

        result = await manager.run_update_manager("test-ext", "--get-current-version")

        assert not result["success"]
        assert "no update_manager configured" in result["error"]


@pytest.mark.asyncio
class TestHotReloadDisable:
    """Tests for hot-reload activation mode during disable."""

    async def test_hot_reload_success_no_reboot(self, manager, mock_sys, plugin_dir):
        """Should hot-reload successfully and not require reboot."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension",
            "activation": {"mode": "hot-reload"}
        }, plugin_dir)
        mock_sys.add_installed_raw("test-ext")
        mock_sys.sysext_refresh_success = True

        result = await manager.disable_extension("test-ext")

        assert result["success"]
        assert not result["needs_reboot"]
        assert mock_sys.sysext_refresh_called

    async def test_hot_reload_fails_needs_reboot(self, manager, mock_sys, plugin_dir):
        """Should require reboot when hot-reload fails."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension",
            "activation": {"mode": "auto"}
        }, plugin_dir)
        mock_sys.add_installed_raw("test-ext")
        mock_sys.sysext_refresh_success = False

        result = await manager.disable_extension("test-ext")

        assert result["success"]
        assert result["needs_reboot"]


@pytest.mark.asyncio
class TestHotReloadUpdate:
    """Tests for hot-reload activation mode during update."""

    async def test_hot_reload_update_no_reboot(self, manager, mock_sys, plugin_dir):
        """Should hot-reload after update successfully."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension",
            "activation": {"mode": "hot-reload"}
        }, plugin_dir)
        mock_sys.add_bundled_raw("test-ext", plugin_dir)
        mock_sys.add_installed_raw("test-ext")
        mock_sys.sysext_refresh_success = True

        result = await manager.update_extension("test-ext")

        assert result["success"]
        assert not result["needs_reboot"]


@pytest.mark.asyncio
class TestStatusUnloaded:
    """Tests for 'unloaded' status when sysext service is inactive."""

    async def test_returns_unloaded_when_service_inactive(self, manager, mock_sys, plugin_dir):
        """Should return 'unloaded' status when raw exists but sysext service is inactive."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension"
        }, plugin_dir)
        mock_sys.add_installed_raw("test-ext")
        # Service is NOT active
        mock_sys.enabled_services.discard("systemd-sysext")

        extensions = await manager.get_extensions()

        assert len(extensions) == 1
        assert extensions[0]["status"] == "unloaded"
        assert extensions[0]["enabled"]  # Still considered "enabled" since raw exists


@pytest.mark.asyncio
class TestSysextServiceManagement:
    """Tests for systemd-sysext service management."""

    async def test_get_sysext_status_active(self, manager, mock_sys, plugin_dir):
        """Should return active status when service is running."""
        mock_sys.enabled_services.add("systemd-sysext")

        status = manager.get_sysext_status()

        assert status["active"]
        assert status["status"] == "active"

    async def test_get_sysext_status_inactive(self, manager, mock_sys, plugin_dir):
        """Should return inactive status when service is not running."""
        mock_sys.enabled_services.discard("systemd-sysext")

        status = manager.get_sysext_status()

        assert not status["active"]
        assert status["status"] == "inactive"

    async def test_enable_sysext_success(self, manager, mock_sys, plugin_dir):
        """Should enable systemd-sysext service successfully."""
        result = await manager.enable_sysext()

        assert result["success"]
        assert "systemd-sysext" in mock_sys.enabled_services


@pytest.mark.asyncio
class TestGetExtensionStatus:
    """Tests for get_extension_status (individual extension)."""

    async def test_returns_enabled_when_raw_exists(self, manager, mock_sys, plugin_dir):
        """Should return enabled=True when .raw file exists."""
        mock_sys.add_installed_raw("test-ext")

        status = await manager.get_extension_status("test-ext")

        assert status["enabled"]
        assert status["raw_file"] == "steamos-extension-test-ext.raw"

    async def test_returns_disabled_when_raw_missing(self, manager, mock_sys, plugin_dir):
        """Should return enabled=False when .raw file doesn't exist."""
        status = await manager.get_extension_status("test-ext")

        assert not status["enabled"]


@pytest.mark.asyncio
class TestGetExtensionsDetails:
    """Tests for additional details in get_extensions."""

    async def test_detects_update_manager_availability(self, manager, mock_sys, plugin_dir):
        """Should set has_update_manager=True when script exists and is executable."""
        mock_sys.add_manifest("tailscale", {
            "id": "tailscale",
            "name": "Tailscale",
            "update_manager": {"script": "./update-manager"}
        }, plugin_dir)

        script_path = f"{plugin_dir}/dist/extensions/steamos-extension-tailscale.update-manager"
        mock_sys.files[script_path] = "#!/bin/bash\necho test"
        mock_sys.make_executable(script_path)

        extensions = await manager.get_extensions()

        assert len(extensions) == 1
        assert extensions[0]["has_update_manager"]

    async def test_detects_bundled_update_available(self, manager, mock_sys, plugin_dir):
        """Should set bundled_update_available=True when hashes differ."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension"
        }, plugin_dir)

        bundled_raw = f"{plugin_dir}/dist/extensions/steamos-extension-test-ext.raw"
        installed_raw = f"{EXTENSIONS_DIR}/steamos-extension-test-ext.raw"

        mock_sys.binary_files[bundled_raw] = b"new content"
        mock_sys.binary_files[installed_raw] = b"old content"

        extensions = await manager.get_extensions()

        assert len(extensions) == 1
        assert extensions[0]["bundled_update_available"]

    async def test_includes_readme_content(self, manager, mock_sys, plugin_dir):
        """Should include README content when available."""
        mock_sys.add_manifest("test-ext", {
            "id": "test-ext",
            "name": "Test Extension"
        }, plugin_dir)

        readme_path = f"{plugin_dir}/dist/extensions/steamos-extension-test-ext.readme"
        mock_sys.files[readme_path] = "# Test Extension\n\nThis is a test."

        extensions = await manager.get_extensions()

        assert len(extensions) == 1
        assert "Test Extension" in extensions[0]["readme"]


@pytest.mark.asyncio
class TestDisableWithPromptAnswers:
    """Tests for passing prompt answers to uninstall script."""

    async def test_passes_prompt_answers_to_uninstall_script(self, manager, mock_sys, plugin_dir):
        """Should pass prompt answers as --key=value arguments to uninstall script."""
        mock_sys.add_manifest("hibernate", {
            "id": "hibernate",
            "name": "Hibernate After Sleep",
            "activation": {"mode": "reboot"},
            "uninstall": {
                "prompts": [
                    {"id": "resize_swapfile", "message": "Resize swapfile?", "default": False}
                ]
            }
        }, plugin_dir)
        mock_sys.add_installed_raw("hibernate")

        uninstall_path = f"{plugin_dir}/dist/extensions/steamos-extension-hibernate.uninstall"
        mock_sys.files[uninstall_path] = "#!/bin/bash\necho uninstalling"

        await manager.disable_extension("hibernate", prompt_answers={"resize_swapfile": True})

        # Check that the prompt answer was passed as an argument
        uninstall_calls = [cmd for cmd in mock_sys.commands_run if "uninstall" in str(cmd)]
        assert len(uninstall_calls) > 0
        # The command should include --resize_swapfile=true
        assert any("--resize_swapfile=true" in str(cmd) for cmd in uninstall_calls)
