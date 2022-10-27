import { CompressedImage } from "@foxglove/schemas/schemas/typescript";
import { PanelExtensionContext, RenderState, MessageEvent } from "@foxglove/studio";
import { useLayoutEffect, useEffect, useState, useCallback } from "react";
import ReactDOM from "react-dom";

import H264WebCodecVideo from "./H264WebCodecVideo";
import { useH264State } from "./Settings";

type ImageMessage = MessageEvent<CompressedImage>;

function ExamplePanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const { state, updatePanelSettingsEditor, imageTopics, setTopics } = useH264State(context);

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

  const onRender = useCallback(
    (renderState: RenderState, done: () => void) => {
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

    context.watch("currentTime");
    context.watch("didSeek");
    context.watch("topics");
    context.watch("currentFrame");
  }, [context, onRender]);

  // Call our done function at the end of each render.
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  return (
    <div style={{ height: "100%", padding: "1rem" }}>
      <H264WebCodecVideo frameData={imageData} renderDone={renderDone} />
    </div>
  );
}

export function initExamplePanel(context: PanelExtensionContext): void {
  ReactDOM.render(<ExamplePanel context={context} />, context.panelElement);
}
