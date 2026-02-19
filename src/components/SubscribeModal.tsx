import React, { useState, useEffect } from 'react';
import { X, Mail, Check } from 'lucide-react';
import { subscribeEmail } from '../utils/newsletter';
import './SubscribeModal.css';

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscribeModal: React.FC<SubscribeModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setEmail('');
      setStatus('idle');
      setErrorMsg('');
    }
  }, [isOpen]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('error');
      setErrorMsg('请输入有效的邮箱地址');
      return;
    }

    setStatus('submitting');
    try {
      const result = await subscribeEmail(email);
      if (result.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMsg(result.message);
      }
    } catch {
      setStatus('error');
      setErrorMsg('网络错误，请稍后重试');
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`subscribe-overlay ${visible ? 'show' : ''}`} onClick={handleClose}>
      <div className={`subscribe-modal ${visible ? 'show' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button className="subscribe-close" onClick={handleClose}>
          <X size={18} />
        </button>

        {status === 'success' ? (
          <div className="subscribe-success">
            <div className="subscribe-success-icon">
              <Check size={28} />
            </div>
            <h3>Thank You</h3>
            <p>你已成功订阅，有新作品发布时会第一时间通知你。</p>
          </div>
        ) : (
          <>
            <div className="subscribe-icon">
              <Mail size={28} />
            </div>
            <h3 className="subscribe-title">Stay Updated</h3>
            <p className="subscribe-desc">
              订阅我的 Newsletter，新作品发布时第一时间收到通知。
            </p>
            <form className="subscribe-form" onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus('idle'); setErrorMsg(''); }}
                placeholder="your@email.com"
                className={`subscribe-input ${status === 'error' ? 'error' : ''}`}
                disabled={status === 'submitting'}
                autoFocus
              />
              {status === 'error' && (
                <span className="subscribe-error">{errorMsg}</span>
              )}
              <button type="submit" className="subscribe-btn" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>
            <p className="subscribe-note">
              不会发送垃圾邮件，随时可以取消订阅。
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default SubscribeModal;
