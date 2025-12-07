# Locero - Firefighter Tracking System

System monitorowania strażaków w czasie rzeczywistym z wykorzystaniem React + Vite (frontend) i Flask + SQLAlchemy (backend).

## Zaimplementowane funkcjonalności
- Wizualizacja mapy 2D budynku z pozycjami strażaków
- Wskaźnik kondygnacji (piętro) dla każdego strażaka
- Panel parametrów: tętno, bateria, stan ruchu
- Alarm MAN-DOWN po 30s bezruchu
- Status beaconów na mapie
- Lista strażaków z możliwością filtrowania (ID, imię, zespół, status, bateria) i szybkiego przejścia do widoku na mapie
- Ekran szczegółów strażaka z ostatnimi alertami, trendem tętna i poziomu baterii oraz informacją o ostatniej pozycji i czasie kontaktu
- Podstawowy widok aktywnych alertów
- koncepcja działania w środowisku bez GPS/GSM
- Widok zarządzania zespołami
- Symulacja czarnej skrzynki
- Voice alerts

## Architektura

- **Backend**: Python Flask + SQLAlchemy + SQLite
- **Frontend**: React + Vite + Leaflet + Chart.js
- **Symulator danych**: Python script generujący dane w czasie rzeczywistym

## Struktura projektu

```
Locero/
├── backend/           # Modele bazy danych i symulator
│   ├── models.py      # Modele SQLAlchemy
│   ├── database.py    # Konfiguracja bazy danych
│   └── data_simulator.py  # Symulator danych
├── api/               # Flask REST API
│   └── app.py         # Główny plik API
├── frontend/          # React + Vite aplikacja
│   ├── src/
│   │   ├── components/  # Komponenty React
│   │   ├── utils/       # Narzędzia (API client)
│   │   ├── App.jsx      # Główny komponent
│   │   └── main.jsx     # Entry point
│   ├── package.json
│   └── vite.config.js
├── database/          # Baza danych SQLite (tworzona automatycznie)
└── requirements.txt   # Zależności Python
```

## Instalacja

### Wymagania

- Python 3.8+
- Node.js 18+ (z npm)
- npm lub yarn

### Krok 1: Przygotowanie środowiska Python (Backend)

1. **Utwórz wirtualne środowisko Python** (zalecane):

**Windows:**
```bash
python -m venv venv
```

**Linux/Mac:**
```bash
python3 -m venv venv
```

2. **Aktywuj wirtualne środowisko**:

**Windows (PowerShell):**
```bash
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```bash
venv\Scripts\activate.bat
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

Po aktywacji w terminalu powinno pojawić się `(venv)` przed ścieżką.

3. **Zainstaluj zależności Python**:
```bash
pip install -r requirements.txt
```

### Krok 2: Przygotowanie Frontend

1. **Przejdź do katalogu frontend**:
```bash
cd frontend
```

2. **Zainstaluj zależności Node.js**:
```bash
npm install
```

3. **Wróć do katalogu głównego**:
```bash
cd ..
```

### Krok 3: Uruchomienie aplikacji

Aplikacja wymaga uruchomienia dwóch serwerów jednocześnie:

#### Terminal 1 - Backend (API)

1. **Upewnij się, że venv jest aktywne** (powinno być `(venv)` w terminalu)

2. **Uruchom API** (z katalogu głównego projektu):
```bash
python run_api.py
```

**Alternatywnie** (z katalogu api):
```bash
cd api
python app.py
```

API będzie dostępne pod adresem: `http://localhost:5000`

**Ważne:** Nie zamykaj tego terminala! API musi działać w tle.

#### Terminal 2 - Frontend

1. **Otwórz nowy terminal** (venv nie jest potrzebne dla frontendu)

2. **Przejdź do katalogu frontend**:
```bash
cd frontend
```

3. **Uruchom serwer deweloperski**:
```bash
npm run dev
```

Frontend będzie dostępny pod adresem: `http://localhost:5173` (lub inny port, jeśli 5173 jest zajęty)

**Ważne:** Nie zamykaj tego terminala! Frontend musi działać w tle.

### Krok 4: Otwarcie aplikacji

1. Otwórz przeglądarkę
2. Przejdź do adresu wyświetlonego w terminalu frontendu (zwykle `http://localhost:5173`)

## Szybki start (skrócona wersja)

