import React, {useEffect, useMemo, useRef} from 'react';
import {cn} from '../../lib/utils';

type VariableTextTag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';

export interface VariableTextProps {
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
  radius = 190,
  maxBlur = 3.2,
  minWeight = 260,
  maxWeight = 800,
  falloff = 'gaussian',
}: VariableTextProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);

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

  useEffect(() => {
    const currentFocus = new Float32Array(totalChars).fill(1);
    const targetFocus = new Float32Array(totalChars).fill(1);
    let currentPresence = 0; // 0 = cursor away (all sharp), 1 = cursor inside lens zone
    let targetPresence = 0;
    let pointerX = 0;
    let pointerY = 0;
    let rafId = 0;

    const recomputeTargets = () => {
      if (targetPresence < 0.01) {
        targetFocus.fill(1);
        return;
      }

      for (let i = 0; i < totalChars; i++) {
        const span = charRefs.current[i];
        if (!span) continue;
        const rect = span.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        const dist = Math.hypot(pointerX - cx, pointerY - cy);

        let f = 0;
        if (dist < radius) {
          const norm = 1 - dist / radius;
          f =
            falloff === 'gaussian'
              ? Math.exp(-Math.pow((1 - norm) * 2.15, 2))
              : norm;
        }
        targetFocus[i] = f;
      }
    };

    const tick = () => {
      rafId = 0;
      let needsNextFrame = false;

      currentPresence += (targetPresence - currentPresence) * 0.16;
      if (Math.abs(targetPresence - currentPresence) > 0.004) {
        needsNextFrame = true;
      } else {
        currentPresence = targetPresence;
      }

      recomputeTargets();

      for (let i = 0; i < totalChars; i++) {
        const span = charRefs.current[i];
        if (!span) continue;

        const desired =
          1 * (1 - currentPresence) + targetFocus[i] * currentPresence;
        const prev = currentFocus[i];
        const next = prev + (desired - prev) * 0.22;
        currentFocus[i] = next;

        if (Math.abs(desired - next) > 0.003) {
          needsNextFrame = true;
        }

        if (currentPresence < 0.005 && Math.abs(1 - next) < 0.005) {
          span.style.filter = 'none';
          span.style.opacity = '1';
          span.style.fontWeight = '';
          span.style.fontVariationSettings = '';
          span.style.transform = 'translate3d(0,0,0) scale(1)';
          continue;
        }

        // next: 1.0 = right under cursor (sharpest, heaviest, brightest)
        // next: 0.0 = outside cursor lens while hovering (softly blurred, lighter, dimmer)
        const blurPx = (1 - next) * maxBlur * currentPresence;
        const opacityVal = 1 - (1 - next) * 0.56 * currentPresence;
        const restWeight = Math.round((minWeight + maxWeight) * 0.52);
        const activeWeight = Math.round(
          minWeight + next * (maxWeight - minWeight)
        );
        const weightVal = Math.round(
          restWeight * (1 - currentPresence) + activeWeight * currentPresence
        );
        const scaleVal = 1 + (next - 0.35) * 0.11 * currentPresence;
        const liftPx = -(next * 3.2 * currentPresence);

        span.style.filter =
          blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : 'none';
        span.style.opacity = opacityVal.toFixed(3);
        span.style.fontWeight = String(weightVal);
        span.style.fontVariationSettings = `"wght" ${weightVal}`;
        span.style.transform = `translate3d(0, ${liftPx.toFixed(2)}px, 0) scale(${scaleVal.toFixed(3)})`;
      }

      if (needsNextFrame) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const wake = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const padX = 64;
      const padY = 44;

      const isNear =
        e.clientX >= rect.left - padX &&
        e.clientX <= rect.right + padX &&
        e.clientY >= rect.top - padY &&
        e.clientY <= rect.bottom + padY;

      pointerX = e.clientX;
      pointerY = e.clientY;
      targetPresence = isNear ? 1 : 0;
      wake();
    };

    const onMouseLeaveWindow = () => {
      targetPresence = 0;
      wake();
    };

    window.addEventListener('mousemove', onMouseMove, {passive: true});
    document.addEventListener('mouseleave', onMouseLeaveWindow, {passive: true});

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeaveWindow);
    };
  }, [falloff, maxBlur, maxWeight, minWeight, radius, totalChars]);

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
                style={{willChange: 'filter, opacity, transform'}}
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
