# Locero - Firefighter Tracking System

System monitorowania strażaków w czasie rzeczywistym z wykorzystaniem React + Vite (frontend) i Flask + SQLAlchemy (backend).

## Zaimplementowane funkcje
- Wizualizacja mapy 2D budynku z pozycjami strażaków
- Wskaźnik kondygnacji (piętro) dla każdego strażaka
- Panel parametrów: tętno, bateria, stan ruchu
- Alarm MAN-DOWN po 30s bezruchu
- Status beaconów na mapie
- Lista strażaków z możliwością filtrowania (ID, imię, zespół, status, bateria) i szybkiego przejścia do widoku na mapie
- Ekran szczegółów strażaka z ostatnimi alertami, trendem tętna i poziomu baterii oraz informacją o ostatniej pozycji i czasie kontaktu
- Podstawowy widok aktywnych alertów
- koncepcja działania w środowisku bez GPS/GSM

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

### Backend

1. Zainstaluj zależności Python:
```bash
pip install -r requirements.txt
```

2. Uruchom API (automatycznie inicjalizuje bazę danych i uruchamia symulator):

**Opcja 1** - Z katalogu głównego (zalecane):
```bash
python run_api.py
```

**Opcja 2** - Z katalogu api:
```bash
cd api
python app.py
```

API będzie dostępne pod adresem: `http://localhost:5000`

### Frontend

1. Zainstaluj zależności:
```bash
cd frontend
npm install
```

2. Uruchom serwer deweloperski:
```bash
npm run dev
```

Frontend będzie dostępny pod adresem: `http://localhost:3000`

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

## Uruchomienie

1. **Terminal 1** - Backend:
```bash
python run_api.py
```
(lub `cd api && python app.py`)

2. **Terminal 2** - Frontend:
```bash
cd frontend
npm run dev
```

3. Otwórz przeglądarkę: `http://localhost:3000`

## Uwagi

- Symulator danych automatycznie tworzy przykładowych strażaków i beacony przy pierwszym uruchomieniu
- Dane są aktualizowane co 1.5 sekundy
- Baza danych SQLite jest tworzona automatycznie w katalogu `database/`

