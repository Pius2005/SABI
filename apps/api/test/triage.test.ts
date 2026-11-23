import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';
import { choosePriority, chooseRoute, triageHelpRequest } from '../src/triage';

describe('help-request triage', () => {
  it('routes on the highest Drex probability when one option is clear', () => {
    expect(chooseRoute({ facilitator: 0.08, family: 0.87, support: 0.05 })).toBe('family');
    expect(chooseRoute({ facilitator: 0.71, family: 0.2, support: 0.09 })).toBe('facilitator');
  });

  it('refuses to route when the options are too close to call', () => {
    expect(chooseRoute({ facilitator: 0.34, family: 0.33, support: 0.33 })).toBeNull();
  });

  it('serves an urgent learner today even when the priority answer hesitates', () => {
    expect(choosePriority({ now: 0.2, soon: 0.6, whenever: 0.2 }, 0.84)).toBe('now');
    expect(choosePriority({ now: 0.1, soon: 0.82, whenever: 0.08 }, 0.12)).toBe('soon');
  });

  it('routes locally when no Nace key is configured', async () => {
    const env = loadEnv({ nodeEnv: 'test', naceApiKey: '' });
    const callBack = await triageHelpRequest({ requestType: 'call_back', lang: 'en', context: null }, env);
    expect(callBack).toMatchObject({
      route: 'facilitator',
      priority: 'now',
      urgent: true,
      source: 'local',
      model: null,
    });
    const whatsapp = await triageHelpRequest({ requestType: 'whatsapp', lang: 'pcm', context: null }, env);
    expect(whatsapp).toMatchObject({ route: 'family', priority: 'soon', source: 'local' });
  });
});