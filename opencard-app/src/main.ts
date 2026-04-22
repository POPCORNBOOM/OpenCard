import { createApp } from "vue";
import App from "./App.vue";
import { i18n } from "./i18n";
import { setOcTheme, type OcThemeId } from "./shared/ui/foundation";
import "./styles.css";

const APP_THEME_ID: OcThemeId = "light";
setOcTheme(APP_THEME_ID);

createApp(App).use(i18n).mount("#app");
