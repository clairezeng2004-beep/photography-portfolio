import React from 'react';
import { useData } from '../context/DataContext';
import './About.css';

const About: React.FC = () => {
  const { aboutInfo } = useData();

  return (
    <div className="about-page">
      {/* Hero Image */}
      <div className="about-hero-image">
        <img
          src={aboutInfo.avatar}
          alt={aboutInfo.name}
        />
      </div>

      {/* Main Content */}
      <div className="about-body">
        <h1 className="about-title">About</h1>

        <div className="about-text">
          {aboutInfo.bio.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>

        {/* Philosophy */}
        <div className="about-section">
          <div className="about-text">
            {aboutInfo.philosophy.map((item, index) => (
              <p key={index}>
                <strong>{item.title}</strong> — {item.description}
              </p>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="about-contact">
          <h2 className="about-subtitle">Say Hello</h2>
          <div className="contact-links">
            <a href={`mailto:${aboutInfo.contact.email}`} className="contact-link-item">
              {aboutInfo.contact.email}
            </a>
            {aboutInfo.contact.instagram && (
              <a href={aboutInfo.contact.instagram} className="contact-link-item" target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            )}
            {aboutInfo.contact.weibo && (
              <a href={aboutInfo.contact.weibo} className="contact-link-item" target="_blank" rel="noopener noreferrer">
                微博
              </a>
            )}
          </div>
        </div>

        {/* Location & Stats */}
        <div className="about-details">
          <div className="detail-item">
            <span className="detail-label">Based in</span>
            <span className="detail-value">{aboutInfo.location}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Cities</span>
            <span className="detail-value">{aboutInfo.stats.cities}+</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Experience</span>
            <span className="detail-value">{aboutInfo.stats.experience} years</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
