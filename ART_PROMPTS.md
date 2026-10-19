# NEON DUEL — Image Generation Prompt Pack (Ink & Neon)

ชุด prompt สำหรับ generate ภาพทั้งหมดของเกม · prompt เป็นภาษาอังกฤษ (โมเดลภาพเข้าใจแม่นกว่า) · คำอธิบายเป็นภาษาไทย
ไฟล์คู่กัน: [`art_prompts.json`](art_prompts.json) — ข้อมูลเดียวกันในรูปแบบ JSON สำหรับสคริปต์/เครื่องมือ batch

รวม **159 ภาพ** · P0 (จำเป็น) 36 · P1 86 · P2 37

## 1. วิธีใช้

**ทางเลือก A — สร้างทีละหลายภาพในครั้งเดียว (เร็ว เหมาะกับ ChatGPT / Gemini / Midjourney):** ใช้ *Sheet prompts* ในหัวข้อ 3 แล้วตัดภาพแยกเป็นไฟล์

**ทางเลือก B — ทีละไฟล์ (คุมคุณภาพดีกว่า):** ใช้ prompt รายไฟล์ในหัวข้อ 4 หรือป้อน `art_prompts.json` ให้สคริปต์/เครื่องมือ batch (เช่น API, ComfyUI, Leonardo)

**ขั้นตอนแนะนำเพื่อให้ภาพคุมโทนเดียวกัน**
1. สร้าง **ผู้เล่น idle** ก่อน จนได้ภาพที่ชอบ → ใช้ภาพนั้นเป็น *reference / style reference* (Midjourney: `--sref` / `--cref`, ChatGPT: แนบภาพแล้วพิมพ์ "same character and style")
2. ใช้ seed เดิม / style reference เดิม กับทุกภาพที่เหลือ
3. ท่าอื่นของตัวเดิม: แนบภาพ idle แล้วพิมพ์ prompt ของท่านั้น + "the exact same character as the reference image"
4. สร้างที่ 1024×1024 (หรือใหญ่สุดที่ได้) แล้วค่อยย่อเป็นขนาดในตาราง

## 2. Style Bible (ใช้กับทุกภาพ)

| หัวข้อ | กำหนด |
|---|---|
| สไตล์ | Ink & Neon — เงาหมึกดำแบบพู่กันญี่ปุ่น ขอบคม รายละเอียดภายในน้อย มีเส้นนีออนเรืองแสงแค่ไม่กี่จุด |
| มุมกล้อง | **Top-down แท้ (มองตรงลงมาจากบน 90°)** ตัวละคร/วัตถุ **หันขวา** อยู่กลางภาพ (ยกเว้นภาพ portrait บอส) |
| สีตัว | ดำ/เทาถ่านเป็นหลัก — สีมาจากเส้นนีออนเท่านั้น 1 สีต่อตัวละคร (ตามตาราง) |
| พื้นหลัง | ตัวละคร/อาวุธ/วัตถุ: **ขาวล้วน** แล้วลบพื้นหลังเป็นโปร่งใส · VFX/กระสุนเรืองแสง/ไอคอน: **ดำล้วน** ไม่ต้องลบ (เกมวาดแบบบวกแสง สีดำ = มองไม่เห็น) |
| ห้าม | ตัวอักษร, ลายน้ำ, เงาตกพื้น, พื้น/ฉาก, มุมเอียง isometric/ด้านข้าง, ถืออาวุธ (อาวุธเป็นไฟล์แยก) |
| ไฟล์ | PNG · ชื่อไฟล์ตามตารางเป๊ะ · วางใน `src/assets/sprites/` · ตรวจที่ `?sprites=1` |

**ตารางสีประจำตัว**

| ใคร | สีนีออน | เฟส 2 |
|---|---|---|
| ผู้เล่น / Katana | `#7ff6ff cyan` | `—` |
| Twin Fangs (มีด) | `#ff4d8a pink` | `—` |
| Graviton (ค้อน) | `#ffb347 amber` | `—` |
| Rusher | `#ff4d6d red` | `—` |
| Gunner | `#ffd24d yellow` | `—` |
| Bulwark | `#5aa0ff blue` | `—` |
| Bomber | `#c25bff purple` | `—` |
| Vanguard | `#ffb347 gold` | `#ff5a3c` |
| Hex Weaver | `#d36bff violet` | `#ff4dcf` |
| Kael | `#ff3c6e crimson` | `#ff1f3d` |
| Vex | `#9d7bff indigo` | `#b34dff` |
| Iron Colossus | `#8fa8ff steel` | `#ff7a3c` |
| Mirror Sovereign | `#ff5af1 magenta` | `white` |

**Style block** (ต่อท้ายทุก prompt ได้ ถ้าเครื่องมือมีช่อง style แยก ให้วางตรงนั้น):
```text
Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp
```
**View block** (ตัวละคร):
```text
strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it
```
**Negative prompt** (ตัวละคร/วัตถุ):
```text
text, letters, watermark, signature, logo, UI, frame, border, isometric view, side view, front view, 3/4 view, perspective, floor, ground, cast shadow, scenery, multiple characters, cropped, cut off, blurry, photorealistic, 3D render, gradient background, colorful body, rainbow, extra limbs, holding weapon
```
**Negative prompt** (VFX):
```text
text, watermark, character, person, object, background scenery, gradient background, frame, border, color noise
```

## 3. Sheet prompts — สร้างหลายภาพในครั้งเดียว

เหมาะสำหรับร่างแรกและไอคอน · หลัง generate ให้ตัดแต่ละช่องออกเป็นไฟล์ตามชื่อในหัวข้อ 4 · ถ้าโมเดลวาดไม่ครบจำนวน ให้แบ่งเป็น 2 รอบ

### ไอคอนสกิล 7 อัน (รวมในภาพเดียว)
ครอบคลุมไฟล์: `icon_skill_*`
```text
A 4x2 grid sheet of 7 square game skill icons, evenly spaced with clear gaps on a pure black background, same style and size for every icon. Icons left to right, top to bottom: (1) three ghostly dash slashes crossing; (2) four blades orbiting in a circle; (3) a fan of throwing knives spreading out; (4) a kunai with a target mark; (5) a meteor crashing down onto the ground; (6) a gravity vortex spiral; (7) a blazing eye surrounded by energy flames. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon cyan accents.
```

