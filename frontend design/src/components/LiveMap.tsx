import React, { useState, useCallback, useMemo } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { Map as MapIcon } from 'lucide-react';
import type { TruckState } from '../types';
import { badgeHexColor } from '../types';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
export const MAP_CENTER = { lat: 28.6280, lng: 77.2100 };
export const MAP_DEFAULT_ZOOM = 14;

export const PLANNED_ROUTES: number[][][] = [
  [[28.6139, 77.2090], [28.6200, 77.2150], [28.6280, 77.2200], [28.6350, 77.2100], [28.6400, 77.2000]],
  [[28.6300, 77.2000], [28.6250, 77.2100], [28.6200, 77.2200], [28.6150, 77.2300], [28.6100, 77.2400]],
  [[28.6500, 77.1900], [28.6450, 77.1950], [28.6400, 77.2050], [28.6350, 77.2150], [28.6300, 77.2250]],
  [[28.6100, 77.2300], [28.6150, 77.2250], [28.6200, 77.2150], [28.6250, 77.2050], [28.6300, 77.1950]],
  [[28.6400, 77.2100], [28.6350, 77.2050], [28.6300, 77.2000], [28.6250, 77.1950], [28.6200, 77.1900]],
  [[28.6200, 77.2250], [28.6250, 77.2300], [28.6300, 77.2350], [28.6350, 77.2300], [28.6400, 77.2250]],
];

const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0a0f0d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0f0d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a6a55' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1e3a2b' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#5a8a6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#3a5a45' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0d1a14' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3a7a4a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#131c17' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1e3a2b' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1a2e22' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#22c55e20' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#6a9a7a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#162019' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#111a15' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#131c17' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#4a7a5a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#06140e' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2a5a3a' }] },
];

