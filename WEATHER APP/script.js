/**
 * API Endpoint Constants
 * Centralized location for weather and geocoding services.
 */
const API_BASE_URLS = {
    GEOCODING: 'https://geocoding-api.open-meteo.com/v1/search',
    WEATHER: 'https://api.open-meteo.com/v1/forecast'
};

/**
 * Weather Code Mapping (WMO Code to Human Readable & Icon / Color Classes)
 */
const WEATHER_CODES = {
    0: { desc: 'Clear sky', icon: 'sun', color: 'text-amber' },
    1: { desc: 'Mainly clear', icon: 'cloud-sun', color: 'text-sky' },
    2: { desc: 'Partly cloudy', icon: 'cloud-sun', color: 'text-slate' },
    3: { desc: 'Overcast', icon: 'cloud', color: 'text-slate' },
    45: { desc: 'Foggy', icon: 'cloud-fog', color: 'text-slate' },
    48: { desc: 'Depositing rime fog', icon: 'cloud-fog', color: 'text-slate' },
    51: { desc: 'Light drizzle', icon: 'cloud-drizzle', color: 'text-sky' },
    53: { desc: 'Moderate drizzle', icon: 'cloud-drizzle', color: 'text-sky' },
    55: { desc: 'Dense drizzle', icon: 'cloud-rain', color: 'text-blue' },
    61: { desc: 'Slight rain', icon: 'cloud-rain', color: 'text-blue' },
    63: { desc: 'Moderate rain', icon: 'cloud-rain', color: 'text-blue' },
    65: { desc: 'Heavy rain', icon: 'cloud-heavy-rain', color: 'text-blue' },
    71: { desc: 'Slight snowfall', icon: 'cloud-snow', color: 'text-sky' },
    73: { desc: 'Moderate snowfall', icon: 'cloud-snow', color: 'text-sky' },
    75: { desc: 'Heavy snowfall', icon: 'snowflake', color: 'text-white' },
    80: { desc: 'Slight rain showers', icon: 'cloud-rain', color: 'text-sky' },
    81: { desc: 'Moderate rain showers', icon: 'cloud-rain', color: 'text-blue' },
    82: { desc: 'Violent rain showers', icon: 'cloud-lightning', color: 'text-indigo' },
    95: { desc: 'Thunderstorm', icon: 'cloud-lightning', color: 'text-amber' },
    96: { desc: 'Thunderstorm with hail', icon: 'cloud-hail', color: 'text-amber' }
};

// Application State
let debounceTimer = null;
const cityInput = document.getElementById('cityInput');
const suggestionsDropdown = document.getElementById('suggestionsDropdown');
const weatherDisplayArea = document.getElementById('weatherDisplayArea');

// Initialize Lucide Icons on start
window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // Set up debounced keyup event listener for search input
    cityInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);
        
        if (query.length < 2) {
            hideSuggestions();
            return;
        }

        // Debounce API calls (350ms delay)
        debounceTimer = setTimeout(() => {
            fetchCitySuggestions(query);
        }, 350);
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!cityInput.contains(e.target) && !suggestionsDropdown.contains(e.target)) {
            hideSuggestions();
        }
    });
});

/**
 * Fetch City Suggestions for Autosuggest
 */
