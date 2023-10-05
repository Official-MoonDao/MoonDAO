//WIP, will use to store local batches

import { useEffect, useState } from "react";

export function useLocalStorage(key: string) {
  const [localData, setLocalData] = useState<any>();

  function getLocalData() {
    const localData = localStorage.getItem(key);
    if (localData) {
      setLocalData(JSON.parse(localData));
    }
  }

  function storeLocalData(data: any) {
    const localData = JSON.stringify(data);
    localStorage.setItem(key, localData);
  }

  useEffect(() => {
    if (key?.trim() !== "") getLocalData();
  }, [key]);

  return { data: localData, store: storeLocalData };
}
