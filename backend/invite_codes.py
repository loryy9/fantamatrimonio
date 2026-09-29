"""Generazione di codici invito brevi e leggibili per gli eventi."""
import secrets

_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"  # esclude 0/O, 1/I/L per leggibilita'
_LENGTH = 6


def generate_invite_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(_LENGTH))
