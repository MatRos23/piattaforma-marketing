import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ResponsiveContainer, AreaChart, PieChart, Pie, Cell, BarChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Sector, Treemap } from 'recharts';
import { DollarSign, ShoppingCart, RadioTower, Filter, XCircle, Car, Sailboat, Caravan, Building2, Calendar as CalendarIcon, SlidersHorizontal, Layers, Users, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

// --- CONFIGURAZIONE E COMPONENTI GRAFICI ---

const CHART_COLORS = ['#312e81', '#4338ca', '#4f46e5', '#6366f1', '#a5b4fc', '#94a3b8', '#cbd5e1'];
const ACCENT_COLOR = '#facc15';
const FONT_STYLE = { fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif', fontSize: '12px', fill: '#6B7280' };

const sectorIcons = {
    'Auto': <Car className="w-4 h-4" />,
    'Camper&Caravan': <Caravan className="w-4 h-4" />,
    'Yachting': <Sailboat className="w-4 h-4" />,
    'Frattin Group': <Building2 className="w-4 h-4" />,
    'default': <DollarSign className="w-4 h-4" />,
};

const getSectorIcon = (sectorName) => sectorIcons[sectorName] || sectorIcons.default;

const formatCurrency = (number) => {
    if (typeof number !== 'number') return 'N/A';
    return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const chartLabel = label || payload[0].payload.name;
        return (
            <div className="bg-white/80 backdrop-blur-sm p-3 rounded-xl border shadow-lg">
                <p className="font-bold text-gray-800 mb-2">{chartLabel}</p>
                {payload.map((pld, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: pld.fill || pld.stroke }}></div>
                            <span className="text-gray-600">{pld.name || 'Valore'}:</span>
                        </div>
                        <span className="font-bold ml-4">{formatCurrency(pld.value)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const CustomPieLegend = ({ data }) => (
    <ul className="space-y-3 text-sm text-gray-600 h-full flex flex-col justify-center">
        {data.map((entry, index) => (
            <li key={`item-${index}`} className="flex items-center justify-between">
                <div className="flex items-center">
                    <div className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                    <span>{entry.name}</span>
                </div>
                <span className="font-semibold">{formatCurrency(entry.value)}</span>
            </li>
        ))}
    </ul>
);

const KpiCard = ({ title, value, icon }) => (
    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border flex items-center gap-4">
        <div className="bg-indigo-100 p-3 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const CustomizedTreemapContent = ({ root, depth, x, y, width, height, index, name, value }) => {
    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: CHART_COLORS[index % CHART_COLORS.length],
                    stroke: '#fff',
                    strokeWidth: 2,
                    strokeOpacity: 0.5,
                }}
            />
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


// --- COMPONENTE PRINCIPALE ---

export default function DashboardPage({ user, navigate }) {
    const [allExpenses, setAllExpenses] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [focusedItem, setFocusedItem] = useState(null);

    const [dateFilter, setDateFilter] = useState(() => {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
        return { 
            startDate: startDate.toISOString().split('T')[0], 
            endDate: endDate.toISOString().split('T')[0] 
        };
    });
    const [selectedSector, setSelectedSector] = useState('all');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [selectedSupplier, setSelectedSupplier] = useState('all');

    // Mappe per performance
    const supplierMap = useMemo(() => new Map(suppliers.map(c => [c.id, c.name])), [suppliers]);
    const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);
    const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
    const branchNameToIdMap = useMemo(() => new Map(branches.map(b => [b.name, b.id])), [branches]);
    
    // Caricamento dati da Firestore
    useEffect(() => {
        const unsubs = [
            onSnapshot(query(collection(db, "expenses")), s => setAllExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })))),
            onSnapshot(query(collection(db, "channels"), orderBy("name")), s => setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() })))),
            onSnapshot(query(collection(db, "branches")), s => setBranches(s.docs.map(d => ({ id: d.id, ...d.data() })))),
            onSnapshot(query(collection(db, "sectors"), orderBy("name")), s => setSectors(s.docs.map(d => ({ id: d.id, ...d.data() })))),
            onSnapshot(query(collection(db, "budgets")), s => setBudgets(s.docs.map(d => ({ id: d.id, ...d.data() })))),
        ];
        return () => unsubs.forEach(unsub => unsub());
    }, []);
    
    const filteredBranches = useMemo(() => {
        if (selectedSector === 'all') return branches.filter(b => b.name.toLowerCase() !== 'generico');
        return branches.filter(b => b.associatedSectors?.includes(selectedSector) && b.name.toLowerCase() !== 'generico');
    }, [selectedSector, branches]);

    // Motore di calcolo potenziato
    const analyticsData = useMemo(() => {
        const genericoBranch = branches.find(b => b.name.toLowerCase() === 'generico');
        const realBranches = branches.filter(b => b.id !== genericoBranch?.id);
        
        const sectorToBranchesMap = new Map();
        sectors.forEach(sector => {
            const sectorBranches = realBranches.filter(b => b.associatedSectors?.includes(sector.id));
            sectorToBranchesMap.set(sector.id, sectorBranches);
        });
        
        const frattinGroupSector = sectors.find(s => s.name === 'Frattin Group');

        const filteredByDate = allExpenses.filter(exp => {
            if (!dateFilter.startDate || !dateFilter.endDate) return true;
            const expDate = exp.date ? new Date(exp.date) : null;
            if (!expDate) return false;
            const start = new Date(dateFilter.startDate); start.setHours(0, 0, 0, 0);
            const end = new Date(dateFilter.endDate); end.setHours(23, 59, 59, 999);
            return expDate >= start && expDate <= end;
        });

        const totals = { bySupplier: {}, bySector: {}, byBranch: {}, byMonth: {} };

        const processItem = (branchId, amount, exp) => {
            const branchName = branchMap.get(branchId);
            if (!branchName) {
                console.warn(`Spesa ID ${exp.id} ha un'assegnazione non valida: ${branchId}. Voce ignorata.`);
                return;
            }

            const sectorName = sectorMap.get(exp.sectorId) || "N/D";
            const supplierName = supplierMap.get(exp.supplierId || exp.channelId) || "N/D";
            const month = exp.date ? exp.date.substring(0, 7) : 'Senza Data';

            if (selectedSector !== 'all' && exp.sectorId !== selectedSector) return;
            if (selectedBranch !== 'all' && branchId !== selectedBranch) return;

            totals.bySupplier[supplierName] = (totals.bySupplier[supplierName] || 0) + amount;
            totals.bySector[sectorName] = (totals.bySector[sectorName] || 0) + amount;
            totals.byBranch[branchName] = (totals.byBranch[branchName] || 0) + amount;

            if (!totals.byMonth[month]) totals.byMonth[month] = { total: 0 };
            totals.byMonth[month].total = (totals.byMonth[month].total || 0) + amount;
        };

        filteredByDate.forEach(exp => {
            if (selectedSupplier !== 'all' && (exp.supplierId || exp.channelId) !== selectedSupplier) return;

            (exp.lineItems || []).forEach(item => {
                const itemAmount = item.amount || 0;

                if (exp.isMultiBranch) {
                    const branchIds = item.branchIds || [];
                    if (branchIds.length > 0) {
                        const amountPerBranch = itemAmount / branchIds.length;
                        branchIds.forEach(branchId => {
                            processItem(branchId, amountPerBranch, exp);
                        });
                    }
                } else {
                    const branchId = exp.branchId;
                    if (branchId === genericoBranch?.id) {
                        let targetBranches = [];
                        if (exp.sectorId === frattinGroupSector?.id) {
                            targetBranches = realBranches;
                        } else {
                            targetBranches = sectorToBranchesMap.get(exp.sectorId) || [];
                        }
                        if (targetBranches.length > 0) {
                            const amountPerBranch = itemAmount / targetBranches.length;
                            targetBranches.forEach(branch => processItem(branch.id, amountPerBranch, exp));
                        }
                    } else {
                        processItem(branchId, itemAmount, exp);
                    }
                }
            });
        });

        const totalSpend = Object.values(totals.byBranch).reduce((sum, val) => sum + val, 0);
        const spendBySupplier = Object.entries(totals.bySupplier).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        const spendBySector = Object.entries(totals.bySector).map(([name, value]) => ({ name, value }));
        const spendByBranch = Object.entries(totals.byBranch).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        
        const activeSuppliersCount = Object.keys(totals.bySupplier).length;
        const expenseCount = filteredByDate.length;

        const monthlyData = Object.entries(totals.byMonth).map(([month, values]) => ({ 
            month, 
            ...values,
        })).sort((a,b) => a.month.localeCompare(b.month));

        return { totalSpend, spendBySupplier, spendBySector, spendByBranch, monthlyData, activeSuppliersCount, expenseCount };
    }, [allExpenses, suppliers, branches, sectors, dateFilter, selectedSector, selectedBranch, selectedSupplier]);

    const resetFilters = () => {
        setDateFilter(() => {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 6);
            return {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            };
        });
        setSelectedSector('all');
        setSelectedBranch('all');
        setSelectedSupplier('all');
        toast.success("Filtri resettati!");
    };

    const handleBranchClick = (data) => {
        if (data && data.name) {
            if (data.name === 'N/D') {
                navigate('expenses', { specialFilter: 'unassigned' });
            } else {
                const branchId = branchNameToIdMap.get(data.name);
                if (branchId) {
                    navigate('expenses', { branchFilter: [branchId] });
                }
            }
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
            </div>
            
            <div className="mb-6 p-4 bg-white/70 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-4">
                        <label className="text-sm font-bold text-gray-600 block mb-1">Periodo</label>
                        <div className="flex items-center gap-2">
                            <input type="date" name="startDate" value={dateFilter.startDate} onChange={(e) => setDateFilter(prev => ({...prev, startDate: e.target.value}))} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" />
                            <span className="text-gray-500">al</span>
                            <input type="date" name="endDate" value={dateFilter.endDate} onChange={(e) => setDateFilter(prev => ({...prev, endDate: e.target.value}))} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" />
                        </div>
                    </div>
                    <div className="md:col-span-4">
                        <label className="text-sm font-bold text-gray-600 block mb-1">Fornitore</label>
                        <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition">
                            <option value="all">Tutti i Fornitori</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="md:col-span-4">
                        <label className="text-sm font-bold text-gray-600 block mb-1">Filiale</label>
                        <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="w-full h-11 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition" disabled={filteredBranches.length === 0}>
                            <option value="all">Tutte le Filiali</option>
                            {filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="border-t border-gray-200 !my-4"></div>

                <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setSelectedSector('all')} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-2 ${selectedSector === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}>
                            <Layers size={14} /> Tutti i Settori
                        </button>
                        {sectors.map(sector => (
                            <button key={sector.id} onClick={() => setSelectedSector(sector.id)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition flex items-center gap-2 ${selectedSector === sector.id ? 'bg-indigo-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}>
                                {getSectorIcon(sector.name)}
                                {sector.name}
                            </button>
                        ))}
                    </div>
                    <div>
                        <button onClick={resetFilters} className="text-sm font-semibold text-red-600 hover:text-red-800 transition flex items-center gap-2 bg-red-100 px-3 py-2 rounded-lg">
                            <XCircle size={16} />
                            Reset Filtri
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <KpiCard title="Spesa Totale" value={formatCurrency(analyticsData.totalSpend)} icon={<DollarSign className="w-6 h-6 text-indigo-600"/>} />
                <KpiCard title="Fornitori Attivi" value={analyticsData.activeSuppliersCount} icon={<Users className="w-6 h-6 text-indigo-600"/>} />
                <KpiCard title="Totale Spese" value={analyticsData.expenseCount} icon={<Hash className="w-6 h-6 text-indigo-600"/>} />
            </div>

            <div className="grid grid-cols-1 gap-8">
                <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border col-span-1">
                    <h3 className="font-bold text-lg text-gray-800 mb-4">Andamento Mensile</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={analyticsData.monthlyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                             <defs>
                                <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="month" tick={FONT_STYLE} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(value) => `€${new Intl.NumberFormat('it-IT', { notation: 'compact', compactDisplay: 'short' }).format(value)}`} tick={FONT_STYLE} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#9CA3AF', strokeWidth: 1, strokeDasharray: '3 3' }} />
                            <Area 
                                type="monotone" 
                                dataKey="total" 
                                name="Spesa Totale"
                                stroke="#312e81" 
                                strokeWidth={3}
                                fill="url(#totalGradient)"
                                activeDot={{ r: 6, strokeWidth: 2, fill: '#fff' }} 
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {selectedSupplier === 'all' && analyticsData.spendBySupplier.length > 1 && (
                        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border">
                            <h3 className="font-bold text-lg text-gray-800 mb-4">Top 5 Fornitori</h3>
                             <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={analyticsData.spendBySupplier.slice(0, 5)} layout="vertical" margin={{ left: 20, right: 20 }}>
                                   <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                   <XAxis type="number" tick={false} axisLine={false} tickLine={false} width={0} />
                                   <YAxis type="category" dataKey="name" width={100} tick={FONT_STYLE} axisLine={false} tickLine={false} />
                                   <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(238, 242, 255, 0.6)' }} />
                                   <Bar dataKey="value" name="Spesa" radius={[0, 8, 8, 0]}>
                                       {analyticsData.spendBySupplier.slice(0, 5).map((entry, index) => (
                                           <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                       ))}
                                   </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                     {selectedSector === 'all' && analyticsData.spendBySector.length > 1 && (
                        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800 mb-4">Spesa per Settore</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={analyticsData.spendBySector} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={5}>
                                            {analyticsData.spendBySector.map((entry, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="self-center">
                                <CustomPieLegend data={analyticsData.spendBySector} />
                            </div>
                        </div>
                    )}
                </div>
                
                {selectedBranch === 'all' && analyticsData.spendByBranch.length > 1 && (
                    <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border col-span-1">
                        <h3 className="font-bold text-lg text-gray-800 mb-4">Ripartizione Spesa per Filiale</h3>
                        <ResponsiveContainer width="100%" height={300}>
                             <Treemap
                                width={400}
                                height={200}
                                data={analyticsData.spendByBranch}
                                dataKey="value"
                                nameKey="name"
                                ratio={4 / 3}
                                stroke="#fff"
                                fill="#8884d8"
                                content={<CustomizedTreemapContent />}
                                onClick={handleBranchClick}
                                className="cursor-pointer"
                            >
                               <Tooltip content={<CustomTooltip />} />
                            </Treemap>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