### ไอคอนการ์ดอัปเกรด 28 อัน (รวมในภาพเดียว)
ครอบคลุมไฟล์: `icon_upgrade_*`
```text
A 7x4 grid sheet of 28 square game upgrade icons, evenly spaced with clear gaps on a pure black background, consistent style and size. Icons in order: (1) a katana; (2) twin daggers; (3) a war hammer; (4) two dash chevrons; (5) a circular arrow around a dash chevron; (6) a trail of flames; (7) a shield emitting a burst; (8) an eye inside a target ring; (9) a blade struck by lightning; (10) a bleeding heart; (11) a winged foot; (12) an iron heart; (13) a glowing crystal; (14) a skull with an X slash; (15) a ghostly afterimage silhouette; (16) a fist breaking a hexagon; (17) a cracked glass diamond; (18) a gleaming sword edge; (19) a phoenix feather; (20) a charging lightning bolt; (21) a mirror shield bouncing an arrow; (22) a rising arrow; (23) a glowing energy core; (24) a metronome with blades; (25) a half-filled focus gauge; (26) an infinity loop of energy; (27) a scythe; (28) a stitched heart. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Mixed neon accents.
```

### ผู้เล่นครบ 8 ท่า (character sheet)
ครอบคลุมไฟล์: `player_*`
```text
A character turnaround sheet: the SAME character drawn 8 times in a single row with equal spacing, all in strict top-down orthographic view facing right, on a pure white background. Character: a lone ronin duelist, lean athletic build, short hooded cowl, a long ink scarf flowing behind, light lacquered shoulder plates, glowing cyan visor slit across the eyes. Poses in order: (1) idle: standing ready in a balanced stance, arms close to the body, scarf resting behind; (2) move: mid-stride running to the right, body leaning forward, scarf streaming behind to the left; (3) attack: mid-slash, right arm swung far forward-right, torso twisted, scarf whipping; (4) dash: dashing to the right at extreme speed, body stretched and leaning hard forward, ink smear streaks trailing behind to the left; (5) guard: defensive guard, both arms raised forward crossed in front of the body; (6) charge: crouched and coiled low, gathering energy, faint cyan energy wisps curling around the body; (7) hurt: recoiling backwards to the left from a hit, head snapped back, ink droplets flying; (8) death: collapsed lying on the ground seen from above, limbs sprawled, scarf spread out, ink pool splatter around the body. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent #7ff6ff electric cyan only. Hands empty.
```

### ศัตรู 4 ชนิด (lineup)
ครอบคลุมไฟล์: `enemy_*_idle`
```text
A lineup sheet of 4 different enemy creatures in one row with equal spacing, strict top-down orthographic view, all facing right, on a pure white background: (1) a small feral blade-assassin creature with an arrowhead-shaped body pointing right, hunched and aggressive, twin claw blades with #ff4d6d blood red accents; (2) a slim hooded marksman with a long rifle-like arm cannon pointing to the right, diamond-shaped silhouette with #ffd24d acid yellow accents; (3) a heavy square armored brute, thick plated shoulders, bulky compact silhouette, no shield (shield is separate) with #5aa0ff cold blue accents; (4) a round bloated creature with a cracked shell and an unstable glowing core visible through the cracks with #c25bff toxic purple accents. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp.
```

### บอส 6 ตัว (lineup)
ครอบคลุมไฟล์: `boss_*_idle`
```text
A lineup sheet of 6 boss characters in one row, strict top-down orthographic view, all facing right, on a pure white background: (1) THE VANGUARD — a towering armored knight with hexagonal pauldrons, a broad longsword held to the side, heavy crested helm, no shield (shield is separate) with #ffb347 gold accents; (2) HEX WEAVER — a floating sorceress in a long triangular robe that fans out behind her, tall pointed hood, one large glowing eye-gem on the forehead, thin hands raised casting with #d36bff violet accents; (3) KAEL, the blade twin — a lithe swordsman with a sharp crescent-shaped silhouette, long curved blade held low behind, torn cape with #ff3c6e crimson accents; (4) VEX, the shadow twin — a slender masked assassin with throwing knives orbiting around her, short layered cloak, diamond-shaped silhouette with #9d7bff indigo accents; (5) IRON COLOSSUS — a colossal octagonal war-golem chassis made of riveted iron plates, thick armored front plate, a sealed round core hatch in the chest, NO arms (arms are separate sprites) with #8fa8ff steel blue accents; (6) MIRROR SOVEREIGN — a dark reflection of the ronin duelist player (hooded cowl, flowing scarf) wearing a crown of five sharp spikes on the back of the head, holding a katana, inverted glossy black with magenta and white glow with #ff5af1 magenta and pure white accents. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp.
```

### VFX หลัก 8 แบบ (รวมในภาพเดียว)
ครอบคลุมไฟล์: `vfx_*`
```text
A 4x2 grid sheet of 8 different 2D game visual effects on a pure black background, evenly spaced, monochrome white and light grey ink-energy style: (1) crescent sword-slash arc, (2) full circular spin slash, (3) horizontal thrust streak, (4) impact starburst, (5) critical hit starburst with cross flare, (6) blocked-hit spark spray, (7) ink explosion burst, (8) ground shockwave ring seen from above.
```

## 4. Prompt รายไฟล์ (ครบทุกภาพ)

คอลัมน์ **BG** บอกว่าต้องลบพื้นหลังหรือไม่ · prompt แต่ละอันสมบูรณ์ในตัว (มี style/มุม/พื้นหลังครบ) คัดลอกไปใช้ได้ทันที · อย่าลืมใส่ negative prompt

### Player

**`player_idle.png`** — P0 · ขนาด 96×96 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a lone ronin duelist, lean athletic build, short hooded cowl, a long ink scarf flowing behind, light lacquered shoulder plates, glowing cyan visor slit across the eyes, standing ready in a balanced stance, arms close to the body, scarf resting behind. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #7ff6ff electric cyan only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment. Hands are empty (the weapon is a separate sprite).
```
**`player_move.png`** — P0 · ขนาด 96×96 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a lone ronin duelist, lean athletic build, short hooded cowl, a long ink scarf flowing behind, light lacquered shoulder plates, glowing cyan visor slit across the eyes, mid-stride running to the right, body leaning forward, scarf streaming behind to the left. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #7ff6ff electric cyan only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment. Hands are empty (the weapon is a separate sprite).
```
**`player_attack.png`** — P0 · ขนาด 96×96 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a lone ronin duelist, lean athletic build, short hooded cowl, a long ink scarf flowing behind, light lacquered shoulder plates, glowing cyan visor slit across the eyes, mid-slash, right arm swung far forward-right, torso twisted, scarf whipping. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #7ff6ff electric cyan only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment. Hands are empty (the weapon is a separate sprite).
```
**`player_dash.png`** — P1 · ขนาด 96×96 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a lone ronin duelist, lean athletic build, short hooded cowl, a long ink scarf flowing behind, light lacquered shoulder plates, glowing cyan visor slit across the eyes, dashing to the right at extreme speed, body stretched and leaning hard forward, ink smear streaks trailing behind to the left. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #7ff6ff electric cyan only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment. Hands are empty (the weapon is a separate sprite).
```
**`player_guard.png`** — P1 · ขนาด 96×96 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a lone ronin duelist, lean athletic build, short hooded cowl, a long ink scarf flowing behind, light lacquered shoulder plates, glowing cyan visor slit across the eyes, defensive guard, both arms raised forward crossed in front of the body. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #7ff6ff electric cyan only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment. Hands are empty (the weapon is a separate sprite).
```
**`player_charge.png`** — P1 · ขนาด 96×96 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a lone ronin duelist, lean athletic build, short hooded cowl, a long ink scarf flowing behind, light lacquered shoulder plates, glowing cyan visor slit across the eyes, crouched and coiled low, gathering energy, faint cyan energy wisps curling around the body. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #7ff6ff electric cyan only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment. Hands are empty (the weapon is a separate sprite).
```
**`player_hurt.png`** — P1 · ขนาด 96×96 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a lone ronin duelist, lean athletic build, short hooded cowl, a long ink scarf flowing behind, light lacquered shoulder plates, glowing cyan visor slit across the eyes, recoiling backwards to the left from a hit, head snapped back, ink droplets flying. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #7ff6ff electric cyan only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment. Hands are empty (the weapon is a separate sprite).
```
**`player_death.png`** — P1 · ขนาด 96×96 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a lone ronin duelist, lean athletic build, short hooded cowl, a long ink scarf flowing behind, light lacquered shoulder plates, glowing cyan visor slit across the eyes, collapsed lying on the ground seen from above, limbs sprawled, scarf spread out, ink pool splatter around the body. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #7ff6ff electric cyan only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment. Hands are empty (the weapon is a separate sprite).
```

