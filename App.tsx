
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  Upload, Trash2, Info, Compass, 
  Footprints, Mountain,
  Calendar, Download, MapPin, 
  ChevronRight, Activity, Image as ImageIcon,
  Box, Sun, Moon, AlertTriangle, CheckCircle,
  Trash
} from 'lucide-react';
import { TrekPhoto } from './types';
import { extractGpsData, extractCameraMetadata, fileToBase64 } from './services/exifService';
import Map from './components/Map';
import ElevationProfile from './components/ElevationProfile';
import Gallery from './components/Gallery';
import heic2any from 'heic2any';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const isSupportedImage = (file: File) => {
  const name = file.name.toLowerCase();
  return file.type.startsWith('image/') || name.endsWith('.heic') || name.endsWith('.heif');
};

const createPhotoId = () => {
  if ('crypto' in window && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const App: React.FC = () => {
  const [photos, setPhotos] = useState<TrekPhoto[]>([]);
  const [activePhotoId, setActivePhotoId] = useState<string>();
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [uploadFeedback, setUploadFeedback] = useState<{ text: string; tone: 'success' | 'warning' }>();
  const latestPhotosRef = useRef<TrekPhoto[]>([]);

  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      return (a.location?.timestamp?.getTime() || 0) - (b.location?.timestamp?.getTime() || 0);
    });
  }, [sortedPhotos]);

  const geotaggedCount = useMemo(() => photos.filter(p => p.location).length, [photos]);

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

  useEffect(() => {
    latestPhotosRef.current = photos;
  }, [photos]);

  useEffect(() => () => {
    latestPhotosRef.current.forEach(p => URL.revokeObjectURL(p.url));
  }, []);

  const processFiles = async (files: File[]) => {
    const supportedFiles = files.filter(isSupportedImage);
    if (supportedFiles.length === 0) {
      setUploadFeedback({ text: 'No supported image files found.', tone: 'warning' });
      return;
    }

    setIsConverting(true);
    setUploadFeedback(undefined);
    
    const processPromises = supportedFiles.map(async (file) => {
      const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');
      
      try {
        const [location, camera, displayBlob] = await Promise.all([
          extractGpsData(file),
          extractCameraMetadata(file),
          isHeic ? heic2any({ blob: file, toType: 'image/jpeg', quality: 0.6 }) : Promise.resolve(file)
        ]);
        
        const finalBlob = Array.isArray(displayBlob) ? displayBlob[0] : displayBlob;
        const finalMimeType = isHeic ? 'image/jpeg' : file.type;

        const base64 = await fileToBase64(finalBlob as Blob);
        const objectUrl = URL.createObjectURL(finalBlob as Blob);
        
        return {
          id: createPhotoId(),
          name: file.name,
          url: objectUrl,
          base64,
          location,
          camera,
          mimeType: finalMimeType
        } as TrekPhoto;
      } catch (err) {
        console.error("Failed to process photo:", file.name, err);
        return null;
      }
    });

    try {
      const results = await Promise.all(processPromises);
      const validNewPhotos = results.filter((p): p is TrekPhoto => p !== null);
      const skipped = files.length - supportedFiles.length;
      const failed = supportedFiles.length - validNewPhotos.length;

      if (validNewPhotos.length > 0) {
        setPhotos(prev => [...prev, ...validNewPhotos]);
      }

      const notes = [
        validNewPhotos.length ? `${validNewPhotos.length} imported` : '',
        failed ? `${failed} failed` : '',
        skipped ? `${skipped} skipped` : ''
      ].filter(Boolean);
      setUploadFeedback(notes.length ? {
        text: notes.join(', ') + '.',
        tone: failed || skipped ? 'warning' : 'success'
      } : undefined);
    } finally {
      setIsConverting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    processFiles(files);
    e.target.value = '';
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
    if (window.confirm("Remove all photos and route data?")) {
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
  <metadata><name>TrekTrack Route ${new Date().toLocaleDateString()}</name></metadata>
  <trk><name>Photo Route</name><trkseg>`;
    
    validPhotos.forEach(p => {
      gpx += `
      <trkpt lat="${p.location!.lat}" lon="${p.location!.lng}">
        ${p.location!.alt !== undefined ? `<ele>${p.location!.alt}</ele>` : ''}
        ${p.location!.timestamp ? `<time>${p.location!.timestamp.toISOString()}</time>` : ''}
        <name>${escapeXml(p.name)}</name>
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
      
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-emerald-500/10 dark:bg-emerald-500/20 backdrop-blur-lg border-4 border-dashed border-emerald-500 flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-slate-900 p-10 sm:p-12 rounded-2xl shadow-xl flex flex-col items-center gap-4 animate-in zoom-in-95 border border-emerald-500/30">
            <div className="p-5 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/30">
               <Upload size={44} strokeWidth={2.25}/>
            </div>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Drop photos to import</p>
          </div>
        </div>
      )}

      <aside 
        className="w-full lg:w-[440px] xl:w-[460px] flex flex-col h-[56vh] min-h-[360px] lg:min-h-0 lg:h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] z-20 shadow-xl transition-all"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFiles(Array.from(e.dataTransfer.files)); }}
      >
        <header className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl z-30">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500 rounded-xl text-white shadow-sm">
                <Compass size={22}/>
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight leading-none mb-1">TrekTrack</h1>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Photo route mapper</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setDarkMode(!darkMode)} 
                title={darkMode ? "Switch to Day" : "Switch to Night"}
                className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
              >
                {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
              </button>
            </div>
          </div>

          <label className={`group relative flex items-center justify-center gap-4 w-full p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${isConverting ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 cursor-wait' : 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5'}`}>
            <div className={`p-3 rounded-xl transition-all ${isConverting ? 'bg-slate-200 dark:bg-slate-700 text-slate-400' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm group-hover:bg-emerald-500 group-hover:text-white'}`}>
              {isConverting ? <Activity className="animate-spin" size={24}/> : <Upload size={24}/>}
            </div>
            <div className="text-left">
              <span className="block font-semibold text-base">{isConverting ? 'Reading photo metadata...' : 'Add photos'}</span>
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                GPS EXIF, HEIC, and JPEG supported
              </span>
            </div>
            {!isConverting && <input type="file" multiple accept="image/*,.heic,.heif" onChange={handleFileUpload} className="hidden" />}
          </label>

          {uploadFeedback && (
            <div className={`mt-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-[11px] font-bold ${
              uploadFeedback.tone === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
            }`}>
              {uploadFeedback.tone === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              <span>{uploadFeedback.text}</span>
            </div>
          )}
        </header>

        <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto no-scrollbar">
          {stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
	                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-2 text-emerald-500 mb-2"><Footprints size={14}/><span className="text-xs font-semibold">Distance</span></div>
                  <div className="text-2xl font-bold tracking-tight">{stats.distance} <span className="text-xs text-slate-400 font-medium">km</span></div>
                </div>
	                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-2 text-amber-500 mb-2"><Mountain size={14}/><span className="text-xs font-semibold">High point</span></div>
                  <div className="text-2xl font-bold tracking-tight">{stats.maxAlt ?? '--'} <span className="text-xs text-slate-400 font-medium">m</span></div>
                </div>
              </div>
              <ElevationProfile photos={photos} activePhotoId={activePhotoId} onHover={setActivePhotoId} />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-[#0f172a] py-3 z-10 border-b border-slate-100 dark:border-slate-800/70 gap-3">
              <div className="flex flex-col">
	                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Photos</h3>
	                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{geotaggedCount} mapped of {photos.length}</span>
              </div>
              <div className="flex gap-2 flex-wrap justify-end">
                {photos.length > 0 && (
                  <>
	                    <button 
	                      onClick={exportGPX}
                          disabled={geotaggedCount === 0}
	                      title="Export GPX"
	                      className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Download size={18}/>
                    </button>
                    <button 
                      onClick={handleClearAll}
                      title="Clear photos"
                      className="p-2.5 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-95 group/clear"
                    >
                      <Trash size={18} className="group-hover/clear:rotate-12 transition-transform"/>
                    </button>
                    <button onClick={() => setIsGalleryOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-white text-xs font-semibold rounded-xl hover:bg-emerald-600 transition-all shadow-sm shadow-emerald-500/20 active:scale-95">
                      <ImageIcon size={16}/> Gallery
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3 pb-24">
              {sortedPhotos.map((photo, idx) => (
                <div 
                  key={photo.id}
                  className={`group relative flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${activePhotoId === photo.id ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10 shadow-sm shadow-emerald-500/10' : 'border-slate-100 dark:border-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  onClick={() => {
                    setActivePhotoId(photo.id);
                    if (activePhotoId === photo.id) { setGalleryIndex(idx); setIsGalleryOpen(true); }
                  }}
                >
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-inner bg-slate-100 dark:bg-slate-800">
                    <img src={photo.url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" loading="lazy" />
                    {!photo.location && (
                      <div className="absolute inset-0 bg-rose-500/40 flex items-center justify-center backdrop-blur-[2px]"><MapPin size={20} className="text-white" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate dark:text-slate-100">{photo.name}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${photo.location ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300'}`}>
                        {photo.location ? 'Mapped' : 'No GPS'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 text-xs font-medium"><Calendar size={12}/> {photo.location?.timestamp?.toLocaleDateString() || '--'}</div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"><Mountain size={12}/> {photo.location?.alt !== undefined ? `${Math.round(photo.location.alt)}m` : '--'}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <button 
                      onClick={(e) => deletePhoto(photo.id, e)}
                      aria-label={`Delete ${photo.name}`}
                      title="Delete photo"
                      className="p-2.5 text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:translate-x-2 sm:group-hover:translate-x-0 active:scale-90"
                    >
                      <Trash2 size={18} />
                    </button>
                    <ChevronRight size={20} className={`transition-all ${activePhotoId === photo.id ? 'translate-x-1 text-emerald-500' : 'text-slate-300 dark:text-slate-700 group-hover:text-slate-400'}`} />
                  </div>
                </div>
              ))}
              
              {photos.length === 0 && (
                <div className="py-16 sm:py-20 flex flex-col items-center text-center group">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100 dark:border-slate-800 transition-all">
                    <Box size={40} className="text-slate-300 dark:text-slate-600" />
                  </div>
	                  <h4 className="text-lg font-semibold mb-2 dark:text-slate-100">No photos yet</h4>
	                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[280px] leading-relaxed">Add geotagged photos to draw your route and elevation profile.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 relative min-h-0 bg-slate-100 dark:bg-[#020617] transition-colors duration-500">
        <Map photos={photos} activePhotoId={activePhotoId} onPhotoSelect={setActivePhotoId} />
        
        <div className="absolute left-3 right-3 top-3 lg:left-6 lg:right-auto lg:top-6 flex flex-col gap-4 z-20 pointer-events-none lg:max-w-sm">
          <div className="p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 dark:border-slate-800/50 pointer-events-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-emerald-500 rounded-xl text-white shadow-sm"><Info size={18}/></div>
              <span className="text-sm font-semibold dark:text-slate-100">Route summary</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Tracking <span className="text-slate-900 dark:text-emerald-400 font-black">{geotaggedCount} mapped photos</span>. 
              {stats ? ` Route distance is ${stats.distance}km.` : " Add at least two GPS photos to calculate distance."}
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
