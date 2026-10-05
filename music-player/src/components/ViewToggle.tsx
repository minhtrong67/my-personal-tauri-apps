import { Icon } from './ui';
import type { ViewMode } from '../lib/types';

/** Nút chuyển chế độ hiển thị: danh sách / lưới */
export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const opts: { m: ViewMode; icon: string; label: string }[] = [
    { m: 'list', icon: 'view_list', label: 'Dạng danh sách' },
    { m: 'grid', icon: 'grid_view', label: 'Dạng ô (lưới)' },
  ];
  return (
    <div className="inline-flex h-10 rounded-full border border-outline overflow-hidden shrink-0" role="group" aria-label="Chế độ hiển thị">
      {opts.map((o, i) => (
        <button
          key={o.m} type="button" title={o.label} aria-label={o.label} aria-pressed={value === o.m} onClick={() => onChange(o.m)}
          className={`w-12 inline-flex items-center justify-center transition-colors ${i > 0 ? 'border-l border-outline' : ''} ${value === o.m ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-on-surface/[.08]'}`}
        >
          <Icon name={o.icon} size={20} fill={value === o.m} />
        </button>
      ))}
    </div>
  );
}
