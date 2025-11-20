// IoT Dashboard JavaScript - Display ALL Sensor Values with Notifications
let firebaseConfig;
let database;
let firebaseRef = null;
let isAuthenticated = false;

// Global variables
let sensorChart = null;
let sensorData = {
    soilMoisture: [],
    rain: [],
    light: [],
    tilt: [],
    accelX: [],
    accelY: [],
    accelZ: [],
    gyroX: [],
    gyroY: [],
    gyroZ: [],
    magX: [],
    magY: [],
    magZ: []
};

// Enhanced sensor thresholds with notification settings
const thresholds = {
    soilMoisture: {
        min: 0,
        max: 100,
        warning: 70,
        danger: 85,
        critical: 95,
        notification: {
            warning: 'Soil moisture is getting high',
            danger: 'Soil moisture is critically high - drainage needed!',
            critical: 'EMERGENCY: Soil is waterlogged!'
        }
    },
    rain: {
        min: 0,
        max: 100,
        warning: 30,
        danger: 40,
        critical: 50,
        notification: {
            warning: 'Rain detected - moderate level',
            danger: 'Heavy rain detected!',
            critical: 'SEVERE RAIN ALERT!'
        }
    },
    light: {
        min: 0,
        max: 65535,
        warning: 10,
        danger: 5,
        critical: 3,
        notification: {
            warning: 'Light level is getting low',
            danger: 'Very low light detected!',
            critical: 'EMERGENCY: System may be underground!'
        }
    },
    tilt: {
        min: 0,
        max: 90,
        warning: 20,
        danger: 25,
        critical: 30,
        notification: {
            warning: 'Device tilt detected',
            danger: 'Significant tilt detected!',
            critical: 'CRITICAL TILT ALERT!'
        }
    },
    gyroMovement: {
        warning: 5,
        danger: 10,
        critical: 15,
        notification: {
            warning: 'Gyroscope movement detected',
            danger: 'Significant gyroscope movement!',
            critical: 'CRITICAL GYROSCOPE MOVEMENT!'
        }
    }
};

// Notification tracking to prevent spam
let notificationHistory = {};
let lastGyroValues = { x: 0, y: 0, z: 0 };

// DOM elements
let loadingScreen, loginPage, dashboard, loginForm, loginError, logoutBtn;
let connectionStatus, sidebarToggle, pageTitle, lastUpdate, updateRate;
let totalReadings, avgUpdateRate, uptime, notificationsContainer, themeToggle, sidebarOverlay;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeElements();
    initializeFirebase();
    initializeEventListeners();
    initializeChart();
    initializeTheme();
    checkAuthentication();
    startUptimeCounter();
});

function initializeElements() {
    // Core elements
    loadingScreen = document.getElementById('loadingScreen');
    loginPage = document.getElementById('loginPage');
    dashboard = document.getElementById('dashboard');
    loginForm = document.getElementById('loginForm');
    loginError = document.getElementById('loginError');
    logoutBtn = document.getElementById('logoutBtn');

    // Dashboard elements
    connectionStatus = document.getElementById('connectionStatus');
    sidebarToggle = document.getElementById('sidebarToggle');
    pageTitle = document.getElementById('pageTitle');
    lastUpdate = document.getElementById('lastUpdate');
    updateRate = document.getElementById('updateRate');
    notificationsContainer = document.getElementById('notificationsContainer');

    // Analytics elements
    totalReadings = document.getElementById('totalReadings');
    avgUpdateRate = document.getElementById('avgUpdateRate');
    uptime = document.getElementById('uptime');

    // Theme toggle
    themeToggle = document.getElementById('themeToggle');

    // Sidebar overlay
    sidebarOverlay = document.getElementById('sidebarOverlay');
}

function initializeFirebase() {
    firebaseConfig = window.firebaseConfig;

    if (!firebaseConfig) {
        console.error('Firebase configuration not found!');
        return;
    }

    try {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        console.log('✅ Firebase initialized successfully');
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error);
    }
}

function initializeEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);

    // Logout button
    logoutBtn.addEventListener('click', handleLogout);

    // Sidebar toggle
    sidebarToggle.addEventListener('click', toggleSidebar);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', handleNavigation);
    });

    // Chart controls
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', handleChartRangeChange);
    });

    // Theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Sidebar overlay for mobile
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
}

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username === 'admin' && password === 'password') {
        isAuthenticated = true;
        localStorage.setItem('authenticated', 'true');
        showDashboard();
        connectFirebase();
    } else {
        showLoginError('Invalid username or password');
    }
}

function handleLogout() {
    isAuthenticated = false;
    localStorage.removeItem('authenticated');
    disconnectFirebase();
    showLogin();
}

function handleNavigation(e) {
    e.preventDefault();
    const section = e.currentTarget.getAttribute('data-section');

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    e.currentTarget.classList.add('active');

    // Update page title
    const titles = {
        overview: 'Dashboard Overview',
        analytics: 'Sensor Analytics'
    };
    pageTitle.textContent = titles[section] || 'Dashboard';

    // Show/hide sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(section).classList.add('active');

    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 1024) {
        closeSidebar();
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');

    // Show/hide overlay on mobile
    if (sidebarOverlay) {
        sidebarOverlay.classList.toggle('open');
    }
}

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.remove('open');

    if (sidebarOverlay) {
        sidebarOverlay.classList.remove('open');
    }
}

function handleChartRangeChange(e) {
    const range = parseInt(e.target.getAttribute('data-range'));

    // Update active button
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');

    console.log(`Chart range updated to ${range} seconds`);
}

function checkAuthentication() {
    const authenticated = localStorage.getItem('authenticated');
    if (authenticated === 'true') {
        isAuthenticated = true;
        showDashboard();
        connectFirebase();
    } else {
        showLogin();
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    // Update theme toggle icon
    const icon = themeToggle.querySelector('i');
    if (newTheme === 'dark') {
        icon.className = 'fas fa-sun';
        themeToggle.title = 'Switch to Light Mode';
    } else {
        icon.className = 'fas fa-moon';
        themeToggle.title = 'Switch to Dark Mode';
    }

    // Add transition effect
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    setTimeout(() => {
        document.body.style.transition = '';
    }, 300);
}

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        if (savedTheme === 'dark') {
            icon.className = 'fas fa-sun';
            themeToggle.title = 'Switch to Light Mode';
        } else {
            icon.className = 'fas fa-moon';
            themeToggle.title = 'Switch to Dark Mode';
        }
    }
}

function showDashboard() {
    hideLoadingScreen();
    loginPage.classList.add('hidden');
    dashboard.classList.remove('hidden');
}

function showLogin() {
    hideLoadingScreen();
    dashboard.classList.add('hidden');
    loginPage.classList.remove('hidden');
    loginError.style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function showLoginError(message) {
    loginError.textContent = message;
    loginError.style.display = 'block';
}

function hideLoadingScreen() {
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 1000);
}

// Firebase connection
function connectFirebase() {
    try {
        firebaseRef = database.ref('/');
        firebaseRef.on('value', handleFirebaseData, handleFirebaseError);
        updateConnectionStatus('Connected to Firebase', 'connected');
    } catch (error) {
        console.error('Failed to connect to Firebase:', error);
        updateConnectionStatus('Firebase Connection Failed', 'error');
    }
}

function disconnectFirebase() {
    if (firebaseRef) {
        firebaseRef.off();
        firebaseRef = null;
    }
    updateConnectionStatus('Disconnected', 'disconnected');
}

function handleFirebaseData(snapshot) {
    const data = snapshot.val();
    if (data) {
        updateSensorData(data);
    }
}

function handleFirebaseError(error) {
    console.error('Firebase error:', error);
    updateConnectionStatus('Firebase Error', 'error');
}

