from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine
from websocket_manager import manager
import asyncio
import random
from datetime import datetime

app = FastAPI()

# 1. CORS Configuration for Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Background Simulation Task
async def send_simulated_sales():
    print("🚀 Simulation Loop Started")
    while True:
        try:
            # Send a PING every 5 seconds to keep Render connection alive
            await asyncio.sleep(5)
            await manager.broadcast({"type": "PING"})
            
            # ~30% chance to send a real sale every 5 seconds
            if random.random() > 0.7:
                price = round(random.uniform(50, 500), 2)
                new_sale = {
                    "type": "SALE",  # Matches Dashboard.jsx
                    "total_price": price,
                    "message": f"New Sale: Product {random.randint(1, 100)} for ₹{price}",
                    "time": datetime.now().strftime("%H:%M")
                }
                print(f"📡 Broadcasting Sale: ₹{price}")
                await manager.broadcast(new_sale)
                
        except Exception as e:
            print(f"⚠️ Simulation Loop Error: {e}")
            await asyncio.sleep(5)

@app.on_event("startup")
async def startup_event():
    # Kicks off the simulation in the background
    asyncio.create_task(send_simulated_sales())

# 3. HTTP Routes
@app.get("/kpi")
def get_kpis():
    with engine.connect() as conn:
        query = text("""
            SELECT 
                COALESCE(SUM(total_price), 0) as revenue,
                COALESCE(SUM(total_price) * 0.25, 0) as profit,
                COUNT(*) as orders,
                COALESCE(AVG(total_price), 0) as aov
            FROM sales_transactions
        """)
        res = conn.execute(query).fetchone()
        
        cat_query = text("""
            SELECT m.category FROM sales_transactions s 
            JOIN sku_master m ON s.sku_id = m.sku_id 
            GROUP BY m.category ORDER BY SUM(s.total_price) DESC LIMIT 1
        """)
        top_cat_res = conn.execute(cat_query).fetchone()
        top_cat = top_cat_res[0] if top_cat_res else "N/A"

        low_stock_query = text("SELECT COUNT(*) FROM inventory_snapshot WHERE stock_on_hand < 50")
        low_stock = conn.execute(low_stock_query).scalar()

        return {
            "revenue": float(res[0]),
            "profit": float(res[1]),
            "orders": int(res[2]),
            "aov": round(float(res[3]), 2),
            "top_category": top_cat,
            "low_stock_count": int(low_stock or 0)
        }

@app.get("/category_sales")
def category_sales():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT m.category, SUM(s.total_price) as revenue
            FROM sales_transactions s
            JOIN sku_master m ON s.sku_id = m.sku_id
            GROUP BY m.category
            ORDER BY revenue DESC
        """)).fetchall()
    return [{"name": r[0], "value": float(r[1])} for r in rows]

@app.get("/hourly_sales")
def hourly_sales():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT EXTRACT(HOUR FROM sales_date::TIMESTAMP) as hr, 
                   SUM(total_price) as rev, 
                   SUM(total_price * 0.25) as prof
            FROM sales_transactions
            WHERE sales_date::DATE = CURRENT_DATE
            GROUP BY hr ORDER BY hr
        """)).fetchall()
    
    db_data = {int(r[0]): {"revenue": float(r[1]), "profit": float(r[2])} for r in rows}
    return [{"hour": f"{h}:00", 
             "revenue": db_data.get(h, {}).get("revenue", 0),
             "profit": db_data.get(h, {}).get("profit", 0)} for h in range(9, 22)]

@app.get("/profit_distribution")
def profit_distribution():
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
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT 
                CASE 
                    WHEN EXTRACT(HOUR FROM sales_date::TIMESTAMP) BETWEEN 6 AND 11 THEN 'Morning'
                    WHEN EXTRACT(HOUR FROM sales_date::TIMESTAMP) BETWEEN 12 AND 17 THEN 'Afternoon'
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
    print(f"✅ Client Connected. Active: {len(manager.active_connections)}")
    try:
        while True:
            # Keep line open by listening for any client message
            await websocket.receive_text()
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)
        print("🔌 Connection closed")
