import { observer } from 'mobx-react-lite';
import { useStores } from '../stores/RootStore';
import { cn } from '../lib/cn';

/** Two letters for a channel, from its handle: "decodify_x" → DX, "decodifyx" → DE. Without a handle, from the name. */
export function initialsOf(handle: string | null | undefined, name?: string | null): string {
  const parts = (handle || name || '').replace(/^@/, '').split(/[\s._-]+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
}

/** The creator's channel picture, or their initials on the brand gradient when none is uploaded. */
export const ChannelAvatar = observer(function ChannelAvatar({ size = 32, className }: { size?: number; className?: string }) {
  const { profile } = useStores();
  const p = profile.profile;
  const style = { width: size, height: size };
  if (profile.logoUrl) return <img src={profile.logoUrl} alt="Your channel picture" style={style} className={cn('shrink-0 rounded-full object-cover ring-1 ring-line/15', className)} />;
  return (
    <div style={{ ...style, fontSize: Math.round(size * 0.36) }} className={cn('flex shrink-0 items-center justify-center rounded-full bg-brand font-bold text-white', className)} aria-hidden>
      {initialsOf(p?.handle, p?.channelName ?? p?.displayName)}
    </div>
  );
});
