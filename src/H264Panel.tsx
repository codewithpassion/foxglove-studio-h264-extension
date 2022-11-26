import { CompressedImage } from "@foxglove/schemas/schemas/typescript";
import { PanelExtensionContext, RenderState, MessageEvent } from "@foxglove/studio";
// import { isEqual } from "lodash";
import React, { useLayoutEffect, useEffect, useState, useCallback, useRef } from "react";
import ReactDOM from "react-dom";

import H264WebCodecVideo from "./H264WebCodecVideo";
import { useH264State } from "./Settings";
import { Size } from "./hooks/useCanvasSize";

type ImageMessage = MessageEvent<CompressedImage>;

export type H264PanelProps = {
  context: PanelExtensionContext;
  onOverlayReady?: (parent: HTMLDivElement) => void;
};

const H264Panel: React.FC<H264PanelProps> = ({ context, onOverlayReady }) => {
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  const doneRef = useRef<() => void>(() => {
    return;
  });

  const { state, updatePanelSettingsEditor, imageTopics, setTopics } = useH264State(context);

  const [imageData, setImageData] = useState<Uint8Array | undefined>();
  const [canvasSize, setCanvasSize] = useState<Size | undefined>(undefined);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Save our state to the layout when the topic changes.
    // console.log("savestate", state.data.topic);
    // context.saveState(state);

    if (state.data.topic) {
      // Subscribe to the new image topic when a new topic is chosen.
      context.subscribe([{ topic: state.data.topic }]);
    }

    updatePanelSettingsEditor(imageTopics);
  }, [context, state.data.topic, imageTopics, updatePanelSettingsEditor]);

  const onRender = useCallback(
    (renderState: RenderState, done: () => void) => {
      doneRef.current = done;
      setRenderDone(done);

      if (renderState.topics) {
        setTopics(renderState.topics);
      }

      // Send the frames to the muxer
      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        renderState.currentFrame.forEach((f) => {
          const imageMessage = f as ImageMessage;
          setImageData(imageMessage.message.data);
        });
      }
    },
    [setTopics],
  );

  // Setup our onRender function and start watching topics and currentFrame for messages.
  useLayoutEffect(() => {
    context.onRender = onRender;

    context.watch("allFrames");
    context.watch("currentTime");
    context.watch("didSeek");
    context.watch("topics");
    context.watch("currentFrame");
  }, [context, onRender]);

  // Call our done function at the end of each render.
  // useEffect(() => {
  //   renderDone?.();
  // }, [renderDone]);

  useEffect(() => {
    if (overlayRef.current && onOverlayReady) {
      onOverlayReady(overlayRef.current);
    }
  }, [onOverlayReady]);

  return (
    <div style={{ height: "100%", flexGrow: 1, position: "relative" }}>
      {/* {Overlay && <Overlay />} */}
      <H264WebCodecVideo
        frameData={imageData}
        renderDone={renderDone}
        canvasUpdated={setCanvasSize}
      />
      <div
        ref={overlayRef}
        style={{
          display: "flex",
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          left: 0,
          width: canvasSize?.width ?? "100%",
          height: canvasSize?.height ?? "100%",
        }}
      ></div>
    </div>
  );
};

export function initExamplePanel(context: PanelExtensionContext): void {
  ReactDOM.render(<H264Panel context={context} />, context.panelElement);
}

export function initPanelWithOverlay(
  context: PanelExtensionContext,
  onOverlay: (parent: HTMLDivElement) => void,
): void {
  ReactDOM.render(
    <H264Panel context={context} onOverlayReady={onOverlay}></H264Panel>,
    context.panelElement,
  );
  // ReactDOM.render(<>{_Foo && <_Foo />}</>, context.panelElement);
}

export default H264Panel;
