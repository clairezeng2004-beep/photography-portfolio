import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PageTransition } from '../types';
import './PageTransitionWrapper.css';

interface Props {
  children: React.ReactNode;
  transition: PageTransition;
}

const PageTransitionWrapper: React.FC<Props> = ({ children, transition }) => {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [stage, setStage] = useState<'enter' | 'active' | 'exit'>('enter');
  const prevPathRef = useRef(location.pathname);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    if (location.pathname === prevPathRef.current && isMountedRef.current) return;
    if (!isMountedRef.current) {
      // First mount: skip exit phase, just enter → active
      isMountedRef.current = true;
      setStage('enter');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStage('active');
        });
      });
      return;
    }

    if (transition === 'none') {
      setDisplayChildren(children);
      prevPathRef.current = location.pathname;
      return;
    }

    // Exit current page
    setStage('exit');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setDisplayChildren(children);
      setStage('enter');
      window.scrollTo(0, 0);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setStage('active');
        });
      });
      prevPathRef.current = location.pathname;
    }, 600);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [location.pathname, children, transition]);

  if (transition === 'none') {
    return <>{children}</>;
  }

  return (
    <div className={`page-transition page-transition-${transition} page-transition-${stage}`}>
      {displayChildren}
    </div>
  );
};

export default PageTransitionWrapper;
