import { afterEach, describe, expect, it, vi } from 'vitest';
import { heuristicSuggest, llmSuggester, suggestPillar, type PillarSuggester } from './suggestPillar';

const text = (t: string, tags: string[] = []) => ({ type: 'text' as const, text: t, tags });

describe('heuristic pillar suggestion', () => {
  it.each([
    ['Suya-spiced fried chicken with a yaji rub', 'food'],
    ['Warm wood and green tile behind the counter', 'space'],
    ['Counter seating, 8 stools facing the pass', 'space'],
    ['Counter service: order at the register, ticket number', 'service'],
    ['Name idea: Benne & Bay, with a hand-painted logo', 'brand'],
    ['Paid family meal every shift keeps the crew together', 'team'],
    ['Food cost under 30% and rent under $9k', 'numbers'],
    ['Regulars want to be remembered, lunch crowd from the offices', 'guest'],
  ])('"%s" -> %s', (t, pillar) => {
    expect(heuristicSuggest(text(t)).pillar).toBe(pillar);
  });

  it('quick tags steer the result', () => {
    expect(heuristicSuggest(text('something vague', ['hiring'])).pillar).toBe('team');
  });
  it('falls back gently with zero confidence when nothing matches', () => {
    const s = heuristicSuggest(text('hmm'));
    expect(s.confidence).toBe(0);
    expect(s.pillar).toBe('food');
    expect(heuristicSuggest({ type: 'photo', tags: [] }).pillar).toBe('space');
  });
  it('confidence is between 0 and 1', () => {
    const s = heuristicSuggest(text('jollof rice bowl with fried chicken'));
    expect(s.confidence).toBeGreaterThan(0);
    expect(s.confidence).toBeLessThanOrEqual(1);
  });
});

describe('suggestPillar interface', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the local heuristic by default and never touches the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const s = await suggestPillar(text('plantain and shito mayo'));
    expect(s.source).toBe('heuristic');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('stays local when the LLM hook is configured but not opted in', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await suggestPillar(text('plantain'), { llm: { enabled: false, endpoint: 'https://example.test/x' } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('the method is swappable via the interface', async () => {
    const fake: PillarSuggester = { name: 'fake', suggest: async () => ({ pillar: 'numbers', confidence: 1, source: 'heuristic' }) };
    expect((await suggestPillar(text('plantain'), { suggester: fake })).pillar).toBe('numbers');
  });

  it('falls back to the heuristic when a suggester throws', async () => {
    const broken: PillarSuggester = { name: 'broken', suggest: async () => { throw new Error('offline'); } };
    const s = await suggestPillar(text('warm wood floor'), { suggester: broken });
    expect(s.pillar).toBe('space');
  });

  it('LLM hook sends text only and validates the reply', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ pillar: 'brand' })));
    const s = await llmSuggester('https://example.test/x', fetchMock as unknown as typeof fetch).suggest(text('a name', ['name']));
    expect(s).toMatchObject({ pillar: 'brand', source: 'llm' });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(Object.keys(body).sort()).toEqual(['pillars', 'tags', 'text']);
  });

  it('rejects an unknown pillar from the LLM', async () => {
    const bad = vi.fn(async () => new Response(JSON.stringify({ pillar: 'lasers' })));
    await expect(llmSuggester('https://example.test/x', bad as unknown as typeof fetch).suggest(text('x'))).rejects.toThrow();
  });
});
