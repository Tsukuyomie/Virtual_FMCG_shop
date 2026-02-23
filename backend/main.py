from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine
from websocket_manager import manager
from simulator import run_simulation 
import asyncio
import logging
from datetime import datetime

# Setup logging to see errors in Render's "Logs" tab
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# 1. CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Startup Event
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 FMCG Backend Starting...")
    asyncio.create_task(run_simulation())

# --- DIAGNOSTIC ROUTE ---
# If you visit your-url.onrender.com/ and see this, the 404s are a routing issue.
@app.get("/")
def health_check():
    return {"status": "online", "timestamp": datetime.now().isoformat()}

# --- HTTP API ROUTES ---

@app.get("/kpi")
def get_kpis():
    try:
        with engine.connect() as conn:
            # 1. Main KPI Query (Revenue, Profit, Orders)
            query = text("""
                SELECT 
                    COALESCE(SUM(total_price), 0) as revenue,
                    COALESCE(SUM(total_price) * 0.25, 0) as profit,
                    COUNT(*) as orders,
                    COALESCE(AVG(total_price), 0) as aov
                FROM sales_transactions
                WHERE sales_date::timestamp >= (CURRENT_TIMESTAMP - INTERVAL '24 hours')
            """)
            res = conn.execute(query).fetchone()
            
            # 2. Top Category Query
            cat_query = text("""
                SELECT m.category FROM sales_transactions s 
                JOIN sku_master m ON s.sku_id = m.sku_id 
                WHERE s.sales_date::timestamp >= (CURRENT_TIMESTAMP - INTERVAL '24 hours')
                GROUP BY m.category ORDER BY SUM(s.total_price) DESC LIMIT 1
            """)
            top_cat_res = conn.execute(cat_query).fetchone()
            top_cat = top_cat_res[0] if top_cat_res else "N/A"

            # 3. SAFE Inventory Check (Does not crash if table is missing)
            low_stock = 0
            try:
                low_stock = conn.execute(text("SELECT COUNT(*) FROM inventory_snapshot WHERE stock_on_hand < 50")).scalar()
            except Exception:
                logger.warning("⚠️ inventory_snapshot table not found, skipping...")
                low_stock = 0

            return {
                "revenue": round(float(res[0]), 2),
                "profit": round(float(res[1]), 2),
                "orders": int(res[2]),
                "aov": round(float(res[3]), 2),
                "top_category": top_cat,
                "low_stock_count": int(low_stock or 0)
            }
    except Exception as e:
        logger.error(f"❌ Critical KPI Error: {e}")
        return {"revenue": 0, "profit": 0, "orders": 0, "aov": 0, "top_category": "Error", "low_stock_count": 0}

@app.get("/hourly_sales")
def hourly_sales():
    try:
        with engine.connect() as conn:
            # Added ::timestamp here too
            rows = conn.execute(text("""
                SELECT EXTRACT(HOUR FROM sales_date::timestamp) as hr, 
                       SUM(total_price) as rev,
                       SUM(total_price * 0.25) as prof
                FROM sales_transactions
                WHERE sales_date::timestamp >= CURRENT_DATE
                GROUP BY hr ORDER BY hr
            """)).fetchall()
        
        db_data = {int(r[0]): {"revenue": float(r[1]), "profit": float(r[2])} for r in rows}
        return [{"hour": f"{h}:00", 
                 "revenue": db_data.get(h, {}).get("revenue", 0),
                 "profit": db_data.get(h, {}).get("profit", 0)} for h in range(0, 24)]
    except Exception as e:
        logger.error(f"❌ Hourly Sales Error: {e}")
        return []

@app.get("/time_of_day_sales")
def time_of_day_sales():
    try:
        with engine.connect() as conn:
            # Added ::timestamp to the CASE statement
            rows = conn.execute(text("""
                SELECT 
                    CASE 
                        WHEN EXTRACT(HOUR FROM sales_date::timestamp) BETWEEN 6 AND 11 THEN 'Morning'
                        WHEN EXTRACT(HOUR FROM sales_date::timestamp) BETWEEN 12 AND 17 THEN 'Afternoon'
                        ELSE 'Evening'
                    END as period,
                    SUM(total_price) as revenue
                FROM sales_transactions
                GROUP BY period
            """)).fetchall()
        return [{"name": r[0], "value": float(r[1])} for r in rows]
    except Exception as e:
        logger.error(f"❌ Time of Day Error: {e}")
        return []

@app.get("/profit_distribution")
def profit_distribution():
    try:
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
    except Exception as e:
        logger.error(f"❌ Profit Dist Error: {e}")
        return []


# 4. WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    logger.info(f"✅ WS Client Connected. Active: {len(manager.active_connections)}")
    try:
        while True:
            await websocket.receive_text()
    except Exception as e:
        logger.warning(f"🔌 WS Connection Closed: {e}")
    finally:
        manager.disconnect(websocket)


