'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const LERP_FACTOR = 0.085;   // Lower = slower/glassier, Higher = snappier (0.05–0.15)
const WHEEL_MULTIPLIER = 1.0; // Scale wheel delta (1.0 = native speed)
const TOUCH_MULTIPLIER = 1.8; // Amplify touch swipe feel

export default function SmoothScroller() {
  const pathname = usePathname();

  useEffect(() => {
    const publicPaths = ['/', '/login', '/register', '/pricing', '/docs', '/blog', '/contact', '/about', '/privacy', '/terms', '/forgot-password'];
    const isPublicPath = publicPaths.includes(pathname) || pathname.startsWith('/blog/');
    
    // Disable smooth scrolling on dashboard/console pages
    if (!isPublicPath) {
      return;
    }

    let targetY = window.scrollY;
    let currentY = window.scrollY;
    let rafId: number | null = null;
    let isRunning = false;

    // Touch tracking
    let lastTouchY = 0;
    let touchVelocity = 0;

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * t;
    }

    function clampTarget() {
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      targetY = Math.max(0, Math.min(targetY, maxScroll));
    }

    function tick() {
      const diff = targetY - currentY;

      if (Math.abs(diff) < 0.5) {
        currentY = targetY;
        window.scrollTo(0, currentY);
        isRunning = false;
        rafId = null;
        return;
      }

      currentY = lerp(currentY, targetY, LERP_FACTOR);
      window.scrollTo(0, currentY);
      rafId = requestAnimationFrame(tick);
    }

    function startLoop() {
      if (!isRunning) {
        isRunning = true;
        rafId = requestAnimationFrame(tick);
      }
    }

    function onWheel(e: WheelEvent) {
      // Let native scroll handle elements that overflow internally (like scrollable modals/drawers)
      const target = e.target as HTMLElement;
      const scrollableParent = target.closest('[data-scroll-native]');
      if (scrollableParent) return;

      e.preventDefault();
      targetY += e.deltaY * WHEEL_MULTIPLIER;
      clampTarget();
      startLoop();
    }

    function onTouchStart(e: TouchEvent) {
      lastTouchY = e.touches[0].clientY;
      touchVelocity = 0;
    }

    function onTouchMove(e: TouchEvent) {
      const y = e.touches[0].clientY;
      const delta = (lastTouchY - y) * TOUCH_MULTIPLIER;
      lastTouchY = y;
      touchVelocity = delta;
      targetY += delta;
      clampTarget();
      startLoop();
    }

    function onTouchEnd() {
      // coast with touch velocity after lift
      const coast = () => {
        if (Math.abs(touchVelocity) < 0.5) return;
        touchVelocity *= 0.88;
        targetY += touchVelocity;
        clampTarget();
        startLoop();
        requestAnimationFrame(coast);
      };
      requestAnimationFrame(coast);
    }

    // Sync targetY on native scroll (e.g. anchor links, keyboard arrows)
    function onScroll() {
      if (!isRunning) {
        targetY = window.scrollY;
        currentY = window.scrollY;
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('scroll', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
