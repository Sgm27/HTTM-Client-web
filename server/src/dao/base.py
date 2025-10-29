from __future__ import annotations


class DAO:
    def __init__(self, connection: object) -> None:
        self._connection = connection
