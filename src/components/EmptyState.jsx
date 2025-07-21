import React from 'react';
import { Inbox } from 'lucide-react'; // Usiamo un'icona di default

export default function EmptyState({ icon, title, message }) {
  // Se non viene passata un'icona specifica, usa quella di default
  const IconComponent = icon || Inbox;

  return (
    <div className="text-center p-8 border-2 border-dashed rounded-lg">
      <IconComponent className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
    </div>
  );
}