from weather import summarise


def test_empty():
    assert summarise([]) == "no data"


def test_range():
    assert summarise([1.0, 9.6]) == "min 1, max 10"
