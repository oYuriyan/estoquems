"""Disponibilidade operacional, separada da condição física do equipamento."""
import re
import unicodedata


def normalized_status(status: str) -> str:
    return "".join(
        char for char in unicodedata.normalize("NFKD", status or "")
        if not unicodedata.combining(char)
    ).upper()


def is_reserved(equipment) -> bool:
    return equipment.is_reserved or bool(
        re.search(r"\b(?:RESERVADO|RESERVED)\b", normalized_status(equipment.status))
    )


def is_stock_status(status: str) -> bool:
    # Condição física isolada (NOVO/USADO) não confirma disponibilidade.
    # Novos estados só entram após validação do mapeamento da origem.
    status = " ".join(normalized_status(status).split())
    available_states = {
        "DISPONIVEL NOVO", "DISPONIVEL USADO",
    }
    return status in available_states


def is_available(equipment) -> bool:
    return bool(equipment.is_active and not is_reserved(equipment) and is_stock_status(equipment.status))


def is_new(equipment) -> bool:
    return bool(re.search(r"\bNOVO\b", normalized_status(equipment.status)))