### Weapons

**`weapon_katana.png`** — P0 · ขนาด 140×24 · BG: white → ลบพื้นหลัง · จุดหมุนอยู่ที่ปลายด้ามซ้ายสุด — ครอปให้ชิดซ้าย/ขวา
```text
a slender curved katana, black lacquered blade with a razor-thin glowing cyan cutting edge, small round guard, wrapped handle on the LEFT end, blade tip on the RIGHT. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #7ff6ff electric cyan only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`weapon_daggers.png`** — P0 · ขนาด 72×56 · BG: white → ลบพื้นหลัง · สองเล่มในภาพเดียว ด้ามอยู่ซ้าย
```text
a pair of twin curved daggers placed side by side horizontally (one above the other), black blades with glowing hot pink edges, handles on the LEFT, tips on the RIGHT. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff4d8a hot pink only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`weapon_hammer.png`** — P0 · ขนาด 120×64 · BG: white → ลบพื้นหลัง · หัวค้อนอยู่ขวาสุด ด้ามซ้าย
```text
a massive gravity war hammer, long black shaft with the handle on the LEFT and a heavy block-shaped hammer head on the RIGHT end, glowing amber energy core in the hammer head. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffb347 molten amber only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```

### Enemies

**`enemy_rusher_idle.png`** — P0 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a small feral blade-assassin creature with an arrowhead-shaped body pointing right, hunched and aggressive, twin claw blades, standing alert. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff4d6d blood red only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_gunner_idle.png`** — P0 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a slim hooded marksman with a long rifle-like arm cannon pointing to the right, diamond-shaped silhouette, standing alert. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffd24d acid yellow only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bulwark_idle.png`** — P0 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a heavy square armored brute, thick plated shoulders, bulky compact silhouette, no shield (shield is separate), standing alert. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #5aa0ff cold blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bomber_idle.png`** — P0 · ขนาด 72×72 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a round bloated creature with a cracked shell and an unstable glowing core visible through the cracks, standing alert. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #c25bff toxic purple only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bulwark_shield.png`** — P0 · ขนาด 110×110 · BG: white → ลบพื้นหลัง · ภาพเท่ากับตัว Bulwark จุดกลางภาพ = กลางตัว โล่อยู่ด้านขวา
```text
a curved heavy tower shield arc, seen from above as a thick crescent shape on the RIGHT side of the image, the inner hollow centered in the frame, cold blue glowing rune seams. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #5aa0ff cold blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_rusher_move.png`** — P1 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a small feral blade-assassin creature with an arrowhead-shaped body pointing right, hunched and aggressive, twin claw blades, moving forward to the right. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff4d6d blood red only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_rusher_windup.png`** — P1 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a small feral blade-assassin creature with an arrowhead-shaped body pointing right, hunched and aggressive, twin claw blades, winding up an attack, body pulled back and tense, accent glow brighter. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff4d6d blood red only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_rusher_attack.png`** — P1 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a small feral blade-assassin creature with an arrowhead-shaped body pointing right, hunched and aggressive, twin claw blades, attacking forward to the right, body fully extended. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff4d6d blood red only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_rusher_hurt.png`** — P1 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a small feral blade-assassin creature with an arrowhead-shaped body pointing right, hunched and aggressive, twin claw blades, flinching backwards from a hit. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff4d6d blood red only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_rusher_death.png`** — P1 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a small feral blade-assassin creature with an arrowhead-shaped body pointing right, hunched and aggressive, twin claw blades, destroyed and collapsed seen from above, broken into ink fragments. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff4d6d blood red only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_gunner_move.png`** — P1 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a slim hooded marksman with a long rifle-like arm cannon pointing to the right, diamond-shaped silhouette, moving forward to the right. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffd24d acid yellow only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_gunner_windup.png`** — P1 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a slim hooded marksman with a long rifle-like arm cannon pointing to the right, diamond-shaped silhouette, winding up an attack, body pulled back and tense, accent glow brighter. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffd24d acid yellow only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_gunner_attack.png`** — P1 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a slim hooded marksman with a long rifle-like arm cannon pointing to the right, diamond-shaped silhouette, attacking forward to the right, body fully extended. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffd24d acid yellow only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_gunner_hurt.png`** — P1 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a slim hooded marksman with a long rifle-like arm cannon pointing to the right, diamond-shaped silhouette, flinching backwards from a hit. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffd24d acid yellow only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_gunner_death.png`** — P1 · ขนาด 80×80 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a slim hooded marksman with a long rifle-like arm cannon pointing to the right, diamond-shaped silhouette, destroyed and collapsed seen from above, broken into ink fragments. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffd24d acid yellow only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bulwark_move.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a heavy square armored brute, thick plated shoulders, bulky compact silhouette, no shield (shield is separate), moving forward to the right. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #5aa0ff cold blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bulwark_windup.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a heavy square armored brute, thick plated shoulders, bulky compact silhouette, no shield (shield is separate), winding up an attack, body pulled back and tense, accent glow brighter. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #5aa0ff cold blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bulwark_attack.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a heavy square armored brute, thick plated shoulders, bulky compact silhouette, no shield (shield is separate), attacking forward to the right, body fully extended. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #5aa0ff cold blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bulwark_hurt.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a heavy square armored brute, thick plated shoulders, bulky compact silhouette, no shield (shield is separate), flinching backwards from a hit. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #5aa0ff cold blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bulwark_death.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a heavy square armored brute, thick plated shoulders, bulky compact silhouette, no shield (shield is separate), destroyed and collapsed seen from above, broken into ink fragments. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #5aa0ff cold blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bomber_move.png`** — P1 · ขนาด 72×72 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a round bloated creature with a cracked shell and an unstable glowing core visible through the cracks, moving forward to the right. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #c25bff toxic purple only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bomber_windup.png`** — P1 · ขนาด 72×72 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a round bloated creature with a cracked shell and an unstable glowing core visible through the cracks, winding up an attack, body pulled back and tense, accent glow brighter. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #c25bff toxic purple only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bomber_attack.png`** — P1 · ขนาด 72×72 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a round bloated creature with a cracked shell and an unstable glowing core visible through the cracks, attacking forward to the right, body fully extended. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #c25bff toxic purple only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bomber_hurt.png`** — P1 · ขนาด 72×72 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a round bloated creature with a cracked shell and an unstable glowing core visible through the cracks, flinching backwards from a hit. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #c25bff toxic purple only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`enemy_bomber_death.png`** — P1 · ขนาด 72×72 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
a round bloated creature with a cracked shell and an unstable glowing core visible through the cracks, destroyed and collapsed seen from above, broken into ink fragments. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #c25bff toxic purple only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```

