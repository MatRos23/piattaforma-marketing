import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, where, orderBy } from 'firebase/firestore';
import { ResponsiveContainer, AreaChart, BarChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, Cell, Treemap } from 'recharts';
import { DollarSign, Users, Hash, Car, Sailboat, Caravan, Building2, Layers, SlidersHorizontal, XCircle, PieChart, Target } from 'lucide-react';
import toast from 'react-hot-toast';

const KpiCard = ({ title, value, icon }) => (
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/80 flex items-center gap-4 transition-transform hover:scale-[1.02] duration-300">
        <div className="bg-indigo-100 p-3 rounded-full">{icon}</div>
        <div>
            <p className="text-sm font-semibold text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const formatCurrency = (number) => {
    if (typeof number !== 'number' || isNaN(number)) return '€ 0,00';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const getSectoricon = (sectorName) => {
    const icons = { 'Auto': <Car className="w-4 h-4" />, 'Camper&Caravan': <Caravan className="w-4 h-4" />, 'Yachting': <Sailboat className="w-4 h-4" />, 'Frattin Group': <Building2 className="w-4 h-4" />, default: <DollarSign className="w-4 h-4" /> };
    return icons[sectorName] || icons.default;
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        let total = 0;
        payload.forEach(p => total += p.value);
        return (
            <div className="bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-gray-200 shadow-lg">
                <p className="font-bold text-gray-800 mb-2">{label || payload[0].payload.name}</p>
                {payload.map((pld, index) => (
                    <div key={index} className="flex items-center justify-between text-sm gap-4">
                        <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: pld.stroke || pld.fill }}></div>
                            <span className="text-gray-600">{pld.name}:</span>
                        </div>
                        <span className="font-bold">{formatCurrency(pld.value)}</span>
                    </div>
                ))}
                {payload.length > 1 && <div className="border-t mt-1 pt-1 font-bold flex justify-between"><span>Totale:</span><span>{formatCurrency(total)}</span></div>}
            </div>
        );
    }
    return null;
};

const CHART_COLORS = ['#312e81', '#4338ca', '#4f46e5', '#6366f1', '#a5b4fc', '#c7d2fe', '#e0e7ff'];
const FONT_STYLE = { fontFamily: 'system-ui, sans-serif', fontSize: '12px', fill: '#6B7280' };

const CustomizedTreemapContent = ({ root, depth, x, y, width, height, index, name, value }) => {
    return (
        <g>
            <rect x={x} y={y} width={width} height={height} style={{ fill: CHART_COLORS[index % CHART_COLORS.length], stroke: '#fff', strokeWidth: 2, strokeOpacity: 0.5 }} />
            {width > 80 && height > 40 && (
                <foreignObject x={x + 8} y={y + 8} width={width - 16} height={height - 16} style={{ overflow: 'hidden' }}>
                    <div className="text-white font-semibold" style={{ whiteSpace: 'normal', wordWrap: 'break-word' }}>
                        <p className="text-sm leading-tight">{name}</p>
                        <p className="text-xs opacity-80 pt-1">{formatCurrency(value)}</p>
                    </div>
                </foreignObject>
            )}
        </g>
    );
};

const calculateAccrualPortion = (item, filterStartDate, filterEndDate) => {
    const isAmortized = item.isAmortized || item.isProjection;
    const startDate = item.amortizationStartDate || item.startDate;
    const endDate = item.amortizationEndDate || item.endDate;
    if (!isAmortized) {
        if (!item.date) return 0;
        const expDate = new Date(item.date);
        return (expDate >= filterStartDate && expDate <= filterEndDate) ? (item.amount || 0) : 0;
    }
    if (!startDate || !endDate) return 0;
    const expenseStart = new Date(startDate);
    const expenseEnd = new Date(endDate);
    const durationDays = (expenseEnd - expenseStart) / (1000 * 60 * 60 * 24) + 1;
    if (durationDays <= 0) return 0;
    const dailyCost = (item.amount || 0) / durationDays;
    const overlapStart = new Date(Math.max(filterStartDate, expenseStart));
    const overlapEnd = new Date(Math.min(filterEndDate, expenseEnd));
    if (overlapStart > overlapEnd) return 0;
    const overlapDays = (overlapEnd - overlapStart) / (1000 * 60 * 60 * 24) + 1;
    return dailyCost * overlapDays;
};

