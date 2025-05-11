const API_KEY = 'f1c00ff915da831f1b9fe350fb589348';
// Funkcja inicjalizująca stronę lokalizacji
document.addEventListener('DOMContentLoaded', () => {
  // Sprawdzamy czy jesteśmy na stronie lokalizacji
  if (document.getElementById('add-location-form') && document.getElementById('locations-list')) {
    // Inicjalizacja formularza dodawania lokalizacji
    initAddLocationForm();
    
    // Wczytanie zapisanych lokalizacji
    loadSavedLocations();
  }
});

// Inicjalizacja formularza dodawania lokalizacji
function initAddLocationForm() {
  const form = document.getElementById('add-location-form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const locationNameInput = document.getElementById('location-name');
    const locationName = locationNameInput.value.trim();
    
    if (!locationName) {
      alert('Wprowadź nazwę lokalizacji');
      return;
    }
    
    try {
      // Znajdź współrzędne na podstawie nazwy lokalizacji
      const coordinates = await getCoordinatesForLocation(locationName);
      
      if (!coordinates) {
        alert('Nie znaleziono podanej lokalizacji. Sprawdź nazwę i spróbuj ponownie.');
        return;
      }
      
      // Dodaj lokalizację do bazy danych
      const locationData = {
        name: locationName,
        lat: coordinates.lat,
        lon: coordinates.lon,
        addedAt: new Date().getTime()
      };
      
      await addLocation(locationData);
      
      // Wyczyść formularz
      locationNameInput.value = '';
      
      // Odśwież listę lokalizacji
      loadSavedLocations();
      
    } catch (error) {
      alert(`Błąd podczas dodawania lokalizacji: ${error.message}`);
    }
  });
}