### Boss: Vanguard

**`boss_vanguard_idle.png`** — P0 · ขนาด 160×160 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
THE VANGUARD — a towering armored knight with hexagonal pauldrons, a broad longsword held to the side, heavy crested helm, no shield (shield is separate), standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffb347 gold only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vanguard_shield.png`** — P0 · ขนาด 160×160 · BG: white → ลบพื้นหลัง · ภาพเท่าตัวบอส จุดกลางภาพ = กลางตัวบอส
```text
a huge curved kite shield seen from above as a thick crescent on the RIGHT side of the image, the inner hollow centered, engraved gold rune seams. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffb347 gold only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vanguard_move.png`** — P1 · ขนาด 160×160 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
THE VANGUARD — a towering armored knight with hexagonal pauldrons, a broad longsword held to the side, heavy crested helm, no shield (shield is separate), advancing to the right. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffb347 gold only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vanguard_windup.png`** — P1 · ขนาด 160×160 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
THE VANGUARD — a towering armored knight with hexagonal pauldrons, a broad longsword held to the side, heavy crested helm, no shield (shield is separate), winding up a powerful attack, body coiled, accent glow intensified. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffb347 gold only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vanguard_attack.png`** — P1 · ขนาด 160×160 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
THE VANGUARD — a towering armored knight with hexagonal pauldrons, a broad longsword held to the side, heavy crested helm, no shield (shield is separate), unleashing an attack forward to the right, fully extended. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffb347 gold only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vanguard_stagger.png`** — P1 · ขนาด 160×160 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
THE VANGUARD — a towering armored knight with hexagonal pauldrons, a broad longsword held to the side, heavy crested helm, no shield (shield is separate), staggered and off-balance, posture broken, dazed, armor cracked, leaning backwards. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffb347 gold only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vanguard_death.png`** — P1 · ขนาด 160×160 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
THE VANGUARD — a towering armored knight with hexagonal pauldrons, a broad longsword held to the side, heavy crested helm, no shield (shield is separate), defeated and shattered seen from above, body breaking apart into ink shards and fading glow. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ffb347 gold only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vanguard_idle_p2.png`** — P2 · ขนาด 160×160 ต่อเฟรม · BG: white → ลบพื้นหลัง · เวอร์ชันเฟส 2 (ไม่บังคับ) ทำท่าอื่นแบบ _p2 ได้เหมือนกัน
```text
THE VANGUARD — a towering armored knight with hexagonal pauldrons, a broad longsword held to the side, heavy crested helm, no shield (shield is separate), PHASE 2 enraged form: cracked armor leaking light, more aggressive posture, aura flames, standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff5a3c ember orange-red only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```

### Boss: Hex Weaver

