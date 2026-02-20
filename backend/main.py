from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine
from websocket_manager import manager

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/simulate")
async def trigger_simulation():
    # This simulates a sale and broadcasts it via WebSocket
    new_sale = {
        "id": random.randint(1000, 9999),
        "message": f"Simulated Sale: Product {random.randint(1, 100)}",
        "time": datetime.now().strftime("%H:%M"),
        "total_price": round(random.uniform(10.0, 500.0), 2)
    }
    
    # Send to all connected WebSocket clients
    await manager.broadcast(new_sale)
    return {"status": "Simulation sent"}

@app.get("/kpi")
def get_kpis():
    with engine.connect() as conn:
        # Use COALESCE on everything to prevent 'NoneType' errors if DB is empty
        query = text("""
            SELECT 
                COALESCE(SUM(total_price), 0) as revenue,
                COALESCE(SUM(total_price) * 0.25, 0) as profit,
                COUNT(*) as orders,
                COALESCE(AVG(total_price), 0) as aov
            FROM sales_transactions
        """)
        res = conn.execute(query).fetchone()
        
        # Separating this to prevent the whole route from crashing if category is missing
        cat_query = text("""
            SELECT m.category FROM sales_transactions s 
            JOIN sku_master m ON s.sku_id = m.sku_id 
            GROUP BY m.category ORDER BY SUM(s.total_price) DESC LIMIT 1
        """)
        top_cat_res = conn.execute(cat_query).fetchone()
        top_cat = top_cat_res[0] if top_cat_res else "N/A"

        return {
            "revenue": float(res[0]),
            "profit": float(res[1]),
            "orders": int(res[2]),
            "aov": round(float(res[3]), 2),
            "top_category": top_cat
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
        # Added WHERE clause to show ONLY today's performance
        rows = conn.execute(text("""
            SELECT EXTRACT(HOUR FROM sales_date::TIMESTAMP) as hr, SUM(total_price)
            FROM sales_transactions
            WHERE sales_date::DATE = CURRENT_DATE
            GROUP BY hr ORDER BY hr
        """)).fetchall()
    
    db_data = {int(r[0]): float(r[1]) for r in rows}
    # Standardizing hours 9 AM to 10 PM for the chart
    return [{"hour": f"{h}:00", "revenue": db_data.get(h, 0)} for h in range(9, 22)]

@app.get("/inventory_alerts")
def inventory_alerts():
    with engine.connect() as conn:
        # FIX: Added JOIN with sku_master to get the product_name
        rows = conn.execute(text("""
            SELECT m.product_name, i.stock_on_hand 
            FROM inventory_snapshot i
            JOIN sku_master m ON i.sku_id = m.sku_id
            WHERE i.stock_on_hand < 50 
            ORDER BY i.stock_on_hand ASC 
            LIMIT 5
        """)).fetchall()
    return [{"name": r[0], "stock": r[1]} for r in rows]

@app.get("/profit_distribution")
def profit_distribution():
    with engine.connect() as conn:
        # Simulating a Box Plot by getting Min, Max, and Avg profit per day
        rows = conn.execute(text("""
            SELECT sales_date::DATE as dt, 
                   MIN(total_price * 0.25) as min_p,
                   MAX(total_price * 0.25) as max_p,
                   AVG(total_price * 0.25) as avg_p
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

@app.get("/top_skus")
def top_skus():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT m.product_name, SUM(s.units_sold) as total
            FROM sales_transactions s
            JOIN sku_master m ON s.sku_id = m.sku_id
            GROUP BY m.product_name ORDER BY total DESC LIMIT 5
        """)).fetchall()
    return [{"product_name": r[0], "units": int(r[1])} for r in rows]



@app.get("/recent_sales")
def recent_sales():
    with engine.connect() as conn:
        # This will now show the actual time of the sale
        rows = conn.execute(text("""
            SELECT s.id, m.product_name, s.total_price, TO_CHAR(s.sales_date::TIMESTAMP, 'HH24:MI')
            FROM sales_transactions s
            JOIN sku_master m ON s.sku_id = m.sku_id
            ORDER BY s.id DESC LIMIT 6
        """)).fetchall()
    return [{"id": r[0], "message": f"Sold {r[1]} for ₹{r[2]}", "time": r[3]} for r in rows]

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except:

        manager.disconnect(websocket)



