import assert from '@quentinadam/assert';
import Uint8ArrayExtension from '@quentinadam/uint8array-extension';
import crc32 from './crc32.ts';
import { compress, decompress } from './deflate.ts';

type DirectoryEntry = {
  version: number;
  requiredVersion: number;
  flag: number;
  compressionMethod: number;
  lastModificationTime: number;
  lastModificationDate: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  diskNumber: number;
  internalAttributes: number;
  externalAttributes: number;
  offset: number;
  name: string;
  extraField: Uint8Array;
  comment: Uint8Array;
};

type FileEntry = {
  requiredVersion: number;
  flag: number;
  compressionMethod: number;
  lastModificationTime: number;
  lastModificationDate: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  name: string;
  extraField: Uint8Array;
  data: Uint8Array;
};

type Directory = {
  countDisks: number;
  diskNumber: number;
  countDiskRecords: number;
  countRecords: number;
  size: number;
  offset: number;
  comment: Uint8Array;
};

const FILE_ENTRY_SIGNATURE = 0x04034b50;
const DIRECTORY_ENTRY_SIGNATURE = 0x02014b50;
const DIRECTORY_SIGNATURE = 0x06054b50;

class Reader {
  readonly #buffer;
  #offset;

  constructor(buffer: Uint8Array, offset = 0) {
    this.#buffer = buffer;
    this.#offset = offset;
  }

  seek(offset: number) {
    this.#offset = offset;
  }

  #read<T>(fn: () => T, length: number) {
    const result = fn();
    this.#offset += length;
    return result;
  }

  readUint16LE() {
    return this.#read(
      () => new Uint8ArrayExtension(this.#buffer).getUint16LE(this.#offset),
      2,
    );
  }

  readUint32LE() {
    return this.#read(
      () => new Uint8ArrayExtension(this.#buffer).getUint32LE(this.#offset),
      4,
    );
  }

  readBuffer(length: number) {
    return this.#read(
      () => this.#buffer.slice(this.#offset, this.#offset + length),
      length,
    );
  }

  locateDirectory() {
    const needle = Uint8ArrayExtension.fromUint32LE(DIRECTORY_SIGNATURE);
    for (let i = this.#buffer.length - needle.length; i >= 0; i--) {
      const result = (() => {
        for (let j = 0; j < needle.length; j++) {
          if (this.#buffer[i + j] !== needle[j]) {
            return false;
          }
        }
        return true;
      })();
      if (result) {
        this.#offset = i;
        return;
      }
    }
    throw new Error('Could not locate directory');
  }

  readDirectory(): Directory {
    assert(this.readUint32LE() === DIRECTORY_SIGNATURE);
    const countDisks = this.readUint16LE();
    const diskNumber = this.readUint16LE();
    const countDiskRecords = this.readUint16LE();
    const countRecords = this.readUint16LE();
    const size = this.readUint32LE();
    const offset = this.readUint32LE();
    const commentLength = this.readUint16LE();
    const comment = this.readBuffer(commentLength);
    return { countDisks, diskNumber, countDiskRecords, countRecords, size, offset, comment };
  }

  readDirectoryEntry(): DirectoryEntry {
    assert(this.readUint32LE() === DIRECTORY_ENTRY_SIGNATURE);
    const version = this.readUint16LE();
    const requiredVersion = this.readUint16LE();
    const flag = this.readUint16LE();
    const compressionMethod = this.readUint16LE();
    const lastModificationTime = this.readUint16LE();
    const lastModificationDate = this.readUint16LE();
    const crc32 = this.readUint32LE();
    const compressedSize = this.readUint32LE();
    const uncompressedSize = this.readUint32LE();
    const nameLength = this.readUint16LE();
    const extraFieldLength = this.readUint16LE();
    const commentLength = this.readUint16LE();
    const diskNumber = this.readUint16LE();
    const internalAttributes = this.readUint16LE();
    const externalAttributes = this.readUint32LE();
    const offset = this.readUint32LE();
    const name = new TextDecoder().decode(this.readBuffer(nameLength));
    const extraField = this.readBuffer(extraFieldLength);
    const comment = this.readBuffer(commentLength);
    return {
      version,
      requiredVersion,
      flag,
      compressionMethod,
      lastModificationTime,
      lastModificationDate,
      crc32,
      compressedSize,
      uncompressedSize,
      diskNumber,
      internalAttributes,
      externalAttributes,
      offset,
      name,
      extraField,
      comment,
    };
  }

  readFileEntry(directoryEntry: DirectoryEntry): FileEntry {
    this.seek(directoryEntry.offset);
    assert(this.readUint32LE() === FILE_ENTRY_SIGNATURE);
    const requiredVersion = this.readUint16LE();
    assert(requiredVersion === directoryEntry.requiredVersion);
    const flag = this.readUint16LE();
    assert(flag === directoryEntry.flag);
    const compressionMethod = this.readUint16LE();
    assert(compressionMethod === directoryEntry.compressionMethod);
    const lastModificationTime = this.readUint16LE();
    assert(lastModificationTime === directoryEntry.lastModificationTime);
    const lastModificationDate = this.readUint16LE();
    assert(lastModificationDate === directoryEntry.lastModificationDate);

    let crc32 = this.readUint32LE();
    if (crc32 !== 0) {
      assert(crc32 === directoryEntry.crc32);
    } else {
      crc32 = directoryEntry.crc32;
    }
    let compressedSize = this.readUint32LE();
    if (compressedSize !== 0) {
      assert(compressedSize === directoryEntry.compressedSize);
    } else {
      compressedSize = directoryEntry.compressedSize;
    }
    let uncompressedSize = this.readUint32LE();
    if (uncompressedSize !== 0) {
      assert(uncompressedSize === directoryEntry.uncompressedSize);
    } else {
      uncompressedSize = directoryEntry.uncompressedSize;
    }
    const nameLength = this.readUint16LE();
    const extraFieldLength = this.readUint16LE();
    const name = new TextDecoder().decode(this.readBuffer(nameLength));
    assert(name === directoryEntry.name);
    const extraField = this.readBuffer(extraFieldLength);
    assert(new Uint8ArrayExtension(extraField).equals(directoryEntry.extraField));
    const data = this.readBuffer(compressedSize);
    return {
      requiredVersion,
      flag,
      compressionMethod,
      lastModificationTime,
      lastModificationDate,
      crc32,
      compressedSize,
      uncompressedSize,
      name,
      extraField,
      data,
    };
  }
}

