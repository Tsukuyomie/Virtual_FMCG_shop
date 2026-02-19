import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // This imports the modern CSS we created

/**
 * The root entry point for the RetailOS Dashboard.
 * It mounts the App component into the #root div defined in index.html.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);