import React, { useState, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';

//MultiSelect
export const MultiSelect = ({
    options,
    selected,
    onChange,
    placeholder = 'Seleziona...',
    selectedText,
    searchPlaceholder = 'Cerca...'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredOptions = useMemo(() => 
        (options || []).filter(opt => opt.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [options, searchTerm]
    );
    const selectedCount = useMemo(() => (selected || []).length, [selected]);

    return (
        <div className="relative">
            <button 
                type="button" 
                onClick={() => setIsOpen(!isOpen)} 
                className="w-full h-12 rounded-2xl border border-slate-200 bg-white pl-4 pr-3 text-sm font-medium text-slate-700 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all flex items-center justify-between"
            >
                <span className="block truncate">
                    {selectedCount > 0 ? (
                        <span className="font-semibold text-slate-800">
                            {selectedText ?? `${selectedCount} elementi selezionati`}
                        </span>
                    ) : (
                        <span className="text-slate-400">{placeholder}</span>
                    )}
                </span>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl border border-white/40 max-h-60 overflow-hidden">
                    <div className="p-2 sticky top-0 bg-white/95 backdrop-blur-xl border-b border-slate-200/60">
                        <input 
                            type="text" 
                            placeholder={searchPlaceholder}
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        />
                    </div>
                    <ul className="overflow-y-auto max-h-48">
                        {filteredOptions.map(option => {
                            const isChecked = (selected || []).includes(option.id);
                            return (
                                <li 
                                    key={option.id} 
                                    onClick={() => onChange(option.id)} 
                                    className="px-3 py-2.5 hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between transition-colors"
                                >
                                    <span className="text-sm font-medium text-slate-800">{option.name}</span>
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                        {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
            {isOpen && <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>}
        </div>
    );
};

//KPI Card
export const KpiCard = React.memo(({ title, value, icon, gradient, subtitle, onClick }) => (
    <div 
        onClick={onClick}
        className={`group relative bg-white/90 backdrop-blur-2xl rounded-2xl lg:rounded-3xl shadow-lg border border-white/30 p-5 lg:p-6 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
    >
        <div className="absolute -right-4 -top-4 text-gray-200/50 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
            {React.cloneElement(icon, { className: "w-20 h-20 lg:w-24 lg:h-24" })}
        </div>
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} text-white shadow-md`}>
                    {React.cloneElement(icon, { className: "w-5 h-5" })}
                </div>
                <p className="text-xs font-bold text-gray-600 tracking-wide uppercase">{title}</p>
            </div>
            <p className="text-2xl lg:text-3xl font-black text-gray-900 leading-tight">{value}</p>
            {subtitle && <p className="text-sm text-gray-500 font-medium mt-1">{subtitle}</p>}
        </div>
    </div>
));
