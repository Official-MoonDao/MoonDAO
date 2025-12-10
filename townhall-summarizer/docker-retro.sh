#!/bin/bash

# Build the retro container
docker-compose --profile retro build retro

# Run retro with all passed arguments
docker-compose --profile retro run --rm retro yarn retro "$@"

