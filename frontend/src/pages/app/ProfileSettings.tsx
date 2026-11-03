import { useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Check, Loader2, X } from 'lucide-react';
import { normalizeHandle } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Button, Card, Field, Select } from '../../components/ui';
import { errorText } from '../../lib/format';

export const ProfileSettings = observer(function ProfileSettings() {
  const { profile, toasts } = useStores();
  const p = profile.profile!;
  const [displayName, setDisplayName] = useState(p.displayName ?? '');
  const [channelName, setChannelName] = useState(p.channelName ?? '');
  const [niche, setNiche] = useState(p.niche ?? '');
  const [language, setLanguage] = useState(p.language);
  const [busy, setBusy] = useState(false);
  const handleChanged = normalizeHandle(profile.handleInput) !== p.handle;
  const status = profile.handleStatus;
  const canSave = !handleChanged || status === 'available';

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await profile.update({
        displayName: displayName.trim() || null,
        channelName: channelName.trim() || null,
        niche: niche.trim() || null,
        language,
        ...(handleChanged ? { handle: normalizeHandle(profile.handleInput) } : {}),
      });
      toasts.push('success', 'Profile saved.');
    } catch (err) {
      toasts.push('error', errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const icon = !handleChanged ? null : status === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : status === 'available' ? <Check className="h-4 w-4 text-accent" /> : <X className="h-4 w-4 text-danger" />;

  return (
    <Card>
      <form onSubmit={save} className="space-y-5">
        <Field
          label="Handle"
          value={profile.handleInput}
          onChange={(e) => profile.setHandleInput(e.target.value)}
          trailing={icon}
          error={handleChanged && (status === 'invalid' || status === 'taken' || status === 'error') ? profile.handleMessage : null}
          hint={handleChanged && status === 'available' ? <span className="text-accent">{profile.handleMessage}</span> : 'Changing it frees your old handle for others.'}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Display name" maxLength={60} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Field label="Channel name" maxLength={60} value={channelName} onChange={(e) => setChannelName(e.target.value)} />
          <Field label="Main topic area" maxLength={60} value={niche} onChange={(e) => setNiche(e.target.value)} />
          <Select label="Narration language" value={language} onChange={(e) => setLanguage(e.target.value as typeof language)}>
            <option value="hinglish">Hinglish</option>
            <option value="hi">Hindi</option>
            <option value="en">English</option>
          </Select>
        </div>
        <Button type="submit" loading={busy} disabled={!canSave}>
          Save profile
        </Button>
      </form>
    </Card>
  );
});
