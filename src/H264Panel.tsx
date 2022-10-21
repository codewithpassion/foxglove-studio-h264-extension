/* eslint-disable @typescript-eslint/ban-ts-comment */
import { CompressedImage } from "@foxglove/schemas/schemas/typescript";
import { PanelExtensionContext, RenderState, MessageEvent } from "@foxglove/studio";
import JMuxer from "jmuxer";
import { useLayoutEffect, useEffect, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom";

import { useH264State } from "./Settings";
import { NALUStream, SPS } from "./lib/h264-utils";
import { getNalus, identifyNaluStreamInfo, NaluStreamInfo } from "./lib/utils";

type ImageMessage = MessageEvent<CompressedImage>;

function ExamplePanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const videoRef = useRef<HTMLVideoElement>(null);
  const muxerRef = useRef<JMuxer | undefined>(undefined);
  const lastIFrameRef = useRef<Uint8Array | undefined>(undefined);

  const naluStreamInfoRef = useRef<NaluStreamInfo | undefined>(undefined);

  const { state, setState, updatePanelSettingsEditor, imageTopics, setTopics } =
    useH264State(context);

  useEffect(() => {
    // Save our state to the layout when the topic changes.
    context.saveState(state);

    if (state.data.topic) {
      // Subscribe to the new image topic when a new topic is chosen.
      context.subscribe([state.data.topic]);
    }

    updatePanelSettingsEditor(imageTopics);
  }, [context, state, imageTopics, updatePanelSettingsEditor]);

  const getNaluStreamInfo = useCallback((imgData: Uint8Array) => {
    if (naluStreamInfoRef.current == undefined) {
      const streamInfo = identifyNaluStreamInfo(imgData);
      if (streamInfo.type !== "unknown") {
        naluStreamInfoRef.current = streamInfo;
        console.info(
          `Stream identified as ${streamInfo.type} with box size: ${streamInfo.boxSize}`,
        );
      }
    }
    return naluStreamInfoRef.current;
  }, []);

  const getVideoData = useCallback(
    (imgData: Uint8Array) => {
      const streamInfo = getNaluStreamInfo(imgData);
      return streamInfo?.type === "packet"
        ? new NALUStream(imgData, {
            type: "packet",
            boxSize: streamInfo.boxSize,
          }).convertToAnnexB().buf
        : imgData;
    },
    [getNaluStreamInfo],
  );

  // // Draws the compressed image data into our canvas.
  const feedData = useCallback(
    ({
      imgData,
    }: // playbackSpeed,
    // addDuration,
    {
      imgData: Uint8Array;
      playbackSpeed: number | undefined;
      addDuration?: boolean;
    }) => {
      const videoData = getVideoData(imgData);

      // let duration = 1000 / 60;
      // if (playbackSpeed != undefined && playbackSpeed !== 0) {
      //   duration = duration / playbackSpeed;
      // }
      // if (addDuration) {
      //   muxerRef.current?.feed({ video: videoData, duration });
      // } else {
      //   muxerRef.current?.feed({ video: videoData });
      // }
      muxerRef.current?.feed({ video: videoData });
    },
    [getVideoData],
  );

  const onRender = useCallback(
    (renderState: RenderState, done: () => void) => {
      setRenderDone(() => done);

      if (renderState.topics) {
        setTopics(renderState.topics);
      }

      // if (videoRef.current && renderState.playbackSpeed != null) {
      //   videoRef.current.playbackRate = renderState.playbackSpeed;
      // }

      // Send the frames to the muxer
      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        if (muxerRef.current) {
          renderState.currentFrame.forEach((f) => {
            const imageMessage = f as ImageMessage;

            const nalus = getNalus(imageMessage.message.data);
            const spsNalus = nalus.filter((n) => n.type === 7);
            if (spsNalus.length > 0 && spsNalus[0]?.nalu.nalu) {
              // @ts-ignore
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const sps = new SPS(spsNalus[0]?.nalu.nalu);
              // console.log(sps.framesPerSecond);
            }

            feedData({
              imgData: imageMessage.message.data,
              playbackSpeed: renderState.playbackSpeed,
              // addDuration: state.debug?.addDuration ?? false,
            });

            // if (lastIFrameRef.current !== imageMessage.message.data) {
            //   const naluTypes = getNaluTypes(imageMessage.message.data);
            //   if (
            //     naluTypes.filter((t) => {
            //       new Set([/*1, 7, 8*/ 5]).has(t);
            //     }) != undefined
            //   ) {
            //     lastIFrameRef.current = imageMessage.message.data;
            //     console.log(`Got i-frame`);
            //   }
            // }
          });
        }
      }
    },
    [feedData, setTopics],
  );

  // Setup our onRender function and start watching topics and currentFrame for messages.
  useLayoutEffect(() => {
    context.onRender = onRender;

    context.watch("playbackSpeed");
    context.watch("currentTime");
    context.watch("didSeek");
    context.watch("topics");

    context.watch("currentFrame");
    context.watch("allFrames");
  }, [context, feedData, onRender, setTopics]);

  useLayoutEffect(() => {
    const debug = state.debug?.debug ?? false;
    console.info(`Jmuxer debug: ${debug ? "true" : "false"}`);

    if (muxerRef.current) {
      muxerRef.current.reset();
      muxerRef.current.destroy();
      muxerRef.current = undefined;
    }

    const readFpsFromTrack = state.data.readFpsFromSource ?? false;
    const videoMux = new JMuxer({
      mode: "video",
      node: videoRef.current!,
      debug,
      flushingTime: 1,
      fps: readFpsFromTrack ? undefined : state.data.fps ?? 60,

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // ^^^^^^^^^^  this is because the @types/jmuxer is not up to date.
      readFpsFromTrack,

      onReady: () => {
        console.log(
          `JMuxer: Ready - readFpsFromSource: ${
            state.data.readFpsFromSource === true ? "true" : "false"
          }${!readFpsFromTrack ? ` - FPS: ${state.data.fps ?? "?"}` : ""}`,
        );
        if (lastIFrameRef.current) {
          muxerRef.current?.feed({ video: lastIFrameRef.current });
        }
      },
      onError: (err: Error) => {
        console.log(`JMuxer error ${err.message}`);
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // ^^^^^^^^^^  this is because the @types/jmuxer is not up to date.
      onMissingVideoFrames: () => {
        console.log("JMuxer: MISSING VIDEO FRAMES");
      },
    });
    muxerRef.current = videoMux;
  }, [state.data.fps, state.data.readFpsFromSource, state.debug?.debug]);

  // Call our done function at the end of each render.
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  return (
    <div style={{ height: "100%", padding: "1rem" }}>
      <div style={{ paddingBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <label>Choose a topic to render:</label>
        <select
          value={state.data.topic}
          onChange={(event) =>
            setState({ ...state, data: { ...state.data, topic: event.target.value } })
          }
          style={{ flex: 1 }}
        >
          {imageTopics?.map((topic) => (
            <option key={topic.name} value={topic.name}>
              {topic.name}
            </option>
          ))}
        </select>
      </div>
      <video autoPlay width={480} height={480} ref={videoRef} src="" />
    </div>
  );
}

export function initExamplePanel(context: PanelExtensionContext): void {
  ReactDOM.render(<ExamplePanel context={context} />, context.panelElement);
}
