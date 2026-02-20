import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, Cell, BarChart 
} from 'recharts';

const Dashboard = () => {
  const [data, setData] = useState({ 
    hourly: [], 
    distribution: [], 
    timeOfDay: [], 
    kpis: { revenue: 0, profit: 0, aov: 0, orders: 0, low_stock_count: 0 } 
  });
  const [liveFeed, setLiveFeed] = useState([]);

  const fetchData = async () => {
    try {
      const [hr, dist, time, kpi] = await Promise.all([
        axios.get('/api/hourly_sales'),
        axios.get('/api/profit_distribution'),
        axios.get('/api/time_of_day_sales'),
        axios.get('/api/kpi')
      ]);
      setData({ 
        hourly: hr.data, 
        distribution: dist.data, 
        timeOfDay: time.data, 
        kpis: kpi.data 
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  ws.onmessage = (event) => {
  const incoming = JSON.parse(event.data);
  if (incoming.type === "SALE") {
    // Your update logic here...
  }
};

  useEffect(() => {
    fetchData();
    // Poll every 2 minutes for deep sync
    const interval = setInterval(fetchData, 120000);

    const ws = new WebSocket('wss://virtual-fmcg-shop.onrender.com/ws');
    
    ws.onmessage = (event) => {
      const incoming = JSON.parse(event.data);
      if (incoming.type === "SALE") {
        // 1. Update Live Feed
        setLiveFeed(prev => [incoming.message, ...prev].slice(0, 10));

        // 2. Instant KPI update for that "Live" feel
        setData(prev => ({
          ...prev,
          kpis: {
            ...prev.kpis,
            revenue: (prev.kpis.revenue || 0) + incoming.total_price,
            profit: (prev.kpis.profit || 0) + (incoming.total_price * 0.25),
            orders: (prev.kpis.orders || 0) + 1
          }
        }));
      }
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  return (
    <div className="dashboard-light">
      <header className="dash-header">
        <h1>FMCG Intelligence <span className="status-badge">Live Updates</span></h1>
      </header>

      <div className="kpi-grid">
        <div className="kpi-card">
            <h3>Gross Revenue</h3>
            <p>₹{data.kpis.revenue?.toLocaleString()}</p>
        </div>
        <div className="kpi-card">
            <h3>Net Profit</h3>
            <p className="green-text">₹{data.kpis.profit?.toLocaleString()}</p>
        </div>
        <div className="kpi-card">
            <h3>Orders</h3>
            <p>{data.kpis.orders}</p>
        </div>
        <div className="kpi-card">
            <h3>Low Stock</h3>
            <p className={data.kpis.low_stock_count > 0 ? "red-text" : ""}>
                {data.kpis.low_stock_count}
            </p>
        </div>
      </div>

      <div className="main-grid">
        <div className="chart-container span-2">
          <h3>Revenue & Profit Momentum</h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={data.hourly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="hour" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#3b82f6" tickFormatter={(v) => `₹${v}`} />
              <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
              <Tooltip />
              <Legend verticalAlign="top" align="right" />
              <Area yAxisId="left" type="monotone" dataKey="revenue" fill="#dbeafe" stroke="#3b82f6" />
              <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3>Real-time Activity</h3>
          <div className="feed-list">
            {liveFeed.length > 0 ? liveFeed.map((msg, i) => (
              <div key={i} className="feed-item">
                <span className="feed-dot"></span>
                <p>{msg}</p>
              </div>
            )) : <p className="empty-msg">Waiting for transactions...</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

