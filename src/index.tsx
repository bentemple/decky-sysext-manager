import { staticClasses } from "@decky/ui";
import { definePlugin, routerHook } from "@decky/api";
import { FaCogs } from "react-icons/fa";

import { useExtensions } from "./decky-plugin/hooks/useExtensions";
import { QuickAccessPanel } from "./decky-plugin/components/QuickAccessPanel";
import { SettingsView } from "./decky-plugin/components/SettingsView";

function QuickAccessContent() {
  const { extensions, loading, error, updateManager, sysextStatus, enableSysextService } = useExtensions();

  return (
    <QuickAccessPanel
      extensions={extensions}
      loading={loading}
      error={error}
      updateManager={updateManager}
      sysextStatus={sysextStatus}
      onEnableSysext={enableSysextService}
    />
  );
}

export default definePlugin(() => {
  console.log("Sysext Manager plugin initializing");

  // Register settings page route
  routerHook.addRoute("/sysext-manager/settings", SettingsView, {
    exact: true,
  });

  return {
    name: "Sysext Manager",
    title: <div className={staticClasses.Title}>Sysext Manager</div>,
    content: <QuickAccessContent />,
    icon: <FaCogs />,
    onDismount() {
      console.log("Sysext Manager plugin unloading");
      routerHook.removeRoute("/sysext-manager/settings");
    },
  };
});
