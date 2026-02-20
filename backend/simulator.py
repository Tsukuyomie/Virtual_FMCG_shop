import asyncio
import random
import numpy as np
from datetime import datetime
from sqlalchemy import text
from database import engine
from websocket_manager import manager

async def run_simulation():
    print(f"🚀 Simulation Started (Authentic Corner Shop Mode)...")
    
    while True:
        try:
            # HEARTBEAT: Send a PING to keep Render connection alive while we wait for a customer
            await manager.broadcast({"type": "PING"})

            with engine.connect() as conn:
                # 1. Randomize Basket Size
                num_items = random.choices([1, 2, 3], weights=[70, 20, 10])[0]

                # 2. Pick distinct products
                query = text(f"""
                    SELECT sku_id, product_name, base_price 
                    FROM sku_master 
                    ORDER BY RANDOM() 
                    LIMIT {num_items}
                """)
                rows = conn.execute(query).fetchall()

                total_basket_price = 0
                item_names = []

                for row in rows:
                    sku_id, product_name, base_price = row
                    
                    # 3. Units & Pricing logic
                    units_sold = random.choices([1, 2], weights=[90, 10])[0]
                    price_variation = np.random.uniform(0.99, 1.01)
                    sell_price = round(float(base_price) * price_variation, 2)
                    line_total = round(units_sold * sell_price, 2)
                    
                    total_basket_price += line_total
                    item_names.append(f"{units_sold}x {product_name}")

                    # 4. Record to Database (Using full timestamp for hourly charts)
                    conn.execute(text("""
                        INSERT INTO sales_transactions 
                        (sales_date, sku_id, store_id, units_sold, unit_price, total_price, discount, channel)
                        VALUES 
                        (:sales_date, :sku_id, :store_id, :units_sold, :unit_price, :total_price, :discount, :channel)
                    """), {
                        "sales_date": datetime.now(), 
                        "sku_id": sku_id,
                        "store_id": "STORE_MAIN",
                        "units_sold": units_sold,
                        "unit_price": sell_price,
                        "total_price": line_total,
                        "discount": 0,
                        "channel": "Retail"
                    })
                
                conn.commit()

                # 5. Broadcast to Dashboard
                timestamp = datetime.now().strftime("%H:%M:%S")
                summary = f"New Customer: {', '.join(item_names)}"
                
                await manager.broadcast({
                    "type": "SALE",
                    "message": summary,
                    "total_price": round(total_basket_price, 2), # Crucial for React state
                    "time": timestamp
                })
                
                print(f"📡 Broadcasted: {summary} (₹{total_basket_price})")

            # Inside simulator.py -> run_simulation()
with engine.connect() as conn:
    # ... (calculate price and units)
    
    # THIS LINE SAVES THE DATA PERMANENTLY
    conn.execute(text("""
        INSERT INTO sales_transactions (sales_date, sku_id, units_sold, unit_price, total_price)
        VALUES (:sales_date, :sku_id, :units, :price, :total)
    """), {
        "sales_date": datetime.now(), # Uses current time
        "sku_id": random_sku,
        "units": units,
        "price": price,
        "total": price * units
    })
    
    conn.commit() # Don't forget this! Without commit, nothing is saved.

            # 6. TIMING: Wait between customers (Adjusted for testing: 30-60s)
            # Change back to (120, 300) for slow authentic mode later
            wait_time = random.randint(30, 60) 
            print(f"Next customer in {wait_time}s...")
            await asyncio.sleep(wait_time)

        except Exception as e:
            print(f"⚠️ Simulation Error: {e}")
            await asyncio.sleep(10)

