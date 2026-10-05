import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Danh sách ảo hoá, hàng cao cố định, cuộn cả phần header */
export function VirtualList<T>({
  items, rowHeight, renderRow, header, overscan = 8, initialIndex, className = '', footer,
}: {
  items: T[]; rowHeight: number; renderRow: (item: T, index: number) => ReactNode; header?: ReactNode;
  overscan?: number; initialIndex?: number; className?: string; footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(600);
  const [headH, setHeadH] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHeight(el.clientHeight);
      setHeadH(headRef.current?.offsetHeight ?? 0);
    });
    ro.observe(el);
    if (headRef.current) ro.observe(headRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (initialIndex != null && initialIndex > 0 && ref.current) {
      ref.current.scrollTop = Math.max(0, initialIndex * rowHeight - rowHeight * 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rel = scrollTop - headH;
  const start = Math.max(0, Math.floor(rel / rowHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((rel + height) / rowHeight) + overscan);

  return (
    <div ref={ref} className={`overflow-y-auto overflow-x-hidden ${className}`} onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
      {header && <div ref={headRef}>{header}</div>}
      <div style={{ height: items.length * rowHeight, position: 'relative' }}>
        {items.slice(start, end).map((it, k) => (
          <div key={start + k} style={{ position: 'absolute', top: (start + k) * rowHeight, left: 0, right: 0, height: rowHeight }}>
            {renderRow(it, start + k)}
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}
