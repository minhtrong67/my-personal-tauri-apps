import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke, appWindow, logicalSize } from "./tauri.js";
import { DEFAULT_URL, loadSettings, saveSettings } from "./settings.js";
import { makeT, errText } from "./i18n.js";
import Row from "./components/Row.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import { Logo, Sliders } from "./components/Icons.jsx";

const darkQuery = () => matchMedia("(prefers-color-scheme: dark)");

export default function App() {
  const [s, setS] = useState(loadSettings);
  const first = useRef(s); // cài đặt lúc khởi động, dùng cho cửa sổ
  const patch = useCallback((p) => setS((v) => ({ ...v, ...p })), []);
  useEffect(() => saveSettings(s), [s]);
  const t = useMemo(() => makeT(s.lang), [s.lang]);

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [running, setRunning] = useState(() => new Set());
  const [opening, setOpening] = useState(() => new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const [sysDark, setSysDark] = useState(() => darkQuery().matches);

  const searchRef = useRef(null);
  const toastTimer = useRef();
  const urlRef = useRef("");
  urlRef.current = s.url.trim();

  // ---- Giao diện sáng / tối / hệ thống ----
  useEffect(() => {
    const mq = darkQuery();
    const on = (e) => setSysDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolved = s.theme === "system" ? (sysDark ? "dark" : "light") : s.theme;
  const themed = useRef(false);
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (themed.current) {
      root.classList.add("theme-anim");
      setTimeout(() => root.classList.remove("theme-anim"), 350);
    }
    themed.current = true;
    root.dataset.theme = resolved;
  }, [resolved]);
  useLayoutEffect(() => {
    document.documentElement.lang = s.lang;
  }, [s.lang]);
  useEffect(() => {
    appWindow()?.setTheme(s.theme === "system" ? null : s.theme).catch(() => {});
  }, [s.theme]);

  // ---- Cửa sổ: áp dụng kích thước rồi mới hiện ----
  useEffect(() => {
    (async () => {
      const w = appWindow();
      if (!w) return;
      const init = first.current;
      try {
        if (init.windowMode === "maximized") {
          await w.maximize();
        } else if (init.size) {
          const sw = Math.min(init.size.w, screen.availWidth);
          const sh = Math.min(init.size.h, screen.availHeight);
          await w.setSize(logicalSize(sw, sh));
          await w.center();
        }
      } catch {}
      try {
        await w.show();
      } catch {}
    })();
  }, []);

  // Ghi nhớ kích thước khi người dùng kéo cửa sổ
  useEffect(() => {
    const w = appWindow();
    if (!w || s.windowMode !== "remember") return;
    let timer;
    let off;
    let dead = false;
    w.onResized(() => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          if ((await w.isMaximized()) || (await w.isMinimized())) return;
          const [size, f] = await Promise.all([w.innerSize(), w.scaleFactor()]);
          const width = Math.round(size.width / f);
          const height = Math.round(size.height / f);
          if (width >= 400 && height >= 400) patch({ size: { w: width, h: height } });
        } catch {}
      }, 400);
    })
      .then((u) => (dead ? u() : (off = u)))
      .catch(() => {});
    return () => {
      dead = true;
      clearTimeout(timer);
      off?.();
    };
  }, [s.windowMode, patch]);

  // ---- Dữ liệu profile ----
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    invoke("list_profiles")
      .then(setProfiles)
      .catch((e) => setError(errText(t, e)))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshRunning = useCallback(async () => {
    try {
      const dirs = await invoke("running_profiles");
      setRunning((prev) => (prev.size === dirs.length && dirs.every((d) => prev.has(d)) ? prev : new Set(dirs)));
    } catch {}
  }, []);

  // Dò profile đang mở, chỉ khi cửa sổ đang hiển thị
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) refreshRunning();
    };
    tick();
    const id = setInterval(tick, 2500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refreshRunning]);

  useEffect(() => {
    setOpening((prev) => {
      if (!prev.size) return prev;
      const next = new Set([...prev].filter((d) => !running.has(d)));
      return next.size === prev.size ? prev : next;
    });
  }, [running]);

  // ---- Hành động ----
  const notify = useCallback((text, kind = "ok") => {
    clearTimeout(toastTimer.current);
    setToast({ text, kind, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const open = useCallback(
    async (dirs) => {
      if (!dirs.length) return;
      setOpening((prev) => new Set([...prev, ...dirs]));
      const giveUp = () => setOpening((prev) => new Set([...prev].filter((d) => !dirs.includes(d))));
      try {
        const n = await invoke("launch_profiles", { dirs, url: urlRef.current });
        notify(t("openedN", { n }));
        [900, 2200, 4000].forEach((ms) => setTimeout(refreshRunning, ms));
        setTimeout(giveUp, 9000 + dirs.length * 1500);
      } catch (e) {
        giveUp();
        notify(errText(t, e), "err");
      }
    },
    [t, notify, refreshRunning]
  );

  const close = useCallback(
    async (dirs) => {
      if (!dirs.length) return;
      try {
        const n = await invoke("close_profiles", { dirs });
        notify(n ? t("closedN", { n }) : t("nothingToClose"), n ? "ok" : "err");
      } catch (e) {
        notify(errText(t, e), "err");
      }
      [700, 1800].forEach((ms) => setTimeout(refreshRunning, ms));
    },
    [t, notify, refreshRunning]
  );

  const toggle = useCallback(
    (dir) =>
      setPicked((prev) => {
        const next = new Set(prev);
        next.has(dir) ? next.delete(dir) : next.add(dir);
        return next;
      }),
    []
  );

  // ---- Dữ liệu dẫn xuất ----
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => !q || `${p.name} ${p.email}`.toLowerCase().includes(q));
  }, [profiles, query]);

  const validUrl = /^https?:\/\/\S+$/i.test(s.url.trim());
  const targets = picked.size ? [...picked] : shown.map((p) => p.dir);
  const runTargets = targets.filter((d) => running.has(d));
  const allPicked = shown.length > 0 && shown.every((p) => picked.has(p.dir));
  const selectAll = () => setPicked(new Set(shown.map((p) => p.dir)));
  const toggleAll = () => (allPicked ? setPicked(new Set()) : selectAll());

  // ---- Phím tắt ----
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (mod && e.key.toLowerCase() === "a" && !typing) {
        e.preventDefault();
        selectAll();
      } else if (e.key === "Escape") {
        if (showSettings) setShowSettings(false);
        else if (query) setQuery("");
        else if (picked.size) setPicked(new Set());
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  const closeSettings = useCallback(() => setShowSettings(false), []);

  return (
    <>
      <main>
        <header>
          <div className="brand">
            <Logo />
            <div>
              <h1>Claude Launcher</h1>
              <p className="sub">{t("tagline")}</p>
              <p className="credit">
                {t("by")} <mark>minhtrong67</mark> {t("withAi")} <mark className="ai">Claude</mark>
              </p>
            </div>
          </div>
          <button
            type="button"
            className="gear"
            aria-label={t("settings")}
            title={t("settings")}
            aria-expanded={showSettings}
            onClick={() => setShowSettings((v) => !v)}
          >
            <Sliders />
          </button>
          {showSettings && <SettingsPanel t={t} s={s} patch={patch} onClose={closeSettings} />}
        </header>

        <div className={`dest ${validUrl ? "" : "bad"}`}>
          <span>{t("destination")}</span>
          <input
            value={s.url}
            onChange={(e) => patch({ url: e.target.value })}
            spellCheck={false}
            aria-label={t("destination")}
          />
          <button type="button" className="ghost" disabled={s.url === DEFAULT_URL} onClick={() => patch({ url: DEFAULT_URL })}>
            {t("reset")}
          </button>
        </div>
        {!validUrl && <p className="hint">{t("invalidUrl")}</p>}

        <div className="bar">
          <input
            ref={searchRef}
            className="search"
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("search")}
          />
          <button type="button" className="ghost" onClick={toggleAll} disabled={!shown.length}>
            {allPicked ? t("clearSel") : t("selectAll")}
          </button>
          <button type="button" className="ghost" onClick={load}>
            {t("reload")}
          </button>
        </div>

        {error ? (
          <div className="empty">
            <p>{t("loadError")}</p>
            <small>{error}</small>
            <button type="button" className="ghost" onClick={load}>
              {t("retry")}
            </button>
          </div>
        ) : loading && !profiles.length ? (
          <div aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="sk" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        ) : !shown.length ? (
          <div className="empty">
            <p>{profiles.length ? t("noMatch") : t("noProfiles")}</p>
            {!profiles.length && <small>{t("noProfilesHint")}</small>}
          </div>
        ) : (
          <ul>
            {shown.map((p, i) => (
              <Row
                key={p.dir}
                p={p}
                i={i}
                on={picked.has(p.dir)}
                running={running.has(p.dir)}
                opening={opening.has(p.dir)}
                canOpen={validUrl}
                onToggle={toggle}
                onOpen={open}
                onClose={close}
                t={t}
              />
            ))}
          </ul>
        )}
      </main>

      {toast && (
        <div key={toast.id} className={`toast ${toast.kind === "err" ? "err" : ""}`} role="status">
          {toast.text}
        </div>
      )}

      <footer>
        <div>
          <span className="count">
            {picked.size ? t("selectedCount", { n: picked.size, total: profiles.length }) : t("profiles", { n: shown.length })}
          </span>
          <button type="button" className="ghost danger" disabled={!runTargets.length} onClick={() => close(runTargets)}>
            {!runTargets.length ? t("close") : picked.size ? t("closeSelected", { n: runTargets.length }) : t("closeAll", { n: runTargets.length })}
          </button>
          <button type="button" className="primary" disabled={!validUrl || !targets.length} onClick={() => open(targets)}>
            {picked.size ? t("openSelected", { n: picked.size }) : t("openAll", { n: shown.length })}
          </button>
        </div>
      </footer>
    </>
  );
}