```bash
# 1. Utwórz i aktywuj venv
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows PowerShell
# lub
venv\Scripts\activate.bat     # Windows CMD
# lub
source venv/bin/activate     # Linux/Mac

# 2. Zainstaluj zależności Python
pip install -r requirements.txt

# 3. Zainstaluj zależności Node.js
cd frontend
npm install
cd ..

# 4. Terminal 1 - Uruchom backend (z venv aktywnym)
python run_api.py

# 5. Terminal 2 - Uruchom frontend (w nowym terminalu)
cd frontend
npm run dev
```

## Funkcjonalności

- **Mapa w czasie rzeczywistym**: Wyświetlanie pozycji strażaków na mapie Leaflet
- **Monitorowanie życiowych parametrów**: Tętno, temperatura, poziom tlenu, CO, bateria, ciśnienie SCBA
- **System alertów**: Automatyczne generowanie alertów na podstawie parametrów
- **Beacony**: Wyświetlanie beaconów na mapie z filtrowaniem po piętrach
- **Historia pozycji**: Wizualizacja poprzednich pozycji strażaków
- **Wykres tętna**: Wykres ECG-like dla wybranego strażaka
- **Filtrowanie po piętrach**: Przełączanie między piętrami budynku

## API Endpoints

- `GET /api/firefighters` - Lista wszystkich strażaków z najnowszymi danymi
- `GET /api/firefighters/<id>/positions` - Historia pozycji strażaka
- `GET /api/firefighters/<id>/vitals` - Historia parametrów życiowych
- `GET /api/alerts` - Lista niepotwierdzonych alertów
- `GET /api/beacons?floor=<floor>` - Lista beaconów (opcjonalnie filtrowana po piętrze)
- `GET /api/building` - Informacje o budynku

## Typy alertów

- `man_down` (critical) - Bezruch >30s
- `sos_pressed` (critical) - Przycisk SOS
- `high_heart_rate` (warning) - Tętno >180 bpm
- `low_battery` (warning) - Bateria <20%
- `scba_low_pressure` (warning) - Niskie ciśnienie SCBA
- `scba_critical` (critical) - Krytyczne ciśnienie SCBA
- `beacon_offline` (warning) - Beacon nie odpowiada
- `tag_offline` (critical) - Tag strażaka offline
- `high_co` (critical) - Wysokie CO
- `low_oxygen` (critical) - Niski O2
- `explosive_gas` (critical) - Gaz wybuchowy (LEL)
- `high_temperature` (warning) - Wysoka temperatura

## Rozwiązywanie problemów

### Problem: "ModuleNotFoundError" lub "No module named 'flask'"
**Rozwiązanie:** Upewnij się, że venv jest aktywne i zależności są zainstalowane:
```bash
# Sprawdź czy venv jest aktywne (powinno być (venv) w terminalu)
# Jeśli nie, aktywuj ponownie:
.\venv\Scripts\Activate.ps1  # Windows PowerShell
# Następnie zainstaluj zależności:
pip install -r requirements.txt
```

### Problem: "Port 5000 already in use"
**Rozwiązanie:** Zamknij inne aplikacje używające portu 5000 lub zmień port w `run_api.py`:
```python
app.run(debug=True, port=5001)  # Zmień na inny port
```

### Problem: "Port 5173 already in use" (Vite)
**Rozwiązanie:** Vite automatycznie użyje następnego dostępnego portu. Sprawdź terminal frontendu, aby zobaczyć aktualny adres.

### Problem: "npm: command not found"
**Rozwiązanie:** Zainstaluj Node.js z https://nodejs.org/

### Problem: Baza danych nie jest tworzona
**Rozwiązanie:** Upewnij się, że katalog `database/` istnieje i ma uprawnienia do zapisu. Baza danych jest tworzona automatycznie przy pierwszym uruchomieniu API.

## Uwagi

- Symulator danych automatycznie tworzy przykładowych strażaków i beacony przy pierwszym uruchomieniu
- Dane są aktualizowane co 1.5 sekundy
- Baza danych SQLite jest tworzona automatycznie w katalogu `database/`
- Wszyscy strażacy są domyślnie ustawieni jako aktywni w misji (`on_mission = True`)
- Skaner RFID dostępny jest w widoku mapy (lewy górny róg) - można użyć trybu "Ręczne" do testowania bez portu COM

## Dezaktywacja venv

Po zakończeniu pracy, możesz dezaktywować wirtualne środowisko:
```bash
deactivate
```

## Struktura portów

- **Backend API**: `http://localhost:5000`
- **Frontend (Vite)**: `http://localhost:5173` (domyślnie, może się zmienić jeśli port jest zajęty)

