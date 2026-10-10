import { useEffect, useRef } from "react";

function Seg({ label, value, options, onChange }) {
  const idx = Math.max(0, options.findIndex((o) => o.v === value));
  return (
    <div className="seg" role="radiogroup" aria-label={label} style={{ "--n": options.length, "--i": idx }}>
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Opt({ checked, title, hint, onClick }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="opt" onClick={onClick}>
      <i className="radio" />
      <span>
        <b>{title}</b>
        <small>{hint}</small>
      </span>
    </button>
  );
}

export default function SettingsPanel({ t, s, patch, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    // Bấm ra ngoài thì đóng (nút bánh răng tự xử lý việc bật/tắt)
    const away = (e) => {
      if (!ref.current?.contains(e.target) && !e.target.closest?.(".gear")) onClose();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);

  return (
    <section ref={ref} className="panel" role="dialog" aria-label={t("settings")} tabIndex={-1}>
      <h2>{t("settings")}</h2>

      <div className="grp">
        <span className="lbl">{t("language")}</span>
        <Seg
          label={t("language")}
          value={s.lang}
          onChange={(lang) => patch({ lang })}
          options={[
            { v: "vi", l: "Tiếng Việt" },
            { v: "en", l: "English" },
          ]}
        />
      </div>

      <div className="grp">
        <span className="lbl">{t("theme")}</span>
        <Seg
          label={t("theme")}
          value={s.theme}
          onChange={(theme) => patch({ theme })}
          options={[
            { v: "light", l: t("light") },
            { v: "dark", l: t("dark") },
            { v: "system", l: t("system") },
          ]}
        />
      </div>

      <div className="grp">
        <span className="lbl">{t("windowStart")}</span>
        <div className="opts" role="radiogroup" aria-label={t("windowStart")}>
          <Opt
            checked={s.windowMode === "remember"}
            title={t("remember")}
            hint={t("rememberHint")}
            onClick={() => patch({ windowMode: "remember" })}
          />
          <Opt
            checked={s.windowMode === "maximized"}
            title={t("maximized")}
            hint={t("maximizedHint")}
            onClick={() => patch({ windowMode: "maximized" })}
          />
        </div>
        <p className="note">{t("appliesNext")}</p>
      </div>
    </section>
  );
}
