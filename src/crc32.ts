import require from '@quentinadam/require';

const POLYNOMIAL = -306674912;

const TABLE = /* @__PURE__ */ (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i;
    for (let bit = 8; bit > 0; --bit) {
      r = (r & 1) ? ((r >>> 1) ^ POLYNOMIAL) : (r >>> 1);
    }
    table[i] = r;
  }
  return table;
})();

export default function crc32(buffer: Uint8Array, crc = 0xFFFFFFFF) {
  for (const byte of buffer) {
    crc = require(TABLE[(crc ^ byte) & 0xff]) ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}
