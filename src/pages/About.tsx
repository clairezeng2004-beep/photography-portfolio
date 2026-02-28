import React, { useEffect } from 'react';
import { useData } from '../context/DataContext';
import './About.css';

const About: React.FC = () => {
  const { aboutInfo, litCities, collections } = useData();

  useEffect(() => { document.title = '小冰块 - 关于'; }, []);

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

  const hasStats = mapCountryCount > 0 || mapCityCount > 0;

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
          {aboutInfo.bio.filter(p => p.trim()).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {/* Stats */}
        {!(aboutInfo.hiddenSections || []).includes('stats') && (() => {
          const hasStatsExtra = (() => {
            const section = (aboutInfo.customSections || []).find(s => s.id === '_builtin_stats');
            return section && section.items.some(item => item.label || item.value);
          })();
          if (!hasStats && !hasStatsExtra) return null;
          return (
          <div className="about-section">
            <h2 className="about-section-title">{sectionLabel('stats', '统计数据')}</h2>
            <div className="about-custom-items">
              {mapCountryCount > 0 && (
                <div className="about-custom-item">
                  <span className="about-custom-item-label">国家</span>
                  <span className="about-custom-item-value">{mapCountryCount}</span>
                </div>
              )}
              {mapCityCount > 0 && (
                <div className="about-custom-item">
                  <span className="about-custom-item-label">城市</span>
                  <span className="about-custom-item-value">{mapCityCount}</span>
                </div>
              )}
            </div>
            {builtinExtraItems('_builtin_stats')}
          </div>
          );
        })()}

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
        {!(aboutInfo.hiddenSections || []).includes('contact') && (() => {
          const hasContactFields = aboutInfo.contact.email || aboutInfo.contact.instagram || aboutInfo.contact.phone || aboutInfo.contact.weibo;
          const hasContactExtra = (() => {
            const section = (aboutInfo.customSections || []).find(s => s.id === '_builtin_contact');
            return section && section.items.some(item => item.label || item.value);
          })();
          if (!hasContactFields && !hasContactExtra) return null;
          return (
        <div className="about-contact">
          <h2 className="about-subtitle">{sectionLabel('contact', 'Say Hello')}</h2>
          <div className="contact-links">
            {aboutInfo.contact.email && (
              <div className="about-custom-item">
                <span className="about-custom-item-label">邮箱</span>
                {aboutInfo.contact.email.includes('@')
                  ? <a href={`mailto:${aboutInfo.contact.email}`} className="about-custom-item-value">{aboutInfo.contact.email}</a>
                  : <span className="about-custom-item-value">{aboutInfo.contact.email}</span>
                }
              </div>
            )}
            {aboutInfo.contact.instagram && (
              <div className="about-custom-item">
                <span className="about-custom-item-label">Instagram</span>
                {/^https?:\/\//.test(aboutInfo.contact.instagram)
                  ? <a href={aboutInfo.contact.instagram} className="about-custom-item-value" target="_blank" rel="noopener noreferrer">{aboutInfo.contact.instagram}</a>
                  : <span className="about-custom-item-value">{aboutInfo.contact.instagram}</span>
                }
              </div>
            )}
            {aboutInfo.contact.phone && (
              <div className="about-custom-item">
                <span className="about-custom-item-label">电话</span>
                <span className="about-custom-item-value">{aboutInfo.contact.phone}</span>
              </div>
            )}
            {aboutInfo.contact.weibo && (
              <div className="about-custom-item">
                <span className="about-custom-item-label">微博</span>
                {/^https?:\/\//.test(aboutInfo.contact.weibo)
                  ? <a href={aboutInfo.contact.weibo} className="about-custom-item-value" target="_blank" rel="noopener noreferrer">{aboutInfo.contact.weibo}</a>
                  : <span className="about-custom-item-value">{aboutInfo.contact.weibo}</span>
                }
              </div>
            )}
          </div>
          {builtinExtraItems('_builtin_contact')}
        </div>
          );
        })()}
      </div>
    </div>
  );
};

export default About;
