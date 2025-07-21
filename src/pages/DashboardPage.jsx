import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { ResponsiveContainer, BarChart, AreaChart, PieChart, Pie, Cell, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Sector } from 'recharts';
import { DollarSign, Hash, TrendingUp, Filter, XCircle, Building, ShoppingCart, RadioTower, Layers } from 'lucide-react';

const PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#9CA3AF'];

const formatCurrency = (number) => {
  if (typeof number !== 'number') return 'N/A';
  return number.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

const KpiCard = ({ title, value, icon }) => (
  <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50 flex items-center gap-5 transition-all hover:shadow-xl hover:scale-[1.02]">
    <div className="bg-indigo-100 p-4 rounded-xl">{icon}</div>
    <div>
      <h3 className="text-gray-500 font-medium">{title}</h3>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  const words = payload.name.split(' ');
  return (
    <g>
      <text x={cx} y={cy} textAnchor="middle" fill={fill} className="font-bold text-base">
        {words.map((word, index) => (<tspan x={cx} dy={index === 0 ? '-0.1em' : "1.1em"} key={index}>{word}</tspan>))}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill} />
    </g>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/80 backdrop-blur-md p-3 rounded-xl border border-gray-200/50 shadow-lg">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          {payload.map((pld, index) => (
            <div key={index} className="flex items-center justify-between text-sm min-w-[150px]">
                <div className="flex items-center"><div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: pld.fill || pld.stroke }}></div><span className="text-gray-600">{pld.name}:</span></div>
                <span className="font-bold ml-4">{formatCurrency(pld.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
};

export default function DashboardPage({ user }) {
  const [allExpenses, setAllExpenses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [marketingChannels, setMarketingChannels] = useState([]);
  const [channelCategories, setChannelCategories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [geographicAreas, setGeographicAreas] = useState([]);
  
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedSector, setSelectedSector] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);

  const branchMap = useMemo(() => new Map(branches.map(b => [b.id, b.name])), [branches]);
  const supplierMap = useMemo(() => new Map(suppliers.map(c => [c.id, c.name])), [suppliers]);
  const marketingChannelMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.name])), [marketingChannels]);
  const categoryMap = useMemo(() => new Map(channelCategories.map(c => [c.id, c.name])), [channelCategories]);
  const marketingChannelToCategoryMap = useMemo(() => new Map(marketingChannels.map(mc => [mc.id, mc.categoryId])), [marketingChannels]);
  const sectorMap = useMemo(() => new Map(sectors.map(s => [s.id, s.name])), [sectors]);

  useEffect(() => {
    const unsubs = [
        onSnapshot(query(collection(db, "expenses")), s => setAllExpenses(s.docs.map(d => ({ id: d.id, ...d.data() })))),
        onSnapshot(query(collection(db, "channels")), s => setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() })))),
        onSnapshot(query(collection(db, "marketing_channels")), s => setMarketingChannels(s.docs.map(d => ({ id: d.id, ...d.data() })))),
        onSnapshot(query(collection(db, "channel_categories")), s => setChannelCategories(s.docs.map(d => ({ id: d.id, ...d.data() })))),
        onSnapshot(query(collection(db, "branches")), s => setBranches(s.docs.map(d => ({ id: d.id, ...d.data() })))),
        onSnapshot(query(collection(db, "sectors"), orderBy("name")), s => setSectors(s.docs.map(d => ({ id: d.id, ...d.data() })))),
        onSnapshot(query(collection(db, "geographic_areas")), s => setGeographicAreas(s.docs.map(d => ({ id: d.id, ...d.data() }))))
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const analyticsData = useMemo(() => {
    const dateFilteredExpenses = allExpenses.filter(exp => {
      if (!dateFilter.startDate || !dateFilter.endDate) return true;
      const expDate = exp.date ? new Date(exp.date) : null;
      if (!expDate) return false;
      const start = new Date(dateFilter.startDate); start.setHours(0, 0, 0, 0);
      const end = new Date(dateFilter.endDate); end.setHours(23, 59, 59, 999);
      return expDate >= start && expDate <= end;
    });

    const sectorFilteredExpenses = dateFilteredExpenses.filter(exp => {
        if (selectedSector === 'all') return true;
        return exp.sectorId === selectedSector;
    });

    const fullyFilteredData = sectorFilteredExpenses.map(exp => {
        if (selectedBranch === 'all') return exp;
        if (!exp.isMultiBranch) return exp.branchId === selectedBranch ? exp : null;
        const relevantLineItems = exp.lineItems?.filter(item => {
          if (item.assignmentType === 'branch') return item.assignmentId === selectedBranch;
          if (item.assignmentType === 'area') {
              const area = geographicAreas.find(a => a.id === item.assignmentId);
              return area?.associatedBranches?.includes(selectedBranch);
          }
          return false;
        }) || [];
        if (relevantLineItems.length === 0) return null;
        const newTotalAmount = relevantLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        return { ...exp, amount: newTotalAmount, lineItems: relevantLineItems };
      }).filter(Boolean);

    const kpiData = {
        totalSpend: fullyFilteredData.reduce((sum, exp) => sum + (exp.amount || 0), 0),
        expenseCount: fullyFilteredData.length,
        averageSpend: fullyFilteredData.length > 0 ? fullyFilteredData.reduce((sum, exp) => sum + (exp.amount || 0), 0) / fullyFilteredData.length : 0
    };

    const spendTotals = fullyFilteredData.reduce((acc, exp) => {
        (exp.lineItems || []).forEach(item => {
            const itemAmount = item.amount || 0;
            const sectorName = sectorMap.get(exp.sectorId) || "N/D";
            const month = exp.date ? exp.date.substring(0, 7) : 'Senza Data';
            if (!acc.byMonth[month]) acc.byMonth[month] = { month };
            acc.byMonth[month][sectorName] = (acc.byMonth[month][sectorName] || 0) + itemAmount;
            const supplierName = supplierMap.get(exp.supplierId || exp.channelId) || "N/D";
            acc.bySupplier[supplierName] = (acc.bySupplier[supplierName] || 0) + itemAmount;
            const channelName = marketingChannelMap.get(item.marketingChannelId) || "N/D";
            acc.byMarketingChannel[channelName] = (acc.byMarketingChannel[channelName] || 0) + itemAmount;
            const categoryId = marketingChannelToCategoryMap.get(item.marketingChannelId);
            const categoryName = categoryMap.get(categoryId) || "N/D";
            acc.byCategory[categoryName] = (acc.byCategory[categoryName] || 0) + itemAmount;
            acc.bySector[sectorName] = (acc.bySector[sectorName] || 0) + itemAmount;
            if (exp.isMultiBranch) {
                if (item.assignmentType === 'area') {
                    const area = geographicAreas.find(a => a.id === item.assignmentId);
                    const branchesInArea = area?.associatedBranches || [];
                    if (branchesInArea.length > 0) {
                        const amountPerBranch = itemAmount / branchesInArea.length;
                        branchesInArea.forEach(branchId => {
                            const branchName = branchMap.get(branchId) || 'Sconosciuta';
                            acc.byBranch[branchName] = (acc.byBranch[branchName] || 0) + amountPerBranch;
                        });
                    }
                } else {
                    const branchName = branchMap.get(item.assignmentId) || "Non Assegnata";
                    acc.byBranch[branchName] = (acc.byBranch[branchName] || 0) + itemAmount;
                }
            } else {
                const branchName = branchMap.get(exp.branchId) || "Senza Filiale";
                acc.byBranch[branchName] = (acc.byBranch[branchName] || 0) + itemAmount;
            }
        });
        return acc;
    }, { bySupplier: {}, byMarketingChannel: {}, byCategory: {}, byBranch: {}, bySector: {}, byMonth: {} });

    const monthlyData = Object.values(spendTotals.byMonth).sort((a,b) => a.month.localeCompare(b.month));
    const spendByBranch = Object.entries(spendTotals.byBranch).map(([name, spesa]) => ({ name, spesa })).sort((a,b) => b.spesa - a.spesa);
    const spendByCategory = Object.entries(spendTotals.byCategory).map(([name, value]) => ({ name, value }));
    const spendBySupplier = Object.entries(spendTotals.bySupplier).map(([name, spesa]) => ({ name, spesa })).sort((a,b) => b.spesa - a.spesa).slice(0, 7);
    const spendByMarketingChannel = Object.entries(spendTotals.byMarketingChannel).map(([name, spesa]) => ({ name, spesa })).sort((a,b) => b.spesa - a.spesa).slice(0, 7);
    const spendBySector = Object.entries(spendTotals.bySector).map(([name, value]) => ({ name, value }));

    return { kpiData, spendByBranch, spendByCategory, spendBySupplier, spendByMarketingChannel, spendBySector, monthlyData };
  }, [allExpenses, suppliers, marketingChannels, branches, geographicAreas, channelCategories, sectors, dateFilter, selectedBranch, selectedSector]);

  const handleFilterChange = (e) => setDateFilter(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const resetFilters = () => { setDateFilter({ startDate: '', endDate: '' }); setSelectedBranch('all'); setSelectedSector('all'); };
  const onPieEnter = (_, index) => setActiveIndex(index);

  const FONT_STYLE = { fontFamily: 'system-ui, sans-serif', fontSize: '12px', fill: '#6b7280' };

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard Analitica</h1>
      <div className="bg-white/70 backdrop-blur-sm p-4 rounded-2xl shadow-lg border border-gray-200/50 flex flex-wrap items-center gap-4">
        <Filter className="text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-700 mr-4">Filtri</h3>
        <input type="date" name="startDate" value={dateFilter.startDate} onChange={handleFilterChange} className="border p-2 rounded-lg bg-transparent" />
        <input type="date" name="endDate" value={dateFilter.endDate} onChange={handleFilterChange} className="border p-2 rounded-lg bg-transparent" />
        <div className="flex items-center gap-2">
          <Building size={16} className="text-gray-500" /><select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="border p-2 rounded-lg bg-transparent"><option value="all">Tutte le Filiali</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        </div>
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-gray-500" /><select value={selectedSector} onChange={(e) => setSelectedSector(e.target.value)} className="border p-2 rounded-lg bg-transparent"><option value="all">Tutti i Settori</option>{sectors.map(sector => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select>
        </div>
        <button onClick={resetFilters} className="p-2 text-gray-500 hover:text-red-500 ml-auto"><XCircle /></button> 
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard title="Spesa Totale" value={formatCurrency(analyticsData.kpiData.totalSpend)} icon={<DollarSign className="text-indigo-600"/>} />
        <KpiCard title="Numero Spese" value={analyticsData.kpiData.expenseCount} icon={<Hash className="text-indigo-600"/>} />
        <KpiCard title="Spesa Media" value={formatCurrency(analyticsData.kpiData.averageSpend)} icon={<TrendingUp className="text-indigo-600"/>} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50">
          <h3 className="font-bold text-lg text-gray-800 mb-4">Andamento Mensile per Settore</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData.monthlyData}>
              <defs>
                {sectors.map((sector, index) => (<linearGradient key={sector.id} id={`color${sector.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={PALETTE[index % PALETTE.length]} stopOpacity={0.7}/><stop offset="95%" stopColor={PALETTE[index % PALETTE.length]} stopOpacity={0}/></linearGradient>))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" style={FONT_STYLE} />
              <YAxis tickFormatter={formatCurrency} style={FONT_STYLE} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              {sectors.map((sector, index) => (<Area key={sector.id} type="monotone" dataKey={sector.name} stackId="1" stroke={PALETTE[index % PALETTE.length]} fill={`url(#color${sector.id})`} strokeWidth={2} />))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50">
            <h3 className="font-bold text-lg text-gray-800 mb-4">{selectedSector === 'all' ? 'Spesa per Settore' : 'Spesa per Categoria'}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie activeIndex={activeIndex} activeShape={renderActiveShape} data={selectedSector === 'all' ? analyticsData.spendBySector : analyticsData.spendByCategory} cx="50%" cy="50%" innerRadius={80} outerRadius={100} dataKey="value" onMouseEnter={onPieEnter}>
                        {(selectedSector === 'all' ? analyticsData.spendBySector : analyticsData.spendByCategory).map((entry, index) => (<Cell key={`cell-${entry.name}`} fill={PALETTE[index % PALETTE.length]} />))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        </div>
        <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50">
            <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><RadioTower size={18}/> Top Canali di Marketing</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.spendByMarketingChannel} layout="vertical" margin={{ left: 120 }}>
                    <defs><linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={PALETTE[1]} stopOpacity={0.7} /><stop offset="100%" stopColor={PALETTE[0]} stopOpacity={1} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={formatCurrency} style={FONT_STYLE} />
                    <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} style={FONT_STYLE} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="spesa" name="Spesa" radius={[0, 10, 10, 0]} barSize={20} fill="url(#barGradient)" />
                </BarChart>
            </ResponsiveContainer>
        </div>
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50">
            <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><ShoppingCart size={18}/> Top Fornitori per Spesa</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.spendBySupplier} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={formatCurrency} style={FONT_STYLE} />
                    <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} style={FONT_STYLE} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="spesa" name="Spesa" radius={[0, 10, 10, 0]} barSize={20} fill="url(#barGradient)" />
                </BarChart>
            </ResponsiveContainer>
        </div>
        {selectedBranch === 'all' && (
            <div className="lg:col-span-2 bg-white/70 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-200/50">
                <h3 className="font-bold text-lg text-gray-800 mb-4">Spesa per Filiale</h3>
                 <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={analyticsData.spendByBranch} layout="vertical" margin={{ left: 100 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={formatCurrency} style={FONT_STYLE} />
                        <YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} style={FONT_STYLE} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="spesa" name="Spesa" radius={[0, 10, 10, 0]} barSize={20} fill="url(#barGradient)" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        )}
      </div>
    </div>
  );
}