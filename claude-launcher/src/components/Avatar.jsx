import { memo, useEffect, useState } from "react";
import { invoke } from "../tauri.js";

// Ảnh tải một lần cho mỗi profile, dùng blob URL thay vì base64
const cache = new Map();
const load = (dir) => {
  if (!cache.has(dir)) {
    cache.set(
      dir,
      invoke("profile_avatar", { dir })
        .then((buf) => URL.createObjectURL(new Blob([buf], { type: "image/png" })))
        .catch(() => null)
    );
  }
  return cache.get(dir);
};

const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const initial = (name) =>
  (name.replace(/^[\d\s\-–.]+/, "") || name).charAt(0).toUpperCase();

export default memo(function Avatar({ p }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let live = true;
    if (p.hasAvatar) load(p.dir).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [p.dir, p.hasAvatar]);

  const h = hue(p.name);
  const bg = `linear-gradient(135deg, hsl(${h} 62% 58%), hsl(${(h + 50) % 360} 58% 42%))`;
  return (
    <span className="av" style={{ background: bg }}>
      {initial(p.name)}
      {src && <img src={src} alt="" decoding="async" />}
    </span>
  );
});
