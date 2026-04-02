import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeEmail } from '../utils/newsletter';
import { useIsMobile } from '../hooks/useIsMobile';
import './Footer.css';

const Footer: React.FC = () => {
  const isMobile = useIsMobile();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Footer navigation links
  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Footprints', path: '/footprints' },
    { name: 'About', path: '/about' },
  ];

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await subscribeEmail(email);
      if (result.success) {
        setSubmitted(true);
      } else {
        setError(result.message);
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="footer">
      {/* Back to top — prominent */}
      <button className="footer-back-top" onClick={scrollToTop} aria-label="回到顶部">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      <div className="footer-divider" />

      {/* Footer content grid */}
      <div className="footer-content">
        {isMobile ? (
          <div className="footer-mobile-stack">
            <h3 className="footer-column-title footer-mobile-section-title">更多</h3>
            <ul className="footer-mobile-nav-row">
              {navLinks.map(link => (
                <li key={link.name}>
                  <Link to={link.path}>{link.name}</Link>
                </li>
              ))}
            </ul>
            <h3 className="footer-column-title footer-mobile-section-title">保持联系</h3>
            <p className="footer-column-text" style={{ textAlign: 'center' }}>新作品发布时，第一时间通知你。</p>
            {submitted ? (
              <p className="footer-subscribed">感谢你的订阅！</p>
            ) : (
              <>
                <form className="footer-subscribe-form footer-mobile-subscribe" onSubmit={handleSubscribe}>
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    className={`footer-email-input ${error ? 'has-error' : ''}`}
                    disabled={submitting}
                  />
                  <button type="submit" className="footer-submit-btn" aria-label="订阅" disabled={submitting}>
                    {submitting ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="spin-icon">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </button>
                </form>
                {error && <span className="footer-error" style={{ textAlign: 'center' }}>{error}</span>}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Center branding — full width, viewport centered */}
            <div className="footer-center-row">
              <h3 className="footer-column-title">ROAMING ICE</h3>
              <p className="footer-column-text">用镜头记录旅途中的光与影</p>
            </div>

            <div className="footer-grid">
              {/* Column 1: More links */}
              <div className="footer-column">
                <h3 className="footer-column-title">更多</h3>
                <ul className="footer-links">
                  {navLinks.map(link => (
                    <li key={link.name}>
                      <Link to={link.path}>{link.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 3: Subscribe */}
              <div className="footer-column">
                <h3 className="footer-column-title">保持联系</h3>
                <p className="footer-column-text">新作品发布时，第一时间通知你。</p>
                {submitted ? (
                  <p className="footer-subscribed">感谢你的订阅！</p>
                ) : (
                  <>
                    <form className="footer-subscribe-form" onSubmit={handleSubscribe}>
                      <input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        className={`footer-email-input ${error ? 'has-error' : ''}`}
                        disabled={submitting}
                      />
                      <button type="submit" className="footer-submit-btn" aria-label="订阅" disabled={submitting}>
                        {submitting ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="spin-icon">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        )}
                      </button>
                    </form>
                    {error && <span className="footer-error">{error}</span>}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="footer-bottom">
        <span className="footer-copyright">&copy; {new Date().getFullYear()} 小冰块</span>
      </div>
    </footer>
  );
};

export default Footer;
