"""Rename photos in a folder by their EXIF date."""
import sys
from pathlib import Path


def main(folder: str) -> None:
    for p in sorted(Path(folder).glob("*.jpg")):
        print(p.name)


if __name__ == "__main__":
    main(sys.argv[1])