**`boss_hex_idle.png`** — P0 · ขนาด 140×140 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
HEX WEAVER — a floating sorceress in a long triangular robe that fans out behind her, tall pointed hood, one large glowing eye-gem on the forehead, thin hands raised casting, standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #d36bff violet only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_hex_move.png`** — P1 · ขนาด 140×140 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
HEX WEAVER — a floating sorceress in a long triangular robe that fans out behind her, tall pointed hood, one large glowing eye-gem on the forehead, thin hands raised casting, advancing to the right. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #d36bff violet only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_hex_windup.png`** — P1 · ขนาด 140×140 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
HEX WEAVER — a floating sorceress in a long triangular robe that fans out behind her, tall pointed hood, one large glowing eye-gem on the forehead, thin hands raised casting, winding up a powerful attack, body coiled, accent glow intensified. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #d36bff violet only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_hex_attack.png`** — P1 · ขนาด 140×140 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
HEX WEAVER — a floating sorceress in a long triangular robe that fans out behind her, tall pointed hood, one large glowing eye-gem on the forehead, thin hands raised casting, unleashing an attack forward to the right, fully extended. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #d36bff violet only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_hex_stagger.png`** — P1 · ขนาด 140×140 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
HEX WEAVER — a floating sorceress in a long triangular robe that fans out behind her, tall pointed hood, one large glowing eye-gem on the forehead, thin hands raised casting, staggered and off-balance, posture broken, dazed, armor cracked, leaning backwards. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #d36bff violet only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_hex_death.png`** — P1 · ขนาด 140×140 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
HEX WEAVER — a floating sorceress in a long triangular robe that fans out behind her, tall pointed hood, one large glowing eye-gem on the forehead, thin hands raised casting, defeated and shattered seen from above, body breaking apart into ink shards and fading glow. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #d36bff violet only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_hex_ring.png`** — P1 · ขนาด 220×220 · BG: black/ทึบ ใช้ได้เลย · โค้ดหมุนให้ วาดเป็นวงสมมาตร
```text
a circular magic rune ring seen from above, thin double circle with evenly spaced angular glyphs around it, glowing violet lines only, transparent center, perfectly centered and symmetrical. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`boss_hex_idle_p2.png`** — P2 · ขนาด 140×140 ต่อเฟรม · BG: white → ลบพื้นหลัง · เวอร์ชันเฟส 2 (ไม่บังคับ) ทำท่าอื่นแบบ _p2 ได้เหมือนกัน
```text
HEX WEAVER — a floating sorceress in a long triangular robe that fans out behind her, tall pointed hood, one large glowing eye-gem on the forehead, thin hands raised casting, PHASE 2 enraged form: cracked armor leaking light, more aggressive posture, aura flames, standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff4dcf magenta only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```

### Boss: Twin Fangs

**`boss_kael_idle.png`** — P0 · ขนาด 120×120 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
KAEL, the blade twin — a lithe swordsman with a sharp crescent-shaped silhouette, long curved blade held low behind, torn cape, standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff3c6e crimson only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vex_idle.png`** — P0 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
VEX, the shadow twin — a slender masked assassin with throwing knives orbiting around her, short layered cloak, diamond-shaped silhouette, standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #9d7bff indigo only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_kael_move.png`** — P1 · ขนาด 120×120 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
KAEL, the blade twin — a lithe swordsman with a sharp crescent-shaped silhouette, long curved blade held low behind, torn cape, advancing to the right. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff3c6e crimson only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_kael_windup.png`** — P1 · ขนาด 120×120 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
KAEL, the blade twin — a lithe swordsman with a sharp crescent-shaped silhouette, long curved blade held low behind, torn cape, winding up a powerful attack, body coiled, accent glow intensified. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff3c6e crimson only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_kael_attack.png`** — P1 · ขนาด 120×120 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
KAEL, the blade twin — a lithe swordsman with a sharp crescent-shaped silhouette, long curved blade held low behind, torn cape, unleashing an attack forward to the right, fully extended. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff3c6e crimson only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_kael_stagger.png`** — P1 · ขนาด 120×120 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
KAEL, the blade twin — a lithe swordsman with a sharp crescent-shaped silhouette, long curved blade held low behind, torn cape, staggered and off-balance, posture broken, dazed, armor cracked, leaning backwards. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff3c6e crimson only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_kael_death.png`** — P1 · ขนาด 120×120 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
KAEL, the blade twin — a lithe swordsman with a sharp crescent-shaped silhouette, long curved blade held low behind, torn cape, defeated and shattered seen from above, body breaking apart into ink shards and fading glow. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff3c6e crimson only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vex_move.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
VEX, the shadow twin — a slender masked assassin with throwing knives orbiting around her, short layered cloak, diamond-shaped silhouette, advancing to the right. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #9d7bff indigo only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vex_windup.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
VEX, the shadow twin — a slender masked assassin with throwing knives orbiting around her, short layered cloak, diamond-shaped silhouette, winding up a powerful attack, body coiled, accent glow intensified. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #9d7bff indigo only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vex_attack.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
VEX, the shadow twin — a slender masked assassin with throwing knives orbiting around her, short layered cloak, diamond-shaped silhouette, unleashing an attack forward to the right, fully extended. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #9d7bff indigo only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vex_stagger.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
VEX, the shadow twin — a slender masked assassin with throwing knives orbiting around her, short layered cloak, diamond-shaped silhouette, staggered and off-balance, posture broken, dazed, armor cracked, leaning backwards. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #9d7bff indigo only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vex_death.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
VEX, the shadow twin — a slender masked assassin with throwing knives orbiting around her, short layered cloak, diamond-shaped silhouette, defeated and shattered seen from above, body breaking apart into ink shards and fading glow. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #9d7bff indigo only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_kael_idle_p2.png`** — P2 · ขนาด 120×120 ต่อเฟรม · BG: white → ลบพื้นหลัง · เวอร์ชันเฟส 2 (ไม่บังคับ) ทำท่าอื่นแบบ _p2 ได้เหมือนกัน
```text
KAEL, the blade twin — a lithe swordsman with a sharp crescent-shaped silhouette, long curved blade held low behind, torn cape, PHASE 2 enraged form: cracked armor leaking light, more aggressive posture, aura flames, standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff1f3d deep red only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_vex_idle_p2.png`** — P2 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง · เวอร์ชันเฟส 2 (ไม่บังคับ) ทำท่าอื่นแบบ _p2 ได้เหมือนกัน
```text
VEX, the shadow twin — a slender masked assassin with throwing knives orbiting around her, short layered cloak, diamond-shaped silhouette, PHASE 2 enraged form: cracked armor leaking light, more aggressive posture, aura flames, standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #b34dff deep violet only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```

### Boss: Colossus

**`boss_colossus_idle.png`** — P0 · ขนาด 256×256 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
IRON COLOSSUS — a colossal octagonal war-golem chassis made of riveted iron plates, thick armored front plate, a sealed round core hatch in the chest, NO arms (arms are separate sprites), standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #8fa8ff steel blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_colossus_arm.png`** — P0 · ขนาด 96×96 · BG: white → ลบพื้นหลัง · ใช้ซ้ำทั้งแขนซ้ายและขวา (เกมกลับด้านให้)
```text
one massive mechanical golem fist and forearm seen from above, riveted iron plates, knuckles pointing right, steel blue seams. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #8fa8ff steel blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_colossus_core.png`** — P0 · ขนาด 96×96 · BG: black (ไม่ต้องลบ) · ใช้สีในภาพ (ส้ม-ทอง) วาดแบบบวกแสง ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a glowing open reactor core seen from above, circular iris hatch opened with molten light inside, concentric heat rings. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, molten orange and gold, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`boss_colossus_move.png`** — P1 · ขนาด 256×256 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
IRON COLOSSUS — a colossal octagonal war-golem chassis made of riveted iron plates, thick armored front plate, a sealed round core hatch in the chest, NO arms (arms are separate sprites), advancing to the right. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #8fa8ff steel blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_colossus_windup.png`** — P1 · ขนาด 256×256 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
IRON COLOSSUS — a colossal octagonal war-golem chassis made of riveted iron plates, thick armored front plate, a sealed round core hatch in the chest, NO arms (arms are separate sprites), winding up a powerful attack, body coiled, accent glow intensified. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #8fa8ff steel blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_colossus_attack.png`** — P1 · ขนาด 256×256 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
IRON COLOSSUS — a colossal octagonal war-golem chassis made of riveted iron plates, thick armored front plate, a sealed round core hatch in the chest, NO arms (arms are separate sprites), unleashing an attack forward to the right, fully extended. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #8fa8ff steel blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_colossus_stagger.png`** — P1 · ขนาด 256×256 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
IRON COLOSSUS — a colossal octagonal war-golem chassis made of riveted iron plates, thick armored front plate, a sealed round core hatch in the chest, NO arms (arms are separate sprites), staggered and off-balance, posture broken, dazed, armor cracked, leaning backwards. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #8fa8ff steel blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_colossus_death.png`** — P1 · ขนาด 256×256 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
IRON COLOSSUS — a colossal octagonal war-golem chassis made of riveted iron plates, thick armored front plate, a sealed round core hatch in the chest, NO arms (arms are separate sprites), defeated and shattered seen from above, body breaking apart into ink shards and fading glow. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #8fa8ff steel blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_colossus_idle_p2.png`** — P2 · ขนาด 256×256 ต่อเฟรม · BG: white → ลบพื้นหลัง · เวอร์ชันเฟส 2 (ไม่บังคับ) ทำท่าอื่นแบบ _p2 ได้เหมือนกัน
```text
IRON COLOSSUS — a colossal octagonal war-golem chassis made of riveted iron plates, thick armored front plate, a sealed round core hatch in the chest, NO arms (arms are separate sprites), PHASE 2 enraged form: cracked armor leaking light, more aggressive posture, aura flames, standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff7a3c molten orange only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```