function updateConnectionStatus(status, type) {
    if (connectionStatus) {
        connectionStatus.innerHTML = `<i class="fas fa-circle"></i><span>${status}</span>`;
        connectionStatus.className = `status-indicator ${type}`;
    }
}

// Update sensor data and UI
function updateSensorData(data) {
    const timestamp = new Date().toLocaleTimeString();

    // Map ALL Arduino Firebase field names to sensor data
    const sensorValues = {
        timestamp: timestamp,
        soilMoisture: data.soilMoisture || 0,
        rain: data.rain || 0,
        light: data.light || 0,
        tilt: data.tilt || 0,
        accelX: data.accelX || 0,
        accelY: data.accelY || 0,
        accelZ: data.accelZ || 0,
        gyroX: data.gyroX || 0,
        gyroY: data.gyroY || 0,
        gyroZ: data.gyroZ || 0,
        magX: data.magX || 0,
        magY: data.magY || 0,
        magZ: data.magZ || 0
    };

    // Add to sensor data arrays
    Object.keys(sensorValues).forEach(key => {
        if (key !== 'timestamp' && sensorData[key]) {
            sensorData[key].push({ time: timestamp, value: sensorValues[key] });

            // Keep only last 20 readings
            if (sensorData[key].length > 20) {
                sensorData[key].shift();
            }
        }
    });

    // Update UI for main sensors and check for notifications
    updateSensorUI('soilMoisture', sensorValues.soilMoisture);
    updateSensorUI('rain', sensorValues.rain);
    updateSensorUI('light', sensorValues.light);
    updateSensorUI('tilt', sensorValues.tilt);
    updateSensorUI('gyroMovement', sensorValues.gyroX, sensorValues.gyroY, sensorValues.gyroZ);

    // Check for threshold notifications
    checkThresholdNotifications(sensorValues);

    // Update ALL sensor values in analytics section
    updateAllSensorValues(sensorValues);

    // Update analytics
    updateAnalytics();

    // Update chart
    updateChart();

    // Update timestamps
    if (lastUpdate) lastUpdate.textContent = timestamp;
    if (updateRate) updateRate.textContent = '0.5 Hz';

    console.log('ALL Sensor Data:', sensorValues);
}

function updateSensorUI(sensorType, value, gyroY = 0, gyroZ = 0) {
    const valueElement = document.getElementById(sensorType + 'Value');
    const statusElement = document.getElementById(sensorType + 'Status');
    const cardElement = document.getElementById(sensorType + 'Card');

    if (!valueElement || !statusElement || !cardElement) {
        return;
    }

    // Special handling for gyroscope movement
    if (sensorType === 'gyroMovement') {
        const gyroMovement = Math.sqrt(value * value + gyroY * gyroY + gyroZ * gyroZ);
        valueElement.textContent = gyroMovement.toFixed(2);

        const status = getSensorStatus(sensorType, gyroMovement);

        // Update status
        const statusText = statusElement.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = status.text;
        }

        // Update status indicator
        statusElement.className = `sensor-status ${status.class}`;
        const statusIcon = statusElement.querySelector('i');
        if (statusIcon) {
            statusIcon.className = `fas fa-circle ${status.class}`;
        }

        // Update card styling
        cardElement.className = `sensor-card ${status.class}`;

        // Add update animation
        cardElement.classList.add('updated');
        setTimeout(() => {
            cardElement.classList.remove('updated');
        }, 300);

        return;
    }

    // Update value with proper formatting
    if (sensorType === 'light') {
        valueElement.textContent = Math.round(value);
    } else {
        valueElement.textContent = value.toFixed(1);
    }

    // Determine status
    const status = getSensorStatus(sensorType, value);

    // Update status
    const statusText = statusElement.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = status.text;
    }

    // Update status indicator
    statusElement.className = `sensor-status ${status.class}`;
    const statusIcon = statusElement.querySelector('i');
    if (statusIcon) {
        statusIcon.className = `fas fa-circle ${status.class}`;
    }

    // Update card styling
    cardElement.className = `sensor-card ${status.class}`;

    // Add update animation
    cardElement.classList.add('updated');
    setTimeout(() => {
        cardElement.classList.remove('updated');
    }, 300);
}

