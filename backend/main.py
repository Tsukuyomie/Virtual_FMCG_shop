from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine
from websocket_manager import manager
from simulator import run_simulation 
import asyncio
from datetime import datetime

app = FastAPI()

# 1. CORS Configuration
# Essential for Vercel (Frontend) to talk to Render (Backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Startup Event
# Kicks off the simulation loop that writes to the DB and broadcasts via WS
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(run_simulation())

# 3. HTTP API Routes (Persistent Data)

@app.get("/kpi")
def get_kpis():
    """Fetches cumulative data for the last 24 hours to ensure persistence on refresh."""
    with engine.connect() as conn:
        # We use a 24-hour interval so the dashboard doesn't reset at exactly midnight UTC
        query = text("""
            SELECT 
                COALESCE(SUM(total_price), 0) as revenue,
                COALESCE(SUM(total_price) * 0.25, 0) as profit,
                COUNT(*) as orders,
                COALESCE(AVG(total_price), 0) as aov
            FROM sales_transactions
            WHERE sales_date >= (NOW() - INTERVAL '24 hours')
        """)
        res = conn.execute(query).fetchone()
        
        # Determine Top Category in the last 24 hours
        cat_query = text("""
            SELECT m.category FROM sales_transactions s 
            JOIN sku_master m ON s.sku_id = m.sku_id 
            WHERE s.sales_date >= (NOW() - INTERVAL '24 hours')
            GROUP BY m.category ORDER BY SUM(s.total_price) DESC LIMIT 1
        """)
        top_cat_res = conn.execute(cat_query).fetchone()
        top_cat = top_cat_res[0] if top_cat_res else "N/A"

        # Check for low stock items
        low_stock_query = text("SELECT COUNT(*) FROM inventory_snapshot WHERE stock_on_hand < 50")
        low_stock = conn.execute(low_stock_query).scalar()

        return {
            "revenue": round(float(res[0]), 2),
            "profit": round(float(res[1]), 2),
            "orders": int(res[2]),
            "aov": round(float(res[3]), 2),
            "top_category": top_cat,
            "low_stock_count": int(low_stock or 0)
        }

@app.get("/hourly_sales")
def hourly_sales():
    """Provides data for the 'Momentum' chart."""
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT EXTRACT(HOUR FROM sales_date) as hr, 
                   SUM(total_price) as rev,
                   SUM(total_price * 0.25) as prof
            FROM sales_transactions
            WHERE sales_date >= CURRENT_DATE
            GROUP BY hr ORDER BY hr
        """)).fetchall()
    
    db_data = {int(r[0]): {"revenue": float(r[1]), "profit": float(r[2])} for r in rows}
    # Return 24 slots (0-23) so the chart is always full
    return [{"hour": f"{h}:00", 
             "revenue": db_data.get(h, {}).get("revenue", 0),
             "profit": db_data.get(h, {}).get("profit", 0)} for h in range(0, 24)]

@app.get("/profit_distribution")
def profit_distribution():
    """Historical profit spread for the last 7 days."""
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT sales_date::DATE as dt, 
                   MIN(total_price * 0.25), 
                   MAX(total_price * 0.25), 
                   AVG(total_price * 0.25)
            FROM sales_transactions
            GROUP BY dt ORDER BY dt DESC LIMIT 7
        """)).fetchall()
    return [{"date": str(r[0]), "min": float(r[1]), "max": float(r[2]), "avg": float(r[3])} for r in rows]

@app.get("/time_of_day_sales")
def time_of_day_sales():
    """Analysis of sales by period (Morning/Afternoon/Evening)."""
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT 
                CASE 
                    WHEN EXTRACT(HOUR FROM sales_date) BETWEEN 6 AND 11 THEN 'Morning'
                    WHEN EXTRACT(HOUR FROM sales_date) BETWEEN 12 AND 17 THEN 'Afternoon'
                    ELSE 'Evening'
                END as period,
                SUM(total_price) as revenue
            FROM sales_transactions
            GROUP BY period
        """)).fetchall()
    return [{"name": r[0], "value": float(r[1])} for r in rows]

# 4. WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print(f"✅ Client Connected. Total active: {len(manager.active_connections)}")
    try:
        while True:
            # Keeps connection alive and listens for pings
            await websocket.receive_text()
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)
        print("🔌 Connection closed")
