import { assert } from '@quentinadam/assert';
import { equals, getUint16LE, getUint32LE } from '@quentinadam/uint8array-extension';
import * as zip from './zip.ts';

const UTF8_NAME_FLAG = 0x800;

Deno.test('extract reads an archive whose local and central extra fields differ', async () => {
  // `zip t.zip a.txt` with Info-ZIP Zip 3.0: the local extra field holds mtime and atime, the central one mtime only.
  const archive = Uint8Array.fromBase64(
    'UEsDBAoAAAAAAIMYIlggMDo2BgAAAAYAAAAFABwAYS50eHRVVAkAAyZ9k2UmfZNldXgLAAEEAAAAAAQAAAAAaGVsbG8KUEsBAh4DCgAAAAAAgxgiWCAw' +
      'OjYGAAAABgAAAAUAGAAAAAAAAQAAAKSBAAAAAGEudHh0VVQFAAMmfZNldXgLAAEEAAAAAAQAAAAAUEsFBgAAAAABAAEASwAAAEUAAAAAAA==',
  );
  const [file, ...rest] = await zip.extract(archive);
  assert(file !== undefined && rest.length === 0);
  assert(file.name === 'a.txt');
  assert(equals(file.data, new TextEncoder().encode('hello\n')));
  assert(file.lastModification.getTime() === new Date(2024, 0, 2, 3, 4, 6).getTime());
});

Deno.test('create marks file names as UTF-8', async () => {
  const archive = await zip.create([{ name: 'café.txt', data: new TextEncoder().encode('hello\n') }]);
  const localFlag = getUint16LE(archive, 6);
  const directoryOffset = getUint32LE(archive, archive.length - 6);
  const centralFlag = getUint16LE(archive, directoryOffset + 8);
  assert((localFlag & UTF8_NAME_FLAG) !== 0);
  assert((centralFlag & UTF8_NAME_FLAG) !== 0);
  const [file] = await zip.extract(archive);
  assert(file?.name === 'café.txt');
});
