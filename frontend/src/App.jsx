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
    kpis: {} 
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

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);

    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "SALE") {
        setLiveFeed(prev => [data.message, ...prev].slice(0, 10));
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

      {/* KPI Section */}
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
            <h3>Average Order</h3>
            <p>₹{data.kpis.aov?.toFixed(2)}</p>
        </div>
        <div className="kpi-card">
            <h3>Low Stock Items</h3>
            <p className={data.kpis.low_stock_count > 0 ? "red-text" : ""}>
                {data.kpis.low_stock_count}
            </p>
        </div>
      </div>

      <div className="main-grid">
        {/* Dual Axis: Revenue vs Profit */}
        <div className="chart-container span-2">
          <h3>Revenue & Profit Momentum (Dual Axis)</h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={data.hourly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                yAxisId="left" 
                stroke="#3b82f6" 
                fontSize={12} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(val) => `₹${val}`} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#10b981" 
                fontSize={12} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(val) => `₹${val}`} 
              />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend verticalAlign="top" align="right" iconType="circle" />
              <Area yAxisId="left" type="monotone" dataKey="revenue" fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction Feed */}
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

        {/* Profit Box Plot (Day-wise Min/Max/Avg) */}
        <div className="chart-container span-2">
          <h3>Daily Profit Distribution (Min - Avg - Max)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.distribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip />
              {/* Range indicator (Min to Max) */}
              <Bar dataKey={(d) => [d.min, d.max]} fill="#e2e8f0" barSize={12} radius={6} />
              {/* Average marker */}
              <Bar dataKey="avg" fill="#3b82f6" barSize={35} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sales by Time of Day */}
        <div className="chart-container">
          <h3>Peak Period Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.timeOfDay}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
              <YAxis hide />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Bar dataKey="revenue" radius={[10, 10, 0, 0]} barSize={50}>
                {data.timeOfDay.map((entry, index) => (
                  <Cell key={index} fill={entry.name === 'Afternoon' ? '#3b82f6' : '#94a3b8'} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;