#!/usr/bin/env python3
"""
Deterministic brand artwork generator for oauth.how.

Reconstructs the approved oauth.how logo as native SVG vector artwork
and exports all primary logos, symbols, favicons, social assets, and
visual verification sheets.

Dependencies:
  - Python 3 (stdlib) + Pillow (PIL) + NumPy (for verification sheets)
  - libfreetype.so.6 (system FreeType for exact glyph Bezier extraction)
  - ImageMagick `magick` with librsvg (for crisp SVG -> PNG rasterization)
  - Inter / Adwaita Sans TTF font (SIL OFL-1.1)
"""

import ctypes
import math
import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "src" / "brand"
PUBLIC_DIR = ROOT / "public"
BRAND_DIR = PUBLIC_DIR / "brand"
SOCIAL_DIR = PUBLIC_DIR / "social"
DOCS_DIR = ROOT / "docs"
REF_PNG = ROOT / "oauth-original-idea.png"

FONT_PATH = "/usr/share/fonts/adwaita-sans-fonts/AdwaitaSans-Regular.ttf"

# Canonical Color Palette (sampled from oauth-original-idea.png)
COLORS = {
    "navy": "#10172A",
    "white": "#FFFFFF",
    "cyan": "#02B3D0",
    "amber": "#F29C0D",
    "cyan_light": "#0289A1",
    "amber_light": "#D48204",
}

# ---------------------------------------------------------------------------
# FreeType ctypes wrapper for exact Bezier SVG path extraction
# ---------------------------------------------------------------------------

class FT_Vector(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]


class FT_Outline(ctypes.Structure):
    _fields_ = [
        ("n_contours", ctypes.c_short),
        ("n_points", ctypes.c_short),
        ("points", ctypes.POINTER(FT_Vector)),
        ("tags", ctypes.c_char_p),
        ("contours", ctypes.POINTER(ctypes.c_short)),
        ("flags", ctypes.c_int),
    ]


class FT_Glyph_Metrics(ctypes.Structure):
    _fields_ = [
        ("width", ctypes.c_long),
        ("height", ctypes.c_long),
        ("horiBearingX", ctypes.c_long),
        ("horiBearingY", ctypes.c_long),
        ("horiAdvance", ctypes.c_long),
        ("vertBearingX", ctypes.c_long),
        ("vertBearingY", ctypes.c_long),
        ("vertAdvance", ctypes.c_long),
    ]


class FT_Bitmap(ctypes.Structure):
    _fields_ = [
        ("rows", ctypes.c_uint),
        ("width", ctypes.c_uint),
        ("pitch", ctypes.c_int),
        ("buffer", ctypes.c_void_p),
        ("num_grays", ctypes.c_ushort),
        ("pixel_mode", ctypes.c_ubyte),
        ("palette_mode", ctypes.c_ubyte),
        ("palette", ctypes.c_void_p),
    ]


class FT_Generic(ctypes.Structure):
    _fields_ = [("data", ctypes.c_void_p), ("finalizer", ctypes.c_void_p)]


class FT_GlyphSlotRec(ctypes.Structure):
    _fields_ = [
        ("library", ctypes.c_void_p),
        ("face", ctypes.c_void_p),
        ("next", ctypes.c_void_p),
        ("glyph_index", ctypes.c_uint),
        ("generic", FT_Generic),
        ("metrics", FT_Glyph_Metrics),
        ("linearHoriAdvance", ctypes.c_long),
        ("linearVertAdvance", ctypes.c_long),
        ("advance", FT_Vector),
        ("format", ctypes.c_uint),
        ("bitmap", FT_Bitmap),
        ("bitmap_left", ctypes.c_int),
        ("bitmap_top", ctypes.c_int),
        ("outline", FT_Outline),
    ]


class FT_FaceRec(ctypes.Structure):
    _fields_ = [
        ("num_faces", ctypes.c_long),
        ("face_index", ctypes.c_long),
        ("face_flags", ctypes.c_long),
        ("style_flags", ctypes.c_long),
        ("num_glyphs", ctypes.c_long),
        ("family_name", ctypes.c_char_p),
        ("style_name", ctypes.c_char_p),
        ("num_fixed_sizes", ctypes.c_int),
        ("available_sizes", ctypes.c_void_p),
        ("num_charmaps", ctypes.c_int),
        ("charmaps", ctypes.c_void_p),
        ("generic", FT_Generic),
        ("bbox_xMin", ctypes.c_long),
        ("bbox_yMin", ctypes.c_long),
        ("bbox_xMax", ctypes.c_long),
        ("bbox_yMax", ctypes.c_long),
        ("units_per_EM", ctypes.c_ushort),
        ("ascender", ctypes.c_short),
        ("descender", ctypes.c_short),
        ("height", ctypes.c_short),
        ("max_advance_width", ctypes.c_short),
        ("max_advance_height", ctypes.c_short),
        ("underline_position", ctypes.c_short),
        ("underline_thickness", ctypes.c_short),
        ("glyph", ctypes.POINTER(FT_GlyphSlotRec)),
    ]


