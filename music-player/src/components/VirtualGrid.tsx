import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Lưới ảo hoá: số cột tự co giãn theo chiều rộng, mỗi ô vuông cộng thêm phần chữ bên dưới (extraRowH) */
export function VirtualGrid<T>({
  items, renderItem, header, footer, className = '', minCol = 168, extraRowH = 44, padX = 16, overscan = 1,
}: {
  items: T[]; renderItem: (item: T, index: number) => ReactNode; header?: ReactNode; footer?: ReactNode;
  className?: string; minCol?: number; extraRowH?: number; padX?: number; overscan?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [size, setSize] = useState({ w: 900, h: 600 });
  const [headH, setHeadH] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      setHeadH(headRef.current?.offsetHeight ?? 0);
    });
    ro.observe(el);
    if (headRef.current) ro.observe(headRef.current);
    return () => ro.disconnect();
  }, []);

  const avail = Math.max(0, size.w - padX * 2);
  const cols = Math.max(2, Math.floor(avail / minCol));
  const colW = avail / cols;
  const rowH = Math.round(colW + extraRowH);
  const rows = Math.ceil(items.length / cols);
  const rel = scrollTop - headH;
  const start = Math.max(0, Math.floor(rel / rowH) - overscan);
  const end = Math.min(rows, Math.ceil((rel + size.h) / rowH) + overscan);

  const out: ReactNode[] = [];
  for (let r = start; r < end; r++) {
    out.push(
      <div
        key={r}
        style={{ position: 'absolute', top: r * rowH, left: padX, right: padX, height: rowH, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {items.slice(r * cols, (r + 1) * cols).map((it, k) => (
          <div key={r * cols + k} className="min-w-0 h-full">{renderItem(it, r * cols + k)}</div>
        ))}
      </div>,
    );
  }

  return (
    <div ref={ref} className={`overflow-y-auto overflow-x-hidden ${className}`} onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
      {header && <div ref={headRef}>{header}</div>}
      <div style={{ height: rows * rowH, position: 'relative' }}>{out}</div>
      {footer}
    </div>
  );
}
