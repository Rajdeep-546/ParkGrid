import {useEffect, useMemo, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {PARKING_THUMBNAILS} from '../../data/indiaParkingConfig';
import {cn} from '../../lib/utils';
import {getGoogleMapsApiKey} from '../maps/PlacesProvider';

interface PhotoAttribution {
  displayName?: string;
  uri?: string;
}

interface ParkingThumbnailProps {
  thumbnailId: string;
  customImageUrl?: string;
  gallery?: string[];
  attribution?: PhotoAttribution;
  attributions?: PhotoAttribution[];
  lat?: number;
  lng?: number;
  alt: string;
  className?: string;
}

export function ParkingThumbnail({
  thumbnailId,
  customImageUrl,
  gallery,
  attribution,
  attributions,
  lat,
  lng,
  alt,
  className,
}: ParkingThumbnailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [failedUrls, setFailedUrls] = useState<Record<string, boolean>>({});

  const slides = useMemo(() => {
    const raw =
      gallery && gallery.length > 0
        ? gallery
        : customImageUrl
          ? [customImageUrl]
          : [];
    const primary = raw
      .map((url, idx) => ({
        url,
        attr: attributions?.[idx] ?? (idx === 0 ? attribution : undefined),
      }))
      .filter((item) => Boolean(item.url) && !failedUrls[item.url]);

    if (primary.length > 0) {
      return primary;
    }

    const apiKey = getGoogleMapsApiKey();
    if (
      apiKey &&
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x480&location=${lat},${lng}&fov=85&pitch=4&return_error_code=true&key=${apiKey}`;
      if (!failedUrls[svUrl]) {
        return [
          {
            url: svUrl,
            attr: {displayName: 'Google Street View'},
          },
        ];
      }
    }

    return [];
  }, [gallery, customImageUrl, attributions, attribution, lat, lng, failedUrls]);

  useEffect(() => {
    setActiveSlide(0);
    if (scrollerRef.current) {
      scrollerRef.current.scrollLeft = 0;
    }
  }, [customImageUrl, gallery, lat, lng]);

  const scrollToIndex = (nextIdx: number) => {
    const el = scrollerRef.current;
    if (!el || slides.length === 0) return;
    const clamped = ((nextIdx % slides.length) + slides.length) % slides.length;
    el.scrollTo({
      left: clamped * el.clientWidth,
      behavior: 'smooth',
    });
    setActiveSlide(clamped);
  };

  if (slides.length > 0) {
    const safeIndex = Math.min(activeSlide, slides.length - 1);
    const activeAttr = slides[safeIndex]?.attr;

    return (
      <div className={cn('relative overflow-hidden bg-slate-900', className)}>
        <div
          ref={scrollerRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.clientWidth > 0) {
              const idx = Math.round(el.scrollLeft / el.clientWidth);
              if (idx !== activeSlide) {
                setActiveSlide(Math.max(0, Math.min(slides.length - 1, idx)));
              }
            }
          }}
          className="flex h-full w-full overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
        >
          {slides.map((slide, idx) => (
            <div
              key={`${slide.url}_${idx}`}
              className="relative h-full w-full shrink-0 snap-center"
            >
              <img
                src={slide.url}
                alt={`${alt} — photo ${idx + 1}`}
                loading={idx === 0 ? 'eager' : 'lazy'}
                onError={() =>
                  setFailedUrls((prev) => ({...prev, [slide.url]: true}))
                }
                className="block h-full w-full object-cover"
              />
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-slate-950/25" />

        {/* Photo count badge & attribution */}
        {slides.length > 1 && (
          <div className="pointer-events-none absolute top-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-100 backdrop-blur-sm tabular-nums">
            {safeIndex + 1}/{slides.length}
          </div>
        )}
        {activeAttr?.displayName && (
          <div className="pointer-events-none absolute top-2 right-2 max-w-[55%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[9px] text-zinc-200 backdrop-blur-sm">
            {activeAttr.displayName === 'Google Street View'
              ? 'Street View'
              : `Photo: ${activeAttr.displayName}`}
          </div>
        )}

        {/* Scroll Left/Right Controls + Snap Dots */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous parking photo"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                scrollToIndex(safeIndex - 1);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-black/80 transition-opacity backdrop-blur-sm cursor-pointer z-10"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next parking photo"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                scrollToIndex(safeIndex + 1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-black/80 transition-opacity backdrop-blur-sm cursor-pointer z-10"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <div
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 backdrop-blur-sm z-10"
            >
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`View photo ${idx + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToIndex(idx);
                  }}
                  className={cn(
                    'h-1.5 rounded-full transition-all cursor-pointer',
                    idx === safeIndex
                      ? 'w-3.5 bg-white'
                      : 'w-1.5 bg-white/50 hover:bg-white/80'
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const preset =
    PARKING_THUMBNAILS.find((item) => item.id === thumbnailId) || PARKING_THUMBNAILS[0];

  const isEv = thumbnailId === 'ev-superhub' || thumbnailId === 'solar-residential';
  const isAtrium = thumbnailId === 'glass-atrium' || thumbnailId === 'transit-plaza';

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn('relative overflow-hidden select-none', className)}
      style={{
        background: `linear-gradient(135deg, ${preset.accentFrom} 0%, ${preset.accentTo} 100%)`,
      }}
    >
      <svg
        viewBox="0 0 400 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full opacity-90"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id={`grid-${preset.id}`}
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="400" height="220" fill={`url(#grid-${preset.id})`} />

        {/* Architectural structural deck lines */}
        <path
          d="M0 165 L400 135 L400 220 L0 220 Z"
          fill="rgba(15, 23, 42, 0.55)"
        />
        <line
          x1="48"
          y1="162"
          x2="132"
          y2="195"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="2"
        />
        <line
          x1="145"
          y1="154"
          x2="232"
          y2="188"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="2"
        />
        <line
          x1="244"
          y1="147"
          x2="335"
          y2="181"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="2"
        />

        {/* Overhead architectural canopy */}
        {isAtrium ? (
          <g>
            <path
              d="M36 54 L200 28 L364 54 L364 110 L36 110 Z"
              fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="1.2"
            />
            <line
              x1="120"
              y1="41"
              x2="120"
              y2="156"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="2"
            />
            <line
              x1="280"
              y1="41"
              x2="280"
              y2="144"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="2"
            />
          </g>
        ) : (
          <g>
            <rect
              x="44"
              y="46"
              width="312"
              height="18"
              rx="4"
              fill="rgba(255,255,255,0.09)"
              stroke="rgba(255,255,255,0.15)"
            />
            <rect x="64" y="64" width="6" height="92" fill="rgba(255,255,255,0.12)" />
            <rect x="330" y="64" width="6" height="80" fill="rgba(255,255,255,0.12)" />
          </g>
        )}

        {/* Bay status light strips */}
        <rect
          x="86"
          y="96"
          width="36"
          height="5"
          rx="2.5"
          fill={isEv ? '#10B981' : '#3B82F6'}
        />
        <rect x="182" y="90" width="36" height="5" rx="2.5" fill="#10B981" />
        <rect x="278" y="84" width="36" height="5" rx="2.5" fill="#F59E0B" />

        {/* Subtle geometric vehicle silhouette in bay 3 */}
        <path
          d="M262 150 C268 134 282 128 304 128 C322 128 334 135 340 148 L345 157 L258 161 Z"
          fill="rgba(255,255,255,0.14)"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1.2"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />
    </div>
  );
}
