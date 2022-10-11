import { ExtensionContext } from "@foxglove/studio";

import { initExamplePanel } from "./H264Panel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({
    name: "H264 Playback",
    initPanel: initExamplePanel,
  });
}
