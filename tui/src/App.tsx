import React from "react";
import { Box, Text, useInput } from "ink";
import { ASCII_HEADER } from "./ascii-header.js";
import { exec } from "child_process";

export default function App() {
  useInput((input, key) => {
    if (input === "o" || input === "O") {
      const url = "https://www.moondao.com";
      const command =
        process.platform === "win32"
          ? `start ${url}`
          : process.platform === "darwin"
          ? `open ${url}`
          : `xdg-open ${url}`;
      exec(command);
    } else if (input === "q" || (key.ctrl && input === "c")) {
      process.exit();
    }
  });

  return (
    <Box flexDirection="column" alignItems="center" padding={2}>
      <Box>
        <Text>{ASCII_HEADER}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="cyan">www.moondao.com</Text>
      </Box>
      <Box marginTop={2} flexDirection="column" alignItems="center">
        <Text color="gray">Press 'o' to open in browser</Text>
        <Text color="gray">Press 'q' to exit</Text>
      </Box>
    </Box>
  );
}
