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
  const childrenRef = useRef(children);
  childrenRef.current = children;

  // Keep displayChildren in sync when not mid-transition
  // (e.g. when DataContext updates cause re-renders on the same route)
  useEffect(() => {
    if (stage === 'active') {
      setDisplayChildren(children);
    }
  }, [children, stage]);

  // Route-change transition — only depends on pathname, NOT children
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
      setDisplayChildren(childrenRef.current);
      prevPathRef.current = location.pathname;
      return;
    }

    // Exit current page — scroll to top immediately so the new page fades in at the top
    setStage('exit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      setDisplayChildren(childrenRef.current);
      setStage('enter');
      window.scrollTo(0, 0); // ensure we're at top after content swap

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, transition]);

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
