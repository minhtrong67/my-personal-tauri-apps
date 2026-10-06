import { Icon } from './ui';
import { useT } from '../lib/useT';
import type { ViewMode } from '../lib/types';

/** List / grid switch */
export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const t = useT();
  const opts: { m: ViewMode; icon: string; label: string }[] = [
    { m: 'list', icon: 'view_list', label: t('viewList') },
    { m: 'grid', icon: 'grid_view', label: t('viewGrid') },
  ];
  return (
    <div className="relative inline-flex h-10 rounded-full border border-outline overflow-hidden shrink-0" role="group">
      {/* sliding highlight */}
      <span
        className="absolute inset-y-0 w-1/2 bg-secondary-container transition-transform duration-300 ease-emphasized"
        style={{ transform: `translateX(${value === 'list' ? 0 : 100}%)` }}
      />
      {opts.map((o) => (
        <button
          key={o.m} type="button" title={o.label} aria-label={o.label} aria-pressed={value === o.m} onClick={() => onChange(o.m)}
          className={`relative w-12 inline-flex items-center justify-center transition-colors duration-200 active:scale-90 ${value === o.m ? 'text-on-secondary-container' : 'text-on-surface-variant hover:bg-on-surface/[.08]'}`}
        >
          <Icon name={o.icon} size={20} fill={value === o.m} />
        </button>
      ))}
    </div>
  );
}
