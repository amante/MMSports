#!/usr/bin/env bash
set -euo pipefail
# Usage:
#   NFL_REPO_URL=https://github.com/<USER>/NFLSimulator.git ./tools/sync_nfslimulator.sh /path/to/MMSports [--use-local /path/to/NFL]

REPO_ROOT="${1:-}"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "ERROR: Provide path to MMSports repo root" >&2
  exit 1
fi

shift || true
USE_LOCAL=""
if [[ "${1:-}" == "--use-local" ]]; then
  USE_LOCAL="${2:-}"
  shift 2 || true
fi

if [[ -z "${USE_LOCAL}" && -z "${NFL_REPO_URL:-}" ]]; then
  echo "ERROR: Set NFL_REPO_URL or use --use-local <path>" >&2
  exit 1
fi

NFL_DST="${REPO_ROOT}/WebSites/NFLSimulator"
mkdir -p "${REPO_ROOT}/WebSites"
rm -rf "${NFL_DST}"
mkdir -p "${NFL_DST}"

if [[ -n "${USE_LOCAL}" ]]; then
  echo "[sync] Copying from local: ${USE_LOCAL} → ${NFL_DST}"
  rsync -a --exclude='.git' "${USE_LOCAL}/" "${NFL_DST}/"
else
  TMPDIR="$(mktemp -d)"
  echo "[sync] Cloning ${NFL_REPO_URL} into ${TMPDIR}"
  git clone --depth=1 "${NFL_REPO_URL}" "${TMPDIR}/NFLSimulator"
  rsync -a --exclude='.git' "${TMPDIR}/NFLSimulator/" "${NFL_DST}/"
  rm -rf "${TMPDIR}"
fi

if [[ ! -f "${NFL_DST}/index.html" ]]; then
  for cand in "dist/index.html" "build/index.html" "public/index.html"; do
    if [[ -f "${NFL_DST}/${cand}" ]]; then
      echo "[sync] Found ${cand}; promoting to root index.html"
      rsync -a "${NFL_DST}/$(dirname "${cand}")/" "${NFL_DST}/"
      break
    fi
  done
fi

if [[ ! -f "${NFL_DST}/index.html" ]]; then
  echo "WARNING: No index.html found in NFLSimulator content." >&2
else
  echo "[sync] Injecting navbar/footer and assets path"
  python3 "${REPO_ROOT}/tools/inject_nav_footer.py" --repo-root "${REPO_ROOT}" --nfl-path "WebSites/NFLSimulator/index.html" || true
fi

echo "[sync] Done. Commit your changes:"
echo "  git -C \"${REPO_ROOT}\" add WebSites/NFLSimulator"
echo "  git -C \"${REPO_ROOT}\" commit -m \"Sync NFLSimulator\""
