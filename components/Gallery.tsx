import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, ChevronLeft, ChevronRight, 
  Calendar, Mountain, Clock, MapPin, 
  Download, Camera as CameraIcon,
  Maximize, Target, Info
} from 'lucide-react';
import { TrekPhoto } from '../types';

interface GalleryProps {
  photos: TrekPhoto[];
  initialIndex: number;
  onClose: () => void;
  onPhotoChange: (id: string) => void;
}

const Gallery: React.FC<GalleryProps> = ({ photos, initialIndex, onClose, onPhotoChange }) => {
  const [index, setIndex] = useState(initialIndex);
  const [showInfo, setShowInfo] = useState(true);
  const currentPhoto = photos[index];

  const navigate = useCallback((dir: 'prev' | 'next') => {
    const newIdx = dir === 'next' 
      ? (index + 1) % photos.length 
      : (index - 1 + photos.length) % photos.length;
    setIndex(newIdx);
    onPhotoChange(photos[newIdx].id);
  }, [index, photos, onPhotoChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') navigate('next');
      if (e.key === 'ArrowLeft') navigate('prev');
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onClose]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentPhoto.url;
    link.download = currentPhoto.name;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[#020617] flex flex-col lg:flex-row animate-in fade-in duration-500 select-none overflow-hidden">
      {/* Dynamic Info Panel */}
      <aside className={`bg-[#0f172a] border-r border-slate-800/50 transition-all duration-500 ease-in-out flex flex-col ${showInfo ? 'w-full lg:w-[400px] opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="p-8 lg:p-10 h-full flex flex-col overflow-y-auto no-scrollbar">
          <header className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-xl shadow-emerald-500/20">
                <Maximize size={24}/>
              </div>
              <div className="px-4 py-1.5 bg-slate-800/40 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] border border-slate-800">
                Asset ${index + 1}
              </div>
            </div>
            
            <h2 className="text-white font-black text-2xl lg:text-3xl mb-4 tracking-tighter leading-tight uppercase line-clamp-3">
              {currentPhoto.name}
            </h2>
            <div className="w-12 h-1 bg-emerald-500 rounded-full mb-12"></div>
            
            <div className="grid grid-cols-1 gap-6">
              <InfoItem icon={<Calendar size={20}/>} label="Expedition Date" value={currentPhoto.location?.timestamp?.toLocaleDateString() || 'N/A'} color="emerald" />
              <InfoItem icon={<Clock size={20}/>} label="Time Index" value={currentPhoto.location?.timestamp?.toLocaleTimeString() || 'N/A'} color="blue" />
              <InfoItem icon={<Mountain size={20}/>} label="Altitude" value={currentPhoto.location?.alt !== undefined ? `${Math.round(currentPhoto.location.alt)} Meters` : 'N/A'} color="amber" />
              <InfoItem icon={<MapPin size={20}/>} label="Coordinate Set" value={currentPhoto.location ? `${currentPhoto.location.lat.toFixed(6)}, ${currentPhoto.location.lng.toFixed(6)}` : 'N/A'} color="rose" mono />
            </div>
          </header>

          <div className="flex-1 space-y-10">
            {currentPhoto.camera && (
              <div className="pt-10 border-t border-slate-800/50 space-y-6">
                <div className="flex items-center gap-3 text-slate-500">
                  <CameraIcon size={18}/>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Hardware Analysis</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SpecCard label="Module" value={currentPhoto.camera.model} />
                  <SpecCard label="Aperture" value={currentPhoto.camera.fNumber ? `f/${currentPhoto.camera.fNumber}` : null} />
                  <SpecCard label="Exposure" value={currentPhoto.camera.exposureTime ? `${currentPhoto.camera.exposureTime}s` : null} />
                  <SpecCard label="ISO" value={currentPhoto.camera.iso} />
                </div>
              </div>
            )}
          </div>

          <footer className="mt-12 grid grid-cols-2 gap-4">
             <button 
              onClick={handleDownload}
              className="flex items-center justify-center gap-3 py-4 bg-slate-800/50 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all border border-slate-800"
            >
              <Download size={18}/> Export
            </button>
            <button 
              onClick={onClose}
              className="flex items-center justify-center gap-3 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20"
            >
              Close
            </button>
          </footer>
        </div>
      </aside>

      {/* Main Viewing Canvas */}
      <div className="flex-1 relative flex flex-col bg-[#020617] overflow-hidden">
        {/* Navigation Overlays */}
        <div className="absolute top-0 inset-x-0 p-8 flex justify-between items-center z-50 pointer-events-none">
          <div className="px-6 py-2.5 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full text-white text-[10px] font-black tracking-[0.25em] uppercase pointer-events-auto shadow-2xl">
             Log Entry {index + 1} / {photos.length}
          </div>
          <div className="flex gap-3 pointer-events-auto">
            <button 
              onClick={() => setShowInfo(!showInfo)}
              className={`p-3.5 rounded-2xl backdrop-blur-2xl transition-all shadow-2xl ${showInfo ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}`}
              title="Toggle Telemetry Panel"
            >
              <Target size={22}/>
            </button>
            <button 
              onClick={onClose}
              className="p-3.5 bg-rose-500 text-white rounded-2xl backdrop-blur-2xl shadow-2xl hover:bg-rose-600 transition-all"
            >
              <X size={22}/>
            </button>
          </div>
        </div>

        {/* Viewport */}
        <div className="flex-1 flex items-center justify-center relative p-12 overflow-hidden bg-[radial-gradient(circle_at_center,_#0f172a_0%,_#020617_100%)]">
          <button 
            onClick={() => navigate('prev')}
            className="absolute left-6 lg:left-10 p-5 lg:p-6 text-white bg-black/40 hover:bg-emerald-500 transition-all z-50 backdrop-blur-3xl rounded-full border border-white/5 shadow-2xl group"
          >
            <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          
          <div className="w-full h-full flex items-center justify-center p-4">
            <img 
              key={currentPhoto.id}
              src={currentPhoto.url} 
              className="max-w-full max-h-full object-contain pointer-events-none shadow-[0_50px_120px_rgba(0,0,0,0.9)] rounded-lg animate-in zoom-in-95 duration-500" 
              alt={currentPhoto.name}
            />
          </div>

          <button 
            onClick={() => navigate('next')}
            className="absolute right-6 lg:right-10 p-5 lg:p-6 text-white bg-black/40 hover:bg-emerald-500 transition-all z-50 backdrop-blur-3xl rounded-full border border-white/5 shadow-2xl group"
          >
            <ChevronRight size={32} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Improved Thumbnail Slider */}
        <div className="px-10 py-8 bg-[#0f172a]/60 backdrop-blur-3xl border-t border-white/5 flex items-center justify-center gap-4 overflow-x-auto no-scrollbar z-50">
          {photos.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => { setIndex(idx); onPhotoChange(p.id); }}
              className={`relative flex-shrink-0 w-20 lg:w-28 h-14 lg:h-20 rounded-xl overflow-hidden border-2 transition-all duration-300 ${idx === index ? 'border-emerald-500 scale-110 shadow-2xl z-10' : 'border-transparent opacity-25 hover:opacity-100'}`}
            >
              <img src={p.url} className="w-full h-full object-cover" loading="lazy" />
              {idx === index && <div className="absolute inset-0 bg-emerald-500/10" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Sub-components for cleaner Gallery code
const InfoItem = ({ icon, label, value, color, mono = false }: { icon: any, label: string, value: string, color: string, mono?: boolean }) => {
  const colors: any = {
    emerald: 'text-emerald-500',
    blue: 'text-blue-400',
    amber: 'text-amber-500',
    rose: 'text-rose-500'
  };
  return (
    <div className="flex items-start gap-4 group">
      <div className={`p-3 bg-slate-800/50 rounded-xl border border-white/5 group-hover:bg-slate-800 transition-colors ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1"> {label} </p>
        <p className={`text-white font-black text-sm lg:text-base ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
};

const SpecCard = ({ label, value }: { label: string, value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <div className="bg-slate-800/20 p-4 rounded-xl border border-white/5 hover:bg-slate-800/40 transition-colors">
      <p className="text-slate-500 text-[9px] font-black uppercase mb-1">{label}</p>
      <p className="text-white text-[11px] font-black truncate">{value}</p>
    </div>
  );
};

export default Gallery;