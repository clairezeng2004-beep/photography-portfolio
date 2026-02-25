import React, { useEffect } from 'react';
import { useData } from '../context/DataContext';
import './About.css';

const About: React.FC = () => {
  const { aboutInfo, litCities, collections } = useData();

  useEffect(() => { document.title = '小冰块 - 摄影集 - 关于'; }, []);

  const sectionLabel = (key: string, fallback: string) =>
    aboutInfo.sectionLabels?.[key] || fallback;

  // Compute city/country counts from map data (litCities + collections)
  const mapCountryCount = (() => {
    const countries = new Set<string>();
    collections.forEach(c => { if (c.geo?.country) countries.add(c.geo.country); });
    litCities.forEach(g => { if (g.country) countries.add(g.country); });
    return countries.size;
  })();
  const mapCityCount = (() => {
    const cityKeys = new Set<string>();
    collections.forEach(c => { if (c.geo) cityKeys.add(`${c.geo.continent}:${c.geo.city}`); });
    litCities.forEach(g => cityKeys.add(`${g.continent}:${g.city}`));
    return cityKeys.size;
  })();

  const hasStats = mapCountryCount > 0 || mapCityCount > 0 || aboutInfo.stats.experience;

  // Helper to render builtin section extra items
  const builtinExtraItems = (sectionId: string) => {
    const section = (aboutInfo.customSections || []).find(s => s.id === sectionId);
    if (!section) return null;
    const validItems = section.items.filter(item => item.label || item.value);
    if (validItems.length === 0) return null;
    return (
      <div className="about-custom-items" style={{ marginTop: 16 }}>
        {validItems.map((item) => (
          <div key={item.id} className="about-custom-item">
            {item.label && <span className="about-custom-item-label">{item.label}</span>}
            {item.value && <span className="about-custom-item-value">{item.value}</span>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="about-page">
      <div className="about-body">
        <h1 className="about-title">About</h1>

        {/* Avatar Card */}
        <div className="about-avatar-card">
          <img
            src={aboutInfo.avatar}
            alt={aboutInfo.name}
          />
        </div>

        {/* Subtitle */}
        {aboutInfo.subtitle && (
          <p className="about-subtitle-text">{aboutInfo.subtitle}</p>
        )}

        {/* Bio */}
        <div className="about-text">
          {aboutInfo.bio.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {/* Stats */}
        {hasStats && (
          <div className="about-section">
            <h2 className="about-section-title">{sectionLabel('stats', '统计数据')}</h2>
            <div className="about-stats">
              {mapCountryCount > 0 && (
                <div className="about-stat-item">
                  <span className="about-stat-number">{mapCountryCount}</span>
                  <span className="about-stat-label">国家</span>
                </div>
              )}
              {mapCityCount > 0 && (
                <div className="about-stat-item">
                  <span className="about-stat-number">{mapCityCount}</span>
                  <span className="about-stat-label">城市</span>
                </div>
              )}
              {aboutInfo.stats.experience && (
                <div className="about-stat-item">
                  <span className="about-stat-number">{aboutInfo.stats.experience}</span>
                  <span className="about-stat-label">年经验</span>
                </div>
              )}
            </div>
            {builtinExtraItems('_builtin_stats')}
          </div>
        )}

        {/* Custom Sections — exclude _builtin_ entries */}
        {(aboutInfo.customSections || []).filter(s => !s.id.startsWith('_builtin_')).map((section) => {
          const validItems = section.items.filter(item => item.label || item.value || (item.subItems && item.subItems.length > 0));
          if (validItems.length === 0) return null;
          return (
            <div key={section.id} className="about-section">
              <h2 className="about-section-title">{section.title}</h2>
              <div className="about-custom-items">
                {validItems.map((item) => (
                  <div key={item.id} className="about-custom-item-group">
                    {(item.label || item.value) && (
                      <div className="about-custom-item">
                        {item.label && <span className="about-custom-item-label">{item.label}</span>}
                        {item.value && <span className="about-custom-item-value">{item.value}</span>}
                      </div>
                    )}
                    {item.subItems && item.subItems.filter(s => s.label || s.value).length > 0 && (
                      <div className="about-custom-subitems">
                        {item.subItems.filter(s => s.label || s.value).map((sub) => (
                          <div key={sub.id} className="about-custom-subitem">
                            {sub.label && <span className="about-custom-subitem-label">{sub.label}</span>}
                            {sub.value && <span className="about-custom-subitem-value">{sub.value}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Contact */}
        <div className="about-contact">
          <h2 className="about-subtitle">{sectionLabel('contact', 'Say Hello')}</h2>
          <div className="contact-links">
            {aboutInfo.contact.email && (
              <a href={`mailto:${aboutInfo.contact.email}`} className="contact-link-item">
                {aboutInfo.contact.email}
              </a>
            )}
            {aboutInfo.contact.instagram && (
              <a href={aboutInfo.contact.instagram} className="contact-link-item" target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            )}
            {aboutInfo.contact.phone && (
              <a href={`tel:${aboutInfo.contact.phone}`} className="contact-link-item">
                {aboutInfo.contact.phone}
              </a>
            )}
            {aboutInfo.contact.weibo && (
              <a href={aboutInfo.contact.weibo} className="contact-link-item" target="_blank" rel="noopener noreferrer">
                微博
              </a>
            )}
          </div>
          {builtinExtraItems('_builtin_contact')}
        </div>
      </div>
    </div>
  );
};

export default About;
