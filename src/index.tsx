import { staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { FaCogs } from "react-icons/fa";

import { useExtensions } from "./decky-plugin/hooks/useExtensions";
import { QuickAccessPanel } from "./decky-plugin/components/QuickAccessPanel";
import { SettingsView } from "./decky-plugin/components/SettingsView";

function QuickAccessContent() {
  const { extensions, loading, error, updateManager } = useExtensions();

  return (
    <QuickAccessPanel
      extensions={extensions}
      loading={loading}
      error={error}
      updateManager={updateManager}
    />
  );
}

export default definePlugin(() => {
  console.log("Sysext Extensions plugin initializing");

  // Register settings page route
  routerHook.addRoute("/sysext-extensions/settings", SettingsView, {
    exact: true,
  });

  return {
    name: "Sysext Extensions",
    title: <div className={staticClasses.Title}>Sysext Extensions</div>,
    content: <QuickAccessContent />,
    icon: <FaCogs />,
    onDismount() {
      console.log("Sysext Extensions plugin unloading");
      routerHook.removeRoute("/sysext-extensions/settings");
    },
  };
});
