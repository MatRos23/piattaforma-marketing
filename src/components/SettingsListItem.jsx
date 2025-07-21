import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';

export default function SettingsListItem({ children, onEdit, onDelete }) {
    return (
        <li className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="flex-1 min-w-0">
                {children}
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                {onEdit && (
                    <button onClick={onEdit} className="text-gray-400 hover:text-indigo-600" title="Modifica">
                        <Pencil size={16} />
                    </button>
                )}
                {onDelete && (
                    <button onClick={onDelete} className="text-gray-400 hover:text-red-500" title="Elimina">
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </li>
    );
}