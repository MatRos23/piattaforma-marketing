{!isOperationsDomain && (
            <section className="relative flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
                <div className="flex flex-col gap-4 rounded-t-3xl border-b border-white/60 bg-gradient-to-r from-orange-400/25 via-white to-orange-100/35 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-500">
                            Spese
                        </p>
                        <h2 className="text-lg font-black text-slate-900">
                            Registro movimenti e documenti
                        </h2>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Totale elementi: {processedExpenses.length}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <div className="flex w-full max-w-xs items-center gap-2 rounded-2xl border border-orange-200 bg-white px-3 py-2 text-amber-700 shadow-sm shadow-orange-100/40">
                            <Search className="h-4 w-4 text-orange-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Ricerca libera"
                                className="w-full appearance-none bg-transparent text-sm font-semibold text-amber-700 placeholder:text-amber-400 focus:outline-none"
                            />
                        </div>
                        <div className="flex min-w-[200px] items-center gap-2 rounded-2xl border border-orange-200 bg-white px-3 py-2 text-amber-700 shadow-sm shadow-orange-100/40">
                            <Layers className="h-4 w-4 text-orange-400" />
                            <select
                                value={selectedSector}
                                onChange={(event) => setSelectedSector(event.target.value)}
                                className="w-full bg-transparent text-sm font-semibold text-amber-700 focus:outline-none"
                            >
                                <option value="all">Tutti i settori</option>
                                {orderedSectors.map((sector) => (
                                    <option key={sector.id} value={sector.id}>
                                        {sector.name || 'N/D'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex min-w-[200px] items-center gap-2 rounded-2xl border border-orange-200 bg-white px-3 py-2 text-amber-700 shadow-sm shadow-orange-100/40">
                            <MapPin className="h-4 w-4 text-orange-400" />
                            <select
                                value={selectedBranch}
                                onChange={(event) => setSelectedBranch(event.target.value)}
                                className="w-full bg-transparent text-sm font-semibold text-amber-700 focus:outline-none"
                            >
                                <option value="all">Tutte le filiali</option>
                                {orderedBranches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.name || 'N/D'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <DateRangeFilter
                            isOpen={isDatePanelOpen}
                            setIsOpen={setIsDatePanelOpen}
                            dateFilter={dateFilter}
                            setDateFilter={setDateFilter}
                            hasDateRange={Boolean(dateFilter.startDate || dateFilter.endDate)}
                            setIsPresetPanelOpen={setIsPresetPanelOpen}
                            setIsAdvancedPanelOpen={setIsAdvancedPanelOpen}
                        />
                        <AdvancedFiltersDropdown
                            isOpen={isAdvancedPanelOpen}
                            setIsOpen={setIsAdvancedPanelOpen}
                            invoiceFilter={invoiceFilter}
                            setInvoiceFilter={setInvoiceFilter}
                            contractFilter={contractFilter}
                            setContractFilter={setContractFilter}
                            setIsPresetPanelOpen={setIsPresetPanelOpen}
                            setIsDatePanelOpen={setIsDatePanelOpen}
                        />
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                {isPresetPanelOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsPresetPanelOpen(false)}
                                        />
                                        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-80 max-w-[calc(100vw-3rem)] rounded-3xl border border-white/50 bg-white/95 p-4 shadow-2xl shadow-orange-900/25 backdrop-blur space-y-4">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-500">
                                                    Preset salvati
                                                </span>
                                                <p className="text-xs font-medium text-slate-500">
                                                    Salva e riutilizza combinazioni di filtri in tutte le pagine.
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                                <input
                                                    type="text"
                                                    value={presetName}
                                                    onChange={(event) => setPresetName(event.target.value)}
                                                    placeholder="Nome preset (es. Direzione Q1)"
                                                    className="w-full rounded-2xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 shadow-inner focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300/40 sm:flex-1"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={savePreset}
                                                    disabled={!presetName.trim()}
                                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <Check className="h-4 w-4" />
                                                    Salva
                                                </button>
                                            </div>
                                            {filterPresets.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {filterPresets.map((preset) => (
                                                        <div
                                                            key={preset.id}
                                                            className="inline-flex items-center gap-2 rounded-2xl border border-orange-100 bg-white px-3 py-1.5 text-sm font-semibold text-amber-700 shadow-sm shadow-orange-100/50"
                                                        >
                                                            <button
                                                                type="button"
                                                                onClick={() => applyPreset(preset)}
                                                                className="transition hover:text-orange-600"
                                                            >
                                                                {preset.name}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => deletePreset(preset.id)}
                                                                className="text-orange-300 transition hover:text-rose-500"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs font-medium text-amber-500/80">
                                                    Nessun preset salvato. Crea il primo per velocizzare i report.
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPresetPanelOpen((prev) => !prev);
                                        setIsAdvancedPanelOpen(false);
                                        setIsDatePanelOpen(false);
                                    }}
                                    aria-expanded={isPresetPanelOpen}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-white/95 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700 shadow-sm shadow-orange-100/50 transition hover:border-orange-300 hover:text-orange-600"
                                >
                                    <SlidersHorizontal className="h-4 w-4 text-orange-400" />
                                    Preset
                                </button>
                            </div>
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-600 shadow-sm shadow-rose-100/40 transition hover:border-rose-400"
                                >
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-600 text-white text-[11px] font-bold">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 20 20"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="h-3.5 w-3.5"
                                        >
                                            <path d="M4 4v5h5" />
                                            <path d="M16 16v-5h-5" />
                                            <path d="M5 9a6 6 0 0 1 9-3.7L16 8" />
                                            <path d="M15 11a6 6 0 0 1-9 3.7L4 12" />
                                        </svg>
                                    </span>
                                    Resetta filtri
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="relative z-10 px-6 pb-6 pt-6 space-y-6">
                    {filterPresets.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-orange-100/80 bg-white/85 px-4 py-3 shadow-inner shadow-orange-100/40">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">
                                Preset rapidi
                            </span>
                            {filterPresets.map((preset) => (
                                <div
                                    key={preset.id}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-white px-3 py-1.5 text-sm font-semibold text-amber-700 shadow-sm shadow-orange-100/40"
                                >
                                    <button
                                        type="button"
                                        onClick={() => applyPreset(preset)}
                                        className="transition hover:text-orange-600"
                                    >
                                        {preset.name}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deletePreset(preset.id)}
                                        className="text-orange-300 transition hover:text-rose-500"
                                    >
                                        <XCircle className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {processedExpenses.length > 0 ? (
                        <div className="overflow-hidden rounded-3xl border border-amber-100/70 shadow-inner shadow-amber-100/70">
                            <ExpenseTableView
                                expenses={processedExpenses}
                                sectorMap={sectorMap}
                                supplierMap={supplierMap}
                                branchMap={branchMap}
                                contractMap={contractMap}
                                onEdit={handleOpenEditModal}
                                onDelete={handleDeleteExpense}
                                onDuplicate={handleDuplicateExpense}
                                canEditOrDelete={canEditOrDelete}
                                showDocuments
                            />
                        </div>
                    ) : (
                        <div className="rounded-3xl border-2 border-dashed border-amber-200 bg-amber-50/30 p-12 text-center">
                            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
                                <Search className="h-8 w-8 text-amber-600" />
                            </div>
                            <h3 className="mb-3 text-xl font-bold text-slate-900">Nessuna spesa trovata</h3>
                            <p className="mb-6 text-sm font-medium text-slate-600">
                                Non ci sono movimenti che corrispondono ai filtri selezionati.
                            </p>
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition-all hover:scale-[1.02]"
                                >
                                    <XCircle className="h-4 w-4" />
                                    Resetta filtri
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </section>
)