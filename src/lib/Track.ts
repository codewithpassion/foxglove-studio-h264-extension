export type Track = {
  codec: string;
  id: number;
  type: "video";
  len: number;
  fragmented: boolean;
  sps: Uint8Array[];
  pps: Uint8Array[];
  fps: number;
  width: number;
  height: number;
  timescale: number;
  duration: number;
  samples: Uint8Array[];
};
