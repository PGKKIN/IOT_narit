#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <Adafruit_SGP30.h>
#include <LiquidCrystal_I2C.h>

// --- WiFi Config ---
const char* ssid = "WiFi@NARIT.Trainee";
const char* password = "2242482510";

// --- PC IP Address ---
const String serverUrl = "http://192.168.3.41:8000/log/fablab"; 

LiquidCrystal_I2C lcd(0x27, 16, 2);
Adafruit_BME280 bme;
Adafruit_SGP30 sgp;

float temp, hum;
uint16_t eco2, tvoc;
unsigned long lastLogTime = 0;
const unsigned long logInterval = 30000; // ส่งข้อมูลทุก 30 วินาที

void setup() {
    Serial.begin(115200);
    Wire.begin();
    
    lcd.init();
    lcd.backlight();
    lcd.print("Connecting WiFi");

    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    
    Serial.println("\nWiFi Connected!");
    lcd.clear();
    lcd.print("IP:"); lcd.print(WiFi.localIP());
    delay(2000);

    bme.begin(0x76);
    sgp.begin();
}

void loop() {
    // อ่านค่าเซนเซอร์
    temp = bme.readTemperature();
    hum = bme.readHumidity();
    if (sgp.IAQmeasure()) {
        eco2 = sgp.eCO2;
        tvoc = sgp.TVOC;
    }

    // แสดงผลบน LCD (สลับหน้าจอ)
    lcd.setCursor(0, 0); lcd.print("T:"); lcd.print(temp, 1); lcd.print(" H:"); lcd.print(hum, 1);
    lcd.setCursor(0, 1); lcd.print("CO2:"); lcd.print(eco2); lcd.print("      ");

    // ส่งข้อมูลไปที่คอมพิวเตอร์ตามช่วงเวลาที่กำหนด
    if (millis() - lastLogTime >= logInterval) {
        lastLogTime = millis();
        sendDataToPC();
    }
    delay(100);
}

void sendDataToPC() {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(serverUrl);
        http.addHeader("Content-Type", "application/x-www-form-urlencoded");

        // เตรียมข้อมูลในรูปแบบ URL Form (แก้ชื่อตัวแปรให้ตรงกับ Backend)
        String postData = "temperature=" + String(temp) + 
                          "&humidity=" + String(hum) + 
                          "&eco2=" + String(eco2) + 
                          "&tvoc=" + String(tvoc);
        
        int httpResponseCode = http.POST(postData);
        
        Serial.print("Sending Data... Response: ");
        Serial.println(httpResponseCode);
        http.end();
    }
}
