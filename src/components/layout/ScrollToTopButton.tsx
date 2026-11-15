import {useCallback, useEffect, useRef, useState} from 'react';
import {ArrowUp} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';

const SCROLL_THRESHOLD_PX = 120;
const IDLE_HIDE_DELAY_MS = 1400;

function getWindowScrollTop(): number {
  if (typeof window === 'undefined') return 0;
  return Math.max(
    window.scrollY || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0
  );
}

export function ScrollToTopButton() {
  const [visible, setVisible] = useState<boolean>(false);
  const idleTimerRef = useRef<number | null>(null);
  const isInteractingRef = useRef<boolean>(false);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdleHide = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      if (!isInteractingRef.current) {
        setVisible(false);
      }
    }, IDLE_HIDE_DELAY_MS);
  }, [clearIdleTimer]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = getWindowScrollTop();
      if (scrollTop <= SCROLL_THRESHOLD_PX) {
        clearIdleTimer();
        setVisible(false);
        return;
      }

      setVisible(true);
      scheduleIdleHide();
    };

    // Keep hidden initially when the page has not been scrolled
    if (getWindowScrollTop() > SCROLL_THRESHOLD_PX) {
      setVisible(true);
      scheduleIdleHide();
    } else {
      setVisible(false);
    }

    window.addEventListener('scroll', handleScroll, {passive: true});
    return () => {
      clearIdleTimer();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [clearIdleTimer, scheduleIdleHide]);

  const handleScrollToTop = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';

    window.scrollTo({top: 0, behavior});
    if (document.documentElement) {
      document.documentElement.scrollTo({top: 0, behavior});
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="scroll-to-top"
          type="button"
          onClick={handleScrollToTop}
          onMouseEnter={() => {
            isInteractingRef.current = true;
            clearIdleTimer();
          }}
          onMouseLeave={() => {
            isInteractingRef.current = false;
            if (getWindowScrollTop() > SCROLL_THRESHOLD_PX) {
              scheduleIdleHide();
            } else {
              setVisible(false);
            }
          }}
          onFocus={() => {
            isInteractingRef.current = true;
            clearIdleTimer();
          }}
          onBlur={() => {
            isInteractingRef.current = false;
            if (getWindowScrollTop() > SCROLL_THRESHOLD_PX) {
              scheduleIdleHide();
            }
          }}
          aria-label="Scroll to top"
          title="Scroll to top"
          initial={{opacity: 0, scale: 0.72, y: 16}}
          animate={{opacity: 1, scale: 1, y: 0}}
          exit={{opacity: 0, scale: 0.72, y: 16}}
          transition={{duration: 0.35, ease: [0.16, 1, 0.3, 1]}}
          whileHover={{scale: 1.08, y: -2}}
          whileTap={{scale: 0.92}}
          className="fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full flex items-center justify-center bg-transparent backdrop-blur-md border border-zinc-900/20 dark:border-white/20 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-900/10 dark:hover:bg-white/10 hover:border-zinc-900/35 dark:hover:border-white/35 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowUp className="h-5 w-5 stroke-[2]" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
