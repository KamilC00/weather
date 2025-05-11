// Funkcja inicjalizująca motyw przy ładowaniu strony
function initTheme() {
  const themeButton = document.getElementById('theme-button');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  
  // Ustawienie początkowego motywu
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
  
  // Przełączanie motywu po kliknięciu przycisku
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
    
    // Aktualizacja podświetlenia przycisków motywu
    highlightCurrentTheme();
  });
}

// Zmodyfikuj istniejącą funkcję inicjalizującą stronę ustawień
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Najpierw inicjalizuj bazę danych
    await initDatabase();
    
    // Inicjalizacja motywu
    initTheme();
    
    // Sprawdzamy czy jesteśmy na stronie ustawień
    if (document.getElementById('clear-cache') && document.getElementById('clear-favorites')) {
      // Inicjalizacja przycisków
      initSettingsButtons();
      
      // Obliczanie i wyświetlanie rozmiaru przechowywanych danych
      calculateStorageUsage();
      
      // Podświetlenie aktualnego motywu w ustawieniach
      highlightCurrentTheme();
    }
  } catch (error) {
    console.error('Błąd podczas inicjalizacji strony ustawień:', error);
  }
});

// Funkcja inicjalizująca przyciski
function initSettingsButtons() {
  // Przycisk czyszczenia cache
  const clearCacheButton = document.getElementById('clear-cache');
  clearCacheButton.addEventListener('click', async () => {
    if (confirm('Czy na pewno chcesz wyczyścić cache pogodowe? Spowoduje to ponowne pobieranie danych przy kolejnych wizytach.')) {
      try {
        // Upewnij się, że baza danych jest zainicjalizowana
        await initDatabase();
        
        await clearWeatherCache();
        alert('Cache pogodowe zostało wyczyszczone.');
        calculateStorageUsage(); // Aktualizacja informacji o rozmiarze danych
      } catch (error) {
        alert(`Błąd podczas czyszczenia cache: ${error.message}`);
        console.error('Błąd podczas czyszczenia cache:', error);
      }
    }
  });
  
  // Przycisk czyszczenia ulubionych lokalizacji
  const clearFavoritesButton = document.getElementById('clear-favorites');
  clearFavoritesButton.addEventListener('click', async () => {
    if (confirm('Czy na pewno chcesz usunąć wszystkie ulubione lokalizacje? Ta operacja jest nieodwracalna.')) {
      try {
        // Upewnij się, że baza danych jest zainicjalizowana
        await initDatabase();
        
        await clearSavedLocations();
        alert('Wszystkie ulubione lokalizacje zostały usunięte.');
        calculateStorageUsage(); // Aktualizacja informacji o rozmiarze danych
      } catch (error) {
        alert(`Błąd podczas usuwania lokalizacji: ${error.message}`);
        console.error('Błąd podczas usuwania lokalizacji:', error);
      }
    }
  });
  
  // Przyciski motywów
  const themeLightButton = document.getElementById('theme-light');
  const themeDarkButton = document.getElementById('theme-dark');
  const themeSystemButton = document.getElementById('theme-system');
  
  themeLightButton.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('theme', 'light');
    highlightCurrentTheme();
  });
  
  themeDarkButton.addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
    highlightCurrentTheme();
  });
  
  themeSystemButton.addEventListener('click', () => {
    localStorage.removeItem('theme');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    
    if (prefersDarkScheme.matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    highlightCurrentTheme();
  });
}

// Funkcja obliczająca rozmiar przechowywanych danych
async function calculateStorageUsage() {
  const storageUsageElement = document.getElementById('storage-usage');
  
  try {
    // Upewnij się, że baza danych jest zainicjalizowana
    await initDatabase();
    
    // Otrzymujemy szacunkowy rozmiar bazy danych
    const db = await dbPromise;
    
    // Pobieramy wszystkie dane z bazy
    const locationsTx = db.transaction(['locations'], 'readonly');
    const locationsStore = locationsTx.objectStore('locations');
    const locations = await locationsStore.getAll();
    
    const weatherTx = db.transaction(['weatherCache'], 'readonly');
    const weatherStore = weatherTx.objectStore('weatherCache');
    const weatherData = await weatherStore.getAll();
    
    // Obliczamy przybliżony rozmiar w KB
    const locationsSize = JSON.stringify(locations).length / 1024;
    const weatherSize = JSON.stringify(weatherData).length / 1024;
    const totalSize = locationsSize + weatherSize;
    
    // Wyświetlamy
    if (totalSize < 1) {
      storageUsageElement.textContent = `${(totalSize * 1024).toFixed(2)} B`;
    } else if (totalSize > 1024) {
      storageUsageElement.textContent = `${(totalSize / 1024).toFixed(2)} MB`;
    } else {
      storageUsageElement.textContent = `${totalSize.toFixed(2)} KB`;
    }
    
  } catch (error) {
    storageUsageElement.textContent = 'Nie udało się obliczyć';
    console.error('Błąd podczas obliczania rozmiaru danych:', error);
  }
}

// Zaznaczenie aktualnie używanego motywu
function highlightCurrentTheme() {
  const themeLightButton = document.getElementById('theme-light');
  const themeDarkButton = document.getElementById('theme-dark');
  const themeSystemButton = document.getElementById('theme-system');
  
  // Usuń klasę active ze wszystkich przycisków
  themeLightButton.classList.remove('active');
  themeDarkButton.classList.remove('active');
  themeSystemButton.classList.remove('active');
  
  // Sprawdź aktualny motyw
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme === 'light') {
    themeLightButton.classList.add('active');
  } else if (savedTheme === 'dark') {
    themeDarkButton.classList.add('active');
  } else {
    themeSystemButton.classList.add('active');
  }
}

// Eksportowanie danych (dodatkowa funkcja)
function exportUserData() {
  // Ta funkcja mogłaby generować plik JSON z danymi użytkownika
  // do pobrania, zawierający zapisane lokalizacje
}

// Importowanie danych (dodatkowa funkcja)
function importUserData(jsonData) {
  // Ta funkcja mogłaby importować dane użytkownika z pliku JSON
}

// Funkcja sprawdzająca wersję aplikacji i aktualizująca bazę danych w razie potrzeby
async function checkAppVersion() {
  const currentVersion = '1.0.0'; // Aktualna wersja aplikacji
  const savedVersion = localStorage.getItem('appVersion');
  
  if (savedVersion !== currentVersion) {
    try {
      // Tu możemy wykonać operacje migracji jeśli potrzebne
      
      // Zapisanie aktualnej wersji
      localStorage.setItem('appVersion', currentVersion);
      console.log(`Aplikacja zaktualizowana do wersji ${currentVersion}`);
    } catch (error) {
      console.error('Błąd podczas aktualizacji aplikacji:', error);
    }
  }
}

// Inicjalizacja dodatkowych funkcji podczas ładowania strony
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.theme-settings')) {
    highlightCurrentTheme();
    checkAppVersion();
  }
});