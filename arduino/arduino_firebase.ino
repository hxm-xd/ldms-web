#include <Arduino.h>
#include <WiFi.h>
#include <FirebaseESP32.h>
#include <Wire.h>
#include <BH1750.h>
#include <MPU9250_asukiaaa.h>

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
MPU9250_asukiaaa mpu;
const int soilPin = 35;
const int rainPin = 34;

// Calibration
float accelBias[3] = {0, 0, 0};
float gyroBias[3] = {0, 0, 0};

// Analog sensor calibration values - ADJUSTED FOR YOUR SENSORS
// Soil moisture sensor: Lower ADC = drier soil, Higher ADC = wetter soil (typical capacitive sensor)
const int SOIL_DRY_VALUE = 1000; // ADC reading when sensor is completely dry (in air)
const int SOIL_WET_VALUE = 3500; // ADC reading when sensor is completely wet (in water)

// Rain sensor: Higher ADC = drier, Lower ADC = wetter
const int RAIN_DRY_VALUE = 4095; // ADC reading when sensor is completely dry (max ADC)
const int RAIN_WET_VALUE = 1000; // ADC reading when sensor is completely wet

// Sensor smoothing arrays for noise reduction
const int SMOOTHING_SAMPLES = 5;
int soilReadings[SMOOTHING_SAMPLES];
int rainReadings[SMOOTHING_SAMPLES];
int soilIndex = 0;
int rainIndex = 0;
bool soilArrayFilled = false;
bool rainArrayFilled = false;

// Calibration mode flag
bool calibrationMode = false;

void calibrateIMU()
{
  Serial.println("Calibrating IMU...");
  for (int i = 0; i < 20; i++)
  {
    mpu.accelUpdate();
    mpu.gyroUpdate();
    mpu.magUpdate(); // Also update magnetometer during calibration

    accelBias[0] += mpu.accelX();
    accelBias[1] += mpu.accelY();
    accelBias[2] += mpu.accelZ() - 1.0;

    gyroBias[0] += mpu.gyroX();
    gyroBias[1] += mpu.gyroY();
    gyroBias[2] += mpu.gyroZ();

    delay(5);
  }

  for (int i = 0; i < 3; i++)
  {
    accelBias[i] /= 20.0;
    gyroBias[i] /= 20.0;
  }

  // Test magnetometer reading
  mpu.magUpdate();
  Serial.print("Magnetometer test - X: ");
  Serial.print(mpu.magX());
  Serial.print(" Y: ");
  Serial.print(mpu.magY());
  Serial.print(" Z: ");
  Serial.println(mpu.magZ());

  Serial.println("IMU calibration complete");
}

// Function to smooth analog readings
int smoothAnalogReading(int pin, int *readings, int &index, bool &arrayFilled)
{
  readings[index] = analogRead(pin);
  index = (index + 1) % SMOOTHING_SAMPLES;

  if (!arrayFilled && index == 0)
  {
    arrayFilled = true;
  }

  long sum = 0;
  int count = arrayFilled ? SMOOTHING_SAMPLES : index;

  for (int i = 0; i < count; i++)
  {
    sum += readings[i];
  }

  return sum / count;
}

// Function to convert analog reading to percentage
int analogToPercentage(int rawValue, int dryValue, int wetValue)
{
  int percentage = map(rawValue, dryValue, wetValue, 0, 100);
  return constrain(percentage, 0, 100);
}

// Calibration mode function
void runCalibrationMode()
{
  Serial.println("\n=== CALIBRATION MODE ===");
  Serial.println("This mode helps you calibrate your sensors");
  Serial.println("Instructions:");
  Serial.println("1. Hold soil sensor in AIR (completely dry) - note the raw value");
  Serial.println("2. Put soil sensor in WATER (completely wet) - note the raw value");
  Serial.println("3. Update SOIL_DRY_VALUE and SOIL_WET_VALUE in code with these values");
  Serial.println("4. Press 'c' to continue with normal operation");
  Serial.println("==========================================\n");

  while (true)
  {
    int soilRaw = analogRead(soilPin);
    int rainRaw = analogRead(rainPin);

    Serial.print("Soil Raw: ");
    Serial.print(soilRaw);
    Serial.print(" | Rain Raw: ");
    Serial.print(rainRaw);
    Serial.print(" | Soil %: ");
    Serial.print(analogToPercentage(soilRaw, SOIL_DRY_VALUE, SOIL_WET_VALUE));
    Serial.print(" | Rain %: ");
    Serial.println(analogToPercentage(rainRaw, RAIN_DRY_VALUE, RAIN_WET_VALUE));

    // Show calibration guidance
    if (soilRaw < SOIL_DRY_VALUE)
    {
      Serial.println("  -> Soil sensor reading LOWER than dry value - sensor may be wetter than expected");
    }
    else if (soilRaw > SOIL_WET_VALUE)
    {
      Serial.println("  -> Soil sensor reading HIGHER than wet value - sensor may be drier than expected");
    }

    if (Serial.available())
    {
      char command = Serial.read();
      if (command == 'c' || command == 'C')
      {
        Serial.println("Exiting calibration mode...");
        break;
      }
    }

    delay(500);
  }
}

