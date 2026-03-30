import {
  PanelSection,
  PanelSectionRow,
  Spinner,
  staticClasses,
} from "@decky/ui";
import { definePlugin } from "@decky/api";
import { FaCogs } from "react-icons/fa";

import { useExtensions } from "./decky-plugin/hooks/useExtensions";
import { ExtensionCard } from "./decky-plugin/components/ExtensionCard";

function Content() {
  const {
    extensions,
    loading,
    error,
    enable,
    disable,
    loadConfig,
    saveConfig,
    triggerReboot,
  } = useExtensions();

  if (loading) {
    return (
      <PanelSection title="Loading...">
        <PanelSectionRow>
          <Spinner />
        </PanelSectionRow>
      </PanelSection>
    );
  }

  if (error) {
    return (
      <PanelSection title="Error">
        <PanelSectionRow>
          <div style={{ color: "red" }}>{error}</div>
        </PanelSectionRow>
      </PanelSection>
    );
  }

  // Group extensions by category
  const categories: Record<string, typeof extensions> = {};
  for (const ext of extensions) {
    const cat = ext.manifest.category || "other";
    if (!categories[cat]) {
      categories[cat] = [];
    }
    categories[cat].push(ext);
  }

  // Order categories
  const categoryOrder = ["system", "power", "performance", "utilities", "boot", "other"];
  const sortedCategories = Object.keys(categories).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

  return (
    <>
      {sortedCategories.map((category) => (
        <PanelSection
          key={category}
          title={category.charAt(0).toUpperCase() + category.slice(1)}
        >
          {categories[category].map((ext) => (
            <ExtensionCard
              key={ext.manifest.id}
              extension={ext}
              onEnable={enable}
              onDisable={disable}
              onLoadConfig={loadConfig}
              onSaveConfig={saveConfig}
              onReboot={triggerReboot}
            />
          ))}
        </PanelSection>
      ))}
    </>
  );
}

export default definePlugin(() => {
  console.log("SteamOS Extensions plugin initializing");

  return {
    name: "SteamOS Extensions",
    titleView: (
      <div className={staticClasses.Title}>SteamOS Extensions</div>
    ),
    content: <Content />,
    icon: <FaCogs />,
    onDismount() {
      console.log("SteamOS Extensions plugin unloading");
    },
  };
});
