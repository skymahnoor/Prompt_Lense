"""Generate PromptLens extension icons (shield + lens) at 16/48/128 px."""
from PIL import Image, ImageDraw

def make_icon(size: int) -> Image.Image:
    S = 8  # supersample factor
    px = size * S
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # rounded dark background
    r = px // 5
    d.rounded_rectangle([0, 0, px - 1, px - 1], radius=r, fill=(13, 22, 23, 255))

    # shield
    cx = px / 2
    top = px * 0.16
    bottom = px * 0.86
    half = px * 0.30

    shield = [
        (cx - half, top + px * 0.06),
        (cx, top),
        (cx + half, top + px * 0.06),
        (cx + half, px * 0.52),
        (cx + half * 0.72, px * 0.70),
        (cx, bottom),
        (cx - half * 0.72, px * 0.70),
        (cx - half, px * 0.52),
    ]
    # emerald gradient approximated with two tones
    d.polygon(shield, fill=(16, 185, 129, 255), outline=(52, 211, 153, 255), width=max(1, px // 40))

    # lens (eye) — dark circle + ring + pupil
    eye_r = px * 0.115
    eye_cy = px * 0.44
    d.ellipse(
        [cx - eye_r, eye_cy - eye_r, cx + eye_r, eye_cy + eye_r],
        fill=(13, 22, 23, 255),
        outline=(236, 254, 247, 255),
        width=max(1, px // 34),
    )
    pupil_r = eye_r * 0.45
    d.ellipse(
        [cx - pupil_r, eye_cy - pupil_r, cx + pupil_r, eye_cy + pupil_r],
        fill=(236, 254, 247, 255),
    )

    # lens handle
    hw = max(1, px // 26)
    hx1, hy1 = cx + eye_r * 0.75, eye_cy + eye_r * 0.75
    hx2, hy2 = cx + eye_r * 1.7, eye_cy + eye_r * 1.7
    d.line([(hx1, hy1), (hx2, hy2)], fill=(236, 254, 247, 255), width=hw)

    return img.resize((size, size), Image.LANCZOS)

import os
out = "/home/z/my-project/extension/icons"
os.makedirs(out, exist_ok=True)
for s in (16, 48, 128):
    make_icon(s).save(f"{out}/icon{s}.png")
    print(f"icon{s}.png written")
