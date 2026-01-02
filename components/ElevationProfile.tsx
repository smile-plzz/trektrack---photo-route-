
import React, { useMemo } from 'react';
import { TrekPhoto } from '../types';

interface ElevationProfileProps {
  photos: TrekPhoto[];
  activePhotoId?: string;
  onHover: (id: string | undefined) => void;
}

const ElevationProfile: React.FC<ElevationProfileProps> = ({ photos, activePhotoId, onHover }) => {
  const data = useMemo(() => {
    return photos
      .filter(p => p.location && p.location.alt !== undefined)
      .sort((a, b) => (a.location?.timestamp?.getTime() || 0) - (b.location?.timestamp?.getTime() || 0));
  }, [photos]);

  if (data.length < 2) return null;

  const width = 340;
  const height = 80;
  const padding = 5;

  const minAlt = Math.min(...data.map(d => d.location!.alt!));
  const maxAlt = Math.max(...data.map(d => d.location!.alt!));
  const altRange = maxAlt - minAlt || 1;

  const points = data.map((p, i) => {
    const x = (i / (data.length - 1)) * (width - 2 * padding) + padding;
    const y = height - ((p.location!.alt! - minAlt) / altRange) * (height - 2 * padding) - padding;
    return { x, y, id: p.id };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaData = `${pathData} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className="mt-4 p-4 bg-slate-900 rounded-2xl shadow-inner overflow-hidden relative group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Elevation Profile</span>
        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{maxAlt}m peak</span>
      </div>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-20 overflow-visible cursor-crosshair"
        onMouseLeave={() => onHover(undefined)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        <line x1="0" y1={height} x2={width} y2={height} stroke="#334155" strokeWidth="1" />
        
        {/* Area */}
        <path d={areaData} fill="url(#areaGrad)" />
        
        {/* Line */}
        <path 
          d={pathData} 
          fill="none" 
          stroke="#10b981" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />

        {/* Hover detection zones */}
        {points.map((p) => (
          <rect
            key={p.id}
            x={p.x - width / data.length / 2}
            y={0}
            width={width / data.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => onHover(p.id)}
            className="hover:fill-white/5 transition-colors"
          />
        ))}

        {/* Active Point Indicator */}
        {activePhotoId && points.find(p => p.id === activePhotoId) && (
          <g>
            <line 
              x1={points.find(p => p.id === activePhotoId)!.x} 
              y1={0} 
              x2={points.find(p => p.id === activePhotoId)!.x} 
              y2={height} 
              stroke="#10b981" 
              strokeWidth="1" 
              strokeDasharray="2,2" 
            />
            <circle 
              cx={points.find(p => p.id === activePhotoId)!.x} 
              cy={points.find(p => p.id === activePhotoId)!.y} 
              r="4" 
              fill="#10b981" 
              stroke="#fff" 
              strokeWidth="2" 
            />
          </g>
        )}
      </svg>
      <div className="flex justify-between mt-1 text-[8px] font-bold text-slate-500 uppercase">
        <span>Start</span>
        <span>{minAlt}m baseline</span>
        <span>Finish</span>
      </div>
    </div>
  );
};

export default ElevationProfile;
