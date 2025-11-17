const AdvancedFiltersDropdown = ({
    isOpen,
    setIsOpen,
    invoiceFilter,
    setInvoiceFilter,
    contractFilter,
    setContractFilter,
    setIsPresetPanelOpen,
    setIsDatePanelOpen,
}) => {
    const hasAdvancedFilters = invoiceFilter !== '' || contractFilter !== '';

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
                    setIsDatePanelOpen(false);
                }}
                aria-expanded={isOpen}
                className={`inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-white/95 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700 shadow-sm shadow-orange-100/60 transition hover:border-orange-300 hover:text-orange-600 ${
                    hasAdvancedFilters ? 'ring-2 ring-orange-200' : ''
                }`}
            >
                <Filter className="h-4 w-4 text-orange-400" />
                Avanzati
                <ArrowUpDown
                    className={`h-4 w-4 text-orange-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[calc(100vw-3rem)] max-w-[20rem] rounded-3xl border border-white/60 bg-white/95 p-4 shadow-2xl shadow-orange-900/25 backdrop-blur">
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-500">
                                Filtri avanzati
                            </p>
                            <p className="text-xs font-medium text-slate-500">
                                Affina la visualizzazione in base a documentazione e contratti.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Stato fattura
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { key: '', label: 'Tutte' },
                                    { key: 'present', label: 'Con fattura' },
                                    { key: 'missing', label: 'Senza fattura' },
                                ].map((option) => {
                                    const active = invoiceFilter === option.key;
                                    return (
                                        <button
                                            key={`invoice-${option.key || 'all'}`}
                                            type="button"
                                            onClick={() => setInvoiceFilter(option.key)}
                                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                                active
                                                    ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-amber-500/30'
                                                    : 'border border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-600'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Stato contratto
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { key: '', label: 'Tutti' },
                                    { key: 'present', label: 'Con contratto' },
                                    { key: 'missing', label: 'Senza contratto' },
                                ].map((option) => {
                                    const active = contractFilter === option.key;
                                    return (
                                        <button
                                            key={`contract-${option.key || 'all'}`}
                                            type="button"
                                            onClick={() => setContractFilter(option.key)}
                                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                                active
                                                    ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-amber-500/30'
                                                    : 'border border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-amber-600'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => {
                                    setInvoiceFilter('');
                                    setContractFilter('');
                                }}
                                className="text-xs font-semibold text-amber-500 transition hover:text-rose-500"
                            >
                                Pulisci filtri
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

