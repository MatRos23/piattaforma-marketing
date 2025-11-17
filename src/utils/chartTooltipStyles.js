const TOOLTIP_THEMES = {
    rose: { border: 'border-rose-100', shadow: 'shadow-rose-100/40' },
    orange: { border: 'border-orange-100', shadow: 'shadow-orange-100/40' },
    emerald: { border: 'border-emerald-100', shadow: 'shadow-emerald-100/40' },
    blue: { border: 'border-blue-100', shadow: 'shadow-blue-100/40' },
    indigo: { border: 'border-indigo-100', shadow: 'shadow-indigo-100/40' },
    slate: { border: 'border-slate-200', shadow: 'shadow-slate-200/40' },
};

export const getTooltipContainerClass = (accent = 'rose') => {
    const theme = TOOLTIP_THEMES[accent] || TOOLTIP_THEMES.rose;
    return `rounded-2xl border ${theme.border} bg-white/95 px-4 py-3 shadow-xl ${theme.shadow} backdrop-blur`;
};
