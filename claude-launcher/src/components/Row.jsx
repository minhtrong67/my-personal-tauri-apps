import { memo } from "react";
import Avatar from "./Avatar.jsx";

export default memo(function Row({ p, i, on, running, opening, canOpen, onToggle, onOpen, onClose, t }) {
  const busy = opening && !running;
  return (
    <li style={{ "--i": Math.min(i, 10) }} className={on ? "sel" : ""}>
      <button
        type="button"
        className="chk"
        role="checkbox"
        aria-checked={on}
        aria-label={t("selectProfile", { name: p.name })}
        onClick={() => onToggle(p.dir)}
      />
      <button type="button" className="row" disabled={!canOpen} onClick={() => onOpen([p.dir])}>
        <span className="avw">
          <Avatar p={p} />
          {(running || busy) && <i className={`dot ${running ? "live" : "wait"}`} />}
        </span>
        <span className="meta">
          <b>{p.name}</b>
          <small>{p.email || p.dir}</small>
        </span>
        {(running || busy) && (
          <span className={`pill ${running ? "live" : "wait"}`}>{t(running ? "running" : "opening")}</span>
        )}
        <span className="go">{t("open")}</span>
      </button>
      {running && (
        <button type="button" className="shut" onClick={() => onClose([p.dir])}>
          {t("close")}
        </button>
      )}
    </li>
  );
});
