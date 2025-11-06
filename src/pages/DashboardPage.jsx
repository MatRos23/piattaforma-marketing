import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import {
    BarChart3, TrendingUp, DollarSign, Target, AlertTriangle,
    CheckCircle, Layers, Car, Sailboat, Caravan, Building2,
    ChevronRight, ChevronDown, Activity, Award, XCircle, ArrowUpDown, MapPin, Calendar, X, HelpCircle, PieChart
} from 'lucide-react';
import toast from 'react-hot-toast';
import { loadFilterPresets, persistFilterPresets } from '../utils/filterPresets';
import { deriveBranchesForLineItem } from '../utils/branchAssignments';

// ===== UTILITY FUNCTIONS =====
const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '€ 0';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
};

const formatDate = (value) => {
    if (!value) return 'N/D';
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date)) return 'N/D';
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatLabel = (value, fallback = 'N/D') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return fallback;
        const normalized = trimmed.toLowerCase();
        if (normalized === 'non definito' || normalized === 'non-definito' || normalized === 'undefined') {
            return fallback;
        }
        return trimmed;
    }
    return String(value);
};

const getSectorIcon = (sectorName, className = "w-5 h-5") => {
    const icons = {
        'Auto': <Car className={className} />,
        'Camper&Caravan': <Caravan className={className} />,
        'Yachting': <Sailboat className={className} />,
        'Frattin Group': <Building2 className={className} />,
        default: <DollarSign className={className} />
    };
    return icons[sectorName] || icons.default;
};

// ===== UI COMPONENTS =====

const KpiCard = React.memo(({ title, value, icon, gradient, subtitle, trend }) => (
    <div className="group relative flex flex-col gap-4 rounded-3xl border border-slate-200/60 bg-white/95 p-5 lg:p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl overflow-hidden">
        <div className={`absolute inset-x-0 top-0 h-[6px] bg-gradient-to-r ${gradient}`} />
        <div className="flex items-center gap-4">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-lg shadow-indigo-500/20 ring-4 ring-white/60`}>
                {React.cloneElement(icon, { className: "w-6 h-6" })}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-500 uppercase">
                    {title}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl lg:text-3xl font-black text-slate-900">
                        {value}
                    </span>
                    {trend && (
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                            trend.direction === 'up'
                                ? 'text-emerald-500'
                                : trend.direction === 'down'
                                    ? 'text-rose-500'
                                    : 'text-slate-400'
                        }`}>
                            {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '■'} {trend.label}
                        </span>
                    )}
                </div>
                {subtitle && <p className="text-sm font-semibold text-slate-500">{subtitle}</p>}
            </div>
        </div>
    </div>
));

const InfoTooltip = ({ message }) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
            }
        };
        window.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('touchstart', handleClickOutside);
        return () => {
            window.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('touchstart', handleClickOutside);
        };
    }, [open]);

    const handleToggle = (event) => {
        event.stopPropagation();
        setOpen(prev => !prev);
    };

    return (
        <span ref={containerRef} className="relative inline-flex">
            <button
                type="button"
                onClick={handleToggle}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
                <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {open && (
                <div
                    role="tooltip"
                    className="absolute left-1/2 top-full z-30 mt-2 w-max max-w-[260px] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl shadow-slate-900/25"
                    onClick={event => event.stopPropagation()}
                >
                    {message}
                </div>
            )}
        </span>
    );
};

const TOP_SUPPLIERS_LIMIT = 8;

const SectorCard = React.memo(({ sector, onClick, includeProjections }) => {
    const futureProjections = sector.futureProjections || 0;
    const overdueProjections = sector.overdueProjections || 0;
    const totalProjections = includeProjections ? (futureProjections + overdueProjections) : 0;
    const totalValue = sector.spent + totalProjections;
    const displaySectorName = formatLabel(sector.name);
    const hasBudget = sector.budget > 0;
    const utilization = hasBudget ? (totalValue / sector.budget) * 100 : (totalValue > 0 ? Infinity : 0);
    const isOverBudget = !hasBudget ? totalValue > 0 : utilization > 100;
    const isWarning = hasBudget && utilization > 85 && !isOverBudget;
    
    const spendPercentage = hasBudget ? (sector.spent / sector.budget) * 100 : 0;
    const projectionPercentage = hasBudget ? (totalProjections / sector.budget) * 100 : 0;

    const statusStyles = isOverBudget
        ? 'bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200'
        : isWarning
            ? 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200'
            : 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-200';

    const remainingBudget = hasBudget ? sector.budget - totalValue : null;

    return (
        <div
            onClick={onClick}
            className="group relative isolate overflow-hidden rounded-3xl border border-slate-200/60 bg-white/95 shadow-sm transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-2xl"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-slate-900/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute -right-16 -top-24 h-48 w-48 rounded-full bg-indigo-200/20 blur-3xl opacity-0 transition-all duration-500 group-hover:opacity-80 group-hover:-translate-y-4" />

            <div className="relative flex h-full flex-col gap-6 p-6">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/10">
                            {getSectorIcon(sector.name, "w-6 h-6")}
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                                Settore
                            </p>
                            <h3 className="text-lg font-black text-slate-900">
                                {displaySectorName}
                            </h3>
                        </div>
                    </div>
                    <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold tracking-wide ${statusStyles}`}>
                        {hasBudget || totalValue > 0 ? `${Math.min(utilization, 999).toFixed(0)}%` : 'N/D'}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-slate-500">
                        Spesa effettiva
                        <InfoTooltip message="Importo già registrato come spesa per il settore nel periodo considerato." />
                    </div>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatCurrency(sector.spent)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-slate-500">
                        Budget annuo
                        <InfoTooltip message="Budget assegnato al settore per l'anno in corso (o il periodo filtrato)." />
                    </div>
                    <p className="mt-1 text-lg font-black text-slate-900">
                        {hasBudget ? formatCurrency(sector.budget) : 'N/D'}
                        </p>
                    </div>
                    {hasBudget && (
                        <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                Residuo stimato
                                <InfoTooltip message="Budget annuo meno (spesa effettiva + proiezioni). Valore negativo indica superamento del budget." />
                            </div>
                            <p className={`mt-1 text-lg font-black ${remainingBudget >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {formatCurrency(remainingBudget || 0)}
                            </p>
                        </div>
                    )}
                    {includeProjections && totalProjections > 0 && (
                        <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                Proiezioni totali
                                <InfoTooltip message={`Somma tra importi scaduti (${formatCurrency(overdueProjections)}) e residuo futuro (${formatCurrency(futureProjections)}) associati ai contratti del settore.`} />
                            </div>
                            <p className="mt-1 text-lg font-black text-slate-900">
                                {formatCurrency(totalProjections)}
                            </p>
                        </div>
                    )}
                </div>

                {includeProjections && totalProjections > 0 && (
                    <div className="flex flex-wrap gap-3">
                        {overdueProjections > 0 && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span>Scaduto</span>
                                <span className="font-black">{formatCurrency(overdueProjections)}</span>
                            </span>
                        )}
                        {futureProjections > 0 && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-200">
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>Residuo futuro</span>
                                <span className="font-black">{formatCurrency(futureProjections)}</span>
                            </span>
                        )}
                    </div>
                )}

                {hasBudget && (
                    <div className="mt-auto space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            <span>Avanzamento</span>
                            <span>{Math.min(utilization, 999).toFixed(0)}%</span>
                        </div>
                        <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/80">
                            <div
                                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                                    isOverBudget
                                        ? 'bg-gradient-to-r from-rose-500 via-rose-500 to-red-600'
                                        : isWarning
                                            ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-orange-500'
                                            : 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600'
                                }`}
                                style={{ width: `${Math.min(spendPercentage + projectionPercentage, 100)}%` }}
                            />
                            <div
                                className="absolute inset-y-0 left-0 rounded-full bg-white/40"
                                style={{ width: `${Math.min(spendPercentage, 100)}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

const SupplierRankItem = React.memo(({ supplier, rank, baselineCommitted, includeProjections }) => {
    const overdue = supplier.overdueProjections || 0;
    const future = supplier.futureProjections || 0;
    const projectionsTotal = overdue + future;
    const committed = supplier.spent + projectionsTotal;
    const displayCommitted = includeProjections ? committed : supplier.spent;
    const denominator = baselineCommitted > 0 ? baselineCommitted : 0;
    const percentage = denominator > 0 ? (displayCommitted / denominator) * 100 : 0;
    const supplierName = formatLabel(supplier.name);

    const progressTotal = includeProjections ? committed : supplier.spent;
    const safeTotal = progressTotal > 0 ? progressTotal : 1;
    const spentWidth = (supplier.spent / safeTotal) * 100;
    const overdueWidth = includeProjections && committed > 0 ? (overdue / committed) * 100 : 0;
    const futureWidth = includeProjections && committed > 0 ? (future / committed) * 100 : 0;

    return (
        <div className="group relative isolate flex h-full flex-col gap-5 rounded-3xl border border-slate-200/60 bg-white/95 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-slate-900/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute -right-10 -top-16 h-32 w-32 rounded-full bg-indigo-200/20 blur-3xl opacity-0 transition-all duration-500 group-hover:opacity-80 group-hover:-translate-y-2" />

            <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/10">
                        {rank + 1}
                    </div>
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold tracking-[0.28em] text-slate-400">Fornitore</p>
                        <h4 className="max-w-[180px] truncate text-base font-black text-slate-900">{supplierName}</h4>
                    </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 ring-1 ring-inset ring-indigo-200">
                    {percentage.toFixed(1)}%
                    <InfoTooltip message={includeProjections ? `Quota sul totale Top ${TOP_SUPPLIERS_LIMIT} calcolata su spesa effettiva + proiezioni.` : `Quota sul totale Top ${TOP_SUPPLIERS_LIMIT} calcolata sulla sola spesa effettiva.`} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-slate-500">
                        Impegno totale
                        <InfoTooltip message="Spesa effettiva più proiezioni attive per il fornitore nel periodo." />
                    </div>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatCurrency(displayCommitted)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-slate-500">
                        Spesa effettiva
                        <InfoTooltip message="Importo già registrato come spesa per questo fornitore." />
                    </div>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatCurrency(supplier.spent)}</p>
                </div>
            </div>

            {includeProjections && (
                <div className="flex flex-wrap gap-2 text-xs font-semibold tracking-[0.08em]">
                    {overdue > 0 && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-rose-600 ring-1 ring-inset ring-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Scaduto</span>
                            <span className="font-black">{formatCurrency(overdue)}</span>
                        </span>
                    )}
                    {future > 0 && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-600 ring-1 ring-inset ring-indigo-200">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Residuo futuro</span>
                            <span className="font-black">{formatCurrency(future)}</span>
                        </span>
                    )}
                </div>
            )}

            <div className="mt-auto space-y-2">
                <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/80">
                    <div
                        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"
                        style={{ left: '0%', width: `${Math.min(spentWidth, 100)}%` }}
                    />
                    {includeProjections && (
                        <>
                            <div
                                className="absolute inset-y-0 rounded-full bg-gradient-to-r from-rose-400 via-rose-500 to-red-500"
                                style={{
                                    left: `${Math.min(spentWidth, 100)}%`,
                                    width: `${Math.max(0, Math.min(overdueWidth, Math.max(0, 100 - Math.min(spentWidth, 100))))}%`
                                }}
                            />
                            <div
                                className="absolute inset-y-0 rounded-full bg-gradient-to-r from-indigo-400 via-indigo-500 to-purple-500"
                                style={{
                                    left: `${Math.min(spentWidth + overdueWidth, 100)}%`,
                                    width: `${Math.max(0, Math.min(futureWidth, Math.max(0, 100 - Math.min(spentWidth + overdueWidth, 100))))}%`
                                }}
                            />
                        </>
                    )}
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.16em] text-slate-400">
                    <span className="text-emerald-500">Spesa</span>
                    {includeProjections ? (
                        <>
                            <span className="text-rose-500">Scaduto</span>
                            <span className="text-indigo-500">Residuo</span>
                        </>
                    ) : (
                        <span className="text-slate-400">Proiezioni escluse</span>
                    )}
                </div>
            </div>
        </div>
    );
});

