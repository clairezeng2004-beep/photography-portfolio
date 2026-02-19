import React from 'react';
import { useData } from '../context/DataContext';
import './About.css';

const About: React.FC = () => {
  const { aboutInfo } = useData();

  return (
    <div className="about-page">
      {/* Main Content */}
      <div className="about-body">
        <h1 className="about-title">About</h1>

        {/* Avatar Card */}
        <div className="about-avatar-card">
          <img
            src={aboutInfo.avatar}
            alt={aboutInfo.name}
          />
        </div>

        <div className="about-text">
          {aboutInfo.bio.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
