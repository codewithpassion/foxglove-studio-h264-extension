/* eslint-disable @typescript-eslint/ban-ts-comment */
import { CompressedImage } from "@foxglove/schemas/schemas/typescript";
import { PanelExtensionContext, RenderState, MessageEvent } from "@foxglove/studio";
import { useLayoutEffect, useEffect, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom";

import H264Video from "./H264Video";
import { useH264State } from "./Settings";
import { NALUStream } from "./lib/h264-utils";
import { identifyNaluStreamInfo, NaluStreamInfo } from "./lib/utils";

type ImageMessage = MessageEvent<CompressedImage>;

function ExamplePanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  // const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const renderDoneRef = useRef<(() => void) | undefined>(undefined);
  const renderCalled = useRef(false);

  const naluStreamInfoRef = useRef<NaluStreamInfo | undefined>(undefined);

  const { state, setState, updatePanelSettingsEditor, imageTopics, setTopics } =
    useH264State(context);

  const [imageData, setImageData] = useState<Uint8Array | undefined>();

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

  const onRender = useCallback(
    (renderState: RenderState, done: () => void) => {
      renderCalled.current = false;
      renderDoneRef.current = () => {
        if (!renderCalled.current) {
          renderCalled.current = true;
          done();
        }
      };

      if (renderState.topics) {
        setTopics(renderState.topics);
      }

      // Send the frames to the muxer
      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        renderState.currentFrame.forEach((f) => {
          const imageMessage = f as ImageMessage;
          setImageData(getVideoData(imageMessage.message.data));
        });
      }

      setTimeout(renderDoneRef.current, 50);
    },
    [getVideoData, setTopics],
  );

  // Setup our onRender function and start watching topics and currentFrame for messages.
  useLayoutEffect(() => {
    context.onRender = onRender;

    context.watch("playbackSpeed");
    context.watch("currentTime");
    context.watch("didSeek");
    context.watch("topics");

    context.watch("currentFrame");
  }, [context, onRender]);

  // Call our done function at the end of each render.
  // useEffect(() => {
  //   // renderDone?.();
  // }, [renderDone]);

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
      <H264Video frameData={imageData} renderDone={renderDoneRef.current} />
    </div>
  );
}

export function initExamplePanel(context: PanelExtensionContext): void {
  ReactDOM.render(<ExamplePanel context={context} />, context.panelElement);
}