async function fetchCitySuggestions(query) {
    try {
        const url = `${API_BASE_URLS.GEOCODING}?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        const response = await fetch(url);
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderSuggestions(data.results);
        } else {
            hideSuggestions();
        }
    } catch (error) {
        console.error("Autosuggest fetch error:", error);
    }
}

/**
 * Render Autosuggest Dropdown
 */
function renderSuggestions(cities) {
    suggestionsDropdown.innerHTML = '';
    cities.forEach(city => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        
        const locationLabel = `${city.name}${city.admin1 ? ', ' + city.admin1 : ''}, ${city.country || ''}`;
        
        item.innerHTML = `
            <div class="suggestion-left">
                <i data-lucide="map-pin"></i>
                <span style="font-weight: 500;">${city.name}</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${city.admin1 || ''} ${city.country ? '(' + city.country + ')' : ''}</span>
            </div>
            <span class="suggestion-coords">${city.latitude.toFixed(2)}°, ${city.longitude.toFixed(2)}°</span>
        `;

        item.addEventListener('click', () => {
            cityInput.value = locationLabel;
            hideSuggestions();
            loadWeatherDataForCity(city);
        });

        suggestionsDropdown.appendChild(item);
    });
    
    suggestionsDropdown.classList.remove('hidden');
    lucide.createIcons();
}

function hideSuggestions() {
    suggestionsDropdown.classList.add('hidden');
    suggestionsDropdown.innerHTML = '';
}

/**
 * Handle Quick Search Button Clicks
 */
function handleQuickSearch(cityName) {
    cityInput.value = cityName;
    executeSearch(cityName);
}

/**
 * Form Submit Event Handler
 */
function handleFormSubmit(event) {
    event.preventDefault();
    const query = cityInput.value.trim();
    executeSearch(query);
}

/**
 * Validates input and executes full search process
 */
async function executeSearch(query) {
    hideSuggestions();

    // Input Validation: Check for empty or whitespace-only inputs
    if (!query || query.trim() === '') {
        renderErrorState('Please enter a city name before searching.');
        return;
    }

    renderLoadingState();

    try {
        // Step 1: Geocode city name to coordinates
        const geoUrl = `${API_BASE_URLS.GEOCODING}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
        const geoResponse = await fetch(geoUrl);

        if (!geoResponse.ok) {
            throw new Error(`Geocoding server error (Status: ${geoResponse.status})`);
        }

        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            renderErrorState(`No locations found matching "${query}". Please check the spelling and try again.`);
            return;
        }

        const selectedCity = geoData.results[0];
        await loadWeatherDataForCity(selectedCity);

    } catch (error) {
        console.error("Search execution failed:", error);
        renderErrorState(error.message || 'Unable to connect to the weather service. Please check your network connection.');
    }
}

/**
 * Fetch current conditions and 5-day forecast for given city object
 */
async function loadWeatherDataForCity(city) {
    renderLoadingState();

    try {
        const lat = city.latitude;
        const lon = city.longitude;

        // Request parameters for current conditions and daily forecasts
        const weatherUrl = `${API_BASE_URLS.WEATHER}?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max&hourly=relativehumidity_2m,apparent_temperature&timezone=auto`;

        const response = await fetch(weatherUrl);

        // Check HTTP status ok before parsing JSON
        if (!response.ok) {
            throw new Error(`Weather data request failed with status code ${response.status}`);
        }

        const weatherData = await response.json();

        // Format location display name
        const locationName = `${city.name}${city.admin1 ? ', ' + city.admin1 : ''}, ${city.country || ''}`;

        // Inject dynamic weather dashboard HTML
        renderWeatherDashboard(locationName, weatherData);

    } catch (error) {
        console.error("Failed to load weather data:", error);
        renderErrorState(`Failed to retrieve weather data: ${error.message}`);
    }
}

/**
 * Render Loading Indicator UI (Skeleton Loader)
 */
