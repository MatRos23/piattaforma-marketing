const DateRangeFilter = ({
    isOpen,
    setIsOpen,
    dateFilter,
    setDateFilter,
    hasDateRange,
    setIsPresetPanelOpen,
    setIsAdvancedPanelOpen,
}) => {
    const formatDateLabel = (value) => {
        if (!value) return '—';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return parsed.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });
    };

    const label = hasDateRange
        ? `${formatDateLabel(dateFilter.startDate)} → ${formatDateLabel(dateFilter.endDate)}`
        : 'Seleziona periodo';

    return (
        <div className="relative">
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
            <button
                type="button"
                onClick={() => {
                    setIsOpen((prev) => !prev);
                    setIsPresetPanelOpen(false);
                    setIsAdvancedPanelOpen(false);
                }}
                aria-expanded={isOpen}
                className={`inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-white/95 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm shadow-orange-100/60 transition hover:border-orange-300 hover:text-orange-600 ${
                    hasDateRange ? 'ring-2 ring-orange-200' : ''
                }`}
            >
                <Calendar className="h-4 w-4 text-orange-400" />
                <span>{label}</span>
                <ArrowUpDown
                    className={`h-4 w-4 text-orange-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[calc(100vw-3rem)] max-w-[18rem] rounded-3xl border border-white/60 bg-white/95 p-4 shadow-2xl shadow-orange-900/20 backdrop-blur">
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-500">
                                Intervallo date
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                                Imposta il periodo di competenza da includere nella tabella.
                            </p>
                        </div>
                        <div className="space-y-3">
                            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                                Da
                                <input
                                    type="date"
                                    value={dateFilter.startDate}
                                    onChange={(event) =>
                                        setDateFilter((prev) => ({
                                            ...prev,
                                            startDate: event.target.value,
                                        }))
                                    }
                                    className="rounded-xl border border-orange-200 bg-white px-2 py-2 text-xs font-semibold text-amber-700 shadow-inner focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300/40"
                                />
                            </label>
                            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                                A
                                <input
                                    type="date"
                                    value={dateFilter.endDate}
                                    onChange={(event) =>
                                        setDateFilter((prev) => ({
                                            ...prev,
                                            endDate: event.target.value,
                                        }))
                                    }
                                    className="rounded-xl border border-orange-200 bg-white px-2 py-2 text-xs font-semibold text-amber-700 shadow-inner focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300/40"
                                />
                            </label>
                        </div>
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                                className="text-xs font-semibold text-amber-500 transition hover:text-rose-500"
                            >
                                Pulisci
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-600 transition hover:border-orange-300 hover:bg-orange-100"
                            >
                                <Check className="h-3.5 w-3.5" />
                                Chiudi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

