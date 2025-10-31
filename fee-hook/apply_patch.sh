#!/bin/bash
# Juicebox has some contracts which have solc 0.8.23 required, and uniswap v4 requires ^0.8.24.
# This patch switched juicebox to ^0.8.23 for compatibility.
echo "Applying patch to submodule..."
cd fee-hook/node_modules/@bananapus/core
git apply ../../../0001-patch-version.patch