function renderLoadingState() {
    weatherDisplayArea.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;" class="fade-in">
            <!-- Current Weather Skeleton -->
            <div class="current-weather-card" style="position: relative; overflow: hidden; min-height: 220px;">
                <div class="shimmer" style="position: absolute; inset: 0;"></div>
            </div>
            <!-- Forecast Skeleton -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div style="height: 1.5rem; width: 10rem; background: rgba(51, 65, 85, 0.5); border-radius: 0.5rem;"></div>
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.85rem;">
                    ${Array(5).fill('<div style="height: 10rem; background: rgba(30, 41, 59, 0.4); border: 1px solid var(--border-color); border-radius: 1rem;"></div>').join('')}
                </div>
            </div>
        </div>
    `;
}

/**
 * Render Friendly Error Messages Banner
 */
function renderErrorState(errorMessage) {
    weatherDisplayArea.innerHTML = `
        <div class="error-box fade-in">
            <div class="error-icon-wrapper">
                <i data-lucide="alert-circle"></i>
            </div>
            <h3>Something went wrong</h3>
            <p>${errorMessage}</p>
            <button onclick="cityInput.focus()" class="error-btn">
                Try Another Search
            </button>
        </div>
    `;
    lucide.createIcons();
}

/**
 * Dynamically Inject Weather Data into DOM
 */
function renderWeatherDashboard(locationName, data) {
    const current = data.current_weather;
    const daily = data.daily;
    const hourly = data.hourly;

    // Resolve weather details from condition code
    const weatherInfo = WEATHER_CODES[current.weathercode] || { desc: 'Unknown', icon: 'cloud', color: 'text-slate' };
    
    // Extract current humidity & apparent temperature
    const currentHumidity = hourly && hourly.relativehumidity_2m ? hourly.relativehumidity_2m[0] : 'N/A';
    const feelsLike = hourly && hourly.apparent_temperature ? Math.round(hourly.apparent_temperature[0]) : Math.round(current.temperature);

    // Date Formatting
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

    // Render Hero Current Weather Card
    let html = `
        <div style="display: flex; flex-direction: column; gap: 2rem;" class="fade-in">
            <!-- Current Conditions Card -->
            <div class="current-weather-card">
                <div class="current-weather-glow"></div>
                
                <div class="current-inner">
                    <!-- Left: Location & Main Temp -->
                    <div class="current-left">
                        <div>
                            <div class="location-title-row">
                                <i data-lucide="map-pin"></i>
                                <h2>${locationName}</h2>
                            </div>
                            <p class="current-date">${formattedDate}</p>
                        </div>

                        <div class="temp-and-condition">
                            <div class="main-temp">
                                ${Math.round(current.temperature)}<span>°C</span>
                            </div>
                            <div class="condition-details">
                                <div class="condition-desc-row">
                                    <i data-lucide="${weatherInfo.icon}" class="${weatherInfo.color}"></i>
                                    <span>${weatherInfo.desc}</span>
                                </div>
                                <p class="feels-like">Feels like <span>${feelsLike}°C</span></p>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Key Weather Metrics Grid -->
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <i data-lucide="wind" class="text-sky"></i>
                            <span class="label">Wind Speed</span>
                            <span class="value">${current.windspeed} <span>km/h</span></span>
                        </div>

                        <div class="metric-card">
                            <i data-lucide="droplets" class="text-teal"></i>
                            <span class="label">Humidity</span>
                            <span class="value">${currentHumidity}<span>%</span></span>
                        </div>

                        <div class="metric-card">
                            <i data-lucide="compass" class="text-indigo"></i>
                            <span class="label">Wind Direction</span>
                            <span class="value">${current.winddirection}<span>°</span></span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 5-Day Weather Forecast Section -->
            <div class="forecast-section">
                <div class="forecast-header">
                    <h3>
                        <i data-lucide="calendar"></i>
                        <span>5-Day Weather Forecast</span>
                    </h3>
                    <span>Daily Overview</span>
                </div>

                <div class="forecast-grid">
    `;

    // Loop through next 5 daily forecast items
    for (let i = 0; i < Math.min(5, daily.time.length); i++) {
        const dateObj = new Date(daily.time[i] + 'T00:00:00');
        const dayName = i === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const code = daily.weathercode[i];
        const dayWeather = WEATHER_CODES[code] || { desc: 'Unknown', icon: 'cloud', color: 'text-slate' };
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const precip = daily.precipitation_sum ? daily.precipitation_sum[i] : 0;

        html += `
            <div class="forecast-card">
                <div class="forecast-card-top">
                    <span class="forecast-day">${dayName}</span>
                    <span class="forecast-date">${dateFormatted}</span>
                </div>

                <div class="forecast-middle">
                    <i data-lucide="${dayWeather.icon}" class="${dayWeather.color}"></i>
                    <span>${dayWeather.desc}</span>
                </div>

                <div class="forecast-bottom">
                    <div class="forecast-temps">
                        <span class="forecast-temp-max">${maxTemp}°</span>
                        <span class="forecast-temp-min">${minTemp}°</span>
                    </div>
                    ${precip > 0 ? `
                        <div class="forecast-rain">
                            <i data-lucide="cloud-rain"></i>
                            <span>${precip.toFixed(1)}mm</span>
                        </div>
                    ` : `
                        <div class="no-rain">No Rain</div>
                    `}
                </div>
            </div>
        `;
    }

    html += `
                </div>
            </div>
        </div>
    `;

    weatherDisplayArea.innerHTML = html;
    lucide.createIcons();
}