#!/bin/bash
# Builds an OSRM foot (MLD) graph from /data/malopolskie-latest.osm.pbf (Geofabrik, ODbL). Idempotent.
set -euo pipefail
cd /data
if [ -f malopolskie-latest.osrm.mldgr ]; then echo "OSRM data present"; exit 0; fi
osrm-extract -p /opt/foot.lua malopolskie-latest.osm.pbf
osrm-partition malopolskie-latest.osrm
osrm-customize malopolskie-latest.osrm
rm -f malopolskie-latest.osm.pbf
