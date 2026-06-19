#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// --- DHT22 Setup ---
#define DHTPIN 4     // Pin connected to DHT22
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// --- DS18B20 Setup ---
#define ONE_WIRE_BUS 5 // Pin connected to the DS18B20 data line (1-Wire parallel)
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// --- LCD Setup ---
LiquidCrystal_I2C lcd(0x27, 16, 2); // SDA SCL I2C Addr 0x27 (ขนาดจอ 16x2)

unsigned long lastLogTime = 0;
const unsigned long logInterval = 5000; // ส่งข้อมูลผ่านสาย USB ทุก 5 วินาทีให้คอมไปเลย (สายไม่ดีเลย์)

// ตัวแปรสำหรับเปลี่ยนหน้าจอแสดงผลบนจอ LCD
unsigned long lastLcdChange = 0;
bool showDHT = true;
float dht_hum = 0, dht_temp = 0, ds1_temp = 0, ds2_temp = 0, ds3_temp = 0;

void setup() {
    Serial.begin(115200); // ความเร็ว UART
    Wire.begin(); 
    
    lcd.init();
    lcd.backlight();
    lcd.print("UART Mode...");

    // Initialize sensors
    dht.begin();
    sensors.begin();
    
    delay(2000);
}

void loop() {
    // 1. อ่านค่าและส่งข้อมูลผ่านสาย USB (UART) เข้าคอมทุกๆ 5 วินาที
    if (millis() - lastLogTime >= logInterval) {
        lastLogTime = millis();
        readSensorsAndSendData();
    }
    
    // 2. สลับหน้าจอ LCD ทุกๆ 5 วินาที
    if (millis() - lastLcdChange >= 5000) {
        lastLcdChange = millis();
        updateLCD();
        showDHT = !showDHT; // สลับโหมดหน้าจอถัดไป
    }
    
    delay(10);
}

void readSensorsAndSendData() {
    // อ่านค่า DHT22
    dht_hum = dht.readHumidity();
    dht_temp = dht.readTemperature();
    
    if (isnan(dht_hum) || isnan(dht_temp)) {
        dht_hum = 0;
        dht_temp = 0;
    }

    // อ่านค่า DS18B20s
    sensors.requestTemperatures();
    ds1_temp = sensors.getTempCByIndex(0);
    ds2_temp = sensors.getTempCByIndex(1);
    ds3_temp = sensors.getTempCByIndex(2);

    if (ds1_temp == DEVICE_DISCONNECTED_C) ds1_temp = 0;
    if (ds2_temp == DEVICE_DISCONNECTED_C) ds2_temp = 0;
    if (ds3_temp == DEVICE_DISCONNECTED_C) ds3_temp = 0;

    // ส่งข้อมูลออกทาง Serial Port เป็นรูปแบบ JSON ให้คอมพิวเตอร์อ่านง่ายๆ
    Serial.print("{\"dht_temp\":"); Serial.print(dht_temp);
    Serial.print(",\"dht_hum\":"); Serial.print(dht_hum);
    Serial.print(",\"ds1_temp\":"); Serial.print(ds1_temp);
    Serial.print(",\"ds2_temp\":"); Serial.print(ds2_temp);
    Serial.print(",\"ds3_temp\":"); Serial.print(ds3_temp);
    Serial.println("}");
}

void updateLCD() {
    lcd.clear();
    if (showDHT) {
        lcd.setCursor(0, 0); lcd.print("DHT Temp:"); lcd.print(dht_temp, 1); lcd.print("C");
        lcd.setCursor(0, 1); lcd.print("DHT Hum :"); lcd.print(dht_hum, 1); lcd.print("%");
    } else {
        lcd.setCursor(0, 0); lcd.print("D1:"); lcd.print((int)ds1_temp); lcd.print("C D2:"); lcd.print((int)ds2_temp); lcd.print("C");
        lcd.setCursor(0, 1); lcd.print("D3:"); lcd.print((int)ds3_temp); lcd.print("C");
    }
}
