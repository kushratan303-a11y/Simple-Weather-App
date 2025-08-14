// script.js

// DOM elements
const input = document.querySelector('#cityInput');
const suggestionsEl = document.querySelector('#suggestions');
const searchButton = document.querySelector('.search-button');
const searchContainer = document.querySelector('.search-container');

// Debounce helper
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// AUTOCOMPLETE: fetch & render suggestions
input.addEventListener(
  'input',
  debounce(e => fetchSuggestions(e.target.value.trim()), 300)
);

async function fetchSuggestions(query) {
  if (!query) {
    suggestionsEl.innerHTML = '';
    return;
  }
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        query
      )}&count=5`
    );
    const data = await res.json();
    renderSuggestions(data.results || []);
  } catch (err) {
    console.error('Autocomplete error:', err);
  }
}

function renderSuggestions(list) {
  suggestionsEl.innerHTML = '';
  list.forEach(({ name, country, latitude, longitude }) => {
    const li = document.createElement('li');
    li.textContent = `${name}, ${country}`;
    li.addEventListener('click', () => {
      input.value = `${name}, ${country}`;
      suggestionsEl.innerHTML = '';
      handleSearchByCoords(name, country, latitude, longitude);
    });
    suggestionsEl.appendChild(li);
  });
}

document.addEventListener('click', e => {
  if (!searchContainer.contains(e.target)) suggestionsEl.innerHTML = '';
});

// SEARCH: on click or Enter
searchButton.addEventListener('click', () => {
  suggestionsEl.innerHTML = '';
  handleSearch();
});
input.addEventListener('keyup', e => {
  if (e.key === 'Enter') {
    suggestionsEl.innerHTML = '';
    handleSearch();
  }
});

async function handleSearch() {
  clearError();
  const city = input.value.trim();
  if (!city) return showError('Please enter a city name.');

  try {
    // Geocode city → lat/lon
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) {
      return showError('City not found. Check spelling and try again.');
    }
    const { latitude, longitude, name, country } = geoData.results[0];
    await fetchAndRenderWeather(name, country, latitude, longitude);
  } catch (err) {
    console.error(err);
    showError('Network error. Please try again later.');
  }
}

async function handleSearchByCoords(name, country, latitude, longitude) {
  clearError();
  await fetchAndRenderWeather(name, country, latitude, longitude);
}

async function fetchAndRenderWeather(name, country, lat, lon) {
  try {
    // Request current weather + hourly humidity, timezone=auto
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true` +
      `&hourly=relativehumidity_2m` +
      `&timezone=auto`;
    const weatherRes = await fetch(url);
    const weatherData = await weatherRes.json();

    const cw = weatherData.current_weather;
    if (!cw) {
      return showError('Weather data unavailable for this location.');
    }

    // Build the “snapped” hour string, e.g. "2025-07-08T17:00"
    const dt = new Date(cw.time);
    dt.setMinutes(0, 0, 0);
    const snapped = dt.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
    // Ensure it ends with ":00"
    const hourKey = snapped.endsWith(':00') ? snapped : snapped.slice(0,13) + ':00';

    // Look up that snapped hour in the hourly times
    const times = weatherData.hourly.time;                  // array of "YYYY-MM-DDTHH:00"
    const hums  = weatherData.hourly.relativehumidity_2m;   // matching array
    const idx   = times.indexOf(hourKey);

    const humidity = idx !== -1 && Array.isArray(hums) ? hums[idx] : null;

    updateWeatherUI(name, country, cw, humidity);
  } catch (err) {
    console.error('Weather fetch error:', err);
    showError('Failed to load weather data.');
  }
}


// Map Open‑Meteo weathercode to FontAwesome icon classes
function getIconClass(code) {
  if (code === 0) return 'fa-sun';
  if (code <= 1) return 'fa-cloud-sun';
  if (code <= 3) return 'fa-cloud';
  if (code <= 48) return 'fa-smog';
  if (code <= 67) return 'fa-cloud-showers-heavy';
  if (code <= 86) return 'fa-snowflake';
  if (code <= 95) return 'fa-bolt';
  return 'fa-question';
}

function updateWeatherUI(cityName, country, current, humidity) {
  document.querySelector('.city-name').textContent = `${cityName}, ${country}`;
  document.querySelector('.temperature').textContent = `${current.temperature}°C`;

  // Icon
  document.querySelector('.weather-icon').innerHTML = `
    <i class="fa-solid ${getIconClass(current.weathercode)}"></i>
  `;

  // Details: humidity will show “--” if null
  document.querySelector('.weather-details').innerHTML = `
    <div class="detail humidity">
      <i class="fa-solid fa-droplet"></i>
      <span>Humidity: <strong>${humidity !== null ? humidity + '%' : '--'}</strong></span>
    </div>
    <div class="detail wind">
      <i class="fa-solid fa-wind"></i>
      <span>Wind: <strong>${current.windspeed} km/h</strong></span>
    </div>
    <div class="detail">
      <i class="fa-solid fa-compass"></i>
      <span>Direction: <strong>${current.winddirection}°</strong></span>
    </div>
  `;
}

function showError(msg) {
  let err = document.querySelector('.error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'error';
    document.querySelector('.app-container').appendChild(err);
  }
  err.textContent = msg;
}

function clearError() {
  const err = document.querySelector('.error');
  if (err) err.remove();
}
