// IoT Dashboard JavaScript - Display ALL Sensor Values with Notifications
let firebaseConfig;
let database;
let firebaseRef = null;
let isAuthenticated = false;

// Global variables
let sensorChart = null;
let map = null;
let markers = {};
let allSensors = []; // Array to store all sensor nodes
let currentFilter = 'All';
let selectedSensorNode = null;
let sensorHistory = {}; // Store history for each sensor node
let detailCharts = {}; // Store chart instances for details view

// DOM elements
let loadingScreen, loginPage, dashboard, loginForm, loginError, logoutBtn;
let connectionStatus, sidebarToggle, pageTitle, lastUpdate, updateRate;
let totalReadings, avgUpdateRate, uptime, notificationsContainer, themeToggle, sidebarOverlay;
let sensorsGrid, chartSection, chartTitle, closeChartBtn;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    initializeElements();
    initializeFirebase();
    initializeEventListeners();
    initializeTheme();
    initializeMap();
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
    const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
    pageTitle = document.getElementById('pageTitle');
    lastUpdate = document.getElementById('lastUpdate');
    updateRate = document.getElementById('updateRate');
    notificationsContainer = document.getElementById('notificationsContainer');
    sensorsGrid = document.getElementById('sensorsGrid');
    chartSection = document.getElementById('chartSection');
    chartTitle = document.getElementById('chartTitle');
    closeChartBtn = document.getElementById('closeChartBtn');

    // Analytics elements
    totalReadings = document.getElementById('totalReadings');
    avgUpdateRate = document.getElementById('avgUpdateRate');
    uptime = document.getElementById('uptime');

    // Theme toggle
    themeToggle = document.getElementById('themeToggle');

    // Sidebar overlay
    sidebarOverlay = document.getElementById('sidebarOverlay');

    // Store mobile toggle for event listener
    window.mobileSidebarToggle = mobileSidebarToggle;
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
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    if (window.mobileSidebarToggle) {
        window.mobileSidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', handleNavigation);
    });

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', handleFilterChange);
    });

    // Chart controls
    document.querySelectorAll('.chart-btn:not(.close-chart-btn)').forEach(btn => {
        btn.addEventListener('click', handleChartRangeChange);
    });

    if (closeChartBtn) {
        closeChartBtn.addEventListener('click', () => {
            chartSection.classList.add('hidden');
            selectedSensorNode = null;
        });
    }

    // Theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Sidebar overlay for mobile
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Back button in details
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // Go back to overview
            document.querySelector('[data-section="overview"]').click();
        });
    }
}

function handleLogin(e) {
    e.preventDefault();

    // Request notification permission on user interaction
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Signed in
            var user = userCredential.user;
            console.log('User signed in:', user.email);
            // onAuthStateChanged will handle the UI updates
        })
        .catch((error) => {
            var errorCode = error.code;
            var errorMessage = error.message;
            console.error('Login error:', errorCode, errorMessage);
            showLoginError(errorMessage);
        });
}

function handleLogout() {
    firebase.auth().signOut().then(() => {
        // Sign-out successful.
        // onAuthStateChanged will handle the UI updates
    }).catch((error) => {
        // An error happened.
        console.error('Logout error:', error);
    });
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

    // Refresh map if map section is shown
    if (section === 'map' && map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }

    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 1024) {
        closeSidebar();
    }
}

function handleFilterChange(e) {
    const filter = e.target.getAttribute('data-filter');
    currentFilter = filter;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');

    renderSensors();
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
    document.querySelectorAll('.chart-btn:not(.close-chart-btn)').forEach(btn => {
        btn.classList.remove('active');
    });
    e.target.classList.add('active');

    console.log(`Chart range updated to ${range} seconds`);
}

function checkAuthentication() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            isAuthenticated = true;
            showDashboard();
            connectFirebase();
        } else {
            isAuthenticated = false;
            disconnectFirebase();
            showLogin();
        }
    });
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
    document.getElementById('email').value = '';
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

