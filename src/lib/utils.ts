import { Bitstream, NALUStream, StreamType } from "./h264-utils";

export type NaluStreamType = StreamType;
export type NaluStreamInfo = { type: NaluStreamType; boxSize: number };

function identifyNaluStreamInfo(buffer: Uint8Array): NaluStreamInfo {
  let stream: NALUStream | undefined;
  try {
    stream = new NALUStream(buffer, { strict: true, type: "unknown" });
  } catch (err) {
    stream = undefined;
  }
  if (stream?.type && stream?.boxSize != null) {
    return { type: stream.type, boxSize: stream.boxSize };
  }
  return { type: "unknown", boxSize: -1 };
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getNaluTypes(buffer: Uint8Array): number[] {
  const stream = new NALUStream(buffer, { type: "annexB" });
  const result: number[] = [];

  for (const nalu of stream.nalus()) {
    if (nalu?.nalu) {
      const bitstream = new Bitstream(nalu?.nalu);
      bitstream.seek(3);
      const nal_unit_type = bitstream.u(5);
      if (nal_unit_type != undefined) {
        result.push(nal_unit_type);
      }
    }
  }

  return result;
}

export { identifyNaluStreamInfo, getNaluTypes };
