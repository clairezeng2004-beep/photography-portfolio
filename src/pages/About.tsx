import React, { useEffect } from 'react';
import { useData } from '../context/DataContext';
import './About.css';

const About: React.FC = () => {
  const { aboutInfo } = useData();

  useEffect(() => { document.title = '小冰块 - 摄影集 - 关于'; }, []);

  const sectionLabel = (key: string, fallback: string) =>
    aboutInfo.sectionLabels?.[key] || fallback;

  const hasStats = aboutInfo.stats.cities > 0 || aboutInfo.stats.photos || aboutInfo.stats.experience;

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
              {aboutInfo.stats.cities > 0 && (
                <div className="about-stat-item">
                  <span className="about-stat-number">{aboutInfo.stats.cities}</span>
                  <span className="about-stat-label">国家</span>
                </div>
              )}
              {aboutInfo.stats.photos && (
                <div className="about-stat-item">
                  <span className="about-stat-number">{aboutInfo.stats.photos}</span>
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
          </div>
        )}

        {/* Custom Sections */}
        {(aboutInfo.customSections || []).map((section) => {
          const validItems = section.items.filter(item => item.label || item.value);
          if (validItems.length === 0) return null;
          return (
            <div key={section.id} className="about-section">
              <h2 className="about-section-title">{section.title}</h2>
              <div className="about-custom-items">
                {validItems.map((item) => (
                  <div key={item.id} className="about-custom-item">
                    {item.label && <span className="about-custom-item-label">{item.label}</span>}
                    {item.value && <span className="about-custom-item-value">{item.value}</span>}
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
        </div>
      </div>
    </div>
  );
};

export default About;
