import { createApp, watch } from "vue";
import App from "./App.vue";
import { i18n, setAppLocale } from "./i18n";
import { setupGlobalTooltip } from "./shared/ui/tooltip/globalTooltip";
import {
  setOcGlassIntensity,
  setOcPhaseImageSpeedMultiplier,
  setOcTheme,
} from "./shared/ui/foundation";
import { useAppSettingsStore } from "./features/settings/store/appSettingsStore";
import { installAppConsoleCapture } from "./features/logging/appConsole";
import "./features/shell/shell.css";
import "./styles.css";

installAppConsoleCapture();

async function bootstrap(): Promise<void> {
  const settingsStore = useAppSettingsStore();
  await settingsStore.initialize();
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  const resolveTheme = () => {
    const appearance = settingsStore.settings.value.appearance;
    return appearance.theme === "system"
      ? (systemTheme.matches ? "dark" : "light")
      : appearance.theme;
  };

  const applyThemeAppearance = () => {
    const appearance = settingsStore.settings.value.appearance;
    const theme = resolveTheme();
    setOcTheme(theme, appearance.themeOverrides[theme], appearance.accentNeighborAngles[theme], {
      fontFamily: appearance.fontFamilies[theme],
      baseFontSize: appearance.baseFontSize,
    });
    setOcGlassIntensity(appearance.glassIntensity);
  };

  watch(
    () => {
      const appearance = settingsStore.settings.value.appearance;
      const theme = resolveTheme();
      const overrides = appearance.themeOverrides[theme];
      return [
        theme,
        overrides["--oc-accent"] ?? null,
        overrides["--oc-bg-base"] ?? null,
        overrides["--oc-fg-default"] ?? null,
        appearance.accentNeighborAngles[theme],
        appearance.fontFamilies[theme],
        appearance.baseFontSize,
      ] as const;
    },
    applyThemeAppearance,
    { immediate: true },
  );
  watch(
    () => settingsStore.settings.value.appearance.glassIntensity,
    setOcGlassIntensity,
    { immediate: true },
  );
  watch(
    () => settingsStore.settings.value.appearance.phaseImageSpeed,
    (speed) => setOcPhaseImageSpeedMultiplier(speed / 100),
    { immediate: true },
  );
  systemTheme.addEventListener("change", () => {
    if (settingsStore.settings.value.appearance.theme === "system") applyThemeAppearance();
  });
  watch(
    () => settingsStore.settings.value.appearance.locale,
    (locale) => setAppLocale(locale),
    { immediate: true },
  );

  setupGlobalTooltip();
  window.addEventListener("contextmenu", (event) => {
    if (!event.defaultPrevented) event.preventDefault();
  });
  createApp(App).use(i18n).mount("#app");
}

void bootstrap();
