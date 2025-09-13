import * as Uint8ArrayExtension from '@quentinadam/uint8array-extension';

async function transform(
  stream: TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>,
  data: Uint8Array<ArrayBuffer>,
) {
  const writer = stream.writable.getWriter();
  writer.write(data);
  writer.close();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  for await (const chunk of stream.readable) {
    chunks.push(chunk);
  }
  return Uint8ArrayExtension.concat(chunks);
}

export async function decompress(buffer: Uint8Array<ArrayBuffer>, raw = false) {
  const stream = new DecompressionStream(raw ? 'deflate-raw' : 'deflate');
  return await transform(stream, buffer);
}

export async function compress(buffer: Uint8Array<ArrayBuffer>, raw = false) {
  const stream = new CompressionStream(raw ? 'deflate-raw' : 'deflate');
  return await transform(stream, buffer);
}
