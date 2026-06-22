import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Layers, Focus, ChevronUp, ChevronDown, Moon, Sun, MapPin, Maximize2 } from 'lucide-react';
import { TrekPhoto } from '../types';

interface MapProps {
  photos: TrekPhoto[];
  activePhotoId?: string;
  onPhotoSelect?: (id: string) => void;
}

type LayerType = 'standard' | 'satellite' | 'terrain' | 'dark';

const Map: React.FC<MapProps> = ({ photos, activePhotoId, onPhotoSelect }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const clusterGroupRef = useRef<any>(null);
  const layersRef = useRef<Record<LayerType, any>>({} as any);
  const markersRef = useRef<Record<string, any>>({});
  const polylineRef = useRef<any>(null);
  
  const [activeLayer, setActiveLayer] = useState<LayerType>(() => {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'standard';
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<number | null>(null);

  const fitAllBounds = () => {
    const L = (window as any).L;
    if (!mapRef.current || !L) return;
    const validPhotos = photos.filter(p => p.location);
    if (validPhotos.length === 0) return;
    
    const points = validPhotos.map(p => [p.location!.lat, p.location!.lng]);
    const bounds = L.latLngBounds(points);
    mapRef.current.fitBounds(bounds, { padding: [80, 80], animate: true, duration: 1.5 });
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
      await new Promise(resolve => setTimeout(resolve, 3500));
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
        maxZoom: 20,
        worldCopyJump: true
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
        maxClusterRadius: 50,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `
              <div class="relative w-12 h-12 flex items-center justify-center group scale-100 hover:scale-110 transition-transform">
                <div class="absolute inset-0 bg-emerald-500/25 rounded-full animate-pulse"></div>
                <div class="absolute inset-0 bg-white/40 dark:bg-black/40 rounded-full blur-md"></div>
                <div class="relative z-10 w-10 h-10 bg-slate-900 dark:bg-emerald-600 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-900 shadow-2xl">
                  <span class="text-white font-black text-xs">${count}</span>
                </div>
              </div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(48, 48),
            iconAnchor: [24, 24]
          });
        }
      }).addTo(mapRef.current);

      layersRef.current[activeLayer].addTo(mapRef.current);
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

      validPhotos.forEach((p, idx) => {
        const isStart = idx === 0;
        const isEnd = idx === validPhotos.length - 1;
        const sequenceNumber = idx + 1;
        
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div class="relative flex flex-col items-center group">
              <div class="w-9 h-9 rounded-full border-4 border-white dark:border-slate-900 shadow-2xl flex items-center justify-center font-black text-[10px] transition-all group-hover:scale-125 ${
                isStart ? 'bg-emerald-600 text-white' : 
                isEnd ? 'bg-amber-600 text-white' : 
                'bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
              }">
                ${sequenceNumber}
              </div>
              <div class="w-1.5 h-3 bg-white dark:bg-slate-800 shadow-lg -mt-1 rounded-b-full"></div>
            </div>`,
          iconSize: [36, 44],
          iconAnchor: [18, 44]
        });

        const marker = L.marker([p.location!.lat, p.location!.lng], { icon });
        marker.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          onPhotoSelect?.(p.id);
        });

        const altitude = p.location?.alt !== undefined ? `${Math.round(p.location.alt)}m` : 'N/A';
        const dateStr = p.location?.timestamp ? p.location.timestamp.toLocaleString() : 'N/A';

        marker.bindPopup(`
          <div class="p-0 overflow-hidden w-[280px] bg-white dark:bg-slate-900 rounded-3xl group/popup">
            <div class="relative overflow-hidden aspect-[4/3] cursor-pointer" onclick="window.dispatchEvent(new CustomEvent('trek-open-gallery', {detail: '${p.id}'}))">
              <img src="${p.url}" class="w-full h-full object-cover transition-transform duration-1000 group-hover/popup:scale-110" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover/popup:opacity-100 transition-opacity flex items-end p-4">
                <span class="text-[9px] font-black text-white uppercase tracking-[0.2em] bg-emerald-500/80 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2">
                  <Maximize2 size={10}/> Full Analysis
                </span>
              </div>
            </div>
            <div class="p-5 bg-white dark:bg-slate-900">
              <h4 class="text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-tight mb-3 truncate">${p.name}</h4>
              <div class="space-y-2.5">
                <div class="flex items-center gap-2.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                  <span class="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-200 rounded-lg"><MapPin size={10}/></span>
                  Node ${sequenceNumber} of ${validPhotos.length}
                </div>
                <div class="flex items-center gap-2.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                  <span class="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-lg"><Layers size={10}/></span>
                  Altitude: <span class="text-slate-900 dark:text-slate-200 ml-1 font-black">${altitude}</span>
                </div>
              </div>
            </div>
          </div>
        `, { closeButton: false, offset: [0, -38] });
          
        clusterGroupRef.current.addLayer(marker);
        markersRef.current[p.id] = marker;
      });

      if (points.length > 1) {
        // Glow effect layers
        L.polyline(points, { 
          color: activeLayer === 'dark' ? '#10b981' : '#059669', 
          weight: 12, 
          opacity: 0.1, 
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(mapRef.current);

        polylineRef.current = L.polyline(points, { 
          color: activeLayer === 'dark' ? '#10b981' : '#10b981', 
          weight: 4, 
          opacity: 0.8, 
          dashArray: '8, 16', 
          lineCap: 'round',
          lineJoin: 'round',
          className: 'trek-path-animated'
        }).addTo(mapRef.current);

        // Add CSS for animation if not present
        if (!document.getElementById('trek-path-styles')) {
          const style = document.createElement('style');
          style.id = 'trek-path-styles';
          style.innerHTML = `
            @keyframes dash {
              to {
                stroke-dashoffset: -24;
              }
            }
            .trek-path-animated {
              animation: dash 1s linear infinite;
            }
          `;
          document.head.appendChild(style);
        }
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
          easeLinearity: 0.15 
        });
        mapRef.current.once('moveend', () => marker.openPopup());
      };
      if (clusterGroupRef.current) clusterGroupRef.current.zoomToShowLayer(marker, move);
      else move();
    }
  }, [activePhotoId]);

  return (
    <div className="relative w-full h-full bg-slate-100 dark:bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      <div className="absolute top-8 right-8 z-[10] flex flex-col items-end gap-3 pointer-events-none">
        <div className="flex gap-3 pointer-events-auto">
          <button 
            onClick={fitAllBounds}
            className="p-3.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-xl border border-white dark:border-slate-800 hover:bg-emerald-500 dark:hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2.5 font-black text-[10px] uppercase tracking-widest"
          >
            <Focus size={16}/> Re-Center
          </button>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={`p-3.5 rounded-2xl shadow-xl border transition-all flex items-center gap-2.5 font-black text-[10px] uppercase tracking-widest ${
              isPlaying ? 'bg-rose-500 text-white border-rose-500 animate-pulse' : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-white dark:border-slate-800 hover:bg-emerald-500 hover:text-white'
            }`}
          >
            {isPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            {isPlaying ? 'Abort' : 'Playback'}
          </button>
        </div>

        <div className="relative flex flex-col items-end gap-2.5 pointer-events-auto">
          <button onClick={() => setShowLayerMenu(!showLayerMenu)} className="p-3.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl shadow-xl border border-white dark:border-slate-800 font-black text-[10px] uppercase tracking-widest flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
            <Layers size={16} /> Layers
            {showLayerMenu ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          
          {showLayerMenu && (
            <div className="w-56 p-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white dark:border-slate-800 animate-in slide-in-from-top-4 duration-300">
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-2">Topology Presets</p>
              <div className="grid grid-cols-1 gap-1.5">
                {(['dark', 'standard', 'satellite', 'terrain'] as LayerType[]).map(type => (
                  <button 
                    key={type} 
                    onClick={() => { setActiveLayer(type); setShowLayerMenu(false); }} 
                    className={`text-left px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-between ${
                      activeLayer === type ? 'bg-emerald-600 text-white shadow-lg translate-x-1' : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {type}
                    {type === 'dark' && <Moon size={10}/>}
                    {type === 'standard' && <Sun size={10}/>}
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