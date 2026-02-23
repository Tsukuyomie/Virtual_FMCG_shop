import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart 
} from 'recharts';

/**
 * @component CustomTooltip
 * @description Uses the .glass-card class for a professional, floating look.
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card" style={{ padding: '10px', border: 'none' }}>
        <p style={{ fontWeight: 700, margin: '0 0 5px', fontSize: '12px' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, margin: 0, fontSize: '13px', fontWeight: 500 }}>
            {p.name}: ₹{p.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const [data, setData] = useState({ 
    hourly: [], categoryPerformance: [], basketDistribution: [],
    kpis: { revenue: 0, profit: 0, aov: 0, orders: 0, top_category: "Analyzing..." } 
  });
  const [liveFeed, setLiveFeed] = useState([]);

  const fetchData = async () => {
    try {
      const endpoints = ['hourly_sales', 'kpi', 'category_performance', 'basket_distribution'];
      const responses = await Promise.all(
        endpoints.map(ep => axios.get(`/api/${ep}`))
      );
      setData({
        hourly: responses[0].data,
        kpis: responses[1].data,
        categoryPerformance: responses[2].data,
        basketDistribution: responses[3].data
      });
    } catch (err) {
      console.error("BI Engine Error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const ws = new WebSocket('wss://virtual-fmcg-shop.onrender.com/ws');
    ws.onmessage = (e) => {
      const incoming = JSON.parse(e.data);
      if (incoming.type === "SALE") {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLiveFeed(prev => [{msg: incoming.message, time}, ...prev].slice(0, 8));
        setData(prev => ({
          ...prev,
          kpis: {
            ...prev.kpis,
            revenue: prev.kpis.revenue + incoming.total_price,
            profit: prev.kpis.profit + (incoming.total_price * 0.25),
            orders: prev.kpis.orders + 1
          }
        }));
      }
    };
    return () => ws.close();
  }, []);

  return (
    <div className="grid-layout">
      {/* 1. Header Section */}
      <div style={{ gridColumn: 'span 12', marginBottom: '1rem' }}>
        <h1 style={{ fontWeight: 800, fontSize: '2.5rem', margin: 0, letterSpacing: '-0.02em' }}>
          FMCG <span style={{ color: 'var(--accent-blue)' }}>Pulse</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
          Real-time Supply Chain & Revenue Intelligence
        </p>
      </div>

      {/* 2. KPI Section - Using .glass-card and .kpi-value */}
      <div className="glass-card" style={{ gridColumn: 'span 3' }}>
        <h3>Gross Revenue</h3>
        <div className="kpi-value">₹{data.kpis.revenue.toLocaleString()}</div>
      </div>
      
      <div className="glass-card" style={{ gridColumn: 'span 3' }}>
        <h3>Net Profit</h3>
        <div className="kpi-value" style={{ color: 'var(--accent-green)' }}>
          ₹{data.kpis.profit.toLocaleString()}
        </div>
      </div>

      <div className="glass-card" style={{ gridColumn: 'span 3' }}>
        <h3>Total Orders</h3>
        <div className="kpi-value">{data.kpis.orders}</div>
      </div>

      <div className="glass-card" style={{ gridColumn: 'span 3' }}>
        <h3>Peak Category</h3>
        <div className="kpi-value" style={{ fontSize: '1.2rem', color: 'var(--accent-blue)' }}>
          {data.kpis.top_category}
        </div>
      </div>

      {/* 3. Main Chart - Taking up 8 columns of the 12-column grid */}
      <div className="glass-card" style={{ gridColumn: 'span 8' }}>
        <h3>Revenue Momentum</h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data.hourly}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 12}} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke="var(--accent-blue)" strokeWidth={3} fill="url(#colorRev)" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 4. Live Stream - Taking up 4 columns */}
      <div className="glass-card" style={{ gridColumn: 'span 4' }}>
        <h3>Market Activity Stream</h3>
        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
          {liveFeed.map((item, i) => (
            <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '10px', color: 'var(--accent-blue)', fontWeight: 700 }}>{item.time}</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.msg}</div>
            </div>
          ))}
          {liveFeed.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Awaiting transactions...</p>}
        </div>
      </div>

      {/* 5. Distribution Charts - Spanning 6 columns each */}
      <div className="glass-card" style={{ gridColumn: 'span 6' }}>
        <h3>Category Revenue Split</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.categoryPerformance} layout="vertical">
            <XAxis type="number" hide />
            <YAxis dataKey="category" type="category" width={100} axisLine={false} tickLine={false} tick={{fontSize: 12}} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" fill="var(--accent-blue)" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card" style={{ gridColumn: 'span 6' }}>
        <h3>Basket Depth Analysis</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.basketDistribution}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="items" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="frequency" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Dashboard;
