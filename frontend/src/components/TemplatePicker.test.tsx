import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_TEMPLATE, TEMPLATES, TEMPLATE_IDS, templateOf, type TemplateId } from '@motionmind/shared';
import { TemplatePicker } from './TemplatePicker';

describe('templates', () => {
  it('every template has a theme, a look, caption defaults and a flat preview', () => {
    for (const id of TEMPLATE_IDS) {
      const t = TEMPLATES[id];
      expect(t.id).toBe(id);
      expect(['box', 'dark', 'headline']).toContain(t.look.card);
      expect(['steps', 'bar']).toContain(t.look.header);
      expect(['small', 'medium', 'large']).toContain(t.captions.size);
      expect(t.preview.ground).toMatch(/^#/);
      if (t.sample) expect(t.sample.video).toBe(`/templates/${id}.mp4`);
    }
  });

  it('falls back to the default template for a missing or unknown id', () => {
    expect(templateOf(undefined).id).toBe(DEFAULT_TEMPLATE);
    expect(templateOf('nope').id).toBe(DEFAULT_TEMPLATE);
    expect(templateOf('neon-system').look.accent).toBe('#34D399');
  });
});

describe('TemplatePicker', () => {
  it('lists every template, marks the chosen one, explains it, and reports a new choice', () => {
    const onChange = jest.fn<(id: TemplateId) => void>();
    render(<TemplatePicker value="explainer-3d" onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(TEMPLATE_IDS.length);
    expect(screen.getByRole('radio', { name: /3D Explainer/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/The classic Motion Mind look/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Neon System Design/ }));
    expect(onChange).toHaveBeenCalledWith('neon-system');
  });

  it('says what a template does not reproduce from the reel it is modelled on', () => {
    render(<TemplatePicker value="paper-interview" onChange={() => undefined} />);
    expect(screen.getByText(/Not reproduced: The presenter character/)).toBeTruthy();
    expect(screen.getByLabelText('Sample of the Paper Interview style')).toBeTruthy();
  });
});
