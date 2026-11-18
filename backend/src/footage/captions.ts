import { captionLines, type FootageSettings, type FootageWord } from '@motionmind/shared';

/** Seconds as ASS time: H:MM:SS.cc */
export function assTime(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

const clean = (t: string) => t.replace(/[{}\\]/g, '').replace(/\s+/g, ' ');

/** Brand purple (#A78BFA) in ASS's &HBBGGRR order. */
const HIGHLIGHT = '&H00FA8BA7&';

/**
 * Word-by-word captions as an ASS subtitle file for FFmpeg to burn in: three words at a time, bold white with a
 * dark outline, the word being said in the brand purple. Kept above Instagram's caption and buttons.
 */
export function captionsAss(words: FootageWord[], position: FootageSettings['captionPosition']): string {
  const alignment = position === 'middle' ? 5 : 2;
  const marginV = position === 'middle' ? 0 : 560;
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Caption,Arial,82,&H00FFFFFF,&H00FFFFFF,&H00141414,&H64000000,-1,0,0,0,100,100,0,0,1,7,3,${alignment},90,90,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const events: string[] = [];
  const lines = captionLines(words);
  lines.forEach((line, li) => {
    const nextStart = lines[li + 1]?.[0]?.start ?? Infinity;
    const lineEnd = Math.min(line[line.length - 1]!.end + 0.35, nextStart);
    line.forEach((w, wi) => {
      const from = w.start;
      const to = wi < line.length - 1 ? line[wi + 1]!.start : lineEnd;
      if (to - from < 0.01) return;
      const text = line.map((x, xi) => (xi === wi ? `{\\c${HIGHLIGHT}}${clean(x.text)}{\\c&H00FFFFFF&}` : clean(x.text))).join(' ');
      // A small pop on the first word of each line.
      const pop = wi === 0 ? '{\\fscx92\\fscy92\\t(0,90,\\fscx100\\fscy100)}' : '';
      events.push(`Dialogue: 0,${assTime(from)},${assTime(to)},Caption,,0,0,0,,${pop}${text}`);
    });
  });
  return [...header, ...events, ''].join('\n');
}
