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
import { addTitleBarNotice } from "./features/notifications/titlebarNotices";
import "./features/shell/shell.css";
import "./styles.css";

const startupStartedAt = performance.getEntriesByName("opencard:startup:html")[0]?.startTime
  ?? performance.now();
let startupPreviousAt = startupStartedAt;

function recordStartupTiming(label: string): void {
  const now = performance.now();
  const segmentMs = now - startupPreviousAt;
  const totalMs = now - startupStartedAt;
  console.info(
    `[OpenCard/Startup] ${label}: +${segmentMs.toFixed(1)}ms (${totalMs.toFixed(1)}ms total)`,
  );
  startupPreviousAt = now;
}

recordStartupTiming("main module ready");

function dismissStartupCover(): void {
  const cover = document.getElementById("oc-startup-cover");
  if (!cover) return;

  cover.classList.add("is-leaving");
  cover.getBoundingClientRect();
  const animations = cover.getAnimations();
  if (animations.length === 0) {
    cover.remove();
    return;
  }
  void Promise.allSettled(animations.map(animation => animation.finished))
    .then(() => cover.remove());
}

async function bootstrap(): Promise<void> {
  const settingsStore = useAppSettingsStore();
  recordStartupTiming("settings load started");
  await settingsStore.initialize();
  recordStartupTiming("settings ready");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let lastAppliedTheme: "dark" | "light" | null = null;

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
    if (lastAppliedTheme !== null && lastAppliedTheme !== theme) {
      const themeName = i18n.global.t(`settings.values.${theme}`);
      addTitleBarNotice({
        message: i18n.global.t("app.notifications.themeChanged", { theme: themeName }),
        icon: "data.symbol-color",
      });
    }
    lastAppliedTheme = theme;
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
  recordStartupTiming("Vue mounted");
  window.requestAnimationFrame(() => {
    dismissStartupCover();
    window.setTimeout(() => recordStartupTiming("first frame painted"), 0);
  });
}

void bootstrap();
