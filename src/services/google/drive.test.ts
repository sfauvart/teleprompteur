import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DriveError,
  createFile,
  ensureFolder,
  getContent,
  listAppFiles,
  multipartBody,
  updateFile,
} from './drive';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(...responses: Response[]) {
  const calls: { url: URL; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      calls.push({ url, init });
      const response = responses.shift();
      if (!response) throw new Error('réponse inattendue');
      return response;
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('client Drive', () => {
  it('construit un corps multipart métadonnées + contenu', () => {
    const { body, contentType } = multipartBody({ name: 'a.json' }, '{"x":1}', 'B');
    expect(contentType).toBe('multipart/related; boundary=B');
    expect(body).toBe(
      '--B\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"a.json"}\r\n' +
        '--B\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"x":1}\r\n--B--',
    );
  });

  it('crée un fichier dans le dossier, avec jeton et appProperties', async () => {
    const calls = mockFetch(
      json({ id: 'f1', name: 'a.json', modifiedTime: 't1', capabilities: { canEdit: true } }),
    );
    const file = await createFile('jeton', 'a.json', '{}', 'dossier');
    expect(file).toEqual({ id: 'f1', name: 'a.json', modifiedTime: 't1', canEdit: true });
    const [call] = calls;
    expect(call?.url.pathname).toBe('/upload/drive/v3/files');
    expect(call?.url.searchParams.get('uploadType')).toBe('multipart');
    expect(new Headers(call?.init.headers).get('Authorization')).toBe('Bearer jeton');
    expect(String(call?.init.body)).toContain('"parents":["dossier"]');
    expect(String(call?.init.body)).toContain(
      '"appProperties":{"app":"teleprompteur","format":"1"}',
    );
  });

  it('met à jour un fichier existant (PATCH)', async () => {
    const calls = mockFetch(json({ id: 'f1', modifiedTime: 't2' }));
    await updateFile('jeton', 'f1', 'b.json', '{}');
    expect(calls[0]?.init.method).toBe('PATCH');
    expect(calls[0]?.url.pathname).toBe('/upload/drive/v3/files/f1');
  });

  it('réutilise le dossier existant ou le recrée s’il est à la corbeille', async () => {
    mockFetch(json({ id: 'd1', trashed: false }));
    expect(await ensureFolder('jeton', 'd1')).toBe('d1');
    const calls = mockFetch(json({ id: 'd1', trashed: true }), json({ id: 'd2' }));
    expect(await ensureFolder('jeton', 'd1')).toBe('d2');
    expect(String(calls[1]?.init.body)).toContain('application/vnd.google-apps.folder');
  });

  it('recrée le dossier s’il a disparu', async () => {
    mockFetch(json({ error: { message: 'File not found' } }, 404), json({ id: 'd3' }));
    expect(await ensureFolder('jeton', 'd1')).toBe('d3');
  });

  it('lit un fichier public avec la clé d’API, sans jeton', async () => {
    const calls = mockFetch(new Response('contenu'));
    expect(await getContent({ apiKey: 'cle' }, 'f1')).toBe('contenu');
    expect(calls[0]?.url.searchParams.get('key')).toBe('cle');
    expect(calls[0]?.url.searchParams.get('alt')).toBe('media');
    expect(new Headers(calls[0]?.init.headers).has('Authorization')).toBe(false);
  });

  it('liste les fichiers de l’application', async () => {
    const calls = mockFetch(json({ files: [{ id: 'f1', name: 'a', modifiedTime: 't' }] }));
    expect(await listAppFiles('jeton')).toHaveLength(1);
    expect(calls[0]?.url.searchParams.get('q')).toContain("value='teleprompteur'");
  });

  it('traduit les erreurs HTTP', async () => {
    mockFetch(json({ error: { message: 'Invalid Credentials' } }, 401));
    await expect(getContent({ token: 'x' }, 'f1')).rejects.toMatchObject({
      kind: 'auth',
      status: 401,
    });
    mockFetch(json({}, 403));
    await expect(getContent({ token: 'x' }, 'f1')).rejects.toMatchObject({ kind: 'forbidden' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('offline'))),
    );
    await expect(getContent({ token: 'x' }, 'f1')).rejects.toBeInstanceOf(DriveError);
  });
});
