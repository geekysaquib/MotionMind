import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_TEMPLATE, TEMPLATES, TEMPLATE_IDS, templateOf, type TemplateId } from '@motionmind/shared';
import { TemplatePicker } from './TemplatePicker';

describe('templates', () => {
  it('every template has a theme, caption style, guidance for Claude and an example', () => {
    for (const id of TEMPLATE_IDS) {
      const t = TEMPLATES[id];
      expect(t.id).toBe(id);
      expect(t.guidance.length).toBeGreaterThan(40);
      expect(t.example).toBeTruthy();
      expect(['small', 'medium', 'large']).toContain(t.captions.size);
    }
  });

  it('falls back to the default template for a missing or unknown id', () => {
    expect(templateOf(undefined).id).toBe(DEFAULT_TEMPLATE);
    expect(templateOf('nope').id).toBe(DEFAULT_TEMPLATE);
    expect(templateOf('system-design').theme).toBe('lab');
  });
});

describe('TemplatePicker', () => {
  it('lists every template, marks the chosen one, and reports a new choice', () => {
    const onChange = jest.fn<(id: TemplateId) => void>();
    render(<TemplatePicker value="explainer-3d" onChange={onChange} />);
    expect(screen.getAllByRole('radio')).toHaveLength(TEMPLATE_IDS.length);
    expect(screen.getByRole('radio', { name: /3D Explainer/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: /System Design/ }));
    expect(onChange).toHaveBeenCalledWith('system-design');
  });
});
