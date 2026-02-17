import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { PhotoCollection, GeoInfo } from '../types';
import { CITY_DATABASE } from '../data/geoData';
import * as topojson from 'topojson-client';
import { geoMercator, geoPath, GeoPermissibleObjects } from 'd3-geo';
import worldData from 'world-atlas/countries-110m.json';
import './Footprints.css';

type Continent = 'all' | 'asia' | 'europe';

/* ============================================================
   Extract GeoJSON features from TopoJSON
   ============================================================ */
const worldTopo = worldData as any;
const countriesGeo = topojson.feature(worldTopo, worldTopo.objects.countries) as any;
const landGeo = topojson.feature(worldTopo, worldTopo.objects.land) as any;

/* ============================================================
   Projection configs per continent view
   ============================================================ */
interface ViewConfig {
  center: [number, number]; // [lng, lat]
  scale: number;
  width: number;
  height: number;
}

const VIEW_CONFIGS: Record<Continent, ViewConfig> = {
  all:    { center: [60, 30],  scale: 280, width: 960, height: 500 },
  asia:   { center: [105, 28], scale: 500, width: 960, height: 580 },
  europe: { center: [15, 52],  scale: 700, width: 960, height: 600 },
};

/* ============================================================
   Component
   ============================================================ */

const Footprints: React.FC = () => {
  const { collections, litCities } = useData();
  const [activeContinent, setActiveContinent] = useState<Continent>('all');
  const [selectedCity, setSelectedCity] = useState<PhotoCollection | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; city: string; country: string; hasPhoto: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const litCountryCodes = useMemo(() => {
    const codes = new Set<string>();
    collections.forEach(c => { if (c.geo) codes.add(c.geo.countryCode); });
    litCities.forEach(g => codes.add(g.countryCode));
    return codes;
  }, [collections, litCities]);

  const allLitCityGeos = useMemo(() => {
    const seen = new Set<string>();
    const geos: { geo: GeoInfo; collection?: PhotoCollection }[] = [];
    collections.forEach(c => {
      if (c.geo) {
        const key = `${c.geo.continent}:${c.geo.city}`;
        if (!seen.has(key)) { seen.add(key); geos.push({ geo: c.geo, collection: c }); }
      }
    });
    litCities.forEach(g => {
      const key = `${g.continent}:${g.city}`;
      if (!seen.has(key)) { seen.add(key); geos.push({ geo: g }); }
    });
    return geos;
  }, [collections, litCities]);

  const filteredGeos = useMemo(() =>
    activeContinent === 'all' ? allLitCityGeos : allLitCityGeos.filter(g => g.geo.continent === activeContinent),
    [allLitCityGeos, activeContinent]
  );

  const totalCities = allLitCityGeos.length;
  const totalCountries = litCountryCodes.size;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedCity(null); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const vc = VIEW_CONFIGS[activeContinent];

  // D3 projection and path generator
  const projection = useMemo(() =>
    geoMercator()
      .center(vc.center)
      .scale(vc.scale)
      .translate([vc.width / 2, vc.height / 2]),
    [vc]
  );

  const pathGenerator = useMemo(() => geoPath().projection(projection), [projection]);

  // Map country numeric IDs to our country codes for highlighting
  // The world-atlas uses numeric IDs (ISO 3166-1 numeric)
  // We'll match by checking if a city with that country code is lit
  const countryNumericToCode: Record<string, string> = useMemo(() => {
    // ISO 3166-1 numeric to alpha-2 mapping for countries we care about
    const mapping: Record<string, string> = {
      '156': 'CN', '392': 'JP', '410': 'KR', '764': 'TH', '704': 'VN',
      '702': 'SG', '458': 'MY', '360': 'ID', '608': 'PH', '356': 'IN',
      '496': 'MN', '348': 'HU', '250': 'FR', '826': 'GB', '380': 'IT',
      '276': 'DE', '724': 'ES', '040': 'AT', '203': 'CZ', '528': 'NL',
      '056': 'BE', '620': 'PT', '756': 'CH', '616': 'PL', '300': 'GR',
      '752': 'SE', '578': 'NO', '246': 'FI', '208': 'DK', '642': 'RO',
      '792': 'TR', '643': 'RU', '804': 'UA', '191': 'HR',
      // Extra for context
      '840': 'US', '124': 'CA', '036': 'AU', '076': 'BR', '032': 'AR',
      '484': 'MX', '818': 'EG', '710': 'ZA', '682': 'SA', '784': 'AE',
    };
    return mapping;
  }, []);

  const getLatLng = useCallback((geo: GeoInfo): { lat: number; lng: number } => {
    if (geo.lat && geo.lng) return { lat: geo.lat, lng: geo.lng };
    const entry = CITY_DATABASE.find(c => c.city === geo.city && c.continent === geo.continent);
    return entry ? { lat: entry.lat, lng: entry.lng } : { lat: 0, lng: 0 };
  }, []);

  const projectCity = useCallback((lat: number, lng: number): { x: number; y: number } | null => {
    const p = projection([lng, lat]);
    return p ? { x: p[0], y: p[1] } : null;
  }, [projection]);

  const handleMarkerHover = useCallback((e: React.MouseEvent, city: string, country: string, hasPhoto: boolean) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 12,
      city,
      country,
      hasPhoto,
    });
    setHoveredCity(city);
  }, []);

  // Determine which features to show based on continent
  const visibleFeatures = useMemo(() => {
    const features = countriesGeo.features as any[];
    if (activeContinent === 'all') {
      // Show Asia + Europe region roughly
      return features;
    }
    // Filter to approximate bounding boxes
    return features;
  }, [activeContinent]);

  const renderPreview = () => {
    if (!selectedCity) return null;
    const allImages = [
      { url: selectedCity.coverImage, alt: selectedCity.title },
      ...selectedCity.photos.map(p => ({ url: p.url || p.thumbnail, alt: p.alt })),
    ];
    const uniqueImages = allImages.filter((img, idx, arr) => arr.findIndex(a => a.url === img.url) === idx);
    const currentImage = uniqueImages[previewPage] || uniqueImages[0];

    return (
      <div className="preview-overlay" onClick={() => setSelectedCity(null)}>
        <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
          <button className="preview-close" onClick={() => setSelectedCity(null)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="preview-image-area">
            <img src={currentImage.url} alt={currentImage.alt} className="preview-image" draggable={false} />
            {uniqueImages.length > 1 && (
              <>
                <button className="preview-nav preview-nav-prev" onClick={() => setPreviewPage(p => p > 0 ? p - 1 : uniqueImages.length - 1)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button className="preview-nav preview-nav-next" onClick={() => setPreviewPage(p => p < uniqueImages.length - 1 ? p + 1 : 0)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </>
            )}
            <div className="preview-counter">{previewPage + 1} / {uniqueImages.length}</div>
          </div>
          <div className="preview-info">
            <h3 className="preview-title">{selectedCity.title}</h3>
            <p className="preview-location">{selectedCity.geo?.city}, {selectedCity.geo?.country} · {selectedCity.year}</p>
            {selectedCity.description && <p className="preview-desc">{selectedCity.description}</p>}
            <Link to={`/gallery/${selectedCity.id}`} className="preview-link" onClick={() => setSelectedCity(null)}>
              View Full Gallery →
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="footprints-page">
      <div className="footprints-header">
        <h1 className="footprints-title">Footprints</h1>
        <p className="footprints-subtitle">我走过的地方</p>
        <div className="footprints-stats">
          <div className="stat-item">
            <span className="stat-number">{totalCountries}</span>
            <span className="stat-label">countries</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-number">{totalCities}</span>
            <span className="stat-label">cities</span>
          </div>
        </div>
      </div>

      <div className="continent-filter">
        <button className={`filter-btn ${activeContinent === 'all' ? 'active' : ''}`} onClick={() => setActiveContinent('all')}>All</button>
        <button className={`filter-btn ${activeContinent === 'asia' ? 'active' : ''}`} onClick={() => setActiveContinent('asia')}>Asia · 亚洲</button>
        <button className={`filter-btn ${activeContinent === 'europe' ? 'active' : ''}`} onClick={() => setActiveContinent('europe')}>Europe · 欧洲</button>
      </div>

      <div className="map-section visible">
        <div className="svg-map-container">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${vc.width} ${vc.height}`}
            className="footprints-svg-map"
            onMouseLeave={() => { setTooltip(null); setHoveredCity(null); }}
          >
            <defs>
              <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#faf9f7" />
                <stop offset="100%" stopColor="#f5f3ef" />
              </linearGradient>
              <filter id="landShadow" x="-2%" y="-2%" width="104%" height="104%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#00000015" />
              </filter>
              <filter id="markerGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Ocean background */}
            <rect x="0" y="0" width={vc.width} height={vc.height} fill="url(#oceanGradient)" />

            {/* Graticule */}
            {(() => {
              const lines: JSX.Element[] = [];
              // Longitude lines
              for (let lng = -180; lng <= 180; lng += 30) {
                const pts: string[] = [];
                for (let lat = -85; lat <= 85; lat += 1) {
                  const p = projection([lng, lat]);
                  if (p) pts.push(`${p[0]},${p[1]}`);
                }
                if (pts.length > 1) {
                  lines.push(<polyline key={`lng-${lng}`} points={pts.join(' ')} className="graticule-line" />);
                }
              }
              // Latitude lines
              for (let lat = -60; lat <= 80; lat += 30) {
                const pts: string[] = [];
                for (let lng = -180; lng <= 180; lng += 1) {
                  const p = projection([lng, lat]);
                  if (p) pts.push(`${p[0]},${p[1]}`);
                }
                if (pts.length > 1) {
                  lines.push(<polyline key={`lat-${lat}`} points={pts.join(' ')} className="graticule-line" />);
                }
              }
              return lines;
            })()}

            {/* Land mass (merged outline for subtle shadow) */}
            {landGeo.features.map((feature: any, i: number) => {
              const d = pathGenerator(feature as GeoPermissibleObjects);
              return d ? (
                <path key={`land-${i}`} d={d} className="land-shadow" filter="url(#landShadow)" />
              ) : null;
            })}

            {/* Country shapes */}
            {visibleFeatures.map((feature: any, i: number) => {
              const d = pathGenerator(feature as GeoPermissibleObjects);
              if (!d) return null;
              const numId = feature.id;
              const code = countryNumericToCode[numId] || '';
              const isLit = litCountryCodes.has(code);
              return (
                <path
                  key={`country-${i}`}
                  d={d}
                  className={`country-path ${isLit ? 'country-lit' : 'country-dim'}`}
                />
              );
            })}

            {/* Country borders */}
            {visibleFeatures.map((feature: any, i: number) => {
              const d = pathGenerator(feature as GeoPermissibleObjects);
              return d ? (
                <path key={`border-${i}`} d={d} className="country-border" />
              ) : null;
            })}

            {/* City markers */}
            {filteredGeos.map(({ geo, collection }) => {
              const { lat, lng } = getLatLng(geo);
              const pos = projectCity(lat, lng);
              if (!pos) return null;
              const { x, y } = pos;
              const hasPhoto = !!collection;
              const isHovered = hoveredCity === geo.city;

              // Check if within viewBox
              if (x < -20 || x > vc.width + 20 || y < -20 || y > vc.height + 20) return null;

              return (
                <g key={`${geo.continent}-${geo.city}`}>
                  {hasPhoto && (
                    <>
                      <circle cx={x} cy={y} r={20} className="marker-pulse-outer" />
                      <circle cx={x} cy={y} r={14} className="marker-pulse-inner" />
                    </>
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={hasPhoto ? (isHovered ? 6.5 : 5) : (isHovered ? 4 : 3)}
                    className={`city-marker ${hasPhoto ? 'marker-photo' : 'marker-nophoto'} ${isHovered ? 'marker-hovered' : ''}`}
                    onMouseEnter={(e) => handleMarkerHover(e, geo.city, geo.country, hasPhoto)}
                    onMouseMove={(e) => handleMarkerHover(e, geo.city, geo.country, hasPhoto)}
                    onMouseLeave={() => { setTooltip(null); setHoveredCity(null); }}
                    onClick={() => {
                      if (collection) { setSelectedCity(collection); setPreviewPage(0); }
                    }}
                  />
                  {hasPhoto && (
                    <text
                      x={x}
                      y={y - (isHovered ? 11 : 9)}
                      className={`city-label ${isHovered ? 'city-label-hover' : ''}`}
                    >
                      {geo.city}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="map-tooltip"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <span className="tooltip-city">{tooltip.city}</span>
              <span className="tooltip-country">{tooltip.country}</span>
            </div>
          )}
        </div>
      </div>

      <section className="city-list-section">
        <h2 className="city-list-title">
          {activeContinent === 'all' ? 'All Cities' : activeContinent === 'asia' ? 'Asia · 亚洲' : 'Europe · 欧洲'}
        </h2>
        <div className="city-list">
          {collections
            .filter(c => c.geo && (activeContinent === 'all' || c.geo.continent === activeContinent))
            .map(collection => (
              <div key={collection.id} className="city-card" onClick={() => { setSelectedCity(collection); setPreviewPage(0); }}>
                <div className="city-card-image">
                  <img src={collection.coverImage} alt={collection.title} loading="lazy" />
                  <div className="city-card-overlay">
                    <span className="city-card-count">{collection.photos.length} photos</span>
                  </div>
                </div>
                <div className="city-card-info">
                  <h4 className="city-card-name">{collection.geo?.city}</h4>
                  <p className="city-card-country">{collection.geo?.country} · {collection.year}</p>
                </div>
              </div>
            ))}
        </div>
      </section>

      {renderPreview()}
    </div>
  );
};

export default Footprints;
