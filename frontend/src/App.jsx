import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, BarChart 
} from 'recharts';

const Dashboard = () => {
  const [data, setData] = useState({ 
    hourly: [], 
    categoryPerformance: [],
    basketDistribution: [],
    kpis: { revenue: 0, profit: 0, aov: 0, orders: 0, low_stock_count: 0, top_category: "N/A" } 
  });
  const [liveFeed, setLiveFeed] = useState([]);

  const fetchData = async () => {
    try {
      // Promise.all handles the initial load from DB
      const [hr, kpi, cat, basket] = await Promise.all([
        axios.get('/api/hourly_sales'),
        axios.get('/api/kpi'),
        axios.get('/api/category_performance'),
        axios.get('/api/basket_distribution')
      ]);

      setData({ 
        hourly: hr.data, 
        kpis: kpi.data,
        categoryPerformance: cat.data,
        basketDistribution: basket.data
      });
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); 
    const ws = new WebSocket('wss://virtual-fmcg-shop.onrender.com/ws');

    ws.onmessage = (event) => {
      try {
        const incoming = JSON.parse(event.data);
        if (incoming.type === "SALE") {
          setLiveFeed(prev => [incoming.message, ...prev].slice(0, 10));
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
      } catch (e) { console.error(e); }
    };
    return () => { clearInterval(interval); ws.close(); };
  }, []);

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '30px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
        <h1 style={{ color: '#0f172a', margin: 0 }}>FMCG Intelligence Dashboard</h1>
        <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>● LIVE FROM DATABASE</span>
      </header>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h4 style={{ color: '#64748b', margin: '0 0 10px 0' }}>GROSS REVENUE</h4>
          <h2 style={{ margin: 0 }}>₹{data.kpis.revenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h4 style={{ color: '#64748b', margin: '0 0 10px 0' }}>NET PROFIT</h4>
          <h2 style={{ margin: 0, color: '#10b981' }}>₹{data.kpis.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</h2>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h4 style={{ color: '#64748b', margin: '0 0 10px 0' }}>TOTAL ORDERS</h4>
          <h2 style={{ margin: 0 }}>{data.kpis.orders}</h2>
        </div>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h4 style={{ color: '#64748b', margin: '0 0 10px 0' }}>TOP CATEGORY</h4>
          <h2 style={{ margin: 0, color: '#3b82f6', fontSize: '1.2em' }}>{data.kpis.top_category}</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* Momentum Chart */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Sales Momentum (Today)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.hourly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" />
              <YAxis tickFormatter={(v) => `₹${v}`} />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" fill="#eff6ff" stroke="#3b82f6" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Category Performance */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Top Categories</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.categoryPerformance} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="category" type="category" width={80} style={{ fontSize: '12px' }} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Basket Analysis */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>Basket Size Frequency</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.basketDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="items" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="frequency" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Live Feed */}
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowY: 'auto', maxHeight: '340px' }}>
          <h3>Live Activity</h3>
          {liveFeed.map((msg, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.9em' }}>
              <span style={{ color: '#3b82f6', marginRight: '8px' }}>●</span> {msg}
            </div>
          ))}
          {liveFeed.length === 0 && <p style={{ color: '#94a3b8' }}>Waiting for shop activity...</p>}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
