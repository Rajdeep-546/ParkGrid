import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {cn} from '../../lib/utils';

type VariableTextTag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';

interface VariableTextProps {
  children: string;
  as?: VariableTextTag;
  className?: string;
  radius?: number;
  maxBlur?: number;
  falloff?: 'linear' | 'gaussian';
}

export function VariableText({
  children,
  as: Component = 'span',
  className,
  radius = 150,
  maxBlur = 1.6,
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

  const applyFrame = useCallback(() => {
    rafRef.current = null;
    const {x, y, active} = pointerRef.current;

    for (const span of charRefs.current) {
      if (!span) continue;
      if (!active) {
        span.style.filter = 'blur(0px)';
        span.style.opacity = '1';
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
            ? Math.exp(-Math.pow((1 - norm) * 2.1, 2))
            : norm;
      }

      const blurPx = ((1 - focus) * maxBlur).toFixed(2);
      const opacityVal = (0.58 + focus * 0.42).toFixed(3);
      const scaleVal = (1 + focus * 0.045).toFixed(3);

      span.style.filter = `blur(${blurPx}px)`;
      span.style.opacity = opacityVal;
      span.style.transform = `translate3d(0, ${(-focus * 1.5).toFixed(2)}px, 0) scale(${scaleVal})`;
    }
  }, [falloff, maxBlur, radius]);

  const scheduleUpdate = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(applyFrame);
  }, [applyFrame]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    pointerRef.current = {x: e.clientX, y: e.clientY, active: true};
    scheduleUpdate();
  };

  const handlePointerLeave = () => {
    pointerRef.current.active = false;
    scheduleUpdate();
  };

  // Reset ref array cleanly when text changes
  charRefs.current = [];

  return (
    <Component
      ref={(el: HTMLElement | null) => {
        containerRef.current = el;
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
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
                    'filter 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
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
