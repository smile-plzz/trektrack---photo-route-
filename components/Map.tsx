
import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Layers, Focus, ChevronUp, ChevronDown, Moon, Sun } from 'lucide-react';
import { TrekPhoto } from '../types';

interface MapProps {
  photos: TrekPhoto[];
  activePhotoId?: string;
  onPhotoSelect?: (id: string) => void;
}

type LayerType = 'standard' | 'satellite' | 'terrain' | 'dark';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const Map: React.FC<MapProps> = ({ photos, activePhotoId, onPhotoSelect }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const layersRef = useRef<Record<LayerType, any>>({} as any);
  const markersRef = useRef<Record<string, any>>({});
  const polylineRef = useRef<any>(null);
  
  const [activeLayer, setActiveLayer] = useState<LayerType>('dark');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<number | null>(null);
  const mappedCount = photos.filter(p => p.location).length;

  useEffect(() => {
    const syncLayerWithTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setActiveLayer(current => {
        if (current === 'dark' && !isDark) return 'standard';
        if (current === 'standard' && isDark) return 'dark';
        return current;
      });
    };

    syncLayerWithTheme();
    const observer = new MutationObserver(syncLayerWithTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const fitAllBounds = () => {
    const L = (window as any).L;
    if (!mapRef.current || !L) return;
    const validPhotos = photos.filter(p => p.location);
    if (validPhotos.length === 0) return;
    
    const points = validPhotos.map(p => [p.location!.lat, p.location!.lng]);
    const bounds = L.latLngBounds(points);
    mapRef.current.fitBounds(bounds, { padding: [100, 100], animate: true });
  };

  const runPlayback = async () => {
    const validPhotos = photos
      .filter(p => p.location)
      .sort((a, b) => (a.location?.timestamp?.getTime() || 0) - (b.location?.timestamp?.getTime() || 0));
    
    if (validPhotos.length === 0) return;
    setIsPlaying(true);

    for (const p of validPhotos) {
      if (playbackRef.current === null) break;
      onPhotoSelect?.(p.id);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    if (isPlaying) {
      playbackRef.current = 1;
      runPlayback();
    } else {
      playbackRef.current = null;
    }
  }, [isPlaying]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L) return;

    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        maxZoom: 19 
      }).setView([20, 0], 2);
      
      layersRef.current.standard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19
      });

      layersRef.current.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
      });

      layersRef.current.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; OpenStreetMap, SRTM',
        maxZoom: 17
      });

      layersRef.current.dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 20
      });

      clusterGroupRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 40,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `
              <div class="relative w-11 h-11 flex items-center justify-center group">
                <div class="absolute inset-0 bg-white/40 dark:bg-black/40 rounded-full blur-md"></div>
                <div class="relative z-10 w-9 h-9 bg-slate-900 dark:bg-emerald-600 rounded-full flex items-center justify-center border-[3px] border-white dark:border-slate-900 shadow-lg transition-transform group-hover:scale-105">
                  <span class="text-white font-bold text-xs antialiased">${count}</span>
                </div>
              </div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(48, 48),
            iconAnchor: [24, 24]
          });
        }
      }).addTo(mapRef.current);

      // Initial layer based on theme
      const isDark = document.documentElement.classList.contains('dark');
      layersRef.current[isDark ? 'dark' : 'standard'].addTo(mapRef.current);
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    }

    const validPhotos = photos
      .filter(p => p.location)
      .sort((a, b) => (a.location?.timestamp?.getTime() || 0) - (b.location?.timestamp?.getTime() || 0));
    
    if (clusterGroupRef.current) clusterGroupRef.current.clearLayers();
    markersRef.current = {};
    if (polylineRef.current) polylineRef.current.remove();

    if (validPhotos.length > 0 && mapRef.current) {
      const points = validPhotos.map(p => [p.location!.lat, p.location!.lng]);
      mapRef.current.invalidateSize();

      validPhotos.forEach((p, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === validPhotos.length - 1;
        const sequenceNumber = idx + 1;
        
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div class="relative flex flex-col items-center">
              <div class="w-9 h-9 rounded-full border-[3px] border-white dark:border-slate-900 shadow-lg flex items-center justify-center font-bold text-[12px] transition-all hover:scale-110 ${
                isStart ? 'bg-emerald-600 text-white' : 
                isEnd ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 
                'bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
              }">
                ${sequenceNumber}
              </div>
              <div class="w-1.5 h-3 bg-white dark:bg-slate-800 shadow-sm -mt-0.5 rounded-b-full"></div>
            </div>`,
          iconSize: [40, 48],
          iconAnchor: [20, 48]
        });

        const marker = L.marker([p.location!.lat, p.location!.lng], { icon });
        marker.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          onPhotoSelect?.(p.id);
        });

        const altitude = p.location?.alt !== undefined ? `${Math.round(p.location.alt)}m` : 'N/A';
        const dateStr = p.location?.timestamp ? p.location.timestamp.toLocaleString() : 'N/A';
        const safeId = escapeHtml(p.id);
        const safeName = escapeHtml(p.name);
        const safeUrl = escapeHtml(p.url);

        marker.bindPopup(`
            <div class="p-0 overflow-hidden w-[280px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div class="relative group cursor-pointer overflow-hidden aspect-[4/3]" onclick="window.dispatchEvent(new CustomEvent('trek-open-gallery', {detail: '${safeId}'}))">
              <img src="${safeUrl}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div class="absolute bottom-3 left-3 right-3 flex justify-between items-center translate-y-3 group-hover:translate-y-0 transition-transform">
                <span class="text-xs font-semibold text-white bg-emerald-500 px-3 py-1.5 rounded-full shadow-lg">Open photo</span>
              </div>
            </div>
            <div class="p-4">
              <h4 class="text-sm font-semibold text-slate-900 dark:text-white mb-3 truncate">${safeName}</h4>
              <div class="space-y-2.5">
                <div class="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span class="px-2 py-1 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg">#</span>
                  Waypoint ${sequenceNumber} of ${validPhotos.length}
                </div>
                <div class="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span class="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-lg">m</span>
                  Elevation <span class="text-slate-900 dark:text-slate-200 ml-1 font-semibold">${altitude}</span>
                </div>
                <div class="text-xs font-medium text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-50 dark:border-slate-800">
                  ${dateStr}
                </div>
              </div>
            </div>
          </div>
        `, { closeButton: false, offset: [0, -40] });
          
        clusterGroupRef.current.addLayer(marker);
        markersRef.current[p.id] = marker;
      });

      if (points.length > 1) {
        polylineRef.current = L.polyline(points, { 
          color: '#10b981', 
          weight: 4, 
          opacity: 0.8, 
          dashArray: '8, 12', 
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapRef.current);
      }
      fitAllBounds();
    }
  }, [photos]);

  useEffect(() => {
    if (!mapRef.current) return;
    (Object.keys(layersRef.current) as LayerType[]).forEach(k => {
      if (mapRef.current.hasLayer(layersRef.current[k])) mapRef.current.removeLayer(layersRef.current[k]);
    });
    const selected = layersRef.current[activeLayer];
    if (selected) {
      selected.addTo(mapRef.current).bringToBack();
    }
  }, [activeLayer]);

  useEffect(() => {
    if (activePhotoId && markersRef.current[activePhotoId] && mapRef.current) {
      const marker = markersRef.current[activePhotoId];
      const move = () => {
        mapRef.current.flyTo(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 16), { 
          duration: 1.2,
          easeLinearity: 0.25 
        });
        mapRef.current.once('moveend', () => marker.openPopup());
      };
      if (clusterGroupRef.current) clusterGroupRef.current.zoomToShowLayer(marker, move);
      else move();
    }
  }, [activePhotoId]);

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950 group/map">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      <div className="absolute top-3 right-3 lg:top-6 lg:right-6 z-[10] flex flex-col items-end gap-2 pointer-events-none">
        <div className="flex flex-wrap justify-end gap-2 pointer-events-auto">
          <button 
            onClick={fitAllBounds}
            disabled={mappedCount === 0}
            className="px-3 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl shadow-lg border border-white dark:border-slate-800 hover:bg-slate-900 dark:hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2 font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-slate-900 disabled:hover:text-slate-900 dark:disabled:hover:text-white group"
          >
            <Focus size={16} className="group-hover:rotate-180 transition-transform"/> View all
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={mappedCount === 0}
            className={`px-3 py-2.5 rounded-xl shadow-lg border transition-all flex items-center gap-2 font-semibold text-xs disabled:opacity-50 disabled:cursor-not-allowed ${
              isPlaying ? 'bg-rose-500 text-white border-rose-500 animate-pulse' : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-white dark:border-slate-800 hover:bg-emerald-500 hover:text-white'
            }`}
          >
            {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>

        <div className="relative flex flex-col items-end gap-2 pointer-events-auto">
          <button onClick={() => setShowLayerMenu(!showLayerMenu)} className="px-3 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl shadow-lg border border-white dark:border-slate-800 font-semibold text-xs flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <Layers size={16} /> Layers
            {showLayerMenu ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
          
          {showLayerMenu && (
            <div className="w-52 sm:w-56 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white dark:border-slate-800 animate-in slide-in-from-top-3 duration-200">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">Map view</p>
              <div className="grid grid-cols-1 gap-2">
                {(['dark', 'standard', 'satellite', 'terrain'] as LayerType[]).map(type => (
                  <button 
                    key={type} 
                    onClick={() => { setActiveLayer(type); setShowLayerMenu(false); }} 
                    className={`text-left px-4 py-3 rounded-xl text-xs font-semibold capitalize transition-all flex items-center justify-between ${
                      activeLayer === type ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {type}
                    {type === 'dark' && <Moon size={12}/>}
                    {type === 'standard' && <Sun size={12}/>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Map;
