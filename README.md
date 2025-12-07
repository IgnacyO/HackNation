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

**Zainstaluj zależności Python**:
```bash
pip install -r requirements.txt
```

**Uwaga:** Na systemach Linux/Mac może być konieczne użycie `pip3` zamiast `pip`.

**Uwaga dla użytkowników Windows PowerShell:** Jeśli podczas uruchamiania komend pojawia się błąd związany z Execution Policy, zobacz sekcję "Rozwiązywanie problemów" poniżej.

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

1. **Uruchom API** (z katalogu głównego projektu):
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

1. **Otwórz nowy terminal**

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
# 1. Zainstaluj zależności Python
pip install -r requirements.txt

# 2. Zainstaluj zależności Node.js
cd frontend
npm install
cd ..

# 3. Terminal 1 - Uruchom backend
python run_api.py

# 4. Terminal 2 - Uruchom frontend (w nowym terminalu)
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
**Rozwiązanie:** Upewnij się, że zależności są zainstalowane:
```bash
pip install -r requirements.txt
```

**Uwaga:** Na systemach Linux/Mac może być konieczne użycie `pip3` zamiast `pip`.

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

### Problem: Błędy związane z SQLAlchemy
**Rozwiązanie:** Jeśli pojawiają się błędy związane z SQLAlchemy (np. import errors, deprecated warnings, lub problemy z połączeniem do bazy danych), warto zaktualizować SQLAlchemy do najnowszej wersji:
```bash
pip install --upgrade SQLAlchemy
```

### Problem: PowerShell blokuje wykonywanie skryptów (Execution Policy)
**Rozwiązanie:** Jeśli podczas uruchamiania komend w PowerShell pojawia się błąd typu "running scripts is disabled on this system", musisz zmienić Execution Policy.

**Opcja 1 - Tymczasowo dla bieżącej sesji (zalecane):**
Uruchom PowerShell jako administrator i wykonaj:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

**Opcja 2 - Trwale dla Twojego konta użytkownika:**
Uruchom PowerShell jako administrator i wykonaj:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Opcja 3 - Bypass dla pojedynczego skryptu:**
Możesz uruchomić komendy z pominięciem Execution Policy:
```powershell
powershell -ExecutionPolicy Bypass -Command "pip install -r requirements.txt"
```

**Opcja 4 - Użyj Command Prompt (CMD) zamiast PowerShell:**
W CMD nie ma problemu z Execution Policy, możesz używać standardowych komend:
```cmd
pip install -r requirements.txt
python run_api.py
```

## Uwagi

- Symulator danych automatycznie tworzy przykładowych strażaków i beacony przy pierwszym uruchomieniu
- Dane są aktualizowane co 1.5 sekundy
- Baza danych SQLite jest tworzona automatycznie w katalogu `database/`
- Wszyscy strażacy są domyślnie ustawieni jako aktywni w misji (`on_mission = True`)
- Skaner RFID dostępny jest w widoku mapy (lewy górny róg) - można użyć trybu "Ręczne" do testowania bez portu COM

## Struktura portów

- **Backend API**: `http://localhost:5000`
- **Frontend (Vite)**: `http://localhost:5173` (domyślnie, może się zmienić jeśli port jest zajęty)

