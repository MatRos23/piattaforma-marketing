export const extractBranchIdsFromAssignment = (assignment) => {
    if (!assignment) return [];

    if (Array.isArray(assignment)) {
        return assignment.filter(Boolean);
    }

    if (typeof assignment === 'string') {
        return assignment
            .split(',')
            .map(id => id.trim())
            .filter(Boolean);
    }

    return [];
};

export const deriveBranchesForLineItem = ({
    expense = {},
    item = {},
    sectorId = null,
    branchMap,
    branchesPerSector
}) => {
    if (!branchMap) {
        throw new Error('branchMap is required to derive branches');
    }
    if (!branchesPerSector) {
        throw new Error('branchesPerSector map is required to derive branches');
    }

    const branchIds = new Set();
    const assignment = item.assignmentId;

    if (item.assignmentType === 'distributed' && assignment) {
        extractBranchIdsFromAssignment(assignment).forEach(id => {
            if (branchMap.has(id)) {
                branchIds.add(id);
            }
        });
    }

    if (assignment && typeof assignment === 'string' && branchMap.has(assignment)) {
        branchIds.add(assignment);
    }

    if (item.branchId && branchMap.has(item.branchId)) {
        branchIds.add(item.branchId);
    }

    const expenseBranch = expense.branchId || expense.branchld;
    if (branchIds.size === 0 && expenseBranch && branchMap.has(expenseBranch)) {
        branchIds.add(expenseBranch);
    }

    if (branchIds.size === 0 && sectorId) {
        const sectorBranches = branchesPerSector.get(sectorId) || [];
        sectorBranches.forEach(branch => branchIds.add(branch.id));
    }

    return Array.from(branchIds);
};

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeDateValue = (value) => {
    if (!value) return null;
    let date;
    if (value instanceof Date) {
        date = new Date(value.getTime());
    } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        date = new Date(`${value}T00:00:00`);
    } else {
        date = new Date(value);
    }
    if (isNaN(date)) return null;
    date.setHours(0, 0, 0, 0);
    return date;
};

export const computeExpenseBranchShares = ({
    expense = {},
    lineItems = [],
    branchMap,
    branchesPerSector,
    filterStartDate,
    filterEndDate,
    activeSectorId = 'all'
}) => {
    if (!branchMap) {
        throw new Error('branchMap is required to compute branch shares');
    }
    if (!branchesPerSector) {
        throw new Error('branchesPerSector map is required to compute branch shares');
    }

    const filterStart = normalizeDateValue(filterStartDate);
    const filterEnd = normalizeDateValue(filterEndDate);
    const expenseDate = normalizeDateValue(expense.date);
    const isAmortizedExpense = Boolean(
        expense.isAmortized &&
        expense.amortizationStartDate &&
        expense.amortizationEndDate
    );

    const branchTotals = new Map();
    const itemTotals = new Map();
    const itemBranchTotals = new Map();

    if (!isAmortizedExpense) {
        if (!expenseDate) {
            return { branchTotals, itemTotals, itemBranchTotals };
        }

        if (filterStart && expenseDate < filterStart) {
            return { branchTotals, itemTotals, itemBranchTotals };
        }

        if (filterEnd && expenseDate > filterEnd) {
            return { branchTotals, itemTotals, itemBranchTotals };
        }
    }

    const effectiveLineItems = Array.isArray(lineItems) && lineItems.length > 0
        ? lineItems
        : [{
            _key: `${expense.id || 'expense'}-0`,
            amount: typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount) || 0,
            sectorId: expense.sectorId || expense.sectorld || null,
            assignmentId: expense.branchId || expense.branchld || ''
        }];

    effectiveLineItems.forEach(item => {
        const itemKey = item._key || `${expense.id || 'expense'}-${Math.random().toString(36).slice(2)}`;
        const itemSectorId = item.sectorId || expense.sectorId || expense.sectorld || null;
        if (activeSectorId !== 'all' && itemSectorId !== activeSectorId) {
            return;
        }

        const assignedBranches = Array.isArray(item.assignedBranches) && item.assignedBranches.length
            ? item.assignedBranches
            : deriveBranchesForLineItem({
                expense,
                item,
                sectorId: itemSectorId,
                branchMap,
                branchesPerSector
            });

        if (!assignedBranches.length) return;

        const amount = typeof item.amount === 'number'
            ? item.amount
            : parseFloat(item.amount) || 0;
        if (!amount) return;

        const registerShare = (shareAmount) => {
            if (!shareAmount || assignedBranches.length === 0) return;
            const perBranch = shareAmount / assignedBranches.length;
            let branchValues = itemBranchTotals.get(itemKey);
            if (!branchValues) {
                branchValues = new Map();
                itemBranchTotals.set(itemKey, branchValues);
            }
            assignedBranches.forEach(branchId => {
                branchTotals.set(branchId, (branchTotals.get(branchId) || 0) + perBranch);
                branchValues.set(branchId, (branchValues.get(branchId) || 0) + perBranch);
            });
            itemTotals.set(itemKey, (itemTotals.get(itemKey) || 0) + shareAmount);
        };

        if (isAmortizedExpense) {
            let amortStart = normalizeDateValue(expense.amortizationStartDate);
            let amortEnd = normalizeDateValue(expense.amortizationEndDate);

            if (!amortStart || !amortEnd) {
                registerShare(amount);
                return;
            }

            if (amortStart > amortEnd) {
                const temp = amortStart;
                amortStart = amortEnd;
                amortEnd = temp;
            }

            const durationDays = Math.max(1, Math.round((amortEnd - amortStart) / DAY_MS) + 1);
            const dailyAmount = amount / durationDays;

            for (let d = new Date(amortStart); d <= amortEnd; d.setDate(d.getDate() + 1)) {
                const currentDate = normalizeDateValue(d);
                if (!currentDate) continue;
                if (filterStart && currentDate < filterStart) continue;
                if (filterEnd && currentDate > filterEnd) continue;

                registerShare(dailyAmount);
            }
        } else {
            registerShare(amount);
        }
    });

    return { branchTotals, itemTotals, itemBranchTotals };
};
