#!/usr/bin/env bash
set -euo pipefail

echo "[smoke] starting stack via docker compose up --wait"
docker compose up --wait --quiet-pull

echo "[smoke] curling http://localhost:8080/api/health"
response="$(curl --silent --show-error --fail --max-time 5 http://localhost:8080/api/health)"
echo "[smoke] response: $response"

if ! echo "$response" | grep -q '"status":"healthy"'; then
  echo "[smoke] FAIL — health response did not contain status:healthy"
  docker compose logs --tail=50
  docker compose down
  exit 1
fi

echo "[smoke] PASS"
docker compose down
