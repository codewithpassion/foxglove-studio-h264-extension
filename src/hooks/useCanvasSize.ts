import { useCallback, useState } from "react";
import { useEventListener, useIsomorphicLayoutEffect } from "usehooks-ts";

export type Size = { width: number; height: number };

function useCanvasSize<T extends HTMLCanvasElement>(): [
  (node: T | null) => void,
  Size | null,
  T | null,
] {
  // Mutable values like 'ref.current' aren't valid dependencies
  // because mutating them doesn't re-render the component.
  // Instead, we use a state as a ref to be reactive.
  const [ref, setRef] = useState<T | null>(null);
  const [size, setSize] = useState<Size | null>(null);

  // Prevent too many rendering using useCallback
  const handleSize = useCallback(() => {
    if (ref) {
      setSize(ref.getBoundingClientRect());
    }
  }, [ref]);

  useEventListener("resize", handleSize);
  useEventListener("load", handleSize);

  useIsomorphicLayoutEffect(() => {
    handleSize();
  }, [ref]);

  return [setRef, size, ref];
}

export default useCanvasSize;