const BranchItem = React.memo(({ branch, rank, onClick, totalCommitted, includeProjections }) => {
    const overdue = branch.overdueProjections || 0;
    const future = branch.futureProjections || 0;
    const projectionsTotal = overdue + future;
    const committed = branch.spent + projectionsTotal;
    const displayCommitted = includeProjections ? committed : branch.spent;
    const denominator = totalCommitted > 0 ? totalCommitted : 0;
    const percentage = denominator > 0 ? (displayCommitted / denominator) * 100 : 0;
    const branchName = formatLabel(branch.name);

    const progressTotal = includeProjections ? committed : branch.spent;
    const safeTotal = progressTotal > 0 ? progressTotal : 1;
    const spentWidth = (branch.spent / safeTotal) * 100;
    const overdueWidth = includeProjections && committed > 0 ? (overdue / committed) * 100 : 0;
    const futureWidth = includeProjections && committed > 0 ? (future / committed) * 100 : 0;

    return (
        <div
            onClick={onClick}
            className="group relative isolate flex h-full flex-col gap-5 rounded-3xl border border-slate-200/60 bg-white/95 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-pointer"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-slate-900/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="absolute -right-10 -top-16 h-32 w-32 rounded-full bg-blue-200/20 blur-3xl opacity-0 transition-all duration-500 group-hover:opacity-80 group-hover:-translate-y-2" />

            <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-black shadow-lg shadow-blue-500/20 ring-4 ring-blue-500/10">
                        {rank + 1}
                    </div>
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold tracking-[0.28em] text-slate-400">Filiale</p>
                        <h4 className="max-w-[180px] truncate text-base font-black text-slate-900 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-indigo-400" />
                            {branchName}
                        </h4>
                    </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 ring-1 ring-inset ring-indigo-200">
                    {percentage.toFixed(1)}%
                    <InfoTooltip message={includeProjections ? 'Quota sul totale filiali calcolata su spesa + proiezioni.' : 'Quota calcolata sulla sola spesa effettiva.'} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-slate-500">
                        Impegno totale
                        <InfoTooltip message="Spesa effettiva più proiezioni attive della filiale." />
                    </div>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatCurrency(displayCommitted)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200/60 bg-white/80 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] text-slate-500">
                        Spesa effettiva
                        <InfoTooltip message="Importo già registrato come spesa per la filiale." />
                    </div>
                    <p className="mt-1 text-lg font-black text-slate-900">{formatCurrency(branch.spent)}</p>
                </div>
            </div>

            {includeProjections && (
                <div className="flex flex-wrap gap-2 text-xs font-semibold tracking-[0.08em]">
                    {overdue > 0 && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-rose-600 ring-1 ring-inset ring-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Scaduto</span>
                            <span className="font-black">{formatCurrency(overdue)}</span>
                        </span>
                    )}
                    {future > 0 && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-600 ring-1 ring-inset ring-indigo-200">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Residuo futuro</span>
                            <span className="font-black">{formatCurrency(future)}</span>
                        </span>
                    )}
                </div>
            )}

            <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    <span>Composizione</span>
                    <span>{formatCurrency(displayCommitted)}</span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/80">
                    <div
                        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"
                        style={{ left: '0%', width: `${Math.min(spentWidth, 100)}%` }}
                    />
                    {includeProjections && (
                        <>
                            <div
                                className="absolute inset-y-0 rounded-full bg-gradient-to-r from-rose-400 via-rose-500 to-red-500"
                                style={{
                                    left: `${Math.min(spentWidth, 100)}%`,
                                    width: `${Math.max(0, Math.min(overdueWidth, Math.max(0, 100 - Math.min(spentWidth, 100))))}%`
                                }}
                            />
                            <div
                                className="absolute inset-y-0 rounded-full bg-gradient-to-r from-indigo-400 via-indigo-500 to-purple-500"
                                style={{
                                    left: `${Math.min(spentWidth + overdueWidth, 100)}%`,
                                    width: `${Math.max(0, Math.min(futureWidth, Math.max(0, 100 - Math.min(spentWidth + overdueWidth, 100))))}%`
                                }}
                            />
                        </>
                    )}
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.16em] text-slate-400">
                    <span className="text-emerald-500">Spesa</span>
                    {includeProjections ? (
                        <>
                            <span className="text-rose-500">Scaduto</span>
                            <span className="text-indigo-500">Residuo</span>
                        </>
                    ) : (
                        <span className="text-slate-400">Proiezioni escluse</span>
                    )}
                </div>
            </div>

            <div className="absolute right-5 top-5 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:-translate-y-1">
                <ChevronRight className="w-5 h-5 text-indigo-500" />
            </div>
        </div>
    );
});

