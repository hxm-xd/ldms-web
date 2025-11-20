#include <Arduino.h>
#include <WiFi.h>
#include <FirebaseESP32.h>
#include <Wire.h>
#include <BH1750.h>

// Configuration
const char *ssid = "hamood";
const char *password = "Hamood117092";
#define FIREBASE_HOST "ldms-4f84d-default-rtdb.asia-southeast1.firebasedatabase.app"
#define FIREBASE_AUTH "H5KTTWcgflWb6eFUodMlvgFtZ09A7qNXQlxuKQYv"

// Firebase objects
FirebaseConfig config;
FirebaseAuth auth;
FirebaseData fbdo;

// Sensors
BH1750 lightMeter;
const int soilPin = 35;
const int rainPin = 34;

// Calibration
const int SOIL_DRY = 1000, SOIL_WET = 3500;
const int RAIN_DRY = 4095, RAIN_WET = 1000;

// Timing
unsigned long lastUpload = 0;
const unsigned long UPLOAD_INTERVAL = 30000; // 30 seconds

// Read sensor with simple averaging
int readSensor(int pin)
{
  int sum = 0;
  for (int i = 0; i < 3; i++)
  {
    sum += analogRead(pin);
    delay(10);
  }
  return sum / 3;
}

// Convert to percentage
int toPercent(int adc, int dry, int wet)
{
  return constrain(map(adc, dry, wet, 0, 100), 0, 100);
}

void setup()
{
  Serial.begin(115200);
  Serial.println("LDMS Minimal");

  // Initialize I2C
  Wire.begin(21, 22);

  // Initialize light sensor
  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23))
  {
    Serial.println("Light sensor failed!");
    while (1)
      ;
  }

  // Connect WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // Initialize Firebase
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  config.timeout.serverResponse = 5000;
  config.timeout.socketConnection = 5000;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Wait for Firebase
  int attempts = 0;
  while (!Firebase.ready() && attempts < 5)
  {
    delay(500);
    attempts++;
  }

  if (Firebase.ready())
  {
    Serial.println("Firebase ready");
  }
  else
  {
    Serial.println("Firebase failed");
  }

  Serial.println("System ready");
}

void loop()
{
  // Check for calibration
  if (Serial.available())
  {
    char cmd = Serial.read();
    if (cmd == 'c' || cmd == 'C')
    {
      Serial.println("Soil:" + String(analogRead(soilPin)) + " Rain:" + String(analogRead(rainPin)));
      delay(1000);
      return;
    }
  }

  // Upload data at intervals
  if (millis() - lastUpload >= UPLOAD_INTERVAL)
  {
    // Read sensors
    int soilRaw = readSensor(soilPin);
    int rainRaw = readSensor(rainPin);
    int soilMoisture = toPercent(soilRaw, SOIL_DRY, SOIL_WET);
    int rainLevel = toPercent(rainRaw, RAIN_DRY, RAIN_WET);
    float light = lightMeter.readLightLevel();

    // Upload to Firebase
    if (Firebase.ready())
    {
      Firebase.setInt(fbdo, "/soilMoisture", soilMoisture);
      Firebase.setInt(fbdo, "/rain", rainLevel);
      Firebase.setFloat(fbdo, "/light", light);
      Serial.println("Uploaded: S" + String(soilMoisture) + "% R" + String(rainLevel) + "% L" + String(light, 1) + "lx");
    }
    else
    {
      Serial.println("Firebase not ready");
    }

    lastUpload = millis();
  }

  delay(1000);
}
