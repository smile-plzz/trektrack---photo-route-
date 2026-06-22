import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Upload, Trash2, Info, Compass, 
  Footprints, Mountain, Map as MapIcon, 
  Calendar, Download, RotateCcw, MapPin, 
  ChevronRight, ChevronLeft, Activity, Image as ImageIcon,
  Clock, Box, Sun, Moon, X, Target, Zap, 
  Trash, ArrowUpDown, SortAsc, SortDesc,
  Filter, CheckCircle2, AlertCircle, ShieldAlert,
  Gauge, Wind, Camera, Hash, Globe,
  Terminal, LayoutDashboard, Database,
  ArrowBigUp, Waves, Sparkles
} from 'lucide-react';
import Markdown from 'react-markdown';
import { TrekPhoto } from './types';
import { extractGpsData, extractCameraMetadata, fileToBase64 } from './services/exifService';
import { generateTrekStory } from './services/geminiService';
import Map from './components/Map';
import ElevationProfile from './components/ElevationProfile';
import Gallery from './components/Gallery';
import heic2any from 'https://esm.sh/heic2any';

type SortKey = 'timestamp' | 'name' | 'elevation';
type SortOrder = 'asc' | 'desc';

const App: React.FC = () => {
  const [photos, setPhotos] = useState<TrekPhoto[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string>();
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trektrack-theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [narrativeData, setNarrativeData] = useState<{
    narrative: string;
    milestones: {label: string, value: string, icon: string}[];
    expertInsights: string[];
  } | null>(null);
  const [isNarrating, setIsNarrating] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Persistence of theme
  useEffect(() => {
    localStorage.setItem('trektrack-theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.className = 'bg-slate-950 text-slate-100 overflow-hidden transition-colors duration-300';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.className = 'bg-slate-50 text-slate-900 overflow-hidden transition-colors duration-300';
    }
  }, [darkMode]);

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'timestamp') {
        const timeA = a.location?.timestamp?.getTime() || 0;
        const timeB = b.location?.timestamp?.getTime() || 0;
        comparison = timeA - timeB;
      } else if (sortKey === 'name') {
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortKey === 'elevation') {
        comparison = (a.location?.alt || 0) - (b.location?.alt || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [photos, sortKey, sortOrder]);

  // Gallery handler for external events (e.g. from Map markers)
  useEffect(() => {
    const handleOpenGallery = (e: any) => {
      const photoId = e.detail;
      const idx = sortedPhotos.findIndex(p => p.id === photoId);
      if (idx !== -1) {
        setGalleryIndex(idx);
        setIsGalleryOpen(true);
      }
    };
    window.addEventListener('trek-open-gallery', handleOpenGallery);
    return () => window.removeEventListener('trek-open-gallery', handleOpenGallery);
  }, [sortedPhotos]);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsConverting(true);
    
    const processPromises = files.map(async (file) => {
      const lowerName = file.name.toLowerCase();
      const isHeic = lowerName.endsWith('.heic') || lowerName.endsWith('.heif');
      
      try {
        const [location, camera, displayBlob] = await Promise.all([
          extractGpsData(file),
          extractCameraMetadata(file),
          isHeic ? heic2any({ blob: file, toType: 'image/jpeg', quality: 0.6 }) : Promise.resolve(file)
        ]);
        
        const finalBlob = Array.isArray(displayBlob) ? displayBlob[0] : displayBlob;
        const finalMimeType = isHeic ? 'image/jpeg' : file.type;
        const objectUrl = URL.createObjectURL(finalBlob as Blob);
        
        // Only convert to base64 if really needed for later storage/AI. 
        // For local display, objectUrl is enough and faster.
        const base64 = await fileToBase64(finalBlob as File);
        
        return {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: objectUrl,
          base64,
          location,
          camera,
          mimeType: finalMimeType
        } as TrekPhoto;
      } catch (err) {
        console.error(`Failed to process ${file.name}:`, err);
        return null;
      }
    });

    const results = await Promise.all(processPromises);
    let validNewPhotos = results.filter((p): p is TrekPhoto => p !== null);
    
    // Add Anomaly Detection
    validNewPhotos = validNewPhotos.map((p, idx, arr) => {
      if (idx === 0) return p;
      const prev = arr[idx-1];
      if (!p.location || !prev.location) return p;

      // Check for GPS "Teleportation" (over 200km/h)
      const dist = 6371 * (2 * Math.atan2(Math.sqrt(Math.sin(((p.location.lat - prev.location.lat) * Math.PI / 180)/2)**2 + Math.cos(prev.location.lat * Math.PI / 180) * Math.cos(p.location.lat * Math.PI / 180) * Math.sin(((p.location.lng - prev.location.lng) * Math.PI / 180)/2)**2), Math.sqrt(1-Math.sin(((p.location.lat - prev.location.lat) * Math.PI / 180)/2)**2 + Math.cos(prev.location.lat * Math.PI / 180) * Math.cos(p.location.lat * Math.PI / 180) * Math.sin(((p.location.lng - prev.location.lng) * Math.PI / 180)/2)**2)));
      const timeHours = (p.location.timestamp!.getTime() - prev.location.timestamp!.getTime()) / 3600000;
      const speed = timeHours > 0 ? dist / timeHours : 0;

      if (speed > 250) { // Commercial jet speed threshold for trekking app
        return { ...p, anomaly: 'High-speed GPS displacement detected.' };
      }
      return p;
    });

    setPhotos(prev => [...prev, ...validNewPhotos]);
    setIsConverting(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    processFiles(files);
    e.target.value = ''; // Reset to allow re-upload of same file
  };

  const loadSampleExpedition = () => {
    const startTime = new Date();
    const day = 24 * 60 * 60 * 1000;
    
    const samplePhotos: TrekPhoto[] = [
      {
        id: 'sample-1',
        name: 'Lukla Tarmac.jpg',
        url: 'https://images.unsplash.com/photo-1544621005-99882209f982?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.6869, lng: 86.7314, alt: 2840, timestamp: new Date(startTime.getTime()) },
        camera: { model: 'Leica Q2', make: 'Leica' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-2',
        name: 'Phakding Trail.jpg',
        url: 'https://images.unsplash.com/photo-1517400508447-f8dd518b86db?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.7469, lng: 86.7114, alt: 2610, timestamp: new Date(startTime.getTime() + 4 * 3600000) },
        camera: { model: 'Leica Q2', make: 'Leica' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-3',
        name: 'Monjo Gate.jpg',
        url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.7769, lng: 86.7214, alt: 2835, timestamp: new Date(startTime.getTime() + day) },
        camera: { model: 'Leica Q2', make: 'Leica' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-4',
        name: 'Namche Bazaar Overlook.jpg',
        url: 'https://images.unsplash.com/photo-1517400508447-f8dd518b86db?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.8069, lng: 86.7114, alt: 3440, timestamp: new Date(startTime.getTime() + day * 1.5) },
        camera: { model: 'Sony A7R IV', make: 'Sony' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-5',
        name: 'Everest View Hotel.jpg',
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.8169, lng: 86.7214, alt: 3880, timestamp: new Date(startTime.getTime() + day * 2) },
        camera: { model: 'Sony A7R IV', make: 'Sony' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-6',
        name: 'Tengboche Monastery.jpg',
        url: 'https://images.unsplash.com/photo-1548232930-bc97e59c0379?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.8369, lng: 86.7614, alt: 3867, timestamp: new Date(startTime.getTime() + day * 3) },
        camera: { model: 'Sony A7R IV', make: 'Sony' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-7',
        name: 'Pangboche Village.jpg',
        url: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.8669, lng: 86.7914, alt: 3930, timestamp: new Date(startTime.getTime() + day * 3.5) },
        camera: { model: 'Sony A7R IV', make: 'Sony' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-8',
        name: 'Dingboche Stone Walls.jpg',
        url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.8969, lng: 86.8314, alt: 4410, timestamp: new Date(startTime.getTime() + day * 4) },
        camera: { model: 'Phase One IQ4', make: 'Phase One' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-9',
        name: 'Lobuche Ice Fall.jpg',
        url: 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.9469, lng: 86.8114, alt: 4940, timestamp: new Date(startTime.getTime() + day * 5) },
        camera: { model: 'Phase One IQ4', make: 'Phase One' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-10',
        name: 'Gorak Shep Desert.jpg',
        url: 'https://images.unsplash.com/photo-1544621005-99882209f982?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.9809, lng: 86.8324, alt: 5164, timestamp: new Date(startTime.getTime() + day * 6) },
        camera: { model: 'Phase One IQ4', make: 'Phase One' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-11',
        name: 'Kala Patthar.jpg',
        url: 'https://images.unsplash.com/photo-1544621005-99882209f982?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 27.9950, lng: 86.8250, alt: 5644, timestamp: new Date(startTime.getTime() + day * 6.5) },
        camera: { model: 'Phase One IQ4', make: 'Phase One' },
        mimeType: 'image/jpeg'
      },
      {
        id: 'sample-12',
        name: 'Everest Base Camp - Goal.jpg',
        url: 'https://images.unsplash.com/photo-1544621005-99882209f982?auto=format&fit=crop&q=80&w=800',
        base64: '',
        location: { lat: 28.0042, lng: 86.8528, alt: 5364, timestamp: new Date(startTime.getTime() + day * 7) },
        camera: { model: 'Phase One IQ4', make: 'Phase One' },
        mimeType: 'image/jpeg'
      }
    ];
    setPhotos(samplePhotos);
  };

  const deletePhoto = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPhotos(prev => {
      const photoToRemove = prev.find(p => p.id === id);
      if (photoToRemove && photoToRemove.url) {
        URL.revokeObjectURL(photoToRemove.url);
      }
      return prev.filter(p => p.id !== id);
    });
    if (activePhotoId === id) setActivePhotoId(undefined);
  }, [activePhotoId]);

  const handleClearAll = useCallback(() => {
    if (window.confirm("Permanently wipe all expedition data? This cannot be undone.")) {
      photos.forEach(p => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
      setPhotos([]);
      setActivePhotoId(undefined);
      setIsGalleryOpen(false);
      setGalleryIndex(0);
    }
  }, [photos]);

  const stats = useMemo(() => {
    const gpsPhotos = [...photos]
      .filter(p => p.location)
      .sort((a, b) => (a.location?.timestamp?.getTime() || 0) - (b.location?.timestamp?.getTime() || 0));
      
    if (gpsPhotos.length < 2) return null;
    
    let dist = 0, maxA = -Infinity, accGain = 0;
    for (let i = 0; i < gpsPhotos.length - 1; i++) {
      const p1 = gpsPhotos[i].location!, p2 = gpsPhotos[i + 1].location!;
      const R = 6371; // km
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLon = (p2.lng - p1.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon/2)**2;
      dist += R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      
      if (p1.alt !== undefined && p2.alt !== undefined) {
        const gain = p2.alt - p1.alt;
        if (gain > 0) accGain += gain;
      }

      if (p1.alt !== undefined) maxA = Math.max(maxA, p1.alt);
    }
    const last = gpsPhotos[gpsPhotos.length-1].location!;
    if (last.alt !== undefined) maxA = Math.max(maxA, last.alt);

    // Difficulty score (0-100) based on slope intensity
    const gainKm = accGain / 1000;
    const gradient = dist > 0 ? (gainKm / dist) * 100 : 0;
    const difficultyScore = Math.min(100, Math.round(gradient * 5 + (dist / 10)));
    
    let difficultyLabel = "Easy";
    if (difficultyScore > 70) difficultyLabel = "Extreme";
    else if (difficultyScore > 50) difficultyLabel = "Difficult";
    else if (difficultyScore > 30) difficultyLabel = "Moderate";

    // Terrain classification
    let terrain = "Plains";
    if (maxA > 3000) terrain = "High Alpine";
    else if (maxA > 1500) terrain = "Montane";
    else if (maxA > 500) terrain = "Hills";
    
    // Check for coastal
    const avgLat = gpsPhotos.reduce((s, p) => s + p.location!.lat, 0) / gpsPhotos.length;
    
    // Temporal stats
    const firstTime = gpsPhotos[0].location?.timestamp;
    const lastTime = gpsPhotos[gpsPhotos.length - 1].location?.timestamp;
    let durationMs = 0;
    let durationStr = "N/A";
    let movingPace = 0;

    if (firstTime && lastTime) {
      durationMs = lastTime.getTime() - firstTime.getTime();
      const hours = Math.floor(durationMs / 3600000);
      const mins = Math.floor((durationMs % 3600000) / 60000);
      durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      
      const durationHours = durationMs / 3600000;
      movingPace = durationHours > 0 ? Number(dist) / durationHours : 0;
    }

    // Camera breakdown
    const cameras = photos.reduce((acc: Record<string, number>, p) => {
      const model = p.camera?.model || "Unknown Device";
      acc[model] = (acc[model] || 0) + 1;
      return acc;
    }, {});
    const topCamera = Object.entries(cameras).sort((a,b) => b[1] - a[1])[0]?.[0] || "None Detected";

    // Physiological estimates
    const o2Saturation = maxA > 0 ? Math.max(50, Math.round(100 - (maxA / 200))) : 100;
    const caloriesBurned = Math.round(Number(dist) * 65 + accGain * 0.5);

    return {
      distance: dist.toFixed(2),
      maxAlt: maxA !== -Infinity ? Math.round(maxA) : null,
      accGain: Math.round(accGain),
      count: gpsPhotos.length,
      difficultyScore,
      difficultyLabel,
      terrain,
      durationStr,
      movingPace: movingPace.toFixed(1),
      topCamera,
      o2Saturation,
      caloriesBurned
    };
  }, [photos]);

  const exportGPX = () => {
    const validPhotos = [...photos]
      .filter(p => p.location)
      .sort((a, b) => (a.location?.timestamp?.getTime() || 0) - (b.location?.timestamp?.getTime() || 0));
      
    if (validPhotos.length === 0) return;

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrekTrack" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Expedition Export ${new Date().toLocaleDateString()}</name></metadata>
  <trk><name>Digital Trail</name><trkseg>`;
    
    validPhotos.forEach(p => {
      gpx += `
      <trkpt lat="${p.location!.lat}" lon="${p.location!.lng}">
        ${p.location!.alt !== undefined ? `<ele>${p.location!.alt}</ele>` : ''}
        ${p.location!.timestamp ? `<time>${p.location!.timestamp.toISOString()}</time>` : ''}
        <name>${p.name.replace(/&/g, '&amp;')}</name>
      </trkpt>`;
    });
    
    gpx += `</trkseg></trk></gpx>`;
    
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trek_route_${new Date().toISOString().split('T')[0]}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cycleSort = () => {
    const keys: SortKey[] = ['timestamp', 'name', 'elevation'];
    const currentIdx = keys.indexOf(sortKey);
    setSortKey(keys[(currentIdx + 1) % keys.length]);
  };

  const handleGenerateNarrative = async () => {
    if (photos.length === 0) return;
    setIsNarrating(true);
    try {
      const data = await generateTrekStory(photos);
      setNarrativeData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsNarrating(false);
    }
  };

  return (
    <div className={`flex flex-col lg:flex-row h-screen w-full transition-all duration-500`}>
      
      {/* Enhanced Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-emerald-500/10 dark:bg-emerald-500/20 backdrop-blur-xl border-[8px] border-dashed border-emerald-500 flex items-center justify-center pointer-events-none transition-all duration-300">
          <div className="bg-white dark:bg-slate-900 p-16 rounded-[4rem] shadow-2xl flex flex-col items-center gap-6 transform animate-in zoom-in-95 border border-emerald-500/30">
            <div className="p-8 bg-emerald-500 rounded-full text-white shadow-2xl shadow-emerald-500/40 animate-bounce">
               <Upload size={64} strokeWidth={2.5}/>
            </div>
            <p className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Import Mission Assets</p>
          </div>
        </div>
      )}

      {/* Main Map Area - Top on mobile, right on desktop */}
      <main className="order-1 lg:order-2 flex-1 relative bg-slate-100 dark:bg-[#020617] overflow-hidden h-[40vh] lg:h-full">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-1/2 -translate-y-1/2 left-4 z-40 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all text-emerald-500 hidden lg:flex items-center justify-center animate-in fade-in slide-in-from-left-4 duration-300"
            title="Show Sidebar"
          >
            <ChevronRight size={20} />
          </button>
        )}
        <Map photos={photos} activePhotoId={activePhotoId} onPhotoSelect={setActivePhotoId} />
        
        {/* Modern HUD */}
        <div className="absolute top-4 lg:top-8 left-4 lg:left-8 flex flex-col gap-6 z-20 pointer-events-none lg:max-w-xs xl:max-w-sm">
          <div className="p-4 lg:p-6 xl:p-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border border-white/40 dark:border-slate-800/50 pointer-events-auto transition-all hover:scale-[1.01] group border-l-[6px] border-l-emerald-500">
            <div className="flex items-center gap-4 mb-3 lg:mb-5">
              <div className="p-2 bg-emerald-500 rounded-xl text-white shadow-lg group-hover:rotate-6 transition-transform"><Target size={18}/></div>
              <div className="flex flex-col">
                <span className="text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] dark:text-slate-100">Telemetry HUD</span>
                <span className="text-[8px] lg:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Mission Status: Active</span>
              </div>
            </div>
            <p className="text-[10px] lg:text-[11px] xl:text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold uppercase tracking-tight">
              Analyzing <span className="text-slate-900 dark:text-emerald-400 font-black">{photos.filter(p => p.location).length} Intersections</span>. 
              {stats ? ` Tracking ${stats.distance}km.` : " Awaiting assets."}
            </p>
          </div>
        </div>
      </main>

      {/* Sidebar Controls - Bottom on mobile, left on desktop */}
      <aside 
        className={`order-2 lg:order-1 flex flex-col z-20 shadow-2xl transition-all duration-300 ease-in-out relative
          ${isSidebarOpen ? 'w-full lg:w-[420px] xl:w-[480px] opacity-100' : 'w-0 lg:w-0 overflow-hidden opacity-0'}
          h-[60vh] lg:h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a]`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(Array.from(e.dataTransfer.files)); }}
      >
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all text-slate-400 hover:text-emerald-500 hidden lg:flex items-center justify-center translate-x-1/2"
          title="Hide Sidebar"
        >
          <ChevronLeft size={16} />
        </button>

        <header className="p-6 xl:p-8 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl z-30">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20 transition-transform hover:scale-110 active:scale-95 cursor-default">
                <Compass size={22}/>
              </div>
              <div>
                <h1 className="text-xl xl:text-2xl font-black tracking-tighter leading-none mb-1">TrekTrack</h1>
                <p className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Journey Mapping Engine</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stats && (
                <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{stats.terrain}</span>
                </div>
              )}
              <button 
                onClick={() => setDarkMode(!darkMode)} 
                title={darkMode ? "Switch to Day" : "Switch to Night"}
                className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
              >
                {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
              </button>
            </div>
          </div>

          <label className={`group relative flex flex-col items-center justify-center gap-4 w-full p-6 xl:p-8 rounded-[2rem] border-2 border-dashed transition-all cursor-pointer ${isConverting ? 'bg-slate-100 dark:bg-slate-800/50 border-emerald-500 cursor-wait' : 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5'}`}>
            <div className={`p-4 rounded-2xl transition-all ${isConverting ? 'bg-emerald-500 text-white animate-pulse' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white'}`}>
              {isConverting ? <Activity className="animate-spin" size={24}/> : <Upload size={24}/>}
            </div>
            <div className="text-center">
              <span className="block font-black text-sm xl:text-base">{isConverting ? 'Decoding EXIF Metadata...' : 'Import Journey Photos'}</span>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center justify-center gap-2">
                <Zap size={10} className="text-amber-500"/> Local Mapping
              </span>
            </div>
            {!isConverting && <input type="file" multiple accept="image/*,.heic,.heif" onChange={handleFileUpload} className="hidden" />}
          </label>
        </header>

        <div className="flex-1 p-6 xl:p-8 space-y-10 overflow-y-auto no-scrollbar relative">
          {/* Subtle topographic background hint */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none overflow-hidden">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="topo" width="100" height="100" patternUnits="userSpaceOnUse">
                  <path d="M0 50 Q 25 30, 50 50 T 100 50" fill="none" stroke="currentColor" strokeWidth="1" />
                  <path d="M0 25 Q 25 5, 50 25 T 100 25" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  <path d="M0 75 Q 25 55, 50 75 T 100 75" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#topo)" />
            </svg>
          </div>

          {!stats ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-8 fade-in relative z-10">
               <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
                  <div className="relative bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl">
                    <Compass size={48} className="text-emerald-500 mx-auto mb-4 animate-pulse"/>
                    <h3 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">Ready for Ascent?</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">Connect your expedition photos to reveal the digital trail and topographical metrics.</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                       <button 
                         onClick={loadSampleExpedition}
                         className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 rounded-full hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                       >
                         Demo Expedition
                       </button>
                    </div>
                  </div>
               </div>
               <div className="grid grid-cols-3 gap-6 opacity-20 filter grayscale">
                  <div className="flex flex-col items-center"><Footprints size={24}/><div className="h-1.5 w-8 bg-slate-400 rounded-full mt-2"></div></div>
                  <div className="flex flex-col items-center"><Mountain size={24}/><div className="h-1.5 w-8 bg-slate-400 rounded-full mt-2"></div></div>
                  <div className="flex flex-col items-center"><Camera size={24}/><div className="h-1.5 w-8 bg-slate-400 rounded-full mt-2"></div></div>
               </div>
            </div>
          ) : (
            <div className="space-y-8 fade-in relative z-10 sm:max-w-none max-w-[100vw] overflow-hidden">
              {/* Mission Badge Row */}
              <div className="flex items-center gap-3">
                <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800/10 rounded-[1.2rem] border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 group hover:border-emerald-500/30 transition-all">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Expedition Active</span>
                </div>
                <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800/10 rounded-[1.2rem] border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 group hover:border-blue-500/30 transition-all">
                  <ShieldAlert size={14} className="text-blue-500"/>
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Precision GPS</span>
                </div>
              </div>

              {/* Pro Analytics Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-3xl p-5 rounded-[2.2rem] border border-slate-200 dark:border-slate-800 transition-all hover:border-emerald-500/40 relative overflow-hidden group shadow-sm hover:shadow-xl dark:shadow-none hover:-translate-y-1">
                  <div className="flex items-center gap-2 text-emerald-500 mb-2 font-black uppercase tracking-widest text-[9px]">
                    <Footprints size={12}/> Route
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.distance} <span className="text-[10px] text-slate-400 font-bold ml-1">KM</span></div>
                  <div className="absolute right-4 top-4 opacity-5 group-hover:opacity-10 transition-all">
                    <MapIcon size={24}/>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-3xl p-5 rounded-[2.2rem] border border-slate-200 dark:border-slate-800 transition-all hover:border-amber-500/40 relative overflow-hidden group shadow-sm hover:shadow-xl dark:shadow-none hover:-translate-y-1">
                  <div className="flex items-center gap-2 text-amber-500 mb-2 font-black uppercase tracking-widest text-[9px]">
                    <Mountain size={12}/> Apex
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.maxAlt || '--'} <span className="text-[10px] text-slate-400 font-bold ml-1">M</span></div>
                  <div className="absolute right-4 top-4 opacity-5 group-hover:opacity-10 transition-all">
                    <Mountain size={24}/>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-3xl p-5 rounded-[2.2rem] border border-slate-200 dark:border-slate-800 transition-all hover:border-rose-500/40 relative overflow-hidden group shadow-sm hover:shadow-xl dark:shadow-none hover:-translate-y-1">
                  <div className="flex items-center gap-2 text-rose-500 mb-2 font-black uppercase tracking-widest text-[9px]">
                    <ArrowBigUp size={12}/> Ascent
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.accGain} <span className="text-[10px] text-slate-400 font-bold ml-1">M</span></div>
                  <div className="absolute right-4 top-4 opacity-5 group-hover:opacity-10 transition-all">
                    <ArrowUpDown size={24}/>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-slate-900/40 backdrop-blur-3xl p-5 rounded-[2.2rem] border border-slate-200 dark:border-slate-800 transition-all hover:border-blue-500/40 relative overflow-hidden group shadow-sm hover:shadow-xl dark:shadow-none hover:-translate-y-1">
                  <div className="flex items-center gap-2 text-blue-500 mb-2 font-black uppercase tracking-widest text-[9px]">
                    <Gauge size={12}/> Level
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{stats.difficultyLabel}</div>
                  <div className="absolute right-4 top-4 opacity-5 group-hover:opacity-10 transition-all">
                    <Zap size={24}/>
                  </div>
                </div>
              </div>

              {/* Technical Intelligence */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-4 bg-slate-100/50 dark:bg-slate-800/20 rounded-[1.8rem] border border-transparent dark:border-white/5 flex flex-col items-center justify-center text-center">
                  <Clock size={12} className="text-slate-400 mb-1.5"/>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Time</span>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{stats.durationStr}</span>
                </div>
                <div className="p-4 bg-slate-100/50 dark:bg-slate-800/20 rounded-[1.8rem] border border-transparent dark:border-white/5 flex flex-col items-center justify-center text-center">
                  <Activity size={12} className="text-slate-400 mb-1.5"/>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Pace</span>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{stats.movingPace} <span className="text-[8px]">km/h</span></span>
                </div>
                <div className="p-4 bg-slate-100/50 dark:bg-slate-800/20 rounded-[1.8rem] border border-transparent dark:border-white/5 flex flex-col items-center justify-center text-center">
                  <Camera size={12} className="text-slate-400 mb-1.5"/>
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Gear</span>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate w-full px-2" title={stats.topCamera}>{stats.topCamera}</span>
                </div>
              </div>

              {/* Advanced Physiological Data */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="p-4 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-[1.8rem] border border-emerald-500/10 flex items-center gap-3">
                   <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-500">
                      <Wind size={14}/>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/60">Oxygen Est.</span>
                      <span className="text-[14px] font-black text-slate-900 dark:text-white">{stats.o2Saturation}% <span className="text-[10px] text-slate-400 text-slate-500">SpO2</span></span>
                   </div>
                </div>
                <div className="p-4 bg-rose-500/5 dark:bg-rose-500/10 rounded-[1.8rem] border border-rose-500/10 flex items-center gap-3">
                   <div className="p-2 bg-rose-500/20 rounded-xl text-rose-500">
                      <Zap size={14}/>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-widest text-rose-500/60">Energy Exp.</span>
                      <span className="text-[14px] font-black text-slate-900 dark:text-white">{stats.caloriesBurned} <span className="text-[10px] text-slate-400 text-slate-500">KCAL</span></span>
                   </div>
                </div>
              </div>

              {/* AI Narrative Section */}
              <div className="bg-emerald-950/20 backdrop-blur-3xl p-6 rounded-[2.5rem] border border-emerald-500/10 shadow-2xl overflow-hidden relative group">
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500 rounded-2xl text-white shadow-xl shadow-emerald-500/40 group-hover:scale-110 transition-transform">
                      {isNarrating ? <Zap size={14} className="animate-spin" /> : <Sparkles size={14}/>}
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/60">Mission Intel</div>
                      <div className="text-[13px] font-black text-white uppercase tracking-tight">Expedition Summary</div>
                    </div>
                  </div>
                  {!narrativeData && !isNarrating && (
                    <button 
                      onClick={handleGenerateNarrative}
                      className="text-[10px] font-black uppercase bg-emerald-500 text-white px-6 py-2.5 rounded-full hover:bg-emerald-400 transition-all active:scale-95 shadow-xl shadow-emerald-500/20 flex items-center gap-2"
                    >
                      Process Log <ChevronRight size={12}/>
                    </button>
                  )}
                </div>
                
                <div className="relative z-10">
                  {isNarrating ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="h-2 bg-slate-800 rounded-full w-full"></div>
                      <div className="h-2 bg-slate-800 rounded-full w-[90%]"></div>
                      <div className="h-2 bg-slate-800 rounded-full w-[80%]"></div>
                      <div className="h-2 bg-slate-800 rounded-full w-[60%]"></div>
                    </div>
                  ) : narrativeData ? (
                    <div className="space-y-6">
                      <div className="prose prose-invert prose-xs max-w-none text-slate-300 font-medium leading-relaxed prose-p:mb-4">
                        <Markdown>{narrativeData.narrative}</Markdown>
                      </div>
                      
                      {/* Milestones Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-emerald-500/10">
                        {narrativeData.milestones.map((m, i) => (
                          <div key={i} className="flex flex-col gap-1 p-3 bg-white/5 dark:bg-black/20 rounded-2xl border border-white/5 group/ms hover:border-emerald-500/20 transition-all">
                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/60 lowercase">{m.label}</span>
                            <span className="text-[10px] font-black text-white truncate">{m.value}</span>
                          </div>
                        ))}
                      </div>

                      {/* Expert Insights */}
                      <div className="space-y-2 mt-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/40 mb-3 flex items-center gap-2">
                           <ShieldAlert size={10}/> Tactical Advisories
                        </div>
                        {narrativeData.expertInsights.map((insight, i) => (
                          <div key={i} className="flex items-start gap-2.5 p-3 rounded-2xl bg-black/10 border border-white/5">
                            <div className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></div>
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center py-4 space-y-2">
                       <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Awaiting Command Input</span>
                       <p className="text-[11px] text-slate-600 font-medium">Connect your photos to generate an AI-powered topographic and narrative report.</p>
                    </div>
                  )}
                </div>
                
                {/* Decorative background element */}
                <div className="absolute -right-20 -bottom-20 opacity-5 pointer-events-none text-emerald-500 group-hover:opacity-10 transition-opacity duration-1000">
                  <Globe size={240} />
                </div>
              </div>

              <ElevationProfile photos={photos} activePhotoId={activePhotoId} onHover={setActivePhotoId} />
            </div>
          )}

          <div className="space-y-6">
            <div className="flex flex-col gap-4 sticky top-0 bg-white dark:bg-[#0f172a] py-3 z-10 border-b border-transparent dark:border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Expedition Waypoints</h3>
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wide">{photos.length} Recorded Nodes</span>
                </div>
                <div className="flex gap-2">
                  {photos.length > 0 && (
                    <>
                      <button 
                        onClick={exportGPX}
                        title="Export GPX Route"
                        className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
                      >
                        <Download size={18}/>
                      </button>
                      <button 
                        onClick={handleClearAll}
                        title="Clear All Mission Assets"
                        className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all active:scale-95 group/clear"
                      >
                        <Trash size={18}/>
                      </button>
                      <button onClick={() => setIsGalleryOpen(true)} className="flex items-center gap-2 px-5 py-3 bg-emerald-500 text-white text-[10px] font-black rounded-full hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-widest active:scale-95">
                        <ImageIcon size={16}/> Archive
                      </button>
                    </>
                  )}
                </div>
              </div>

              {photos.length > 0 && (
                <div className="flex items-center gap-2 pt-1 fade-in">
                   <button 
                    onClick={cycleSort}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-emerald-500 transition-all border border-slate-100 dark:border-slate-800"
                   >
                     <Filter size={10}/> {sortKey}
                   </button>
                   <button 
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-emerald-500 transition-all border border-slate-100 dark:border-slate-800"
                   >
                     {sortOrder === 'asc' ? <SortAsc size={12}/> : <SortDesc size={12}/>} {sortOrder}
                   </button>
                </div>
              )}
            </div>

            <div className="space-y-3 pb-24">
              {sortedPhotos.map((photo, idx) => (
                <div 
                  key={photo.id}
                  className={`group relative flex items-center gap-4 p-4 rounded-[1.75rem] border-2 transition-all cursor-pointer ${activePhotoId === photo.id ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 shadow-xl shadow-emerald-500/5' : 'border-slate-50 dark:border-slate-800/30 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  onClick={() => {
                    setActivePhotoId(photo.id);
                    if (activePhotoId === photo.id) { 
                      const gIdx = sortedPhotos.findIndex(p => p.id === photo.id);
                      setGalleryIndex(gIdx); 
                      setIsGalleryOpen(true); 
                    }
                  }}
                >
                  <div className="relative w-14 h-14 xl:w-16 xl:h-16 rounded-[1.25rem] overflow-hidden flex-shrink-0 shadow-inner bg-slate-100 dark:bg-slate-800">
                    <img src={photo.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" loading="lazy" />
                    {photo.anomaly && (
                      <div className="absolute top-1 left-1 z-10" title={photo.anomaly}>
                        <div className="bg-rose-500 text-white p-1 rounded-md shadow-lg animate-pulse">
                          <AlertCircle size={8}/>
                        </div>
                      </div>
                    )}
                    {!photo.location && (
                      <div className="absolute inset-0 bg-rose-500/40 flex items-center justify-center backdrop-blur-[2px]"><MapPin size={18} className="text-white" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs xl:text-sm font-black truncate mb-1 dark:text-slate-100 group-hover:text-emerald-500 transition-colors">{photo.name}</p>
                    <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                      <div className="flex items-center gap-1 text-[10px] font-bold"><Calendar size={10}/> {photo.location?.timestamp?.toLocaleDateString() || '--'}</div>
                      {photo.location?.alt !== undefined && <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500/80"><Mountain size={10}/> {Math.round(photo.location.alt)}m</div>}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <button 
                      onClick={(e) => deletePhoto(photo.id, e)}
                      title="Discard Waypoint"
                      className="p-2 text-slate-300 dark:text-slate-700 hover:text-rose-500 dark:hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 active:scale-90"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={18} className={`transition-all ${activePhotoId === photo.id ? 'translate-x-1 text-emerald-500 scale-110' : 'text-slate-200 dark:text-slate-800 group-hover:text-slate-400'}`} />
                  </div>
                </div>
              ))}
              
              {photos.length === 0 && (
                <div className="py-24 flex flex-col items-center text-center group fade-in">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-10 border border-slate-100 dark:border-slate-800 transition-all group-hover:scale-110 group-hover:border-emerald-500/20">
                    <Box size={40} className="text-slate-200 dark:text-slate-700" />
                  </div>
                  <h4 className="text-lg font-black mb-3 uppercase tracking-tight dark:text-slate-100">Expedition Zero</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] max-w-[200px] leading-relaxed">Import GPS-tagged photos to initiate trail mapping</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {isGalleryOpen && (
        <Gallery 
          photos={sortedPhotos} 
          initialIndex={galleryIndex} 
          onClose={() => setIsGalleryOpen(false)} 
          onPhotoChange={(id) => setActivePhotoId(id)}
        />
      )}
    </div>
  );
};

export default App;