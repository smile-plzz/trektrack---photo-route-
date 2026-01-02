
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Upload, Trash2, Info, Compass, 
  Footprints, Mountain, Map as MapIcon, 
  Calendar, Download, RotateCcw, MapPin, 
  ChevronRight, Activity, Image as ImageIcon,
  Clock, Box, Sun, Moon, X, Target, Zap, 
  Trash
} from 'lucide-react';
import { TrekPhoto } from './types';
import { extractGpsData, extractCameraMetadata, fileToBase64 } from './services/exifService';
import Map from './components/Map';
import ElevationProfile from './components/ElevationProfile';
import Gallery from './components/Gallery';
import heic2any from 'https://esm.sh/heic2any';

const App: React.FC = () => {
  const [photos, setPhotos] = useState<TrekPhoto[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string>();
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Sync dark mode class and ensure it's robust
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.className = 'bg-slate-950 text-slate-100 overflow-hidden';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.className = 'bg-slate-50 text-slate-900 overflow-hidden';
    }
  }, [darkMode]);

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
  }, [photos]);

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsConverting(true);
    
    // FAST PROCESSING: Parallel execution using Promise.all
    const processPromises = files.map(async (file) => {
      const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
      
      try {
        // Extracting metadata and converting HEIC concurrently
        const [location, camera, displayBlob] = await Promise.all([
          extractGpsData(file),
          extractCameraMetadata(file),
          isHeic ? heic2any({ blob: file, toType: 'image/jpeg', quality: 0.6 }) : Promise.resolve(file)
        ]);
        
        const finalBlob = Array.isArray(displayBlob) ? displayBlob[0] : displayBlob;
        const finalMimeType = isHeic ? 'image/jpeg' : file.type;

        // Base64 and Object URL creation
        const [base64] = await Promise.all([
          fileToBase64(finalBlob as File)
        ]);
        
        const objectUrl = URL.createObjectURL(finalBlob as Blob);
        
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
        console.error("Failed to process asset:", file.name, err);
        return null;
      }
    });

    const results = await Promise.all(processPromises);
    const validNewPhotos = results.filter((p): p is TrekPhoto => p !== null);
    
    setPhotos(prev => [...prev, ...validNewPhotos]);
    setIsConverting(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    processFiles(files);
  };

  const deletePhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotos(prev => {
      const photoToRemove = prev.find(p => p.id === id);
      if (photoToRemove) URL.revokeObjectURL(photoToRemove.url);
      return prev.filter(p => p.id !== id);
    });
    if (activePhotoId === id) setActivePhotoId(undefined);
  };

  const handleClearAll = useCallback(() => {
    if (window.confirm("Permanently wipe all expedition waypoints and data?")) {
      // Vital: Clean up memory
      photos.forEach(p => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
      setPhotos([]);
      setActivePhotoId(undefined);
      setIsGalleryOpen(false);
      setGalleryIndex(0);
    }
  }, [photos]);

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      return (a.location?.timestamp?.getTime() || 0) - (b.location?.timestamp?.getTime() || 0);
    });
  }, [photos]);

  const stats = useMemo(() => {
    const gpsPhotos = photos.filter(p => p.location).sort((a, b) => 
      (a.location?.timestamp?.getTime() || 0) - (b.location?.timestamp?.getTime() || 0)
    );
    if (gpsPhotos.length < 2) return null;
    
    let dist = 0, maxA = -Infinity;
    for (let i = 0; i < gpsPhotos.length - 1; i++) {
      const p1 = gpsPhotos[i].location!, p2 = gpsPhotos[i + 1].location!;
      const R = 6371; // km
      const dLat = (p2.lat - p1.lat) * Math.PI / 180, dLon = (p2.lng - p1.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLon/2)**2;
      dist += R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
      if (p1.alt !== undefined) maxA = Math.max(maxA, p1.alt);
    }
    const last = gpsPhotos[gpsPhotos.length-1].location!;
    if (last.alt !== undefined) maxA = Math.max(maxA, last.alt);

    return {
      distance: dist.toFixed(2),
      maxAlt: maxA !== -Infinity ? Math.round(maxA) : null,
      duration: gpsPhotos[0].location?.timestamp && gpsPhotos[gpsPhotos.length-1].location?.timestamp 
        ? Math.round((gpsPhotos[gpsPhotos.length-1].location!.timestamp!.getTime() - gpsPhotos[0].location!.timestamp!.getTime()) / 60000)
        : null
    };
  }, [photos]);

  const exportGPX = () => {
    const validPhotos = sortedPhotos.filter(p => p.location);
    if (validPhotos.length === 0) return;

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrekTrack" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Expedition Export ${new Date().toLocaleDateString()}</name></metadata>
  <trk><name>Digital Trail</name><trkseg>`;
    
    validPhotos.forEach(p => {
      gpx += `
      <trkpt lat="${p.location!.lat}" lon="${p.location!.lng}">
        ${p.location!.alt ? `<ele>${p.location!.alt}</ele>` : ''}
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

  return (
    <div className={`flex flex-col lg:flex-row h-screen w-full overflow-hidden transition-all duration-500 ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Enhanced Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-emerald-500/10 dark:bg-emerald-500/20 backdrop-blur-xl border-[12px] border-dashed border-emerald-500 flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-slate-900 p-20 rounded-[4rem] shadow-2xl flex flex-col items-center gap-6 transform animate-in zoom-in-95 border border-emerald-500/30">
            <div className="p-8 bg-emerald-500 rounded-full text-white shadow-2xl shadow-emerald-500/40 animate-bounce">
               <Upload size={80} strokeWidth={2.5}/>
            </div>
            <p className="text-4xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Import Waypoints</p>
          </div>
        </div>
      )}

      <aside 
        className="w-full lg:w-[460px] flex flex-col h-[45vh] lg:h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] z-20 shadow-2xl transition-all"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(Array.from(e.dataTransfer.files)); }}
      >
        <header className="p-8 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl z-30">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20 rotate-3 transition-transform hover:rotate-0">
                <Compass size={24}/>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tighter leading-none mb-1">TrekTrack</h1>
                <p className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Digital Expedition Log</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setDarkMode(!darkMode)} 
                title={darkMode ? "Switch to Day" : "Switch to Night"}
                className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
              >
                {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
              </button>
            </div>
          </div>

          <label className={`group relative flex flex-col items-center justify-center gap-4 w-full p-8 rounded-[2.5rem] border-2 border-dashed transition-all cursor-pointer ${isConverting ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 cursor-wait' : 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5'}`}>
            <div className={`p-4 rounded-2xl transition-all ${isConverting ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white'}`}>
              {isConverting ? <Activity className="animate-spin" size={28}/> : <Upload size={28}/>}
            </div>
            <div className="text-center">
              <span className="block font-black text-base">{isConverting ? 'Decoding EXIF...' : 'Deploy Journey Assets'}</span>
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center justify-center gap-2">
                <Zap size={10} className="text-amber-500"/> Multi-thread Processing
              </span>
            </div>
            {!isConverting && <input type="file" multiple accept="image/*,.heic,.heif" onChange={handleFileUpload} className="hidden" />}
          </label>
        </header>

        <div className="flex-1 p-8 space-y-10 overflow-y-auto no-scrollbar">
          {stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 transition-all hover:border-emerald-500/20 group">
                  <div className="flex items-center gap-2 text-emerald-500 mb-2 group-hover:scale-110 origin-left transition-transform"><Footprints size={14}/><span className="text-[10px] font-black uppercase tracking-tighter">Distance</span></div>
                  <div className="text-3xl font-black tracking-tight">{stats.distance} <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">km</span></div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800/50 transition-all hover:border-amber-500/20 group">
                  <div className="flex items-center gap-2 text-amber-500 mb-2 group-hover:scale-110 origin-left transition-transform"><Mountain size={14}/><span className="text-[10px] font-black uppercase tracking-tighter">Elevation</span></div>
                  <div className="text-3xl font-black tracking-tight">{stats.maxAlt || '--'} <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">m</span></div>
                </div>
              </div>
              <ElevationProfile photos={photos} activePhotoId={activePhotoId} onHover={setActivePhotoId} />
            </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-[#0f172a] py-3 z-10 border-b border-transparent dark:border-white/5">
              <div className="flex flex-col">
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Expedition Waypoints</h3>
                <span className="text-[9px] font-bold text-emerald-500 uppercase">{photos.length} Captured Logs</span>
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
                      <Trash size={18} className="group-hover/clear:rotate-12 transition-transform"/>
                    </button>
                    <button onClick={() => setIsGalleryOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white text-[10px] font-black rounded-full hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 uppercase tracking-widest active:scale-95">
                      <ImageIcon size={16}/> Archive
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4 pb-24">
              {sortedPhotos.map((photo, idx) => (
                <div 
                  key={photo.id}
                  className={`group relative flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all cursor-pointer ${activePhotoId === photo.id ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10 shadow-2xl shadow-emerald-500/10' : 'border-slate-50 dark:border-slate-800/30 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  onClick={() => {
                    setActivePhotoId(photo.id);
                    if (activePhotoId === photo.id) { setGalleryIndex(idx); setIsGalleryOpen(true); }
                  }}
                >
                  <div className="relative w-16 h-16 rounded-[1.25rem] overflow-hidden flex-shrink-0 shadow-inner bg-slate-100 dark:bg-slate-800">
                    <img src={photo.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" loading="lazy" />
                    {!photo.location && (
                      <div className="absolute inset-0 bg-rose-500/40 flex items-center justify-center backdrop-blur-[2px]"><MapPin size={20} className="text-white" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate mb-1 dark:text-slate-100">{photo.name}</p>
                    <div className="flex items-center gap-4 text-slate-400 dark:text-slate-500">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold"><Calendar size={12}/> {photo.location?.timestamp?.toLocaleDateString() || '--'}</div>
                      {photo.location?.alt && <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500"><Mountain size={12}/> {Math.round(photo.location.alt)}m</div>}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <button 
                      onClick={(e) => deletePhoto(photo.id, e)}
                      title="Discard Waypoint"
                      className="p-2.5 text-slate-300 dark:text-slate-700 hover:text-rose-500 dark:hover:text-rose-400 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 active:scale-90"
                    >
                      <Trash2 size={18} />
                    </button>
                    <ChevronRight size={20} className={`transition-all ${activePhotoId === photo.id ? 'translate-x-1 text-emerald-500' : 'text-slate-300 dark:text-slate-700 group-hover:text-slate-400'}`} />
                  </div>
                </div>
              ))}
              
              {photos.length === 0 && (
                <div className="py-24 flex flex-col items-center text-center group">
                  <div className="w-28 h-28 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-10 border border-slate-100 dark:border-slate-800 transition-all group-hover:scale-110 group-hover:rotate-6">
                    <Box size={48} className="text-slate-200 dark:text-slate-700" />
                  </div>
                  <h4 className="text-xl font-black mb-3 uppercase tracking-tight dark:text-slate-100">Expedition Zero</h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.25em] max-w-[240px] leading-relaxed">Awaiting mission assets with GPS telemetry to map your trail</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 relative bg-slate-100 dark:bg-[#020617] transition-colors duration-500">
        <Map photos={photos} activePhotoId={activePhotoId} onPhotoSelect={setActivePhotoId} />
        
        {/* HUD Overlay */}
        <div className="absolute top-10 left-10 flex flex-col gap-6 z-20 pointer-events-none lg:max-w-sm">
          <div className="p-8 bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl rounded-[3rem] shadow-2xl border border-white/50 dark:border-slate-800/50 pointer-events-auto transition-all hover:scale-[1.02] group">
            <div className="flex items-center gap-4 mb-5">
              <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-xl group-hover:rotate-12 transition-transform"><Info size={22}/></div>
              <span className="text-sm font-black uppercase tracking-[0.3em] dark:text-slate-100">Expedition HUD</span>
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed font-bold uppercase tracking-tight">
              Tracking <span className="text-slate-900 dark:text-emerald-400 font-black">{photos.filter(p => p.location).length} Active Nodes</span>. 
              {stats ? ` Analyzing ${stats.distance}km of trail topology across the spatial grid.` : " Awaiting waypoint deployment."}
            </p>
          </div>
        </div>
      </main>

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
