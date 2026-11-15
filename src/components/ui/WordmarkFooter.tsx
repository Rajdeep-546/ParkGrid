import {motion} from 'motion/react';
import {cn} from '../../lib/utils';

interface WordmarkFooterProps {
  brandName?: string;
  className?: string;
}

export function WordmarkFooter({
  brandName = 'ParkGrid',
  className,
}: WordmarkFooterProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative w-full overflow-hidden pt-6 sm:pt-8 select-none pointer-events-none',
        className
      )}
    >
      {/* Architectural hairline horizon slicing across the wordmark midpoint */}
      <div className="pointer-events-none absolute inset-x-0 top-[56%] z-10 border-t border-zinc-200/80 dark:border-zinc-800/80" />

      <motion.div
        initial={{opacity: 0, y: 36}}
        whileInView={{opacity: 1, y: 0}}
        viewport={{once: true, amount: 0.2}}
        transition={{type: 'spring', stiffness: 120, damping: 22}}
        className="mx-auto max-w-[1280px] px-2 sm:px-6 flex items-end justify-center"
      >
        <div
          className={cn(
            'font-display font-bold uppercase tracking-[-0.04em] leading-[0.82] text-center whitespace-nowrap',
            'text-[clamp(3.6rem,15.5vw,12.5rem)] -mb-[0.14em]',
            'bg-gradient-to-b from-zinc-900/25 via-zinc-900/12 to-transparent dark:from-white/25 dark:via-white/10 dark:to-transparent bg-clip-text text-transparent'
          )}
        >
          {brandName}
        </div>
      </motion.div>
    </div>
  );
}

export default WordmarkFooter;
