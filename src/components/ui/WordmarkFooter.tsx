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
        'relative w-full overflow-hidden pt-1 sm:pt-2 select-none pointer-events-none',
        className
      )}
    >
      <motion.div
        initial={{opacity: 0, y: 20}}
        whileInView={{opacity: 1, y: 0}}
        viewport={{once: true, amount: 0.15}}
        transition={{type: 'spring', stiffness: 120, damping: 22}}
        className="mx-auto max-w-[1280px] px-2 sm:px-6 flex items-end justify-center"
      >
        {/* Negative bottom margin crops the bottom 1/3 inside overflow-hidden without adding top gap */}
        <div
          className={cn(
            'font-display font-bold uppercase tracking-[-0.04em] leading-[0.8] text-center whitespace-nowrap -mb-[0.27em]',
            'text-[clamp(3.8rem,15.5vw,13rem)]',
            'bg-gradient-to-b from-zinc-900/35 via-zinc-900/20 to-zinc-900/5 dark:from-white/30 dark:via-white/18 dark:to-white/5 bg-clip-text text-transparent'
          )}
        >
          {brandName}
        </div>
      </motion.div>

      {/* Subtle bottom floor fade so the cropped edge merges cleanly with the footer background */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 sm:h-6 bg-gradient-to-t from-zinc-50 dark:from-[#09090B] to-transparent" />
    </div>
  );
}

export default WordmarkFooter;
