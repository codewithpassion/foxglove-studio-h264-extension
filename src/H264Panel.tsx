import { CompressedImage } from "@foxglove/schemas/schemas/typescript";
import { PanelExtensionContext, RenderState, Topic, MessageEvent } from "@foxglove/studio";
import JMuxer from "jmuxer";
import { useLayoutEffect, useEffect, useState, useRef, useMemo, useCallback } from "react";
import ReactDOM from "react-dom";

type ImageMessage = MessageEvent<CompressedImage>;

type PanelState = {
  topic?: string;
};

const feedToMuxer = true;

// // Draws the compressed image data into our canvas.
function feedData(imgData: Uint8Array, muxer: JMuxer, format: string) {
  if (feedToMuxer) {
    // const parts = format.split("; ");

    // muxer.feed({ video: imgData, duration: parseFloat(parts[2]!) });
    muxer.feed({ video: imgData, duration: 1 / 60 });
  }
  console.log(format);
}

function ExamplePanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const videoRef = useRef<HTMLVideoElement>(null);

  const [muxer, setMuxer] = useState<JMuxer | undefined>(undefined);

  // Restore our state from the layout via the context.initialState property.
  const [state, setState] = useState<PanelState>(() => {
    return context.initialState as PanelState;
  });

  // Filter all of our topics to find the ones with a CompresssedImage message.
  const imageTopics = useMemo(
    () => (topics ?? []).filter((topic) => topic.datatype === "sensor_msgs/CompressedImage"),
    [topics],
  );

  useEffect(() => {
    // Save our state to the layout when the topic changes.
    context.saveState({ topic: state.topic });

    if (state.topic) {
      // Subscribe to the new image topic when a new topic is chosen.
      context.subscribe([state.topic]);
    }
  }, [context, state.topic]);

  // Choose our first available image topic as a default once we have a list of topics available.
  useEffect(() => {
    if (state.topic == undefined) {
      setState({ topic: imageTopics[0]?.name });
    }
  }, [state.topic, imageTopics]);

  // Setup our onRender function and start watching topics and currentFrame for messages.
  useLayoutEffect(() => {
    context.onRender = (renderState: RenderState, done) => {
      setRenderDone(() => done);
      setTopics(renderState.topics);

      // console.log(`curret frame: ${renderState.currentFrame?.length ?? "0"}`);
      // Send the most recent message to muxer
      if (renderState.currentFrame && renderState.currentFrame.length > 0) {
        if (muxer) {
          renderState.currentFrame.forEach((f) => {
            const imageMessage = f as ImageMessage;
            feedData(imageMessage.message.data, muxer, imageMessage?.message.format);
          });
        }
        // const imageMessage = renderState.currentFrame[
        //   renderState.currentFrame.length - 1
        // ] as ImageMessage;
        // if (muxer) {
        //   feedData(imageMessage.message.data, muxer, imageMessage?.message.format);
        // }
      }
    };

    context.watch("topics");
    context.watch("currentFrame");
  }, [context, muxer]);

  const onReset = useCallback(() => {
    muxer?.reset();
  }, [muxer]);

  useLayoutEffect(() => {
    const videoMux = new JMuxer({
      mode: "video",
      node: videoRef.current!,
      debug: true,
      flushingTime: 50,
      fps: 60,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      onMissingVideoFrames: () => {
        console.log("JMuxer: MISSING VIDEO FRAMES");
      },
      onReady: () => {
        console.log("JMuxer: Ready");
      },
      onError: (err) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`JMuxer error ${err}`);
      },
    });
    setMuxer(videoMux);
  }, []);

  // Call our done function at the end of each render.
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  return (
    <div style={{ height: "100%", padding: "1rem" }}>
      <div style={{ paddingBottom: "1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <label>Choose a topic to render:</label>
        <select
          value={state.topic}
          onChange={(event) => setState({ topic: event.target.value })}
          style={{ flex: 1 }}
        >
          {imageTopics.map((topic) => (
            <option key={topic.name} value={topic.name}>
              {topic.name}
            </option>
          ))}
        </select>
      </div>
      <button onClick={onReset}>Reset</button>
      <video autoPlay width={480} height={480} ref={videoRef} src="" />
    </div>
  );
}

export function initExamplePanel(context: PanelExtensionContext): void {
  ReactDOM.render(<ExamplePanel context={context} />, context.panelElement);
}