MoveToFunc = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(FT_Vector), ctypes.c_void_p)
LineToFunc = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(FT_Vector), ctypes.c_void_p)
ConicToFunc = ctypes.CFUNCTYPE(
    ctypes.c_int, ctypes.POINTER(FT_Vector), ctypes.POINTER(FT_Vector), ctypes.c_void_p
)
CubicToFunc = ctypes.CFUNCTYPE(
    ctypes.c_int,
    ctypes.POINTER(FT_Vector),
    ctypes.POINTER(FT_Vector),
    ctypes.POINTER(FT_Vector),
    ctypes.c_void_p,
)


class FT_Outline_Funcs(ctypes.Structure):
    _fields_ = [
        ("move_to", MoveToFunc),
        ("line_to", LineToFunc),
        ("conic_to", ConicToFunc),
        ("cubic_to", CubicToFunc),
        ("shift", ctypes.c_int),
        ("delta", ctypes.c_long),
    ]


def _fmt(v: float) -> str:
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s == "-0" else s


def extract_wordmark_paths(
    font_path: str = FONT_PATH,
    opsz: float = 32.0,
    wght: float = 650.0,
    target_h_height: float = 171.0,
    baseline_y: float = 233.0,
    start_x: float = 448.0,
) -> tuple[str, str, dict]:
    """Extract clean SVG <path> d-strings for 'oauth' and '.how' from Inter/Adwaita Sans.

    Returns (oauth_d, how_d, meta_dict). The '.' period is rendered as a crisp square
    path matching the reference artwork's geometric square dot.
    """
    ft = ctypes.CDLL("libfreetype.so.6")
    lib = ctypes.c_void_p()
    assert ft.FT_Init_FreeType(ctypes.byref(lib)) == 0
    face_ptr = ctypes.POINTER(FT_FaceRec)()
    assert ft.FT_New_Face(lib, font_path.encode(), 0, ctypes.byref(face_ptr)) == 0

    coords = (ctypes.c_long * 2)(int(opsz * 65536), int(wght * 65536))
    assert ft.FT_Set_Var_Design_Coordinates(face_ptr, 2, coords) == 0

    FT_LOAD_NO_SCALE = 1 << 0
    FT_LOAD_NO_BITMAP = 1 << 3
    load_flags = FT_LOAD_NO_SCALE | FT_LOAD_NO_BITMAP

    def load_char_outline(ch: str):
        gid = ft.FT_Get_Char_Index(face_ptr, ord(ch))
        assert ft.FT_Load_Glyph(face_ptr, gid, load_flags) == 0
        slot = face_ptr.contents.glyph.contents
        cmds = []

        def move_to(to, _user):
            cmds.append(("M", to.contents.x, to.contents.y))
            return 0

        def line_to(to, _user):
            cmds.append(("L", to.contents.x, to.contents.y))
            return 0

        def conic_to(ctrl, to, _user):
            cmds.append(("Q", ctrl.contents.x, ctrl.contents.y, to.contents.x, to.contents.y))
            return 0

        def cubic_to(c1, c2, to, _user):
            cmds.append(
                (
                    "C",
                    c1.contents.x,
                    c1.contents.y,
                    c2.contents.x,
                    c2.contents.y,
                    to.contents.x,
                    to.contents.y,
                )
            )
            return 0

        funcs = FT_Outline_Funcs(
            MoveToFunc(move_to),
            LineToFunc(line_to),
            ConicToFunc(conic_to),
            CubicToFunc(cubic_to),
            0,
            0,
        )
        assert ft.FT_Outline_Decompose(ctypes.byref(slot.outline), ctypes.byref(funcs), None) == 0
        # Compute exact bounding box from metrics
        m = slot.metrics
        return {
            "cmds": cmds,
            "advance": m.horiAdvance,
            "bearingX": m.horiBearingX,
            "bearingY": m.horiBearingY,
            "width": m.width,
            "height": m.height,
        }

    # Measure 'h' height in font units to compute exact scale
    h_glyph = load_char_outline("h")
    scale = target_h_height / float(h_glyph["height"])

    # Slight optical tracking adjustment (-0.012em) to match reference wordmark rhythm
    tracking = -0.012 * face_ptr.contents.units_per_EM * scale

    # Measure 'o' left bearing so 'o' starts cleanly at start_x
    o_glyph = load_char_outline("o")
    pen_x = start_x - o_glyph["bearingX"] * scale

    def render_cmds(cmds, ox, oy):
        parts = []
        in_contour = False
        for cmd in cmds:
            op = cmd[0]
            if op == "M":
                if in_contour:
                    parts.append("Z")
                in_contour = True
                x = ox + cmd[1] * scale
                y = oy - cmd[2] * scale
                parts.append(f"M{_fmt(x)} {_fmt(y)}")
            elif op == "L":
                x = ox + cmd[1] * scale
                y = oy - cmd[2] * scale
                parts.append(f"L{_fmt(x)} {_fmt(y)}")
            elif op == "Q":
                cx = ox + cmd[1] * scale
                cy = oy - cmd[2] * scale
                x = ox + cmd[3] * scale
                y = oy - cmd[4] * scale
                parts.append(f"Q{_fmt(cx)} {_fmt(cy)} {_fmt(x)} {_fmt(y)}")
            elif op == "C":
                c1x = ox + cmd[1] * scale
                c1y = oy - cmd[2] * scale
                c2x = ox + cmd[3] * scale
                c2y = oy - cmd[4] * scale
                x = ox + cmd[5] * scale
                y = oy - cmd[6] * scale
                parts.append(
                    f"C{_fmt(c1x)} {_fmt(c1y)} {_fmt(c2x)} {_fmt(c2y)} {_fmt(x)} {_fmt(y)}"
                )
        if in_contour:
            parts.append("Z")
        return " ".join(parts)

    oauth_parts = []
    how_parts = []
    char_boxes = {}

    for ch in "oauth":
        g = load_char_outline(ch)
        oauth_parts.append(render_cmds(g["cmds"], pen_x, baseline_y))
        x0 = pen_x + g["bearingX"] * scale
        x1 = x0 + g["width"] * scale
        char_boxes[ch] = (x0, x1)
        pen_x += g["advance"] * scale + tracking

    # Crisp square period matching the reference artwork (36 x 36, sitting on baseline)
    dot_glyph = load_char_outline(".")
    dot_w = 36.0
    dot_h = 37.0
    # Center the square period within the natural period advance
    dot_adv = dot_glyph["advance"] * scale + tracking
    dot_x0 = pen_x + (dot_adv - dot_w) / 2.0 + 3.0
    dot_y0 = baseline_y - dot_h
    how_parts.append(
        f"M{_fmt(dot_x0)} {_fmt(dot_y0)}H{_fmt(dot_x0 + dot_w)}V{_fmt(baseline_y)}H{_fmt(dot_x0)}Z"
    )
    pen_x += dot_adv + 5.0

    for idx, ch in enumerate("how"):
        g = load_char_outline(ch)
        how_parts.append(render_cmds(g["cmds"], pen_x, baseline_y))
        x0 = pen_x + g["bearingX"] * scale
        x1 = x0 + g["width"] * scale
        char_boxes[f"how_{idx}_{ch}"] = (x0, x1)
        pen_x += g["advance"] * scale + tracking

    max_x = max(b[1] for b in char_boxes.values())

    ft.FT_Done_Face(face_ptr)
    ft.FT_Done_FreeType(lib)

    return (
        " ".join(oauth_parts),
        " ".join(how_parts),
        {
            "max_x": max_x,
            "start_x": start_x,
            "baseline_y": baseline_y,
            "scale": scale,
            "font_size_px": face_ptr_upem_size(scale),
        },
    )


