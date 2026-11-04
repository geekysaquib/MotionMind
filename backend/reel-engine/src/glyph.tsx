import { Vec3, shade } from './iso';
import { box, shadow, type Item } from './World';
import { ICONS } from './iconData';

// Any of ~1,500 icons as a 3D object: a thick rounded tile standing on a small base, with the icon drawn on its
// front face in three layers (a shadow, a thick body, a bright top) so it looks raised, not printed.

const COS30 = Math.cos(Math.PI / 6);

export const hasGlyph = (name: string | undefined): name is string => Boolean(name && ICONS[name]);

/** Names starting with the text, for pickers and for Claude's mistakes ("heart-pulse" vs "heartpulse"). */
export const glyphNames = (): string[] => Object.keys(ICONS);

export const GLYPH_TOP = 3.0;

function hex(h: string, amount: number): string {
  const m = shade(h, amount).match(/\d+/g) ?? ['0', '0', '0'];
  return `#${m.map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
}

function shapeEl(tag: string, a: Record<string, string | number>, key: string) {
  const common = { key, fill: 'none' as const };
  switch (tag) {
    case 'path':
      return <path {...common} d={String(a.d)} />;
    case 'circle':
      return <circle {...common} cx={a.cx} cy={a.cy} r={a.r} />;
    case 'ellipse':
      return <ellipse {...common} cx={a.cx} cy={a.cy} rx={a.rx} ry={a.ry} />;
    case 'rect':
      return <rect {...common} x={a.x} y={a.y} width={a.width} height={a.height} rx={a.rx} ry={a.ry} />;
    case 'line':
      return <line {...common} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />;
    case 'polyline':
      return <polyline {...common} points={String(a.points)} />;
    case 'polygon':
      return <polygon {...common} points={String(a.points)} />;
    default:
      return null;
  }
}

export function glyphItems(p: { id: string; pos: Vec3; glyph: string; tone: string }, frame: number): Item[] {
  const { x, y } = p.pos;
  const k = p.id;
  const d = x + y;
  const shapes = ICONS[p.glyph] ?? [];
  const bob = Math.sin(frame / 22) * 0.06;
  const tile = 2.3;
  const thick = 0.5;
  const baseZ = 0.3;
  const out: Item[] = [shadow(`gsh${k}`, x - 1.3, y - 1.1, 2.6, 2.2)];
  out.push(box(`gpb${k}`, x - 0.6, y - 0.35, 0, 1.2, 0.7, baseZ, '#D5D9E0'));
  out.push({
    ...box(`gt${k}`, x - tile / 2, y - thick / 2, baseZ + bob, tile, thick, tile, p.tone),
    depth: d + 0.3,
  });

  // The icon lives on the tile's front face (the plane y + thick/2). Map icon space (u right, v down, 24 wide)
  // onto it: screen X = cos30 * (x - y), screen Y = (x + y) / 2 - z.
  const s = 1.5 / 24;
  const fx = x - 0.75;
  const fz = baseZ + bob + tile / 2 + 0.75;
  const fy = y + thick / 2 + 0.01;
  const layer = (dy: number, colour: string, width: number, key: string, opacity = 1) => {
    // Shift the layer toward the viewer by dy (world y): screen X -= cos30 * dy, Y += dy / 2.
    const e = COS30 * (fx - fy - dy);
    const f = (fx + fy + dy) / 2 - fz;
    return (
      <g key={key} transform={`matrix(${COS30 * s} ${0.5 * s} 0 ${s} ${e} ${f})`} stroke={colour} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" opacity={opacity}>
        {shapes.map(([tag, a], i) => shapeEl(tag, a, `${key}${i}`))}
      </g>
    );
  };
  const dark = hex(p.tone, -0.45);
  out.push({
    depth: d + 0.7,
    el: (
      <g key={`gi${k}`}>
        {layer(-0.06, dark, 2.6, 'a', 0.55)}
        {layer(0, dark, 2.4, 'b')}
        {layer(0.07, '#FFFFFF', 2.1, 'c')}
      </g>
    ),
  });
  return out;
}
