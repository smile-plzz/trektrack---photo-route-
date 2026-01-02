
import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Maximize2, 
  Calendar, Mountain, Clock, MapPin, 
  Download, Camera as CameraIcon,
  Maximize, Target
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
    <div className="fixed inset-0 z-[1000] bg-[#020617] flex flex-col md:flex-row animate-in fade-in duration-500 select-none overflow-hidden">
      {/* Sidebar for Details */}
      <aside className={`bg-[#0f172a] border-r border-slate-800 transition-all duration-500 ease-in-out flex flex-col ${showInfo ? 'w-full md:w-[400px] opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="p-10 h-full flex flex-col overflow-y-auto no-scrollbar">
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg">
                <Maximize size={22}/>
              </div>
              <div className="px-4 py-1.5 bg-slate-800/50 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-800">
                Log Asset #{index + 1}
              </div>
            </div>
            <h2 className="text-white font-black text-3xl mb-4 tracking-tighter leading-tight uppercase line-clamp-2">{currentPhoto.name}</h2>
            <div className="w-12 h-1 bg-emerald-500/30 rounded-full mb-12"></div>
            
            <div className="space-y-8">
              <div className="flex items-start gap-5">
                <div className="p-3 bg-slate-800/50 text-emerald-500 rounded-xl border border-white/5"><Calendar size={20}/></div>
                <div>
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1.5">Expedition Date</p>
                  <p className="text-white font-black text-base">{currentPhoto.location?.timestamp?.toLocaleDateString() || 'No Data'}</p>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div className="p-3 bg-slate-800/50 text-blue-400 rounded-xl border border-white/5"><Clock size={20}/></div>
                <div>
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1.5">Time Stamp</p>
                  <p className="text-white font-black text-base">{currentPhoto.location?.timestamp?.toLocaleTimeString() || 'No Data'}</p>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div className="p-3 bg-slate-800/50 text-amber-500 rounded-xl border border-white/5"><Mountain size={20}/></div>
                <div>
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1.5">Recorded Elevation</p>
                  <p className="text-white font-black text-base">{currentPhoto.location?.alt ? `${Math.round(currentPhoto.location.alt)} Meters` : 'No Data'}</p>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div className="p-3 bg-slate-800/50 text-rose-500 rounded-xl border border-white/5"><MapPin size={20}/></div>
                <div>
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1.5">Spatial Data</p>
                  <p className="text-slate-400 font-mono text-[12px]">
                    {currentPhoto.location ? `${currentPhoto.location.lat.toFixed(6)}, ${currentPhoto.location.lng.toFixed(6)}` : 'Signal Obstructed'}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 space-y-12">
            {currentPhoto.camera && (
              <div className="pt-10 border-t border-slate-800/50 space-y-8">
                <div className="flex items-center gap-3 text-slate-500">
                  <CameraIcon size={18}/>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Hardware Specs</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/20 p-5 rounded-2xl border border-white/5 hover:bg-slate-800/40 transition-colors">
                    <p className="text-slate-500 text-[9px] font-black uppercase mb-1.5">Device</p>
                    <p className="text-white text-[11px] font-black truncate">{currentPhoto.camera.model || 'Unknown'}</p>
                  </div>
                  <div className="bg-slate-800/20 p-5 rounded-2xl border border-white/5 hover:bg-slate-800/40 transition-colors">
                    <p className="text-slate-500 text-[9px] font-black uppercase mb-1.5">Optics</p>
                    <p className="text-white text-[11px] font-black">{currentPhoto.camera.fNumber ? `f/${currentPhoto.camera.fNumber}` : '--'}</p>
                  </div>
                  <div className="bg-slate-800/20 p-5 rounded-2xl border border-white/5 hover:bg-slate-800/40 transition-colors">
                    <p className="text-slate-500 text-[9px] font-black uppercase mb-1.5">Shutter</p>
                    <p className="text-white text-[11px] font-black">{currentPhoto.camera.exposureTime || '--'}s</p>
                  </div>
                  <div className="bg-slate-800/20 p-5 rounded-2xl border border-white/5 hover:bg-slate-800/40 transition-colors">
                    <p className="text-slate-500 text-[9px] font-black uppercase mb-1.5">Sensor</p>
                    <p className="text-white text-[11px] font-black">ISO {currentPhoto.camera.iso || '--'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <footer className="mt-12 grid grid-cols-2 gap-4">
             <button 
              onClick={handleDownload}
              className="flex items-center justify-center gap-3 py-5 bg-white/5 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all border border-white/10"
            >
              <Download size={18}/> Export
            </button>
            <button 
              onClick={onClose}
              className="flex items-center justify-center gap-3 py-5 bg-emerald-500 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-2xl shadow-emerald-500/20"
            >
              Back
            </button>
          </footer>
        </div>
      </aside>

      {/* Main Viewing Area - FIXED Centering Logic */}
      <div className="flex-1 relative flex flex-col bg-[#020617] overflow-hidden">
        {/* Navigation Overlays */}
        <div className="absolute top-0 inset-x-0 p-10 flex justify-between items-center z-50 pointer-events-none">
          <div className="px-6 py-3 bg-black/50 backdrop-blur-2xl border border-white/10 rounded-full text-white text-[11px] font-black tracking-[0.2em] uppercase pointer-events-auto shadow-2xl">
             Expedition Log {index + 1} / {photos.length}
          </div>
          <div className="flex gap-4 pointer-events-auto">
            <button 
              onClick={() => setShowInfo(!showInfo)}
              className={`p-4 rounded-full backdrop-blur-2xl transition-all shadow-2xl ${showInfo ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}`}
            >
              <Target size={22}/>
            </button>
            <button 
              onClick={onClose}
              className="p-4 bg-white/10 text-white rounded-full backdrop-blur-2xl border border-white/10 hover:bg-rose-500 transition-all shadow-2xl"
            >
              <X size={22}/>
            </button>
          </div>
        </div>

        {/* Viewport - Using Flex Contain to solve zoom issues */}
        <div className="flex-1 flex items-center justify-center relative p-12 overflow-hidden bg-[radial-gradient(circle_at_center,_#0f172a_0%,_#020617_100%)]">
          <button 
            onClick={() => navigate('prev')}
            className="absolute left-10 p-6 text-white bg-black/40 hover:bg-emerald-500 transition-all z-50 backdrop-blur-3xl rounded-full border border-white/5 shadow-2xl"
          >
            <ChevronLeft size={32}/>
          </button>
          
          {/* Centered Image Container */}
          <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-700">
            <img 
              key={currentPhoto.id}
              src={currentPhoto.url} 
              className="max-w-full max-h-full object-contain pointer-events-none shadow-[0_40px_100px_rgba(0,0,0,0.8)]" 
              alt={currentPhoto.name}
            />
          </div>

          <button 
            onClick={() => navigate('next')}
            className="absolute right-10 p-6 text-white bg-black/40 hover:bg-emerald-500 transition-all z-50 backdrop-blur-3xl rounded-full border border-white/5 shadow-2xl"
          >
            <ChevronRight size={32}/>
          </button>
        </div>

        {/* Thumbnail Navigator */}
        <div className="px-10 py-8 bg-[#0f172a]/60 backdrop-blur-3xl border-t border-white/5 flex items-center justify-center gap-4 overflow-x-auto no-scrollbar z-50">
          {photos.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => { setIndex(idx); onPhotoChange(p.id); }}
              className={`relative flex-shrink-0 w-24 h-16 rounded-2xl overflow-hidden border-2 transition-all duration-300 ${idx === index ? 'border-emerald-500 scale-110 shadow-2xl z-10' : 'border-transparent opacity-30 hover:opacity-100 hover:scale-105'}`}
            >
              <img src={p.url} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Gallery;
