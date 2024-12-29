# @quentinadam/zip

[![JSR][jsr-image]][jsr-url] [![NPM][npm-image]][npm-url] [![CI][ci-image]][ci-url]

A library for creating and extracting ZIP archives.

## Usage

```ts
import * as zip from '@quentinadam/zip';

const files = [
  { name: 'hello.txt', data: new TextEncoder().encode('hello world') },
  { name: 'ipsum/lorem.txt', data: new TextEncoder().encode('ipsum lorem') },
];

const buffer = await zip.create(files);

for (const { name, data } of await zip.extract(buffer)) {
  console.log(name, new TextDecoder().decode(data));
}
```

[ci-image]: https://img.shields.io/github/actions/workflow/status/quentinadam/deno-zip/ci.yml?branch=main&logo=github&style=flat-square
[ci-url]: https://github.com/quentinadam/deno-zip/actions/workflows/ci.yml
[npm-image]: https://img.shields.io/npm/v/@quentinadam/zip.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@quentinadam/zip
[jsr-image]: https://jsr.io/badges/@quentinadam/zip?style=flat-square
[jsr-url]: https://jsr.io/@quentinadam/zip
