import time
import random
import requests

SERVER_URL = "http://localhost:8000/log"

print(f"Starting Multi-Room Simulator...")
print(f"Sending data to {SERVER_URL}")
print("Press Ctrl+C to stop.")

try:
    while True:
        # --- Fablab Data ---
        fablab_payload = {
            "temperature": round(random.uniform(20.0, 24.0), 2),
            "humidity": round(random.uniform(40.0, 50.0), 2),
            "eco2": random.randint(400, 1200),
            "tvoc": random.randint(0, 300)
        }
        
        try:
            res_fab = requests.post(f"{SERVER_URL}/fablab", data=fablab_payload)
            if res_fab.status_code == 200:
                print(f"[OK] Fablab Success: Temp={fablab_payload['temperature']}")
            else:
                print(f"[ERROR] Fablab Failed: {res_fab.status_code}")
        except requests.exceptions.ConnectionError:
            print("[ERROR] Connection Error: Is FastAPI running?")

        # --- Cleanroom Data ---
        cleanroom_payload = {
            "dht_temp": round(random.uniform(21.0, 23.0), 2),
            "dht_hum": round(random.uniform(45.0, 55.0), 2),
            "ds1_temp": round(random.uniform(18.0, 20.0), 2),
            "ds2_temp": round(random.uniform(25.0, 27.0), 2),
            "ds3_temp": round(random.uniform(10.0, 12.0), 2),
        }
        
        try:
            res_clean = requests.post(f"{SERVER_URL}/cleanroom", data=cleanroom_payload)
            if res_clean.status_code == 200:
                print(f"[OK] Cleanroom Success: DHT_Temp={cleanroom_payload['dht_temp']}")
            else:
                print(f"[ERROR] Cleanroom Failed: {res_clean.status_code}")
        except requests.exceptions.ConnectionError:
            pass

        time.sleep(5)
except KeyboardInterrupt:
    print("\nSimulator stopped.")
