import React, { useEffect, useMemo, useState } from 'react';
import {
    X,
    UserPlus,
    Users,
    Wallet,
    Building2,
    Layers,
    Calendar,
    CalendarPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';

const EMPLOYMENT_TYPES = [
    { id: 'full_time', label: 'Full-time' },
    { id: 'part_time', label: 'Part-time' },
    { id: 'apprentice', label: 'Apprendistato' },
    { id: 'contractor', label: 'Consulente' },
];

const STATUS_OPTIONS = [
    { id: 'active', label: 'Attivo' },
    { id: 'inactive', label: 'Non attivo' },
];

const MONTHS = [
    { id: '01', label: 'Gennaio' },
    { id: '02', label: 'Febbraio' },
    { id: '03', label: 'Marzo' },
    { id: '04', label: 'Aprile' },
    { id: '05', label: 'Maggio' },
    { id: '06', label: 'Giugno' },
    { id: '07', label: 'Luglio' },
    { id: '08', label: 'Agosto' },
    { id: '09', label: 'Settembre' },
    { id: '10', label: 'Ottobre' },
    { id: '11', label: 'Novembre' },
    { id: '12', label: 'Dicembre' },
];

const CURRENT_MONTH_INDEX = new Date().getMonth();
const CURRENT_MONTH_KEY = MONTHS[CURRENT_MONTH_INDEX]?.id ?? '01';
const CURRENT_YEAR = new Date().getFullYear();
const DEPARTMENT_PLACEHOLDER = 'Es. Officina, Marketing, Vendite...';

const createEmptyMonthsMap = () =>
    MONTHS.reduce((acc, month) => {
        acc[month.id] = '';
        return acc;
    }, {});

const normalizeMonthlyCostsByYear = (initialData) => {
    const byYear = {};

    if (initialData?.monthlyCostsByYear && typeof initialData.monthlyCostsByYear === 'object') {
        Object.entries(initialData.monthlyCostsByYear).forEach(([year, months]) => {
            const normalizedYear = String(year);
            const normalizedMonths = createEmptyMonthsMap();
            if (months && typeof months === 'object') {
                MONTHS.forEach((month) => {
                    const value = months[month.id] ?? months[month.id.toLowerCase()];
                    if (typeof value === 'number') {
                        normalizedMonths[month.id] = value;
                    } else if (value) {
                        const parsed = parseFloat(value);
                        normalizedMonths[month.id] = Number.isFinite(parsed) ? parsed : '';
                    }
                });
            }
            byYear[normalizedYear] = normalizedMonths;
        });
    }

    if (!Object.keys(byYear).length) {
        const fallbackMonths = createEmptyMonthsMap();
        if (initialData?.monthlyCosts && typeof initialData.monthlyCosts === 'object') {
            MONTHS.forEach((month) => {
                const value =
                    initialData.monthlyCosts[month.id] ??
                    initialData.monthlyCosts[month.id.toLowerCase()];
                if (typeof value === 'number') {
                    fallbackMonths[month.id] = value;
                } else if (value) {
                    const parsed = parseFloat(value);
                    fallbackMonths[month.id] = Number.isFinite(parsed) ? parsed : '';
                }
            });
        } else if (typeof initialData?.monthlyCost === 'number') {
            fallbackMonths[CURRENT_MONTH_KEY] = initialData.monthlyCost;
        }
        byYear[String(CURRENT_YEAR)] = fallbackMonths;
    }

    const availableYears = Object.keys(byYear);
    const preferredYear = (() => {
        const defaultYear = initialData?.defaultYear && String(initialData.defaultYear);
        if (defaultYear && byYear[defaultYear]) return defaultYear;
        if (availableYears.includes(String(CURRENT_YEAR))) return String(CURRENT_YEAR);
        return availableYears[0];
    })();

    return { byYear, preferredYear };
};

export default function EmployeeFormModal({
    isOpen,
    onClose,
    onSave,
    initialData,
    branches = [],
    sectors = [],
    initialYear,
}) {
    const [name, setName] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [monthlyCostsByYear, setMonthlyCostsByYear] = useState(() => ({
        [String(CURRENT_YEAR)]: createEmptyMonthsMap(),
    }));
    const [selectedYear, setSelectedYear] = useState(String(initialYear || CURRENT_YEAR));
    const [branchId, setBranchId] = useState('');
    const [sectorId, setSectorId] = useState('');
    const [department, setDepartment] = useState('');
    const [employmentType, setEmploymentType] = useState('full_time');
    const [status, setStatus] = useState('active');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        setName(initialData?.name || '');
        setJobTitle(initialData?.jobTitle || '');

        const { byYear, preferredYear } = normalizeMonthlyCostsByYear(initialData);
        const initialSelectedYear =
            String(initialYear || '') && byYear[String(initialYear)]
                ? String(initialYear)
                : preferredYear;

        setMonthlyCostsByYear(byYear);
        setSelectedYear(initialSelectedYear);

        setBranchId(initialData?.branchId || '');
        setSectorId(initialData?.sectorId || '');
        setDepartment(initialData?.department || '');
        setEmploymentType(initialData?.employmentType || 'full_time');
        setStatus(initialData?.status || 'active');
        setNotes(initialData?.notes || '');
    }, [isOpen, initialData, initialYear]);

    const ensureYearExists = (year) => {
        setMonthlyCostsByYear((prev) => {
            if (prev[year]) return prev;
            return {
                ...prev,
                [year]: createEmptyMonthsMap(),
            };
        });
    };

    const selectedBranch = useMemo(
        () => branches.find((branch) => branch.id === branchId),
        [branches, branchId]
    );

    const allowedSectors = useMemo(() => {
        if (!selectedBranch?.associatedSectors?.length) {
            return sectors;
        }
        return sectors.filter((sector) =>
            selectedBranch.associatedSectors.includes(sector.id)
        );
    }, [selectedBranch, sectors]);

    useEffect(() => {
        if (!allowedSectors.length) return;
        const stillAllowed = allowedSectors.some((sector) => sector.id === sectorId);
        if (!stillAllowed) {
            setSectorId(allowedSectors[0]?.id || '');
        }
    }, [allowedSectors, sectorId]);

    const handleYearChange = (event) => {
        const year = String(event.target.value);
        ensureYearExists(year);
        setSelectedYear(year);
    };

    const handleAddYear = () => {
        const yearInput = window.prompt('Inserisci l\'anno (es. 2026)');
        if (!yearInput) return;
        const normalizedYear = yearInput.trim();
        if (!/^\d{4}$/.test(normalizedYear)) {
            toast.error('Anno non valido. Inserisci un formato a 4 cifre, es. 2026.');
            return;
        }
        ensureYearExists(normalizedYear);
        setSelectedYear(normalizedYear);
    };

    const handleMonthValueChange = (monthId, value) => {
        const safeYear = selectedYear || String(CURRENT_YEAR);
        setMonthlyCostsByYear((prev) => ({
            ...prev,
            [safeYear]: {
                ...(prev[safeYear] || createEmptyMonthsMap()),
                [monthId]: value,
            },
        }));
    };

    const handleSave = () => {
        if (!name.trim()) {
            toast.error('Inserisci il nome del dipendente.');
            return;
        }
        if (!branchId) {
            toast.error('Seleziona un centro di costo.');
            return;
        }

        const normalizedMonthlyCosts = {};
        let hasAtLeastOneValue = false;

        Object.entries(monthlyCostsByYear).forEach(([year, months]) => {
            const normalizedMonths = {};
            MONTHS.forEach((month) => {
                const rawValue = months?.[month.id];
                const parsed =
                    typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
                const numericValue =
                    Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
                if (numericValue > 0) {
                    hasAtLeastOneValue = true;
                }
                normalizedMonths[month.id] = numericValue;
            });
            normalizedMonthlyCosts[year] = normalizedMonths;
        });

        if (!hasAtLeastOneValue) {
            toast.error('Inserisci almeno un costo mensile maggiore di zero.');
            return;
        }

        const safeSelectedYear =
            selectedYear && normalizedMonthlyCosts[selectedYear]
                ? selectedYear
                : Object.keys(normalizedMonthlyCosts)[0];

        const payload = {
            name: name.trim(),
            jobTitle: jobTitle.trim(),
            monthlyCostsByYear: normalizedMonthlyCosts,
            monthlyCosts: normalizedMonthlyCosts[safeSelectedYear],
            monthlyCost:
                normalizedMonthlyCosts[safeSelectedYear]?.[CURRENT_MONTH_KEY] || 0,
            defaultYear: safeSelectedYear,
            branchId,
            sectorId: sectorId || null,
            department: department.trim(),
            employmentType,
            status,
            notes: notes.trim(),
        };

        onSave(payload);
    };

    if (!isOpen) return null;

    const availableYears = Object.keys(monthlyCostsByYear)
        .map((year) => String(year))
        .sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));

    const currentYearMonths =
        monthlyCostsByYear[selectedYear] || createEmptyMonthsMap();

    const isEditing = Boolean(initialData?.id);
    const headerIcon = isEditing ? (
        <Users className="h-5 w-5" />
    ) : (
        <UserPlus className="h-5 w-5" />
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200/60 bg-white/98 shadow-[0_35px_95px_-45px_rgba(15,23,42,0.75)] transition-all">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white">
                    <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-white shadow-inner shadow-black/20">
                            {headerIcon}
                        </div>
                        <div>
                            <h3 className="text-xl font-black">
                                {isEditing ? 'Modifica dipendente' : 'Nuovo dipendente'}
                            </h3>
                            <p className="text-sm font-medium text-white/80">
                                Inserisci le informazioni principali e definisci il costo mensile aziendale
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/80 transition-all hover:bg-white/20 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="max-h-[70vh] space-y-6 overflow-y-auto bg-white px-6 py-6">
                    <section className="grid gap-5 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Nome e cognome
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                                placeholder="Es. Mario Rossi"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Ruolo / Mansione
                            </label>
                            <input
                                type="text"
                                value={jobTitle}
                                onChange={(event) => setJobTitle(event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                                placeholder="Es. Responsabile Vendite"
                            />
                        </div>
                    </section>

                    <section className="grid gap-5 md:grid-cols-4 md:items-end">
                        <div className="flex flex-col gap-2">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Centro di costo
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                                    <Building2 className="h-4 w-4" />
                                </div>
                                <select
                                    value={branchId}
                                    onChange={(event) => setBranchId(event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                                >
                                    <option value="">Seleziona una filiale</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Settore di competenza
                            </label>
                            <select
                                value={sectorId || ''}
                                onChange={(event) => setSectorId(event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                            >
                                <option value="">Non specificato</option>
                                {allowedSectors.map((sector) => (
                                    <option key={sector.id} value={sector.id}>
                                        {sector.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2 flex flex-col gap-2">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Reparto
                            </label>
                            <div className="relative">
                                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                                    <Layers className="h-4 w-4" />
                                </div>
                                <input
                                    type="text"
                                    value={department}
                                    onChange={(event) => setDepartment(event.target.value)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                                    placeholder={DEPARTMENT_PLACEHOLDER}
                                />
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                                <Calendar className="h-4 w-4 text-slate-500" />
                                <span>Anno di competenza</span>
                                <select
                                    value={selectedYear}
                                    onChange={handleYearChange}
                                    className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none"
                                >
                                    {availableYears.map((year) => (
                                        <option key={year} value={year}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddYear}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-800"
                            >
                                <CalendarPlus className="h-4 w-4" />
                                Aggiungi anno
                            </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            {MONTHS.map((month) => (
                                <div key={month.id} className="flex flex-col gap-2">
                                    <label className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                                        {month.label}
                                    </label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                                            <Wallet className="h-4 w-4" />
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            step="50"
                                            value={currentYearMonths[month.id]}
                                            onChange={(event) =>
                                                handleMonthValueChange(month.id, event.target.value)
                                            }
                                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="grid gap-5 md:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Tipo di contratto
                            </label>
                            <select
                                value={employmentType}
                                onChange={(event) => setEmploymentType(event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                            >
                                {EMPLOYMENT_TYPES.map((type) => (
                                    <option key={type.id} value={type.id}>
                                        {type.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Stato
                            </label>
                            <select
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                            >
                                {STATUS_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </section>

                    <section className="flex flex-col gap-2">
                        <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Note interne
                        </label>
                        <textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            rows={4}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                            placeholder="Es. Inserito nel piano di crescita 2025, bonus variabile trimestrale..."
                        />
                    </section>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200/60 bg-slate-50/80 px-6 py-5 md:flex-row md:items-center md:justify-between">
                    <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        <Users className="h-4 w-4" />
                        Gestione risorse umane
                    </div>
                    <div className="flex flex-col-reverse gap-3 md:flex-row">
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-100"
                        >
                            Annulla
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-transform hover:-translate-y-[1px] hover:bg-slate-800"
                        >
                            <Wallet className="h-4 w-4" />
                            {isEditing ? 'Aggiorna' : 'Salva dipendente'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
