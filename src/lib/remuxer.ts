import { Track } from "./Track";
import { SPS } from "./h264-utils";
import { MP4 } from "./mp4-generator";
import { getNalus, NaluTypes } from "./utils";

export class Remuxer {
  private isReady = false;
  private dts = 0;
  private seq = 0;
  private sps: SPS | undefined = undefined;
  private pps: Uint8Array | undefined = undefined;
  private initSegment: Uint8Array | undefined = undefined;
  private initSegmentSent = false;
  private sourceBuffer: SourceBuffer | undefined = undefined;
  private pending: Uint8Array = new Uint8Array(0);

  onReady: (codec: string) => void = () => null;

  public get codec(): string | undefined {
    if (this.sps) {
      return this.sps.MIME;
    } else {
      return undefined;
    }
  }

  setSourceBuffer(buffer: SourceBuffer): void {
    this.sourceBuffer = buffer;

    if (this.initSegment) {
      this.initSegmentSent = true;
      try {
        this.sourceBuffer?.appendBuffer(this.initSegment);
        // this.sourceBuffer?.appendBuffer(this.appendByteArray(this.initSegment, this.pending));
        if (this.pending.length > 0) {
          this.pending = new Uint8Array();
        }
      } catch (e) {
        console.error(`XX: Error `, e);
      }
    }
  }

  feed(frames: Uint8Array): void {
    const nalus = getNalus(frames);
    const units: Uint8Array[] = [];

    let hasInitSegment = false;
    for (const nalu of nalus) {
      if (!this.isReady && !this.pps && nalu.type === NaluTypes.PPS) {
        this.pps = nalu.nalu.nalu;
      }
      if (!this.isReady && !this.sps && nalu.type === NaluTypes.SPS) {
        this.sps = new SPS(nalu.nalu.nalu);
      }

      if (!this.isReady && this.sps && this.pps) {
        this.isReady = true;
        hasInitSegment = true;
        this.onReady(this.sps.MIME);
      } else {
        units.push(nalu.nalu.nalu);
      }
    }
    if (hasInitSegment) {
      const mediaDuration = 0;
      // const timescale = this.sps?.time_scale ?? 1000;
      const timescale = 1000;
      const track = this.getTrack();

      this.initSegment = MP4.initSegment([track], mediaDuration, timescale);

      if (this.sourceBuffer && !this.initSegmentSent) {
        this.initSegmentSent = true;
        // this.sourceBuffer.appendBuffer(this.initSegment);
        this.pending = this.initSegment;
      }
    }

    const sampleLength = units.reduce((len, cur) => len + cur.length, 0);
    const payload = new Uint8Array(sampleLength);
    let offset = 0;
    while (units.length > 0) {
      const unit = units.shift();
      if (unit) {
        payload.set(unit, offset);
        offset += unit.length;
      }
    }
    const track = this.getTrack()!;
    track.len = sampleLength;
    const moof = MP4.moof(this.seq++, this.dts++, track);
    const mdat = MP4.mdat(payload);
    const combined = this.appendByteArray(moof, mdat);
    if (this.sourceBuffer == undefined || this.sourceBuffer.updating) {
      this.pending = this.appendByteArray(this.pending, combined);
    } else {
      try {
        this.sourceBuffer.appendBuffer(this.appendByteArray(this.pending, combined));
      } catch (e) {
        console.error(`AppendBuffer error`, e);
      }

      this.pending = new Uint8Array(0);
    }
  }

  private getTrack(): Track | undefined {
    if (this.isReady && this.sps && this.pps) {
      const track: Track = {
        id: 1,
        type: "video",
        len: 0, // correct ??
        fragmented: true,
        sps: this.sps.bitstream.buffer,
        pps: this.pps,
        fps: this.sps.framesPerSecond ?? 60,
        width: this.sps.picWidth,
        height: this.sps.picHeight,
        // timescale: this.sps.time_scale ?? 1000,
        timescale: 1000,
        duration: 0,
        samples: [],
      };
      return track;
    }
    return undefined;
  }

  reset(): void {
    this.isReady = false;
    this.dts = 0;
    this.pps = undefined;
    this.sps = undefined;
    this.initSegment = undefined;
  }

  appendByteArray(buffer1: Uint8Array, buffer2: Uint8Array): Uint8Array {
    const tmp = new Uint8Array((buffer1.byteLength | 0) + (buffer2.byteLength | 0));
    tmp.set(buffer1, 0);
    tmp.set(buffer2, buffer1.byteLength | 0);
    return tmp;
  }
}
