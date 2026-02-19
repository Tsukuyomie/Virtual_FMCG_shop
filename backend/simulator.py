import asyncio
import random
import numpy as np
from datetime import datetime
from sqlalchemy import text
from database import engine
from websocket_manager import manager

# --- CONFIGURATION: SLOW CORNER SHOP MODE ---
# To keep revenue < ₹1,000/min:
# If avg price is ₹200, we can only sell ~3-4 items per minute.
MIN_WAIT = 40    # Wait at least 40 seconds
MAX_WAIT = 90    # Wait up to 1.5 minutes
                 # Average wait = 65 seconds (approx 1 sale/minute)

async def run_simulation():
    print(f"🚀 Simulation Started (Authentic Corner Shop Mode)...")
    
    while True:
        try:
            with engine.connect() as conn:
                # 1. Randomize "Basket Size" (Customer buys 1 to 3 different items)
                num_items = random.choices([1, 2, 3], weights=[70, 20, 10])[0]

                # 2. Pick 'num_items' distinct products
                query = text(f"""
                    SELECT sku_id, product_name, base_price 
                    FROM sku_master 
                    ORDER BY RANDOM() 
                    LIMIT {num_items}
                """)
                rows = conn.execute(query).fetchall()

                total_basket_price = 0
                item_names = []

                conn.execute(text("""
                    INSERT INTO sales_transactions (sales_date, sku_id, store_id, units_sold, unit_price, total_price, discount, channel)
                    VALUES (:sales_date, :sku_id, :store_id, :units_sold, :unit_price, :total_price, :discount, :channel)
                    """), {
                            "sales_date": datetime.now(), # <--- FIX: Use full timestamp, not just .date()
                            "sku_id": sku_id,
                            "store_id": "STORE_MAIN",
                            "units_sold": units_sold,
                            "unit_price": sell_price,
                            "discount": 0,
                            "channel": "Retail"
                        })

                for row in rows:
                    sku_id, product_name, base_price = row
                    
                    # 3. Units: Usually 1, rarely 2 of the same item
                    units_sold = random.choices([1, 2], weights=[90, 10])[0]

                    price_variation = np.random.uniform(0.99, 1.01)
                    sell_price = round(float(base_price) * price_variation, 2)
                    line_total = round(units_sold * sell_price, 2)
                    total_basket_price += line_total
                    item_names.append(f"{units_sold}x {product_name}")

                    # 4. Record individual sale line
                    conn.execute(text("""
                        INSERT INTO sales_transactions 
                        (sales_date, sku_id, store_id, units_sold, unit_price, total_price, discount, channel)
                        VALUES 
                        (:sales_date, :sku_id, :store_id, :units_sold, :unit_price, :total_price, :discount, :channel)
                    """), {
                        "sales_date": datetime.now().date(),
                        "sku_id": sku_id,
                        "store_id": "STORE_MAIN",
                        "units_sold": units_sold,
                        "unit_price": sell_price,
                        "total_price": line_total,
                        "discount": 0,
                        "channel": "Retail"
                    })
                
                conn.commit()

                # 5. Broadcast the whole "Visit"
                timestamp = datetime.now().strftime("%H:%M:%S")
                summary = f"[{timestamp}] Customer bought: {', '.join(item_names)} (Total: ₹{round(total_basket_price, 2)})"
                print(summary)

                await manager.broadcast({
                    "type": "SALE",
                    "message": summary
                })

            # 6. REALISTIC TIMING: Wait 2 to 5 minutes between customers
            # This ensures revenue stays low and growth is linear/slow.
            wait_time = random.randint(120, 300) 
            print(f"Next customer in {wait_time // 60}m {wait_time % 60}s...")
            await asyncio.sleep(wait_time)

        except Exception as e:
            print(f"⚠️ Simulation Error: {e}")
            await asyncio.sleep(20)