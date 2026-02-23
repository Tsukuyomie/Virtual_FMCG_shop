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
    kpis: { revenue: 0, profit: 0, aov: 0, orders: 0, low_stock_count: 0 } 
  });
  const [liveFeed, setLiveFeed] = useState([]);

  const fetchData = async () => {
    try {
      const [hr, kpi, cat, basket] = await Promise.all([
        axios.get('/api/hourly_sales'),
        axios.get('/api/kpi'),
        axios.get('/api/category_performance'),
        axios.get('/api/basket_distribution')
      ]);

      setData(prev => ({ 
        ...prev,
        hourly: hr.data, 
        kpis: kpi.data,
        categoryPerformance: cat.data,
        basketDistribution: basket.data
      }));
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Sync every minute
    const ws = new WebSocket('wss://virtual-fmcg-shop.onrender.com/ws');

    ws.onmessage = (event) => {
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
    };
    return () => { clearInterval(interval); ws.close(); };
  }, []);

  return (
    <div className="dashboard-light" style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ marginBottom: '20px' }}>
        <h1 style={{ color: '#1e293b' }}>FMCG Intelligence <span style={{ fontSize: '0.5em', color: '#3b82f6', verticalAlign: 'middle' }}>● LIVE</span></h1>
      </header>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
        <div className="kpi-card"><h3>Revenue</h3><p>₹{data.kpis.revenue.toLocaleString()}</p></div>
        <div className="kpi-card"><h3>Profit</h3><p style={{color: '#10b981'}}>₹{data.kpis.profit.toLocaleString()}</p></div>
        <div className="kpi-card"><h3>Orders</h3><p>{data.kpis.orders}</p></div>
        <div className="kpi-card"><h3>Avg Basket</h3><p>₹{data.kpis.aov}</p></div>
      </div>

      <div className="main-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        
        {/* Row 1: Main Momentum Chart */}
        <div className="chart-container" style={{ gridColumn: 'span 2', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <h3 style={{ marginBottom: '15px' }}>Sales Momentum</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data.hourly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="revenue" fill="#dbeafe" stroke="#3b82f6" />
              <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Row 1: Category Bar Chart */}
        <div className="chart-container" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <h3 style={{ marginBottom: '15px' }}>Top Categories</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.categoryPerformance} layout="vertical">
              <XAxis type="number" hide />
              <YAxis dataKey="category" type="category" width={80} style={{ fontSize: '12px' }} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Row 2: Basket Distribution */}
        <div className="chart-container" style={{ gridColumn: 'span 2', background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <h3 style={{ marginBottom: '15px' }}>Basket Sizes (Units per Order)</h3>
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

        {/* Row 2: Live Feed */}
        <div className="chart-container" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflowY: 'auto', maxHeight: '350px' }}>
          <h3 style={{ marginBottom: '15px' }}>Live Activity</h3>
          {liveFeed.map((msg, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.9em' }}>
              <span style={{ color: '#3b82f6' }}>•</span> {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
