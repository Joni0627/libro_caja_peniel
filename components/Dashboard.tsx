import React, { useMemo, useState, useEffect } from 'react';
import { Transaction, MovementCategory, MovementType } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Wallet, TrendingUp, Filter, Calendar } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  movementTypes: MovementType[];
}

// Peniel Palette: Navy (#1B365D), Lime (#84cc16)
const COLORS = ['#1B365D', '#84cc16', '#3b82f6', '#f59e0b', '#64748b', '#ec4899', '#8b5cf6'];

const Dashboard: React.FC<DashboardProps> = ({ transactions, movementTypes }) => {
  
  // --- FILTER STATE ---
  const [filterMode, setFilterMode] = useState<'all' | 'range'>('all');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // --- CHART STATE ---
  // Default to ARS or the first available currency in transactions
  const availableCurrencies = useMemo(() => Array.from(new Set(transactions.map(t => t.currency))), [transactions]);
  const [chartCurrency, setChartCurrency] = useState<string>('ARS');

  useEffect(() => {
    if (availableCurrencies.length > 0 && !availableCurrencies.includes(chartCurrency)) {
        setChartCurrency(availableCurrencies[0]);
    }
  }, [availableCurrencies, chartCurrency]);

  // --- FILTERED DATA FOR TOTALS (Global Filters) ---
  const filteredTransactions = useMemo(() => {
    if (filterMode === 'all') return transactions;
    return transactions.filter(t => t.date >= startDate && t.date <= endDate);
  }, [transactions, filterMode, startDate, endDate]);

  // --- STATS CALCULATION (Grouped by Currency) ---
  const statsByCurrency = useMemo(() => {
    const data: Record<string, { balance: number; income: number; expense: number }> = {};

    filteredTransactions.forEach(t => {
      const currency = t.currency || 'ARS';
      if (!data[currency]) {
          data[currency] = { balance: 0, income: 0, expense: 0 };
      }

      const type = movementTypes.find(mt => mt.id === t.movementTypeId);
      if (type?.category === MovementCategory.INCOME) {
        data[currency].income += t.amount;
        data[currency].balance += t.amount;
      } else {
        data[currency].expense += t.amount;
        data[currency].balance -= t.amount;
      }
    });

    return data;
  }, [filteredTransactions, movementTypes]);

  // --- CHART DATA (Specific to Chart Currency) ---
  const chartData = useMemo(() => {
    const data: Record<string, { income: number; expense: number }> = {};
    
    // 1. Filter by Date Range AND Selected Chart Currency
    const relevantTransactions = filteredTransactions.filter(t => t.currency === chartCurrency);
    
    // Sort transactions by date
    const sorted = [...relevantTransactions].sort((a, b) => a.date.localeCompare(b.date));

    sorted.forEach(t => {
        let key = t.date; // Default YYYY-MM-DD
        
        if (filterMode === 'all') {
             // Group by Month (YYYY-MM) for cleaner sorting, but label as Month Name
             const d = new Date(t.date);
             // We use a sortable key internally, but we can just use the label if we sort the array later
             // Let's use Year-Month as key to aggregate
             key = t.date.substring(0, 7); 
        } else {
             // Group by Day
             // Format nicely for key? No, keep ISO for sorting, format in UI
             key = t.date;
        }

        if (!data[key]) {
            data[key] = { income: 0, expense: 0 };
        }

        const type = movementTypes.find(mt => mt.id === t.movementTypeId);
        
        if(type?.category === MovementCategory.INCOME) data[key].income += t.amount;
        else data[key].expense += t.amount;
    });

    // Transform to array and sort
    return Object.entries(data)
        .map(([key, val]) => {
            let label = key;
            const [y, m, d] = key.split('-');
            
            if (filterMode === 'all') {
                // Key is YYYY-MM
                const dateObj = new Date(parseInt(y), parseInt(m) - 1);
                label = dateObj.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
            } else {
                // Key is YYYY-MM-DD
                label = `${d}/${m}`;
            }

            return { 
                name: label,
                sortKey: key, 
                ...val 
            };
        })
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  }, [filteredTransactions, movementTypes, filterMode, chartCurrency]);


  // Pie Chart: Category Distribution (Filtered by Chart Currency too for consistency? Or Global?)
  // Usually better global, but mixing amounts is bad. Let's filter by chart currency for consistency.
  const typeData = useMemo(() => {
      const data: Record<string, number> = {};
      // Use transactions filtered by the selected currency
      const currencyTransactions = filteredTransactions.filter(t => t.currency === chartCurrency);

      currencyTransactions.forEach(t => {
          const type = movementTypes.find(mt => mt.id === t.movementTypeId);
          if (type) {
              // We count occurrences or sum amount? 
              // "Distribución por Tipo" usually implies volume of money or frequency.
              // Let's go with Frequency (Count) as it works better across mixed amounts, 
              // BUT user probably wants to know where the money went.
              // Let's sum Amount.
              data[type.name] = (data[type.name] || 0) + t.amount; 
          }
      });
      return Object.entries(data)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value) 
        .slice(0, 8); 
  }, [filteredTransactions, movementTypes, chartCurrency]);


  const formatMoney = (amount: number, currency: string) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount);
  };

  const hasData = Object.keys(statsByCurrency).length > 0;

  return (
    <div className="space-y-6">
      
      {/* --- FILTERS HEADER --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-[#1B365D]">
            <Filter className="w-5 h-5" />
            <h3 className="font-bold">Filtros de Análisis</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterMode === 'all' ? 'bg-white text-[#1B365D] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Histórico
                </button>
                <button 
                    onClick={() => setFilterMode('range')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterMode === 'range' ? 'bg-white text-[#1B365D] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Por Periodo
                </button>
            </div>

            {filterMode === 'range' && (
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Calendar className="w-3 h-3 absolute left-2 top-3 text-slate-400" />
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="pl-7 pr-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] bg-white text-slate-900"
                        />
                    </div>
                    <span className="text-slate-400">-</span>
                    <input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1B365D] bg-white text-slate-900"
                    />
                </div>
            )}
        </div>
      </div>

      {/* --- MULTI-CURRENCY CARDS --- */}
      {!hasData ? (
        <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300 text-slate-500">
            No hay movimientos registrados para este periodo o moneda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(statsByCurrency).map(([currency, data]: [string, { balance: number; income: number; expense: number }]) => (
                <div key={currency} className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-100 flex flex-col">
                    <div className="bg-[#1B365D] px-6 py-3 flex justify-between items-center">
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-[#84cc16]" /> 
                            Caja {currency}
                        </h3>
                        <span className="text-xs bg-[#84cc16] text-[#1B365D] font-bold px-2 py-0.5 rounded-full">
                            Activa
                        </span>
                    </div>
                    
                    <div className="p-6 flex flex-col gap-4 flex-1 justify-between">
                         <div>
                            <p className="text-sm text-slate-500 font-medium mb-1">Saldo Actual</p>
                            <p className={`text-3xl font-bold ${data.balance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                                {formatMoney(data.balance, currency)}
                            </p>
                         </div>

                         <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                            <div>
                                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-[#84cc16]"></div> Entradas
                                </div>
                                <p className="text-lg font-semibold text-[#84cc16]">
                                    {formatMoney(data.income, currency)}
                                </p>
                            </div>
                            <div>
                                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-rose-500"></div> Salidas
                                </div>
                                <p className="text-lg font-semibold text-rose-500">
                                    {formatMoney(data.expense, currency)}
                                </p>
                            </div>
                         </div>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* --- CHARTS ROW --- */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-96 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-[#1B365D] flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" /> 
                        Evolución ({chartCurrency})
                    </h3>
                    
                    {/* Currency Selector for Chart */}
                    <select 
                        value={chartCurrency}
                        onChange={(e) => setChartCurrency(e.target.value)}
                        className="text-xs bg-slate-100 border-none rounded-lg py-1 px-2 font-bold text-[#1B365D] focus:ring-2 focus:ring-[#1B365D]"
                    >
                        {availableCurrencies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} tickMargin={10} />
                            <YAxis fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: '#f1f5f9' }} 
                                formatter={(value: number) => [formatMoney(value, chartCurrency), '']}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            <Bar dataKey="income" name="Entradas" fill="#84cc16" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            <Bar dataKey="expense" name="Salidas" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={50} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-96 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-[#1B365D] flex items-center gap-2">
                        <Filter className="w-5 h-5" /> Distribución ({chartCurrency})
                    </h3>
                     {/* Use same state for simplicity, or add another selector if they want different currencies per chart */}
                     <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                        Por Monto
                     </span>
                </div>
                
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={typeData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={90}
                                paddingAngle={4}
                                dataKey="value"
                            >
                                {typeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => formatMoney(value, chartCurrency)}
                            />
                            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '11px', maxWidth: '40%' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;