def face_ptr_upem_size(scale: float) -> float:
    return 2048.0 * scale


# ---------------------------------------------------------------------------
# Symbol SVG Primitive Builder (viewBox 0 0 372 314)
# ---------------------------------------------------------------------------

def build_symbol_group(
    qm_color: str,
    cyan_color: str,
    amber_color: str,
    indent: str = "  ",
) -> str:
    """Return clean native SVG primitives for the oauth.how symbol (372 x 314)."""
    return (
        f'{indent}<g id="symbol">\n'
        f'{indent}  <!-- Question mark hook -->\n'
        f'{indent}  <path fill="{qm_color}" d="M92 86.5 C92 31 132 0 187 0 '
        f'C244 0 278 34 278 82 C278 115 261 136 237 157 C217 174 210 187 210 210 '
        f'V222 H160 V207 C160 176 171 155 195 134 C216 116 226 103 226 84 '
        f'C226 59 209 45 185 45 C160 45 144 59 142 86.5 Z"/>\n'
        f'{indent}  <!-- Question mark rounded square dot -->\n'
        f'{indent}  <rect x="155.5" y="256" width="60" height="57" rx="7" ry="7" fill="{qm_color}"/>\n'
        f'{indent}  <!-- Incoming flow: cyan arrow -->\n'
        f'{indent}  <path fill="none" stroke="{cyan_color}" stroke-width="16.5" '
        f'stroke-linecap="round" stroke-linejoin="round" '
        f'd="M8.25 143.5 H127.5 M98 114 L127.5 143.5 L98 173"/>\n'
        f'{indent}  <!-- Incoming flow: cyan bracket -->\n'
        f'{indent}  <path fill="none" stroke="{cyan_color}" stroke-width="16.5" '
        f'stroke-linecap="butt" stroke-linejoin="round" '
        f'd="M135 212.5 H75.5 A22 22 0 0 0 53.5 234.5 V263.5 A22 22 0 0 0 75.5 285.5 H132"/>\n'
        f'{indent}  <!-- Outgoing flow: amber arrow (slanted shaft + rounded chevron) -->\n'
        f'{indent}  <path fill="{amber_color}" d="M281 135.25 H364.5 V151.75 H272 Z"/>\n'
        f'{indent}  <path fill="none" stroke="{amber_color}" stroke-width="16.5" '
        f'stroke-linecap="round" stroke-linejoin="round" '
        f'd="M335 114 L364.5 143.5 L335 173"/>\n'
        f'{indent}  <!-- Outgoing flow: amber bracket -->\n'
        f'{indent}  <path fill="none" stroke="{amber_color}" stroke-width="16.5" '
        f'stroke-linecap="butt" stroke-linejoin="round" '
        f'd="M235 212.5 H296.5 A22 22 0 0 1 318.5 234.5 V263.5 A22 22 0 0 1 296.5 285.5 H238"/>\n'
        f'{indent}</g>'
    )


