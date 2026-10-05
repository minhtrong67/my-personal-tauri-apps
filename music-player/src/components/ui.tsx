import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { useStore } from '../lib/store';
import type { MenuItem } from '../lib/types';

export function Icon({ name, fill, size, className = '' }: { name: string; fill?: boolean; size?: number; className?: string }) {
  return (
    <span
      className={`msr ${className}`}
      style={{ fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`, fontSize: size }}
    >
      {name}
    </span>
  );
}

type IBVariant = 'standard' | 'filled' | 'tonal' | 'outlined';
export function IconButton({
  icon, onClick, title, variant = 'standard', size = 'md', active, fill, className = '', disabled, onContextMenu,
}: {
  icon: string; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; title?: string; variant?: IBVariant;
  size?: 'sm' | 'md' | 'lg'; active?: boolean; fill?: boolean; className?: string; disabled?: boolean;
  onContextMenu?: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const dim = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  const isz = size === 'lg' ? 28 : size === 'sm' ? 20 : 24;
  const v =
    variant === 'filled'
      ? 'bg-primary text-on-primary hover:shadow-md hover:brightness-110'
      : variant === 'tonal'
        ? 'bg-secondary-container text-on-secondary-container hover:brightness-95'
        : variant === 'outlined'
          ? 'border border-outline text-on-surface-variant hover:bg-on-surface/[.08]'
          : `${active ? 'text-primary' : 'text-on-surface-variant'} hover:bg-on-surface/[.08] active:bg-on-surface/[.12]`;
  return (
    <button
      type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} onContextMenu={onContextMenu}
      className={`${dim} ${v} rounded-full inline-flex items-center justify-center transition-all duration-150 focus-ring disabled:opacity-40 disabled:pointer-events-none shrink-0 ${className}`}
    >
      <Icon name={icon} fill={fill || active} size={isz} />
    </button>
  );
}

export function Button({
  children, onClick, variant = 'filled', icon, className = '', disabled, danger,
}: {
  children: ReactNode; onClick?: (e: MouseEvent<HTMLButtonElement>) => void; variant?: 'filled' | 'tonal' | 'outlined' | 'text';
  icon?: string; className?: string; disabled?: boolean; danger?: boolean;
}) {
  const v =
    variant === 'filled'
      ? danger ? 'bg-error text-on-error hover:brightness-110' : 'bg-primary text-on-primary hover:shadow-md hover:brightness-110'
      : variant === 'tonal'
        ? 'bg-secondary-container text-on-secondary-container hover:brightness-95'
        : variant === 'outlined'
          ? 'border border-outline text-primary hover:bg-primary/[.08]'
          : `${danger ? 'text-error' : 'text-primary'} hover:bg-primary/[.08]`;
  return (
    <button
      type="button" disabled={disabled} onClick={onClick}
      className={`h-10 ${icon ? 'pl-4 pr-6' : 'px-6'} rounded-full inline-flex items-center justify-center gap-2 text-label-lg transition-all duration-150 focus-ring disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap ${v} ${className}`}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-[52px] h-8 rounded-full border-2 transition-colors duration-200 focus-ring shrink-0 ${checked ? 'bg-primary border-primary' : 'bg-surface-container-highest border-outline'}`}
    >
      <span
        className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ease-emphasized flex items-center justify-center ${checked ? 'left-[22px] w-6 h-6 bg-on-primary' : 'left-1.5 w-4 h-4 bg-outline'}`}
      >
        {checked && <Icon name="check" size={16} className="text-primary" />}
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full border border-outline overflow-hidden">
      {options.map((o, i) => (
        <button
          key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`h-10 px-4 inline-flex items-center gap-2 text-label-lg transition-colors ${i > 0 ? 'border-l border-outline' : ''} ${value === o.value ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface hover:bg-on-surface/[.08]'}`}
        >
          {value === o.value ? <Icon name="check" size={18} /> : o.icon ? <Icon name={o.icon} size={18} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ children, selected, onClick, icon }: { children: ReactNode; selected?: boolean; onClick?: () => void; icon?: string }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`h-8 px-3 rounded-lg inline-flex items-center gap-1.5 text-label-lg border transition-colors whitespace-nowrap ${selected ? 'bg-secondary-container text-on-secondary-container border-transparent' : 'border-outline text-on-surface-variant hover:bg-on-surface/[.08]'}`}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

export function Slider({
  value, min = 0, max = 100, step = 1, onChange, onCommit, className = '', label,
}: {
  value: number; min?: number; max?: number; step?: number; onChange?: (v: number) => void; onCommit?: (v: number) => void; className?: string; label?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range" aria-label={label} className={`m3-slider ${className}`} min={min} max={max} step={step} value={value}
      style={{ ['--pct' as string]: `${pct}%` }}
      onChange={(e) => onChange?.(parseFloat(e.target.value))}
      onPointerUp={(e) => onCommit?.(parseFloat((e.target as HTMLInputElement).value))}
      onKeyUp={(e) => onCommit?.(parseFloat((e.target as HTMLInputElement).value))}
    />
  );
}

export function Modal({ title, children, actions, onClose, wide }: { title: string; children: ReactNode; actions?: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-surface-container-high text-on-surface rounded-m3-xl p-6 shadow-2xl animate-scale-in max-h-[88vh] flex flex-col ${wide ? 'w-[640px]' : 'w-[420px]'} max-w-full`}>
        <h2 className="text-headline-sm mb-4 shrink-0">{title}</h2>
        <div className="overflow-y-auto min-h-0 -mx-2 px-2">{children}</div>
        {actions && <div className="flex justify-end gap-2 mt-6 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

/** Menu ngữ cảnh / dropdown Material 3 */
export function ContextMenu() {
  const menu = useStore((s) => s.menu);
  const close = useStore((s) => s.closeMenu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8)), y: Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8)) });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const down = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [menu, close]);

  if (!menu) return null;
  return (
    <div
      ref={ref} style={{ left: pos.x, top: pos.y }}
      className="fixed z-[60] min-w-[220px] max-w-[320px] py-2 rounded-xl bg-surface-container shadow-xl border border-outline-variant/40 animate-scale-in origin-top-left"
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((it, i) =>
        it.divider ? (
          <div key={i} className="h-px my-2 bg-outline-variant" />
        ) : (
          <button
            key={i} type="button" disabled={it.disabled}
            onClick={() => { close(); it.onClick?.(); }}
            className={`w-full h-12 px-3 flex items-center gap-3 text-body-lg text-left hover:bg-on-surface/[.08] disabled:opacity-40 ${it.danger ? 'text-error' : 'text-on-surface'}`}
          >
            <span className="w-6 flex justify-center text-on-surface-variant">{it.icon && <Icon name={it.icon} size={20} className={it.danger ? 'text-error' : ''} />}</span>
            <span className="truncate text-body-md">{it.label}</span>
          </button>
        ),
      )}
    </div>
  );
}

export function openMenuAt(e: MouseEvent, items: MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  useStore.getState().openMenu(e.clientX, e.clientY, items);
}

export function openMenuBelow(e: MouseEvent<HTMLElement>, items: MenuItem[], alignRight = false) {
  e.stopPropagation();
  const r = e.currentTarget.getBoundingClientRect();
  useStore.getState().openMenu(alignRight ? r.right - 220 : r.left, r.bottom + 4, items);
}

export function Snackbar() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div key={toast.id} className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[70] animate-slide-up">
      <div className="flex items-center gap-3 min-h-[48px] pl-4 pr-2 py-1 rounded-lg bg-inverse-surface text-inverse-on-surface shadow-lg max-w-[560px]">
        <span className="text-body-md py-2">{toast.text}</span>
        {toast.actionLabel && (
          <button className="px-3 h-9 rounded-full text-label-lg text-inverse-primary hover:bg-inverse-on-surface/10" onClick={() => { toast.action?.(); useStore.getState().set({ toast: null }); }}>
            {toast.actionLabel}
          </button>
        )}
        <button className="w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-inverse-on-surface/10" onClick={() => useStore.getState().set({ toast: null })} aria-label="Đóng">
          <Icon name="close" size={20} />
        </button>
      </div>
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return <img src="/icon.png" width={size} height={size} alt="" draggable={false} className="rounded-lg" />;
}
