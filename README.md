# LDMS - Landslide Detection and Monitoring System

A comprehensive IoT monitoring system with both web and mobile applications for real-time landslide detection and sensor monitoring.

## 🌟 Overview

The LDMS project provides a complete solution for monitoring landslide-prone areas using IoT sensors. It includes:

- **Web Dashboard**: Real-time monitoring interface
- **Flutter Mobile App**: Cross-platform mobile application
- **Arduino/ESP32 Code**: Sensor data collection and transmission
- **Firebase Integration**: Real-time data synchronization

## 📁 Project Structure

```
LDMS - 2/
├── web_app/                    # Web Dashboard Application
│   ├── index.html             # Main web dashboard
│   ├── script.js              # JavaScript functionality
│   ├── styles.css             # CSS styling
│   └── firebase-config.js     # Firebase configuration
│
├── android_app/               # Native Android Application (Kotlin)
│   ├── app/                   # Android app module
│   │   ├── src/main/java/     # Kotlin source code
│   │   │   └── com/example/ldms/
│   │   │       ├── MainActivity.kt      # Main dashboard
│   │   │       ├── MapActivity.kt       # Maps screen
│   │   │       ├── SensorDetailsActivity.kt # Sensor details
│   │   │       ├── adapters/            # RecyclerView adapters
│   │   │       ├── data/                # Data models
│   │   │       └── services/            # Firebase services
│   │   ├── src/main/res/      # Android resources
│   │   │   ├── layout/        # XML layouts
│   │   │   ├── values/        # Strings, colors, themes
│   │   │   ├── drawable/      # Icons and drawables
│   │   │   └── menu/          # Menu resources
│   │   ├── build.gradle       # App-level build config
│   │   └── google-services.json # Firebase configuration
│   ├── build.gradle           # Project-level build config
│   ├── settings.gradle        # Gradle settings
│   └── README.md              # Android app documentation
│
├── arduino/                   # Arduino/ESP32 Code
│   ├── arduino_firebase.ino   # Main Arduino sketch (with IMU)
│   ├── arduino_firebase_optimized.ino # Optimized version (no IMU)
│   ├── arduino_firebase_minimal.ino   # Minimal version
│   ├── ARDUINO_OPTIMIZATION_GUIDE.md # Arduino optimization guide
│   └── IMU_DATA_ANALYSIS.md   # IMU data analysis documentation
│
└── README.md                  # Main project documentation
```

## 🚀 Quick Start

### 1. Web Application

```bash
# Open the web dashboard
open web_app/index.html
```

### 2. Android Mobile App

```bash
# Navigate to Android app
cd android_app

# Open in Android Studio
# - Open Android Studio
# - Select "Open an existing project"
# - Navigate to the android_app directory

# Or build from command line
./gradlew assembleDebug

# Install on device
./gradlew installDebug
```

### 3. Arduino/ESP32 Setup

1. Navigate to `arduino/` directory
2. Choose the appropriate sketch:
   - `arduino_firebase.ino` - Full featured version with IMU
   - `arduino_firebase_optimized.ino` - Optimized version without IMU
   - `arduino_firebase_minimal.ino` - Minimal version for basic monitoring
3. Upload the chosen sketch to your ESP32
4. Configure WiFi credentials in the code
5. Update Firebase configuration

## 🔧 Features

### Web Dashboard

- ✅ Real-time sensor monitoring
- ✅ Interactive charts and graphs
- ✅ Firebase Realtime Database integration
- ✅ Responsive design
- ✅ Alert notifications

### Android Mobile App

- ✅ Native Android performance
- ✅ Real-time sensor data
- ✅ Google Maps integration
- ✅ Push notifications
- ✅ Material Design 3 UI
- ✅ Critical alert system
- ✅ Offline capabilities

### IoT Sensors

- ✅ Soil moisture monitoring
- ✅ Rain level detection
- ✅ Tilt angle measurement
- ✅ Light level sensing
- ✅ IMU data (accelerometer, gyroscope, magnetometer)

## 📱 Screenshots

### Web Dashboard

- Real-time sensor grid
- Interactive charts
- Status indicators

### Android App

- Dashboard with sensor cards
- Map view with markers
- Detailed sensor information
- Critical alert system
- Material Design 3 interface

## 🔗 Firebase Configuration

Both applications connect to the same Firebase project:

- **Project ID**: ldms-4f84d
- **Database**: Realtime Database
- **Region**: asia-southeast1

## 🛠️ Technologies Used

### Web App

- HTML5, CSS3, JavaScript
- Firebase SDK
- Chart.js
- Font Awesome Icons

### Android App

- Kotlin
- Android SDK 24+
- Firebase Core & Database
- Google Maps Android API
- Material Design 3
- AndroidX Libraries

### IoT

- Arduino IDE
- ESP32/Arduino
- Firebase Arduino Client
- Various sensors (soil, rain, IMU, etc.)

## 📋 Prerequisites

### For Web App

- Modern web browser
- Internet connection

### For Android App

- Android Studio Arctic Fox or later
- Android SDK 24+
- Google Play Services
- Firebase project setup

### For Arduino/ESP32

- Arduino IDE
- ESP32 development board
- Required sensors

## 🚀 Deployment

### Web App

Deploy the `web_app/` folder to any web hosting service.

### Android App

```bash
# Build debug APK
./gradlew assembleDebug

# Build release APK
./gradlew assembleRelease

# Install on device
./gradlew installDebug
```

## 📞 Support

For issues and questions:

1. Check the individual README files in each app directory
2. Review the PROJECT_STRUCTURE.md file
3. Check Firebase configuration

## 📄 License

This project is part of the LDMS (Landslide Detection and Monitoring System) research project.
