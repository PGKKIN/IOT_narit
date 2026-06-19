from flask import Flask, request
import csv
from datetime import datetime
import os

app = Flask(__name__)
CSV_FILE = 'cleanroom_data.csv'

# ตรวจสอบและสร้าง Header ถ้ายังไม่มีไฟล์
def init_csv():
    if not os.path.exists(CSV_FILE):
        with open(CSV_FILE, mode='w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['Timestamp', 'Temp(C)', 'Humid(%)', 'eCO2(ppm)', 'TVOC(ppb)'])
        print(f"📁 Created new file: {CSV_FILE}")

@app.route('/log', methods=['POST'])
def log_data():
    try:
        # ดึงข้อมูลที่ส่งมาจาก ESP32
        temp = request.form.get('temp')
        hum = request.form.get('hum')
        eco2 = request.form.get('eco2')
        tvoc = request.form.get('tvoc')
        
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # บันทึกลง CSV (Excel)
        with open(CSV_FILE, mode='a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([timestamp, temp, hum, eco2, tvoc])
            
        print(f"📌 [{timestamp}] Saved -> T: {temp}C | H: {hum}% | CO2: {eco2}ppm")
        return "Success", 200
    except Exception as e:
        print(f"❌ Error: {e}")
        return "Error", 500

if __name__ == '__main__':
    init_csv()
    # รันเซิร์ฟเวอร์ที่ Port 5000
    print("🚀 Server is running... Waiting for ESP32")
    app.run(host='0.0.0.0', port=5000)