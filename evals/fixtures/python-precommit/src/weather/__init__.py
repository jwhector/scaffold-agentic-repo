"""Fetch and summarise a city's forecast."""


def summarise(temps: list[float]) -> str:
    if not temps:
        return "no data"
    return f"min {min(temps):.0f}, max {max(temps):.0f}"