void readAndUpload()
{
  // Read and smooth analog sensors
  int soilRaw = smoothAnalogReading(soilPin, soilReadings, soilIndex, soilArrayFilled);
  int rainRaw = smoothAnalogReading(rainPin, rainReadings, rainIndex, rainArrayFilled);

  // Convert analog readings to percentages (0-100%)
  // Soil moisture: Higher ADC = drier soil, Lower ADC = wetter soil
  int soilMoisture = analogToPercentage(soilRaw, SOIL_DRY_VALUE, SOIL_WET_VALUE);

  // Rain sensor: Higher ADC = drier, Lower ADC = wetter
  int rainLevel = analogToPercentage(rainRaw, RAIN_DRY_VALUE, RAIN_WET_VALUE);

  // Read digital sensor
  float light = lightMeter.readLightLevel();

  // Read IMU
  mpu.accelUpdate();
  mpu.gyroUpdate();
  mpu.magUpdate();

  float accel[3] = {
      mpu.accelX() - accelBias[0],
      mpu.accelY() - accelBias[1],
      mpu.accelZ() - accelBias[2]};

  float gyro[3] = {
      mpu.gyroX() - gyroBias[0],
      mpu.gyroY() - gyroBias[1],
      mpu.gyroZ() - gyroBias[2]};

  float mag[3] = {mpu.magX(), mpu.magY(), mpu.magZ()};

  // Calculate tilt
  float tilt = max(abs(atan2(accel[1], sqrt(accel[0] * accel[0] + accel[2] * accel[2])) * 180 / PI),
                   abs(atan2(-accel[0], sqrt(accel[1] * accel[1] + accel[2] * accel[2])) * 180 / PI));

  // Print all sensor values to Serial Monitor with enhanced formatting
  Serial.println("=== SENSOR READINGS ===");
  Serial.print("Soil Moisture: ");
  Serial.print(soilMoisture);
  Serial.print("% (Raw: ");
  Serial.print(soilRaw);
  Serial.print(" | Dry: ");
  Serial.print(SOIL_DRY_VALUE);
  Serial.print(" | Wet: ");
  Serial.print(SOIL_WET_VALUE);
  Serial.println(")");

  Serial.print("Rain Level: ");
  Serial.print(rainLevel);
  Serial.print("% (Raw: ");
  Serial.print(rainRaw);
  Serial.println(")");

  Serial.print("Light Level: ");
  Serial.print(light, 1);
  Serial.println(" lx");
  Serial.print("Tilt Angle: ");
  Serial.print(tilt, 2);
  Serial.println("°");

  Serial.println("--- Accelerometer (g) ---");
  Serial.print("  X: ");
  Serial.print(accel[0], 3);
  Serial.print("  Y: ");
  Serial.print(accel[1], 3);
  Serial.print("  Z: ");
  Serial.println(accel[2], 3);

  Serial.println("--- Gyroscope (deg/s) ---");
  Serial.print("  X: ");
  Serial.print(gyro[0], 2);
  Serial.print("  Y: ");
  Serial.print(gyro[1], 2);
  Serial.print("  Z: ");
  Serial.println(gyro[2], 2);

  Serial.println("--- Magnetometer (uT) ---");
  Serial.print("  X: ");
  Serial.print(mag[0], 1);
  Serial.print("  Y: ");
  Serial.print(mag[1], 1);
  Serial.print("  Z: ");
  Serial.println(mag[2], 1);

  Serial.println("--- Raw Values ---");
  Serial.print("Soil Raw: ");
  Serial.print(soilRaw);
  Serial.print(" | Rain Raw: ");
  Serial.println(rainRaw);
  Serial.println("=========================");

  // Upload to Firebase in batches to prevent SSL timeouts
  if (Firebase.ready())
  {
    bool success = true;
    int retryCount = 0;
    const int maxRetries = 2;

    // Batch 1: Basic sensors (soil, rain, light)
    Serial.println("Uploading basic sensors...");
    if (!Firebase.setInt(fbdo, "/soilMoisture", soilMoisture))
    {
      success = false;
      Serial.print("Soil upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(100); // Small delay between uploads

    if (!Firebase.setInt(fbdo, "/rain", rainLevel))
    {
      success = false;
      Serial.print("Rain upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(100);

    if (!Firebase.setFloat(fbdo, "/light", light))
    {
      success = false;
      Serial.print("Light upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(100);

    // Batch 2: Tilt and accelerometer
    Serial.println("Uploading IMU data...");
    if (!Firebase.setFloat(fbdo, "/tilt", tilt))
    {
      success = false;
      Serial.print("Tilt upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(100);

    if (!Firebase.setFloat(fbdo, "/accelX", accel[0]))
    {
      success = false;
      Serial.print("AccelX upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(150); // Increased delay for IMU stability

    if (!Firebase.setFloat(fbdo, "/accelY", accel[1]))
    {
      success = false;
      Serial.print("AccelY upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(150); // Increased delay for IMU stability

    if (!Firebase.setFloat(fbdo, "/accelZ", accel[2]))
    {
      success = false;
      Serial.print("AccelZ upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(150); // Increased delay for IMU stability

    // Batch 3: Gyroscope
    if (!Firebase.setFloat(fbdo, "/gyroX", gyro[0]))
    {
      success = false;
      Serial.print("GyroX upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(100);

    if (!Firebase.setFloat(fbdo, "/gyroY", gyro[1]))
    {
      success = false;
      Serial.print("GyroY upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(100);

    if (!Firebase.setFloat(fbdo, "/gyroZ", gyro[2]))
    {
      success = false;
      Serial.print("GyroZ upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(100);

    // Batch 4: Magnetometer
    if (!Firebase.setFloat(fbdo, "/magX", mag[0]))
    {
      success = false;
      Serial.print("MagX upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(100);

    if (!Firebase.setFloat(fbdo, "/magY", mag[1]))
    {
      success = false;
      Serial.print("MagY upload failed: ");
      Serial.println(fbdo.errorReason());
    }
    delay(100);

    if (!Firebase.setFloat(fbdo, "/magZ", mag[2]))
    {
      success = false;
      Serial.print("MagZ upload failed: ");
      Serial.println(fbdo.errorReason());
    }

    // Extra delay after last upload to ensure SSL completion
    delay(200);

    if (success)
    {
      Serial.println("All data uploaded successfully");
    }
    else
    {
      Serial.println("Some Firebase uploads failed");

      // Retry failed uploads once
      if (retryCount < maxRetries)
      {
        Serial.println("Retrying failed uploads...");
        retryCount++;
        delay(500); // Wait before retry

        // Simple retry for critical sensors only
        if (!Firebase.setInt(fbdo, "/soilMoisture", soilMoisture))
        {
          Serial.println("Soil retry failed");
        }
        if (!Firebase.setInt(fbdo, "/rain", rainLevel))
        {
          Serial.println("Rain retry failed");
        }
        if (!Firebase.setFloat(fbdo, "/light", light))
        {
          Serial.println("Light retry failed");
        }
      }

      // Try to reconnect
      Firebase.reconnectWiFi(true);
    }
  }
  else
  {
    Serial.println("Firebase not ready, attempting to reconnect...");
    Firebase.reconnectWiFi(true);
    delay(1000);
  }
}

void setup()
{
  Serial.begin(115200);
  Serial.println("Starting IoT Sensor System...");

  // Initialize I2C
  Wire.begin(21, 22);

  // Initialize sensors
  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE, 0x23))
  {
    Serial.println("Light sensor failed!");
    while (1)
      ;
  }

  mpu.setWire(&Wire);
  mpu.beginAccel();
  mpu.beginGyro();
  mpu.beginMag();
  Serial.println("Sensors initialized");

  // Calibrate IMU
  calibrateIMU();

  // Connect WiFi with SSL-friendly settings
  WiFi.begin(ssid, password);
  WiFi.setSleep(false); // Disable WiFi sleep for better SSL stability

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED)
  {
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("Signal strength: ");
  Serial.println(WiFi.RSSI());

  // Initialize Firebase with SSL fixes
  config.host = FIREBASE_HOST;
  config.signer.tokens.legacy_token = FIREBASE_AUTH;

  // Timeout configuration to fix connection issues
  config.timeout.serverResponse = 30000;   // 30 seconds
  config.timeout.socketConnection = 30000; // 30 seconds

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  Serial.print("Waiting for Firebase");
  int attempts = 0;
  while (!Firebase.ready() && attempts < 20)
  {
    Serial.print(".");
    delay(500);
    attempts++;
  }

  if (Firebase.ready())
  {
    Serial.println();
    Serial.println("Firebase ready!");
  }
  else
  {
    Serial.println();
    Serial.println("Firebase failed!");
  }

  Serial.println("Setup complete!");

  // Test Firebase connection
  Serial.println("Testing Firebase connection...");
  if (Firebase.ready())
  {
    Serial.println("Firebase connection test: SUCCESS");
  }
  else
  {
    Serial.println("Firebase connection test: FAILED");
  }

  // Initialize sensor smoothing arrays
  for (int i = 0; i < SMOOTHING_SAMPLES; i++)
  {
    soilReadings[i] = 0;
    rainReadings[i] = 0;
  }

  Serial.println("\n=== SENSOR SYSTEM READY ===");
  Serial.println("Analog sensors configured for 0-100% display:");
  Serial.println("- Soil Moisture: Pin 35 (Higher % = drier soil)");
  Serial.println("- Rain Level: Pin 34 (Higher % = more rain detected)");
  Serial.println("Press 'c' in Serial Monitor to enter calibration mode");
  Serial.println("===============================================");
}

void loop()
{
  // Check for calibration mode command
  if (Serial.available())
  {
    char command = Serial.read();
    if (command == 'c' || command == 'C')
    {
      runCalibrationMode();
    }
  }

  readAndUpload();
  delay(1000); // 1Hz updates to reduce SSL pressure
}
