import React, { useState } from 'react';
import { subscribeEmail } from '../utils/newsletter';
import './Footer.css';

const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

      {/* Subscribe section */}
      <div className="footer-subscribe-section">
        <p className="footer-subscribe-heading">保持联系</p>
        <p className="footer-subscribe-desc">新作品发布时，第一时间通知你。</p>
        {submitted ? (
          <p className="footer-subscribed">感谢你的订阅！</p>
        ) : (
          <>
            <form className="footer-subscribe-form" onSubmit={handleSubscribe}>
              <input
                type="email"
                placeholder="输入邮箱地址"
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

      <div className="footer-bottom">
        <span className="footer-copyright">&copy; {new Date().getFullYear()} 小冰块</span>
      </div>
    </footer>
  );
};

export default Footer;
