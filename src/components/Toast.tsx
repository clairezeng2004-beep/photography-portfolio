import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import './Toast.css';

interface ToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, visible, onClose, duration = 2000 }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onClose, 300);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!visible && !show) return null;

  return (
    <div className={`toast-container ${show ? 'toast-enter' : 'toast-exit'}`}>
      <div className="toast-content">
        <Check size={16} />
        <span>{message}</span>
      </div>
    </div>
  );
};

export default Toast;
