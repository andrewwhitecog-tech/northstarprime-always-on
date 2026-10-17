# BUILD — Flash + assemble

Skill: beginner–intermediate. Read [SAFETY.md](SAFETY.md) first (LiPo + strobe).

---

## Hardware prep (both paths)

1. Identify your board:
   - **Circuit Playground Express** or **Bluefruit** → use **CircuitPython** (primary).
   - **Circuit Playground Classic** (ATmega32u4) → use **Arduino** path (alt).
2. Parts: board + optional NeoPixel strip + protected LiPo + charger (see [BOM.md](BOM.md)).
3. External strip wiring (same for both firmwares):

| Strip wire | Board pad |
|---|---|
| Data (DIN) | **A1** |
| GND | **GND** |
| 5V / V+ | **VOUT** (battery power for >8 pixels — **not** USB-only) |

4. Default firmware assumes **30** external pixels. Change `EXTERNAL_NUM_PIXELS` / `EXT_NUM` to match your strip.
5. For helmet / costume use: secure the board and strip so connectors cannot short; keep LiPo in a protected pocket (puncture + thermal barrier). Skin contact with hot epoxy or bare cells is a hard no — see SAFETY.

### Temporary mount (until enclosure STL exists)

- Soft mount: Velcro / gaffer on helmet brim, or zip-tie a 3D-printed flat disc (~55 mm) with USB and JST clearance.
- Pendant experiment: disc / rough shell with lanyard holes; optional clear resin diffuser over LEDs after **full cure**.
- Do not ship unvalidated CAD as if official.

---

## Path A — CircuitPython (PRIMARY)

### A1. Install CircuitPython

1. Download the UF2 for your board:
   - Express: https://circuitpython.org/board/circuitplayground_express/
   - Bluefruit: https://circuitpython.org/board/circuitplayground_bluefruit/
2. Double-click the board’s **RESET** button to enter the bootloader (USB drive named something like `CPLAYBOOT` / `FTHR840BOOT` appears).
3. Drag the `.uf2` onto that drive; board reboots as **CIRCUITPY**.

### A2. Libraries

See [firmware/circuitpython/DEPENDENCIES.md](firmware/circuitpython/DEPENDENCIES.md).

Install from the [Adafruit CircuitPython Bundle](https://circuitpython.org/libraries) into `CIRCUITPY/lib/`:

- `adafruit_circuitplayground/` (and its dependencies as listed in the bundle)
- `neopixel.mpy` (or `neopixel` package)

Many Circuit Playground CircuitPython builds already include the Circuit Playground helper; still verify `import` works.

### A3. Flash the kit firmware

1. Copy `firmware/circuitpython/code.py` to the **root** of `CIRCUITPY` (overwrite any existing `code.py`).
2. Board auto-reloads. Onboard pixels should animate Mode 0 (Vorathic Cascade).
3. Serial (optional): open the CircuitPython REPL / serial console for mode name prints.

### A4. Controls smoke test

| Input | Expected |
|---|---|
| Button **A** | Advance mode; brief white flash |
| **Shake** | Advance mode (after cooldown) |
| Slide switch **LEFT** | Quiet brightness (~15%) |
| Slide switch **RIGHT** | Bright (~70%) |

Walk all 7 modes — see [MODE_GUIDE.md](MODE_GUIDE.md).

---

## Path B — Arduino Classic (ALT)

For **Circuit Playground Classic** only (or if you prefer Arduino IDE on Classic).

### B1. Arduino IDE setup

1. Install Arduino IDE.
2. Install board support for Adafruit Circuit Playground (Classic).
3. Library Manager — install:
   - **Adafruit Circuit Playground**
   - **Adafruit NeoPixel**
4. Board menu: **Adafruit Circuit Playground**  
   Port: your COM / tty port.

### B2. Flash

1. Open `firmware/arduino/helmet_light.ino`.
2. Adjust `#define EXT_NUM` if your strip ≠ 30.
3. Upload.
4. Open Serial Monitor at **115200** for mode names.

### B3. Controls

Same UX: left button = Button A cycle; shake advances; slide switch brightness (LEFT quiet / RIGHT bright on Classic firmware matching source behavior).

---

## Wear / festival tips

- Prefer **quiet** switch setting for indoor / sensitive venues; Festival Strobe is intense — warn nearby people with photosensitivity.
- Battery: charge with the proper LiPo charger; never leave charging unattended on fabric / foam helmets.
- Secure wiring against dance / flow movement; strain-relieve the strip data line at A1.
- This is a **glow art accessory**, not PPE, not medical gear.

## Done when

- All 7 modes run
- Brightness switch works
- Strip (if attached) matches onboard animation
- You’ve read SAFETY and removed any health-claim language from your own listing drafts
