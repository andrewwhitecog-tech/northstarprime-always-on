#!/usr/bin/env bash
# Pinned upstream Linux binary; only verified bytes may be installed.
set -euo pipefail

version=0.24.2
sha256=1f4e0ef7f6554a6ed33dd7ac144fb2e1bbed98598e7af973042fc5cd43951c9a
url="https://github.com/lycheeverse/lychee/releases/download/lychee-v${version}/lychee-x86_64-unknown-linux-gnu.tar.gz"
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  echo "::error::Pinned Lychee installer requires Linux x86_64." >&2
  exit 1
fi
: "${RUNNER_TEMP:?RUNNER_TEMP must identify the runner temporary directory}"
work="$(mktemp -d "${RUNNER_TEMP%/}/nsp-lychee-download.XXXXXX")"
archive="$work/lychee.tar.gz"
bin_dir="${RUNNER_TEMP%/}/nsp-lychee-${version}/bin"
downloaded=false
for attempt in 1 2 3 4; do
  curl_exit=0
  http_status="$(curl --location --silent --show-error --fail \
    --connect-timeout 15 --max-time 60 --retry 0 \
    --output "$archive" --write-out '%{http_code}' "$url")" || curl_exit=$?
  printf 'Lychee %s download attempt %s/4: HTTP %s, curl exit %s\n' \
    "$version" "$attempt" "${http_status:-000}" "$curl_exit"
  if [[ "$curl_exit" -eq 0 && "$http_status" == 200 ]]; then
    downloaded=true
    break
  fi
  if [[ "$attempt" -lt 4 ]]; then sleep "$((2 ** attempt))"; fi
done
if [[ "$downloaded" != true ]]; then
  echo "::error::Lychee download failed after four bounded attempts; checker was not run." >&2
  exit 1
fi
printf '%s  %s\n' "$sha256" "$archive" | sha256sum --check --strict -
mkdir "$work/extract"
tar -xzf "$archive" -C "$work/extract"
mapfile -t binaries < <(find "$work/extract" -maxdepth 2 -type f -name lychee)
if [[ "${#binaries[@]}" -ne 1 ]]; then
  echo "::error::Verified Lychee archive must contain exactly one binary." >&2
  exit 1
fi
mkdir -p "$bin_dir"
install -m 755 "${binaries[0]}" "$bin_dir/lychee"
reported_version="$("$bin_dir/lychee" --version)"
printf 'Installed binary reports: %s\n' "$reported_version"
if [[ "$reported_version" != "lychee $version" ]]; then
  echo "::error::Installed Lychee version did not match the pinned release." >&2
  exit 1
fi
if [[ -n "${GITHUB_PATH:-}" ]]; then printf '%s\n' "$bin_dir" >> "$GITHUB_PATH"; fi
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then printf 'binary=%s\nversion=%s\n' "$bin_dir/lychee" "$reported_version" >> "$GITHUB_OUTPUT"; fi
