import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

const VARIANT_STYLES = {
    default: 'bg-white border-slate-200/80 hover:border-slate-400/60',
    sector: 'bg-white border-slate-200/80 hover:border-slate-400/60',
    supplier: 'bg-white border-slate-200/80 hover:border-slate-400/60',
    user: 'bg-white border-slate-200/80 hover:border-slate-400/60',
    branch: 'bg-white border-slate-200/80 hover:border-slate-400/60',
};

export default function SettingsListItem({ children, onEdit, onDelete, variant = 'default', className }) {
    const variantClass = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default;

    return (
        <li
            className={cn(
                'group relative flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-4 sm:px-5 sm:py-4 transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50/70',
                variantClass,
                className,
            )}
        >
            <div className="flex-1 min-w-0">{children}</div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {onEdit && (
                    <button
                        type="button"
                        onClick={onEdit}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all hover:-translate-y-[1px] hover:border-slate-300 hover:text-slate-600"
                        title="Modifica"
                    >
                        <Pencil size={16} />
                    </button>
                )}
                {onDelete && (
                    <button
                        type="button"
                        onClick={onDelete}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-all hover:-translate-y-[1px] hover:border-red-200 hover:text-red-600"
                        title="Elimina"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </li>
    );
}