function checkThresholdNotifications(sensorValues) {
    Object.keys(thresholds).forEach(sensorType => {
        if (sensorType === 'gyroMovement') {
            // Calculate gyroscope movement magnitude
            const gyroMovement = Math.sqrt(
                sensorValues.gyroX * sensorValues.gyroX +
                sensorValues.gyroY * sensorValues.gyroY +
                sensorValues.gyroZ * sensorValues.gyroZ
            );

            const threshold = thresholds[sensorType];
            let alertLevel = null;
            let message = '';

            if (gyroMovement >= threshold.critical) {
                alertLevel = 'critical';
                message = threshold.notification.critical;
            } else if (gyroMovement >= threshold.danger) {
                alertLevel = 'danger';
                message = threshold.notification.danger;
            } else if (gyroMovement >= threshold.warning) {
                alertLevel = 'warning';
                message = threshold.notification.warning;
            }

            // Show notification if threshold is met and not recently shown
            if (alertLevel && message) {
                const notificationKey = `${sensorType}_${alertLevel}`;
                const now = Date.now();

                // Check if we should show this notification (prevent spam)
                if (!notificationHistory[notificationKey] ||
                    (now - notificationHistory[notificationKey]) > 30000) { // 30 seconds

                    showNotification(message, alertLevel, sensorType);
                    notificationHistory[notificationKey] = now;
                }
            }

            return;
        }

        const value = sensorValues[sensorType];
        const threshold = thresholds[sensorType];

        if (!threshold || !threshold.notification) return;

        let alertLevel = null;
        let message = '';

        // Determine alert level based on updated thresholds
        if (sensorType === 'soilMoisture') {
            // Higher soil moisture is more dangerous
            if (value >= threshold.critical) {
                alertLevel = 'critical';
                message = threshold.notification.critical;
            } else if (value >= threshold.danger) {
                alertLevel = 'danger';
                message = threshold.notification.danger;
            } else if (value >= threshold.warning) {
                alertLevel = 'warning';
                message = threshold.notification.warning;
            }
        } else if (sensorType === 'light') {
            // Lower light is more dangerous (underground detection)
            if (value <= threshold.critical) {
                alertLevel = 'critical';
                message = threshold.notification.critical;
            } else if (value <= threshold.danger) {
                alertLevel = 'danger';
                message = threshold.notification.danger;
            } else if (value <= threshold.warning) {
                alertLevel = 'warning';
                message = threshold.notification.warning;
            }
        } else {
            // Higher values are more dangerous for rain and tilt
            if (value >= threshold.critical) {
                alertLevel = 'critical';
                message = threshold.notification.critical;
            } else if (value >= threshold.danger) {
                alertLevel = 'danger';
                message = threshold.notification.danger;
            } else if (value >= threshold.warning) {
                alertLevel = 'warning';
                message = threshold.notification.warning;
            }
        }

        // Show notification if threshold is met and not recently shown
        if (alertLevel && message) {
            const notificationKey = `${sensorType}_${alertLevel}`;
            const now = Date.now();

            // Check if we should show this notification (prevent spam)
            if (!notificationHistory[notificationKey] ||
                (now - notificationHistory[notificationKey]) > 30000) { // 30 seconds

                showNotification(message, alertLevel, sensorType);
                notificationHistory[notificationKey] = now;
            }
        }
    });
}

function showNotification(message, level, sensorType) {
    if (!notificationsContainer) return;

    const notification = document.createElement('div');
    notification.className = `notification ${level}`;
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas ${getNotificationIcon(level)}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${getNotificationTitle(level)}</div>
            <div class="notification-message">${message}</div>
            <div class="notification-sensor">${getSensorDisplayName(sensorType)}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add to container
    notificationsContainer.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);

    // Add entrance animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    console.log(`🔔 ${level.toUpperCase()} Notification: ${message}`);
}

