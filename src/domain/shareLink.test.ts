import { describe, expect, it } from 'vitest';
import { deflateSync, strToU8 } from 'fflate';
import { DEFAULT_SETTINGS, normalizeSettings } from './settings';
import {
  SHARE_LINK,
  base64UrlEncode,
  buildShareLink,
  decodeSharedPrompt,
  encodeSharedPrompt,
  parseRestoreFragment,
} from './shareLink';

const BASE = 'https://www.sebastien-fauvart.fr/teleprompteur/';

describe('lien de partage', () => {
  it('aller-retour avec accents, emojis et réglages', () => {
    const prompt = {
      title: 'Vœux 2027 🎉',
      text: 'Chères et chers collègues,\n\nmerci à tous… « bonne année » !',
      settings: normalizeSettings({ speed: { unit: 'pxps', value: 60 }, mirrorX: true }),
    };
    expect(decodeSharedPrompt(encodeSharedPrompt(prompt))).toEqual(prompt);
  });

  it('produit une URL avec le fragment #prompt=1.', () => {
    const { url, status } = buildShareLink(
      { title: 'T', text: 'Bonjour', settings: DEFAULT_SETTINGS },
      BASE + '#/ancien',
    );
    expect(url.startsWith(`${BASE}#prompt=1.`)).toBe(true);
    expect(status).toBe('ok');
  });

  it('signale les liens longs puis trop longs', () => {
    // Lettres aléatoires : peu compressibles, comme un texte réel peu redondant.
    const random = (n: number) =>
      Array.from({ length: n }, () =>
        String.fromCharCode(97 + Math.floor(Math.random() * 26)),
      ).join('');
    const long = buildShareLink(
      { title: '', text: random(12_000), settings: DEFAULT_SETTINGS },
      BASE,
    );
    expect(long.status).toBe('long');
    const tooLong = buildShareLink(
      { title: '', text: random(90_000), settings: DEFAULT_SETTINGS },
      BASE,
    );
    expect(tooLong.status).toBe('too-long');
  });

  it('rejette une version inconnue ou un contenu corrompu', () => {
    expect(() => decodeSharedPrompt('2.abc')).toThrow();
    expect(() => decodeSharedPrompt('1.@@@')).toThrow();
    expect(() => decodeSharedPrompt('1.' + base64UrlEncode(strToU8('pas du deflate')))).toThrow();
  });

  it('rejette un JSON qui ne respecte pas le schéma', () => {
    const payload = '1.' + base64UrlEncode(deflateSync(strToU8(JSON.stringify({ title: 'x' }))));
    expect(() => decodeSharedPrompt(payload)).toThrow();
  });

  it('interrompt une décompression trop volumineuse', () => {
    const bomb = deflateSync(strToU8(' '.repeat(SHARE_LINK.maxDecompressedBytes + 10)), {
      level: 9,
    });
    expect(() => decodeSharedPrompt('1.' + base64UrlEncode(bomb))).toThrow(/volumineux/);
  });
});

describe('parseRestoreFragment', () => {
  it('reconnaît les fragments de restauration', () => {
    expect(parseRestoreFragment('#prompt=1.abc')).toEqual({ kind: 'prompt', payload: '1.abc' });
    expect(parseRestoreFragment('#gdrive=1AbC_d-EfGhIjK')).toEqual({
      kind: 'gdrive',
      fileId: '1AbC_d-EfGhIjK',
    });
    expect(parseRestoreFragment('#gdrive=../x')).toEqual({ kind: 'invalid-gdrive' });
  });

  it('ignore les routes', () => {
    expect(parseRestoreFragment('#/prompts')).toBeNull();
    expect(parseRestoreFragment('')).toBeNull();
  });
});
