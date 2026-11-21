/**
 * 16-bit mono PCM helpers for the phone line: Exotel streams raw little-endian samples;
 * Sarvam takes and returns WAV files.
 */

export interface Pcm {
  samples: Buffer; // 16-bit signed little-endian, mono
  sampleRate: number;
}

/** A WAV file -> its PCM (mixed down to mono if needed). Throws on anything but 16-bit PCM. */
export function wavToPcm(wav: Buffer): Pcm {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Not a WAV file');
  let offset = 12;
  let channels = 1;
  let sampleRate = 0;
  let bits = 16;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    let size = wav.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      if (wav.readUInt16LE(body) !== 1) throw new Error('WAV is not PCM');
      channels = wav.readUInt16LE(body + 2);
      sampleRate = wav.readUInt32LE(body + 4);
      bits = wav.readUInt16LE(body + 14);
    } else if (id === 'data') {
      if (bits !== 16) throw new Error(`WAV is ${bits}-bit, expected 16`);
      // Some encoders write 0 or 0xFFFFFFFF for a streamed length: take the rest of the file.
      if (size === 0 || body + size > wav.length) size = wav.length - body;
      let samples = wav.subarray(body, body + size - (size % (2 * channels)));
      if (channels > 1) samples = mixDown(samples, channels);
      return { samples, sampleRate };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('WAV has no data chunk');
}

function mixDown(interleaved: Buffer, channels: number): Buffer {
  const frames = interleaved.length / (2 * channels);
  const out = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += interleaved.readInt16LE((i * channels + c) * 2);
    out.writeInt16LE(Math.round(sum / channels), i * 2);
  }
  return out;
}

export function pcmToWav({ samples, sampleRate }: Pcm): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + samples.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
}

/** Linear resampling; good enough for speech going to or from a phone line. */
export function resample(pcm: Pcm, rate: number): Pcm {
  if (pcm.sampleRate === rate || !pcm.samples.length) return { samples: pcm.samples, sampleRate: rate };
  const inCount = pcm.samples.length / 2;
  const outCount = Math.max(1, Math.round((inCount * rate) / pcm.sampleRate));
  const out = Buffer.alloc(outCount * 2);
  const step = (inCount - 1) / Math.max(1, outCount - 1);
  for (let i = 0; i < outCount; i++) {
    const pos = i * step;
    const j = Math.floor(pos);
    const frac = pos - j;
    const a = pcm.samples.readInt16LE(j * 2);
    const b = j + 1 < inCount ? pcm.samples.readInt16LE((j + 1) * 2) : a;
    out.writeInt16LE(Math.round(a + (b - a) * frac), i * 2);
  }
  return { samples: out, sampleRate: rate };
}

/** Root-mean-square level of a PCM chunk, 0..32768. */
export function rms(samples: Buffer): number {
  const n = Math.floor(samples.length / 2);
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = samples.readInt16LE(i * 2);
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}

/**
 * Splits PCM into chunks Exotel accepts: a multiple of 320 bytes and at least 3,200
 * (the last chunk is padded with silence).
 */
export function chunksForExotel(samples: Buffer, chunkBytes = 6400): Buffer[] {
  const size = Math.max(3200, chunkBytes - (chunkBytes % 320));
  const out: Buffer[] = [];
  for (let i = 0; i < samples.length; i += size) {
    let chunk = samples.subarray(i, i + size);
    if (chunk.length < size) {
      const padded = Math.max(3200, Math.ceil(chunk.length / 320) * 320);
      chunk = Buffer.concat([chunk, Buffer.alloc(padded - chunk.length)]);
    }
    out.push(chunk);
  }
  return out;
}
