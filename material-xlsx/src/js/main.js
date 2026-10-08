import { init } from "./app.js";
init().catch((e) => { console.error(e); document.body.insertAdjacentHTML("beforeend", `<pre style="position:fixed;inset:20px;color:#b00;background:#fff;padding:16px;z-index:999;user-select:text">${String(e && e.stack || e)}</pre>`); });