// ===== MAIN COMPONENT =====
export default function DashboardPage({ navigate, user }) {
    const [allExpenses, setAllExpenses] = useState([]);
    const [allContracts, setAllContracts] = useState([]);
    const [sectorBudgets, setSectorBudgets] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSector, setSelectedSector] = useState('all');
    const [showProjections, setShowProjections] = useState(true);
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [filterPresets, setFilterPresets] = useState(() => loadFilterPresets());
    const [presetName, setPresetName] = useState('');
    const [isOverdueExpanded, setIsOverdueExpanded] = useState(false);
    
    // ✅ CORREZIONE: Date corrette (1 gen, 31 dic)
    const [startDate, setStartDate] = useState(() => {
        const currentYear = new Date().getFullYear();
        return new Date(currentYear, 0, 1).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        const currentYear = new Date().getFullYear();
        return new Date(currentYear, 11, 31).toISOString().split('T')[0];
    });
    
    const [year, setYear] = useState(() => new Date().getFullYear());
    
    // ✅ CORREZIONE: defaultStartDate e defaultEndDate corretti
    const defaultStartDate = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return new Date(currentYear, 0, 1).toISOString().split('T')[0];
    }, []);
    
    const defaultEndDate = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return new Date(currentYear, 11, 31).toISOString().split('T')[0];
    }, []);
    
    const hasActiveFilters = useMemo(() => {
        return startDate !== defaultStartDate ||
               endDate !== defaultEndDate ||
               selectedSector !== 'all' ||
               selectedBranch !== 'all' ||
               !showProjections;
    }, [startDate, endDate, selectedSector, selectedBranch, showProjections, defaultStartDate, defaultEndDate]);

    useEffect(() => {
        const endYear = new Date(endDate).getFullYear();
        if (endYear !== year) {
            setYear(endYear);
        }
    }, [endDate, year]);

    const filtersLoaded = useRef(false);
    useEffect(() => {
        if (filtersLoaded.current) {
            persistFilterPresets(filterPresets);
        } else {
            filtersLoaded.current = true;
        }
    }, [filterPresets]);

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const sectorNameToId = useMemo(() => new Map(sectors.map(s => [s.name, s.id])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    
    const orderedSectors = useMemo(() => {
        const order = ['Auto', 'Camper&Caravan', 'Yachting', 'Frattin Group'];
        return [...sectors].sort((a, b) => {
            const indexA = order.indexOf(a.name);
            const indexB = order.indexOf(b.name);
            if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }, [sectors]);

    const orderedBranches = useMemo(() => {
        return [...branches].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [branches]);

    useEffect(() => {
        if (!user) return;
        setIsLoading(true);
        
        let expensesQuery = query(collection(db, "expenses"));
        let contractsQuery = query(collection(db, "contracts"));
        
        if (user.role === 'collaborator' && user.assignedChannels && user.assignedChannels.length > 0) {
            if (user.assignedChannels.length <= 10) {
                expensesQuery = query(collection(db, "expenses"), where("supplierId", "in", user.assignedChannels));
                contractsQuery = query(collection(db, "contracts"), where("supplierld", "in", user.assignedChannels));
            }
        }
        
        const unsubs = [
            onSnapshot(expensesQuery, snap => setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(contractsQuery, snap => setAllContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sector_budgets"), where("year", "==", year)), snap => setSectorBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches"), orderBy("name")), snap => {
                setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            })
        ];
        
        return () => unsubs.forEach(unsub => unsub());
    }, [year, user]);

    const metrics = useMemo(() => {
        if (isLoading) return {
            spesaSostenuta: 0,
            spesaPrevista: 0,
            spesaPrevistaTotale: 0,
            spesaPrevistaFutura: 0,
            spesaPrevistaScaduta: 0,
            budgetTotale: 0,
            currentSectorBudget: 0,
            monthlyData: [],
            sectorData: [],
            topSuppliers: [],
            allBranches: [],
            isFullYear: true,
            annualBudgetTotal: 0,
            totalSuppliersSpent: 0,
            totalBranchesSpent: 0,
            overdueEntries: []
        };

        const dayMs = 24 * 60 * 60 * 1000;

        const normalizeDate = (value) => {
            if (!value) return null;
            const d = new Date(value);
            if (isNaN(d)) return null;
            d.setHours(0, 0, 0, 0);
            return d;
        };

        const filterStartDate = normalizeDate(startDate) || new Date(startDate);
        const filterEndDate = normalizeDate(endDate) || new Date(endDate);
        const today = normalizeDate(new Date()) || new Date();

        const totals = { bySupplier: {}, bySector: {}, byBranch: {} };
        const monthlyTotals = Array.from({ length: 12 }, () => ({ real: 0, projected: 0 }));

        const supplierProjectionsTotal = {};
        const supplierFutureProjections = {};
        const supplierOverdueProjections = {};

        const sectorProjectionsTotal = {};
        const sectorFutureProjections = {};
        const sectorOverdueProjections = {};

        const branchProjectionsTotal = {};
        const branchFutureProjections = {};
        const branchOverdueProjections = {};

        let spesaSostenuta = 0;
        let spesaPrevistaTotale = 0;
        let spesaPrevistaFutura = 0;
        let spesaPrevistaScaduta = 0;
        
        const genericoBranchId = branches.find(b => b.name.toLowerCase() === 'generico')?.id;
        
        const branchesPerSector = new Map();
        sectors.forEach(sector => {
            const sectorBranches = branches.filter(b => 
                b.associatedSectors?.includes(sector.id) && 
                b.id !== genericoBranchId
            );
            branchesPerSector.set(sector.id, sectorBranches);
        });

        const normalizeSectorId = (value) => {
            if (!value) return null;
            if (sectorMap.has(value)) return value;
            const mapped = sectorNameToId.get(value);
            return mapped || null;
        };

        // Processa spese
        allExpenses.forEach((expense) => {
            const supplierId = expense.supplierId || expense.supplierld || expense.channelId || expense.channelld;
            const expenseSectorId = normalizeSectorId(expense.sectorId || expense.sectorld);
            
            const expenseDate = expense.date ? new Date(expense.date) : null;
            if (!expenseDate || expenseDate < filterStartDate || expenseDate > filterEndDate) return;
            
            (expense.lineItems || []).forEach(item => {
                const itemAmount = item.amount || 0;
                const itemSectorId = normalizeSectorId(item.sectorId || expenseSectorId);
                if (selectedSector !== 'all' && itemSectorId !== selectedSector) return;
                const sectorName = itemSectorId ? (sectorMap.get(itemSectorId) || 'Sconosciuto') : 'Sconosciuto';
                const associatedBranches = deriveBranchesForLineItem({
                    expense,
                    item,
                    sectorId: itemSectorId,
                    branchMap,
                    branchesPerSector
                });
                const matchesBranchFilter = selectedBranch === 'all' || associatedBranches.includes(selectedBranch);
                if (!matchesBranchFilter) return;
                
                const branchShareFactor = selectedBranch === 'all'
                    ? 1
                    : (associatedBranches.length > 0 ? 1 / associatedBranches.length : 0);
                if (branchShareFactor === 0) return;

                const processAmount = (amount, date) => {
                    if (date >= filterStartDate && date <= filterEndDate) {
                        spesaSostenuta += amount;
                        monthlyTotals[date.getMonth()].real += amount;
                        if (supplierId) totals.bySupplier[supplierId] = (totals.bySupplier[supplierId] || 0) + amount;
                        totals.bySector[sectorName] = (totals.bySector[sectorName] || 0) + amount;
                    }
                };
                
                const processBranchAmount = (amount, date, branchesList) => {
                    if (date >= filterStartDate && date <= filterEndDate) {
                        let targetBranches = branchesList;
                        if (!Array.isArray(targetBranches) || targetBranches.length === 0) return;
                        if (selectedBranch !== 'all') {
                            targetBranches = targetBranches.filter(id => id === selectedBranch);
                        }
                        if (targetBranches.length === 0) return;
                        const amountPerBranch = amount / targetBranches.length;
                        targetBranches.forEach(branchId => {
                            totals.byBranch[branchId] = (totals.byBranch[branchId] || 0) + amountPerBranch;
                        });
                    }
                };
                
                if (expense.isAmortized && expense.amortizationStartDate && expense.amortizationEndDate) {
                    const startDate = new Date(expense.amortizationStartDate);
                    const endDate = new Date(expense.amortizationEndDate);
                    const durationDays = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24) + 1);
                    const dailyAmount = itemAmount / durationDays;
                    
                    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                        const currentDate = new Date(d);
                        const adjustedAmount = dailyAmount * branchShareFactor;
                        processAmount(adjustedAmount, currentDate);
                        processBranchAmount(adjustedAmount, currentDate, associatedBranches);
                    }
                } else {
                    const adjustedAmount = itemAmount * branchShareFactor;
                    processAmount(adjustedAmount, expenseDate);
                    processBranchAmount(adjustedAmount, expenseDate, associatedBranches);
                }
            });
        });
        
        const overdueEntries = [];

        // Calcolo quote contrattuali attese e residui per contratto
        const contractLineItemsMeta = new Map();
        allContracts.forEach(contract => {
            const normalizedLineItems = (contract.lineItems || [])
                .map(lineItem => {
                    const lineItemId = lineItem.id || lineItem.lineItemId || lineItem._key || null;
                    if (!lineItemId) return null;
                    const total = parseFloat(lineItem.totalAmount) || 0;
                    const startDate = normalizeDate(lineItem.startDate);
                    const endDate = normalizeDate(lineItem.endDate);
                    const supplierId = lineItem.supplierId || contract.supplierId || lineItem.supplierld || contract.supplierld || null;
                    const sectorId = normalizeSectorId(lineItem.sectorId || contract.sectorId || lineItem.sectorld || contract.sectorld || null);
                    const branchId = lineItem.branchId || contract.branchId || lineItem.branchld || contract.branchld || null;
                    return {
                        ...lineItem,
                        lineItemId,
                        total,
                        startDate,
                        endDate,
                        supplierId,
                        sectorId,
                        branchId,
                        description: lineItem.description || 'N/D'
                    };
                })
                .filter(Boolean)
                .sort((a, b) => {
                    const startA = a.startDate ? a.startDate.getTime() : 0;
                    const startB = b.startDate ? b.startDate.getTime() : 0;
                    return startA - startB;
                });
            contractLineItemsMeta.set(contract.id, normalizedLineItems);
        });

        const lineItemSpentTotal = new Map();
        const lineItemSpentInFilter = new Map();
        const lineItemSpentUpToToday = new Map();

        const addSpendToMaps = (contractId, lineItemId, amount, referenceDate) => {
            if (!contractId || !lineItemId || !amount) return;
            const key = `${contractId}|${lineItemId}`;
            lineItemSpentTotal.set(key, (lineItemSpentTotal.get(key) || 0) + amount);

            const date = normalizeDate(referenceDate);
            if (!date) return;

            if (date >= filterStartDate && date <= filterEndDate) {
                lineItemSpentInFilter.set(key, (lineItemSpentInFilter.get(key) || 0) + amount);
                if (date <= today) {
                    lineItemSpentUpToToday.set(key, (lineItemSpentUpToToday.get(key) || 0) + amount);
                }
            }
        };

        const allocateAmountToLineItems = (contractId, amount, referenceDate) => {
            if (!contractId || !amount) return;
            const lineItems = contractLineItemsMeta.get(contractId);
            if (!lineItems || lineItems.length === 0) return;

            const date = normalizeDate(referenceDate);
            let targets = lineItems;
            if (date) {
                const active = lineItems.filter(li => li.startDate && li.endDate && date >= li.startDate && date <= li.endDate);
                if (active.length > 0) targets = active;
            }

            const totalActive = targets.reduce((sum, li) => sum + (li.total || 0), 0);
            targets.forEach(li => {
                const proportion = totalActive > 0 ? (li.total || 0) / totalActive : 1 / targets.length;
                const share = amount * proportion;
                addSpendToMaps(contractId, li.lineItemId, share, referenceDate);
            });
        };

        allExpenses.forEach(expense => {
            const lineItems = expense.lineItems || [];
            if (lineItems.length > 0) {
                lineItems.forEach(item => {
                    if (!item.relatedContractId) return;
                    const amount = parseFloat(item.amount) || 0;
                    if (amount === 0) return;
                    const itemSectorId = normalizeSectorId(item.sectorId || expense.sectorId || expense.sectorld);
                    const associatedBranches = deriveBranchesForLineItem({
                        expense,
                        item,
                        sectorId: itemSectorId,
                        branchMap,
                        branchesPerSector
                    });
                    const branchShareFactor = selectedBranch === 'all'
                        ? 1
                        : (associatedBranches.length > 0 ? 1 / associatedBranches.length : 0);
                    if (branchShareFactor === 0) return;
                    const adjustedAmount = amount * branchShareFactor;
                    if (item.relatedLineItemId) {
                        addSpendToMaps(item.relatedContractId, item.relatedLineItemId, adjustedAmount, expense.date);
                    } else {
                        allocateAmountToLineItems(item.relatedContractId, adjustedAmount, expense.date);
                    }
                });
            }
            if (expense.relatedContractId && lineItems.length === 0) {
                const amount = parseFloat(expense.amount) || 0;
                if (amount !== 0) {
                    const branchId = expense.branchId || expense.branchld || null;
                    let branchShareFactor = 1;
                    if (selectedBranch !== 'all') {
                        if (branchId && branchMap.has(branchId)) {
                            branchShareFactor = branchId === selectedBranch ? 1 : 0;
                        } else if (expense.sectorId || expense.sectorld) {
                            const sectorBranches = branchesPerSector.get(normalizeSectorId(expense.sectorId || expense.sectorld)) || [];
                            branchShareFactor = sectorBranches.length > 0 && sectorBranches.some(b => b.id === selectedBranch)
                                ? 1 / sectorBranches.length
                                : 0;
                        } else {
                            branchShareFactor = 0;
                        }
                    }
                    if (branchShareFactor > 0) {
                        allocateAmountToLineItems(expense.relatedContractId, amount * branchShareFactor, expense.date);
                    }
                }
            }
        });

        if (showProjections) {
            allContracts.forEach(contract => {
                const lineItems = contractLineItemsMeta.get(contract.id) || [];
                lineItems.forEach(lineItem => {
                    const { lineItemId, total, startDate, endDate, supplierId, sectorId, branchId, description } = lineItem;
                    if (!supplierId || total <= 0 || !startDate || !endDate || startDate > endDate) return;
                    if (selectedSector !== 'all' && sectorId !== selectedSector) return;

                    const contractBranches = (() => {
                        const ids = new Set();
                        if (branchId && branchMap.has(branchId)) {
                            ids.add(branchId);
                        }
                        if (!branchId && sectorId) {
                            const sectorBranches = branchesPerSector.get(sectorId) || [];
                            sectorBranches.forEach(branch => ids.add(branch.id));
                        }
                        if (!ids.size) {
                            const contractLevelBranch = contract.branchId || contract.branchld;
                            if (contractLevelBranch && branchMap.has(contractLevelBranch)) {
                                ids.add(contractLevelBranch);
                            }
                        }
                        return Array.from(ids);
                    })();

                    if (selectedBranch !== 'all' && !contractBranches.includes(selectedBranch)) {
                        return;
                    }

                    const branchShareFactor = selectedBranch === 'all'
                        ? 1
                        : (contractBranches.length > 0 ? 1 / contractBranches.length : 0);
                    if (branchShareFactor === 0) return;

                    const overlapStart = new Date(Math.max(startDate.getTime(), filterStartDate.getTime()));
                    overlapStart.setHours(0, 0, 0, 0);
                    const overlapEnd = new Date(Math.min(endDate.getTime(), filterEndDate.getTime()));
                    overlapEnd.setHours(0, 0, 0, 0);
                    if (overlapStart > overlapEnd) return;

                    const fullDurationDays = Math.max(1, Math.round((endDate - startDate) / dayMs) + 1);
                    const dailyCost = total / fullDurationDays;

                    const daysOverlap = Math.max(1, Math.round((overlapEnd - overlapStart) / dayMs) + 1);
                    const todayClamped = new Date(Math.min(today.getTime(), overlapEnd.getTime()));
                    let daysElapsed = 0;
                    if (todayClamped >= overlapStart) {
                        daysElapsed = Math.min(daysOverlap, Math.round((todayClamped - overlapStart) / dayMs) + 1);
                    }
                    const daysFuture = Math.max(0, daysOverlap - daysElapsed);

                    const expectedTotalInFilter = dailyCost * daysOverlap;
                    const expectedOverdue = dailyCost * daysElapsed;
                    const expectedFuture = expectedTotalInFilter - expectedOverdue;

                    const key = `${contract.id}|${lineItemId}`;
                    const spentTotal = lineItemSpentTotal.get(key) || 0;
                    const spentInFilter = lineItemSpentInFilter.get(key) || 0;
                    const spentUpToToday = lineItemSpentUpToToday.get(key) || 0;
                    const spentFutureInFilter = Math.max(0, spentInFilter - spentUpToToday);

                    const lineRemaining = Math.max(0, total - spentTotal);
                    if (lineRemaining <= 0) return;

                    const overdueShortfall = Math.max(0, expectedOverdue - spentUpToToday);
                    const futureShortfall = Math.max(0, expectedFuture - spentFutureInFilter);

                    const overdueAmount = Math.min(lineRemaining, overdueShortfall);
                    const futureAmount = Math.min(Math.max(0, lineRemaining - overdueAmount), futureShortfall);

                    if (overdueAmount <= 0 && futureAmount <= 0) return;

                    const adjustedOverdueAmount = overdueAmount * branchShareFactor;
                    const adjustedFutureAmount = futureAmount * branchShareFactor;
                    const adjustedTotalAmount = adjustedOverdueAmount + adjustedFutureAmount;

                    spesaPrevistaTotale += adjustedTotalAmount;
                    spesaPrevistaScaduta += adjustedOverdueAmount;
                    spesaPrevistaFutura += adjustedFutureAmount;

                    const addToBranchTotals = (amount, targetMap) => {
                        if (!amount || amount <= 0) return;
                        let targetBranches = contractBranches;
                        if (!Array.isArray(targetBranches) || targetBranches.length === 0) return;
                        if (selectedBranch !== 'all') {
                            targetBranches = targetBranches.filter(id => id === selectedBranch);
                        }
                        if (targetBranches.length === 0) return;
                        const share = amount / targetBranches.length;
                        targetBranches.forEach(id => {
                            targetMap[id] = (targetMap[id] || 0) + share;
                        });
                    };

                    supplierProjectionsTotal[supplierId] = (supplierProjectionsTotal[supplierId] || 0) + adjustedTotalAmount;
                    if (adjustedOverdueAmount > 0) {
                        supplierOverdueProjections[supplierId] = (supplierOverdueProjections[supplierId] || 0) + adjustedOverdueAmount;
                    }
                    if (adjustedFutureAmount > 0) {
                        supplierFutureProjections[supplierId] = (supplierFutureProjections[supplierId] || 0) + adjustedFutureAmount;
                    }

                    if (sectorId) {
                        sectorProjectionsTotal[sectorId] = (sectorProjectionsTotal[sectorId] || 0) + adjustedTotalAmount;
                        if (adjustedOverdueAmount > 0) {
                            sectorOverdueProjections[sectorId] = (sectorOverdueProjections[sectorId] || 0) + adjustedOverdueAmount;
                        }
                        if (adjustedFutureAmount > 0) {
                            sectorFutureProjections[sectorId] = (sectorFutureProjections[sectorId] || 0) + adjustedFutureAmount;
                        }
                    }

                    addToBranchTotals(adjustedTotalAmount, branchProjectionsTotal);
                    addToBranchTotals(adjustedOverdueAmount, branchOverdueProjections);
                    addToBranchTotals(adjustedFutureAmount, branchFutureProjections);

                    const distributeToMonths = (amount, baseDate, daysCount) => {
                        if (!amount || amount <= 0 || daysCount <= 0) return;
                        const dailyShare = amount / daysCount;
                        for (let i = 0; i < daysCount; i++) {
                            const current = new Date(baseDate);
                            current.setDate(current.getDate() + i);
                            if (current < overlapStart || current > overlapEnd) continue;
                            monthlyTotals[current.getMonth()].projected += dailyShare;
                        }
                    };

                    if (adjustedOverdueAmount > 0 && daysElapsed > 0) {
                        distributeToMonths(adjustedOverdueAmount, overlapStart, daysElapsed);
                    }
                    if (adjustedFutureAmount > 0 && daysFuture > 0) {
                        const futureStart = new Date(overlapStart);
                        futureStart.setDate(futureStart.getDate() + daysElapsed);
                        distributeToMonths(adjustedFutureAmount, futureStart, daysFuture);
                    }

                    if (adjustedOverdueAmount > 0) {
                        overdueEntries.push({
                            contractId: contract.id,
                            contractDescription: contract.description || 'N/D',
                            supplierId,
                            supplierName: supplierMap.get(supplierId) || 'N/D',
                            lineItemDescription: description,
                            sectorName: sectorId ? (sectorMap.get(sectorId) || 'N/D') : 'N/D',
                            branchName: branchId ? (branchMap.get(branchId) || 'N/D') : (sectorId ? 'Generico' : 'N/D'),
                            startDate: overlapStart.toISOString(),
                            endDate: overlapEnd.toISOString(),
                            lineTotal: expectedTotalInFilter * branchShareFactor,
                            lineSpent: spentUpToToday * branchShareFactor,
                            overdueAmount: adjustedOverdueAmount,
                            futureAmount: adjustedFutureAmount,
                            remainingAmount: Math.max(0, (lineRemaining - overdueAmount - futureAmount) * branchShareFactor)
                        });
                    }
                });
            });
        }
        const annualBudgetTotal = sectorBudgets.reduce((sum, sb) => sum + (sb.maxAmount || 0), 0);
        let currentSectorBudget = annualBudgetTotal;
        if (selectedSector !== 'all') {
            const sectorBudgetInfo = sectorBudgets.find(sb => sb.sectorId === selectedSector);
            currentSectorBudget = sectorBudgetInfo?.maxAmount || 0;
        }
        
        let budgetTotale = 0;
        const numberOfDays = (filterEndDate - filterStartDate) / (1000 * 60 * 60 * 24) + 1;
        const isFullYear = numberOfDays > 360;

        if (selectedSector === 'all') {
            budgetTotale = isFullYear ? annualBudgetTotal : (annualBudgetTotal / 365) * numberOfDays;
        } else {
            const sectorBudgetInfo = sectorBudgets.find(sb => sb.sectorId === selectedSector);
            const annualSectorBudget = sectorBudgetInfo?.maxAmount || 0;
            budgetTotale = isFullYear ? annualSectorBudget : (annualSectorBudget / 365) * numberOfDays;
        }

        const monthlyData = monthlyTotals.map((data, i) => ({
            mese: new Date(new Date().getFullYear(), i).toLocaleString('it-IT', { month: 'short' }),
            real: data.real,
            projected: data.projected,
        }));
        
        const sectorData = orderedSectors.map(sector => {
            const budgetInfo = sectorBudgets.find(sb => sb.sectorId === sector.id);
            const spent = totals.bySector[sector.name] || 0;
            const projections = sectorProjectionsTotal[sector.id] || 0;
            const future = sectorFutureProjections[sector.id] || 0;
            const overdue = sectorOverdueProjections[sector.id] || 0;
            let budget = budgetInfo?.maxAmount || 0;
            if (!isFullYear) {
                budget = (budget / 365) * numberOfDays;
            }
            return { id: sector.id, name: sector.name, spent, budget, projections, futureProjections: future, overdueProjections: overdue };
        }).filter(s => s.budget > 0 || s.spent > 0 || s.projections > 0);
            
        const supplierIds = new Set([
            ...Object.keys(totals.bySupplier),
            ...Object.keys(supplierProjectionsTotal)
        ]);

        const suppliersWithTotals = Array.from(supplierIds).map(supplierId => ({
            id: supplierId,
            name: supplierMap.get(supplierId) || 'N/D',
            spent: totals.bySupplier[supplierId] || 0,
            projections: supplierProjectionsTotal[supplierId] || 0,
            futureProjections: supplierFutureProjections[supplierId] || 0,
            overdueProjections: supplierOverdueProjections[supplierId] || 0
        }));

        const sortedSuppliers = suppliersWithTotals
            .filter(s => s.name !== 'N/D' && (s.spent > 0 || s.projections > 0))
            .sort((a, b) => (b.spent + b.projections) - (a.spent + a.projections));

        const allSuppliersTotal = sortedSuppliers.reduce((sum, supplier) => sum + supplier.spent + supplier.projections, 0);
        const topSuppliers = sortedSuppliers.slice(0, TOP_SUPPLIERS_LIMIT);
        const topSuppliersTotal = topSuppliers.reduce((sum, supplier) => sum + supplier.spent + supplier.projections, 0);
        const topSuppliersSpentOnly = topSuppliers.reduce((sum, supplier) => sum + supplier.spent, 0);
        
        const allBranches = Object.entries(totals.byBranch)
            .map(([branchId, spent]) => ({
                id: branchId,
                name: branchMap.get(branchId) || 'N/D',
                spent,
                projections: branchProjectionsTotal[branchId] || 0,
                futureProjections: branchFutureProjections[branchId] || 0,
                overdueProjections: branchOverdueProjections[branchId] || 0
            }))
            .filter(b => b.name !== 'N/D')
            .sort((a, b) => (b.spent + (b.projections || 0)) - (a.spent + (a.projections || 0)));
        const totalBranchesSpent = allBranches.reduce((sum, b) => sum + b.spent + (b.projections || 0), 0);

        return {
            spesaSostenuta,
            spesaPrevista: spesaPrevistaTotale,
            spesaPrevistaTotale,
            spesaPrevistaFutura,
            spesaPrevistaScaduta,
            budgetTotale,
            monthlyData,
            sectorData,
            topSuppliers,
            allBranches,
            isFullYear,
            annualBudgetTotal,
            currentSectorBudget,
            totalSuppliersSpent: topSuppliersTotal,
            topSuppliersSpentOnly,
            suppliersGlobalCommitment: allSuppliersTotal,
            totalBranchesSpent,
            overdueEntries
        };
    }, [isLoading, allExpenses, allContracts, sectorBudgets, startDate, endDate, selectedSector, selectedBranch, sectors, branches, showProjections, supplierMap, sectorMap, sectorNameToId, branchMap, orderedSectors]);
    
    const overdueList = useMemo(() => {
        return (metrics.overdueEntries || []).slice().sort((a, b) => (b.overdueAmount || 0) - (a.overdueAmount || 0));
    }, [metrics.overdueEntries]);

    const overdueSummary = useMemo(() => {
        if (!overdueList.length) {
            return { supplierCount: 0, futureTotal: 0, spentTotal: 0, preview: [] };
        }

        const supplierIds = new Set();
        let futureTotal = 0;
        let spentTotal = 0;

        overdueList.forEach(entry => {
            if (entry.supplierId) {
                supplierIds.add(entry.supplierId);
            }
            futureTotal += entry.futureAmount || 0;
            spentTotal += entry.lineSpent || 0;
        });

        return {
            supplierCount: supplierIds.size,
            futureTotal,
            spentTotal,
            preview: overdueList.slice(0, 3)
        };
    }, [overdueList]);

    const totalForecast = metrics.spesaSostenuta + (showProjections ? metrics.spesaPrevistaTotale : 0);
    const utilizationRate = metrics.budgetTotale > 0 ? (totalForecast / metrics.budgetTotale) * 100 : 0;
    const remainingBudget = metrics.budgetTotale - totalForecast;
    const isOverBudgetRisk = totalForecast > metrics.budgetTotale;
    const topSuppliersProjections = Math.max(0, (metrics.totalSuppliersSpent || 0) - (metrics.topSuppliersSpentOnly || 0));
    const suppliersBaselineTotal = showProjections ? metrics.totalSuppliersSpent : metrics.topSuppliersSpentOnly;
    const branchesSpentOnly = useMemo(
        () => metrics.allBranches.reduce((sum, branch) => sum + (branch.spent || 0), 0),
        [metrics.allBranches]
    );
    const branchesProjectionsTotal = useMemo(
        () => metrics.allBranches.reduce((sum, branch) => sum + (branch.projections || 0), 0),
        [metrics.allBranches]
    );
    const branchesBaselineCommitted = showProjections ? metrics.totalBranchesSpent : branchesSpentOnly;
    const categoryDistribution = useMemo(() => {
        const palette = ['#6366f1', '#8b5cf6', '#22c55e', '#f97316', '#0ea5e9', '#ec4899', '#facc15', '#14b8a6'];
        const usableSectors = metrics.sectorData.filter(sector => (sector.name || '').toLowerCase() !== 'sconosciuto' && (sector.spent || 0) > 0);
        const total = usableSectors.reduce((sum, sector) => sum + (sector.spent || 0), 0);
        if (total <= 0) {
            return { total: 0, segments: [], gradient: '' };
        }
        let cumulative = 0;
        const segments = usableSectors.map((sector, idx) => {
            const amount = sector.spent || 0;
            const percent = amount / total;
            const start = cumulative;
            cumulative += percent;
            return {
                id: sector.id,
                name: sector.name,
                amount,
                percent,
                color: palette[idx % palette.length],
                start,
                end: cumulative
            };
        });
        const gradient = segments
            .map(segment => `${segment.color} ${(segment.start * 100).toFixed(2)}% ${(segment.end * 100).toFixed(2)}%`)
            .join(', ');
        return { total, segments, gradient };
    }, [metrics.sectorData]);

    const categoryProjectionsTotal = useMemo(() => {
        if (!showProjections) return 0;
        return metrics.sectorData.reduce((sum, sector) => {
            return sum + (sector.futureProjections || 0) + (sector.overdueProjections || 0);
        }, 0);
    }, [metrics.sectorData, showProjections]);
    
    const resetFilters = () => {
        const currentYear = new Date().getFullYear();
        setStartDate(new Date(currentYear, 0, 1).toISOString().split('T')[0]);
        setEndDate(new Date(currentYear, 11, 31).toISOString().split('T')[0]);
        setSelectedSector('all');
        setSelectedBranch('all');
        toast.success("Filtri resettati!");
    };

    const savePreset = () => {
        const name = presetName.trim();
        if (!name) {
            toast.error('Inserisci un nome per il preset');
            return;
        }
        const preset = {
            id: Date.now(),
            name,
            startDate,
            endDate,
            selectedSector,
            selectedBranch,
            showProjections
        };
        setFilterPresets(prev => {
            const withoutDuplicates = prev.filter(p => p.name.toLowerCase() !== name.toLowerCase());
            return [...withoutDuplicates, preset];
        });
        setPresetName('');
        toast.success('Preset salvato');
    };

    const applyPreset = (preset) => {
        setStartDate(preset.startDate || defaultStartDate);
        setEndDate(preset.endDate || defaultEndDate);
        setSelectedSector(preset.selectedSector || 'all');
        setSelectedBranch(preset.selectedBranch || 'all');
        setShowProjections(preset.showProjections !== undefined ? preset.showProjections : true);
        toast.success(`Preset "${preset.name}" applicato`);
    };

    const deletePreset = (id) => {
        setFilterPresets(prev => prev.filter(p => p.id !== id));
        toast.success('Preset eliminato');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <div className="text-xl font-semibold text-gray-700">Caricamento dashboard...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="relative p-4 lg:p-8 space-y-6">
                
                {/* HEADER */}
                <div className="space-y-6">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl border border-white/20 p-6 lg:p-10">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_55%)]" />
                        <div className="relative flex flex-col gap-5">
                            <div className="flex items-center gap-4">
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg shadow-indigo-900/30 ring-4 ring-white/25">
                                    <BarChart3 className="w-7 h-7 lg:w-8 lg:h-8" />
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.4em] text-white/70 font-semibold">Dashboard</p>
                                    <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black leading-tight">
                                        Marketing Control Center
                                    </h1>
                                </div>
                            </div>
                            <p className="text-sm lg:text-base text-white/85 max-w-3xl">
                                Monitora budget, spese e proiezioni in tempo reale. I filtri selezionati vengono condivisi con tutte le sezioni della piattaforma per mantenere la stessa vista analitica.
                            </p>
                        </div>
                    </div>
                    
                    {/* FILTERS */}
                    <div className="w-full lg:w-auto bg-gradient-to-br from-slate-50 via-white to-white backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-5 lg:p-6 space-y-5">
                        <div className="flex items-start gap-4">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/15">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-black text-slate-900">Filtri Dashboard</h2>
                                    <InfoTooltip message="Applica intervalli temporali, settori e proiezioni per personalizzare tutti i dati della dashboard." />
                                </div>
                                <p className="mt-1 text-sm font-medium text-slate-600">
                                    Le impostazioni selezionate si riflettono in tutte le sezioni sottostanti.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                            <div className="flex flex-col gap-3">
                                <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                    Periodo
                                </span>
                                <div className="flex flex-wrap items-center gap-3">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner"
                                    />
                                    <span className="text-slate-400 font-semibold text-sm">→</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                    Settori
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => setSelectedSector('all')}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                            selectedSector === 'all'
                                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Layers className="w-4 h-4" />
                                        Tutti i Settori
                                    </button>
                                    {orderedSectors.map(sector => {
                                        const isActive = selectedSector === sector.id;
                                        return (
                                            <button
                                                key={sector.id}
                                                onClick={() => setSelectedSector(sector.id)}
                                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                                    isActive
                                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30'
                                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {getSectorIcon(sector.name, `w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`)}
                                                {sector.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex flex-col gap-3">
                                <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                    Filiali
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        onClick={() => setSelectedBranch('all')}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                            selectedBranch === 'all'
                                                ? 'bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-lg shadow-slate-500/30'
                                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <MapPin className="w-4 h-4" />
                                        Tutte le filiali
                                    </button>
                                    {orderedBranches.map(branch => (
                                        <button
                                            key={branch.id}
                                            onClick={() => setSelectedBranch(branch.id)}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                                                selectedBranch === branch.id
                                                    ? 'bg-gradient-to-r from-slate-600 to-slate-800 text-white shadow-lg shadow-slate-500/30'
                                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            <MapPin className="w-4 h-4" />
                                            {branch.name || 'N/D'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <span className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                                Preset salvati
                            </span>
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <input
                                    type="text"
                                    value={presetName}
                                    onChange={(e) => setPresetName(e.target.value)}
                                    placeholder="Nome preset (es. Q1 Board)"
                                    className="flex-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                    onClick={savePreset}
                                    disabled={!presetName.trim()}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Salva preset
                                </button>
                            </div>
                            {filterPresets.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {filterPresets.map(preset => (
                                        <div key={preset.id} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-1.5 shadow-sm">
                                            <button
                                                type="button"
                                                onClick={() => applyPreset(preset)}
                                                className="text-sm font-semibold text-slate-600 hover:text-indigo-600"
                                            >
                                                {preset.name}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => deletePreset(preset.id)}
                                                className="text-slate-400 hover:text-rose-500"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs font-medium text-slate-400">
                                    Salva una combinazione di filtri per riutilizzarla rapidamente nelle altre pagine.
                                </p>
                            )}
                        </div>

                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => setShowProjections(prev => !prev)}
                                className="inline-flex items-center gap-3 rounded-2xl border border-indigo-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:border-indigo-300"
                                aria-pressed={showProjections}
                            >
                                <TrendingUp className={`w-4 h-4 ${showProjections ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span>Includi proiezioni</span>
                                <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${showProjections ? 'bg-indigo-500/90' : 'bg-slate-300'}`}>
                                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${showProjections ? 'translate-x-5' : 'translate-x-1'}`} />
                                </span>
                            </button>

                            {hasActiveFilters && (
                                <button
                                    onClick={resetFilters}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition-all hover:scale-105"
                                >
                                    <X className="w-4 h-4" />
                                    Reset filtri
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {selectedBranch === 'all' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                        <KpiCard
                            title={metrics.isFullYear ? "Budget totale anno" : "Budget del periodo"}
                            value={formatCurrency(metrics.budgetTotale)}
                            subtitle={`${metrics.sectorData.length} settori attivi`}
                            icon={<Target />}
                            gradient="from-indigo-500 via-indigo-500 to-purple-600"
                        />
                        <KpiCard
                            title="Spesa effettiva"
                            value={formatCurrency(metrics.spesaSostenuta)}
                            subtitle={`${utilizationRate.toFixed(1)}% utilizzato`}
                            icon={<DollarSign />}
                            gradient="from-emerald-500 via-emerald-500 to-green-600"
                        />
                        <KpiCard
                            title="Proiezioni contratti"
                            value={formatCurrency(showProjections ? metrics.spesaPrevistaTotale : 0)}
                            subtitle={showProjections ? "Da contratti attivi" : "Disabilitate"}
                            icon={<TrendingUp />}
                            gradient="from-cyan-500 via-cyan-500 to-blue-600"
                        />
                        <KpiCard
                            title={isOverBudgetRisk ? "Sforamento previsto" : "Budget residuo"}
                            value={formatCurrency(Math.abs(remainingBudget))}
                            subtitle={isOverBudgetRisk ? "⚠️ Attenzione richiesta" : "Disponibile"}
                            icon={isOverBudgetRisk ? <AlertTriangle /> : <CheckCircle />}
                            gradient={isOverBudgetRisk ? "from-red-500 via-red-500 to-rose-600" : "from-amber-500 via-amber-500 to-orange-500"}
                        />
                    </div>
                )}

                {/* ✅ GRAFICO MENSILE CORRETTO */}
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/15">
                                <Activity className="w-6 h-6 lg:w-7 lg:h-7" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl lg:text-2xl font-black text-gray-900">Andamento Spesa Mensile</h2>
                                    <InfoTooltip message="Confronto mensile tra spesa realizzata, proiezioni e budget medio assegnato." />
                                </div>
                                <p className="mt-2 text-sm lg:text-base text-gray-600 font-medium">
                                    Valori aggregati per mese con linea di riferimento del budget medio.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-[0.08em] text-slate-600">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 ring-1 ring-inset ring-slate-200">
                                <span className="inline-block h-2.5 w-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-600" />
                                Spesa effettiva
                            </span>
                            {showProjections && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 ring-1 ring-inset ring-slate-200">
                                    <span className="inline-block h-2.5 w-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600" />
                                    Proiezioni
                                </span>
                            )}
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 ring-1 ring-inset ring-slate-200">
                                <span className="inline-block h-2.5 w-8 rounded-full bg-red-400" />
                                Budget medio
                            </span>
                        </div>
                    </div>
                    
                    {(() => {
                        const monthlyDataWithTotal = metrics.monthlyData.map(m => ({
                            ...m,
                            total: m.real + (showProjections ? m.projected : 0)
                        }));
                        
                        const monthlyAvgBudget = metrics.currentSectorBudget / 12;
                        const totalForecastYear = monthlyDataWithTotal.reduce((sum, m) => sum + m.total, 0);
                        const maxMonthValue = Math.max(...monthlyDataWithTotal.map(m => m.total), 0);
                        const maxMonth = monthlyDataWithTotal.find(m => m.total === maxMonthValue) || monthlyDataWithTotal[0] || { mese: 'N/D', total: 0 };
                        const currentCalendar = new Date();
                        const sameYear = new Date(endDate).getFullYear() === currentCalendar.getFullYear();
                        const displayMax = Math.max(maxMonthValue, monthlyAvgBudget);
                        const budgetPercentage = displayMax > 0 ? (monthlyAvgBudget / displayMax) * 100 : 0;

                        return (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                                    <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                            Totale anno
                                        </div>
                                        <p className="mt-2 text-lg font-black text-slate-900">
                                            {formatCurrency(totalForecastYear)}
                                        </p>
                                        <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-400">
                                            Spesa + proiezioni
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                            Budget medio mensile
                                        </div>
                                        <p className="mt-2 text-lg font-black text-slate-900">
                                            {formatCurrency(monthlyAvgBudget)}
                                        </p>
                                        <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-400">
                                            {metrics.sectorData.length} settori attivi
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                            Picco mensile
                                        </div>
                                        <p className="mt-2 text-lg font-black text-slate-900">
                                            {formatCurrency(maxMonthValue)}
                                        </p>
                                        <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-400">
                                            {maxMonth?.mese || 'N/D'}
                                        </p>
                                    </div>
                                </div>

                                <div className="relative pt-4 border-t border-slate-200/70">
                                    <div className="h-64 relative">
                                        <div className="h-[89%] relative flex items-end justify-between gap-2">
                                            {monthlyAvgBudget > 0 && (
                                                <div
                                                    className="absolute left-0 right-0 border-t-2 border-dashed border-red-400/70 z-10"
                                                    style={{ bottom: `${budgetPercentage}%` }}
                                                >
                                                    <span className="absolute -top-2 right-0 text-[10px] font-semibold text-red-500 bg-white/70 backdrop-blur-sm px-2 py-0.5 rounded-full">
                                                        Budget medio
                                                    </span>
                                                </div>
                                            )}
                                            
                                            {monthlyDataWithTotal.map((month, i) => {
                                                const barHeight = displayMax > 0 ? (month.total / displayMax) * 100 : 0;
                                                const realHeight = month.total > 0 ? (month.real / month.total) * 100 : 0;
                                                const isCurrentMonth = sameYear && i === currentCalendar.getMonth();
                                                
                                                return (
                                                    <div key={month.mese} className="h-full flex-1 flex flex-col items-center justify-end group relative">
                                                        <div className="absolute bottom-full mb-2 w-max max-w-[220px] rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                                                            <p className="font-black text-sm">{month.mese}</p>
                                                            <p className="mt-1 text-emerald-300">Totale: {formatCurrency(month.total)}</p>
                                                            <p className="text-white/80">Effettiva: {formatCurrency(month.real)}</p>
                                                            {showProjections && <p className="text-white/80">Proiezioni: {formatCurrency(month.projected)}</p>}
                                                            <p className="text-white/60">Budget medio: {formatCurrency(monthlyAvgBudget)}</p>
                                                        </div>
                                                        
                                                        <div
                                                            className={`w-[70%] rounded-t-xl transition-all duration-300 ${isCurrentMonth ? 'ring-4 ring-indigo-200' : ''}`}
                                                            style={{ height: `${barHeight}%` }}
                                                        >
                                                            <div className="relative h-full w-full overflow-hidden rounded-t-xl bg-gradient-to-t from-indigo-500 to-purple-600">
                                                                <div
                                                                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-amber-500 to-orange-600"
                                                                    style={{ height: `${realHeight}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        <div className="h-[11%] flex items-start justify-between gap-2 pt-2">
                                            {monthlyDataWithTotal.map((month, i) => {
                                                const isCurrentMonth = sameYear && i === currentCalendar.getMonth();
                                                return (
                                                    <div key={`label-${month.mese}`} className="flex-1 text-center">
                                                        <span className={`text-xs font-bold ${isCurrentMonth ? 'text-indigo-600' : 'text-gray-600'}`}>
                                                            {month.mese}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>

                {categoryDistribution.segments.length > 0 && selectedSector === 'all' && (
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8 space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/15">
                                <PieChart className="w-6 h-6 lg:w-7 lg:h-7" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl lg:text-2xl font-black text-gray-900">Distribuzione per settore</h2>
                                    <InfoTooltip message="Ripartizione dell'impegno economico per settore, con proiezioni incluse se abilitate." />
                                </div>
                                <p className="mt-2 text-sm text-gray-600 font-medium">
                                    Peso percentuale della spesa effettiva per ciascun settore; le eventuali proiezioni attive sono riportate al centro.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col lg:flex-row items-stretch gap-6">
                            <div className="flex items-center justify-center">
                                <div className="relative h-48 w-48">
                                    <div
                                        className="absolute inset-0 rounded-full shadow-inner"
                                        style={{ background: `conic-gradient(${categoryDistribution.gradient})` }}
                                    />
                                    <div className="absolute inset-[22%] rounded-full bg-white/95 shadow flex flex-col items-center justify-center text-center px-4">
                                        <span className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">Spesa effettiva</span>
                                        <span className="text-lg font-black text-slate-900">{formatCurrency(categoryDistribution.total)}</span>
                                        {showProjections && categoryProjectionsTotal > 0 && (
                                            <span className="text-[10px] font-semibold text-slate-400">
                                                +{formatCurrency(categoryProjectionsTotal)} proiezioni
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 grid sm:grid-cols-2 gap-3">
                                {categoryDistribution.segments.map(segment => (
                                    <div key={segment.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: segment.color }} />
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-slate-700 truncate">{segment.name}</p>
                                                <p className="text-[11px] font-semibold text-slate-400">
                                                    {(segment.percent * 100).toFixed(1)}% · {formatCurrency(segment.amount)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* PERFORMANCE SETTORI */}
                {selectedSector === 'all' && selectedBranch === 'all' && (
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8 space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/15">
                                    <Layers className="w-6 h-6 lg:w-7 lg:h-7" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-2xl lg:text-3xl font-black text-gray-900">Performance per Settore</h2>
                                        <InfoTooltip message="Panoramica dell'utilizzo budget dei settori nel periodo filtrato." />
                                    </div>
                                    <p className="mt-2 text-sm lg:text-base text-gray-600 font-medium">
                                        Analisi dettagliata dell'utilizzo budget per business unit.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate && navigate('expenses')}
                                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 lg:px-6 py-2 lg:py-3 text-sm lg:text-base font-bold text-white transition-all hover:scale-105 hover:shadow-lg"
                            >
                                Vedi Spese
                                <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                    Budget attivo
                                    <InfoTooltip message="Budget complessivo disponibile per i settori nel periodo selezionato." />
                                </div>
                                <p className="mt-2 text-lg font-black text-slate-900">
                                    {formatCurrency(metrics.budgetTotale)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.18em]">
                                    Spesa effettiva
                                    <InfoTooltip message="Somma delle spese già registrate nei settori attivi." />
                                </div>
                                <p className="mt-2 text-lg font-black text-slate-900">
                                    {formatCurrency(metrics.spesaSostenuta)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.18em]">
                                    Proiezioni attive
                                    <InfoTooltip message="Quote future o scadute legate ai contratti dei settori. Visibili solo se le proiezioni sono abilitate." />
                                </div>
                                <p className={`mt-2 text-lg font-black ${showProjections ? 'text-slate-900' : 'text-slate-300'}`}>
                                    {showProjections ? formatCurrency(metrics.spesaPrevistaTotale) : '—'}
                                </p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
                            {metrics.sectorData.map(sector => (
                                <SectorCard
                                    key={sector.id}
                                    sector={sector}
                                    includeProjections={showProjections}
                                    onClick={() => {
                                        setSelectedSector(sector.id);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}
                
                {/* TOP FORNITORI */}
                {metrics.topSuppliers.length > 0 && (
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8 space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-lg shadow-amber-500/20 ring-4 ring-amber-500/15">
                                    <Award className="w-7 h-7" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl lg:text-2xl font-black text-gray-900">Top {TOP_SUPPLIERS_LIMIT} Fornitori</h2>
                                        <InfoTooltip message="Classifica basata sull'impegno complessivo (spesa effettiva + proiezioni attive) dei fornitori nel periodo filtrato." />
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600 font-medium">
                                        Monitoraggio dei partner con maggiore esposizione economica.
                                    </p>
                                </div>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-bold tracking-[0.16em] text-slate-600 ring-1 ring-inset ring-slate-200">
                                Aggiornato al {formatDate(endDate)}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm flex h-full flex-col">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.18em]">
                                    Impegno Top {TOP_SUPPLIERS_LIMIT}
                                    <InfoTooltip message={showProjections ? `Somma di spesa effettiva e proiezioni per i primi ${TOP_SUPPLIERS_LIMIT} fornitori.` : `Somma della sola spesa effettiva per i primi ${TOP_SUPPLIERS_LIMIT} fornitori.`} />
                                </div>
                                <p className="mt-auto pt-2 text-lg font-black text-slate-900">
                                    {formatCurrency(showProjections ? metrics.totalSuppliersSpent : metrics.topSuppliersSpentOnly)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm flex h-full flex-col">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.18em]">
                                    Spesa effettiva
                                    <InfoTooltip message={`Totale della spesa già registrata per i fornitori Top ${TOP_SUPPLIERS_LIMIT}.`} />
                                </div>
                                <p className="mt-auto pt-2 text-lg font-black text-slate-900">
                                    {formatCurrency(metrics.topSuppliersSpentOnly)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm flex h-full flex-col">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.18em]">
                                    Proiezioni attive
                                    <InfoTooltip message={`Quote contrattuali future o scadute ancora da coprire per i fornitori Top ${TOP_SUPPLIERS_LIMIT}.`} />
                                </div>
                                <p className={`mt-auto pt-2 text-lg font-black ${showProjections ? 'text-slate-900' : 'text-slate-300'}`}>
                                    {showProjections ? formatCurrency(topSuppliersProjections) : '—'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            {metrics.topSuppliers.map((supplier, index) => (
                                <SupplierRankItem
                                    key={supplier.id}
                                    supplier={supplier}
                                    rank={index}
                                    baselineCommitted={suppliersBaselineTotal}
                                    includeProjections={showProjections}
                                />
                            ))}
                        </div>
                    </div>
                )}
                
                {/* CLASSIFICA FILIALI */}
                {metrics.allBranches.length > 0 && selectedBranch === 'all' && (
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8 space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-500 text-white shadow-lg shadow-blue-500/20 ring-4 ring-blue-500/15">
                                    <MapPin className="w-6 h-6 lg:w-7 lg:h-7" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl lg:text-2xl font-black text-gray-900">Performance Filiali</h2>
                                        <InfoTooltip message="Classifica delle filiali basata sull'impegno economico (spesa + proiezioni) nel periodo." />
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600 font-medium">
                                        Tutte le sedi aziendali ordinate per spesa e contratti attivi.
                                    </p>
                                </div>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-xs font-bold tracking-[0.16em] text-slate-600 ring-1 ring-inset ring-slate-200">
                                {metrics.allBranches.length} filiali attive
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm flex h-full flex-col">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                    Impegno filiali
                                    <InfoTooltip message="Somma di spesa e proiezioni di tutte le filiali attive." />
                                </div>
                                <p className="mt-auto pt-2 text-lg font-black text-slate-900">
                                    {formatCurrency(showProjections ? metrics.totalBranchesSpent : branchesSpentOnly)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm flex h-full flex-col">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.18em]">
                                    Spesa effettiva
                                    <InfoTooltip message="Importo contabile già registrato sulle filiali." />
                                </div>
                                <p className="mt-auto pt-2 text-lg font-black text-slate-900">
                                    {formatCurrency(branchesSpentOnly)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm flex h-full flex-col">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.18em]">
                                    Proiezioni attive
                                    <InfoTooltip message="Residuo futuro e importi scaduti dei contratti associati alle filiali." />
                                </div>
                                <p className={`mt-auto pt-2 text-lg font-black ${showProjections ? 'text-slate-900' : 'text-slate-300'}`}>
                                    {showProjections ? formatCurrency(branchesProjectionsTotal) : '—'}
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                            {metrics.allBranches.map((branch, index) => (
                                <BranchItem 
                                    key={branch.id} 
                                    branch={branch} 
                                    rank={index}
                                    onClick={() => {
                                        if (navigate) {
                                            navigate('expenses', { branchId: branch.id });
                                        }
                                    }}
                                    totalCommitted={branchesBaselineCommitted}
                                    includeProjections={showProjections}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {showProjections && overdueList.length > 0 && (
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/30 p-6 lg:p-8 space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                            <div className="flex items-start gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 via-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/20 ring-4 ring-rose-500/15">
                                    <AlertTriangle className="w-6 h-6 lg:w-7 lg:h-7" />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h2 className="text-xl lg:text-2xl font-black text-gray-900">Impegni Scaduti</h2>
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-bold tracking-[0.16em] text-slate-600 ring-1 ring-inset ring-slate-200">
                                            {overdueList.length} voci aperte
                                        </div>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600 font-medium">
                                        Voci oltre la data programmata senza copertura di spesa registrata.
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
                                <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 text-sm shadow-sm">
                                    <p className="text-xs font-semibold text-gray-500 tracking-wide">
                                        Spesa registrata
                                    </p>
                                    <p className="text-lg font-black text-gray-900">
                                        {formatCurrency(overdueSummary.spentTotal)}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 text-sm shadow-sm">
                                    <p className="text-xs font-semibold text-gray-500 tracking-wide">
                                        Residuo medio
                                    </p>
                                    <p className="text-lg font-black text-gray-900">
                                        {formatCurrency(overdueList.length ? metrics.spesaPrevistaScaduta / overdueList.length : 0)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm flex flex-col justify-between">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                    Totale scaduto
                                    <InfoTooltip message="Somma delle quote già scadute e non ancora coperte da spesa per tutte le voci elencate." />
                                </div>
                                <p className="mt-2 text-lg font-black text-slate-900">
                                    {formatCurrency(metrics.spesaPrevistaScaduta)}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                    Residuo futuro
                                    <InfoTooltip message="Importo residuo pianificato oltre la data odierna per le stesse voci contrattuali." />
                                </div>
                                <p className="mt-2 text-lg font-black text-slate-900">
                                    {overdueSummary.futureTotal > 0 ? formatCurrency(overdueSummary.futureTotal) : '—'}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-slate-200/60 bg-white/90 px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                    Fornitori coinvolti
                                    <InfoTooltip message="Numero di fornitori coinvolti negli impegni scaduti presenti in questo elenco." />
                                </div>
                                <p className="mt-2 text-lg font-black text-slate-900">
                                    {overdueSummary.supplierCount}
                                </p>
                            </div>
                        </div>

                        <div>
                            <p className="text-[11px] font-bold text-slate-500 tracking-[0.16em] uppercase mb-3">
                                Voci più critiche
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                                {overdueSummary.preview.map((entry, index) => (
                                    <div
                                        key={`${entry.contractId}-${entry.lineItemDescription}-preview-${index}`}
                                        className="relative rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-sm"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-gray-900 truncate">
                                                    {entry.supplierName}
                                                </p>
                                                <p className="text-xs text-gray-500 truncate">{entry.lineItemDescription}</p>
                                            </div>
                                            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200 whitespace-nowrap">
                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                {formatCurrency(entry.overdueAmount)}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold tracking-[0.08em] text-slate-500">
                                            <span>{entry.branchName || '-'}</span>
                                            <span>
                                                {formatDate(entry.startDate)} → {formatDate(entry.endDate)}
                                            </span>
                                        </div>
                                        {entry.futureAmount > 0 && (
                                            <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 ring-1 ring-inset ring-indigo-200">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                Residuo futuro {formatCurrency(entry.futureAmount)}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {overdueList.length > overdueSummary.preview.length && (
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsOverdueExpanded(prev => !prev)}
                                    className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                                    aria-expanded={isOverdueExpanded}
                                >
                                    {isOverdueExpanded
                                        ? 'Nascondi elenco completo'
                                        : `Mostra elenco completo (${overdueList.length})`}
                                    <ChevronDown
                                        className={`w-4 h-4 transition-transform ${isOverdueExpanded ? 'rotate-180' : ''}`}
                                    />
                                </button>
                            </div>
                        )}

                        <div
                            className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${
                                isOverdueExpanded ? 'max-h-[2000px]' : 'max-h-0'
                            }`}
                        >
                            <div
                                className={`mt-4 overflow-x-auto rounded-2xl border border-rose-100/80 bg-white/80 shadow-inner transition-opacity duration-300 ${
                                    isOverdueExpanded ? 'opacity-100' : 'opacity-0'
                                }`}
                            >
                                <table className="w-full text-xs">
                                    <thead className="bg-rose-50 text-rose-700 uppercase text-[11px] font-bold tracking-[0.16em]">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Fornitore</th>
                                            <th className="px-3 py-2 text-left">Contratto</th>
                                            <th className="px-3 py-2 text-left">Voce</th>
                                            <th className="px-3 py-2 text-left">Settore</th>
                                            <th className="px-3 py-2 text-left">Filiale</th>
                                            <th className="px-3 py-2 text-left">Periodo</th>
                                            <th className="px-3 py-2 text-right">Totale</th>
                                            <th className="px-3 py-2 text-right">Speso</th>
                                            <th className="px-3 py-2 text-right">Scaduto</th>
                                            <th className="px-3 py-2 text-right">Residuo Futuro</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-rose-100">
                                        {overdueList.map((entry, index) => (
                                            <tr
                                                key={`${entry.contractId}-${entry.lineItemDescription}-${index}`}
                                                className="bg-white/60 hover:bg-rose-50/60 transition-colors"
                                            >
                                                <td className="px-3 py-2 font-semibold text-gray-900 truncate max-w-[190px]">
                                                    {entry.supplierName}
                                                </td>
                                                <td className="px-3 py-2 text-gray-700 truncate max-w-[200px]">
                                                    {entry.contractDescription}
                                                </td>
                                                <td className="px-3 py-2 text-gray-700 truncate max-w-[220px]">
                                                    {entry.lineItemDescription}
                                                </td>
                                                <td className="px-3 py-2 text-gray-600">{entry.sectorName}</td>
                                                <td className="px-3 py-2 text-gray-600">{entry.branchName || '-'}</td>
                                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                                    {formatDate(entry.startDate)} → {formatDate(entry.endDate)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                                                    {formatCurrency(entry.lineTotal)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                                                    {formatCurrency(entry.lineSpent)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-rose-600 whitespace-nowrap">
                                                    {formatCurrency(entry.overdueAmount)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">
                                                    {entry.futureAmount > 0 ? formatCurrency(entry.futureAmount) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                
            </div>
        </div>
    );
}
