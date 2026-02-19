import asyncio
import uvicorn
import random
import numpy as np
from datetime import datetime
from sqlalchemy import text
from database import engine
from websocket_manager import manager
import main

async def run_simulation():
    print("🚀 Simulation Started (Authentic Corner Shop Mode)...")
    
    while True:
        try:
            with engine.connect() as conn:
                # 1. Determine how many DIFFERENT items this customer buys
                num_items = random.choices([1, 2, 3], weights=[70, 25, 5])[0]

                # 2. Pick the products in one query
                sku_rows = conn.execute(text(f"""
                    SELECT sku_id, product_name, base_price 
                    FROM sku_master 
                    ORDER BY RANDOM() 
                    LIMIT {num_items}
                """)).fetchall()

                basket_total = 0
                item_summaries = []

                for sku_id, product_name, base_price in sku_rows:
                    # 3. Units per item: 90% buy 1, 10% buy 2
                    units_sold = random.choices([1, 2], weights=[90, 10])[0]
                    
                    # Stable pricing (1% variation)
                    sell_price = round(float(base_price) * np.random.uniform(0.99, 1.01), 2)
                    line_total = round(units_sold * sell_price, 2)
                    
                    basket_total += line_total
                    item_summaries.append(f"{units_sold}x {product_name}")

                    # 4. Insert into DB
                    conn.execute(text("""
                        INSERT INTO sales_transactions 
                        (sales_date, sku_id, store_id, units_sold, unit_price, total_price, discount, channel)
                        VALUES (NOW(), :sku_id, 'STORE_MAIN', :units_sold, :unit_price, :total_price, 0, 'Retail')
                    """), {
                        "sku_id": sku_id,
                        "units_sold": units_sold,
                        "unit_price": sell_price,
                        "total_price": line_total
                    })
                
                conn.commit()

                # 5. Broadcast as a single "Customer Visit"
                timestamp = datetime.now().strftime("%H:%M:%S")
                display_msg = f"[{timestamp}] Customer bought: {', '.join(item_summaries)} | Total: ₹{round(basket_total, 2)}"
                print(display_msg)

                await manager.broadcast({
                    "type": "SALE",
                    "message": display_msg
                })

            # 6. THE WAIT: 1.5 to 4 minutes between customers
            # This is the key to stopping exponential revenue growth.
            wait_time = random.randint(90, 240) 
            print(f"💤 Next customer in {wait_time // 60}m {wait_time % 60}s...")
            await asyncio.sleep(wait_time)

        except Exception as e:
            print(f"⚠️ Simulation Error: {e}")
            await asyncio.sleep(10)

async def start_app():
    # Change host to 0.0.0.0 for deployment
    config = uvicorn.Config("main:app", host="0.0.0.0", port=8000, reload=False)
    server = uvicorn.Server(config)
    await asyncio.gather(server.serve(), run_simulation())

if __name__ == "__main__":

    asyncio.run(start_app())
