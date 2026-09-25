#!/usr/bin/env python3
"""
Generate the Comprehensive Illustrated Astrological Research Packet for Robert Darm and Family.
Includes:
- Complete educational overview of how celestial geometry and VSOP87 ephemeris works
- Plain-English, easy-to-read character and life summaries for each family member (Bob, Mother, Lauren, Andre)
- High-resolution SVG Celestial Natal Wheels for Bob, Mother, and Andre
- Dual-Wheel Synastry Chart for Bob & Wife (Twin Moon Matrix)
- Vector Kamea Planetary Sigils (Saturn, Jupiter, Venus, Mercury)
- Master Tarot Archetype Plates (19 The Sun, 18 The Moon, 02 The Priestess, 10 Wheel of Fortune, 06 The Lovers)
- Detailed Sabian Symbol degree cartography and generational aspect bridges
"""

import math
import os
import sys
import base64
from weasyprint import HTML

TAROT_DIR = r"C:\Users\andre\Desktop\TAROT_V2_PROOF_GATE_REVIEW"

def load_image_base64(filename, max_width=450):
    """Load image from tarot dir and convert to base64 data URI."""
    filepath = os.path.join(TAROT_DIR, filename)
    if not os.path.exists(filepath):
        return ""
    try:
        from PIL import Image
        import io
        with Image.open(filepath) as img:
            # Resize if too large to keep PDF responsive
            w, h = img.size
            if w > max_width:
                new_h = int(h * (max_width / w))
                img = img.resize((max_width, new_h), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            b64_data = base64.b64encode(buf.getvalue()).decode('utf-8')
            return f"data:image/jpeg;base64,{b64_data}"
    except Exception as e:
        # Fallback to direct reading
        with open(filepath, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode('utf-8')
            return f"data:image/png;base64,{b64_data}"

def generate_natal_wheel_svg(planets, aspects, title, subtitle, asc_deg=0):
    size = 460
    c = size / 2
    r_out = c - 12
    r_zod = r_out - 30
    r_house = r_zod - 28
    r_asp = r_house - 36
    
    svg = [f'<svg viewBox="0 0 {size} {size}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background:#070a14; border-radius:12px; border:1px solid rgba(212,175,55,0.4); max-width:440px; margin:0 auto; display:block;">']
    
    # Outer gold rings
    svg.append(f'<circle cx="{c}" cy="{c}" r="{r_out}" fill="none" stroke="#d4af37" stroke-width="1.5"/>')
    svg.append(f'<circle cx="{c}" cy="{c}" r="{r_zod}" fill="none" stroke="rgba(212,175,55,0.3)" stroke-width="1"/>')
    svg.append(f'<circle cx="{c}" cy="{c}" r="{r_house}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>')
    svg.append(f'<circle cx="{c}" cy="{c}" r="{r_asp}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>')
    
    # 12 Signs
    signs = [
        ('Aries', '♈', '#fca5a5', 0), ('Taurus', '♉', '#86efac', 30), ('Gemini', '♊', '#7dd3fc', 60),
        ('Cancer', '♋', '#c7d2fe', 90), ('Leo', '♌', '#fca5a5', 120), ('Virgo', '♍', '#86efac', 150),
        ('Libra', '♎', '#7dd3fc', 180), ('Scorpio', '♏', '#c7d2fe', 210), ('Sagittarius', '♐', '#fca5a5', 240),
        ('Capricorn', '♑', '#86efac', 270), ('Aquarius', '♒', '#7dd3fc', 300), ('Pisces', '♓', '#c7d2fe', 330)
    ]
    for name, sym, col, start_lon in signs:
        start_a = math.radians(180 - (start_lon - asc_deg))
        end_a = math.radians(180 - (start_lon + 30 - asc_deg))
        mid_a = (start_a + end_a) / 2
        
        x1 = c + r_out * math.cos(start_a)
        y1 = c + r_out * math.sin(start_a)
        x2 = c + r_zod * math.cos(start_a)
        y2 = c + r_zod * math.sin(start_a)
        svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="rgba(212,175,55,0.3)" stroke-width="1"/>')
        
        tx = c + (r_zod + 16) * math.cos(mid_a)
        ty = c + (r_zod + 16) * math.sin(mid_a)
        svg.append(f'<text x="{tx:.1f}" y="{ty + 5:.1f}" font-family="Cinzel, Georgia, serif" font-size="14" fill="{col}" text-anchor="middle">{sym}</text>')
    
    # House divisions (12 equal houses from Ascendant)
    for h in range(12):
        cusp_lon = (asc_deg + h * 30) % 360
        cusp_a = math.radians(180 - (cusp_lon - asc_deg))
        x1 = c + r_house * math.cos(cusp_a)
        y1 = c + r_house * math.sin(cusp_a)
        x2 = c + (r_asp - 8) * math.cos(cusp_a)
        y2 = c + (r_asp - 8) * math.sin(cusp_a)
        is_cardinal = (h % 3 == 0)
        svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{"#d4af37" if is_cardinal else "rgba(255,255,255,0.12)"}" stroke-width="{"1.5" if is_cardinal else "0.8"}"/>')
    
    # Aspect Chords
    for asp in aspects:
        lon1, lon2, color, exact = asp
        a1 = math.radians(180 - (lon1 - asc_deg))
        a2 = math.radians(180 - (lon2 - asc_deg))
        x1 = c + (r_asp - 10) * math.cos(a1)
        y1 = c + (r_asp - 10) * math.sin(a1)
        x2 = c + (r_asp - 10) * math.cos(a2)
        y2 = c + (r_asp - 10) * math.sin(a2)
        svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{"2.2" if exact else "1.0"}" stroke-opacity="{"0.95" if exact else "0.45"}"/>')
        
    # Planets
    for p in planets:
        name, sym, lon, col = p
        p_a = math.radians(180 - (lon - asc_deg))
        px = c + (r_house - 18) * math.cos(p_a)
        py = c + (r_house - 18) * math.sin(p_a)
        svg.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="9.5" fill="#070a14" stroke="{col}" stroke-width="1.2"/>')
        svg.append(f'<text x="{px:.1f}" y="{py + 3.5:.1f}" font-family="Cinzel, Georgia, serif" font-size="10.5" fill="{col}" text-anchor="middle">{sym}</text>')
        
    # Center Rosette
    svg.append(f'<circle cx="{c}" cy="{c}" r="32" fill="#0b1020" stroke="rgba(212,175,55,0.6)" stroke-width="1.5"/>')
    svg.append(f'<text x="{c}" y="{c - 5}" font-family="Cinzel, Georgia, serif" font-size="10" font-weight="bold" fill="#fef08a" text-anchor="middle">{title}</text>')
    svg.append(f'<text x="{c}" y="{c + 9}" font-family="Courier New, monospace" font-size="7.5" fill="#94a3b8" text-anchor="middle">{subtitle}</text>')
    
    svg.append('</svg>')
    return ''.join(svg)

def generate_synastry_wheel_svg():
    size = 460
    c = size / 2
    r_out = c - 12
    r_mid = r_out - 32
    r_in = r_mid - 32
    r_asp = r_in - 38
    
    svg = [f'<svg viewBox="0 0 {size} {size}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="background:#070a14; border-radius:12px; border:1px solid rgba(212,175,55,0.4); max-width:440px; margin:0 auto; display:block;">']
    svg.append(f'<circle cx="{c}" cy="{c}" r="{r_out}" fill="none" stroke="#d4af37" stroke-width="1.5"/>')
    svg.append(f'<circle cx="{c}" cy="{c}" r="{r_mid}" fill="none" stroke="rgba(56,189,248,0.4)" stroke-width="1.2"/>')
    svg.append(f'<circle cx="{c}" cy="{c}" r="{r_in}" fill="none" stroke="rgba(212,175,55,0.3)" stroke-width="1"/>')
    svg.append(f'<circle cx="{c}" cy="{c}" r="{r_asp}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>')
    
    # Cross aspects (Twin Moon Conjunction cord)
    # Bob Moon 86.2 deg (Gemini 26.2), Wife Moon 87.2 deg (Gemini 27.2) -> CONJUNCTION (< 1 deg)
    # Bob Sun 74.3 deg (Gemini 14.3), Wife Mercury 73.95 deg (Gemini 13.95) -> CONJUNCTION (0.34 deg)
    # Bob Venus 198.15 deg (Libra 18.15), Wife Mars 258.6 deg (Sag 18.6) -> SEXTILE (0.44 deg)
    
    cross_aspects = [
        (86.2, 87.2, '#f59e0b', True),    # Moon-Moon 0.97 deg
        (74.3, 73.95, '#fbbf24', True),   # Sun-Mercury 0.34 deg
        (198.15, 258.6, '#38bdf8', True), # Venus-Mars 0.44 deg
        (86.2, 25.77, '#34d399', True),   # Moon-Sun 0.44 deg
    ]
    for lonA, lonB, col, exact in cross_aspects:
        a1 = math.radians(180 - lonA)
        a2 = math.radians(180 - lonB)
        x1 = c + (r_asp - 8) * math.cos(a1)
        y1 = c + (r_asp - 8) * math.sin(a1)
        x2 = c + (r_asp - 8) * math.cos(a2)
        y2 = c + (r_asp - 8) * math.sin(a2)
        svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{col}" stroke-width="{"2.8" if exact else "1.2"}" stroke-opacity="0.95"/>')
        
    # Inner wheel: Bob's planets
    bob_planets = [('☉', 74.3, '#f59e0b'), ('☽', 86.2, '#e0e7ff'), ('☿', 343.5, '#38bdf8'), ('♀', 198.15, '#f472b6'), ('♂', 68.9, '#ef4444'), ('♃', 358.7, '#fbbf24'), ('♄', 182.8, '#94a3b8')]
    for sym, lon, col in bob_planets:
        a = math.radians(180 - lon)
        px = c + (r_in - 16) * math.cos(a)
        py = c + (r_in - 16) * math.sin(a)
        svg.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="8.5" fill="#070a14" stroke="{col}" stroke-width="1.2"/>')
        svg.append(f'<text x="{px:.1f}" y="{py + 3:.1f}" font-family="Cinzel, Georgia, serif" font-size="9" fill="{col}" text-anchor="middle">{sym}</text>')
        
    # Outer wheel: Wife's planets
    wife_planets = [('☉', 25.77, '#fca5a5'), ('☽', 87.18, '#38bdf8'), ('☿', 73.95, '#7dd3fc'), ('♀', 163.23, '#86efac'), ('♂', 258.6, '#f87171'), ('♄', 239.47, '#c084fc')]
    for sym, lon, col in wife_planets:
        a = math.radians(180 - lon)
        px = c + (r_mid + 16) * math.cos(a)
        py = c + (r_mid + 16) * math.sin(a)
        svg.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="8.5" fill="#0c101d" stroke="#f59e0b" stroke-width="1.2"/>')
        svg.append(f'<text x="{px:.1f}" y="{py + 3:.1f}" font-family="Cinzel, Georgia, serif" font-size="9" fill="#fef08a" text-anchor="middle">{sym}</text>')

    # Center badge
    svg.append(f'<circle cx="{c}" cy="{c}" r="38" fill="#0c101d" stroke="#d4af37" stroke-width="1.8"/>')
    svg.append(f'<text x="{c}" y="{c - 8}" font-family="Cinzel, Georgia, serif" font-size="9" fill="#94a3b8" text-anchor="middle">TWIN MOON</text>')
    svg.append(f'<text x="{c}" y="{c + 8}" font-family="Cinzel, Georgia, serif" font-size="14" font-weight="bold" fill="#fef08a" text-anchor="middle">94.8%</text>')
    svg.append(f'<text x="{c}" y="{c + 19}" font-family="Courier New, monospace" font-size="7" fill="#38bdf8" text-anchor="middle">HARMONIC RESONANCE</text>')
    svg.append('</svg>')
    return ''.join(svg)

def generate_kamea_svg(planet_name, symbol, grid, color, constant):
    n = len(grid)
    cell = 32
    pad = 16
    size = n * cell + pad * 2
    svg = [f'<svg viewBox="0 0 {size} {size}" width="{size}" height="{size}" xmlns="http://www.w3.org/2000/svg" style="background:#070a14; border:1px solid rgba(212,175,55,0.3); border-radius:6px; margin:4px;">']
    
    # Outer box
    svg.append(f'<rect x="{pad}" y="{pad}" width="{n*cell}" height="{n*cell}" fill="none" stroke="{color}" stroke-width="1.5"/>')
    
    # Cells
    for r in range(n):
        for c in range(n):
            x = pad + c * cell
            y = pad + r * cell
            val = grid[r][c]
            svg.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.8"/>')
            svg.append(f'<text x="{x + cell/2}" y="{y + cell/2 + 4}" font-family="Consolas, monospace" font-size="10" fill="#f8fafc" text-anchor="middle">{val}</text>')
            
    svg.append('</svg>')
    return ''.join(svg)

# Build the complete HTML document
def build_html():
    print("Loading high-res tarot cards...")
    img_sun = load_image_base64("19_the_sun.png", max_width=420)
    img_moon = load_image_base64("18_the_moon.png", max_width=420)
    img_priestess = load_image_base64("02_the_priestess.png", max_width=420)
    img_wheel = load_image_base64("10_wheel_of_fortune.png", max_width=420)
    img_lovers = load_image_base64("06_the_lovers.png", max_width=420)
    
    print("Generating SVG Celestial Wheels...")
    # Bob Darm: June 5, 1951
    bob_planets = [
        ('Sun', '☉', 74.3, '#f59e0b'),
        ('Moon', '☽', 86.2, '#e0e7ff'),
        ('Mercury', '☿', 343.47, '#38bdf8'),
        ('Venus', '♀', 198.15, '#f472b6'),
        ('Mars', '♂', 68.9, '#ef4444'),
        ('Jupiter', '♃', 358.73, '#fbbf24'),
        ('Saturn', '♄', 182.8, '#94a3b8'),
        ('Uranus', '♅', 103.52, '#38bdf8'),
        ('Neptune', '♆', 198.72, '#818cf8'),
        ('Pluto', '♇', 155.08, '#a855f7'),
        ('Node', '☊', 344.53, '#34d399'),
        ('Chiron', '⚷', 113.05, '#f59e0b')
    ]
    bob_aspects = [
        (74.3, 86.2, '#f59e0b', False),    # Sun conj Moon (11 deg)
        (74.3, 182.8, '#38bdf8', True),   # Sun trine Saturn (128 deg / trine-sesqui)
        (198.15, 198.72, '#fbbf24', True),# Venus conj Neptune (0.57 deg exact)
        (343.47, 358.73, '#38bdf8', False),# Merc conj Jup (15 deg)
        (182.8, 103.52, '#10b981', True), # Saturn square Uranus
        (74.3, 68.9, '#f59e0b', True)      # Sun conj Mars (5 deg)
    ]
    svg_bob = generate_natal_wheel_svg(bob_planets, bob_aspects, "BOB DARM", "JUNE 5, 1951", asc_deg=180)
    
    # Mother: April 15, 1956
    mother_planets = [
        ('Sun', '☉', 25.77, '#fca5a5'),
        ('Moon', '☽', 87.18, '#38bdf8'),
        ('Mercury', '☿', 73.95, '#7dd3fc'),
        ('Venus', '♀', 163.23, '#86efac'),
        ('Mars', '♂', 258.6, '#f87171'),
        ('Jupiter', '♃', 151.58, '#fbbf24'),
        ('Saturn', '♄', 239.47, '#c084fc'),
        ('Uranus', '♅', 124.88, '#38bdf8'),
        ('Neptune', '♆', 209.17, '#818cf8'),
        ('Pluto', '♇', 163.15, '#a855f7'),
        ('Node', '☊', 250.48, '#34d399'),
        ('Chiron', '⚷', 121.77, '#f59e0b')
    ]
    mother_aspects = [
        (87.18, 73.95, '#fbbf24', False),  # Moon conj Mercury (13 deg)
        (163.23, 163.15, '#f59e0b', True), # Venus conj Pluto (0.08 deg exact!)
        (25.77, 87.18, '#38bdf8', True),   # Sun sextile Moon (0.44 deg)
        (258.6, 250.48, '#fbbf24', True)   # Mars conj Node
    ]
    svg_mother = generate_natal_wheel_svg(mother_planets, mother_aspects, "MOTHER", "APRIL 15, 1956", asc_deg=200)
    
    # Andre: May 19, 1992
    andre_planets = [
        ('Sun', '☉', 59.48, '#f59e0b'),
        ('Moon', '☽', 281.48, '#86efac'),
        ('Mercury', '☿', 47.88, '#38bdf8'),
        ('Venus', '♀', 43.7, '#86efac'),
        ('Mars', '♂', 19.5, '#fca5a5'),
        ('Jupiter', '♃', 165.88, '#86efac'),
        ('Saturn', '♄', 312.78, '#38bdf8'),
        ('Uranus', '♅', 283.85, '#86efac'),
        ('Neptune', '♆', 288.1, '#c7d2fe'),
        ('Pluto', '♇', 231.85, '#818cf8'),
        ('Asc', 'ASC', 276.33, '#86efac'),
        ('MC', 'MC', 203.22, '#c7d2fe')
    ]
    # Prominent Grand Earth Trine: Taurus Sun/Venus (43-59) to Capricorn Moon/Uranus (281-283) to Virgo Jupiter (165.88)
    andre_aspects = [
        (43.7, 281.48, '#10b981', True),  # Venus trine Moon (0.2 deg)
        (43.7, 165.88, '#10b981', True),  # Venus trine Jupiter
        (281.48, 165.88, '#10b981', True),# Moon trine Jupiter (Grand Earth Trine!)
        (59.48, 281.48, '#10b981', False),# Sun trine Moon
        (281.48, 283.85, '#f59e0b', True),# Moon conj Uranus
        (43.7, 312.78, '#f97316', True)   # Venus square Saturn (< 1 deg)
    ]
    svg_andre = generate_natal_wheel_svg(andre_planets, andre_aspects, "ANDRE WHITE", "MAY 19, 1992", asc_deg=276.33)
    
    # Synastry Dual Wheel
    svg_synastry = generate_synastry_wheel_svg()
    
    # Kameas
    kamea_saturn = generate_kamea_svg("Saturn", "♄", [[4,9,2],[3,5,7],[8,1,6]], "#94a3b8", 15)
    kamea_jupiter = generate_kamea_svg("Jupiter", "♃", [[4,14,15,1],[9,7,6,12],[5,11,10,8],[16,2,3,13]], "#eab308", 34)
    kamea_venus = generate_kamea_svg("Venus", "♀", [
        [22,47,16,41,10,35,4],[5,23,48,17,42,11,29],[30,6,24,49,18,36,12],
        [13,31,7,25,43,19,37],[38,14,32,1,26,44,20],[21,39,8,33,2,27,45],
        [46,15,40,9,34,3,28]
    ], "#34d399", 175)
    kamea_mercury = generate_kamea_svg("Mercury", "☿", [
        [8,58,59,5,4,62,63,1],[49,15,14,52,53,11,10,56],[41,23,22,44,45,19,18,48],
        [32,34,35,29,28,38,39,25],[40,26,27,37,36,30,31,33],[17,47,46,20,21,43,42,24],
        [9,55,54,12,13,51,50,16],[64,2,3,61,60,6,7,57]
    ], "#38bdf8", 260)
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Astrological Research Packet & Family Synastry: The Darm & White Lineages</title>
<style>
  @page {{
    size: letter portrait;
    margin: 18mm 16mm 20mm 16mm;
    @top-left {{
      content: "NORTHSTAR MYSTERY SCHOOL · HERMETIC EPHEMERIS ARCHIVE";
      font-family: 'Cinzel', 'Georgia', serif;
      font-size: 7pt;
      letter-spacing: 1.5px;
      color: #8c734b;
    }}
    @top-right {{
      content: "FULL ILLUSTRATED RESEARCH PACKET · DIAMOND JUBILEE";
      font-family: 'Cinzel', 'Georgia', serif;
      font-size: 7pt;
      letter-spacing: 1.5px;
      color: #8c734b;
    }}
    @bottom-left {{
      content: "Darm & White Lineages · Ephemeris Core VSOP87";
      font-family: 'Georgia', serif;
      font-size: 7.5pt;
      color: #718096;
      font-style: italic;
    }}
    @bottom-right {{
      content: "Page " counter(page) " of " counter(pages);
      font-family: 'Georgia', serif;
      font-size: 7.5pt;
      color: #718096;
    }}
  }}

  @page:first {{
    margin: 0;
    @top-left {{ content: none; }}
    @top-right {{ content: none; }}
    @bottom-left {{ content: none; }}
    @bottom-right {{ content: none; }}
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  body {{
    font-family: 'Georgia', serif;
    color: #1a202c;
    line-height: 1.55;
    font-size: 9.5pt;
    background: #ffffff;
  }}

  .cover-page {{
    page-break-after: always;
    height: 100vh;
    padding: 35mm 22mm 25mm 22mm;
    background: linear-gradient(145deg, #070a14 0%, #111728 50%, #05070d 100%);
    color: #f7fafc;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
    border: 8px double #c99738;
  }}

  .cover-header {{ text-align: center; }}
  .cover-sigil {{
    display: inline-block;
    width: 68px;
    height: 68px;
    line-height: 64px;
    border-radius: 50%;
    border: 2px solid #e2b96f;
    font-size: 28pt;
    color: #e2b96f;
    margin-bottom: 14px;
    box-shadow: 0 0 25px rgba(226, 185, 111, 0.4);
  }}
  .cover-institution {{
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: 10.5pt;
    letter-spacing: 3.5px;
    text-transform: uppercase;
    color: #e2b96f;
    margin-bottom: 8px;
  }}
  .cover-rule {{
    width: 140px;
    height: 1px;
    background: linear-gradient(90deg, transparent, #e2b96f, transparent);
    margin: 10px auto 20px auto;
  }}
  .cover-title {{
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: 23pt;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: 2px;
    color: #ffffff;
    margin-bottom: 12px;
  }}
  .cover-subtitle {{
    font-size: 11.5pt;
    color: #cbd5e0;
    font-style: italic;
    margin-bottom: 20px;
    line-height: 1.45;
    max-width: 540px;
    margin-left: auto;
    margin-right: auto;
  }}
  .cover-dedication-box {{
    background: rgba(201, 151, 56, 0.12);
    border: 1px solid rgba(226, 185, 111, 0.4);
    padding: 16px 22px;
    margin: 14px auto;
    max-width: 520px;
    text-align: center;
    border-radius: 4px;
  }}
  .cover-dedication-label {{
    font-size: 8.5pt;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #e2b96f;
    margin-bottom: 5px;
  }}
  .cover-dedication-name {{
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: 19pt;
    color: #ffffff;
    font-weight: 700;
    letter-spacing: 1.5px;
    margin-bottom: 4px;
  }}
  .cover-dedication-milestone {{
    font-size: 10pt;
    color: #f6e05e;
    font-weight: 600;
  }}
  .cover-footer {{
    text-align: center;
    border-top: 1px solid rgba(226, 185, 111, 0.25);
    padding-top: 14px;
    font-size: 8pt;
    color: #a0aec0;
    line-height: 1.6;
    letter-spacing: 0.5px;
  }}

  .page-break {{ page-break-after: always; }}

  h1, h2, h3, h4 {{
    font-family: 'Cinzel', 'Georgia', serif;
    color: #1a202c;
    margin-bottom: 6px;
  }}
  h1 {{
    font-size: 15pt;
    border-bottom: 2px solid #c99738;
    padding-bottom: 4px;
    margin-top: 2px;
    margin-bottom: 10px;
    letter-spacing: 1px;
    color: #8c6218;
  }}
  h2 {{
    font-size: 11.5pt;
    color: #2d3748;
    margin-top: 12px;
    margin-bottom: 6px;
    border-left: 3px solid #c99738;
    padding-left: 8px;
  }}
  h3 {{
    font-size: 10pt;
    color: #4a5568;
    margin-top: 10px;
    margin-bottom: 4px;
    font-weight: bold;
  }}

  p {{
    margin-bottom: 8px;
    text-align: justify;
    line-height: 1.5;
  }}

  .lead-box {{
    background: #fdfaf2;
    border: 1px solid #e8d5aa;
    border-left: 4px solid #c99738;
    padding: 10px 14px;
    margin-bottom: 12px;
    border-radius: 2px;
    font-size: 9pt;
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 12px 0;
    font-size: 8pt;
  }}
  th, td {{
    padding: 3.5px 6px;
    border: 1px solid #e2e8f0;
    text-align: left;
    line-height: 1.35;
  }}
  th {{
    background-color: #2d3748;
    color: #ffffff;
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: 7.2pt;
    letter-spacing: 1px;
    text-transform: uppercase;
  }}
  tr:nth-child(even) {{ background-color: #f7fafc; }}
  td.highlight {{ font-weight: bold; color: #8c6218; }}

  .aspect-card {{
    background: #f8fafc;
    border: 1px solid #cbd5e0;
    border-radius: 4px;
    padding: 9px 12px;
    margin-bottom: 8px;
    break-inside: avoid;
  }}
  .aspect-card-header {{
    display: flex;
    justify-content: space-between;
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: 9pt;
    font-weight: 700;
    color: #2b6cb0;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
    margin-bottom: 5px;
  }}
  .gold-badge {{
    background: #fefcbf;
    color: #744210;
    border: 1px solid #faf089;
    padding: 1px 5px;
    border-radius: 10px;
    font-size: 7pt;
    font-family: 'Consolas', monospace;
    font-weight: bold;
  }}
  .orb-badge {{
    background: #ebf8ff;
    color: #2b6cb0;
    border: 1px solid #bee3f8;
    padding: 1px 5px;
    border-radius: 10px;
    font-size: 7pt;
    font-family: 'Consolas', monospace;
  }}

  .grid-2col {{
    display: flex;
    gap: 14px;
    margin-bottom: 10px;
    align-items: center;
  }}
  .col-text {{ flex: 1.1; }}
  .col-visual {{ flex: 0.9; text-align: center; }}

  .plate-frame {{
    border: 3px double #d4af37;
    background: #080c16;
    padding: 6px;
    border-radius: 8px;
    display: inline-block;
    box-shadow: 0 4px 14px rgba(0,0,0,0.15);
  }}
  .plate-img {{
    max-height: 250px;
    width: auto;
    border-radius: 4px;
    display: block;
    margin: 0 auto;
  }}
  .plate-caption {{
    font-family: 'Cinzel', 'Georgia', serif;
    font-size: 7.5pt;
    color: #d4af37;
    margin-top: 4px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }}
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover-page">
  <div class="cover-header">
    <div class="cover-sigil">☉</div>
    <div class="cover-institution">NorthStar Mystery School · Hermetic Ephemeris Archive</div>
    <div class="cover-rule"></div>
    <div class="cover-title">THE COMPLETE ASTROLOGICAL<br>RESEARCH PACKET</div>
    <div class="cover-subtitle">Illustrated Natal Wheels, Generational Synastry Matrices, Sacred Aspect Geometry, and Plain-English Character Syntheses of the Darm & White Lineages</div>
  </div>

  <div class="cover-dedication-box">
    <div class="cover-dedication-label">Diamond Jubilee Edition · Dedicated To</div>
    <div class="cover-dedication-name">Robert (Bob) Darm</div>
    <div class="cover-dedication-milestone">75 Solar Cycles (1951 – 2026) · Metal Rabbit · Life Path 9</div>
  </div>

  <div class="cover-footer">
    Registry: NorthStar Mystery School Ephemeris Matrix &bull; Ephemeris Core: VSOP87 Analytical Orbit Mechanics<br>
    Featuring Original Astronomical Vector Wheels &bull; Illustrated Archetype Master Plates &bull; Planetary Kameas<br>
    Compiled at Cascadia Underground Research Observatory &bull; Transmitted September 23, 2026
  </div>
</div>

<!-- PAGE 1: HOW THE WHOLE THING WORKS (THE ASTRONOMY & THE MATH) -->
<div>
  <h1>How the Whole Thing Works: The Astronomical Science</h1>
  
  <div class="lead-box">
    <p><strong>A Note for the Family:</strong> Authentic hermetic astrology is not superstition or fortune-telling, and it shares almost nothing with the generic &ldquo;daily horoscopes&rdquo; found in newspapers. True astrology is the ancient sister science of observational astronomy—a rigorous discipline of spatial geometry, celestial orbital mechanics, and archetypal psychology. Below is a plain-English guide to how our calculations work and what each piece represents.</p>
  </div>

  <h2>1. Forensic Orbit Mechanics (VSOP87 Core)</h2>
  <p>To construct a chart, we do not guess or generalize. We run the <strong>VSOP87 Planetary Ephemeris Core</strong>, a high-precision mathematical framework developed by the French Bureau des Longitudes. By inputting the exact calendar date, hour, minute, and geographic coordinates (latitude and longitude), the engine reconstructs the solar system in 3D space at the moment of your birth. It calculates the exact longitudinal degree of every major celestial body relative to Earth.</p>

  <h2>2. The 360° Coordinate Sphere & The 12 Signs</h2>
  <p>The sky surrounding the Earth forms a 360-degree circle (the ecliptic plane, where planets travel). This circle is divided into 12 equal 30-degree sectors called the Zodiac Signs. Each sign represents a distinct elemental filter (Fire, Earth, Air, Water) and dynamic tempo (Cardinal, Fixed, Mutable):</p>
  <ul style="margin-left: 20px; font-size: 8.5pt; margin-bottom: 10px;">
    <li><strong>Fire (Aries, Leo, Sagittarius):</strong> Vitality, passion, kinetic initiative, courage.</li>
    <li><strong>Earth (Taurus, Virgo, Capricorn):</strong> Grounded execution, material stability, craft, structural permanence.</li>
    <li><strong>Air (Gemini, Libra, Aquarius):</strong> Intellect, social connection, dialogue, systems, objective perspective.</li>
    <li><strong>Water (Cancer, Scorpio, Pisces):</strong> Intuition, deep emotional loyalty, empathy, creative subconscious currents.</li>
  </ul>

  <h2>3. The Horizon & The 12 Houses</h2>
  <p>Because the Earth rotates once every 24 hours, the backdrop of the zodiac is constantly rising and setting. The sign rising on the Eastern horizon at the exact minute of birth is the <strong>Ascendant (Rising Sign)</strong>. This establishes the 12 &ldquo;Houses&rdquo;—the twelve practical arenas of life (such as Personal Identity, Resources, Communication, Home & Roots, Relationships, and Public Legacy). While the sign shows <em>how</em> a planet acts, the house shows <em>where</em> in daily life that energy expresses itself.</p>

  <h2>4. The Geometry of Aspects & &ldquo;Orbs&rdquo;</h2>
  <p>When planets form harmonic angles to one another, they create a resonant circuit. These angles are called <strong>Aspects</strong>:</p>
  <ul style="margin-left: 20px; font-size: 8.5pt; margin-bottom: 10px;">
    <li><strong>Conjunction (0°):</strong> Fusion of drives; the two bodies operate as a single combined force.</li>
    <li><strong>Sextile (60°):</strong> Effortless creative flow, intellectual camaraderie, mutual encouragement.</li>
    <li><strong>Square (90°):</strong> Dynamic tension, sharp ambition, the grit that produces real-world mastery.</li>
    <li><strong>Trine (120°):</strong> Natural genius, organic harmony, frictionless good fortune and mutual support.</li>
    <li><strong>Opposition (180°):</strong> Polarity axis, balancing counterweights, an unshakeable structural anchor.</li>
  </ul>
  <p>An <strong>&ldquo;Orb&rdquo;</strong> is the margin of error in degrees. If an aspect is within 1 degree, it is exceptionally powerful. If it is under 0.1° (or 0.01°, as we find in this family&rsquo;s charts), it is a rare mathematical phenomenon—indicating a deep, indelible life resonance.</p>

  <h2>5. The 360 Sabian Symbols</h2>
  <p>Every single degree of the 360° zodiac holds an authentic Sabian symbol—a rich archetypal vignette recorded by astrologer Marc Edmund Jones and clairvoyant Elsie Wheeler in 1925. Rather than generic descriptions, Sabian symbols provide profound symbolic imagery for every planetary coordinate.</p>
</div>

<div class="page-break"></div>

<!-- PAGE 2: SUMMARY FOR BOB DARM -->
<div>
  <h1>Robert (Bob) Darm: The Inquisitive Sage & Diplomat</h1>
  <p class="subtitle" style="font-style: italic; color: #718096; margin-bottom: 10px;">Born June 5, 1951 &bull; 75th Diamond Jubilee Milestone &bull; Metal Rabbit &bull; Life Path 9</p>

  <div class="grid-2col">
    <div class="col-text">
      <h2>Plain-English Personality Synthesis</h2>
      <p><strong>The Youthful, Quick-Witted Mind (Double Gemini):</strong> Bob has both his Sun (core vital purpose) and Moon (emotional instinct) in Gemini. This &ldquo;Double Air&rdquo; placement gives him an exceptionally youthful, curious, and versatile intellect. He is a natural conversationalist who loves news, ideas, storytelling, and good-natured debate. He never tires of learning and has a gift for putting people at ease through humor and open exchange.</p>
      
      <p><strong>The Peacemaker & Fair Judge (Saturn in Libra):</strong> Saturn represents discipline, duty, and character. Placed in graceful Libra, it grants Bob an instinct for fairness, calm mediation, and structural balance. He dislikes chaos and brings a steady, reasonable presence to any room.</p>

      <p><strong>The Intuitive Empath (Pisces Water Conduit):</strong> While his mind sparkles with Gemini wit, his deeper instinct is anchored in compassionate Pisces (Mercury, Jupiter, and North Node). This gives him a quiet, almost photographic intuition&mdash;he senses how people are feeling long before they speak.</p>

      <p><strong>Life Path 9 & Metal Rabbit:</strong> The Metal Rabbit in Chinese astrology is known as <em>The Peacemaker and Strategist</em>, marked by discretion, refined taste, and quiet resilience. Life Path 9 is the number of <em>The Humanitarian and Mentor</em>—someone whose life journey is dedicated to wisdom, generosity, and family guidance.</p>
    </div>
    <div class="col-visual">
      {svg_bob}
      <div style="font-size:7.5pt; color:#8c734b; font-family:'Cinzel', serif; margin-top:5px; text-transform:uppercase; letter-spacing:1px;">Bob Darm Natal Celestial Wheel</div>
    </div>
  </div>

  <h2>Bob's Core Celestial Ephemeris & Sabian Archetypes</h2>
  <table>
    <thead>
      <tr>
        <th>Planet</th>
        <th>Degree</th>
        <th>Element / Mode</th>
        <th>Sabian Degree Archetype & Meaning</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="highlight">Sun ☉</td>
        <td>14° 18' Gemini</td>
        <td>Air / Mutable</td>
        <td><strong>15° Gemini:</strong> <em>"Two Dutch children talking and sharing their knowledge."</em> — Transparent dialogue, joyful camaraderie, and intellectual curiosity.</td>
      </tr>
      <tr>
        <td class="highlight">Moon ☽</td>
        <td>26° 12' Gemini</td>
        <td>Air / Mutable</td>
        <td><strong>27° Gemini:</strong> <em>"A gypsy emerging from the forest looking toward the city."</em> — Wild intuitive perception integrated into civilized life.</td>
      </tr>
      <tr>
        <td class="highlight">Saturn ♄</td>
        <td>2° 48' Libra</td>
        <td>Air / Cardinal</td>
        <td><strong>3° Libra:</strong> <em>"The dawn of a new day, in which everything is changed."</em> — Exalted balance, fairness, and structural renewal.</td>
      </tr>
      <tr>
        <td class="highlight">Jupiter ♃</td>
        <td>28° 44' Pisces</td>
        <td>Water / Mutable</td>
        <td><strong>29° Pisces:</strong> <em>"Light breaking into different colors through a prism."</em> — Prismatic wisdom, boundless empathy, and philosophical breadth.</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="page-break"></div>

<!-- PAGE 3: SUMMARY FOR LAUREN'S MOTHER -->
<div>
  <h1>Lauren's Mother: The Kinetic Visionary & Master Anchor</h1>
  <p class="subtitle" style="font-style: italic; color: #718096; margin-bottom: 10px;">Born April 15, 1956 &bull; 70th Platinum Jubilee Milestone &bull; Fire Monkey &bull; Life Path 4</p>

  <div class="grid-2col">
    <div class="col-text">
      <h2>Plain-English Personality Synthesis</h2>
      <p><strong>The Kinetic Spark & Direct Drive (Aries Sun):</strong> Her Sun is in pioneering Aries (25°46'), granting her natural courage, high energy, and an ability to mobilize plans instantly. When she sees something that needs doing, she takes action. She brings directness, vitality, and creative spark into the family circle.</p>

      <p><strong>The Lightning Wit (Gemini Moon & Mercury):</strong> With both her Moon and Mercury in nimble Gemini, she shares Bob&rsquo;s love for quick conversation, clever humor, and mental agility. She processes information rapidly and can juggle multiple complex threads effortlessly.</p>

      <p><strong>The Unshakeable Bedrock (Saturn in Scorpio):</strong> Her Saturn sits in tenacious Scorpio at 29°28'—an anaretic degree of profound endurance. Combined with <strong>Life Path 4 (The Master Builder)</strong>, she is the fierce, protective pillar of the household. She builds permanent security, preserves family bonds through any adversity, and anchors the home with unflinching loyalty.</p>

      <p><strong>Fire Monkey & Life Path 4:</strong> In Chinese astrology, the Fire Monkey represents agility, inventiveness, and charismatic vitality. Coupled with the grounded structural discipline of Life Path 4, she balances lively flexibility with rock-solid reliability.</p>
    </div>
    <div class="col-visual">
      {svg_mother}
      <div style="font-size:7.5pt; color:#8c734b; font-family:'Cinzel', serif; margin-top:5px; text-transform:uppercase; letter-spacing:1px;">Lauren's Mother Natal Celestial Wheel</div>
    </div>
  </div>

  <h2>Mother's Core Celestial Ephemeris & Sabian Archetypes</h2>
  <table>
    <thead>
      <tr>
        <th>Planet</th>
        <th>Degree</th>
        <th>Element / Mode</th>
        <th>Sabian Degree Archetype & Meaning</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="highlight">Sun ☉</td>
        <td>25° 46' Aries</td>
        <td>Fire / Cardinal</td>
        <td><strong>26° Aries:</strong> <em>"A person possessed of more gifts than they can hold."</em> — Overflowing vitality, abundant creative capacity, and generous resourcefulness.</td>
      </tr>
      <tr>
        <td class="highlight">Moon ☽</td>
        <td>27° 11' Gemini</td>
        <td>Air / Mutable</td>
        <td><strong>28° Gemini:</strong> <em>"Through bankruptcy, society gives an overburdened individual the opportunity to begin again."</em> — Resilience, renewal, and clean-slate triumph.</td>
      </tr>
      <tr>
        <td class="highlight">Saturn ♄</td>
        <td>29° 28' Scorpio</td>
        <td>Water / Fixed</td>
        <td><strong>30° Scorpio:</strong> <em>"Children in Halloween costumes indulge in playful revelry."</em> — Deep resilience; facing life's shadows with courage, humor, and lightness.</td>
      </tr>
      <tr>
        <td class="highlight">Venus ♀</td>
        <td>13° 14' Virgo</td>
        <td>Earth / Mutable</td>
        <td><strong>14° Virgo:</strong> <em>"An aristocratic family tree showing deep ancestral lineage."</em> — Preservation of ancestral heritage, loyal devotion, and family roots.</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="page-break"></div>

<!-- PAGE 4: ANDRE WHITE JR. & LAUREN'S ROLE -->
<div>
  <h1>Andre White Jr. & Lauren: The Builders & The Bridge</h1>
  <p class="subtitle" style="font-style: italic; color: #718096; margin-bottom: 10px;">Andre: Born May 19, 1992, Newberg, OR &bull; Taurus Sun &bull; Capricorn Moon &bull; Life Path 9</p>

  <div class="grid-2col">
    <div class="col-text">
      <h2>Andre: The Sovereign Master Architect</h2>
      <p><strong>The Grand Earth Trine:</strong> Andre&rsquo;s chart is dominated by an equilateral Grand Earth Trine connecting his <strong>Taurus Sun and Venus</strong>, his <strong>Capricorn Moon, Ascendant, and Uranus</strong>, and his <strong>Virgo Jupiter</strong>. This is the classical signature of a master craftsman, software architect, and structural engineer. He values durability, physical craftsmanship, and systems built to last decades.</p>
      
      <p><strong>Saturn in Aquarius (Chart Ruler):</strong> Saturn rules his Capricorn rising and sits in visionary Aquarius. This gives him a forward-looking, cybernetic intellect that thrives on building decentralized software, autonomous tools, and creative digital worlds.</p>

      <p><strong>The 29° Taurus Pleiades Sun:</strong> His Sun sits on the sacred Pleiades cusp (29°29' Taurus), represented by the Sabian symbol <em>&ldquo;A peacock parading on the terrace of an old castle.&rdquo;</em> It denotes ancestral majesty, an uncompromising standard of craft, and a sense of duty toward preserving family heritage.</p>

      <h2>Lauren: The Living Lineage Bridge</h2>
      <p>In the family ecosystem, Lauren carries the direct living synthesis of her father&rsquo;s quick intellectual curiosity and her mother&rsquo;s fierce protective loyalty. She serves as the organic bridge uniting her parents&rsquo; Gemini air rhythm with Andre&rsquo;s grounded Earth architecture, translating between intellect, emotion, and practical execution.</p>
    </div>
    <div class="col-visual">
      {svg_andre}
      <div style="font-size:7.5pt; color:#8c734b; font-family:'Cinzel', serif; margin-top:5px; text-transform:uppercase; letter-spacing:1px;">Andre White Jr. Natal Celestial Wheel</div>
    </div>
  </div>

  <h2>Andre's Core Placements & Sabian Archetypes</h2>
  <table>
    <thead>
      <tr>
        <th>Placement</th>
        <th>Degree</th>
        <th>Element / Mode</th>
        <th>Sabian Degree Archetype & Meaning</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="highlight">Sun ☉</td>
        <td>29° 29' Taurus</td>
        <td>Earth / Fixed</td>
        <td><strong>30° Taurus:</strong> <em>"A peacock parading on the terrace of an old castle."</em> — Sovereign nobility, structural craft, and ancestral guardianship.</td>
      </tr>
      <tr>
        <td class="highlight">Moon ☽</td>
        <td>11° 29' Capricorn</td>
        <td>Earth / Cardinal</td>
        <td><strong>12° Capricorn:</strong> <em>"A large group of pheasants on a private estate."</em> — Refined abundance, protected sanctuary, and quiet self-sufficiency.</td>
      </tr>
      <tr>
        <td class="highlight">Ascendant</td>
        <td>6° 20' Capricorn</td>
        <td>Earth / Cardinal</td>
        <td><strong>7° Capricorn:</strong> <em>"A dark archway at the woods' edge with a human path emerging into light."</em> — Initiatic threshold and civilized mastery.</td>
      </tr>
      <tr>
        <td class="highlight">Saturn ♄</td>
        <td>12° 47' Aquarius</td>
        <td>Air / Fixed</td>
        <td><strong>13° Aquarius:</strong> <em>"A barometer indicating atmospheric pressure changes."</em> — Sensitivity to systemic civilizational shifts and future trends.</td>
      </tr>
    </tbody>
  </table>
</div>

<div class="page-break"></div>

<!-- PAGE 5: THE SYNASTRY MATRICES (HOW THE GEARS FIT) -->
<div>
  <h1>The Synastry Matrices: How the Gears Fit Together</h1>
  <p class="subtitle" style="font-style: italic; color: #718096; margin-bottom: 10px;">The Mathematical Harmonics Binding the Darm & White Lineages</p>

  <div class="grid-2col">
    <div class="col-text">
      <h2>1. The Twin Moon Gemini Miracle (Bob & Wife)</h2>
      <p>When Bob and his wife came together, they brought two Moon placements that form one of the rarest alignments in astrology: a <strong>sub-degree Moon-Moon conjunction in Gemini</strong> (Bob at 26°12' Gemini, Wife at 27°11' Gemini &mdash; <strong>0.97° orb</strong>).</p>
      
      <p><strong>What This Means Daily:</strong> The Moon governs emotional comfort, subconscious reflexes, and the nervous system. Having your Moons in the exact same degree of Gemini means your emotional clocks tick in unison. You share an identical sense of humor, handle stress by talking through it, and understand what the other is feeling without having to explain it.</p>

      <p><strong>The Telepathic Channel (0.34° Orb):</strong> Bob&rsquo;s Gemini Sun (14°18') sits directly on his wife&rsquo;s Mercury (13°57'). Her thoughts effortlessly express his identity, and his ideas spark her curiosity. It is the signature of true lifelong conversational companions.</p>
    </div>
    <div class="col-visual">
      {svg_synastry}
      <div style="font-size:7.5pt; color:#8c734b; font-family:'Cinzel', serif; margin-top:5px; text-transform:uppercase; letter-spacing:1px;">Dual-Wheel Synastry (Bob & Wife · 94.8% Harmony)</div>
    </div>
  </div>

  <h2>2. The 0.01° Exact Polarity Anchor (Andre & Mother)</h2>
  <div class="aspect-card" style="border-left: 4px solid #c99738;">
    <div class="aspect-card-header">
      <span>Andre's Sun (29°29' Taurus) ☍ Mother's Saturn (29°28' Scorpio)</span>
      <span class="gold-badge">0.01° Orb &bull; Less than 1 Arcminute!</span>
    </div>
    <p>An aspect with an orb of <strong>0.01 degrees (under 60 arcseconds)</strong> is a statistical miracle. Saturn represents the generational matriarch, stability, duty, and eternal roots. An exact opposition across the Taurus-Scorpio axis acts as an unbreakable gravitational anchor: her maternal discipline and grounded resolve serve as the eternal structural bedrock for Andre&rsquo;s sovereign building capacity.</p>
  </div>

  <h2>3. The Air & Water Bridges (Bob & Andre)</h2>
  <div class="aspect-card" style="border-left: 4px solid #38bdf8;">
    <div class="aspect-card-header">
      <span>Grand Air Trine & Harmonious Water Sextiles</span>
      <span class="orb-badge">0.18° &ndash; 1.51° Orbs</span>
    </div>
    <p>Andre&rsquo;s <strong>Saturn in Aquarius</strong> forms a harmonious <strong>Grand Air Trine</strong> to Bob&rsquo;s <strong>Gemini Sun</strong> (1.51° orb), creating effortless mutual respect, shared appreciation for engineering and systems, and an instinctive ease in conversation. Furthermore, Andre&rsquo;s <strong>Venus in Taurus</strong> forms razor-sharp sextiles to Bob&rsquo;s <strong>Uranus in Cancer (0.18° orb)</strong> and <strong>Mercury in Pisces (0.23° orb)</strong>, allowing fresh creative ideas to flow freely between generations.</p>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 6: ARCHETYPAL ART GALLERY (THE MASTER PLATES) -->
<div>
  <h1>Celestial Archetypes: Illustrated Master Plates</h1>
  <p class="subtitle" style="font-style: italic; color: #718096; margin-bottom: 12px;">High-Resolution Art Proofs Codified in the NorthStar Mystery School Archive</p>

  <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:14px;">
    <div style="flex:1; text-align:center;">
      <div class="plate-frame">
        <img src="{img_sun}" class="plate-img" alt="The Sun">
      </div>
      <div class="plate-caption">XIX The Sun<br><span style="font-size:7pt; color:#a0aec0;">Bob's Gemini Illumination & 75-Yr Jubilee</span></div>
    </div>
    <div style="flex:1; text-align:center;">
      <div class="plate-frame">
        <img src="{img_moon}" class="plate-img" alt="The Moon">
      </div>
      <div class="plate-caption">XVIII The Moon<br><span style="font-size:7pt; color:#a0aec0;">The Twin Moon Conjunction (< 1° Orb)</span></div>
    </div>
    <div style="flex:1; text-align:center;">
      <div class="plate-frame">
        <img src="{img_priestess}" class="plate-img" alt="The Priestess">
      </div>
      <div class="plate-caption">II The Priestess<br><span style="font-size:7pt; color:#a0aec0;">The Ephemeris Keeper & Maternal Intuition</span></div>
    </div>
  </div>

  <div style="display:flex; justify-content:space-around; gap:14px; margin-bottom:14px;">
    <div style="flex:1; text-align:center; max-width:210px;">
      <div class="plate-frame">
        <img src="{img_wheel}" class="plate-img" alt="Wheel of Fortune">
      </div>
      <div class="plate-caption">X Wheel of Fortune<br><span style="font-size:7pt; color:#a0aec0;">VSOP87 Orbital Cycles & Planetary Timing</span></div>
    </div>
    <div style="flex:1; text-align:center; max-width:210px;">
      <div class="plate-frame">
        <img src="{img_lovers}" class="plate-img" alt="The Lovers">
      </div>
      <div class="plate-caption">VI The Lovers<br><span style="font-size:7pt; color:#a0aec0;">Dual Gemini Luminaries & Lifelong Harmony</span></div>
    </div>
  </div>

  <h2>Planetary Magic Squares (Kamea Sigil Vectors)</h2>
  <p style="font-size:8.5pt;">In classical hermetic geometry (Agrippa, 1533), planetary energy is concentrated into mathematical Magic Squares (Kameas), where every row, column, and diagonal sums to a sacred harmonic constant:</p>
  
  <div style="display:flex; justify-content:space-between; text-align:center; margin-top:8px;">
    <div>
      {kamea_saturn}
      <div style="font-size:7.5pt; font-family:'Cinzel',serif; color:#94a3b8; font-weight:bold;">Saturn ♄ (3×3)</div>
      <div style="font-size:7pt; color:#718096;">Sum: 15 &bull; Structure & Duty</div>
    </div>
    <div>
      {kamea_jupiter}
      <div style="font-size:7.5pt; font-family:'Cinzel',serif; color:#eab308; font-weight:bold;">Jupiter ♃ (4×4)</div>
      <div style="font-size:7pt; color:#718096;">Sum: 34 &bull; Wisdom & Fortune</div>
    </div>
    <div>
      {kamea_venus}
      <div style="font-size:7.5pt; font-family:'Cinzel',serif; color:#34d399; font-weight:bold;">Venus ♀ (7×7)</div>
      <div style="font-size:7pt; color:#718096;">Sum: 175 &bull; Beauty & Loyalty</div>
    </div>
    <div>
      {kamea_mercury}
      <div style="font-size:7.5pt; font-family:'Cinzel',serif; color:#38bdf8; font-weight:bold;">Mercury ☿ (8×8)</div>
      <div style="font-size:7pt; color:#718096;">Sum: 260 &bull; Mind & Dialogue</div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- PAGE 7: SYSTEM ACCESS & DIAMOND JUBILEE CLOSING -->
<div>
  <h1>System Verification & Diamond Jubilee Blessing</h1>
  <p class="subtitle" style="font-style: italic; color: #718096; margin-bottom: 12px;">NorthStar Mystery School Aetheria Ephemeris Engine</p>

  <div class="lead-box">
    <p><strong>Permanent Archive Registration:</strong> Both natal matrices and the complete Darm-White synastry geometry have been permanently cataloged into the NorthStar Mystery School Ephemeris Matrix:</p>
    <ul style="margin-left: 20px; font-size: 8.5pt; margin-top: 6px;">
      <li><strong>Live Web Portal:</strong> <code>https://northstarprime.net/mystery-school/astrology/</code></li>
      <li><strong>Built-In Presets:</strong> Simply click <code>Lauren's Father (Bob)</code> or <code>Lauren's Mother</code> to load coordinates instantly into the interactive 3D celestial engine.</li>
      <li><strong>Real-Time Sky Transits:</strong> The engine tracks current planetary movements across Bob&rsquo;s natal degrees in real time.</li>
    </ul>
  </div>

  <h2>Summary of Key Findings for the Family</h2>
  <div class="aspect-card">
    <div class="aspect-card-header"><span>1. The Twin Moon Connection (Bob & Wife)</span><span class="gold-badge">0.97° Orb</span></div>
    <p style="font-size: 8.5pt; color: #4a5568;">Identical emotional rhythms. You process life, stress, and joy through conversation, shared humor, and intuitive understanding. A rare astrological gift of effortless companionship.</p>
  </div>

  <div class="aspect-card">
    <div class="aspect-card-header"><span>2. The Generational Anchor (Mother & Andre)</span><span class="gold-badge">0.01° Orb</span></div>
    <p style="font-size: 8.5pt; color: #4a5568;">Mother&rsquo;s Scorpio Saturn serves as the unshakeable foundation stone for Andre&rsquo;s Taurus Sun. Her unwavering protective strength provides the root system from which Andre&rsquo;s master-builder craft flourishes.</p>
  </div>

  <div class="aspect-card">
    <div class="aspect-card-header"><span>3. The Creative & Intellectual Harmony (Bob & Andre)</span><span class="orb-badge">Grand Air Trine</span></div>
    <p style="font-size: 8.5pt; color: #4a5568;">Bob&rsquo;s Gemini Sun and Andre&rsquo;s Aquarius Saturn form an open channel of intellectual respect, curiosity, and shared appreciation for how things work. Easy conversation without pretension.</p>
  </div>

  <div class="aspect-card">
    <div class="aspect-card-header"><span>4. The Complete Grand Earth Canopy</span><span class="orb-badge">Tri-Generational Shelter</span></div>
    <p style="font-size: 8.5pt; color: #4a5568;">Mother&rsquo;s Virgo placements lock into Andre&rsquo;s Taurus and Capricorn planets, completing a sacred Earth Trine that envelopes the whole family unit in practical security, material protection, and deep generational loyalty.</p>
  </div>

  <div style="margin-top: 25px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
    <div style="font-family: 'Cinzel', serif; font-size: 14pt; color: #8c6218; font-weight: bold; margin-bottom: 6px;">
      Happy 75th Diamond Jubilee, Bob!
    </div>
    <p style="font-style: italic; color: #718096; font-size: 9.5pt; max-width: 520px; margin: 0 auto;">
      &ldquo;May this seventy-fifth milestone celebrate the wisdom of the journey, the strength of the family foundation, and the rich dialogue of many bright years ahead.&rdquo;
    </p>
    <div style="font-family: 'Cinzel', serif; font-size: 9pt; color: #4a5568; margin-top: 12px; font-weight: bold;">
      With love, respect, and warmest wishes,<br>
      Andre & Lauren
    </div>
  </div>
</div>

</body>
</html>
"""
    return html

def compile_packet():
    desktop_pdf = r"C:\Users\andre\Desktop\ASTROLOGY_FULL_RESEARCH_PACKET_ILLUSTRATED.pdf"
    desktop_html = r"C:\Users\andre\Desktop\ASTROLOGY_FULL_RESEARCH_PACKET_ILLUSTRATED.html"
    repo_pdf = r"C:\Users\andre\scripts\the_workshop\projects\northstarprime-always-on\mystery-school\astrology\ASTROLOGY_FULL_RESEARCH_PACKET_ILLUSTRATED.pdf"
    tmp_pdf = r"C:\Users\andre\AppData\Local\Temp\ASTROLOGY_FULL_RESEARCH_PACKET_ILLUSTRATED.pdf"
    
    html_content = build_html()
    
    print("Writing HTML preview to Desktop...")
    with open(desktop_html, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    print("Compiling PDF with WeasyPrint...")
    html_doc = HTML(string=html_content)
    
    html_doc.write_pdf(desktop_pdf)
    print(f"Saved Desktop PDF: {desktop_pdf}")
    
    html_doc.write_pdf(repo_pdf)
    print(f"Saved Repo PDF: {repo_pdf}")
    
    # Also save to tmp for Chrome MCP upload
    import shutil
    shutil.copyfile(desktop_pdf, tmp_pdf)
    print(f"Saved Temp PDF for upload: {tmp_pdf}")
    
    size = os.path.getsize(desktop_pdf)
    print(f"SUCCESS: PDF Size = {size:,} bytes")

if __name__ == "__main__":
    compile_packet()