export default function LiveMap({ trucks, selectedTruck, onSelectTruck }: {
  trucks: TruckState[];
  selectedTruck: string | null;
  onSelectTruck: (id: string | null) => void;
}) {
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  const mapContainerStyle = useMemo(() => ({ width: '100%', height: '100%' }), []);

  const mapOptions = useMemo((): google.maps.MapOptions => ({
    styles: DARK_MAP_STYLE,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: {
      position: typeof google !== 'undefined' ? google?.maps?.ControlPosition?.RIGHT_BOTTOM : undefined,
    },
    mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
    gestureHandling: 'greedy', minZoom: 11, maxZoom: 18, backgroundColor: '#0a0f0d',
  }), []);

  const onMapLoad = useCallback((map: google.maps.Map) => { setMapInstance(map); }, []);
  const badgeColor = (b: string) => badgeHexColor(b);

  const createMarkerIcon = useCallback((truck: TruckState): google.maps.Icon => {
    const color = badgeColor(truck.green_badge);
    const isSelected = selectedTruck === truck.truck_id;
    const size = isSelected ? 20 : 14;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size + 16}" height="${size + 16}" viewBox="0 0 ${size + 16} ${size + 16}">
      ${truck.active_alert ? `<circle cx="${(size + 16) / 2}" cy="${(size + 16) / 2}" r="${(size + 14) / 2}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.4"/>` : ''}
      ${isSelected ? `<circle cx="${(size + 16) / 2}" cy="${(size + 16) / 2}" r="${(size + 10) / 2}" fill="none" stroke="${color}" stroke-width="1" opacity="0.6"/>` : ''}
      <circle cx="${(size + 16) / 2}" cy="${(size + 16) / 2}" r="${size / 2}" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="${(size + 16) / 2}" y="${(size + 16) / 2 + 3.5}" text-anchor="middle" fill="white" font-size="8" font-weight="bold" font-family="sans-serif">${truck.truck_id}</text>
    </svg>`;
    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`,
      scaledSize: new google.maps.Size(size + 16, size + 16),
      anchor: new google.maps.Point((size + 16) / 2, (size + 16) / 2),
    };
  }, [selectedTruck]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 40%, #0d1a14 0%, #080d0a 50%, #060908 100%)' }}>
        <div className="text-center max-w-md px-6">
          <MapIcon size={48} className="mx-auto mb-4 text-primary/30" />
          <h3 className="text-white text-lg font-bold mb-2">Google Maps API Key Required</h3>
          <p className="text-slate-400 text-sm mb-4">Add your API key to <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">.env</code></p>
          <code className="block bg-surface-dark border border-white/[0.06] rounded-lg px-4 py-3 text-xs text-primary/80 font-mono text-left">VITE_GOOGLE_MAPS_API_KEY=your_key_here</code>
          {trucks.length > 0 && (
            <div className="mt-6 bg-surface-dark/50 rounded-xl border border-white/[0.06] p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold">Trucks Active ({trucks.length})</p>
              <div className="grid grid-cols-3 gap-2">
                {trucks.map(t => (
                  <div key={t.truck_id} onClick={() => onSelectTruck(selectedTruck === t.truck_id ? null : t.truck_id)}
                    className={`p-2 rounded-lg border cursor-pointer transition-all ${selectedTruck === t.truck_id ? 'border-primary/40 bg-primary/10' : 'border-white/[0.04] bg-surface-card hover:border-white/[0.08]'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: badgeColor(t.green_badge) }} />
                      <span className="text-[11px] font-bold text-white">{t.truck_id}</span>
                    </div>
                    <p className="text-[9px] text-slate-500">{t.speed_kmph.toFixed(0)} km/h | Score: {t.green_score}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <GoogleMap mapContainerStyle={mapContainerStyle} center={MAP_CENTER} zoom={MAP_DEFAULT_ZOOM} options={mapOptions} onLoad={onMapLoad}>
        {trucks.map(truck => {
          if (truck.trail.length < 2) return null;
          const color = badgeColor(truck.green_badge);
          const path = truck.trail.map(([lon, lat]) => ({ lat, lng: lon }));
          return <Polyline key={`trail-${truck.truck_id}`} path={path} options={{ strokeColor: color, strokeOpacity: 0.6, strokeWeight: 3, geodesic: true }} />;
        })}
        {trucks.length > 0 && PLANNED_ROUTES.map((route, i) => (
          <Polyline key={`route-${i}`} path={route.map(([lat, lng]) => ({ lat, lng }))} options={{ strokeColor: '#22c55e', strokeOpacity: 0.08, strokeWeight: 2, geodesic: true }} />
        ))}
        {trucks.map(truck => (
          <Marker key={truck.truck_id} position={{ lat: truck.lat, lng: truck.lon }} icon={createMarkerIcon(truck)}
            onClick={() => onSelectTruck(selectedTruck === truck.truck_id ? null : truck.truck_id)}
            zIndex={selectedTruck === truck.truck_id ? 100 : 10}
            title={`${truck.truck_id} - ${truck.location_name} | Score: ${truck.green_score}`} />
        ))}
        {selectedTruck && (() => {
          const t = trucks.find(t => t.truck_id === selectedTruck);
          if (!t) return null;
          return (
            <InfoWindow position={{ lat: t.lat + 0.001, lng: t.lon }} onCloseClick={() => onSelectTruck(null)} options={{ maxWidth: 200 }}>
              <div style={{ fontFamily: 'Manrope, sans-serif', padding: '2px', minWidth: '140px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#111', marginBottom: '4px' }}>{t.truck_id} - {t.location_name}</div>
                <div style={{ fontSize: '11px', color: '#555', lineHeight: '1.6' }}>
                  <div>Score: <strong style={{ color: badgeColor(t.green_badge) }}>{t.green_score}</strong></div>
                  <div>Speed: {t.speed_kmph.toFixed(0)} km/h</div>
                  <div>CO2: {t.co2_rate_kgph.toFixed(1)} kg/h</div>
                  <div>Fuel: {t.fuel_rate_lph.toFixed(1)} L/h</div>
                </div>
                {t.active_alert && <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px', fontWeight: 600 }}>{t.active_alert}</div>}
              </div>
            </InfoWindow>
          );
        })()}
      </GoogleMap>
    </LoadScript>
  );
}
