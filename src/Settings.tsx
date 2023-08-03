import { PanelExtensionContext, SettingsTreeAction, Topic } from "@foxglove/studio";
import produce from "immer";
import { set } from "lodash";
import { useCallback, useMemo, useState } from "react";

export type H264State = {
  data: {
    topic?: string;
  };
};

type UseH264StateType = {
  state: H264State;
  imageTopics: readonly Topic[] | undefined;
  setState: (state: H264State) => void;
  updatePanelSettingsEditor: (topics: readonly Topic[] | undefined) => void;
  setTopics: (topics: readonly Topic[]) => void;
};

// Respond to actions from the settings editor to update our state.
const useH264State = (context: PanelExtensionContext): UseH264StateType => {
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();

  // Filter all of our topics to find the ones with a CompresssedImage message.
  const imageTopics = useMemo(
    () => (topics ?? []).filter((topic) => topic.datatype === "sensor_msgs/CompressedImage" || topic.datatype === "foxglove.CompressedImage"),
    [topics],
  );

  // Restore our state from the layout via the context.initialState property.
  const [state, setState] = useState<H264State>(() => {
    const partialState = context.initialState as Partial<H264State>;

    return {
      data: {
        topic: partialState?.data?.topic ?? (imageTopics.length > 0 ? imageTopics[0]?.name : ""),
      },
    };
  });

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update") {
        const { path, value } = action.payload;
        // We use a combination of immer and lodash to produce a new state object
        // so react will re-render our panel.
        const newState = produce<H264State>((draft) => set(draft, path, value));
        setState(newState);

        // If the topic was changed update our subscriptions.
        if (path[1] === "topic") {
          context.subscribe([value as string]);
        }
      }
    },
    [context],
  );

  const updatePanelSettingsEditor = useCallback(
    (availableTopics: readonly Topic[] | undefined) => {
      const topicOptions = (availableTopics ?? []).map((topic) => ({
        value: topic.name,
        label: topic.name,
      }));

      // We set up our settings tree to mirror the shape of our panel state so we
      // can use the paths to values from the settings tree to directly update our state.
      context.updatePanelSettingsEditor({
        actionHandler,
        nodes: {
          data: {
            label: "Data",
            icon: "Cube",
            fields: {
              topic: {
                label: "Topic",
                input: "select",
                options: topicOptions,
                value: state.data.topic,
              },
            },
          },
        },
      });
    },
    [actionHandler, context, state.data],
  );

  return useMemo(
    () => ({
      state,
      imageTopics,
      setState,
      setTopics,
      updatePanelSettingsEditor,
    }),
    [imageTopics, state, updatePanelSettingsEditor],
  );
};

export { useH264State };
