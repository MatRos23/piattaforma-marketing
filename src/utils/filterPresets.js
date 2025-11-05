export const SHARED_FILTER_PRESETS_KEY = 'sharedFilterPresets';
const LEGACY_DASHBOARD_PRESETS_KEY = 'dashboardFilterPresets';

const parsePresets = (raw) => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Impossibile analizzare i preset salvati', error);
        return [];
    }
};

export const loadFilterPresets = () => {
    if (typeof window === 'undefined') return [];

    const stored = parsePresets(localStorage.getItem(SHARED_FILTER_PRESETS_KEY));
    if (stored.length > 0) {
        return stored;
    }

    const legacy = parsePresets(localStorage.getItem(LEGACY_DASHBOARD_PRESETS_KEY));
    if (legacy.length > 0) {
        localStorage.setItem(SHARED_FILTER_PRESETS_KEY, JSON.stringify(legacy));
    }

    return legacy;
};

export const persistFilterPresets = (presets) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(SHARED_FILTER_PRESETS_KEY, JSON.stringify(presets));
    } catch (error) {
        console.error('Impossibile salvare i preset', error);
    }
};