### Boss: Mirror

**`boss_mirror_idle.png`** — P0 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
MIRROR SOVEREIGN — a dark reflection of the ronin duelist player (hooded cowl, flowing scarf) wearing a crown of five sharp spikes on the back of the head, holding a katana, inverted glossy black with magenta and white glow, standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff5af1 magenta and pure white only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_mirror_move.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
MIRROR SOVEREIGN — a dark reflection of the ronin duelist player (hooded cowl, flowing scarf) wearing a crown of five sharp spikes on the back of the head, holding a katana, inverted glossy black with magenta and white glow, advancing to the right. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff5af1 magenta and pure white only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_mirror_windup.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
MIRROR SOVEREIGN — a dark reflection of the ronin duelist player (hooded cowl, flowing scarf) wearing a crown of five sharp spikes on the back of the head, holding a katana, inverted glossy black with magenta and white glow, winding up a powerful attack, body coiled, accent glow intensified. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff5af1 magenta and pure white only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_mirror_attack.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
MIRROR SOVEREIGN — a dark reflection of the ronin duelist player (hooded cowl, flowing scarf) wearing a crown of five sharp spikes on the back of the head, holding a katana, inverted glossy black with magenta and white glow, unleashing an attack forward to the right, fully extended. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff5af1 magenta and pure white only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_mirror_stagger.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
MIRROR SOVEREIGN — a dark reflection of the ronin duelist player (hooded cowl, flowing scarf) wearing a crown of five sharp spikes on the back of the head, holding a katana, inverted glossy black with magenta and white glow, staggered and off-balance, posture broken, dazed, armor cracked, leaning backwards. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff5af1 magenta and pure white only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_mirror_death.png`** — P1 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง
```text
MIRROR SOVEREIGN — a dark reflection of the ronin duelist player (hooded cowl, flowing scarf) wearing a crown of five sharp spikes on the back of the head, holding a katana, inverted glossy black with magenta and white glow, defeated and shattered seen from above, body breaking apart into ink shards and fading glow. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff5af1 magenta and pure white only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`boss_mirror_idle_p2.png`** — P2 · ขนาด 110×110 ต่อเฟรม · BG: white → ลบพื้นหลัง · เวอร์ชันเฟส 2 (ไม่บังคับ) ทำท่าอื่นแบบ _p2 ได้เหมือนกัน
```text
MIRROR SOVEREIGN — a dark reflection of the ronin duelist player (hooded cowl, flowing scarf) wearing a crown of five sharp spikes on the back of the head, holding a katana, inverted glossy black with magenta and white glow, PHASE 2 enraged form: cracked armor leaking light, more aggressive posture, aura flames, standing in a commanding idle stance. strict top-down orthographic view seen directly from above (bird's-eye, 90 degrees), we see the top of the head and shoulders, the character FACES RIGHT (towards the right edge of the image), centered in the frame with empty margin around it. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff5af1 magenta and pure white only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```

### Projectiles

**`proj_orb.png`** — P0 · ขนาด 32×32 · BG: black (ไม่ต้องลบ) · ขาวบนดำ เกมย้อมสี
```text
2D game visual effect sprite: a small round energy orb with a bright white core and soft glow halo. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`proj_orb_parry.png`** — P0 · ขนาด 40×40 · BG: black (ไม่ต้องลบ) · ใช้สีทองในภาพ ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a golden energy orb with a thin bright ring around it, signalling it can be deflected. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, gold and warm white, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`proj_knife.png`** — P0 · ขนาด 48×16 · BG: white → ลบพื้นหลัง · วาดเป็นสีขาว/เทา (ไม่ต้องมีสีนีออน) เกมย้อมสีให้ — ต้องลบพื้นหลัง
```text
a single slim throwing knife flying to the right, pure white blade with grey shading, tiny motion streak. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Pure white and light grey only, no neon color (the game tints it). isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`proj_missile.png`** — P0 · ขนาด 40×20 · BG: white → ลบพื้นหลัง
```text
a small black homing missile flying to the right, fins at the back, orange glowing thruster at the left end. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff7a3c molten orange only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`proj_mine.png`** — P1 · ขนาด 32×32 · BG: white → ลบพื้นหลัง
```text
a small round landmine disk seen from above, dark metal, dim red light in the middle. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff4d6d blood red only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`proj_mine_armed.png`** — P1 · ขนาด 32×32 · BG: white → ลบพื้นหลัง
```text
a small round landmine disk seen from above, dark metal, bright pulsing red light and warning ring. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #ff4d6d blood red only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`proj_wave.png`** — P1 · ขนาด 120×120 · BG: black (ไม่ต้องลบ) · ขาวบนดำ เกมย้อมสี
```text
2D game visual effect sprite: a crescent shockwave blade of energy moving to the right, the convex side facing right. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```

### Arena

**`arena_floor.png`** — P0 · ขนาด 2048×2048 · BG: black/ทึบ ใช้ได้เลย · ต้องมืดและเรียบ อย่าใส่รายละเอียดแรง
```text
a perfectly circular duel arena floor seen from directly above (orthographic), dark obsidian stone slabs, a faint engraved concentric ring and a hexagonal sigil in the center, subtle cracks and ink stains, VERY low contrast and dark so characters stay readable, the circle fills the whole image edge to edge, pure black outside the circle. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`arena_edge.png`** — P0 · ขนาด 2048×2048 · BG: white → ลบพื้นหลัง · ต้องเป็นวงแหวนอย่างเดียว ตรงกลางโปร่ง — ลบพื้นหลังทั้งในและนอกวง
```text
a circular arena boundary wall seen from directly above: only a thin ring of carved stone with glowing cyan rune ticks, the ring's outer edge touching 95% of the image width, EMPTY transparent center and outside. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`bg_void.png`** — P0 · ขนาด 512×512 · BG: black/ทึบ ใช้ได้เลย · ต้องต่อกันได้ไร้รอยต่อ (seamless/tileable)
```text
seamless tileable texture of a dark abyss seen from above: black void with faint drifting ink clouds and a few tiny dim stars, very dark, low contrast. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`pillar.png`** — P0 · ขนาด 160×160 · BG: white → ลบพื้นหลัง
```text
the top of an octagonal stone pillar seen from directly above, carved rune circle on top, cold blue glowing seams. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #8fa8ff steel blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`pillar_cracked.png`** — P1 · ขนาด 160×160 · BG: white → ลบพื้นหลัง
```text
the top of an octagonal stone pillar seen from directly above, heavily cracked and chipped, glowing seams flickering. flat lay seen directly from above, object pointing horizontally to the RIGHT, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. Neon accent color: #8fa8ff steel blue only. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```

