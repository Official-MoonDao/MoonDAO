#!/bin/bash
echo "Applying patch to submodule..."
cd fee-hook/lib/nana-core
git apply ../../0001-patch-version.patch
