#!/bin/bash
# For running code coverage, stricter compiler options are needed.
# In particular, functions can't have more than 16 arguments.
# These patches removes a conflicting hats function, as well as a few
# MoonDAO specific functions.
echo "Applying patch to submodule..."
pushd subscription-contracts/lib/hats-protocol
git apply ../../0001-patch-hats.patch
popd
echo "Applying patch to MoonDAO..."
pushd subscription-contracts
git apply 0001-patch.patch
popd
echo "Applying patch to MoonDAO..."
pushd subscription-contracts
git apply 0001-struct.patch
popd
