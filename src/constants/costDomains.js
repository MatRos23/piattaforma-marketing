export const COST_DOMAINS = {
    marketing: {
        id: 'marketing',
        label: 'Spese Marketing',
        shortLabel: 'Marketing',
        description:
            'Monitoraggio delle spese marketing con collegamento a budget, contratti e canali promozionali.',
        lineItemChannelLabel: 'Canale Marketing',
        lineItemChannelPlaceholder: 'Seleziona un canale',
        lineItemChannelRequired: true,
        supportsContracts: true,
        defaultRequiresContract: true,
    },
    operations: {
        id: 'operations',
        label: 'Gestione sedi & personale',
        shortLabel: 'Gestione sedi',
        description:
            'Costi strutturali (affitti, mutui, utilities) e spese HR che non devono impattare il budget marketing.',
        lineItemChannelLabel: 'Categoria costo',
        lineItemChannelPlaceholder: 'Seleziona una categoria',
        lineItemChannelRequired: false,
        supportsContracts: false,
        defaultRequiresContract: false,
    },
};

export const DEFAULT_COST_DOMAIN = COST_DOMAINS.marketing.id;

export const COST_DOMAIN_OPTIONS = Object.values(COST_DOMAINS).map((domain) => ({
    id: domain.id,
    label: domain.label,
}));
