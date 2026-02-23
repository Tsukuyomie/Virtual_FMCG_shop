import React, { useEffect, useReducer, useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { 
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';

/**
 * REDUCER LOGIC
 * Manages state transitions to prevent "Race Conditions" where 
 * database syncs might overwrite live WebSocket updates.
 */
const dashboardReducer = (state, action) => {
  switch (action.type) {
    case 'SYNC_DATABASE':
      return { 
        ...state, 
        ...action.payload,
        isInitialLoad: false 
      };
    case 'LIVE_SALE':
      return {
        ...state,
        kpis: {
          ...state.kpis,
          revenue: (state.kpis.revenue || 0) + action.payload.total_price,
          profit: (state.kpis.profit || 0) + (action.payload.total_price * 0.25),
          orders: (state.kpis.orders || 0) + 1
        }
      };
    default:
      return state;
  }
};

const initialState = {
  hourly: [],
  categoryPerformance: [],
  basketDistribution: [],
  isInitialLoad: true,
  kpis: { revenue: 0, profit: 0, aov: 0, orders: 0, top_category: "Synchronizing..." }
};

const Dashboard = () => {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const [liveFeed, setLiveFeed] = useState([]);
  const [wsStatus, setWsStatus] = useState("Connecting...");
  const ws = useRef(null);
  
  const BASE_URL = 'https://virtual-fmcg-shop.onrender.com';

  /**
   * FETCH ENGINE
   * Pulls the absolute historical truth from PostgreSQL.
   */
  const fetchData = useCallback(async () => {
    try {
      const endpoints = ['hourly_sales', 'kpi', 'category_performance', 'basket_distribution'];
      const [hr, kpi, cat, basket] = await Promise.all(
        endpoints.map(ep => axios.get(`${BASE_URL}/${ep}`))
      );
      
      dispatch({
        type: 'SYNC_DATABASE',
        payload: {
          hourly: hr.data || [],
          kpis: kpi.data || initialState.kpis,
          categoryPerformance: cat.data || [],
          basketDistribution: basket.data || []
        }
      });
    } catch (err) {
      console.error("📊 BI Sync Error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const pollInterval = setInterval(fetchData, 45000); // Sync every 45s

    const connectWS = () => {
      ws.current = new WebSocket('wss://virtual-fmcg-shop.onrender.com/ws');
      
      ws.current.onopen = () => setWsStatus("Live");
      
      ws.current.onmessage = (e) => {
        try {
          const incoming = JSON.parse(e.data);
          if (incoming.type === "SALE") {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setLiveFeed(prev => [{msg: incoming.message, time}, ...prev].slice(0, 10));
            dispatch({ type: 'LIVE_SALE', payload: incoming });
          }
        } catch (err) {
          console.error("WS Parse Error", err);
        }
      };

      ws.current.onclose = () => {
        setWsStatus("Retrying...");
        setTimeout(connectWS, 5000); // Auto-reconnect
      };

      ws.current.onerror = () => ws.current.close();
    };

    connectWS();

    return () => {
      clearInterval(pollInterval);
      if (ws.current) ws.current.close();
    };
  }, [fetchData]);

  // Loading Shield: Prevents showing "0" while the first fetch happens
  if (state.isInitialLoad) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="font-bold text-slate-400 uppercase tracking-widest">Warming BI Engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-layout">
      {/* 1. Header & System Status */}
      <div className="col-span-12 flex justify-between items-end mb-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
            FMCG <span className="text-blue-500">Pulse</span>
          </h1>
          <p className="text-slate-500 font-medium">Real-time Revenue & Supply Chain Intelligence</p>
        </div>
        <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm ${
          wsStatus === 'Live' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
        }`}>
          ● {wsStatus}
        </div>
      </div>

      {/* 2. KPI Section */}
      <div className="glass-card col-span-3">
        <h3>Gross Revenue</h3>
        <div className="kpi-value">₹{(state.kpis.revenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
      </div>
      
      <div className="glass-card col-span-3">
        <h3>Net Profit (25%)</h3>
        <div className="kpi-value text-emerald-500">₹{(state.kpis.profit || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
      </div>

      <div className="glass-card col-span-3">
        <h3>Order Volume</h3>
        <div className="kpi-value">{state.kpis.orders || 0}</div>
      </div>

      <div className="glass-card col-span-3">
        <h3>Top Category</h3>
        <div className="kpi-value text-blue-500 text-xl truncate">{state.kpis.top_category}</div>
      </div>

      {/* 3. Main Momentum Chart */}
      <div className="glass-card col-span-8">
        <div className="flex justify-between items-center mb-6">
          <h3>Intraday Momentum</h3>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">24H ROLLING</span>
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={state.hourly}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
            <Tooltip 
               isAnimationActive={false} 
               contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#3b82f6" 
              strokeWidth={3} 
              fill="url(#chartGradient)" 
              isAnimationActive={false} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 4. Live Market Stream */}
      <div className="glass-card col-span-4 flex flex-col">
        <h3>Live Market Stream</h3>
        <div className="overflow-y-auto flex-1 mt-2 pr-2 custom-scrollbar">
          {liveFeed.map((item, i) => (
            <div key={i} className="py-3 border-b border-slate-50 last:border-0 animate-in slide-in-from-right duration-500">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                <span className="text-[10px] font-bold text-blue-500 uppercase">{item.time}</span>
              </div>
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">{item.msg}</p>
            </div>
          ))}
          {liveFeed.length === 0 && (
            <div className="h-full flex items-center justify-center text-slate-300 text-xs italic">
              Awaiting transactions...
            </div>
          )}
        </div>
      </div>

      {/* 5. Distribution Charts */}
      <div className="glass-card col-span-6">
        <h3>Category Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={state.categoryPerformance} layout="vertical">
            <XAxis type="number" hide />
            <YAxis dataKey="category" type="category" width={100} axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 600, fill: '#64748b'}} />
            <Tooltip isAnimationActive={false} />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card col-span-6">
        <h3>Basket Depth Analysis</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={state.basketDistribution}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="items" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
            <Tooltip isAnimationActive={false} />
            <Bar dataKey="frequency" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* FOOTER: System Architecture */}
      <footer className="col-span-12 mt-8 pt-8 border-t border-slate-200 text-center">
        <div className="flex justify-center gap-8 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500">
          <span className="text-[10px] font-black uppercase tracking-widest">FastAPI Backend</span>
          <span className="text-[10px] font-black uppercase tracking-widest">PostgreSQL Persistence</span>
          <span className="text-[10px] font-black uppercase tracking-widest">WebSocket Streaming</span>
          <span className="text-[10px] font-black uppercase tracking-widest">React BI Engine</span>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
