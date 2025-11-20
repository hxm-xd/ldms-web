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

// Calibration values
const int SOIL_DRY = 1000;
const int SOIL_WET = 3500;
const int RAIN_DRY = 4095;
const int RAIN_WET = 1000;

// Power management
unsigned long lastUpload = 0;
const unsigned long UPLOAD_INTERVAL = 30000; // 30 seconds
const unsigned long SLEEP_DURATION = 1000;   // 1 second sleep

// Simple moving average for noise reduction
int soilSum = 0, rainSum = 0;
int soilCount = 0, rainCount = 0;
const int SMOOTH_SAMPLES = 3;

// Function to read and smooth analog sensor
int readSensor(int pin, int &sum, int &count)
{
  int reading = analogRead(pin);
  sum += reading;
  count++;
  if (count > SMOOTH_SAMPLES)
  {
    sum -= (sum / count);
    count = SMOOTH_SAMPLES;
  }
  return sum / count;
}

// Convert ADC to percentage
int adcToPercent(int adc, int dry, int wet)
{
  return constrain(map(adc, dry, wet, 0, 100), 0, 100);
}

// Upload data to Firebase
void uploadData()
{
  if (!Firebase.ready())
    return;

  // Read sensors
  int soilRaw = readSensor(soilPin, soilSum, soilCount);
  int rainRaw = readSensor(rainPin, rainSum, rainCount);
  int soilMoisture = adcToPercent(soilRaw, SOIL_DRY, SOIL_WET);
  int rainLevel = adcToPercent(rainRaw, RAIN_DRY, RAIN_WET);
  float light = lightMeter.readLightLevel();

  // Upload individual values (more reliable than JSON)
  bool success = true;

  if (!Firebase.setInt(fbdo, "/soilMoisture", soilMoisture))
  {
    success = false;
    Serial.println("Soil upload failed: " + fbdo.errorReason());
  }
  delay(50);

  if (!Firebase.setInt(fbdo, "/rain", rainLevel))
  {
    success = false;
    Serial.println("Rain upload failed: " + fbdo.errorReason());
  }
  delay(50);

  if (!Firebase.setFloat(fbdo, "/light", light))
  {
    success = false;
    Serial.println("Light upload failed: " + fbdo.errorReason());
  }

  if (success)
  {
    Serial.println("Data uploaded: S:" + String(soilMoisture) + "% R:" + String(rainLevel) + "% L:" + String(light, 1) + "lx");
  }
  else
  {
    Serial.println("Some uploads failed");
  }
}

void setup()
{
  Serial.begin(115200);
  Serial.println("LDMS Starting...");

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
  WiFi.setSleep(false);

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());

  // Initialize Firebase
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;
  config.timeout.serverResponse = 10000;
  config.timeout.socketConnection = 10000;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Wait for Firebase
  int attempts = 0;
  while (!Firebase.ready() && attempts < 10)
  {
    delay(500);
    attempts++;
  }

  if (Firebase.ready())
  {
    Serial.println("Firebase ready!");
  }
  else
  {
    Serial.println("Firebase failed!");
  }

  Serial.println("System ready. Upload interval: 30s");
}

void loop()
{
  // Check for calibration mode
  if (Serial.available())
  {
    char cmd = Serial.read();
    if (cmd == 'c' || cmd == 'C')
    {
      Serial.println("Calibration mode - Soil:" + String(analogRead(soilPin)) + " Rain:" + String(analogRead(rainPin)));
      delay(1000);
      return;
    }
  }

  // Upload data at intervals
  if (millis() - lastUpload >= UPLOAD_INTERVAL)
  {
    uploadData();
    lastUpload = millis();
  }

  // Sleep to save power
  delay(SLEEP_DURATION);
}