function getNotificationIcon(level) {
    const icons = {
        warning: 'fa-exclamation-triangle',
        danger: 'fa-exclamation-circle',
        critical: 'fa-radiation'
    };
    return icons[level] || 'fa-info-circle';
}

function getNotificationTitle(level) {
    const titles = {
        warning: 'Warning',
        danger: 'Alert',
        critical: 'CRITICAL'
    };
    return titles[level] || 'Info';
}

function getSensorDisplayName(sensorType) {
    const names = {
        soilMoisture: 'Soil Moisture',
        rain: 'Rain Sensor',
        light: 'Light Sensor',
        tilt: 'Tilt Sensor',
        gyroMovement: 'Gyroscope Movement'
    };
    return names[sensorType] || sensorType;
}

function updateAllSensorValues(sensorValues) {
    // Update all sensor values in the analytics section
    const sensorElements = {
        'soilMoisture': 'Soil Moisture',
        'rain': 'Rain Level',
        'light': 'Light Level',
        'tilt': 'Tilt Angle',
        'accelX': 'Accel X',
        'accelY': 'Accel Y',
        'accelZ': 'Accel Z',
        'gyroX': 'Gyro X',
        'gyroY': 'Gyro Y',
        'gyroZ': 'Gyro Z',
        'magX': 'Mag X',
        'magY': 'Mag Y',
        'magZ': 'Mag Z'
    };

    // Create or update sensor values display
    let sensorValuesContainer = document.getElementById('allSensorValues');
    if (!sensorValuesContainer) {
        sensorValuesContainer = document.createElement('div');
        sensorValuesContainer.id = 'allSensorValues';
        sensorValuesContainer.className = 'all-sensor-values';

        // Add to analytics section
        const analyticsSection = document.getElementById('analytics');
        if (analyticsSection) {
            const analyticsGrid = analyticsSection.querySelector('.analytics-grid');
            if (analyticsGrid) {
                const newCard = document.createElement('div');
                newCard.className = 'analytics-card';
                newCard.innerHTML = `
                    <h3>All Sensor Values</h3>
                    <div id="allSensorValues" class="all-sensor-values"></div>
                `;
                analyticsGrid.appendChild(newCard);
            }
        }
    }

    // Update the container reference
    sensorValuesContainer = document.getElementById('allSensorValues');
    if (sensorValuesContainer) {
        let html = '';
        Object.keys(sensorElements).forEach(key => {
            const value = sensorValues[key];
            const label = sensorElements[key];
            let unit = '';

            // Add appropriate units
            if (key.includes('accel') || key.includes('gyro') || key.includes('mag')) {
                unit = key.includes('accel') ? ' g' : key.includes('gyro') ? ' °/s' : ' μT';
            } else if (key === 'light') {
                unit = ' lux';
            } else if (key === 'tilt') {
                unit = '°';
            } else {
                unit = '%';
            }

            // Format value
            let displayValue;
            if (key === 'light') {
                displayValue = Math.round(value);
            } else {
                displayValue = value.toFixed(2);
            }

            html += `
                <div class="sensor-value-item">
                    <span class="sensor-label">${label}:</span>
                    <span class="sensor-value">${displayValue}${unit}</span>
                </div>
            `;
        });
        sensorValuesContainer.innerHTML = html;
    }
}

