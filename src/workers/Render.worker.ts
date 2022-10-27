import { EventRemuxer } from "../lib/EventRemuxer";
import { SPS } from "../lib/h264-utils";
import { getNalus, NaluTypes } from "../lib/utils";
import { InitRenderEvent, RenderEvent, WorkerEvent } from "./RenderEvents";
import { WebGLRenderer } from "./WebGLRenderer";

export type StatusType = "render" | "decode";
type PartialRecord<K extends string, T> = Partial<Record<K, T>>;
export type StatusUpdate = PartialRecord<StatusType, string>;

const scope = self as unknown as Worker;

let pendingStatus: StatusUpdate | null = null;

function setStatus(type: StatusType, message: string) {
  if (pendingStatus) {
    pendingStatus[type] = message;
  } else {
    pendingStatus = { [type]: message };

    self.requestAnimationFrame(statusAnimationFrame);
  }
}

function statusAnimationFrame() {
  self.postMessage(pendingStatus);
  pendingStatus = null;
}

// Rendering. Drawing is limited to once per animation frame.
let renderer: { draw(data: VideoFrame): void } | null = null;
let pendingFrame: VideoFrame | null = null;
let startTime: number | null = null;
let frameCount = 0;

// Set up a VideoDecoer.
const decoder = new VideoDecoder({
  output(frame: VideoFrame) {
    console.log(`XX got frame`, frame);
    // Update statistics.
    if (startTime == null) {
      startTime = performance.now();
    } else {
      const elapsed = (performance.now() - startTime) / 1000;
      const fps = ++frameCount / elapsed;
      setStatus("render", `${fps.toFixed(0)} fps`);
    }

    // Schedule the frame to be rendered.
    renderFrame(frame);
  },
  error(e) {
    setStatus("decode", e.message);
    console.error(`XX Decode error`, e);
  },
});
const remuxer = new EventRemuxer();
remuxer.onFrame = (data: { frame: Uint8Array; isKeyFrame: boolean }) => {
  console.log(`XX Remuxer frame`);
  decoder.decode(
    new EncodedVideoChunk({
      type: data.isKeyFrame ? "key" : "delta",
      timestamp: dts++,
      data: data.frame,
    }),
  );
};

function renderFrame(frame: VideoFrame) {
  if (!pendingFrame) {
    // Schedule rendering in the next animation frame.
    requestAnimationFrame(renderAnimationFrame);
  } else {
    // Close the current pending frame before replacing it.
    pendingFrame.close();
  }
  // Set or replace the pending frame.
  pendingFrame = frame;
}

function renderAnimationFrame() {
  if (pendingFrame) {
    renderer?.draw(pendingFrame);
    pendingFrame = null;
  }
}

function getDecoderConfig(frameData: Uint8Array): VideoDecoderConfig | null {
  const nalus = getNalus(frameData);
  const spsNalu = nalus.find((n) => n.type === NaluTypes.SPS);
  if (spsNalu) {
    const sps = new SPS(spsNalu.nalu.nalu);
    const decoderConfig: VideoDecoderConfig = {
      codec: sps.MIME,
      codedHeight: sps.picHeight,
      codedWidth: sps.picWidth,
      // description:
    };
    return decoderConfig;
  }
  return null;
}

// function isKeyFrame(frameData: Uint8Array): boolean {
//   const nalus = getNalus(frameData);
//   return nalus.find((n) => n.type === NaluTypes.IDR) != undefined;
// }

let dts = 0;

// Subscribe to the 'message' event
scope.addEventListener("message", (event: MessageEvent<WorkerEvent>) => {
  console.log(`XX Received message`, event);
  if (event.data.type === "init") {
    const eventData = event.data as InitRenderEvent;
    renderer = new WebGLRenderer("webgl2", eventData.canvas);
    // eventData.canvas;
  } else if (event.data.type === "frame") {
    const eventData = event.data as RenderEvent;
    const frame = new Uint8Array(eventData.frameData);
    if (decoder.state === "unconfigured") {
      const decoderConfig = getDecoderConfig(frame);
      if (decoderConfig) {
        decoder.configure(decoderConfig);
      }
      console.log("XX Decoder config: ", decoderConfig);
      console.log("XX Decoder status", decoder.state);
    } else if (decoder.state === "configured") {
      // const keyframe = isKeyFrame(new Uint8Array(eventData.frameData)) ? "key" : "delta";

      remuxer.feed(frame);
      // decoder.decode(
      //   new EncodedAudioChunk({
      //     type: keyframe,
      //     data: eventData.frameData,
      //     timestamp: dts++,
      //   }),
      // );
    }
  }
});

export {};