### VFX

**`vfx_slash.png`** — P0 · ขนาด 256×256 (6 เฟรม) · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a single crescent sword-slash arc on the RIGHT half of the image, sweeping from top to bottom around the image center, thick in the middle and tapered at both ends. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_slash_spin.png`** — P0 · ขนาด 256×256 (6 เฟรม) · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a full 360-degree circular sword-slash ring around the image center, tapered spiral brush stroke. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_thrust.png`** — P0 · ขนาด 256×64 (5 เฟรม) · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a straight horizontal piercing thrust streak starting at the LEFT edge and shooting to the right, sharp spear-tip end. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_hit.png`** — P0 · ขนาด 128×128 (5 เฟรม) · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: an impact starburst spark, sharp radial ink spikes from the center. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_hit_crit.png`** — P0 · ขนาด 160×160 (6 เฟรม) · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a bigger critical-hit impact starburst with a cross-shaped lens flare and flying ink fragments. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_parry.png`** — P0 · ขนาด 256×256 (8 เฟรม) · BG: black (ไม่ต้องลบ) · ใช้สีในภาพ (ขาว-ทอง) ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a dramatic deflection flash: blinding white-gold starburst, a ring shockwave and sparks flying outwards — the most spectacular effect in the game. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, white and gold, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_explosion.png`** — P0 · ขนาด 256×256 (8 เฟรม) · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: an ink explosion burst: expanding blob of ink splashes with a hot glowing center and debris. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_shockwave.png`** — P0 · ขนาด 256×256 (6 เฟรม) · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a ground shockwave ring seen from above, expanding circle with cracked dust edge. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_block.png`** — P1 · ขนาด 96×96 (4 เฟรม) · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a small blocked-hit spark burst on a guard, short sparks spraying to the left. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_portal.png`** — P1 · ขนาด 128×128 (8 เฟรม) · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a swirling summoning portal seen from above, spiral ink vortex with a bright center. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_execute.png`** — P1 · ขนาด 320×320 (8 เฟรม) · BG: black (ไม่ต้องลบ) · ใช้สีในภาพ ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a giant X-shaped double slash finishing blow with radiating light rays. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, gold and white, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_storm_blade.png`** — P1 · ขนาด 32×64 · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a single small spinning sword blade, vertical orientation. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```
**`vfx_vortex.png`** — P1 · ขนาด 256×256 (8 เฟรม) · BG: black (ไม่ต้องลบ) · ภาพขาว/เทาบนพื้นดำ เกมย้อมสีและวาดแบบบวกแสงให้ — ไม่ต้องลบพื้นหลัง
```text
2D game visual effect sprite: a swirling gravity vortex seen from above, spiral arms pulling inwards to a dark center. Ink brush-stroke energy, sharp tapered strokes with ink splatter flecks, glowing core, pure white and light grey only, monochrome, on a pure solid black background (#000000), nothing else in the image, centered, high contrast, top-down view
```

### UI

