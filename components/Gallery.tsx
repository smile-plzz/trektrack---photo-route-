
import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, ChevronLeft, ChevronRight,
  Calendar, Mountain, Clock, MapPin, 
  Download, Camera as CameraIcon,
  Info, Target
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
  const [showInfo, setShowInfo] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  ));
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
    <div className="fixed inset-0 z-[1000] bg-[#020617] flex animate-in fade-in duration-300 select-none overflow-hidden">
      <aside className={`hidden md:flex bg-[#0f172a] border-r border-slate-800 transition-all duration-300 ease-in-out flex-col ${showInfo ? 'w-[360px] lg:w-[400px] opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        <GalleryDetails
          photo={currentPhoto}
          index={index}
          total={photos.length}
          onDownload={handleDownload}
          onClose={onClose}
        />
      </aside>

      <div className="flex-1 relative flex flex-col bg-[#020617] overflow-hidden">
        <div className="absolute top-0 inset-x-0 p-3 sm:p-5 lg:p-6 flex justify-between items-center z-50 pointer-events-none">
          <div className="px-3 py-2 bg-black/50 backdrop-blur-xl border border-white/10 rounded-full text-white text-xs font-semibold pointer-events-auto shadow-lg">
             Photo {index + 1} / {photos.length}
          </div>
          <div className="flex gap-2 pointer-events-auto">
            <button 
              onClick={() => setShowInfo(!showInfo)}
              title={showInfo ? 'Hide details' : 'Show details'}
              className={`p-3 rounded-full backdrop-blur-xl transition-all shadow-lg ${showInfo ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white border border-white/10 hover:bg-white/20'}`}
            >
              <Target size={18}/>
            </button>
            <button 
              onClick={handleDownload}
              title="Download photo"
              className="p-3 bg-white/10 text-white rounded-full backdrop-blur-xl border border-white/10 hover:bg-white/20 transition-all shadow-lg"
            >
              <Download size={18}/>
            </button>
            <button 
              onClick={onClose}
              title="Close gallery"
              className="p-3 bg-white/10 text-white rounded-full backdrop-blur-xl border border-white/10 hover:bg-rose-500 transition-all shadow-lg"
            >
              <X size={18}/>
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center relative px-4 py-20 sm:p-20 overflow-hidden bg-[#020617]">
          <button 
            onClick={() => navigate('prev')}
            className="absolute left-3 sm:left-5 p-3 sm:p-4 text-white bg-black/40 hover:bg-emerald-500 transition-all z-50 backdrop-blur-xl rounded-full border border-white/10 shadow-lg"
          >
            <ChevronLeft size={24}/>
          </button>
          
          <div className="w-full h-full flex items-center justify-center animate-in fade-in duration-700">
            <img 
              key={currentPhoto.id}
              src={currentPhoto.url} 
              className="max-w-full max-h-full object-contain pointer-events-none shadow-[0_24px_70px_rgba(0,0,0,0.65)]" 
              alt={currentPhoto.name}
            />
          </div>

          <button 
            onClick={() => navigate('next')}
            className="absolute right-3 sm:right-5 p-3 sm:p-4 text-white bg-black/40 hover:bg-emerald-500 transition-all z-50 backdrop-blur-xl rounded-full border border-white/10 shadow-lg"
          >
            <ChevronRight size={24}/>
          </button>
        </div>

        {showInfo && (
          <div className="md:hidden absolute left-3 right-3 bottom-[92px] max-h-[42vh] overflow-y-auto no-scrollbar rounded-2xl bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 shadow-xl z-50">
            <GalleryDetails
              photo={currentPhoto}
              index={index}
              total={photos.length}
              onDownload={handleDownload}
              onClose={onClose}
              compact
            />
          </div>
        )}

        <div className="px-3 sm:px-6 py-3 sm:py-4 bg-[#0f172a]/80 backdrop-blur-xl border-t border-white/5 flex items-center sm:justify-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar z-40">
          {photos.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => { setIndex(idx); onPhotoChange(p.id); }}
              className={`relative flex-shrink-0 w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden border-2 transition-all duration-200 ${idx === index ? 'border-emerald-500 shadow-lg z-10' : 'border-transparent opacity-45 hover:opacity-100'}`}
              aria-label={`Open photo ${idx + 1}`}
            >
              <img src={p.url} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const DetailItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    <div className="p-2.5 bg-slate-800/60 text-emerald-400 rounded-xl border border-white/5">{icon}</div>
    <div className="min-w-0">
      <p className="text-slate-500 text-xs font-medium mb-1">{label}</p>
      <p className="text-white font-semibold text-sm break-words">{value}</p>
    </div>
  </div>
);

const GalleryDetails = ({
  photo,
  index,
  total,
  onDownload,
  onClose,
  compact = false
}: {
  photo: TrekPhoto;
  index: number;
  total: number;
  onDownload: () => void;
  onClose: () => void;
  compact?: boolean;
}) => (
  <div className={`${compact ? 'p-4' : 'p-6 lg:p-8'} h-full flex flex-col overflow-y-auto no-scrollbar`}>
    <header className={compact ? 'mb-5' : 'mb-8'}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-emerald-500 rounded-xl text-white shadow-sm">
          <Info size={18}/>
        </div>
        <div className="px-3 py-1.5 bg-slate-800/60 rounded-full text-xs font-semibold text-slate-300 border border-slate-800">
          Photo {index + 1} of {total}
        </div>
      </div>
      <h2 className="text-white font-bold text-xl lg:text-2xl mb-3 tracking-tight leading-tight line-clamp-2">{photo.name}</h2>

      <div className="grid grid-cols-1 gap-4">
        <DetailItem icon={<Calendar size={18}/>} label="Date" value={photo.location?.timestamp?.toLocaleDateString() || 'No data'} />
        <DetailItem icon={<Clock size={18}/>} label="Time" value={photo.location?.timestamp?.toLocaleTimeString() || 'No data'} />
        <DetailItem icon={<Mountain size={18}/>} label="Elevation" value={photo.location?.alt !== undefined ? `${Math.round(photo.location.alt)} m` : 'No data'} />
        <DetailItem
          icon={<MapPin size={18}/>}
          label="Location"
          value={photo.location ? <span className="font-mono text-xs text-slate-300">{photo.location.lat.toFixed(6)}, {photo.location.lng.toFixed(6)}</span> : 'No GPS'}
        />
      </div>
    </header>

    {photo.camera && (
      <div className={`${compact ? 'pt-4' : 'pt-6'} border-t border-slate-800/70 space-y-4`}>
        <div className="flex items-center gap-2 text-slate-400">
          <CameraIcon size={16}/>
          <span className="text-xs font-semibold">Camera</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/30 p-3 rounded-xl border border-white/5">
            <p className="text-slate-500 text-xs font-medium mb-1">Device</p>
            <p className="text-white text-xs font-semibold truncate">{photo.camera.model || 'Unknown'}</p>
          </div>
          <div className="bg-slate-800/30 p-3 rounded-xl border border-white/5">
            <p className="text-slate-500 text-xs font-medium mb-1">Aperture</p>
            <p className="text-white text-xs font-semibold">{photo.camera.fNumber ? `f/${photo.camera.fNumber}` : '--'}</p>
          </div>
          <div className="bg-slate-800/30 p-3 rounded-xl border border-white/5">
            <p className="text-slate-500 text-xs font-medium mb-1">Shutter</p>
            <p className="text-white text-xs font-semibold">{photo.camera.exposureTime || '--'}s</p>
          </div>
          <div className="bg-slate-800/30 p-3 rounded-xl border border-white/5">
            <p className="text-slate-500 text-xs font-medium mb-1">ISO</p>
            <p className="text-white text-xs font-semibold">{photo.camera.iso || '--'}</p>
          </div>
        </div>
      </div>
    )}

    {!compact && (
      <footer className="mt-auto pt-8 grid grid-cols-2 gap-3">
        <button 
          onClick={onDownload}
          className="flex items-center justify-center gap-2 py-3 bg-white/5 text-white rounded-xl text-xs font-semibold hover:bg-white/10 transition-all border border-white/10"
        >
          <Download size={16}/> Download
        </button>
        <button 
          onClick={onClose}
          className="flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
        >
          Close
        </button>
      </footer>
    )}
  </div>
);

export default Gallery;
