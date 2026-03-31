import {
  staticClasses,
} from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { FaCogs } from "react-icons/fa";

import { useExtensions } from "./decky-plugin/hooks/useExtensions";
import { QuickAccessView } from "./decky-plugin/components/QuickAccessView";
import { SettingsPage } from "./decky-plugin/components/SettingsPage";

function QuickAccessContent() {
  const { extensions, loading, error } = useExtensions();

  return (
    <QuickAccessView
      extensions={extensions}
      loading={loading}
      error={error}
    />
  );
}

function SettingsPageContent() {
  const {
    extensions,
    enable,
    disable,
    triggerReboot,
  } = useExtensions();

  return (
    <SettingsPage
      extensions={extensions}
      onEnable={enable}
      onDisable={disable}
      onReboot={triggerReboot}
    />
  );
}

export default definePlugin(() => {
  console.log("SteamOS Extensions plugin initializing");

  // Register settings page route
  routerHook.addRoute("/steamos-extensions/settings", () => <SettingsPageContent />);

  return {
    name: "SteamOS Extensions",
    titleView: (
      <div className={staticClasses.Title}>SteamOS Extensions</div>
    ),
    content: <QuickAccessContent />,
    icon: <FaCogs />,
    onDismount() {
      console.log("SteamOS Extensions plugin unloading");
      routerHook.removeRoute("/steamos-extensions/settings");
    },
  };
});