class Writer {
  readonly #chunks = new Array<Uint8Array>();
  #length = 0;

  writeBuffer(buffer: Uint8Array) {
    this.#chunks.push(buffer);
    this.#length += buffer.length;
    return this;
  }

  writeUint16LE(value: number) {
    return this.writeBuffer(Uint8ArrayExtension.fromUint16LE(value));
  }

  writeUint32LE(value: number) {
    return this.writeBuffer(Uint8ArrayExtension.fromUint32LE(value));
  }

  get length() {
    return this.#length;
  }

  writeDirectory(directory: Directory) {
    this.writeUint32LE(DIRECTORY_SIGNATURE);
    this.writeUint16LE(directory.countDisks);
    this.writeUint16LE(directory.diskNumber);
    this.writeUint16LE(directory.countDiskRecords);
    this.writeUint16LE(directory.countRecords);
    this.writeUint32LE(directory.size);
    this.writeUint32LE(directory.offset);
    this.writeUint16LE(directory.comment.length);
    this.writeBuffer(directory.comment);
    return this;
  }

  writeDirectoryEntry(entry: DirectoryEntry) {
    const encodedName = new TextEncoder().encode(entry.name);
    this.writeUint32LE(DIRECTORY_ENTRY_SIGNATURE);
    this.writeUint16LE(entry.version);
    this.writeUint16LE(entry.requiredVersion);
    this.writeUint16LE(entry.flag);
    this.writeUint16LE(entry.compressionMethod);
    this.writeUint16LE(entry.lastModificationTime);
    this.writeUint16LE(entry.lastModificationDate);
    this.writeUint32LE(entry.crc32);
    this.writeUint32LE(entry.compressedSize);
    this.writeUint32LE(entry.uncompressedSize);
    this.writeUint16LE(encodedName.length);
    this.writeUint16LE(entry.extraField.length);
    this.writeUint16LE(entry.comment.length);
    this.writeUint16LE(entry.diskNumber);
    this.writeUint16LE(entry.internalAttributes);
    this.writeUint32LE(entry.externalAttributes);
    this.writeUint32LE(entry.offset);
    this.writeBuffer(encodedName);
    this.writeBuffer(entry.extraField);
    this.writeBuffer(entry.comment);
    return this;
  }

  writeFileEntry(entry: FileEntry) {
    const encodedName = new TextEncoder().encode(entry.name);
    this.writeUint32LE(FILE_ENTRY_SIGNATURE);
    this.writeUint16LE(entry.requiredVersion);
    this.writeUint16LE(entry.flag);
    this.writeUint16LE(entry.compressionMethod);
    this.writeUint16LE(entry.lastModificationTime);
    this.writeUint16LE(entry.lastModificationDate);
    this.writeUint32LE(entry.crc32);
    this.writeUint32LE(entry.compressedSize);
    this.writeUint32LE(entry.uncompressedSize);
    this.writeUint16LE(encodedName.length);
    this.writeUint16LE(entry.extraField.length);
    this.writeBuffer(encodedName);
    this.writeBuffer(entry.extraField);
    this.writeBuffer(entry.data);
  }