function getSensorStatus(sensorType, value) {
    const threshold = thresholds[sensorType];

    if (!threshold) {
        return { text: 'Normal', class: 'normal' };
    }

    if (sensorType === 'soilMoisture') {
        // Higher soil moisture is more dangerous
        if (value >= threshold.critical) {
            return { text: 'Critical', class: 'critical' };
        } else if (value >= threshold.danger) {
            return { text: 'Danger', class: 'danger' };
        } else if (value >= threshold.warning) {
            return { text: 'Warning', class: 'warning' };
        } else {
            return { text: 'Normal', class: 'normal' };
        }
    } else if (sensorType === 'light') {
        // Lower light is more dangerous
        if (value <= threshold.critical) {
            return { text: 'Critical', class: 'critical' };
        } else if (value <= threshold.danger) {
            return { text: 'Danger', class: 'danger' };
        } else if (value <= threshold.warning) {
            return { text: 'Warning', class: 'warning' };
        } else {
            return { text: 'Normal', class: 'normal' };
        }
    } else if (sensorType === 'gyroMovement') {
        // Higher gyroscope movement is more dangerous
        if (value >= threshold.critical) {
            return { text: 'Critical', class: 'critical' };
        } else if (value >= threshold.danger) {
            return { text: 'Danger', class: 'danger' };
        } else if (value >= threshold.warning) {
            return { text: 'Warning', class: 'warning' };
        } else {
            return { text: 'Normal', class: 'normal' };
        }
    } else {
        // Higher values are more dangerous for rain and tilt
        if (value >= threshold.critical) {
            return { text: 'Critical', class: 'critical' };
        } else if (value >= threshold.danger) {
            return { text: 'Danger', class: 'danger' };
        } else if (value >= threshold.warning) {
            return { text: 'Warning', class: 'warning' };
        } else {
            return { text: 'Normal', class: 'normal' };
        }
    }
}

function updateAnalytics() {
    if (totalReadings) {
        totalReadings.textContent = sensorData.soilMoisture.length;
    }

    if (avgUpdateRate) {
        avgUpdateRate.textContent = '0.5 Hz';
    }
}

function startUptimeCounter() {
    const startTime = Date.now();
    setInterval(() => {
        if (uptime) {
            const elapsed = Date.now() - startTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            uptime.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

// Chart initialization and updates
function initializeChart() {
    const ctx = document.getElementById('sensorChart');
    if (!ctx) return;

    sensorChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Soil Moisture (%)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y',
                    fill: true,
                    spanGaps: false
                },
                {
                    label: 'Rain (%)',
                    data: [],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y',
                    fill: true,
                    spanGaps: false
                },
                {
                    label: 'Light (lux)',
                    data: [],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#f59e0b',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y1',
                    fill: true,
                    spanGaps: false
                },
                {
                    label: 'Tilt (°)',
                    data: [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y',
                    fill: true,
                    spanGaps: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart',
                delay: (context) => {
                    let delay = 0;
                    if (context.type === 'data' && context.mode === 'default') {
                        delay = context.dataIndex * 100 + context.datasetIndex * 100;
                    }
                    return delay;
                }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 20,
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    }
                },
                title: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    intersect: false,
                    mode: 'index'
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'var(--text-secondary)',
                        font: {
                            size: 12
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time',
                        color: 'var(--text-primary)',
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'var(--text-secondary)',
                        font: {
                            size: 12
                        }
                    },
                    title: {
                        display: true,
                        text: 'Soil Moisture (%), Rain (%), Tilt (°)',
                        color: 'var(--text-primary)',
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: 'var(--text-secondary)',
                        font: {
                            size: 12
                        }
                    },
                    title: {
                        display: true,
                        text: 'Light (lux)',
                        color: 'var(--text-primary)',
                        font: {
                            size: 14,
                            weight: '600'
                        }
                    }
                }
            }
        }
    });
}

function updateChart() {
    if (!sensorChart) return;

    const labels = sensorData.soilMoisture.map(item => item.time);

    sensorChart.data.labels = labels;
    sensorChart.data.datasets[0].data = sensorData.soilMoisture.map(item => item.value);
    sensorChart.data.datasets[1].data = sensorData.rain.map(item => item.value);
    sensorChart.data.datasets[2].data = sensorData.light.map(item => item.value);
    sensorChart.data.datasets[3].data = sensorData.tilt.map(item => item.value);

    // Smooth animation for new data points
    sensorChart.update('active');
}

// Export functions for potential external use
window.IoTDashboard = {
    connectFirebase,
    disconnectFirebase,
    updateSensorData,
    getSensorStatus,
    showNotification
};
