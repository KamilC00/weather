// API key dla OpenWeatherMap
const API_KEY = 'f1c00ff915da831f1b9fe350fb589348';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Inicjalizacja bazy danych na początku pliku
//let dbPromise;

// Funkcja inicjująca bazę danych 
async function initDatabase() {
  if (dbPromise) return dbPromise;
  
  // Sprawdzenie czy mamy dostęp do IndexedDB
  if (!('indexedDB' in window)) {
    console.warn('Twoja przeglądarka nie wspiera IndexedDB');
    throw new Error('Twoja przeglądarka nie wspiera IndexedDB');
  }
  
  try {
    // Inicjujemy bazę danych
    dbPromise = await idb.openDB('weather-app-db', 1, {
      upgrade(db) {
        // Tworzenie magazynów danych jeśli nie istnieją
        if (!db.objectStoreNames.contains('locations')) {
          db.createObjectStore('locations', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('weatherCache')) {
          db.createObjectStore('weatherCache', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('forecastCache')) {
          db.createObjectStore('forecastCache', { keyPath: 'id' });
        }
      }
    });
    
    return dbPromise;
  } catch (error) {
    console.error('Błąd inicjalizacji bazy danych:', error);
    throw error;
  }
}

// Funkcja pobierająca pogodę dla aktualnej lokalizacji
async function getCurrentLocationWeather() {
  const currentWeatherElement = document.getElementById('current-weather');
  
  try {
    // Inicjalizujemy bazę danych przed użyciem
    await initDatabase();
    
    // Pobieramy lokalizację użytkownika
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;
    
    // Próbujemy pobrać dane z cache
    let weatherData = await getWeatherFromCache('current-location');
    
    if (!weatherData && navigator.onLine) {
      // Jeśli nie ma w cache, pobieramy z API
      weatherData = await fetchWeatherData(latitude, longitude);
      if (weatherData) {
        await saveWeatherToCache('current-location', weatherData);
      }
    }
    
    if (weatherData) {
      displayCurrentWeather(weatherData);
      // Pobieramy i wyświetlamy prognozę
      getForecastWeather(latitude, longitude);
    } else {
      currentWeatherElement.innerHTML = `
        <div class="error-message">
          <p>Dane pogodowe niedostępne. Sprawdź połączenie internetowe.</p>
        </div>
      `;
    }
  } catch (error) {
    currentWeatherElement.innerHTML = `
      <div class="error-message">
        <p>Nie udało się pobrać aktualnej pogody.</p>
        <p>${error.message}</p>
      </div>
    `;
    console.error('Błąd pobierania pogody:', error);
  }
}

// Funkcja pobierająca i wyświetlająca prognozę na 5 dni
async function getForecastWeather(lat, lon) {
  const forecastElement = document.getElementById('forecast-weather');
  const loadingElement = forecastElement.querySelector('.loading');
  const forecastContainer = forecastElement.querySelector('.forecast-days-container');
  
  try {
    // Upewniamy się, że baza danych jest zainicjowana
    await initDatabase();
    
    // Próbujemy najpierw pobrać prognozę z cache
    let forecastData = await getForecastFromCache('forecast-location');
    
    if (!forecastData && navigator.onLine) {
      // Jeśli nie ma w cache lub dane są stare, pobieramy nowe
      forecastData = await fetchForecastData(lat, lon);
      await saveForecastToCache('forecast-location', forecastData);
    }
    
    if (forecastData) {
      // Ukryj komunikat o ładowaniu
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      
      displayForecastWeather(forecastData, forecastContainer);
    } else {
      forecastElement.innerHTML = `
        <h2>Prognoza na 5 dni</h2>
        <div class="error-message">
          <p>Dane prognozy niedostępne. Sprawdź połączenie internetowe.</p>
        </div>
      `;
    }
    
  } catch (error) {
    forecastElement.innerHTML = `
      <h2>Prognoza na 5 dni</h2>
      <div class="error-message">
        <p>Nie udało się pobrać prognozy pogody.</p>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Funkcja pobierająca dane z cache
async function getWeatherFromCache(locationId) {
  try {
    // Upewniamy się, że baza danych jest zainicjowana
    await initDatabase();
    
    const db = await dbPromise;
    const tx = db.transaction(['weatherCache'], 'readonly');
    const store = tx.objectStore('weatherCache');
    
    const cachedData = await store.get(locationId);
    
    if (!cachedData) {
      return null;
    }
    
    // Sprawdzamy czy dane nie są starsze niż 1 godzina
    const now = new Date().getTime();
    if (now - cachedData.timestamp > 60 * 60 * 1000) {
      return null; // Dane są nieaktualne
    }
    
    return cachedData.data;
  } catch (error) {
    console.error('Błąd podczas pobierania pogody z cache:', error);
    return null;
  }
}

// Funkcja zapisująca dane do cache
async function saveWeatherToCache(locationId, data) {
  try {
    // Upewniamy się, że baza danych jest zainicjowana
    await initDatabase();
    
    const db = await dbPromise;
    const tx = db.transaction(['weatherCache'], 'readwrite');
    const store = tx.objectStore('weatherCache');
    
    await store.put({
      id: locationId,
      data: data,
      timestamp: new Date().getTime()
    });
    
    return true;
  } catch (error) {
    console.error('Błąd podczas zapisywania pogody do cache:', error);
    return false;
  }
}

// Funkcja pobierająca prognozę z cache
async function getForecastFromCache(locationId) {
  try {
    // Upewniamy się, że baza danych jest zainicjowana
    await initDatabase();
    
    const db = await dbPromise;
    const tx = db.transaction(['forecastCache'], 'readonly');
    const store = tx.objectStore('forecastCache');
    
    const cachedData = await store.get(locationId);
    
    if (!cachedData) {
      return null;
    }
    
    // Sprawdzamy czy dane nie są starsze niż 3 godziny
    const now = new Date().getTime();
    if (now - cachedData.timestamp > 3 * 60 * 60 * 1000) {
      return null; // Dane są nieaktualne
    }
    
    return cachedData.data;
  } catch (error) {
    console.error('Błąd podczas pobierania prognozy z cache:', error);
    return null;
  }
}

// Funkcja zapisująca prognozę do cache
async function saveForecastToCache(locationId, data) {
  try {
    // Upewniamy się, że baza danych jest zainicjowana
    await initDatabase();
    
    const db = await dbPromise;
    const tx = db.transaction(['forecastCache'], 'readwrite');
    const store = tx.objectStore('forecastCache');
    
    await store.put({
      id: locationId,
      data: data,
      timestamp: new Date().getTime()
    });
    
    return true;
  } catch (error) {
    console.error('Błąd podczas zapisywania prognozy do cache:', error);
    return false;
  }
}

// Funkcja ładująca ulubione lokalizacje na stronie głównej
async function loadFavoriteLocations() {
  const favoriteLocationsElement = document.getElementById('favorite-locations');
  
  if (!favoriteLocationsElement) return; // Zabezpieczenie jeśli nie jesteśmy na stronie głównej
  
  try {
    // Inicjalizacja bazy danych jeśli potrzebna
    await initDatabase();
    
    // Pobieranie zapisanych lokalizacji
    const locations = await getSavedLocations();
    
    if (locations.length === 0) {
      favoriteLocationsElement.innerHTML = '<p>Nie masz jeszcze zapisanych lokalizacji.</p>';
      return;
    }
    
    // Czyścimy kontener
    favoriteLocationsElement.innerHTML = '';
    
    // Dla każdej lokalizacji tworzymy element
    for (const location of locations) {
      const locationElement = document.createElement('div');
      locationElement.className = 'location-card';
      locationElement.innerHTML = `
        <h3>${location.name}</h3>
        <div class="location-weather-container">
          <div class="location-current-weather">
            <div class="loading">Pobieranie danych...</div>
          </div>
          <div class="location-forecast">
            <div class="loading">Pobieranie prognozy...</div>
          </div>
        </div>
      `;
      
      favoriteLocationsElement.appendChild(locationElement);
      
      // Asynchronicznie pobieramy aktualną pogodę dla tej lokalizacji
      loadCurrentWeatherForLocation(location, locationElement);
      
      // Asynchronicznie pobieramy prognozę na 5 dni
      loadForecastForLocation(location, locationElement);
    }
    
  } catch (error) {
    favoriteLocationsElement.innerHTML = `
      <div class="error-message">
        <p>Błąd podczas pobierania zapisanych lokalizacji: ${error.message}</p>
      </div>
    `;
    console.error('Błąd podczas pobierania zapisanych lokalizacji:', error);
  }
}

// Funkcja ładująca aktualną pogodę dla lokalizacji
async function loadCurrentWeatherForLocation(location, locationElement) {
  const weatherContainer = locationElement.querySelector('.location-current-weather');
  
  try {
    // Najpierw próbujemy z cache
    let weatherData = await getWeatherFromCache(location.id);
    
    if (!weatherData && navigator.onLine) {
      // Jeśli nie ma w cache i jest połączenie, pobieramy nowe dane
      weatherData = await fetchWeatherData(location.lat, location.lon);
      if (weatherData) {
        await saveWeatherToCache(location.id, weatherData);
      }
    }
    
    // Wyświetlamy pogodę jeśli są dane
    if (weatherData) {
      weatherContainer.innerHTML = `
        <div class="weather-compact">
          <div class="temperature">
            <span class="temp-value">${Math.round(weatherData.main.temp)}°C</span>
          </div>
          
          <div class="weather-description">
            <img src="https://openweathermap.org/img/wn/${weatherData.weather[0].icon}.png" alt="${weatherData.weather[0].description}">
            <p>${weatherData.weather[0].description}</p>
          </div>
          
          <div class="weather-details-compact">
            <p>Wilgotność: ${weatherData.main.humidity}%</p>
            <p>Wiatr: ${weatherData.wind.speed} m/s</p>
          </div>
        </div>
      `;
    } else {
      weatherContainer.innerHTML = `
        <div class="error-message">
          <p>Dane pogodowe niedostępne.</p>
        </div>
      `;
    }
  } catch (error) {
    weatherContainer.innerHTML = `
      <div class="error-message">
        <p>Błąd pobierania danych pogodowych.</p>
      </div>
    `;
  }
}

// Funkcja ładująca prognozę 5-dniową dla lokalizacji
async function loadForecastForLocation(location, locationElement) {
  const forecastContainer = locationElement.querySelector('.location-forecast');
  
  try {
    // Tworzymy unikalny identyfikator dla prognozy tej lokalizacji
    const forecastCacheId = `forecast-${location.id}`;
    
    // Próbujemy pobrać z cache
    let forecastData = await getForecastFromCache(forecastCacheId);
    
    if (!forecastData && navigator.onLine) {
      // Jeśli nie ma w cache i jest połączenie, pobieramy nowe dane
      forecastData = await fetchForecastData(location.lat, location.lon);
      if (forecastData) {
        await saveForecastToCache(forecastCacheId, forecastData);
      }
    }
    
    // Wyświetlamy prognozę jeśli są dane
    if (forecastData) {
      // Przygotowujemy kontener na prognozy
      forecastContainer.innerHTML = '<div class="forecast-days-row"></div>';
      const forecastRow = forecastContainer.querySelector('.forecast-days-row');
      
      // Grupujemy prognozy po dniach (OpenWeatherMap zwraca dane co 3 godziny)
      const forecastByDay = groupForecastByDay(forecastData);
      
      // Wyświetlamy tylko 5 dni
      const days = Object.keys(forecastByDay).slice(0, 5);
      
      days.forEach(day => {
        const forecast = forecastByDay[day];
        const date = new Date(forecast.dt * 1000);
        
        // Formatowanie dnia tygodnia
        const dayName = date.toLocaleDateString('pl-PL', { weekday: 'short' });
        
        const dayElement = document.createElement('div');
        dayElement.className = 'forecast-day-compact';
        dayElement.innerHTML = `
          <div class="forecast-date-compact">
            <p>${dayName}</p>
          </div>
          <div class="forecast-icon-compact">
            <img src="https://openweathermap.org/img/wn/${forecast.weather[0].icon}.png" alt="${forecast.weather[0].description}">
          </div>
          <div class="forecast-temp-compact">
            <p>${Math.round(forecast.main.temp)}°C</p>
          </div>
        `;
        
        forecastRow.appendChild(dayElement);
      });
      
    } else {
      forecastContainer.innerHTML = `
        <div class="error-message">
          <p>Prognoza niedostępna.</p>
        </div>
      `;
    }
  } catch (error) {
    forecastContainer.innerHTML = `
      <div class="error-message">
        <p>Błąd pobierania prognozy.</p>
      </div>
    `;
  }
}

// Funkcja grupująca prognozę po dniach
function groupForecastByDay(forecastData) {
  const forecastByDay = {};
  
  forecastData.list.forEach(item => {
    const date = new Date(item.dt * 1000);
    const day = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Wybieramy tylko dane z godziny 12:00 lub zapisujemy pierwszy dostępny wpis dla danego dnia
    if (!forecastByDay[day] || date.getHours() === 12) {
      forecastByDay[day] = item;
    }
  });
  
  return forecastByDay;
}

// Helper do pobierania pozycji użytkownika
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolokalizacja nie jest wspierana przez twoją przeglądarkę.'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    });
  });
}

// Funkcja pobierająca dane pogodowe z API
async function fetchWeatherData(lat, lon) {
  const url = `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&lang=pl&appid=${API_KEY}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Funkcja pobierająca prognozę pogody na 5 dni
async function fetchForecastData(lat, lon) {
  const url = `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&lang=pl&appid=${API_KEY}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return await response.json();
}

// Wyświetlanie pogody dla aktualnej lokalizacji
function displayCurrentWeather(data) {
  const currentWeatherElement = document.getElementById('current-weather');
  
  // Formatowanie daty
  const date = new Date();
  const dateString = date.toLocaleDateString('pl-PL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  currentWeatherElement.innerHTML = `
    <div class="current-location">
      <h3>${data.name}, ${data.sys.country}</h3>
      <p class="date">${dateString}</p>
    </div>
    
    <div class="weather-info">
      <div class="temperature">
        <span class="temp-value">${Math.round(data.main.temp)}°C</span>
        <span class="temp-feels-like">Odczuwalna: ${Math.round(data.main.feels_like)}°C</span>
      </div>
      
      <div class="weather-description">
        <img src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png" alt="${data.weather[0].description}">
        <p>${data.weather[0].description}</p>
      </div>
      
      <div class="weather-details">
        <p><i class="weather-icon humidity"></i> Wilgotność: ${data.main.humidity}%</p>
        <p><i class="weather-icon wind"></i> Wiatr: ${data.wind.speed} m/s</p>
        <p><i class="weather-icon pressure"></i> Ciśnienie: ${data.main.pressure} hPa</p>
      </div>
    </div>
  `;
}

// Wyświetlanie pogody dla zapisanej lokalizacji
function displayLocationWeather(container, data) {
  container.innerHTML = `
    <div class="weather-compact">
      <div class="temperature">
        <span class="temp-value">${Math.round(data.main.temp)}°C</span>
      </div>
      
      <div class="weather-description">
        <img src="https://openweathermap.org/img/wn/${data.weather[0].icon}.png" alt="${data.weather[0].description}">
        <p>${data.weather[0].description}</p>
      </div>
      
      <div class="weather-details-compact">
        <p>Wilgotność: ${data.main.humidity}%</p>
        <p>Wiatr: ${data.wind.speed} m/s</p>
      </div>
    </div>
  `;
}

// Funkcja wyświetlająca prognozę na 5 dni
function displayForecastWeather(data, container) {
  // Czyszczenie kontenera
  container.innerHTML = '';
  
  // OpenWeatherMap zwraca dane co 3 godziny, wybieramy jedną prognozę na dzień (o 12:00)
  const forecastByDay = {};
  
  data.list.forEach(item => {
    const date = new Date(item.dt * 1000);
    const day = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Wybieramy tylko dane z godziny 12:00 lub zapisujemy pierwszy dostępny wpis dla danego dnia
    if (!forecastByDay[day] || date.getHours() === 12) {
      forecastByDay[day] = item;
    }
  });
  
  // Ograniczamy do 5 dni
  const days = Object.keys(forecastByDay).slice(0, 5);
  
  // Sprawdzamy czy mamy wystarczająco danych
  if (days.length === 0) {
    container.innerHTML = '<p>Brak danych prognozy.</p>';
    return;
  }
  
  // Tworzymy element dla każdego dnia
  days.forEach(day => {
    const forecast = forecastByDay[day];
    const date = new Date(forecast.dt * 1000);
    
    // Formatowanie dnia tygodnia
    const dayName = date.toLocaleDateString('pl-PL', { weekday: 'long' });
    const dayMonth = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
    
    const forecastElement = document.createElement('div');
    forecastElement.className = 'forecast-day';
    forecastElement.innerHTML = `
      <div class="forecast-date">
        <h3>${dayName}</h3>
        <p>${dayMonth}</p>
      </div>
      <div class="forecast-icon">
        <img src="https://openweathermap.org/img/wn/${forecast.weather[0].icon}@2x.png" alt="${forecast.weather[0].description}">
      </div>
      <div class="forecast-temp">
        <p class="temp-max">${Math.round(forecast.main.temp_max)}°C</p>
        <p class="temp-min">${Math.round(forecast.main.temp_min)}°C</p>
      </div>
      <div class="forecast-desc">
        <p>${forecast.weather[0].description}</p>
      </div>
    `;
    
    container.appendChild(forecastElement);
  });
}

// Załadowanie danych kiedy strona się ładuje
document.addEventListener('DOMContentLoaded', () => {
  // Sprawdzamy czy jesteśmy na stronie głównej
  if (document.getElementById('current-weather') && document.getElementById('favorite-locations')) {
    getCurrentLocationWeather();
//    getSavedLocationsWeather();
  }
});