// Notification System
const NotificationSystem = {
    history: {},
    cooldown: 300000, // 5 minutes cooldown for same sensor

    check: function(sensors) {
        sensors.forEach(sensor => {
            const threatLevel = getThreatLevel(sensor);
            const lastState = this.history[sensor.nodeName] || { lastLevel: 'Low', lastNotification: 0 };
            const now = Date.now();

            // Trigger if High threat and (newly High OR cooldown passed)
            if (threatLevel === 'High') {
                if (lastState.lastLevel !== 'High' || (now - lastState.lastNotification > this.cooldown)) {
                    this.trigger(sensor);
                    this.history[sensor.nodeName] = { lastLevel: 'High', lastNotification: now };
                }
            } else {
                this.history[sensor.nodeName] = { ...lastState, lastLevel: threatLevel };
            }
        });
    },

    trigger: function(sensor) {
        this.showToast(sensor);
        this.playAlertSound();
        this.sendBrowserNotification(sensor);
    },

    showToast: function(sensor) {
        if (!notificationsContainer) return;

        const toast = document.createElement('div');
        toast.className = 'notification critical';
        
        const safeName = escapeHtml(sensor.nodeName);

        toast.innerHTML = `
            <div class="notification-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">High Threat Detected</div>
                <div class="notification-message">Sensor <strong>${safeName}</strong> is reporting critical levels.</div>
                <div class="notification-sensor">
                    <i class="fas fa-tint"></i> ${sensor.soilMoisture.toFixed(1)}% | 
                    <i class="fas fa-compress-arrows-alt"></i> ${sensor.tilt.toFixed(1)}°
                </div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        notificationsContainer.appendChild(toast);

        // Force reflow for animation
        requestAnimationFrame(() => toast.classList.add('show'));

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 10000);
    },

    playAlertSound: function() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.1);
            osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.2);

            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);

            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.warn('Audio playback failed', e);
        }
    },

    sendBrowserNotification: function(sensor) {
        if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            new Notification("High Threat Alert!", {
                body: `${sensor.nodeName}: Soil ${sensor.soilMoisture.toFixed(1)}%, Tilt ${sensor.tilt.toFixed(1)}°`,
                icon: 'https://cdn-icons-png.flaticon.com/512/10337/10337046.png' // Generic warning icon
            });
        }
    }
};

function handleFirebaseData(snapshot) {
    const data = snapshot.val();
    if (data) {
        // Clear current list
        allSensors = [];
        
        // Iterate through all children
        Object.keys(data).forEach(key => {
            if (key.startsWith('node_')) {
                const sensorNode = data[key];
                // Ensure nodeName is set
                if (!sensorNode.nodeName) {
                    sensorNode.nodeName = key;
                }
                allSensors.push(sensorNode);
                
                // Update history for charts
                updateSensorHistory(sensorNode);
            }
        });
        
        renderSensors();
        updateMapMarkers();
        
        // Check for threats
        NotificationSystem.check(allSensors);
        
        // Update chart if a sensor is selected
        if (selectedSensorNode) {
            const updatedNode = allSensors.find(s => s.nodeName === selectedSensorNode);
            if (updatedNode) {
                updateChart(updatedNode);
                updateSensorDetails(updatedNode);
            }
        }
        
        // Update timestamp
        if (lastUpdate) lastUpdate.textContent = new Date().toLocaleTimeString();
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

function getThreatLevel(sensor) {
    const tilt = sensor.tilt || 0;
    const soil = sensor.soilMoisture || 0;
    
    if (tilt > 15 || soil > 70) return "High";
    if (tilt > 10 || soil > 50) return "Medium";
    return "Low";
}

function renderSensors() {
    if (!sensorsGrid) return;
    
    sensorsGrid.innerHTML = '';
    
    const filteredSensors = allSensors.filter(sensor => {
        if (currentFilter === 'All') return true;
        return getThreatLevel(sensor) === currentFilter;
    });
    
    if (filteredSensors.length === 0) {
        sensorsGrid.innerHTML = `
            <div class="loading-placeholder">
                <i class="fas fa-info-circle"></i>
                <p>No sensors found matching filter "${currentFilter}"</p>
            </div>
        `;
        return;
    }
    
    filteredSensors.forEach(sensor => {
        const card = createSensorCard(sensor);
        sensorsGrid.appendChild(card);
    });
    
    if (totalReadings) {
        totalReadings.textContent = allSensors.length;
    }
}

// Helper to prevent XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function createSensorCard(sensor) {
    const threatLevel = getThreatLevel(sensor);
    const card = document.createElement('div');
    
    let statusClass = 'normal';
    if (threatLevel === 'High') statusClass = 'critical';
    else if (threatLevel === 'Medium') statusClass = 'warning';
    
    card.className = `sensor-card ${statusClass}`;
    card.onclick = () => selectSensor(sensor);
    
    // Sanitize inputs
    const safeName = escapeHtml(sensor.nodeName || 'Unknown Node');
    
    card.innerHTML = `
        <div class="sensor-header">
            <div class="sensor-icon">
                <i class="fas fa-microchip"></i>
            </div>
            <div class="sensor-info">
                <h3>${safeName}</h3>
                <div class="sensor-status ${statusClass}">
                    <i class="fas fa-circle"></i>
                    <span class="status-text">${threatLevel} Risk</span>
                </div>
            </div>
        </div>
        <div class="sensor-data-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="data-item">
                <span class="label">Soil:</span>
                <span class="value">${(sensor.soilMoisture || 0).toFixed(1)}%</span>
            </div>
            <div class="data-item">
                <span class="label">Rain:</span>
                <span class="value">${(sensor.rain || 0).toFixed(1)}%</span>
            </div>
            <div class="data-item">
                <span class="label">Tilt:</span>
                <span class="value">${(sensor.tilt || 0).toFixed(1)}°</span>
            </div>
            <div class="data-item">
                <span class="label">Light:</span>
                <span class="value">${Math.round(sensor.light || 0)} lux</span>
            </div>
        </div>
        <div class="sensor-footer" style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-muted);">
            Last updated: ${escapeHtml(sensor.timestamp || 'Unknown')}
        </div>
        <button class="view-details-btn" onclick="event.stopPropagation(); showSensorDetails('${safeName}')">
            <i class="fas fa-chart-bar"></i> View Details
        </button>
    `;
    
    return card;
}

function showSensorDetails(nodeName) {
    selectedSensorNode = nodeName;
    const sensor = allSensors.find(s => s.nodeName === nodeName);
    if (!sensor) return;

    // Switch to details section
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById('sensor-details').classList.add('active');
    
    // Update nav active state (optional, maybe clear all active)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Initialize charts if needed
    if (Object.keys(detailCharts).length === 0) {
        initializeDetailCharts();
    }

    updateSensorDetails(sensor);
}

function updateSensorDetails(sensor) {
    // Update header
    document.getElementById('detailSensorName').textContent = sensor.nodeName;
    
    const threatLevel = getThreatLevel(sensor);
    const statusBadge = document.getElementById('detailSensorStatus');
    statusBadge.className = `sensor-status-badge ${threatLevel === 'High' ? 'critical' : threatLevel === 'Medium' ? 'warning' : 'normal'}`;
    statusBadge.innerHTML = `<i class="fas fa-circle"></i> <span>${threatLevel} Risk</span>`;

    // Update current values
    document.getElementById('detailSoil').textContent = `${(sensor.soilMoisture || 0).toFixed(1)}%`;
    document.getElementById('detailRain').textContent = `${(sensor.rain || 0).toFixed(1)}%`;
    document.getElementById('detailTilt').textContent = `${(sensor.tilt || 0).toFixed(1)}°`;
    document.getElementById('detailLight').textContent = `${Math.round(sensor.light || 0)} lux`;

    // Update charts
    updateDetailCharts(sensor.nodeName);
}

function initializeDetailCharts() {
    const chartConfig = (color, label) => ({
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: color,
                backgroundColor: color + '20', // 20% opacity
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { beginAtZero: true }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    });

    detailCharts.soil = new Chart(document.getElementById('detailSoilChart'), chartConfig('#588157', 'Soil Moisture'));
    detailCharts.rain = new Chart(document.getElementById('detailRainChart'), chartConfig('#3A5A40', 'Rainfall'));
    detailCharts.tilt = new Chart(document.getElementById('detailTiltChart'), chartConfig('#ef4444', 'Tilt Angle'));
    detailCharts.light = new Chart(document.getElementById('detailLightChart'), chartConfig('#d97706', 'Light Level'));
}

function updateDetailCharts(nodeName) {
    const history = sensorHistory[nodeName];
    if (!history) return;

    const updateChartData = (chart, data) => {
        chart.data.labels = history.timestamps;
        chart.data.datasets[0].data = data;
        chart.update('none'); // Update without animation for performance
    };

    updateChartData(detailCharts.soil, history.soilMoisture);
    updateChartData(detailCharts.rain, history.rain);
    updateChartData(detailCharts.tilt, history.tilt);
    updateChartData(detailCharts.light, history.light);
}

function selectSensor(sensor) {
    selectedSensorNode = sensor.nodeName;
    chartSection.classList.remove('hidden');
    chartTitle.textContent = `Real-time Data: ${sensor.nodeName}`;
    
    // Scroll to chart
    chartSection.scrollIntoView({ behavior: 'smooth' });
    
    // Initialize chart if needed
    if (!sensorChart) {
        initializeChart();
    }
    
    updateChart(sensor);
}

function updateSensorHistory(sensor) {
    const name = sensor.nodeName;
    if (!sensorHistory[name]) {
        sensorHistory[name] = {
            soilMoisture: [],
            rain: [],
            light: [],
            tilt: [],
            timestamps: []
        };
    }
    
    const history = sensorHistory[name];
    const time = new Date().toLocaleTimeString();
    
    history.timestamps.push(time);
    history.soilMoisture.push(sensor.soilMoisture || 0);
    history.rain.push(sensor.rain || 0);
    history.light.push(sensor.light || 0);
    history.tilt.push(sensor.tilt || 0);
    
    // Keep last 20 points
    if (history.timestamps.length > 20) {
        history.timestamps.shift();
        history.soilMoisture.shift();
        history.rain.shift();
        history.light.shift();
        history.tilt.shift();
    }
}

function updateChart(sensor) {
    if (!sensorChart || !selectedSensorNode) return;
    
    const history = sensorHistory[selectedSensorNode];
    if (!history) return;
    
    sensorChart.data.labels = history.timestamps;
    sensorChart.data.datasets[0].data = history.soilMoisture;
    sensorChart.data.datasets[1].data = history.rain;
    sensorChart.data.datasets[2].data = history.light;
    sensorChart.data.datasets[3].data = history.tilt;
    
    sensorChart.update();
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

// Chart initialization
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
                    borderColor: '#588157', // Fern Green
                    backgroundColor: 'rgba(88, 129, 87, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    yAxisID: 'y',
                    fill: true
                },
                {
                    label: 'Rain (%)',
                    data: [],
                    borderColor: '#3A5A40', // Hunter Green
                    backgroundColor: 'rgba(58, 90, 64, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    yAxisID: 'y',
                    fill: true
                },
                {
                    label: 'Light (lux)',
                    data: [],
                    borderColor: '#d97706', // Accent
                    backgroundColor: 'rgba(217, 119, 6, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    yAxisID: 'y1',
                    fill: true
                },
                {
                    label: 'Tilt (°)',
                    data: [],
                    borderColor: '#ef4444', // Danger
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    yAxisID: 'y',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Percentage / Degrees'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                        drawOnChartArea: false,
                    },
                    title: {
                        display: true,
                        text: 'Light (lux)'
                    }
                }
            }
        }
    });
}

// Map initialization
function initializeMap() {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    // Default center (Sri Lanka)
    const defaultCenter = [7.8731, 80.7718];
    
    map = L.map('mapContainer').setView(defaultCenter, 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function updateMapMarkers() {
    if (!map) return;

    // Clear existing markers
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};

    const bounds = [];

    allSensors.forEach(sensor => {
        if (sensor.latitude && sensor.longitude) {
            const lat = parseFloat(sensor.latitude);
            const lng = parseFloat(sensor.longitude);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const threatLevel = getThreatLevel(sensor);
                let markerClass = 'marker-low';
                let badgeClass = 'low';
                
                if (threatLevel === 'High') {
                    markerClass = 'marker-high';
                    badgeClass = 'high';
                } else if (threatLevel === 'Medium') {
                    markerClass = 'marker-medium';
                    badgeClass = 'medium';
                }

                // Create custom animated icon
                const icon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div class="map-marker ${markerClass}">
                            <div class="ring"></div>
                            <div class="dot"></div>
                           </div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                const safeName = escapeHtml(sensor.nodeName || 'Sensor Node');

                const marker = L.marker([lat, lng], { icon: icon }).addTo(map);

                // Custom Popup Content
                const popupContent = `
                    <div class="popup-header">
                        <h3>${safeName}</h3>
                        <span class="popup-badge ${badgeClass}">${threatLevel} Risk</span>
                    </div>
                    <div class="popup-body">
                        <div class="popup-row">
                            <span class="popup-label">Soil Moisture</span>
                            <span class="popup-value">${(sensor.soilMoisture || 0).toFixed(1)}%</span>
                        </div>
                        <div class="popup-row">
                            <span class="popup-label">Rainfall</span>
                            <span class="popup-value">${(sensor.rain || 0).toFixed(1)}%</span>
                        </div>
                        <div class="popup-row">
                            <span class="popup-label">Tilt Angle</span>
                            <span class="popup-value">${(sensor.tilt || 0).toFixed(1)}°</span>
                        </div>
                    </div>
                    <div class="popup-actions">
                        <button class="popup-btn" onclick="showSensorDetails('${safeName}')">
                            View Full Details
                        </button>
                    </div>
                `;

                marker.bindPopup(popupContent, {
                    className: 'custom-popup',
                    closeButton: false,
                    maxWidth: 300,
                    minWidth: 260
                });

                markers[sensor.nodeName] = marker;
                bounds.push([lat, lng]);
            }
        }
    });

    // Fit bounds if we have markers
    if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Export functions
window.IoTDashboard = {
    connectFirebase,
    disconnectFirebase
};