**`ui_logo.png`** — P1 · ขนาด 1200×300 · BG: white → ลบพื้นหลัง
```text
the game title logo text "NEON DUEL" in bold angular futuristic letters with a sumi-e ink brush slash cutting through it, cyan neon outline glow, wide horizontal layout. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`ui_cursor.png`** — P1 · ขนาด 32×32 · BG: white → ลบพื้นหลัง · จุดกลาง = จุดคลิก
```text
a minimal crosshair reticle: four short cyan tick marks around a tiny center dot, thin and sharp. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`icon_skill_phantom.png`** — P1 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game skill icon: three ghostly dash slashes crossing, single bold ink symbol with neon cyan accent, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_skill_storm.png`** — P1 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game skill icon: four blades orbiting in a circle, single bold ink symbol with neon cyan accent, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_skill_fan.png`** — P1 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game skill icon: a fan of throwing knives spreading out, single bold ink symbol with neon cyan accent, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_skill_mark.png`** — P1 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game skill icon: a kunai with a target mark, single bold ink symbol with neon cyan accent, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_skill_leap.png`** — P1 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game skill icon: a meteor crashing down onto the ground, single bold ink symbol with neon cyan accent, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_skill_well.png`** — P1 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game skill icon: a gravity vortex spiral, single bold ink symbol with neon cyan accent, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_skill_overdrive.png`** — P1 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game skill icon: a blazing eye surrounded by energy flames, single bold ink symbol with neon cyan accent, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_weapon_katana.png`** — P1 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game weapon icon of a katana, bold ink silhouette with neon edge, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_weapon_daggers.png`** — P1 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game weapon icon of two crossed daggers, bold ink silhouette with neon edge, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_weapon_hammer.png`** — P1 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game weapon icon of a heavy war hammer, bold ink silhouette with neon edge, centered. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`portrait_vanguard.png`** — P1 · ขนาด 640×640 · BG: white → ลบพื้นหลัง · ภาพเปิดตัวบอส มุมหน้าได้
```text
a dramatic boss portrait bust (front view, this one is NOT top-down): THE VANGUARD armored knight with tower shield and longsword, gold glow, intense ink brushwork, menacing, upper body, facing slightly right. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`portrait_hex.png`** — P1 · ขนาด 640×640 · BG: white → ลบพื้นหลัง · ภาพเปิดตัวบอส มุมหน้าได้
```text
a dramatic boss portrait bust (front view, this one is NOT top-down): HEX WEAVER floating sorceress with a single glowing eye-gem, violet glow, intense ink brushwork, menacing, upper body, facing slightly right. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`portrait_twins.png`** — P1 · ขนาด 640×640 · BG: white → ลบพื้นหลัง · ภาพเปิดตัวบอส มุมหน้าได้
```text
a dramatic boss portrait bust (front view, this one is NOT top-down): KAEL the crimson swordsman and VEX the indigo knife assassin back to back, intense ink brushwork, menacing, upper body, facing slightly right. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`portrait_colossus.png`** — P1 · ขนาด 640×640 · BG: white → ลบพื้นหลัง · ภาพเปิดตัวบอส มุมหน้าได้
```text
a dramatic boss portrait bust (front view, this one is NOT top-down): IRON COLOSSUS giant iron golem with a molten core, steel blue glow, intense ink brushwork, menacing, upper body, facing slightly right. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`portrait_mirror.png`** — P1 · ขนาด 640×640 · BG: white → ลบพื้นหลัง · ภาพเปิดตัวบอส มุมหน้าได้
```text
a dramatic boss portrait bust (front view, this one is NOT top-down): MIRROR SOVEREIGN, a crowned dark reflection of a hooded ronin, magenta and white glow, intense ink brushwork, menacing, upper body, facing slightly right. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. isolated on a plain pure white background (#FFFFFF), no floor, no cast shadow, no environment.
```
**`ui_card_common.png`** — P1 · ขนาด 260×340 · BG: black/ทึบ ใช้ได้เลย · ตรงกลางต้องว่าง (เกมใส่ข้อความเอง)
```text
an empty vertical card frame for an upgrade card, dark ink-washed panel with an ornate steel blue neon border and corner ornaments, EMPTY center for text. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`ui_card_rare.png`** — P1 · ขนาด 260×340 · BG: black/ทึบ ใช้ได้เลย · ตรงกลางต้องว่าง (เกมใส่ข้อความเอง)
```text
an empty vertical card frame for an upgrade card, dark ink-washed panel with an ornate emerald green neon border and corner ornaments, EMPTY center for text. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`ui_card_epic.png`** — P1 · ขนาด 260×340 · BG: black/ทึบ ใช้ได้เลย · ตรงกลางต้องว่าง (เกมใส่ข้อความเอง)
```text
an empty vertical card frame for an upgrade card, dark ink-washed panel with an ornate violet neon border and corner ornaments, EMPTY center for text. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`ui_card_legendary.png`** — P1 · ขนาด 260×340 · BG: black/ทึบ ใช้ได้เลย · ตรงกลางต้องว่าง (เกมใส่ข้อความเอง)
```text
an empty vertical card frame for an upgrade card, dark ink-washed panel with an ornate gold neon border and corner ornaments, EMPTY center for text. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`art_weapon_katana.png`** — P2 · ขนาด 560×280 · BG: black/ทึบ ใช้ได้เลย
```text
a wide dramatic weapon showcase illustration of a katana drawn in a fast iaido slash, side view, ink splash composition, #7ff6ff electric cyan neon glow. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`art_weapon_daggers.png`** — P2 · ขนาด 560×280 · BG: black/ทึบ ใช้ได้เลย
```text
a wide dramatic weapon showcase illustration of twin daggers in a reverse grip, side view, ink splash composition, #ff4d8a hot pink neon glow. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`art_weapon_hammer.png`** — P2 · ขนาด 560×280 · BG: black/ทึบ ใช้ได้เลย
```text
a wide dramatic weapon showcase illustration of a gravity hammer slammed into cracked ground, side view, ink splash composition, #ffb347 molten amber neon glow. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_w_katana.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a katana, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_w_daggers.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of twin daggers, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_w_hammer.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a war hammer, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_dash+.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of two dash chevrons, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_dashcd.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a circular arrow around a dash chevron, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_flame.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a trail of flames, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_nova.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a shield emitting a burst, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_window.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of an eye inside a target ring, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_thunder.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a blade struck by lightning, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_blood.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a bleeding heart, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_speed.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a winged foot, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_hp.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of an iron heart, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_focus.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a glowing crystal, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_exec.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a skull with an X slash, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_after.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a ghostly afterimage silhouette, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_posture.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a fist breaking a hexagon, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_glass.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a cracked glass diamond, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_sharp.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a gleaming sword edge, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_wind.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a phoenix feather, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_charge.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a charging lightning bolt, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_reflect.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a mirror shield bouncing an arrow, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_momentum.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a rising arrow, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_stamina.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a glowing energy core, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_tempo.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a metronome with blades, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_cheap.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a half-filled focus gauge, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_od.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of an infinity loop of energy, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_reaper.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a scythe, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```
**`icon_upgrade_mend.png`** — P2 · ขนาด 64×64 · BG: black/ทึบ ใช้ได้เลย
```text
a square game upgrade icon of a stitched heart, single bold ink symbol with neon accent glow, centered, readable at small size. Ink & Neon art style: matte black sumi-e ink silhouette with sharp, confident brush-stroke edges and subtle dry-brush texture, deep charcoal and black body with almost no interior detail, a FEW thin glowing neon accent lines only (weapon edge, eyes, energy core, armor seams), high contrast, bold readable silhouette, clean 2D game sprite, painterly but crisp. on a pure solid black background (#000000), nothing else in the image.
```

## 5. หลัง generate (Post-processing)

1. **ลบพื้นหลัง** ภาพที่ BG = white (remove.bg, Photoshop *Remove Background*, หรือ Select > Color Range สีขาว)
2. **ครอป** ให้ตัวอยู่กลางภาพ แล้ว **ย่อ** เป็นขนาดในตาราง (ภาพตัวละครทุกเฟรมต้องขนาดเท่ากัน)
3. **อาวุธ:** ครอปให้ปลายด้ามชิดขอบซ้าย (จุดหมุน) · **โล่/แขนบอส:** ภาพเท่ากับตัวบอส จุดกลางภาพ = กลางตัวบอส
4. **แยกเลเยอร์เรืองแสง (แนะนำมาก):** ใน Photoshop เลือกเฉพาะเส้นนีออน (Select > Color Range สีนีออน) → copy ไปเป็นไฟล์ `<ชื่อ>_glow.png` → ไฟล์หลักทำเส้นนั้นให้หมองลง เกมจะทำให้เส้นเรืองแสงจริงและกะพริบเวลาโดนตี
5. **แอนิเมชัน:** AI ทำเฟรมต่อเนื่องได้ไม่สม่ำเสมอ แนะนำให้ใช้ภาพจาก AI เป็นเฟรมหลัก แล้วทำเฟรมเพิ่มด้วยการขยับ/บิดเล็กน้อย (Photoshop Puppet Warp, Aseprite, หรือ Spine) แล้วเรียงเป็นแถวนอน → ถ้ายังไม่มีเวลา ใส่ **1 เฟรม** ก็ใช้ได้ เกมจะหมุนและขยับให้
6. **VFX:** ถ้าได้ภาพเดียว ใช้เป็นเฟรมกลาง แล้วทำเฟรมก่อน/หลังโดยย่อ-ขยายและลดความทึบ เรียงเป็นแถวนอน
7. วางไฟล์ใน `src/assets/sprites/` แล้วเปิด `http://localhost:5173/?sprites=1` ตรวจขนาด จุดหมุน และชื่อไฟล์

**ลำดับที่แนะนำ:** `player_idle` → `weapon_katana` → ส่งให้ตรวจสไตล์และขนาดก่อน → ศัตรู 4 ตัว (idle) → `arena_floor`, `bg_void`, `arena_edge` → VFX หลัก → บอสตามลำดับด่าน → UI
