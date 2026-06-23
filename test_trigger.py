import sys
sys.path.append(r"c:\my_work\IOT_sensor\backend")

from database import SessionLocal
import models
from main import send_daily_summary, check_cleanroom_alerts
from fastapi import BackgroundTasks

class DummyBackgroundTasks(BackgroundTasks):
    def __init__(self):
        super().__init__()
        self.tasks = []
    def add_task(self, func, *args, **kwargs):
        self.tasks.append((func, args, kwargs))
        # Execute synchronously for testing
        print(f"[DummyBackgroundTasks] Executing task: {func.__name__}")
        func(*args, **kwargs)

def run_tests():
    db = SessionLocal()
    try:
        print("--- Testing Daily Summary Email ---")
        send_daily_summary(db)
        
        print("\n--- Testing Cleanroom Alert Trigger (High Temp) ---")
        # Create a mock database record that exceeds temperature limit (>40C)
        mock_item = models.CleanroomData(
            dht_temp=45.0, # Normal limit: 10-40C
            dht_hum=45.0,
            ds1_temp=22.0,
            ds2_temp=23.0,
            ds3_temp=24.0
        )
        bg = DummyBackgroundTasks()
        check_cleanroom_alerts(mock_item, bg)
        
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()