export default function DashboardPage({ navigate }) {
    const [allExpenses, setAllExpenses] = useState([]);
    const [allContracts, setAllContracts] = useState([]);
    const [allBudgets, setAllBudgets] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [branches, setBranches] = useState([]);
    const [marketingChannels, setMarketingChannels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    
    const [dateFilter, setDateFilter] = useState(() => {
        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(currentYear, 11, 31);
        return { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] };
    });
    const [selectedSupplier, setSelectedSupplier] = useState('all');
    const [selectedSector, setSelectedSector] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [selectedChannel, setSelectedChannel] = useState('all');

    const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s.name])), [suppliers]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const branchNameToldMap = useMemo(() => new Map(branches.map(b => [b.name, b.id])), [branches]);
    const sectorNameToIdMap = useMemo(() => new Map(sectors.map(s => [s.name, s.id])), [sectors]);

    useEffect(() => {
        setIsLoading(true);
        const currentYear = new Date(dateFilter.endDate).getFullYear();
        const unsubs = [
            onSnapshot(query(collection(db, "expenses")), snap => setAllExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "contracts")), snap => setAllContracts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "budgets"), where("year", "==", currentYear)), snap => setAllBudgets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), snap => setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), snap => setSectors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "branches")), orderBy("name"), snap => setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))),
            onSnapshot(query(collection(db, "marketing_channels")), orderBy("name"), snap => {
                setMarketingChannels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setIsLoading(false);
            })
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, [dateFilter.endDate]);

    const analyticsData = useMemo(() => {
        if (isLoading) return { totalSpend: 0, budgetTotale: 0, budgetResiduo: 0, expenseCount: 0, activeSuppliersCount: 0, spendBySupplier: [], spendBySector: [], spendByBranch: [], monthlyData: [] };

        const filterStartDate = new Date(dateFilter.startDate);
        const filterEndDate = new Date(dateFilter.endDate);
        const year = filterEndDate.getFullYear();

        let allItems = [];
        allExpenses.forEach(expense => {
            (expense.lineItems || [{...expense}]).forEach(li => {
                allItems.push({ type: 'real', ...expense, ...li, sectorld: li.sectorld || expense.sectorld });
            });
        });

        allContracts.forEach(contract => {
            const linkedExpenses = allExpenses.filter(e => e.relatedContractId === contract.id);
            const spentOnContract = linkedExpenses.reduce((sum, e) => sum + e.amount, 0);
            const contractTotal = (contract.lineItems || []).reduce((sum, item) => sum + (item.totalAmount || 0), 0);
            const remaining = contractTotal - spentOnContract;

            if (remaining > 0) {
                const coveredMonths = new Set();
                linkedExpenses.forEach(exp => {
                    const expDate = new Date(exp.date);
                    coveredMonths.add(`${expDate.getFullYear()}-${expDate.getMonth()}`);
                });

                let totalUncoveredAmount = 0;
                const monthlyDistribution = {};
                (contract.lineItems || []).forEach(li => {
                    const start = new Date(li.startDate);
                    const end = new Date(li.endDate);
                    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
                    if (months <= 0) return;
                    const monthlyAmount = (li.totalAmount || 0) / months;
                    for (let i = 0; i < months; i++) {
                        const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
                        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                        if (!monthlyDistribution[monthKey]) monthlyDistribution[monthKey] = { amount: 0, lineItem: li };
                        monthlyDistribution[monthKey].amount += monthlyAmount;
                        if (!coveredMonths.has(monthKey)) {
                            totalUncoveredAmount += monthlyAmount;
                        }
                    }
                });

                if (totalUncoveredAmount > 0) {
                    const projectionRatio = remaining / totalUncoveredAmount;
                    Object.keys(monthlyDistribution).forEach(monthKey => {
                        if (!coveredMonths.has(monthKey)) {
                            const [projYear, projMonth] = monthKey.split('-').map(Number);
                            const { lineItem, amount } = monthlyDistribution[monthKey];
                            allItems.push({
                                type: 'projected', isProjection: true, amount: amount * projectionRatio,
                                supplierld: contract.supplierld, sectorld: lineItem.sectorld, branchld: lineItem.branchld,
                                startDate: new Date(projYear, projMonth, 1).toISOString().split('T')[0],
                                endDate: new Date(projYear, projMonth + 1, 0).toISOString().split('T')[0],
                                isAmortized: true, description: `Proiezione per ${contract.description}`
                            });
                        }
                    });
                }
            }
        });

        const filteredItems = allItems.filter(item => {
            item.amountToConsider = calculateAccrualPortion(item, filterStartDate, filterEndDate);
            if (item.amountToConsider <= 0) return false;
            if (selectedSupplier !== 'all' && item.supplierld !== selectedSupplier) return false;
            if (selectedSector !== 'all' && item.sectorld !== selectedSector) return false;
            const branchId = item.assignmentId || item.branchld;
            if (selectedBranch !== 'all' && branchId !== selectedBranch) return false;
            if (item.type === 'real' && selectedChannel !== 'all' && item.marketingChannelld !== selectedChannel) return false;
            return true;
        });

        const totals = { bySupplier: {}, bySector: {}, byBranch: {}, byMonth: { real: {}, projected: {} } };
        
        filteredItems.forEach(item => {
            const amount = item.amountToConsider;
            const key = item.type === 'real' ? 'real' : 'projected';
            
            const processSplit = (branchld, amountToSplit) => {
                const branchName = branchMap.get(branchld) || 'Non Assegnata';
                const branchData = branches.find(b => b.id === branchld);
                const primarySectorId = branchData?.associatedSectors?.[0] || item.sectorld;
                const sectorName = sectorMap.get(primarySectorId) || 'Sconosciuto';
                const supplierName = supplierMap.get(item.supplierld) || 'Sconosciuto';
                
                if (!totals.bySupplier[supplierName]) totals.bySupplier[supplierName] = { real: 0, projected: 0, total: 0 };
                if (!totals.bySector[sectorName]) totals.bySector[sectorName] = { real: 0, projected: 0, total: 0 };
                if (!totals.byBranch[branchName]) totals.byBranch[branchName] = { real: 0, projected: 0, total: 0 };
                
                totals.bySupplier[supplierName][key] += amountToSplit;
                totals.bySector[sectorName][key] += amountToSplit;
                totals.byBranch[branchName][key] += amountToSplit;
                totals.bySupplier[supplierName].total += amountToSplit;
                totals.bySector[sectorName].total += amountToSplit;
                totals.byBranch[branchName].total += amountToSplit;
            };

            const genericoBranch = branches.find(b => b.name.toLowerCase() === 'generico');
            const itemBranchld = item.assignmentId || item.branchld;
            const frattinGroupSectorId = sectors.find(s => s.name === 'Frattin Group')?.id;

            if (itemBranchld === genericoBranch?.id || item.sectorld === frattinGroupSectorId) {
                const sectorsToDistribute = item.sectorld === frattinGroupSectorId ? (sectors.filter(s => s.id !== frattinGroupSectorId).map(s => s.id)) : (item.associatedSectors || [item.sectorld]);
                const targetBranches = branches.filter(b => b.name.toLowerCase() !== 'generico' && (b.associatedSectors || []).some(bs => sectorsToDistribute.includes(bs)));
                if (targetBranches.length > 0) {
                    const amountPerBranch = item.amountToConsider / targetBranches.length;
                    targetBranches.forEach(branch => processSplit(branch.id, amountPerBranch));
                } else {
                    processSplit(undefined, item.amountToConsider);
                }
            } else {
                processSplit(itemBranchld, item.amountToConsider);
            }

            const itemStartDate = new Date(item.date || item.amortizationStartDate || item.startDate);
            const itemEndDate = new Date(item.date || item.amortizationEndDate || item.endDate);
            const totalDurationDays = Math.max(1, (itemEndDate - itemStartDate) / (1000 * 60 * 60 * 24) + 1);
            const dailyCost = item.amount / totalDurationDays;
            
            for (let d = new Date(itemStartDate); d <= itemEndDate; d.setDate(d.getDate() + 1)) {
                if(d >= filterStartDate && d <= filterEndDate) {
                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    if (!totals.byMonth[key][monthKey]) totals.byMonth[key][monthKey] = 0;
                    totals.byMonth[key][monthKey] += dailyCost;
                }
            }
        });

        const spesaImpegnata = filteredItems.reduce((sum, item) => sum + item.amountToConsider, 0);
        const budgetTotale = allBudgets.reduce((sum, budget) => {
            if (!budget.allocations) return sum;
            if (selectedSupplier !== 'all' && budget.supplierId !== selectedSupplier) return sum;
            return sum + (budget.allocations || []).reduce((allocSum, alloc) => (selectedSector === 'all' || alloc.sectorId === selectedSector) ? allocSum + (alloc.budgetAmount || 0) : allocSum, 0);
        }, 0);
        const budgetResiduo = budgetTotale - spesaImpegnata;

        const monthlyData = [];
        const monthlyBudget = budgetTotale / 12;
        for (let i = 0; i < 12; i++) {
            const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
            monthlyData.push({
                mese: new Date(year, i).toLocaleString('it-IT', { month: 'short' }),
                "Spese Reali": totals.byMonth.real[monthKey] || 0,
                "Proiezioni": totals.byMonth.projected[monthKey] || 0,
                "Budget Previsto": monthlyBudget,
            });
        }
        
        const formatChartData = (totalsObject) => Object.entries(totalsObject).map(([name, values]) => ({ name, spesaReale: values.real, proiezione: values.projected, total: values.total })).sort((a, b) => b.total - a.total);

        return {
            totalSpend: spesaImpegnata, budgetTotale, budgetResiduo, expenseCount: filteredItems.length,
            activeSuppliersCount: Object.keys(totals.bySupplier).length,
            spendBySupplier: formatChartData(totals.bySupplier),
            spendBySector: formatChartData(totals.bySector),
            spendByBranch: formatChartData(totals.byBranch),
            monthlyData,
        };
    }, [allExpenses, allContracts, allBudgets, dateFilter, selectedSupplier, selectedSector, selectedBranch, selectedChannel, suppliers, sectors, branches, supplierMap, sectorMap, branchMap]);
    
    const resetFilters = () => {
        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear, 0, 1);
        const endDate = new Date(currentYear, 11, 31);
        setDateFilter({ startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] });
        setSelectedSupplier('all');
        setSelectedSector('all');
        setSelectedBranch('all');
        setSelectedChannel('all');
        setIsAdvancedFiltersOpen(false);
        toast.success("Filtri resettati!");
    };
    
    const handleSectorClick = (data) => {
        if (!data || !data.activePayload) return;
        const payload = data.activePayload[0]?.payload;
        if (!payload) return;
        if (payload.name === 'Sconosciuto') {
            navigate('expenses', { specialFilter: 'unassigned_sector' });
        } else {
            const sectorId = sectorNameToIdMap.get(payload.name);
            if (sectorId) {
                navigate('expenses', { sectorFilter: sectorId });
            }
        }
    };
    
    const handleBranchClick = (data) => {
        if (data && data.name) {
            if (data.name === 'Non Assegnata') {
                navigate('expenses', { specialFilter: 'unassigned' });
            } else {
                const branchld = branchNameToldMap.get(data.name);
                if (branchld) {
                    navigate('expenses', { branchFilter: [branchld] });
                }
            }
        }
    };

    const areAdvancedFiltersActive = selectedChannel !== 'all' || selectedBranch !== 'all';

    if (isLoading) return <div className="p-8 text-center">Caricamento dati...</div>;

    return (
        <div className="p-4 md:p-8 space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            <div className="mb-6 p-4 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2 lg:col-span-2"><label className="text-sm font-bold text-gray-600 block mb-1">Periodo</label><div className="flex items-center gap-2"><input type="date" name="startDate" value={dateFilter.startDate} onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" /><span className="text-gray-500">al</span><input type="date" name="endDate" value={dateFilter.endDate} onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" /></div></div>
                    <div className="md:col-span-1 lg:col-span-2"><label className="text-sm font-bold text-gray-600 block mb-1">Fornitore</label><select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"><option value="all">Tutti i Fornitori</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                    <div className="md:col-span-2 lg:col-span-1 flex items-end"><button onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)} className={'relative w-full h-11 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border transition ' + (areAdvancedFiltersActive ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-white text-gray-600 hover:bg-gray-100')}><SlidersHorizontal size={16} /> Filtri {areAdvancedFiltersActive && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-white"></span>}</button></div>
                </div>
                <div className="border-t pt-4 flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setSelectedSector('all')} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-2 ${selectedSector === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}><Layers size={14} /> Tutti i Settori</button>
                        {sectors.map(sector => (<button key={sector.id} onClick={() => setSelectedSector(sector.id)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-2 ${selectedSector === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}>{getSectoricon(sector.name)}{sector.name}</button>))}
                    </div>
                    <button onClick={resetFilters} className="text-sm font-semibold text-red-600 hover:text-red-800 transition flex items-center gap-2 bg-red-100 px-3 py-2 rounded-lg"><XCircle size={16} />Reset Filtri</button>
                </div>
                {isAdvancedFiltersOpen && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 border-t pt-4">
                        <div className="lg:col-span-2"><label className="text-sm font-bold text-gray-600 block mb-1">Canale Marketing</label><select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"><option value="all">Tutti i Canali</option>{marketingChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                        <div className="lg:col-span-3"><label className="text-sm font-bold text-gray-600 block mb-1">Filiale</label><select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" disabled={filteredBranches.length === 0}><option value="all">Tutte le Filiali</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <KpiCard title="Spesa Totale Impegnata" value={formatCurrency(analyticsData.totalSpend)} icon={<DollarSign className="w-6 h-6 text-indigo-600" />} />
                <KpiCard title="Budget Totale Assegnato" value={formatCurrency(analyticsData.budgetTotale)} icon={<Target className="w-6 h-6 text-indigo-600" />} />
                <KpiCard title="Budget Residuo" value={formatCurrency(analyticsData.budgetResiduo)} icon={<PieChart className="w-6 h-6 text-indigo-600" />} />
            </div>
            <div className="grid grid-cols-1 gap-8">
                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border"><h3 className="font-bold text-lg text-gray-800 mb-4">Andamento Mensile (Costi Impegnati vs Budget)</h3><ResponsiveContainer width="100%" height={300}><AreaChart data={analyticsData.monthlyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}><defs><linearGradient id="colorSpesa" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4338ca" stopOpacity={0.7}/><stop offset="95%" stopColor="#4338ca" stopOpacity={0.1}/></linearGradient><linearGradient id="colorProiezioni" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a5b4fc" stopOpacity={0.6}/><stop offset="95%" stopColor="#a5b4fc" stopOpacity={0.0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mese" tick={FONT_STYLE} /><YAxis tickFormatter={formatCurrency} tick={FONT_STYLE} /><Tooltip content={<CustomTooltip />} /><Legend verticalAlign="top" height={36} /><Area type="monotone" dataKey="Spese Reali" stackId="1" stroke="#312e81" fill="url(#colorSpesa)" /><Area type="monotone" dataKey="Proiezioni" stackId="1" stroke="#6366f1" fill="url(#colorProiezioni)" /><Line type="monotone" dataKey="Budget Previsto" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Budget Mensile" /></AreaChart></ResponsiveContainer></div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {analyticsData.spendBySupplier.length > 0 && (<div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border"><h3 className="font-bold text-lg text-gray-800 mb-4">Top Fornitori</h3><ResponsiveContainer width="100%" height={300}><BarChart data={analyticsData.spendBySupplier.slice(0, 5)} layout="vertical" margin={{ left: 20, right: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" /><XAxis type="number" tick={false} axisLine={false} tickLine={false} width={0} stacked /><YAxis type="category" dataKey="name" width={100} tick={FONT_STYLE} axisLine={false} tickLine={false} /><Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(238, 242, 255, 0.6)' }} /><Legend verticalAlign="top" height={36} /><Bar dataKey="spesaReale" name="Spesa Reale" stackId="a" fill="#312e81" /><Bar dataKey="proiezione" name="Proiezione" stackId="a" fill="#a5b4fc" /></BarChart></ResponsiveContainer></div>)}
                    {analyticsData.spendBySector.length > 0 && (<div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border"><h3 className="font-bold text-lg text-gray-800 mb-4">Spesa per Settore</h3><ResponsiveContainer width="100%" height={300}><BarChart onClick={handleSectorClick} className="cursor-pointer" data={analyticsData.spendBySector} layout="vertical" margin={{ left: 20, right: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" /><XAxis type="number" tick={false} axisLine={false} tickLine={false} width={0} stacked /><YAxis type="category" dataKey="name" width={100} tick={FONT_STYLE} axisLine={false} tickLine={false} /><Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(238, 242, 255, 0.6)' }} /><Legend verticalAlign="top" height={36} /><Bar dataKey="spesaReale" name="Spesa Reale" stackId="a" fill="#312e81" /><Bar dataKey="proiezione" name="Proiezione" stackId="a" fill="#a5b4fc" /></BarChart></ResponsiveContainer></div>)}
                </div>
                {analyticsData.spendByBranch.length > 0 && (<div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border"><h3 className="font-bold text-lg text-gray-800 mb-4">Ripartizione Spesa per Filiale</h3><ResponsiveContainer width="100%" height={300}><Treemap data={analyticsData.spendByBranch} dataKey="total" nameKey="name" ratio={4 / 3} stroke="#fff" fill="#8884d8" content={<CustomizedTreemapContent />} onClick={handleBranchClick} className="cursor-pointer"><Tooltip content={<CustomTooltip />} /></Treemap></ResponsiveContainer></div>)}
            </div>
        </div>
    );
}

