export interface City {
  id: string;
  name: string;
  center: [number, number]; // lon, lat
  zoom: number;
  bbox: [number, number, number, number]; // minLon,minLat,maxLon,maxLat
}
// Adding a city = adding an entry. All data comes from OSM / routing, nothing city-specific is hard-coded.
export const CITIES: City[] = [
  { id: 'krakow', name: 'Kraków', center: [19.9385, 50.0614], zoom: 14, bbox: [19.78, 49.95, 20.15, 50.13] },
  { id: 'wroclaw', name: 'Wrocław', center: [17.0385, 51.1079], zoom: 14, bbox: [16.8, 51.04, 17.2, 51.2] },
  { id: 'warszawa', name: 'Warszawa', center: [21.0122, 52.2297], zoom: 14, bbox: [20.85, 52.1, 21.28, 52.37] },
];
export const DEFAULT_CITY = CITIES[0];
