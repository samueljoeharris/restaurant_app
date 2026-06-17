#!/usr/bin/env python3
"""Generate a placeholder app icon pending real launch art."""

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: PIL/Pillow is not installed. Install with: pip install Pillow", file=sys.stderr)
    sys.exit(1)


def find_bold_font():
    """
    Attempt to locate a bold TrueType font on common system paths.
    Falls back to load_default() if no TrueType font is found.
    Note: Default font will render poorly compared to a proper bold typeface.
    """
    # Common bold font paths on Unix-like systems and macOS
    candidate_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf",
    ]

    for path in candidate_paths:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, 480)
            except Exception:
                continue

    # Fallback to default font
    print("Warning: No TrueType bold font found; using default font (result will be low-quality).", file=sys.stderr)
    return ImageFont.load_default()


def main():
    # Compute output path relative to this script
    script_dir = Path(__file__).resolve().parent
    output_path = script_dir.parent / "TTF" / "Resources" / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon-1024.png"

    # Brand accent green (RGB)
    brand_green = (45, 143, 78)

    # Create 1024x1024 RGB image (no alpha channel)
    img = Image.new("RGB", (1024, 1024), color=brand_green)

    # Load font and draw text
    draw = ImageDraw.Draw(img)
    font = find_bold_font()

    # Draw "LS" centered in white
    text = "LS"
    # Get text bounding box to center it
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (1024 - text_width) // 2
    y = (1024 - text_height) // 2

    draw.text((x, y), text, fill=(255, 255, 255), font=font)

    # Save as PNG
    img.save(output_path, "PNG")

    print(f"Generated app icon: {output_path}")


if __name__ == "__main__":
    main()
