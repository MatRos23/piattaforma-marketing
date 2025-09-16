import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';

export default function SettingsListItem({ children, onEdit, onDelete }) {
    return (
        <li className="flex justify-between items-center p-4 bg-white/60 rounded-xl border-2 border-white hover:shadow-lg hover:border-indigo-200/50 transition-all group">
            <div className="flex-1 min-w-0">
                {children}
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {onEdit && (
                    <button 
                        onClick={onEdit} 
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg" 
                        title="Modifica"
                    >
                        <Pencil size={16} />
                    </button>
                )}
                {onDelete && (
                    <button 
                        onClick={onDelete} 
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-100 rounded-lg" 
                        title="Elimina"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </li>
    );
}