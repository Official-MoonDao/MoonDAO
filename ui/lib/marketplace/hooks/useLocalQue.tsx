import { useEffect, useState } from "react";
import { LocalQue } from "../marketplace-utils";

export function useLocalQue(address: string) {
  const [localQue, setLocalQue] = useState<LocalQue | undefined>(getLocalQue());

  function getLocalQue() {
    if (!address) return;
    const storedQue = localStorage.getItem(`multicallQue-${address}`);
    if (storedQue) {
      return JSON.parse(storedQue) as LocalQue;
    }
  }

  function storeLocalQue() {
    address &&
      localStorage.setItem(`multicallQue-${address}`, JSON.stringify(localQue));
  }

  useEffect(() => {
    if (localQue) storeLocalQue();
  }, [localQue]);

  useEffect(() => {
    if (address) setLocalQue(getLocalQue());
  }, [address]);

  return [localQue, setLocalQue];
}