// Funkcja wyszukująca współrzędne lokalizacji na podstawie nazwy
async function getCoordinatesForLocation(locationName) {
  try {
    // Używamy API OpenWeatherMap do geokodowania
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationName)}&limit=1&appid=${API_KEY}`;
    console.log(url)
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.length === 0) {
      return null;
    }
    
    return {
      lat: data[0].lat,
      lon: data[0].lon
    };
    
  } catch (error) {
    console.error('Błąd podczas wyszukiwania lokalizacji:', error);
    throw error;
  }
}

// Funkcja ładująca zapisane lokalizacje
async function loadSavedLocations() {
  const locationsListElement = document.getElementById('locations-list');
  
  try {
    const locations = await getSavedLocations();
    
    if (locations.length === 0) {
      locationsListElement.innerHTML = '<p>Nie masz jeszcze zapisanych lokalizacji.</p>';
      return;
    }
    
    // Czyścimy kontener
    locationsListElement.innerHTML = '';
    
    // Sortujemy lokalizacje alfabetycznie
    locations.sort((a, b) => a.name.localeCompare(b.name));
    
    // Dla każdej lokalizacji tworzymy element
    locations.forEach(location => {
      const locationElement = document.createElement('div');
      locationElement.className = 'location-item';
      locationElement.innerHTML = `
        <div class="location-info">
          <h3>${location.name}</h3>
          <p>Dodano: ${new Date(location.addedAt).toLocaleDateString('pl-PL')}</p>
        </div>
        <div class="location-actions">
          <button class="btn warning location-delete" data-id="${location.id}">
            Usuń
          </button>
        </div>
      `;
      
      locationsListElement.appendChild(locationElement);
    });
    
    // Dodajemy nasłuchiwanie na przyciski
    addLocationButtonsListeners();
    
  } catch (error) {
    locationsListElement.innerHTML = `
      <div class="error-message">
        <p>Błąd podczas wczytywania lokalizacji: ${error.message}</p>
      </div>
    `;
    console.error('Błąd podczas wczytywania lokalizacji:', error);
  }
}

// Funkcja pobierająca zapisane lokalizacje
async function getSavedLocations() {
  try {
    // Upewnij się, że baza danych jest dostępna
    const db = await initDatabase();
    
    if (!db) {
      throw new Error('Baza danych nie jest dostępna');
    }
    
    // Pobierz wszystkie lokalizacje
    const tx = db.transaction('locations', 'readonly');
    const store = tx.objectStore('locations');
    const locations = await store.getAll();
    
    return locations;
  } catch (error) {
    console.error('Błąd podczas pobierania lokalizacji:', error);
    throw error;
  }
}

// Funkcja dodająca lokalizację 
async function addLocation(locationData) {
  try {
    // Upewnij się, że baza danych jest dostępna
    const db = await initDatabase();
    
    if (!db) {
      throw new Error('Baza danych nie jest dostępna');
    }
    
    // Dodaj lokalizację do bazy
    const tx = db.transaction('locations', 'readwrite');
    const store = tx.objectStore('locations');
    
    const id = await store.add(locationData);
    await tx.complete;
    
    console.log('Lokalizacja dodana pomyślnie:', id);
    return id;
  } catch (error) {
    console.error('Błąd podczas dodawania lokalizacji:', error);
    throw error;
  }
}

// Funkcja usuwająca lokalizację
async function deleteLocation(locationId) {
  try {
    // Upewnij się, że baza danych jest dostępna
    const db = await initDatabase();
    
    if (!db) {
      throw new Error('Baza danych nie jest dostępna');
    }
    
    // Usuń lokalizację z bazy
    const tx = db.transaction('locations', 'readwrite');
    const store = tx.objectStore('locations');
    
    await store.delete(locationId);
    await tx.complete;
    
    console.log('Lokalizacja usunięta pomyślnie');
    return true;
  } catch (error) {
    console.error('Błąd podczas usuwania lokalizacji:', error);
    throw error;
  }
}

// Funkcja dodająca nasłuchiwacze do przycisków
function addLocationButtonsListeners() {
  // Przyciski usuwania lokalizacji
  const deleteButtons = document.querySelectorAll('.location-delete');
  deleteButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const locationId = parseInt(button.getAttribute('data-id'));
      
      if (confirm('Czy na pewno chcesz usunąć tę lokalizację?')) {
        try {
          await deleteLocation(locationId);
          loadSavedLocations(); // Odświeżenie listy
        } catch (error) {
          alert(`Błąd podczas usuwania lokalizacji: ${error.message}`);
        }
      }
    });
  });
  
  // Przyciski podglądu pogody
  const viewButtons = document.querySelectorAll('.location-view');
  viewButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const locationId = parseInt(button.getAttribute('data-id'));
      
      try {
        // Pobieramy dane lokalizacji
        const db = await dbPromise;
        const transaction = db.transaction(['locations'], 'readonly');
        const store = transaction.objectStore('locations');
        const location = await store.get(locationId);
        
        if (!location) {
          throw new Error('Nie znaleziono lokalizacji');
        }
        
        // Tworzymy modal z pogodą
        createWeatherModal(location);
        
      } catch (error) {
        alert(`Błąd podczas wyświetlania pogody: ${error.message}`);
      }
    });
  });
}

// Tworzenie modalu z pogodą
async function createWeatherModal(location) {
  // Tworzymy element modalu
  const modal = document.createElement('div');
  modal.className = 'weather-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2>Pogoda dla ${location.name}</h2>
        <button class="close-modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="loading">Pobieranie danych pogodowych...</div>
      </div>
    </div>
  `;
  
  // Dodajemy modal do body
  document.body.appendChild(modal);
  
  // Nasłuchiwacz na przycisk zamykania
  modal.querySelector('.close-modal').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  // Nasłuchiwacz na kliknięcie poza modalem
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
  
  // Pobieranie danych pogodowych
  try {
    // Najpierw sprawdzamy cache
    let weatherData = await getWeatherFromCache(location.id);
    
    if (!weatherData && navigator.onLine) {
      // Jeśli nie ma w cache i jest połączenie, pobieramy nowe dane
      weatherData = await fetchWeatherData(location.lat, location.lon);
      await saveWeatherToCache(location.id, weatherData);
    }
    
    const modalBody = modal.querySelector('.modal-body');
    
    if (weatherData) {
      // Formatowanie daty ostatniej aktualizacji
      const updateTime = new Date();
      const updateTimeString = updateTime.toLocaleTimeString('pl-PL');
      
      modalBody.innerHTML = `
        <div class="weather-detail">
          <div class="weather-header">
            <div class="temperature">
              <span class="temp-value">${Math.round(weatherData.main.temp)}°C</span>
              <span class="temp-feels-like">Odczuwalna: ${Math.round(weatherData.main.feels_like)}°C</span>
            </div>
            
            <div class="weather-description">
              <img src="https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png" alt="${weatherData.weather[0].description}">
              <p>${weatherData.weather[0].description}</p>
            </div>
          </div>
          
          <div class="weather-details">
            <p><strong>Wilgotność:</strong> ${weatherData.main.humidity}%</p>
            <p><strong>Wiatr:</strong> ${weatherData.wind.speed} m/s</p>
            <p><strong>Ciśnienie:</strong> ${weatherData.main.pressure} hPa</p>
            <p><strong>Widoczność:</strong> ${weatherData.visibility / 1000} km</p>
          </div>
          
          <div class="weather-update-time">
            <p>Ostatnia aktualizacja: ${updateTimeString}</p>
          </div>
        </div>
      `;
    } else {
      modalBody.innerHTML = `
        <div class="error-message">
          <p>Nie udało się pobrać danych pogodowych. Sprawdź połączenie internetowe.</p>
        </div>
      `;
    }
    
  } catch (error) {
    modal.querySelector('.modal-body').innerHTML = `
      <div class="error-message">
        <p>Błąd podczas pobierania danych pogodowych: ${error.message}</p>
      </div>
    `;
  }
}

// Funkcja dodająca lokalizację do ulubionych
async function addToFavorites(location) {
  try {
    // Upewnij się, że baza danych jest zainicjowana
    const db = await initDatabase();
    
    if (!db) {
      throw new Error('Baza danych nie jest dostępna');
    }
    
    // Teraz wykonaj transakcję
    const tx = db.transaction('locations', 'readwrite');
    const store = tx.objectStore('locations');
    
    // Dodaj lokalizację do bazy
    await store.add(location);
    await tx.complete;
    
    // Odśwież listę ulubionych lokalizacji (jeśli taka funkcja istnieje)
    if (typeof loadFavoriteLocations === 'function') {
      await loadFavoriteLocations();
    }
    
    return true;
  } catch (error) {
    console.error('Błąd podczas dodawania lokalizacji:', error);
    throw error;
  }
}