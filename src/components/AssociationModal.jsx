import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Link2, ChevronDown } from 'lucide-react';

const MultiSelect = ({ options, selected, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const triggerRef = useRef(null);
    const dropdownRef = useRef(null);
    const [dropdownStyles, setDropdownStyles] = useState({ top: 0, left: 0, width: 0 });

    const filteredOptions = useMemo(
        () => (options || []).filter(opt => opt.name.toLowerCase().includes(searchTerm.toLowerCase())),
        [options, searchTerm]
    );

    const selectedCount = useMemo(() => (selected || []).length, [selected]);

    const updateDropdownPosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setDropdownStyles({
            top: rect.bottom + window.scrollY + 8,
            left: rect.left + window.scrollX,
            width: rect.width,
        });
    };

    useLayoutEffect(() => {
        if (!isOpen) return;
        updateDropdownPosition();
        const handleResize = () => updateDropdownPosition();
        const handleScroll = () => updateDropdownPosition();
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event) => {
            const insideTrigger = triggerRef.current?.contains(event.target);
            const insideDropdown = dropdownRef.current?.contains(event.target);
            if (!insideTrigger && !insideDropdown) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    const dropdown = isOpen
        ? createPortal(
            <div className="fixed inset-0 z-[70] pointer-events-none">
                <div
                    ref={dropdownRef}
                    className="pointer-events-auto overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-300/40"
                    style={{
                        position: 'absolute',
                        top: dropdownStyles.top,
                        left: dropdownStyles.left,
                        width: dropdownStyles.width,
                    }}
                >
                    <div className="sticky top-0 border-b border-slate-200/60 bg-white px-3 py-2">
                        <input
                            type="text"
                            placeholder="Cerca..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                        />
                    </div>
                    <ul className="max-h-56 overflow-y-auto px-2 py-2">
                        {filteredOptions.map(option => {
                            const isChecked = (selected || []).includes(option.id);
                            return (
                                <li
                                    key={option.id}
                                    onClick={() => onChange(option.id)}
                                    className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-slate-100/70"
                                >
                                    <span className="ml-1 text-sm font-semibold text-slate-800">{option.name}</span>
                                    <div className={`flex h-5 w-5 items-center justify-center rounded border transition-all ${isChecked ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                                        <Check className="h-3.5 w-3.5" />
                                    </div>
                                </li>
                            );
                        })}
                        {filteredOptions.length === 0 && (
                            <li className="px-3 py-4 text-center text-sm font-medium text-slate-400">
                                Nessun elemento trovato
                            </li>
                        )}
                    </ul>
                </div>
            </div>,
            document.body
        )
        : null;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-800 shadow-sm transition-all hover:border-slate-300 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                ref={triggerRef}
            >
                <span className="block truncate">
                    {selectedCount > 0 ? `${selectedCount} selezionat${selectedCount > 1 ? 'i' : 'o'}` : <span className="text-slate-400">Seleziona...</span>}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdown}
        </div>
    );
};

export default function AssociationModal({ isOpen, onClose, onSave, initialData, title, itemLabel, associationLists = [] }) {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (isOpen) {
            const data = { name: initialData?.name || '' };
            associationLists.forEach(list => {
                data[list.key] = initialData?.[list.key] || [];
            });
            setFormData(data);
        }
    }, [isOpen, initialData, associationLists]);

    if (!isOpen) return null;

    const handleInputChange = (e) => {
        setFormData(prev => ({ ...prev, name: e.target.value }));
    };

    const handleMultiSelectChange = (key, itemId) => {
        setFormData(prev => {
            const currentSelection = prev[key] || [];
            const newSelection = currentSelection.includes(itemId)
                ? currentSelection.filter(id => id !== itemId)
                : [...currentSelection, itemId];
            
            return { ...prev, [key]: newSelection };
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200/60 bg-white/98 shadow-[0_35px_95px_-45px_rgba(15,23,42,0.75)] transition-transform">
                <form onSubmit={handleSubmit} className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white">
                        <div className="flex items-start gap-4">
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 text-white shadow-inner shadow-black/20">
                                <Link2 className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black">{title}</h3>
                                <p className="text-sm font-medium text-white/80">Modifica le associazioni e i dettagli collegati</p>
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

                    <div className="flex-1 overflow-y-auto bg-white px-6 py-6">
                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 block mb-2">
                                    {itemLabel}
                                </label>
                                <input 
                                    type="text" 
                                    value={formData.name || ''} 
                                    onChange={handleInputChange} 
                                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-all focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-500/20" 
                                    required 
                                />
                            </div>
                            {associationLists.map(list => (
                                <div key={list.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {list.label}
                        </label>
                                        <span className="text-[11px] font-semibold text-slate-400">
                                            {(formData[list.key] || []).length} selezionati
                                        </span>
                                    </div>
                                    <MultiSelect 
                                        options={list.items}
                                        selected={formData[list.key] || []}
                                        onChange={(itemId) => handleMultiSelectChange(list.key, itemId)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200/60 bg-slate-50/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                            Operazione impostazioni
                        </div>
                        <div className="flex flex-col-reverse gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-100"
                            >
                                Annulla
                            </button>
                            <button 
                                type="submit" 
                                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-transform hover:-translate-y-[1px] hover:bg-slate-800"
                            >
                                Salva
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
