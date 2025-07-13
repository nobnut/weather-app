 
// --- CONFIGURATION ---
// PASTE YOUR API KEY HERE
const API_KEY = '3db6973de17d46b287a92052213107'; 

// --- ELEMENTS ---
const locationEl = document.getElementById('location');
const sunStatusEl = document.getElementById('sun-status');
const radarMapEl = document.getElementById('radar-map');
const tempEl = document.getElementById('temperature');
const windEl = document.getElementById('wind');
const pressureEl = document.getElementById('pressure');
const rainChartCanvas = document.getElementById('rain-chart');

// --- APP LOGIC ---
window.addEventListener('load', () => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(onSuccess, onError);
    } else {
        locationEl.innerText = "Geolocation not supported";
    }
});

function onSuccess(position) {
    const { latitude, longitude } = position.coords;
    const coords = `${latitude},${longitude}`;

    // Update the radar map
    updateRadar(latitude, longitude);

    // Fetch weather data
    fetchWeatherData(coords);
}

function onError() {
    locationEl.innerText = "Unable to retrieve location.";
}

function updateRadar(lat, lon) {
    // RainViewer embed URL. Adjust zoom (z=8) as needed.
    const radarURL = `https://www.rainviewer.com/map.html?loc=${lat},${lon},8&o=83&c=3&t=1&l=1,0,0,2,0,0&s=1`;
    radarMapEl.src = radarURL;
}

async function fetchWeatherData(coords) {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${coords}&days=1&aqi=no&alerts=no`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Weather data not available');
        }
        const data = await response.json();
        
        // Update UI with the data
        updateCurrentConditions(data);
        updateSunStatus(data.forecast.forecastday[0].astro);
        createRainChart(data.forecast.forecastday[0]);

    } catch (error) {
        locationEl.innerText = "Could not fetch weather";
        console.error(error);
    }
}

function updateCurrentConditions(data) {
    locationEl.innerText = `${data.location.name}, ${data.location.region}`;
    tempEl.innerText = `${data.current.temp_c} °C`;
    windEl.innerText = `${data.current.wind_mph} mph`;
    pressureEl.innerText = `${data.current.pressure_mb} mb`;
}

function updateSunStatus(astro) {
    // Convert 12-hour times to 24-hour format for easier comparison
    const sunrise24 = convertTo24Hour(astro.sunrise);
    const sunset24 = convertTo24Hour(astro.sunset);
    
    const now = new Date();
    const currentTime = now.getHours() + ":" + String(now.getMinutes()).padStart(2, '0');

    if (currentTime > sunrise24 && currentTime < sunset24) {
        // Daytime
        sunStatusEl.innerText = `Sunset at ${astro.sunset}`;
    } else {
        // Nighttime
        sunStatusEl.innerText = `Sunrise at ${astro.sunrise}`;
    }
}

// A helper function to convert AM/PM time to 24-hour format
function convertTo24Hour(timeStr) {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');
    if (hours === '12') {
        hours = '00';
    }
    if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
    }
    return `${hours}:${minutes}`;
}


function createRainChart(forecastDay) {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Get the next 60 minutes of rain data
    const next60MinsData = [];
    const labels = [];
    let minutesChecked = 0;

    // Start from the current hour in the forecast
    for (let i = currentHour; i < forecastDay.hour.length && minutesChecked < 60; i++) {
        const hourData = forecastDay.hour[i];
        
        // Check if the minute-by-minute data is available for this hour
        if (hourData.time_epoch * 1000 > now.getTime() - (60 * 60 * 1000) && hourData.minute) {
             for (let j = 0; j < hourData.minute.length; j++) {
                const minuteData = hourData.minute[j];
                const minuteTime = new Date(minuteData.time_epoch * 1000);
                
                if (minuteTime > now && minutesChecked < 60) {
                    next60MinsData.push(minuteData.precip_mm); // rain intensity
                    labels.push(minuteTime.getMinutes().toString().padStart(2, '0'));
                    minutesChecked++;
                }
            }
        }
    }
    
    // If no minutely data is found, show a message
    if (next60MinsData.length === 0) {
        console.log("Minutely forecast not available for the next hour.");
        return;
    }

    // Create the chart
    new Chart(rainChartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Rain Intensity (mm)',
                data: next60MinsData,
                borderColor: '#00BFFF',
                backgroundColor: 'rgba(0, 191, 255, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: {
                    display: true,
                    text: 'Rain Forecast (Next 60 Mins)',
                    color: '#e0e0e0'
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Minutes from now', color: '#b0b0b0' },
                    ticks: { color: '#b0b0b0' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'mm/hr', color: '#b0b0b0' },
                    ticks: { color: '#b0b0b0' }
                }
            }
        }
    });
}
