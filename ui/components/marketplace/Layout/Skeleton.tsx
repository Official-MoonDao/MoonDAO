import React from "react";

type Props = {
  width?: string;
  height?: string;
  borderRadius?: string;
};

export default function Skeleton({ height, width, borderRadius }: Props) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: borderRadius || "inherit",
      }}
      className="w-full bg-gradient-to-r from-[#333] via-[#555] to-[#333] bg-cover animate-pulse max-h-full min-h-[12px] p-[2px] m-[2px]"
    />
  );
}
