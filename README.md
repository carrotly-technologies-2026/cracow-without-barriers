# Kraków bez barier

Mapa i planer tras dla osób na wózkach i rodziców z wózkami dziecięcymi. Zamiast „dostępne / niedostępne” pokazuje konkretne bariery (schody, krawężniki, nawierzchnia, nachylenie, szerokość, ławki, toalety), a przy każdej informacji jej **źródło, datę i poziom wiarygodności**. Brak danych nigdy nie jest pokazywany jako dostępność.

Demo: https://cracow.rabbithole.carrotly.tech

## Stack

Next.js 16 (App Router, route handlers jako API), React 19, TypeScript, Tailwind 4, MapLibre GL, Vitest. Brak bazy danych i zewnętrznych kluczy API.

## Jak to działa

- **Dane:** tiles OpenStreetMap pobierane z Overpass, z cache na dysku i w pamięci. W obrazie jest też zapis tiles dla centrum Krakowa, więc aplikacja działa, gdy źródło jest niedostępne.
- **Ocena:** trasa jest dopasowywana do odcinków i węzłów OSM, a bariery są oceniane według preferencji użytkownika (wózek ręczny, elektryczny, dziecięcy, chodzik lub własne ustawienia). Wynik to ocena 0–100, pokrycie danymi i werdykt.
- **Trasy:** OSRM (profil pieszy) oraz objazdy wokół wykrytych przeszkód; wybierany jest najlepszy wariant, a obok pokazywane są najkrótszy i alternatywy.
- **Wiarygodność:** każdy fakt ma źródło, datę i poziom (potwierdzone / prawdopodobne / niezweryfikowane / brak danych). Sprzeczne źródła są pokazywane obok siebie. Zgłoszenie jednej osoby jest niezweryfikowane, a po potwierdzeniu przez drugą staje się prawdopodobne.
- **Miejsca:** 12 prawdziwych lokali ze Starego Miasta z tagami dostępności z OSM.
- **Dane przykładowe:** zgłoszenia pokazujące konflikt i dane niezweryfikowane są wyraźnie oznaczone „DANE PRZYKŁADOWE”.

Warstwa danych jest oddzielona od interfejsu, a kolejne miasto dodaje się jednym wpisem w konfiguracji.

## Uruchomienie lokalnie

```bash
cd app
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # testy jednostkowe oceny barier
pnpm typecheck
```

Docker (z własnym OSRM, pierwszy start ok. 4 min): `docker compose up --build`.

Zmienne środowiskowe (wszystkie opcjonalne): `ROUTER_URL` (lista OSRM po przecinku), `PHOTON_URL`, `OVERPASS_URLS`, `OSM_TTL_DAYS`, `FORCE_OSM_OFFLINE=1`, `CACHE_DIR`, `REPORTS_FILE`.

## Dostępność cyfrowa i prywatność

Interfejs zaprojektowany pod obsługę klawiaturą i czytnikiem ekranu (ARIA, tekstowy odpowiednik mapy, ikony i tekst zamiast samego koloru) i sprawdzany automatycznie narzędziem axe pod kątem WCAG 2.2 AA. Brak kont: preferencje zostają w przeglądarce, a zgłoszenia są anonimowe.
