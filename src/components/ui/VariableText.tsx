import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {cn} from '../../lib/utils';

type VariableTextTag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';

interface VariableTextProps {
  children: string;
  as?: VariableTextTag;
  className?: string;
  radius?: number;
  maxBlur?: number;
  minWeight?: number;
  maxWeight?: number;
  falloff?: 'linear' | 'gaussian';
}

export function VariableText({
  children,
  as: Component = 'span',
  className,
  radius = 165,
  maxBlur = 2.8,
  minWeight = 300,
  maxWeight = 800,
  falloff = 'gaussian',
}: VariableTextProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef<{x: number; y: number; active: boolean}>({
    x: 0,
    y: 0,
    active: false,
  });

  const tokens = useMemo(() => {
    const words = children.split(' ');
    let globalIdx = 0;
    return words.map((word, wIdx) => {
      const chars = Array.from(word).map((ch) => ({
        ch,
        idx: globalIdx++,
      }));
      return {word, chars, hasTrailingSpace: wIdx < words.length - 1};
    });
  }, [children]);

  const totalChars = useMemo(
    () => tokens.reduce((acc, t) => acc + t.chars.length, 0),
    [tokens]
  );

  const applyFrame = useCallback(() => {
    rafRef.current = null;
    const {x, y, active} = pointerRef.current;

    for (let i = 0; i < totalChars; i++) {
      const span = charRefs.current[i];
      if (!span) continue;

      if (!active) {
        span.style.filter = 'blur(0px)';
        span.style.opacity = '1';
        span.style.fontWeight = '';
        span.style.transform = 'translate3d(0, 0, 0) scale(1)';
        continue;
      }

      const rect = span.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(x - cx, y - cy);

      let focus = 0;
      if (dist < radius) {
        const norm = 1 - dist / radius;
        focus =
          falloff === 'gaussian'
            ? Math.exp(-Math.pow((1 - norm) * 2.2, 2))
            : norm;
      }

      const blurPx = ((1 - focus) * maxBlur).toFixed(2);
      const opacityVal = (0.42 + focus * 0.58).toFixed(3);
      const scaleVal = (0.985 + focus * 0.085).toFixed(3);
      const weightVal = Math.round(minWeight + focus * (maxWeight - minWeight));
      const liftPx = (-focus * 2.5).toFixed(2);

      span.style.filter = `blur(${blurPx}px)`;
      span.style.opacity = opacityVal;
      span.style.fontWeight = String(weightVal);
      span.style.transform = `translate3d(0, ${liftPx}px, 0) scale(${scaleVal})`;
    }
  }, [falloff, maxBlur, maxWeight, minWeight, radius, totalChars]);

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(applyFrame);
  }, [applyFrame]);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const handleGlobalMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pad = 48;
      const inside =
        e.clientX >= rect.left - pad &&
        e.clientX <= rect.right + pad &&
        e.clientY >= rect.top - pad &&
        e.clientY <= rect.bottom + pad;

      if (inside) {
        pointerRef.current = {x: e.clientX, y: e.clientY, active: true};
        scheduleUpdate();
      } else if (pointerRef.current.active) {
        pointerRef.current.active = false;
        scheduleUpdate();
      }
    };

    const handleDocLeave = () => {
      if (pointerRef.current.active) {
        pointerRef.current.active = false;
        scheduleUpdate();
      }
    };

    window.addEventListener('pointermove', handleGlobalMove, {passive: true});
    document.addEventListener('pointerleave', handleDocLeave, {passive: true});

    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      document.removeEventListener('pointerleave', handleDocLeave);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [scheduleUpdate]);

  return (
    <Component
      ref={(el: HTMLElement | null) => {
        containerRef.current = el;
      }}
      className={cn('inline-block select-text cursor-default', className)}
    >
      {tokens.map((token, tIdx) => (
        <React.Fragment key={`w-${tIdx}-${token.word}`}>
          <span className="inline-block whitespace-nowrap">
            {token.chars.map((item) => (
              <span
                key={`c-${item.idx}`}
                ref={(el) => {
                  charRefs.current[item.idx] = el;
                }}
                style={{
                  transition:
                    'filter 160ms cubic-bezier(0.16, 1, 0.3, 1), opacity 160ms cubic-bezier(0.16, 1, 0.3, 1), transform 160ms cubic-bezier(0.16, 1, 0.3, 1), font-weight 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'filter, opacity, transform',
                }}
                className="inline-block"
              >
                {item.ch}
              </span>
            ))}
          </span>
          {token.hasTrailingSpace && ' '}
        </React.Fragment>
      ))}
    </Component>
  );
}

export default VariableText;
