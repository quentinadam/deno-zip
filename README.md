# zip

[![JSR](https://jsr.io/badges/@quentinadam/zip)](https://jsr.io/@quentinadam/zip)
[![CI](https://github.com/quentinadam/deno-zip/actions/workflows/ci.yml/badge.svg)](https://github.com/quentinadam/deno-zip/actions/workflows/ci.yml)

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