def build_symbol_svg(
    qm_color: str,
    cyan_color: str,
    amber_color: str,
    root_extra: str = "",
) -> str:
    extra = f" {root_extra}" if root_extra else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 372 314" '
        f'fill="none"{extra}>\n'
        f'{build_symbol_group(qm_color, cyan_color, amber_color)}\n'
        f'</svg>\n'
    )


def build_horizontal_svg(
    oauth_d: str,
    how_d: str,
    width: int,
    qm_color: str,
    cyan_color: str,
    amber_color: str,
    oauth_color: str,
    how_color: str,
) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 314" fill="none">\n'
        f'{build_symbol_group(qm_color, cyan_color, amber_color)}\n'
        f'  <g id="wordmark">\n'
        f'    <path id="wordmark-oauth" fill="{oauth_color}" d="{oauth_d}"/>\n'
        f'    <path id="wordmark-how" fill="{how_color}" d="{how_d}"/>\n'
        f'  </g>\n'
        f'</svg>\n'
    )


def build_stacked_svg(
    oauth_d: str,
    how_d: str,
    wm_start_x: float,
    wm_max_x: float,
    qm_color: str,
    cyan_color: str,
    amber_color: str,
    oauth_color: str,
    how_color: str,
) -> str:
    # Canvas 540 x 460; symbol (372x314) centered horizontally at x=84, y=0
    # Wordmark scaled to width ~520 centered horizontally below symbol with clean gap
    wm_w = wm_max_x - wm_start_x
    target_w = 524.0
    s = target_w / wm_w
    # Wordmark top in original coords is ~62 (h ascender top), bottom is ~236
    # Place wordmark top at y = 368 (54px gap below symbol bottom 314)
    tx = (540.0 - target_w) / 2.0 - wm_start_x * s
    ty = 368.0 - 62.0 * s
    total_h = int(math.ceil(ty + 236.0 * s))
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 {total_h}" fill="none">\n'
        f'  <g transform="translate(84 0)">\n'
        f'{build_symbol_group(qm_color, cyan_color, amber_color, indent="    ")}\n'
        f'  </g>\n'
        f'  <g id="wordmark" transform="translate({_fmt(tx)} {_fmt(ty)}) scale({_fmt(s)})">\n'
        f'    <path id="wordmark-oauth" fill="{oauth_color}" d="{oauth_d}"/>\n'
        f'    <path id="wordmark-how" fill="{how_color}" d="{how_d}"/>\n'
        f'  </g>\n'
        f'</svg>\n'
    )


def build_favicon_svg(rounded_bg: bool = True) -> str:
    """Simplified high-legibility 64x64 favicon preserving the exact symbol identity.

    Uses slightly heavier flow strokes (3.4px on 64px grid) and generous breathing room
    so the question mark and cyan/amber flow remain crisp down to 16x16.
    """
    bg_el = (
        f'  <rect width="64" height="64" rx="14" fill="{COLORS["navy"]}"/>\n'
        if rounded_bg
        else f'  <rect width="64" height="64" fill="{COLORS["navy"]}"/>\n'
    )
    # Fit 372x314 symbol inside 64x64 with 7px horizontal margin -> scale = 50 / 372 = 0.1344
    # Center vertically: 314 * 0.1344 = 42.2 -> y offset = (64 - 42.2)/2 = 10.9
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">\n'
        f'{bg_el}'
        f'  <g transform="translate(7 10.9) scale(0.1344)">\n'
        f'    <path fill="{COLORS["white"]}" d="M92 86.5 C92 31 132 0 187 0 '
        f'C244 0 278 34 278 82 C278 115 261 136 237 157 C217 174 210 187 210 210 '
        f'V222 H160 V207 C160 176 171 155 195 134 C216 116 226 103 226 84 '
        f'C226 59 209 45 185 45 C160 45 144 59 142 86.5 Z"/>\n'
        f'    <rect x="154" y="254" width="63" height="60" rx="8" ry="8" fill="{COLORS["white"]}"/>\n'
        f'    <path fill="none" stroke="{COLORS["cyan"]}" stroke-width="24" '
        f'stroke-linecap="round" stroke-linejoin="round" '
        f'd="M12 143.5 H122 M94 112 L125 143.5 L94 175"/>\n'
        f'    <path fill="none" stroke="{COLORS["cyan"]}" stroke-width="24" '
        f'stroke-linecap="butt" stroke-linejoin="round" '
        f'd="M132 214 H76 A22 22 0 0 0 54 236 V264 A22 22 0 0 0 76 286 H128"/>\n'
        f'    <path fill="{COLORS["amber"]}" d="M282 131.5 H360 V155.5 H271 Z"/>\n'
        f'    <path fill="none" stroke="{COLORS["amber"]}" stroke-width="24" '
        f'stroke-linecap="round" stroke-linejoin="round" '
        f'd="M332 112 L363 143.5 L332 175"/>\n'
        f'    <path fill="none" stroke="{COLORS["amber"]}" stroke-width="24" '
        f'stroke-linecap="butt" stroke-linejoin="round" '
        f'd="M238 214 H296 A22 22 0 0 1 318 236 V264 A22 22 0 0 1 296 286 H242"/>\n'
        f'  </g>\n'
        f'</svg>\n'
    )


