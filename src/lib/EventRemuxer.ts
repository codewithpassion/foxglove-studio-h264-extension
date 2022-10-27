import { Track } from "./Track";
import { SPS } from "./h264-utils";
import { MP4 } from "./mp4-generator";
import { getNalus, NaluTypes } from "./utils";

export class EventRemuxer {
  private isReady = false;
  private dts = 0;
  private seq = 0;
  private sps: SPS | undefined = undefined;
  private pps: Uint8Array | undefined = undefined;
  private initSegment: Uint8Array | undefined = undefined;
  private initSegmentSent = false;
  private pending: Uint8Array = new Uint8Array(0);
  private canAppend = false;

  setCanAppend = ({ canAppend }: { canAppend: boolean }): void => {
    this.canAppend = canAppend;
    if (this.canAppend && this.initSegment && !this.initSegmentSent) {
      this.initSegmentSent = true;
      try {
        // this.onFrame(this.initSegment);
        this.onFrame({
          frame: this.appendByteArray(this.initSegment, this.pending),
          isKeyFrame: true,
        });
        if (this.pending.length > 0) {
          this.pending = new Uint8Array();
        }
      } catch (e) {
        console.error(`XX: Error `, e);
      }
    }
  };
  onReady: (codec: string) => void = () => null;
  onFrame: (data: { frame: Uint8Array; isKeyFrame: boolean }) => void = () => null;

  public get codec(): string | undefined {
    if (this.sps) {
      return this.sps.MIME;
    } else {
      return undefined;
    }
  }

  feed(frames: Uint8Array): void {
    const nalus = getNalus(frames);
    const units: Uint8Array[] = [];

    let hasInitSegment = false;
    let hasKeyframe = false;
    for (const nalu of nalus) {
      if (!this.isReady && !this.pps && nalu.type === NaluTypes.PPS) {
        this.pps = nalu.nalu.nalu;
        units.push(nalu.nalu.nalu);
      }
      if (!this.isReady && !this.sps && nalu.type === NaluTypes.SPS) {
        this.sps = new SPS(nalu.nalu.nalu);
        units.push(nalu.nalu.nalu);

        console.log(
          `fps: ${this.sps.framesPerSecond ?? "?"} - time_scale ${this.sps.time_scale ?? "?"} ` +
            `- fixed_frame_rate_flag: ${this.sps.fixed_frame_rate_flag ?? "?"} ` +
            `- num_units_in_tick: ${this.sps.num_units_in_tick ?? "?"}`,
        );
      }

      if (!this.isReady && this.sps && this.pps) {
        this.isReady = true;
        hasInitSegment = true;
        this.onReady(this.sps.MIME);
      } else {
        if (nalu.type === NaluTypes.IDR || nalu.type === NaluTypes.NDR) {
          units.push(nalu.nalu.nalu);
        }
      }
      if (nalu.type === NaluTypes.IDR) {
        hasKeyframe = true;
      }
    }
    if (hasInitSegment) {
      const mediaDuration = 0;
      // const timescale = this.sps?.time_scale ?? 1000;
      const timescale = 1000;
      const track = this.getTrack();

      this.initSegment = MP4.initSegment([track], mediaDuration, timescale);

      if (!this.initSegmentSent) {
        this.initSegmentSent = true;
        this.pending = this.initSegment;
      }
    }

    const sampleLength = units.reduce((len, cur) => len + cur.byteLength + 4, 0);
    const payload = new Uint8Array(sampleLength);
    let offset = 0;
    while (units.length > 0) {
      const unit = units.shift();
      if (unit) {
        const unitPayload = this.getLengthPrefixedData(unit);
        payload.set(unitPayload, offset);
        offset += unitPayload.length;
      }
    }

    const track = this.getTrack()!;
    if (track == undefined) {
      return;
    }
    const duration = 1000 / (this.sps?.framesPerSecond ?? 60);
    const mp4Sample = {
      size: sampleLength,
      duration,
      cts: 0,
      flags: {
        isLeading: 0,
        isDependedOn: 0,
        hasRedundancy: 0,
        degradPrio: 0,
        isNonSync: hasKeyframe ? 0 : 1,
        dependsOn: hasKeyframe ? 2 : 1,
      },
    };
    if (track == undefined) {
      debugger;
    }
    track.samples.push(mp4Sample);
    track.len = sampleLength;
    const moof = MP4.moof(this.seq++, this.dts, track);
    const mdat = MP4.mdat(payload);
    this.dts += duration;
    const combined = this.appendByteArray(moof, mdat);
    if (!this.canAppend) {
      this.pending = this.appendByteArray(this.pending, combined);
    } else {
      try {
        this.onFrame({
          frame: this.appendByteArray(this.pending, combined),
          isKeyFrame: hasKeyframe,
        });
      } catch (e) {
        console.error(`AppendBuffer error`, e);
      }

      this.pending = new Uint8Array(0);
    }
  }

  private getTrack(): Track | undefined {
    if (this.isReady && this.sps && this.pps) {
      const track: Track = {
        codec: this.sps.MIME,
        id: 3,
        type: "video",
        len: 0, // correct ??
        fragmented: true,
        sps: [this.sps.bitstream.stream],
        pps: [this.pps],
        fps: this.sps.framesPerSecond ?? 60,
        width: this.sps.picWidth,
        height: this.sps.picHeight,
        // timescale: this.sps.time_scale ?? 1000,
        timescale: 1000,
        duration: 1000,
        samples: [],
      };
      return track;
    }
    return undefined;
  }

  reset(): void {
    this.isReady = false;
    // this.dts = 0;
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

  private getLengthPrefixedData(buffer: Uint8Array): Uint8Array {
    const result = new Uint8Array(buffer.byteLength + 4);
    const view = new DataView(result.buffer);
    view.setUint32(0, buffer.byteLength);
    result.set(buffer, 4);
    return result;
  }
}
