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

  const width = 400;
  const height = 100;
  const paddingX = 10;
  const paddingY = 15;

  const minAlt = Math.min(...data.map(d => d.location!.alt!));
  const maxAlt = Math.max(...data.map(d => d.location!.alt!));
  const altRange = maxAlt - minAlt || 1;

  const points = data.map((p, i) => {
    const x = (i / (data.length - 1)) * (width - 2 * paddingX) + paddingX;
    const y = height - ((p.location!.alt! - minAlt) / altRange) * (height - 2 * paddingY) - paddingY;
    return { x, y, id: p.id };
  });

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaData = `${pathData} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <div className="p-5 bg-slate-900 dark:bg-slate-950 rounded-[2rem] shadow-inner relative group border border-slate-800/50 fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Elevation Topography</span>
          <span className="text-[11px] font-black text-white uppercase tracking-tight">Varying Terrain</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Peak</span>
          <span className="text-[11px] font-black text-white uppercase tracking-tight">{maxAlt}m</span>
        </div>
      </div>
      
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-24 xl:h-28 overflow-visible cursor-crosshair select-none"
        onMouseLeave={() => onHover(undefined)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Baseline */}
        <line x1="0" y1={height} x2={width} y2={height} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        
        {/* Area */}
        <path d={areaData} fill="url(#areaGrad)" className="transition-all duration-700" />
        
        {/* Line */}
        <path 
          d={pathData} 
          fill="none" 
          stroke="#10b981" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          filter="url(#glow)"
          className="transition-all duration-700"
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
            className="hover:fill-emerald-500/5 transition-colors"
          />
        ))}

        {/* Active Point Indicator */}
        {activePhotoId && points.find(p => p.id === activePhotoId) && (
          <g className="animate-in fade-in duration-300">
            <line 
              x1={points.find(p => p.id === activePhotoId)!.x} 
              y1={0} 
              x2={points.find(p => p.id === activePhotoId)!.x} 
              y2={height} 
              stroke="#10b981" 
              strokeWidth="1.5" 
              strokeDasharray="3,3" 
            />
            <circle 
              cx={points.find(p => p.id === activePhotoId)!.x} 
              cy={points.find(p => p.id === activePhotoId)!.y} 
              r="5" 
              fill="#10b981" 
              stroke="#fff" 
              strokeWidth="2" 
            />
          </g>
        )}
      </svg>
      
      <div className="flex justify-between mt-3 px-1 text-[8px] font-black text-slate-500 uppercase tracking-widest border-t border-slate-800 pt-2">
        <span>Start Journey</span>
        <span>{minAlt}m Baseline</span>
        <span>Terminus</span>
      </div>
    </div>
  );
};

export default ElevationProfile;