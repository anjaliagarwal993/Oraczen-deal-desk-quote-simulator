"""Tiny JSON-file quote store. A lock + atomic replace keeps the file valid.
Single-process only: see DECISIONS.md for the PostgreSQL migration note."""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Callable


class QuoteStore:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write([])

    def _read(self) -> list[dict[str, Any]]:
        return json.loads(self.path.read_text() or "[]")

    def _write(self, quotes: list[dict[str, Any]]) -> None:
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(quotes, indent=2))
        os.replace(tmp, self.path)

    def add(self, quote: dict[str, Any]) -> None:
        with self._lock:
            quotes = self._read()
            quotes.append(quote)
            self._write(quotes)

    def get(self, quote_id: str) -> dict[str, Any] | None:
        with self._lock:
            return next((q for q in self._read() if q["id"] == quote_id), None)

    def all(self) -> list[dict[str, Any]]:
        with self._lock:
            return self._read()

    def update(self, quote_id: str, mutate: Callable[[dict[str, Any]], None]) -> dict[str, Any] | None:
        """Apply `mutate` to one quote and save. `mutate` may raise; nothing is written then."""
        with self._lock:
            quotes = self._read()
            for q in quotes:
                if q["id"] == quote_id:
                    mutate(q)
                    self._write(quotes)
                    return q
            return None
