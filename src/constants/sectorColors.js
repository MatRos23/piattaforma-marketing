export const SECTOR_COLOR_MAP = {
    'Frattin Group': '#C0C0C0',
    'Yachting': '#1E3A8A',
    'Auto': '#2563EB',
    'Camper&Caravan': '#10B981',
    'Import&Export': '#111827',
};

export const SECTOR_FALLBACK_COLORS = [
    '#2563EB',
    '#1E3A8A',
    '#10B981',
    '#0EA5E9',
    '#6366F1',
    '#F97316',
    '#F59E0B',
    '#14B8A6',
];

export const getSectorColor = (name, fallbackIndex = 0) => {
    if (name) {
        const mapped = SECTOR_COLOR_MAP[name.trim()];
        if (mapped) {
            return mapped;
        }
    }
    const index = fallbackIndex >= 0 ? fallbackIndex : 0;
    return SECTOR_FALLBACK_COLORS[index % SECTOR_FALLBACK_COLORS.length];
};
