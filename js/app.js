// Sprawdzanie połączenia internetowego
function checkOnlineStatus() {
  const offlineMessage = document.getElementById('offline-message');
  
  function updateOnlineStatus() {
    if (navigator.onLine) {
      offlineMessage.classList.add('hidden');
    } else {
      offlineMessage.classList.remove('hidden');
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

// Obsługa przełączania motywów
function setupThemeToggle() {
  const themeButton = document.getElementById('theme-button');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  
  // Ustawienie początkowego motywu
  function setInitialTheme() {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeButton.textContent = '☀️';
    } else if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      themeButton.textContent = '🌙';
    } else if (prefersDarkScheme.matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeButton.textContent = '☀️';
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      themeButton.textContent = '🌙';
    }
  }
  
  // Przełączanie motywu
  themeButton.addEventListener('click', () => {
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
      themeButton.textContent = '🌙';
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      themeButton.textContent = '☀️';
    }
  });
  
  // Nasłuchiwanie zmian preferencji systemowych
  prefersDarkScheme.addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      if (e.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeButton.textContent = '☀️';
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeButton.textContent = '🌙';
      }
    }
  });
  
  setInitialTheme();
}

// Globalny dostęp do dbPromise
window.dbPromise = null;

// Inicjalizacja bazy danych
async function initDatabase() {
  if (window.dbPromise) return window.dbPromise;
  
  try {
    window.dbPromise = await idb.openDB('weather-app-db', 1, {
      upgrade(db) {
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
    
    return window.dbPromise;
  } catch (error) {
    console.error('Błąd inicjalizacji bazy danych:', error);
    throw error;
  }
}

function initApp() {
  // Add status listeners
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Check online status
  updateOnlineStatus();
  
  // Initialize theme toggle
  initThemeToggle();
  
  // Load weather if on main page
  if (document.getElementById('current-weather')) {
    getCurrentLocationWeather();
    loadFavoriteLocations();
  }
}

// Helper do pobierania zapisanych lokalizacji
async function getSavedLocations() {
  const db = await initDatabase();
  return db.transaction('locations').objectStore('locations').getAll();
}

// Helper do dodawania lokalizacji
async function addLocation(locationData) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['locations'], 'readwrite');
    const objectStore = transaction.objectStore('locations');
    const request = objectStore.add(locationData);
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Helper do usuwania lokalizacji
async function deleteLocation(locationId) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['locations'], 'readwrite');
    const objectStore = transaction.objectStore('locations');
    const request = objectStore.delete(locationId);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Helper do zapisywania danych pogodowych w cache
async function saveWeatherToCache(locationId, weatherData) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['weatherCache'], 'readwrite');
    const objectStore = transaction.objectStore('weatherCache');
    
    const data = {
      locationId,
      weatherData,
      timestamp: new Date().getTime()
    };
    
    const request = objectStore.put(data);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Helper do pobierania danych pogodowych z cache
async function getWeatherFromCache(locationId) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['weatherCache'], 'readonly');
    const objectStore = transaction.objectStore('weatherCache');
    const request = objectStore.get(locationId);
    
    request.onsuccess = () => {
      if (request.result) {
        // Sprawdź czy dane nie są starsze niż 3 godziny
        const now = new Date().getTime();
        const dataAge = now - request.result.timestamp;
        
        if (dataAge < 3 * 60 * 60 * 1000) {
          resolve(request.result.weatherData);
        } else {
          resolve(null); // Dane są zbyt stare
        }
      } else {
        resolve(null); // Brak danych w cache
      }
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Helper do czyszczenia cache
async function clearWeatherCache() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['weatherCache'], 'readwrite');
    const objectStore = transaction.objectStore('weatherCache');
    const request = objectStore.clear();
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Helper do czyszczenia zapisanych lokalizacji
async function clearSavedLocations() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['locations'], 'readwrite');
    const objectStore = transaction.objectStore('locations');
    const request = objectStore.clear();
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Wywołanie inicjalizacji przy starcie
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Inicjalizacja bazy danych
    await initDatabase();
    
    // Sprawdzenie czy jesteśmy na stronie głównej 
    if (document.getElementById('current-weather')) {
      getCurrentLocationWeather();
      loadFavoriteLocations();
    }
    
    // Inicjalizacja przełącznika motywu
    setupThemeToggle();
    
    // Sprawdzenie statusu online/offline
    checkOnlineStatus();
    
  } catch (err) {
    console.error('Nie udało się zainicjować aplikacji:', err);
  }
});

function updateOnlineStatus() {
  const offlineMessage = document.getElementById('offline-message');
  if (offlineMessage) {
    if (navigator.onLine) {
      offlineMessage.classList.add('hidden');
    } else {
      offlineMessage.classList.remove('hidden');
    }
  }
}