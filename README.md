# Cleanroom Monitoring System

This project contains the backend, frontend, and firmware for a cleanroom environment monitoring system.

## Project Structure

- `backend/`: FastAPI Python application with SQLite database.
- `frontend/`: React + Tailwind CSS dashboard.
- `firmware/`: ESP32 Arduino sketch for the edge device.

## Prerequisites

1. **Python 3.8+** installed.
2. **Node.js 18+** and npm installed (Required to run the frontend).
3. **Arduino IDE** with ESP32 board support and the following libraries:
   - `LiquidCrystal I2C`
   - `Adafruit BME280 Library`
   - `Adafruit SGP30 Sensor`

## Setup & Running

### Automated Startup (Windows)

We have provided a `start.bat` script that will automatically start both the backend and frontend servers.

1. First, make sure you have installed the frontend dependencies:
   ```cmd
   cd frontend
   npm install
   cd ..
   ```
2. Double click `start.bat` from the root directory.
   - It will start the FastAPI backend on `http://localhost:8000` using your existing `venv`.
   - It will start the React frontend on `http://localhost:3001`.

### Manual Setup (Backend)

The backend dependencies are already installed in the `venv` directory. If you need to run it manually:
```cmd
.\venv\Scripts\activate
cd backend
uvicorn main:app --reload --port 8000
```

### Manual Setup (Frontend)

```cmd
cd frontend
npm install
npm run dev
```

## Hardware Setup (ESP32)

1. Open `firmware/cleanroom_monitor/cleanroom_monitor.ino` in Arduino IDE.
2. Change the `ssid` and `password` variables to match your Wi-Fi network.
3. Change `serverUrl` to point to the IP address of the computer running the backend (e.g., `http://192.168.1.100:8000/log`).
4. Connect the BME280, SGP30, and LCD to the ESP32's I2C pins (GPIO 21 for SDA, GPIO 22 for SCL).
5. Upload the sketch. The ESP32 will display its IP on the LCD and begin sending data every 30 seconds.

## Extensibility: How to Add a New Sensor

If you decide to add more sensors (e.g., a fourth DS18B20 sensor or a new particulate matter sensor), follow this checklist:

### Step 1: Update the Database Schema
1. **Modify [models.py](file:///c:/my_work/IOT_sensor/backend/models.py)**:
   Add the new database column to the appropriate class (e.g. `CleanroomData`):
   ```python
   ds4_temp = Column(Float)
   ```
2. **Modify [schemas.py](file:///c:/my_work/IOT_sensor/backend/schemas.py)**:
   Add the field type to the create and response schemas so FastAPI validates it:
   ```python
   ds4_temp: float
   ```

### Step 2: Update the ESP32 Firmware
1. **Open the Arduino Sketch**: Find the file `cleanroom_monitor.ino`.
2. **Update the JSON Construction**:
   Append the new key-value pair to the Serial output. For example:
   ```cpp
   Serial.print(",\"ds4_temp\":"); Serial.print(ds4_temp);
   ```

### Step 3: Update the Backend Routes ([main.py](file:///c:/my_work/IOT_sensor/backend/main.py))
1. **Update Data Ingestion** (`log_data` endpoint):
   Retrieve the form parameter and pass it into the schema creation:
   ```python
   ds4_temp=float(form_data.get('ds4_temp', 0))
   ```
2. **Update History Query**:
   Include the new field aggregation in the database history query:
   ```python
   func.avg(model.ds4_temp).label("ds4_temp")
   ```
3. **Update CSV Export**:
   Update `writer.writerow` headers and loop mappings to write the new column to CSV exports.

### Step 4: Update the Frontend Dashboard ([App.jsx](file:///c:/my_work/IOT_sensor/frontend/src/App.jsx))
1. **Add Card**: Place a new `<StatCard>` with your custom title (e.g., "Optical Table 3") pointing to `latestData?.ds4_temp`.
2. **Add Line to Chart**: Insert a new `<Line>` element in the respective `LineChart` block:
   ```jsx
   <Line type="monotone" dataKey="ds4_temp" name="Optical Table 3 (°C)" stroke="#ec4899" ... />
   ```