  serialize() {
    return Uint8ArrayExtension.concat(this.#chunks);
  }
}

function deserializeLastModification({ lastModificationDate, lastModificationTime }: {
  lastModificationDate: number;
  lastModificationTime: number;
}) {
  const year = ((lastModificationDate >> 9) & 0x7f) + 1980;
  const month = (lastModificationDate >> 5) & 0xf;
  const day = lastModificationDate & 0x1f;
  const hour = (lastModificationTime >> 11) & 0x1f;
  const minute = (lastModificationTime >> 5) & 0x3f;
  const second = (lastModificationTime & 0x1f) * 2;
  return new Date(year, month - 1, day, hour, minute, second);
}

function serializeLastModification(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  return {
    lastModificationDate: ((year - 1980) << 9) | (month << 5) | day,
    lastModificationTime: (hour << 11) | (minute << 5) | (second / 2),
  };
}

/**
 * Extracts files from a ZIP archive.
 * @param buffer An Uint8Array containing the ZIP archive.
 * @returns A list of files extracted from the ZIP archive.
 */
export async function extract(
  buffer: Uint8Array,
): Promise<{ name: string; data: Uint8Array; lastModification: Date }[]> {
  const reader = new Reader(buffer);
  reader.locateDirectory();
  const directory = reader.readDirectory();
  assert(directory.countDisks === 0);
  assert(directory.diskNumber === 0);
  assert(directory.countDiskRecords === directory.countRecords);
  reader.seek(directory.offset);
  const directoryEntries = new Array<DirectoryEntry>();
  for (let i = 0; i < directory.countRecords; i++) {
    const directoryEntry = reader.readDirectoryEntry();
    assert(directoryEntry.diskNumber === 0);
    directoryEntries.push(directoryEntry);
  }
  const files = new Array<{ name: string; data: Uint8Array; lastModification: Date }>();
  for (const directoryEntry of directoryEntries) {
    const fileEntry = reader.readFileEntry(directoryEntry);
    const data = await (async () => {
      if (fileEntry.compressionMethod === 0) {
        return fileEntry.data;
      }
      if (fileEntry.compressionMethod === 8) {
        return await decompress(fileEntry.data, true);
      }
      throw new Error(`Unsupported compression method ${fileEntry.compressionMethod}`);
    })();
    const lastModification = deserializeLastModification({
      lastModificationDate: fileEntry.lastModificationDate,
      lastModificationTime: fileEntry.lastModificationTime,
    });
    assert(fileEntry.uncompressedSize === data.length);
    assert(crc32(data) === fileEntry.crc32);
    files.push({ name: fileEntry.name, data, lastModification });
  }
  return files;
}

/**
 * Creates a ZIP archive from a list of files.
 * @param files List of files to include in the archive.
 * @returns An Uint8Array containing the ZIP archive.
 */
export async function create(
  files: { name: string; data: Uint8Array; lastModification?: Date }[],
): Promise<Uint8Array> {
  const writer = new Writer();
  const entries = new Array<DirectoryEntry & { data: Uint8Array }>();
  for (const file of files) {
    const { data, compressed } = await (async () => {
      const compressedData = await compress(file.data, true);
      if (compressedData.length < file.data.length) {
        return { data: compressedData, compressed: true };
      } else {
        return { data: file.data, compressed: false };
      }
    })();
    const { lastModificationDate, lastModificationTime } = serializeLastModification(
      file.lastModification ?? new Date(),
    );
    const entry = {
      version: 45,
      requiredVersion: 20,
      flag: 6,
      compressionMethod: compressed ? 8 : 0,
      lastModificationTime,
      lastModificationDate,
      crc32: crc32(file.data),
      compressedSize: data.length,
      uncompressedSize: file.data.length,
      diskNumber: 0,
      internalAttributes: 0,
      externalAttributes: 0,
      offset: writer.length,
      name: file.name,
      extraField: new Uint8Array(),
      comment: new Uint8Array(),
      data,
    };
    entries.push(entry);
    writer.writeFileEntry(entry);
  }
  const offset = writer.length;
  for (const directoryEntry of entries) {
    writer.writeDirectoryEntry(directoryEntry);
  }
  writer.writeDirectory({
    countDisks: 0,
    diskNumber: 0,
    countDiskRecords: entries.length,
    countRecords: entries.length,
    size: writer.length - offset,
    offset,
    comment: new Uint8Array(),
  });
  return writer.serialize();
}
