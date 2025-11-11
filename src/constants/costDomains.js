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
        label: 'Sedi',
        shortLabel: 'Sedi',
        description:
            'Monitoraggio dei costi immobiliari e delle utilities per ogni filiale aziendale.',
        lineItemChannelLabel: 'Categoria costo',
        lineItemChannelPlaceholder: 'Seleziona una categoria',
        lineItemChannelRequired: false,
        supportsContracts: false,
        supportsAttachments: false,
        defaultRequiresContract: false,
    },
};

export const DEFAULT_COST_DOMAIN = COST_DOMAINS.marketing.id;

export const COST_DOMAIN_OPTIONS = Object.values(COST_DOMAINS).map((domain) => ({
    id: domain.id,
    label: domain.label,
}));
