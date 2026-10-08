"""Minimal reader of OLE2 compound files (the container of Analyst .wiff and .dam files).

Only what is needed to list and read streams: no writing, no external dependency.
"""
from __future__ import annotations

import mmap
import struct
from pathlib import Path

_END, _FREE = 0xFFFFFFFE, 0xFFFFFFFF


class Ole:
    def __init__(self, path):
        self.path = Path(path)
        with open(self.path, "rb") as fh:
            self._mm = mmap.mmap(fh.fileno(), 0, access=mmap.ACCESS_READ)
        d = self._mm
        if d[:8] != bytes.fromhex("D0CF11E0A1B11AE1"):
            raise ValueError(f"{self.path.name} is not an OLE2 file")
        self.ss = 1 << struct.unpack_from("<H", d, 0x1E)[0]
        self.mss = 1 << struct.unpack_from("<H", d, 0x20)[0]
        n_fat, dir0, self.cutoff, mfat0, n_mfat, dif0, n_dif = struct.unpack_from("<IIxxxxIIIII", d, 0x2C)
        difat = list(struct.unpack_from("<109I", d, 0x4C))
        s = dif0
        for _ in range(n_dif):
            sec = self._sector(s)
            difat += list(struct.unpack_from(f"<{self.ss // 4 - 1}I", sec, 0))
            s = struct.unpack_from("<I", sec, self.ss - 4)[0]
        self.fat: list[int] = []
        for sid in difat[:n_fat]:
            if sid in (_END, _FREE):
                continue
            self.fat += list(struct.unpack_from(f"<{self.ss // 4}I", self._sector(sid), 0))
        self.dir = self._parse_dir(dir0)
        root = self.dir[0]
        self._ministream = self._chain_bytes(root["start"], self.fat, self.ss, None) if root["start"] < _END else b""
        self.minifat: list[int] = []
        if mfat0 < _END:
            raw = self._chain_bytes(mfat0, self.fat, self.ss, None)
            self.minifat = list(struct.unpack_from(f"<{len(raw) // 4}I", raw, 0))
        self.streams = self._paths()

    def _sector(self, sid: int) -> bytes:
        off = (sid + 1) * self.ss
        return self._mm[off:off + self.ss]

    def _chain_bytes(self, start, fat, size, limit):
        out, sid, seen = [], start, 0
        while sid < _END and seen < len(fat) + 1:
            out.append(self._sector(sid) if size == self.ss else b"")
            sid, seen = fat[sid], seen + 1
        data = b"".join(out)
        return data if limit is None else data[:limit]

    def _parse_dir(self, start):
        raw = self._chain_bytes(start, self.fat, self.ss, None)
        ents = []
        for i in range(len(raw) // 128):
            e = raw[i * 128:(i + 1) * 128]
            nlen = struct.unpack_from("<H", e, 0x40)[0]
            name = e[:max(nlen - 2, 0)].decode("utf-16le", "replace")
            typ = e[0x42]
            left, right, child = struct.unpack_from("<III", e, 0x44)
            sstart = struct.unpack_from("<I", e, 0x74)[0]
            size = struct.unpack_from("<Q", e, 0x78)[0] & 0xFFFFFFFF
            ents.append({"name": name, "type": typ, "left": left, "right": right, "child": child, "start": sstart, "size": size})
        return ents

    def _paths(self) -> dict:
        out: dict = {}

        def walk(idx, prefix, seen):
            if idx >= len(self.dir) or idx in seen:
                return
            seen.add(idx)
            e = self.dir[idx]
            walk(e["left"], prefix, seen)
            p = prefix + [e["name"]] if e["name"] else prefix
            if e["type"] == 2:
                out["/".join(p)] = e
            elif e["type"] == 1:
                walk(e["child"], p, seen)
            walk(e["right"], prefix, seen)

        walk(self.dir[0]["child"], [], set())
        return out

    def read(self, path: str) -> bytes:
        e = self.streams[path]
        size = e["size"]
        if size < self.cutoff:
            out, sid, n = [], e["start"], 0
            while sid < _END and n < len(self.minifat) + 1:
                off = sid * self.mss
                out.append(self._ministream[off:off + self.mss])
                sid, n = self.minifat[sid], n + 1
            return b"".join(out)[:size]
        return self._chain_bytes(e["start"], self.fat, self.ss, size)

    def close(self):
        self._mm.close()
