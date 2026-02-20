from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine
from websocket_manager import manager
from simulation import run_simulation  # <--- 1. Import your complex simulation
import asyncio
import random
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# You can keep or remove send_simulated_sales if you use run_simulation
@app.on_event("startup")
async def startup_event():
    # 2. Run the realistic simulation instead of the simple loop
    asyncio.create_task(run_simulation())

# --- HTTP Routes ---
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

# ... (rest of your routes stay the same)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print(f"✅ Client Connected. Active: {len(manager.active_connections)}")
    try:
        while True:
            await websocket.receive_text()
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
    finally:
        manager.disconnect(websocket)
        print("🔌 Connection closed")
