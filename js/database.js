// Inicjalizacja oraz zarządzanie bazą danych
let dbPromise = null;

// Funkcja inicjująca bazę danych
async function initDatabase() {
  if (dbPromise) return dbPromise;
  
  try {
    // Sprawdź czy mamy dostęp do IndexedDB
    if (!('indexedDB' in window)) {
      throw new Error('Twoja przeglądarka nie wspiera IndexedDB');
    }
    
    // Inicjalizacja bazy danych
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
    
    console.log('Baza danych zainicjalizowana pomyślnie');
    return dbPromise;
  } catch (error) {
    console.error('Błąd podczas inicjalizacji bazy danych:', error);
    throw error;
  }
}

// Eksportuj funkcje związane z bazą danych
window.initDatabase = initDatabase;