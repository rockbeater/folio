#!/bin/sh
# Folio container entrypoint: prepare folders and drop root privileges.
set -e

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if [ "$(id -u)" = "0" ]; then
	for dir in "$DATA_DIR" "$CACHE_DIR"; do
		mkdir -p "$dir"
		# Only fix ownership when needed; a large cache makes chown slow.
		if [ "$(stat -c %u "$dir")" != "$PUID" ] || [ "$(stat -c %g "$dir")" != "$PGID" ]; then
			chown -R "$PUID:$PGID" "$dir"
		fi
	done
	mkdir -p "$PHOTOS_DIR"
	if ! setpriv --reuid="$PUID" --regid="$PGID" --clear-groups test -w "$PHOTOS_DIR"; then
		echo "[folio] warning: user $PUID:$PGID cannot write to $PHOTOS_DIR." >&2
		echo "[folio] Uploads from the admin will fail. Set PUID/PGID to the owner of your photo folder." >&2
	fi
	exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$@"
fi

exec "$@"
