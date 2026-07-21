import { createApp, watch } from "vue";
import App from "./App.vue";
import { i18n, setAppLocale } from "./i18n";
import { setupGlobalTooltip } from "./shared/ui/tooltip/globalTooltip";
import { setOcGlassIntensity, setOcTheme } from "./shared/ui/foundation";
import { useAppSettingsStore } from "./features/settings/store/appSettingsStore";
import "./features/shell/shell.css";
import "./styles.css";

async function bootstrap(): Promise<void> {
  const settingsStore = useAppSettingsStore();
  await settingsStore.initialize();
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  const applyAppearance = () => {
    const appearance = settingsStore.settings.value.appearance;
    const theme = appearance.theme === "system"
      ? (systemTheme.matches ? "dark" : "light")
      : appearance.theme;
    setOcTheme(theme);
    setOcGlassIntensity(appearance.glassIntensity);
  };

  watch(
    () => [
      settingsStore.settings.value.appearance.theme,
      settingsStore.settings.value.appearance.glassIntensity,
    ] as const,
    applyAppearance,
    { immediate: true },
  );
  systemTheme.addEventListener("change", applyAppearance);
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