def build_editable_horizontal_svg(width: int) -> str:
    """Editable source SVG with live <text> using Inter / Adwaita Sans."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 314" fill="none">\n'
        f'  <!-- Editable source artwork for oauth.how. Requires Inter (or Adwaita Sans) font.\n'
        f'       Production SVGs in public/brand/ use outlined vector paths with no font dependency. -->\n'
        f'{build_symbol_group(COLORS["white"], COLORS["cyan"], COLORS["amber"])}\n'
        f'  <text x="442" y="233" font-family="Inter, \'Adwaita Sans\', sans-serif" '
        f'font-size="235" font-weight="650" letter-spacing="-2.8">\n'
        f'    <tspan fill="{COLORS["white"]}">oauth</tspan>'
        f'<tspan fill="{COLORS["cyan"]}">.how</tspan>\n'
        f'  </text>\n'
        f'</svg>\n'
    )


def build_editable_stacked_svg() -> str:
    """Editable stacked source SVG with live <text> using Inter / Adwaita Sans."""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 460" fill="none">\n'
        f'  <!-- Editable stacked source artwork for oauth.how. Requires Inter (or Adwaita Sans) font. -->\n'
        f'  <g transform="translate(84 0)">\n'
        f'{build_symbol_group(COLORS["white"], COLORS["cyan"], COLORS["amber"], indent="    ")}\n'
        f'  </g>\n'
        f'  <text x="270" y="446" text-anchor="middle" font-family="Inter, \'Adwaita Sans\', sans-serif" '
        f'font-size="112" font-weight="650" letter-spacing="-1.3">\n'
        f'    <tspan fill="{COLORS["white"]}">oauth</tspan>'
        f'<tspan fill="{COLORS["cyan"]}">.how</tspan>\n'
        f'  </text>\n'
        f'</svg>\n'
    )


# ---------------------------------------------------------------------------
# Rasterization helpers (ImageMagick + librsvg)
# ---------------------------------------------------------------------------

def render_svg_to_png(svg_path: Path, png_path: Path, width: int, height: int, bg: str = "none"):
    cmd = [
        "magick",
        "-background",
        bg,
        "-density",
        "384",
        str(svg_path),
        "-resize",
        f"{width}x{height}!",
        str(png_path),
    ]
    subprocess.run(cmd, check=True)


def render_svg_fitted_on_canvas(
    svg_path: Path,
    png_path: Path,
    canvas_w: int,
    canvas_h: int,
    art_w: int,
    art_h: int,
    bg: str = COLORS["navy"],
):
    tmp = png_path.with_suffix(".tmp.png")
    cmd = [
        "magick",
        "-background",
        "none",
        "-density",
        "384",
        str(svg_path),
        "-resize",
        f"{art_w}x{art_h}",
        str(tmp),
    ]
    subprocess.run(cmd, check=True)
    canvas = Image.new("RGB", (canvas_w, canvas_h), bg)
    art = Image.open(tmp).convert("RGBA")
    ox = (canvas_w - art.width) // 2
    oy = (canvas_h - art.height) // 2
    canvas.paste(art, (ox, oy), art)
    canvas.save(png_path, optimize=True)
    tmp.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Verification & Brand Sheet Generators
# ---------------------------------------------------------------------------

def generate_brand_sheet(out_path: Path):
    """Generate a compact visual brand sheet showing all major variants on dark & light."""
    W, H = 1400, 920
    sheet = Image.new("RGB", (W, H), "#0B101E")
    draw = ImageDraw.Draw(sheet)

    try:
        font_title = ImageFont.truetype(FONT_PATH, 28)
        font_title.set_variation_by_axes([32, 700])
        font_label = ImageFont.truetype(FONT_PATH, 16)
        font_label.set_variation_by_axes([14, 500])
        font_small = ImageFont.truetype(FONT_PATH, 14)
        font_small.set_variation_by_axes([14, 500])
    except Exception:
        font_title = font_label = font_small = ImageFont.load_default()

    draw.text((40, 28), "oauth.how — Brand Asset Sheet", fill="#FFFFFF", font=font_title)

    def place_panel(x, y, w, h, bg_color, label, svg_path, pad=28, label_color="#94A3B8"):
        draw.rounded_rectangle([x, y, x + w, y + h], radius=14, fill=bg_color, outline="#263147", width=1)
        draw.text((x + 16, y + 12), label, fill=label_color, font=font_label)
        tmp = out_path.parent / f".tmp_{svg_path.stem}.png"
        inner_w = w - pad * 2
        inner_h = h - pad * 2 - 22
        subprocess.run(
            ["magick", "-background", "none", "-density", "300", str(svg_path), "-resize", f"{inner_w}x{inner_h}", str(tmp)],
            check=True,
        )
        im = Image.open(tmp).convert("RGBA")
        ox = x + (w - im.width) // 2
        oy = y + 26 + (h - 26 - im.height) // 2
        sheet.paste(im, (ox, oy), im)
        tmp.unlink(missing_ok=True)

    # Row 1: Horizontal dark & light
    place_panel(40, 82, 645, 220, COLORS["navy"], "logo-horizontal-dark.svg (on #10172A)", BRAND_DIR / "logo-horizontal-dark.svg")
    place_panel(715, 82, 645, 220, "#FFFFFF", "logo-horizontal-light.svg (on #FFFFFF)", BRAND_DIR / "logo-horizontal-light.svg", label_color="#475569")

    # Row 2: Stacked + 3 Symbol variants
    place_panel(40, 326, 360, 290, COLORS["navy"], "logo-stacked.svg", BRAND_DIR / "logo-stacked.svg")
    place_panel(424, 326, 290, 290, COLORS["navy"], "symbol-dark.svg", BRAND_DIR / "symbol-dark.svg", pad=54)
    place_panel(738, 326, 290, 290, "#FFFFFF", "symbol-light.svg", BRAND_DIR / "symbol-light.svg", pad=54, label_color="#475569")
    place_panel(1052, 326, 308, 290, "#F1F5F9", "symbol-monochrome.svg", BRAND_DIR / "symbol-monochrome.svg", pad=54, label_color="#475569")

    # Row 3: Color swatches + Favicon preview
    draw.rounded_rectangle([40, 640, 960, 880], radius=14, fill="#111827", outline="#263147", width=1)
    draw.text((56, 654), "Canonical Color Palette", fill="#94A3B8", font=font_label)
    swatches = [
        ("Midnight Navy", COLORS["navy"], "#FFFFFF"),
        ("White", COLORS["white"], "#10172A"),
        ("Cyan (Dark)", COLORS["cyan"], "#10172A"),
        ("Amber (Dark)", COLORS["amber"], "#10172A"),
        ("Cyan (Light)", COLORS["cyan_light"], "#FFFFFF"),
        ("Amber (Light)", COLORS["amber_light"], "#FFFFFF"),
    ]
    sx = 60
    for name, hx, fg in swatches:
        draw.rounded_rectangle([sx, 696, sx + 134, 810], radius=10, fill=hx, outline="#334155", width=1)
        draw.text((sx + 10, 774), hx, fill=fg, font=font_label)
        draw.text((sx + 4, 822), name, fill="#CBD5E1", font=font_small)
        sx += 148

    # Favicons panel
    draw.rounded_rectangle([984, 640, 1360, 880], radius=14, fill="#1E293B", outline="#263147", width=1)
    draw.text((1000, 654), "Favicon & App Icon", fill="#94A3B8", font=font_label)
    fav_items = [
        ("16px", PUBLIC_DIR / "favicon-16.png", 16),
        ("32px", PUBLIC_DIR / "favicon-32.png", 32),
        ("64px", PUBLIC_DIR / "favicon.svg", 64),
        ("180px", PUBLIC_DIR / "apple-touch-icon.png", 104),
    ]
    fx = 1012
    for lbl, p, disp in fav_items:
        if p.suffix == ".svg":
            tmp = out_path.parent / ".tmp_fav64.png"
            render_svg_to_png(p, tmp, disp, disp, bg="none")
            im = Image.open(tmp).convert("RGBA")
            tmp.unlink(missing_ok=True)
        else:
            im = Image.open(p).convert("RGBA")
            if im.width != disp:
                im = im.resize((disp, disp), Image.Resampling.LANCZOS)
        fy = 770 - im.height // 2
        sheet.paste(im, (fx, fy), im)
        draw.text((fx, 835), lbl, fill="#CBD5E1", font=font_small)
        fx += disp + 34

    sheet.save(out_path, optimize=True)


def generate_comparison_sheet(out_path: Path, horiz_w: int):
    """Generate side-by-side comparison of original reference vs reconstructed SVG + multi-size test."""
    W, H = 1480, 1180
    sheet = Image.new("RGB", (W, H), "#0B101E")
    draw = ImageDraw.Draw(sheet)

    try:
        font_title = ImageFont.truetype(FONT_PATH, 26)
        font_title.set_variation_by_axes([32, 700])
        font_label = ImageFont.truetype(FONT_PATH, 16)
        font_label.set_variation_by_axes([14, 500])
    except Exception:
        font_title = font_label = ImageFont.load_default()

    draw.text((40, 24), "oauth.how — Visual Fidelity Comparison & Multi-Size Verification", fill="#FFFFFF", font=font_title)

    # 1. Original Reference cropped tightly to lockup
    ref = Image.open(REF_PNG).convert("RGB")
    ref_crop = ref.crop((225, 835, 1825, 1212))  # 1600 x 377
    target_w = 1360
    target_h = int(round(ref_crop.height * target_w / ref_crop.width))
    ref_scaled = ref_crop.resize((target_w, target_h), Image.Resampling.LANCZOS)

    draw.text((40, 72), "ORIGINAL REFERENCE (oauth-original-idea.png)", fill="#94A3B8", font=font_label)
    draw.rounded_rectangle([40, 98, 40 + target_w + 20, 98 + target_h + 20], radius=12, fill=COLORS["navy"], outline="#263147")
    sheet.paste(ref_scaled, (50, 108))

    # 2. Reconstructed SVG rendered at exact same proportion
    draw.text((40, 444), "RECONSTRUCTED NATIVE SVG (public/brand/logo-horizontal-dark.svg)", fill="#02B3D0", font=font_label)
    draw.rounded_rectangle([40, 470, 40 + target_w + 20, 470 + target_h + 20], radius=12, fill=COLORS["navy"], outline="#263147")
    tmp_rec = out_path.parent / ".tmp_rec_horiz.png"
    # Match exact scale: ref lockup is 1534px wide inside 1600px crop -> 1304px wide inside 1360px
    rec_w = int(round(1534 * target_w / 1600))
    rec_h = int(round(314 * target_w / 1600))
    render_svg_to_png(BRAND_DIR / "logo-horizontal-dark.svg", tmp_rec, rec_w, rec_h, bg="none")
    rec_im = Image.open(tmp_rec).convert("RGBA")
    ox = 50 + (target_w - rec_im.width) // 2
    oy = 480 + (target_h - rec_im.height) // 2
    sheet.paste(rec_im, (ox, oy), rec_im)
    tmp_rec.unlink(missing_ok=True)

    # 3. Multi-size scaling test: 16, 24, 32, 64, 128, 256 (plus 512 tested via github-avatar.png)
    draw.text((40, 820), "MULTI-SIZE RENDERING TEST — symbol-dark.svg & favicon.svg (16px to 256px; 512px in github-avatar.png)", fill="#94A3B8", font=font_label)
    draw.rounded_rectangle([40, 846, 1420, 1146], radius=12, fill=COLORS["navy"], outline="#263147")

    sizes = [16, 24, 32, 64, 128, 256]
    sx = 70
    for sz in sizes:
        tmp = out_path.parent / f".tmp_sz_{sz}.png"
        # Use favicon.svg for 16/24/32 and symbol-dark.svg for 64/128/256, plus show both at 32!
        src = PUBLIC_DIR / "favicon.svg" if sz <= 32 else BRAND_DIR / "symbol-dark.svg"
        if sz <= 32:
            render_svg_to_png(src, tmp, sz, sz, bg="none")
        else:
            h_sz = int(round(sz * 314 / 372))
            render_svg_to_png(src, tmp, sz, h_sz, bg="none")
        im = Image.open(tmp).convert("RGBA")
        sy = 985 - im.height // 2
        sheet.paste(im, (sx, sy), im)
        lbl = f"{sz}px ({'fav' if sz <= 32 else 'sym'})"
        draw.text((sx, 1118), lbl, fill="#CBD5E1", font=font_label)
        tmp.unlink(missing_ok=True)
        sx += max(sz, 74) + 52

    # Also show 128px symbol on white background to verify light-mode contrast
    tmp_l = out_path.parent / ".tmp_sz_light.png"
    render_svg_to_png(BRAND_DIR / "symbol-light.svg", tmp_l, 128, int(round(128 * 314 / 372)), bg="none")
    im_l = Image.open(tmp_l).convert("RGBA")
    draw.rounded_rectangle([1200, 885, 1380, 1085], radius=12, fill="#FFFFFF")
    sheet.paste(im_l, (1290 - im_l.width // 2, 985 - im_l.height // 2), im_l)
    draw.text((1224, 1118), "128px (light)", fill="#CBD5E1", font=font_label)
    tmp_l.unlink(missing_ok=True)

    sheet.save(out_path, optimize=True)


def main():
    for d in (SRC_DIR, BRAND_DIR, SOCIAL_DIR, DOCS_DIR):
        d.mkdir(parents=True, exist_ok=True)

    # 1. Extract outlined wordmark vector paths from Inter (Adwaita Sans)
    oauth_d, how_d, meta = extract_wordmark_paths()
    horiz_w = int(math.ceil(meta["max_x"]))
    print(f"Extracted wordmark paths: start_x={meta['start_x']:.1f}, max_x={meta['max_x']:.1f}, viewBox_w={horiz_w}")

    # 2. Write primary horizontal logos
    (BRAND_DIR / "logo-horizontal.svg").write_text(
        build_horizontal_svg(
            oauth_d, how_d, horiz_w,
            COLORS["white"], COLORS["cyan"], COLORS["amber"],
            COLORS["white"], COLORS["cyan"],
        ),
        encoding="utf-8",
    )
    (BRAND_DIR / "logo-horizontal-dark.svg").write_text(
        build_horizontal_svg(
            oauth_d, how_d, horiz_w,
            COLORS["white"], COLORS["cyan"], COLORS["amber"],
            COLORS["white"], COLORS["cyan"],
        ),
        encoding="utf-8",
    )
    (BRAND_DIR / "logo-horizontal-light.svg").write_text(
        build_horizontal_svg(
            oauth_d, how_d, horiz_w,
            COLORS["navy"], COLORS["cyan_light"], COLORS["amber_light"],
            COLORS["navy"], COLORS["cyan_light"],
        ),
        encoding="utf-8",
    )

    # 3. Write stacked logo
    (BRAND_DIR / "logo-stacked.svg").write_text(
        build_stacked_svg(
            oauth_d, how_d, meta["start_x"], meta["max_x"],
            COLORS["white"], COLORS["cyan"], COLORS["amber"],
            COLORS["white"], COLORS["cyan"],
        ),
        encoding="utf-8",
    )

    # 4. Write symbol assets
    (BRAND_DIR / "symbol.svg").write_text(
        build_symbol_svg(COLORS["white"], COLORS["cyan"], COLORS["amber"]),
        encoding="utf-8",
    )
    (BRAND_DIR / "symbol-dark.svg").write_text(
        build_symbol_svg(COLORS["white"], COLORS["cyan"], COLORS["amber"]),
        encoding="utf-8",
    )
    (BRAND_DIR / "symbol-light.svg").write_text(
        build_symbol_svg(COLORS["navy"], COLORS["cyan_light"], COLORS["amber_light"]),
        encoding="utf-8",
    )
    (BRAND_DIR / "symbol-monochrome.svg").write_text(
        build_symbol_svg("currentColor", "currentColor", "currentColor", root_extra=f'color="{COLORS["navy"]}"'),
        encoding="utf-8",
    )

    # 5. Write editable live-text source SVGs
    (SRC_DIR / "logo-horizontal-editable.svg").write_text(
        build_editable_horizontal_svg(horiz_w), encoding="utf-8"
    )
    (SRC_DIR / "logo-stacked-editable.svg").write_text(
        build_editable_stacked_svg(), encoding="utf-8"
    )

    # 6. Write favicon.svg & export favicon PNGs + apple-touch-icon.png
    favicon_svg_path = PUBLIC_DIR / "favicon.svg"
    favicon_svg_path.write_text(build_favicon_svg(rounded_bg=True), encoding="utf-8")
    render_svg_to_png(favicon_svg_path, PUBLIC_DIR / "favicon-32.png", 32, 32, bg="none")
    render_svg_to_png(favicon_svg_path, PUBLIC_DIR / "favicon-16.png", 16, 16, bg="none")

    # Apple touch icon: 180x180 full-bleed square navy background (iOS masks corners)
    apple_tmp_svg = SRC_DIR / ".apple-touch-icon-src.svg"
    apple_tmp_svg.write_text(build_favicon_svg(rounded_bg=False), encoding="utf-8")
    render_svg_to_png(apple_tmp_svg, PUBLIC_DIR / "apple-touch-icon.png", 180, 180, bg=COLORS["navy"])
    apple_tmp_svg.unlink(missing_ok=True)

    # 7. Export social assets
    # GitHub avatar: 512 x 512 standalone symbol on midnight-navy
    render_svg_fitted_on_canvas(
        BRAND_DIR / "symbol-dark.svg",
        SOCIAL_DIR / "github-avatar.png",
        512, 512, 340, 287,
        bg=COLORS["navy"],
    )
    # OG image: 1200 x 630 horizontal logo on midnight-navy
    render_svg_fitted_on_canvas(
        BRAND_DIR / "logo-horizontal-dark.svg",
        SOCIAL_DIR / "og-image.png",
        1200, 630, 860, 176,
        bg=COLORS["navy"],
    )
    # Social banner: 1500 x 500 wide-format promotional banner on midnight-navy
    render_svg_fitted_on_canvas(
        BRAND_DIR / "logo-horizontal-dark.svg",
        SOCIAL_DIR / "social-banner.png",
        1500, 500, 920, 188,
        bg=COLORS["navy"],
    )

    # 8. Generate visual brand sheet & visual comparison sheet
    generate_brand_sheet(DOCS_DIR / "brand-sheet.png")
    generate_comparison_sheet(DOCS_DIR / "comparison-sheet.png", horiz_w)

    print("All oauth.how brand assets generated successfully!")


if __name__ == "__main__":
    main()
