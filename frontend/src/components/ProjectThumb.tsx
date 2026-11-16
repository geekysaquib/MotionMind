import { coverThumb, type Project } from '@motionmind/shared';
import { config } from '../config';
import { cn } from '../lib/cn';

/** A stable hue per project, so reels without a cover still look different from each other. */
function hue(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 250 + (h % 70);
}

/** A project's picture: the cover made on the Export step, or its title on a dark tinted tile until there is one. */
export function ProjectThumb({ project, className }: { project: Project; className?: string }) {
  const file = coverThumb(project.script);
  if (file) return <img src={`${config.apiUrl}/api/renders/${file}`} alt="" loading="lazy" decoding="async" className={cn('h-full w-full object-cover', className)} />;
  const h = hue(project.id);
  return (
    <div className={cn('flex h-full w-full items-end p-3', className)} style={{ background: `linear-gradient(150deg, hsl(${h} 45% 22%), hsl(${h + 30} 50% 12%))` }}>
      <span className="line-clamp-3 font-display text-sm font-bold leading-snug text-white/90">{project.script?.title ?? project.title}</span>
    </div>
  );
}
