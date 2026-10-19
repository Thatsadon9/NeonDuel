"""
Generates docs/UPDATE_ASSET_PROMPTS.md + docs/update_asset_prompts.json for the ASCENSION update
from one data table (names / sizes / colours stay consistent with docs/UPDATE_ASCENSION.md).

    python3 tools/gen_update_prompts.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_MD = os.path.join(ROOT, "docs", "UPDATE_ASSET_PROMPTS.md")
OUT_JSON = os.path.join(ROOT, "docs", "update_asset_prompts.json")
OUT_NAMES = os.path.join(ROOT, "src", "assets", "update_names.json")  # tiny list the game bundles (gallery / name checks)

# ------------------------------------------------------------------ style bible (same as ART_PROMPTS.md)
STYLE = (
    "Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, "
    "deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), "
    "high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp"
)
VIEW = (
    "strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, "
    "the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it"
)
FLAT = "flat lay seen directly from above, object pointing horizontally to the RIGHT, centered"
BG_WHITE = "isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment"
BG_BLACK = "on a pure solid black background (#000000), nothing else in the image"
NEG = ("text, letters, watermark, signature, logo, UI, frame, border, isometric view, side view, front view, 3/4 view, perspective, "
       "floor, ground, cast shadow, scenery, multiple characters, cropped, cut off, blurry, photorealistic, 3D render, gradient background, "
       "colorful body, rainbow, extra limbs")
NEG_VFX = "text, watermark, character, person, object, background scenery, gradient background, frame, border, color noise"

# tier ladder — the visual promise of the update
TIER = {
    "t0": ("WORN", "a worn, rusted, chipped and plain version, cloth wraps fraying, desaturated grey-brown iron and old wood, absolutely NO glow and NO neon"),
    "t1": ("TEMPERED", "a clean freshly forged version, polished dark steel, sharp edges, only ONE faint thin {c} light line along the edge"),
    "t2": ("AWAKENED", "an awakened neon version, bright {c} neon edge lines and a glowing energy core, sleek and powerful"),
    "t3": ("ASCENDED", "an ascended elemental form wreathed in {e}, {c} elemental energy flowing along it, ornate engravings, clearly more powerful"),
    "t4": ("MYTHIC", "a mythic legendary final form, majestic and larger, ornate gold-and-white filigree combined with radiant {c} energy, a divine aura and floating ornaments, the most impressive version"),
}

items = []
sheets = []


def add(file, group, prio, size, bg, prompt, negative=NEG, note=""):
    items.append(dict(file=file, group=group, prio=prio, size=size, bg=bg, prompt=prompt, negative=negative, note=note))


def char(file, group, prio, size, subject, accent, pose, note=""):
    add(file, group, prio, size, "white → ลบพื้นหลัง",
        f"{subject}, {pose}. {VIEW}. {STYLE}. Neon accent color: {accent} only. {BG_WHITE}.", NEG, note)


def obj(file, group, prio, size, subject, accent=None, note="", bg="white"):
    acc = f"Neon accent color: {accent}. " if accent else ""
    add(file, group, prio, size, "white → ลบพื้นหลัง" if bg == "white" else "black (ไม่ต้องลบ)",
        f"{subject}. {FLAT}. {STYLE}. {acc}" + (BG_WHITE if bg == "white" else BG_BLACK) + ".", NEG.replace(", extra limbs", ""), note)


def vfx(file, prio, size, subject, color="pure white and light grey only, monochrome", note="ขาว/เทาบนดำ — เกมย้อมสีและวาดแบบบวกแสง ไม่ต้องลบพื้นหลัง", group="VFX"):
    add(file, group, prio, size, "black (ไม่ต้องลบ)",
        f"2D game visual effect sprite: {subject}. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, {color}, {BG_BLACK}, centered, high contrast, top-down view",
        NEG_VFX, note)


def ui(file, group, prio, size, subject, note="", bg="black", view=True):
    add(file, group, prio, size, "white → ลบพื้นหลัง" if bg == "white" else "black/ทึบ ใช้ได้เลย",
        f"{subject}. {STYLE}. " + (BG_WHITE if bg == "white" else BG_BLACK) + ".", "watermark, signature, blurry, photorealistic, low contrast, text", note)


# ------------------------------------------------------------------ 1. WEAPON FAMILIES
FAMILIES = [
    # id, name, color, size, size_t4, base object, forms {form: (name, extra description, element, path color)}
    ("katana", "Katana", "#7ff6ff electric cyan", "140×24", "160×32",
     "a slender curved katana, handle and guard on the LEFT end, blade tip on the RIGHT",
     {"t0": ("Rusted Katana", "chipped rusty blade, frayed cloth-wrapped handle", None, None),
      "t1": ("Tempered Katana", "polished steel blade, simple round guard", None, None),
      "t2": ("Neon Katana", "neon cyan cutting edge (ALREADY EXISTS as weapon_katana.png)", None, None),
      "t3a": ("RAIJIN", "lightning crackling along the edge, a lightning-ring shaped guard", "lightning", "#5ad8ff bright electric blue"),
      "t3b": ("YAMI", "pitch-black blade with a violet void edge, wisps of dark smoke trailing", "void shadow", "#9d5bff deep violet"),
      "t4a": ("TAKEMIKAZUCHI", "longer divine thunder-god katana, gold and electric blue, small floating lightning rings around the hilt", "divine lightning", "#5ad8ff electric blue and gold"),
      "t4b": ("TSUKUYOMI", "translucent blade showing a starry night sky inside, crescent-moon guard", "moonlight and starry void", "#9d5bff violet and silver-white")}),
    ("daggers", "Twin Fangs", "#ff4d8a hot pink", "72×56", "84×64",
     "a pair of twin curved daggers placed side by side horizontally (one above the other), handles on the LEFT, tips on the RIGHT",
     {"t0": ("Bent Knives", "two bent kitchen knives with cracked wooden handles", None, None),
      "t1": ("Paired Stilettos", "two sharp polished steel stilettos", None, None),
      "t2": ("Twin Fangs", "hot pink neon edges (ALREADY EXISTS as weapon_daggers.png)", None, None),
      "t3a": ("VENOM", "serrated blades dripping green venom, snake-shaped handles", "toxic venom", "#7dff4d toxic green"),
      "t3b": ("PHANTOM", "translucent glass-like blades with ghostly afterimages", "phantom illusions", "#c9b8ff pale lavender"),
      "t4a": ("HYDRA FANGS", "three-pronged hydra-fang daggers glowing with venom, scale patterns", "hydra venom", "#7dff4d toxic green and gold"),
      "t4b": ("MIRAGE FANGS", "floating crystal daggers each followed by two layered shadow echoes", "mirage light", "#c9b8ff lavender and white")}),
    ("hammer", "Graviton", "#ffb347 molten amber", "120×64", "140×80",
     "a heavy war hammer, long shaft with the handle on the LEFT and the hammer head on the RIGHT end",
     {"t0": ("Iron Maul", "rusty iron sledgehammer with a cracked wooden shaft", None, None),
      "t1": ("Forged Hammer", "forged steel hammer head with gold-trimmed edges", None, None),
      "t2": ("Graviton", "amber energy core in the head (ALREADY EXISTS as weapon_hammer.png)", None, None),
      "t3a": ("MAGMA", "volcanic rock hammer head with glowing lava cracks", "magma and fire", "#ff5a1f lava orange"),
      "t3b": ("SINGULARITY", "hammer head is a black sphere with a spinning ring of light", "gravity and black hole", "#b06bff purple"),
      "t4a": ("RAGNAROK MAUL", "colossal molten hammer with a tiny smoking volcano on the head", "apocalyptic fire", "#ff5a1f lava orange and gold"),
      "t4b": ("COLLAPSE", "a true black hole at the hammer head with light bending around it", "collapsing space", "#b06bff purple and white")}),
    ("scythe", "Reaper Chain", "#3dffb0 emerald", "150×90", "170×100",
     "a chain-scythe: a curved scythe blade on the RIGHT attached to a short handle on the LEFT, with a coiled chain",
     {"t0": ("Field Sickle", "rusty farm sickle tied to a hemp rope", None, None),
      "t1": ("Iron Scythe", "iron scythe blade on a steel chain", None, None),
      "t2": ("Reaper Chain", "emerald neon scythe edge and glowing chain links", None, None),
      "t3a": ("HARVEST", "harvest-moon shaped blade with glowing souls orbiting it", "souls", "#9dff6b soul green"),
      "t3b": ("WRAITH", "ghostly translucent chains, blade shaped like half a skull", "spectral wraith energy", "#7fb8ff ghost blue"),
      "t4a": ("THANATOS", "double death scythe with bone wings at the handle", "death and souls", "#9dff6b soul green and gold"),
      "t4b": ("BANSHEE", "screaming scythe whose blade is a frozen sound wave", "spectral sound", "#7fb8ff ghost blue and white")}),
    ("gauntlets", "Pulse Gauntlets", "#ff7a3c electric orange", "64×56", "80×64",
     "a pair of combat gauntlets placed side by side (one above the other), fists pointing to the RIGHT",
     {"t0": ("Wrapped Knuckles", "blood-stained cloth hand wraps", None, None),
      "t1": ("Steel Knuckles", "steel knuckle guards over leather gloves", None, None),
      "t2": ("Pulse Gauntlets", "mechanical gauntlets with orange energy cores", None, None),
      "t3a": ("TITAN", "thick armored gauntlets with rock-scale plating", "earth and stone", "#ffb347 amber"),
      "t3b": ("TEMPEST", "sleek gauntlets with small turbine fans spinning at the wrists", "wind", "#7dfff0 wind cyan"),
      "t4a": ("ATLAS", "mountain-sized fists with a planetary ring orbiting each", "cosmic stone", "#ffb347 amber and gold"),
      "t4b": ("FUJIN", "wind-god gauntlets with flowing wind ribbons and a wind bag motif", "divine storm wind", "#7dfff0 cyan and white")}),
    ("bow", "Lightbow", "#ffd24d golden", "72×120", "84×140",
     "a bow seen from above: the bow arc is vertical on the LEFT, the bowstring on the left, an arrow nocked pointing to the RIGHT",
     {"t0": ("Hunter's Bow", "plain wooden hunting bow with a frayed string", None, None),
      "t1": ("Recurve Bow", "recurve bow reinforced with steel tips", None, None),
      "t2": ("Lightbow", "golden neon bow with a string made of light", None, None),
      "t3a": ("STARFALL", "comet-shaped bow with small stars at the tips", "falling stars", "#ffe14d star gold"),
      "t3b": ("PRISM", "crystal bow splitting light into rainbow refractions", "prismatic light", "rainbow prism (white core)"),
      "t4a": ("ASTRAEA", "star-goddess bow with wings of light on the limbs", "constellations", "#ffe14d gold and white"),
      "t4b": ("SPECTRA", "hexagonal crystal bow whose arrow is a rainbow beam", "spectral rainbow light", "rainbow and white")}),
]
PATH_NAMES = {}
for fid, fname, color, size, size4, base, forms in FAMILIES:
    group = f"Weapons: {fname}"
    for form, (fname2, extra, element, pcolor) in forms.items():
        tier = form[:2]
        label, ladder = TIER[tier]
        c = pcolor or color
        ladder = ladder.format(c=c, e=element or "")
        prio = 0 if tier in ("t0", "t1") else 1 if tier in ("t2", "t3") else 2
        if fid in ("scythe", "gauntlets", "bow"):
            prio = 1 if tier in ("t0", "t1", "t2") else 2
        if form == "t2" and fid in ("katana", "daggers", "hammer"):
            continue  # already exists in the game (weapon_<id>.png)
        sz = size4 if tier == "t4" else size
        pivot = "จุดหมุน = ด้ามจับซ้ายสุด" if fid != "bow" else "จุดหมุน = ด้ามจับกลางคันธนูด้านซ้าย"
        obj(f"weapon_{fid}_{form}.png", group, prio, sz,
            f"{base}. {label} TIER weapon \"{fname2}\": {extra}. This is {ladder}",
            None, f"{pivot} · ร่าง {fname2}")
        if form.startswith("t3") or form.startswith("t4"):
            PATH_NAMES[f"{fid}_{form}"] = (fname2, pcolor, element)
    # evolution sheet (consistency!)
    row = "; ".join(f"({i+1}) {TIER[f[:2]][0]} {n}: {d}" for i, (f, (n, d, e, pc)) in enumerate(forms.items()))
    sheets.append((f"วิวัฒนาการ {fname} — 7 ร่างในภาพเดียว", f"weapon_{fid}_*",
                   f"A weapon evolution chart: the SAME weapon drawn 7 times in one horizontal row with equal spacing, each pointing to the RIGHT, flat lay seen from above, "
                   f"on a pure white background, growing more powerful from left to right. Base weapon: {base}. Stages: {row}. "
                   f"Stage 1 has no glow at all, stage 2 one faint line, stage 3 neon {color}, stages 4-5 are two different elemental branches, stages 6-7 are their mythic final forms. {STYLE}."))

# weapon form icons
for fid, fname, color, size, size4, base, forms in FAMILIES:
    for form, (fname2, extra, element, pcolor) in forms.items():
        tier = form[:2]
        c = pcolor or color
        glow = "no glow, dull rusty grey" if tier == "t0" else f"faint {c} glint" if tier == "t1" else f"bright {c} neon glow"
        ui(f"icon_weapon_{fid}_{form}.png", "Weapon form icons", 1 if tier in ("t0", "t1", "t2") else 2, "64×64",
           f"a square game inventory icon of the {fname2} ({base.split(',')[0]}), drawn diagonally, bold ink silhouette, {glow}, centered, readable at small size")
sheets.append(("ไอคอนร่างอาวุธ (ตระกูลละ 1 ภาพ 7 ช่อง)", "icon_weapon_<family>_*",
               "A row of 7 square game inventory icons of the SAME weapon evolving from a rusty plain version (no glow) to a mythic golden-neon version, "
               "evenly spaced on a pure black background, each drawn diagonally, bold ink silhouettes with increasing neon glow. "
               "Replace <WEAPON> with the family description from the weapon section. " + STYLE + "."))

# path / mythic illustrations (selection cards + codex)
for key, (name, pcolor, element) in PATH_NAMES.items():
    fid, form = key.split("_")
    kind = "mythic" if form.startswith("t4") else "path"
    add(f"art_{kind}_{fid}_{form[2]}.png", "Path & Mythic art", 2 if kind == "mythic" else 1, "560×280", "black/ทึบ ใช้ได้เลย",
        f"A wide dramatic showcase illustration (side view, NOT top-down) of the legendary weapon \"{name}\" floating at the center, surrounded by {element}, "
        f"{pcolor} glow, ink splash composition, epic and majestic, {'divine radiant aura, gold filigree' if kind == 'mythic' else 'elemental energy swirling'}. {STYLE}. {BG_BLACK}.",
        "text, watermark, signature, character, hands, blurry, photorealistic", "ใช้บนการ์ดเลือกสาย (T3) / หน้า Codex (T4)")

# ------------------------------------------------------------------ 2. PLAYER POSES
PLAYER = ("a lone ronin duelist, lean athletic build, short hooded cowl, a long ink scarf flowing behind, light lacquered shoulder plates, "
          "glowing cyan visor slit across the eyes")
for name, pose in [
    ("attack_punch", "throwing a straight punch with the right fist fully extended forward to the right, left fist guarding"),
    ("attack_sweep", "mid wide sweeping swing with both arms extended to the right as if swinging a chain-scythe, torso twisted"),
    ("aim_bow", "drawing a bow: left arm extended forward to the right holding the bow, right hand pulled back to the cheek"),
    ("shoot_bow", "just released an arrow: left arm forward, right hand open and flung back, scarf whipping"),
    ("grapple", "being pulled forward by a chain, body stretched horizontally to the right, one arm extended holding the chain"),
    ("counter", "explosive counter-punch pose, body low, fist driven forward to the right, shockwave stance"),
]:
    char(f"player_{name}.png", "Player (new poses)", 1, "96×96 ต่อเฟรม", PLAYER, "#7ff6ff electric cyan", pose,
         "มือว่าง (อาวุธเป็นสไปรต์แยก)")

# ------------------------------------------------------------------ 3. ENEMIES
STATES = [("idle", "standing alert"), ("move", "moving forward to the right"), ("windup", "winding up an attack, body pulled back and tense, accent glow brighter"),
          ("attack", "attacking forward to the right, body fully extended"), ("hurt", "flinching backwards from a hit"),
          ("death", "destroyed and collapsed seen from above, breaking into ink fragments")]
ENEMIES = [
    ("swarmling", "48×48", "#ff7a3c ember orange", "a tiny fast insect-like ink creature with six sharp legs and glowing ember eyes", 1),
    ("wraith", "80×80", "#9fe8ff pale ghost cyan", "a hooded floating wraith with a tattered cloak dissolving into smoke, long claw hands, half-transparent lower body", 1),
    ("lancer", "110×110", "#ffd24d gold", "an armored lancer soldier holding a very long lance pointing to the right and a small round shield", 1),
    ("acolyte", "90×90", "#b98cff violet", "a robed rift acolyte priest holding a glowing staff with a floating rune orb", 1),
    ("sentry", "110×110", "#ff2d4a red", "a stationary mechanical laser turret on a tripod base, single glowing red lens pointing right", 2),
    ("broodmother", "130×130", "#7dff4d toxic green", "a bloated insect broodmother with an egg sac abdomen glowing green, many legs", 2),
    ("brute", "170×170", "#ff4d4d blood red", "a huge hulking brute with massive arms and a slab-like armored front, chains on the wrists", 2),
    ("mirror_shard", "80×80", "#ffffff white", "a floating humanoid made of sharp mirror shards reflecting light, faceless", 2),
]
for eid, size, col, subj, prio in ENEMIES:
    for st, pose in STATES:
        char(f"enemy_{eid}_{st}.png", "Enemies (new)", prio if st == "idle" else 2, f"{size} ต่อเฟรม", subj, col, pose)
sheets.append(("ศัตรูใหม่ 8 ตัว (lineup)", "enemy_*_idle",
               "A lineup sheet of 8 different enemy creatures in one row with equal spacing, strict top-down orthographic view, all facing right, on a pure white background: "
               + "; ".join(f"({i+1}) {s} with {c} accents" for i, (_, _, c, s, _) in enumerate(ENEMIES)) + f". {STYLE}."))
obj("icon_elite_crown.png", "Enemies (new)", 1, "40×32", "a small floating gold crown with three spikes, seen from above", "#ffe14d gold", "ลอยเหนือศัตรู Elite")

# ------------------------------------------------------------------ 4. BOSSES
B_STATES = [("idle", "standing in a commanding idle stance"), ("move", "advancing to the right"),
            ("windup", "winding up a powerful attack, body coiled, accent glow intensified"), ("attack", "unleashing an attack forward to the right, fully extended"),
            ("stagger", "staggered and off-balance, posture broken, dazed, armor cracked, leaning backwards"),
            ("death", "defeated and shattered seen from above, body breaking apart into ink shards and fading glow")]
BOSSES = [
    ("nyxara", "Boss: Nyxara", "200×200", "#7dff4d toxic green", "#d4ff3d acid yellow-green",
     "NYXARA THE BLIGHT QUEEN — a queen made of twisted black roots and thorns, a crown of glowing mushrooms, wide root-skirt spreading on the ground, four thorn tendrils"),
    ("tempus", "Boss: Tempus", "170×170", "#ffd24d brass gold", "#7ff6ff cyan",
     "TEMPUS THE CHRONO ARBITER — a tall robed arbiter with a clockwork halo of gears behind the head, an hourglass embedded in the chest, two clock-hand blades"),
    ("kagutsuchi", "Boss: Kagutsuchi", "160×160", "#ff5a1f flame orange", "#ffe14d white-hot gold",
     "KAGUTSUCHI THE ASHEN WARLORD — a samurai warlord in charred black armor with an oni mask, a huge burning odachi sword, embers rising from the armor"),
    ("hollow", "Boss: Hollow King", "180×180", "#e8e8ff pale silver", "#ffe14d gold",
     "THE HOLLOW KING — a hollow armored king with an empty void inside the helmet, a floating golden crown above, a long greatsword, tattered royal cape"),
    ("sentinel", "Boss: Rift Sentinel", "150×150", "#7ff6ff cyan", "#7ff6ff cyan",
     "RIFT SENTINEL — a floating statue knight of cracked stone with glowing rift seams, no legs, a halo ring behind, arms holding a stone blade"),
]
for bid, group, size, col, col2, subj in BOSSES:
    for st, pose in B_STATES:
        char(f"boss_{bid}_{st}.png", group, 1 if st == "idle" else 2, f"{size} ต่อเฟรม", subj, col, pose)
    if bid != "sentinel":
        char(f"boss_{bid}_idle_p2.png", group, 2, f"{size} ต่อเฟรม", subj + ", PHASE 2 enraged form: cracked and corrupted, leaking light, aura flames",
             col2, B_STATES[0][1], "ร่างเฟส 2")
# boss-specific parts
char("boss_nyxara_rooted.png", "Boss: Nyxara", 1, "200×200", BOSSES[0][5] + ", her lower body fused into a huge spreading root system", "#7dff4d toxic green", "rooted in place, arms raised, commanding the tendrils", "เฟส 1 (หยั่งราก)")
obj("boss_nyxara_tendril.png", "Boss: Nyxara", 1, "160×40", "a single thorny black root tendril segment with glowing green veins, pointing right", "#7dff4d toxic green", "ต่อกันเป็นเถาวัลย์")
obj("boss_nyxara_pod.png", "Boss: Nyxara", 1, "64×64", "a closed spore pod seen from above, black husk with faint green veins", "#7dff4d toxic green")
obj("boss_nyxara_pod_ripe.png", "Boss: Nyxara", 1, "64×64", "a swollen spore pod about to burst, glowing bright green cracks", "#d4ff3d acid yellow-green")
obj("boss_tempus_hourglass.png", "Boss: Tempus", 1, "64×96", "an ornate brass hourglass with glowing golden sand, seen from the front", "#ffd24d gold", "จุดอ่อนตอน Rewind")
obj("boss_tempus_hand.png", "Boss: Tempus", 1, "600×40", "a giant ornate clock hand blade, pivot at the LEFT end, tip on the RIGHT, engraved brass with a cyan glowing edge", "#7ff6ff cyan", "เข็มนาฬิกาเลเซอร์เฟส 2 (จุดหมุนซ้าย)")
char("boss_voltaris_head_idle.png", "Boss: Voltaris", 1, "160×160", "the head of VOLTARIS THE STORM SERPENT — a giant serpent dragon head with lightning horns, open jaws, storm whiskers", "#5ad8ff electric blue", "head facing right, mouth slightly open")
for st, pose in [("windup", "rearing back, jaws opening, lightning gathering in the mouth"), ("attack", "jaws wide open breathing a lightning stream to the right"),
                 ("stagger", "dazed on the ground, lightning flickering out"), ("death", "shattering into storm clouds and ink shards"), ("idle_p2", "PHASE 2: crackling with white lightning, eyes blazing white")]:
    char(f"boss_voltaris_head_{st}.png", "Boss: Voltaris", 2, "160×160", "the head of VOLTARIS THE STORM SERPENT — a giant serpent dragon head with lightning horns", "#5ad8ff electric blue", pose)
obj("boss_voltaris_body.png", "Boss: Voltaris", 1, "140×110", "one segment of a giant serpent's body seen from above, scaled black armor plates with blue lightning seams", "#5ad8ff electric blue", "ปล้องลำตัว (ใช้ซ้ำ 8 ปล้อง)")
obj("boss_voltaris_body_weak.png", "Boss: Voltaris", 1, "140×110", "one segment of a giant serpent's body seen from above with an exposed glowing crystal weak point", "#ffffff white-hot", "ปล้องจุดอ่อน")
obj("boss_voltaris_tail.png", "Boss: Voltaris", 1, "140×80", "the tapering tail tip of a giant serpent seen from above, ending in a lightning-bolt fin, pointing LEFT", "#5ad8ff electric blue")
for stance, desc in [("iai", "IAI STANCE: sword sheathed at the hip, hand on the hilt, calm and coiled"), ("inferno", "INFERNO STANCE: burning odachi raised high, flames roaring around the body")]:
    char(f"boss_kagutsuchi_idle_{stance}.png", "Boss: Kagutsuchi", 1, "160×160", BOSSES[2][5], "#ff5a1f flame orange", desc)
obj("boss_hollow_hand.png", "Boss: Hollow King", 1, "300×300", "a giant armored gauntlet hand of a hollow king, open palm slamming down, seen from above, void glowing between the plates", "#e8e8ff silver and gold", "เฟส 3 (มือยักษ์ ใช้ซ้าย/ขวาด้วยการกลับภาพ)")
obj("boss_hollow_crown.png", "Boss: Hollow King", 1, "140×140", "a large floating golden crown seen from above with a void core in the middle", "#ffe14d gold", "แกนมงกุฎเฟส 3")
obj("boss_hollow_crown_open.png", "Boss: Hollow King", 1, "140×140", "a large floating golden crown seen from above, its void core cracked open and glowing brightly (vulnerable)", "#ffffff white-hot", "จังหวะตีได้")
char("boss_sentinel_pulse_idle.png", "Boss: Rift Sentinel", 1, "150×150", BOSSES[4][5].replace("holding a stone blade", "holding a pulsing energy orb between both hands"), "#ff4dcf magenta", "standing in a commanding idle stance", "แบบ Pulse Sentinel")
sheets.append(("บอสใหม่ (lineup)", "boss_*_idle",
               "A lineup sheet of 5 boss characters in one row, strict top-down orthographic view, all facing right, on a pure white background: "
               + "; ".join(f"({i+1}) {s} with {c} accents" for i, (_, _, _, c, _, s) in enumerate(BOSSES)) + f". {STYLE}."))
for bid, group, size, col, col2, subj in BOSSES:
    add(f"portrait_{bid}.png", "Portraits", 1, "640×640", "white → ลบพื้นหลัง",
        f"a dramatic boss portrait bust (front view, this one is NOT top-down): {subj}, intense ink brushwork, menacing, upper body, facing slightly right, {col} glow. {STYLE}. {BG_WHITE}.",
        "watermark, signature, blurry, photorealistic, low contrast, text", "ภาพเปิดตัวบอส")
add("portrait_voltaris.png", "Portraits", 1, "640×640", "white → ลบพื้นหลัง",
    f"a dramatic boss portrait (front view, NOT top-down): VOLTARIS THE STORM SERPENT, a colossal serpent dragon coiling with lightning horns and storm clouds, menacing, #5ad8ff electric blue glow. {STYLE}. {BG_WHITE}.",
    "watermark, signature, blurry, photorealistic, low contrast, text", "ภาพเปิดตัวบอส")

# ------------------------------------------------------------------ 5. PROJECTILES & PICKUPS
obj("proj_arrow.png", "Projectiles & pickups", 1, "48×12", "a single slim arrow flying to the right, white shaft with grey shading", None, "ขาว/เทา — เกมย้อมสี (ลบพื้นหลัง)")
vfx("proj_arrow_charged.png", 1, "96×32", "a charged piercing light arrow streaking to the right with a long glowing trail", group="Projectiles & pickups")
vfx("proj_prism_shard.png", 2, "40×40", "a small sharp prismatic crystal shard splitting light", "white core with subtle rainbow edges", group="Projectiles & pickups", note="ใช้สีในภาพ ไม่ต้องลบพื้นหลัง")
vfx("proj_meteor_arrow.png", 2, "64×64", "a falling meteor arrow seen from above, a burning star head with a short tail", "gold and white", group="Projectiles & pickups", note="ใช้สีในภาพ")
obj("proj_hook.png", "Projectiles & pickups", 1, "40×32", "a sharp grappling hook head pointing to the right, curved barbs", "#3dffb0 emerald", "หัวตะขอ Reaper Chain")
obj("proj_chain_link.png", "Projectiles & pickups", 1, "24×12", "a single chain link seen from above, horizontal", "#3dffb0 emerald", "เกมต่อกันเป็นโซ่")
vfx("proj_spore.png", 1, "40×40", "a floating toxic spore puff with tiny particles", "toxic green", group="Projectiles & pickups", note="ใช้สีในภาพ")
vfx("proj_time_orb.png", 1, "48×48", "a golden time orb with a tiny clock face and ticking hands inside", "brass gold and cyan", group="Projectiles & pickups", note="ใช้สีในภาพ")
vfx("proj_lightning_orb.png", 2, "48×48", "a crackling ball of lightning", group="Projectiles & pickups")
vfx("proj_fire_wave.png", 2, "120×120", "a crescent wave of fire moving to the right, convex side facing right", "orange and white-hot", group="Projectiles & pickups", note="ใช้สีในภาพ")
vfx("pickup_soul.png", 1, "32×32", "a small glowing soul wisp with a flickering tail", "pale green-white", group="Projectiles & pickups", note="ดรอปจากสาย Harvest")
add("pickup_rift_core.png", "Projectiles & pickups", 0, "48×48", "white → ลบพื้นหลัง",
    f"a glowing rift core crystal: a faceted dark crystal with a swirling neon rift inside, cyan and magenta light leaking out, seen from above. {STYLE}. {BG_WHITE}.",
    "text, watermark, background", "ดรอปจากบอส — ใช้เลื่อนขั้น T3/T4")
add("pickup_echo_shard.png", "Projectiles & pickups", 1, "32×32", "white → ลบพื้นหลัง",
    f"a small sharp echo shard: a thin violet glass sliver glowing softly, seen from above. {STYLE}. {BG_WHITE}.", "text, watermark, background", "สกุลเงิน Codex")

# ------------------------------------------------------------------ 6. SKILL VFX
SKILL_VFX = [
    # (id, prio, size, subject, color)
    ("hook_pull", 1, "256×64", "a taut glowing chain streak pulling from left to right with motion lines", None),
    ("iron_guard", 1, "160×160", "a hexagonal energy barrier of fists and light in front (right side) of the center", None),
    ("volley", 1, "256×256", "a fan of nine light arrows spreading to the right", None),
    ("thunderclap", 2, "256×256", "a lightning blink-slash: a jagged lightning cut line with a burst of sparks at the center", "electric blue and white"),
    ("moon_severance", 2, "320×320", "a giant crescent moon of overlapping sword cuts falling into a circle", "violet and silver"),
    ("toxic_cloud", 2, "256×256", "a billowing toxic gas cloud seen from above, loopable swirl", "toxic green"),
    ("eruption", 2, "160×160", "a volcanic eruption pillar seen from above: a ring of cracked earth with lava bursting upward", "lava orange and yellow"),
    ("event_horizon", 2, "320×320", "a gravity field ring seen from above with bent light and orbiting debris, loopable", "purple and white"),
    ("soul_reap", 2, "320×320", "a giant harvest-moon scythe crescent with souls pulled along it", "soul green and white"),
    ("binding_chains", 2, "256×64", "a spectral chain tether stretched horizontally between two points", "ghost blue"),
    ("seismic_fist", 2, "256×256", "a cone-shaped shockwave of shattered ground expanding to the right", "amber and white"),
    ("gale_rush", 2, "256×128", "a burst of wind streaks and fist after-images dashing to the right", "wind cyan and white"),
    ("refraction", 2, "256×256", "six thin prism light beams splitting from the center", "rainbow with white core"),
    ("heaven_verdict", 2, "160×320", "a massive vertical lightning strike from the sky hitting the center", "electric blue and white"),
    ("eclipse", 2, "512×512", "a giant black eclipsed moon with a corona of violet light, full-screen overlay feel", "violet and black"),
    ("plague_burst", 2, "256×256", "a violent toxic chain explosion with dripping ink", "toxic green"),
    ("shadow_slash", 2, "320×96", "a fast shadow clone dash slash streak across from left to right", "lavender and black"),
    ("world_breaker", 2, "512×512", "an arena-wide earthquake: radiating ground cracks with lava light from the center", "lava orange"),
    ("black_star", 2, "320×320", "a giant black hole with an accretion disk and lensing light, loopable spin", "purple, white and black"),
    ("last_harvest", 2, "512×512", "a full-circle reaper sweep with dozens of souls ripped upward", "soul green and white"),
    ("wailing_cone", 2, "320×256", "a sonic scream cone of distorted ghostly sound waves expanding to the right", "ghost blue"),
    ("mountain_fist", 2, "320×320", "a gigantic fist impact crater with a mountain-shaped shockwave", "amber and gold"),
    ("tornado", 2, "256×256", "a fierce tornado seen from above, spiral of wind and fist after-images", "wind cyan"),
    ("constellation", 2, "256×256", "a target mark made of a constellation of stars with a pillar of starlight", "gold and white"),
    ("rainbow_beam", 2, "512×96", "a thick prismatic rainbow laser beam shooting to the right", "rainbow with white core"),
]
for sid, prio, size, subj, color in SKILL_VFX:
    if color:
        vfx(f"vfx_{sid}.png", prio, size, subj, f"{color}", note="ใช้สีในภาพ ไม่ต้องลบพื้นหลัง", group="Skill VFX")
    else:
        vfx(f"vfx_{sid}.png", prio, size, subj, group="Skill VFX")
# system VFX
for sid, prio, size, subj, color in [
    ("ascend_shatter", 0, "320×320", "a rusty metal shell shattering outward into shards and ink, revealing light inside", "rust grey and gold light"),
    ("ascend_burst", 0, "512×512", "a pillar of divine light bursting upward from the center with radiating rays and sparks", "white and gold"),
    ("resonance_ready", 0, "128×128", "a pulsing ring of resonance energy with small rune marks, loopable", None),
    ("elite_aura", 1, "160×160", "a golden crown-shaped aura ring around the center, loopable flicker", "gold"),
    ("poison_ground", 1, "256×256", "a patch of corrupted toxic ground seen from above with bubbles, loopable", "toxic green"),
    ("time_bubble", 1, "256×256", "a golden time bubble dome seen from above with clock numerals around the rim, loopable", "brass gold and cyan"),
    ("lightning_strike", 1, "128×256", "a vertical lightning bolt hitting the ground with a small crater flash", None),
    ("fire_ground", 2, "256×256", "a patch of burning ground with flames and embers seen from above, loopable", "orange and yellow"),
    ("rewind", 2, "320×320", "a reverse-time spiral of clock hands and motion blur", "gold and cyan"),
    ("void_mark", 2, "96×96", "a small crescent moon mark sigil of void energy", "violet"),
    ("echo_ghost_trail", 2, "128×128", "a faint ghostly after-image smear", None),
    ("tether", 1, "256×32", "a thin glowing energy tether beam stretched horizontally", None),
]:
    vfx(f"vfx_{sid}.png", prio, size, subj, color or "pure white and light grey only, monochrome", note=("ใช้สีในภาพ ไม่ต้องลบพื้นหลัง" if color else "ขาว/เทาบนดำ — เกมย้อมสี"), group="System VFX")

# ------------------------------------------------------------------ 7. SKILL ICONS
SKILL_ICONS = [("hook", "a grappling hook on a chain", "#3dffb0"), ("guard", "a fist inside a hexagon shield", "#ff7a3c"), ("volley", "a fan of arrows", "#ffd24d"),
               ("thunderclap", "a lightning bolt crossing a blade", "#5ad8ff"), ("moon_severance", "a crescent moon cut by a sword", "#9d5bff"),
               ("toxic_bloom", "a venom flask bursting into a cloud", "#7dff4d"), ("shadow_pack", "two shadow silhouettes behind a dagger", "#c9b8ff"),
               ("eruption", "a volcano erupting", "#ff5a1f"), ("event_horizon", "a ring of gravity around a sphere", "#b06bff"),
               ("soul_reap", "a scythe harvesting a soul", "#9dff6b"), ("binding_chains", "chains binding two skulls", "#7fb8ff"),
               ("seismic_fist", "a fist smashing cracked ground", "#ffb347"), ("gale_rush", "a fist inside a whirlwind", "#7dfff0"),
               ("meteor_arrow", "an arrow becoming a meteor", "#ffe14d"), ("refraction", "an arrow splitting into prism rays", "#ffffff"),
               ("heaven_verdict", "a divine lightning strike on a sword", "#5ad8ff"), ("eclipse", "an eclipsed moon over a blade", "#9d5bff"),
               ("plague_tide", "a wave of venom with skulls", "#7dff4d"), ("hundred_shadows", "many shadow blades in a circle", "#c9b8ff"),
               ("world_breaker", "a hammer cracking a planet", "#ff5a1f"), ("black_star", "a black star with a burning corona", "#b06bff"),
               ("last_harvest", "a giant scythe over a crowd of souls", "#9dff6b"), ("wailing_requiem", "a screaming ghost face", "#7fb8ff"),
               ("mountain_breaker", "a fist shattering a mountain", "#ffb347"), ("thousand_gale", "a tornado of fists", "#7dfff0"),
               ("constellation", "an arrow drawing a constellation", "#ffe14d"), ("rainbow_lance", "a rainbow beam lance", "#ffffff")]
for sid, desc, col in SKILL_ICONS:
    ui(f"icon_skill_{sid}.png", "Skill icons", 1 if sid in ("hook", "guard", "volley") else 2, "64×64",
       f"a square game skill icon: {desc}, single bold ink symbol with {col} neon accent, centered, readable at small size")
sheets.append(("ไอคอนสกิลใหม่ 27 อัน (แบ่ง 3 ภาพ ภาพละ 9)", "icon_skill_*",
               "A 3x3 grid sheet of 9 square game skill icons, evenly spaced with clear gaps on a pure black background, same style and size. Icons: "
               + "; ".join(f"({i+1}) {d} ({c} accent)" for i, (_, d, c) in enumerate(SKILL_ICONS[:9])) + f". {STYLE}. (ทำซ้ำกับรายการที่ 10–18 และ 19–27)"))

# ------------------------------------------------------------------ 8. ARENAS
ARENAS = [
    ("blight", "Blight Garden", "a poisoned garden floor: dark soil, twisted black roots, scattered glowing green mushrooms and toxic puddles", "#7dff4d toxic green",
     "hazard_poison_tile", "a single irregular patch of corrupted toxic ground, glowing green veins, top-down", "a dark overgrown abyss of tangled black roots and green spores"),
    ("clock", "Clockwork Sanctum", "a giant brass clock-face floor with engraved numerals, inlaid gears and cracked marble", "#ffd24d brass gold",
     "prop_clock_gear", "a large ornate brass gear seen from above", "a dark void filled with slowly floating brass gears and faint golden dust"),
    ("storm", "Storm Spire", "a circular wet stone platform floor with lightning-scorched runes and puddles reflecting lightning", "#5ad8ff electric blue",
     "prop_lightning_rod", "a tall iron lightning rod seen from above, crackling tip", "dark storm clouds seen from above with distant lightning flashes"),
    ("shrine", "Burning Shrine", "a burning shrine courtyard floor: charred wooden planks, stone tiles, ash and glowing embers", "#ff5a1f flame orange",
     "prop_torii", "a broken charred torii gate seen from above, glowing ember cracks", "a sea of drifting ash and embers over darkness"),
    ("hollow", "Hollow Throne", "a floating obsidian throne platform floor with gold inlays and a crown sigil at the center", "#ffe14d gold",
     "hollow_island", "a small floating island chunk of obsidian floor seen from above, broken edges with void beneath", "a starry void with floating debris and faint galaxies"),
]
for aid, name, floor, col, hz, hzdesc, bgdesc in ARENAS:
    g = f"Arena: {name}"
    pr = 1 if aid in ("blight", "clock") else 2
    add(f"arena_{aid}_floor.png", g, pr, "2048×2048", "black/ทึบ ใช้ได้เลย",
        f"a perfectly circular duel arena floor seen from directly above (orthographic): {floor}, VERY low contrast and dark so characters stay readable, the circle fills the whole image edge to edge, pure black outside the circle. {STYLE}. {col} subtle accents.",
        "text, watermark, characters, perspective, bright, high contrast", "ต้องมืดและเรียบ")
    add(f"arena_{aid}_edge.png", g, pr, "2048×2048", "white → ลบพื้นหลัง",
        f"a circular arena boundary wall seen from directly above: only a ring themed as {name} with {col} glowing accents, the ring's outer edge touching 95% of the image width, EMPTY transparent center and outside. {STYLE}. {BG_WHITE}.",
        "text, watermark, characters, perspective", "วงแหวนอย่างเดียว ตรงกลางโปร่ง")
    add(f"bg_{aid}.png", g, pr, "512×512", "black/ทึบ ใช้ได้เลย",
        f"seamless tileable texture seen from above: {bgdesc}, very dark, low contrast. {STYLE}.", "text, watermark, seams, characters", "ต้องต่อกันได้ไร้รอยต่อ")
    obj(f"{hz}.png", g, pr, "160×160", hzdesc, col, "hazard / ของประกอบฉาก")

# ------------------------------------------------------------------ 9. UI
for t, (label, ladder) in TIER.items():
    n = int(t[1])
    look = ["a dull rusty iron badge", "a polished steel badge with a faint cyan line", "a neon cyan glowing badge", "an ornate violet-and-cyan elemental badge", "a radiant gold-and-white mythic badge with a halo"][n]
    ui(f"icon_tier_{n}.png", "UI", 0, "48×48", f"{look} engraved with the roman numeral {['0', 'I', 'II', 'III', 'IV'][n]}, a small tier rank emblem, centered")
ui("icon_rift_core.png", "UI", 0, "48×48", "a faceted rift core crystal icon with a swirling cyan-magenta rift inside, centered")
ui("icon_echo_shard.png", "UI", 1, "40×40", "a thin violet glass shard currency icon, softly glowing, centered")
ui("icon_resonance.png", "UI", 0, "40×40", "a resonance icon: concentric sound-wave rings around a small blade, cyan glow, centered")
ui("ui_card_augment.png", "UI", 1, "260×340", "an empty vertical card frame for a skill augment card, dark ink-washed panel with a magenta-and-cyan circuit-like neon border and corner gears, EMPTY center", "ตรงกลางต้องว่าง")
ui("ui_path_card.png", "UI", 0, "420×560", "an empty tall ornate card frame for choosing an ascension path, dark panel with an elegant silver neon border and a crest slot at the top, EMPTY center", "การ์ดเลือกสาย T3 (ใส่ art_path ทับ)")
ui("ui_ascension_frame.png", "UI", 0, "1280×400", "a wide ornate horizontal banner frame for an ascension title, ink brush strokes with gold and cyan neon filigree on both ends, EMPTY center", "ป้ายชื่อร่างใหม่")
ui("ui_codex_bg.png", "UI", 2, "1600×900", "a dark ancient codex book page background with faint ink sketches of weapons and monsters and neon rune margins, low contrast", "พื้นหลังหน้า Codex")
ui("ui_weapon_slot.png", "UI", 1, "96×96", "an ornate square weapon slot frame with five small tier pips along the bottom edge, dark interior, cyan neon outline", "ช่องอาวุธใน HUD")

# T0 must have no glow at all — the shared style block mentions neon lines, so override it for worn forms
NEON_CLAUSE = "a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams)"
for it in items:
    if "_t0" in it["file"]:
        it["prompt"] = it["prompt"].replace(NEON_CLAUSE, "NO glowing lines at all, only dull worn metal, rust and old cloth")
        it["negative"] += ", glow, neon, light, magic"

# ------------------------------------------------------------------ write
os.makedirs(os.path.dirname(OUT_MD), exist_ok=True)
json.dump({"update": "ASCENSION", "style": STYLE, "view": VIEW, "negative_prompt": NEG, "negative_prompt_vfx": NEG_VFX,
           "tier_ladder": {k: v[1] for k, v in TIER.items()}, "items": items,
           "sheets": [{"title": t, "covers": c, "prompt": p} for t, c, p in sheets]},
          open(OUT_JSON, "w"), ensure_ascii=False, indent=2)

L = []
w = L.append
w("# NEON DUEL 2.0 — ASCENSION · Asset Prompts")
w("")
w(f"Prompt สำหรับ generate asset ของอัปเดต ASCENSION ทั้งหมด **{len(items)} ภาพ** · "
  f"P0 {sum(1 for i in items if i['prio']==0)} · P1 {sum(1 for i in items if i['prio']==1)} · P2 {sum(1 for i in items if i['prio']==2)}")
w("ข้อมูลเดียวกันแบบ JSON: [`update_asset_prompts.json`](update_asset_prompts.json) · ดีไซน์ทั้งหมด: [UPDATE_ASCENSION.md](UPDATE_ASCENSION.md)")
w("")
w("**กติกาเดิมทุกข้อ** (ดู ART_PROMPTS.md): มองจากบนลงล่าง หันขวา · ตัวละคร/วัตถุบนพื้นขาว → ลบพื้นหลัง · VFX/ไอคอนบนพื้นดำ · ใส่ negative prompt ทุกครั้ง · วางไฟล์ตามชื่อใน `RIFTARENA/Asset/` แล้วระบบนำเข้าให้เอง")
w("")
w("## Style block")
w("```text"); w(STYLE); w("```")
w("**View block (ตัวละคร)**"); w("```text"); w(VIEW); w("```")
w("**Negative (ตัวละคร/วัตถุ)**"); w("```text"); w(NEG); w("```")
w("**Negative (VFX)**"); w("```text"); w(NEG_VFX); w("```")
w("")
w("## Tier ladder — คำที่ใช้บอกขั้นของอาวุธ (ใส่ใน prompt ให้แล้ว)")
w("")
w("| ขั้น | คำอธิบาย |")
w("|---|---|")
for k, (label, ladder) in TIER.items():
    w(f"| {k.upper()} {label} | {ladder.format(c='{สีสาย}', e='{ธาตุ}')} |")
w("")
w("## Sheet prompts — หลายภาพในครั้งเดียว (แนะนำสำหรับความสม่ำเสมอ)")
w("")
for t, c, p in sheets:
    w(f"### {t}"); w(f"ครอบคลุม: `{c}`"); w("```text"); w(p); w("```"); w("")
w("## Prompt รายไฟล์")
w("")
groups = []
for it in items:
    if it["group"] not in groups:
        groups.append(it["group"])
for g in groups:
    w(f"### {g}")
    w("")
    for pr in (0, 1, 2):
        for it in [i for i in items if i["group"] == g and i["prio"] == pr]:
            note = f" · {it['note']}" if it["note"] else ""
            w(f"**`{it['file']}`** — P{pr} · {it['size']} · BG: {it['bg']}{note}")
            w("```text"); w(it["prompt"]); w("```")
    w("")
open(OUT_MD, "w").write("\n".join(L) + "\n")
json.dump([{"name": i["file"][:-4], "group": i["group"], "prio": i["prio"], "size": i["size"], "note": i["note"]} for i in items],
          open(OUT_NAMES, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(items)} items, {len(sheets)} sheets → {OUT_MD}")
