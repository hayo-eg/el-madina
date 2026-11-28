# Realistic character models — integration note (from the character-art specialist)

## What's here
- hero.glb — 14,010 tris, 1.6 MB, 2048px textures
- police.glb — 5,693 tris, 0.44 MB (white uniform + black beret)
- npc_01.glb — 4,864 tris, 0.75 MB (taxi driver, striped shirt + jeans)
- npc_02.glb — 5,654 tris, 0.60 MB (koshary vendor, overalls + apron)
- npc_03.glb — 5,049 tris, 0.48 MB (woman, green hijab + skirt) gender "f"
- npc_04.glb — 4,882 tris, 0.79 MB (teen, red shirt) 
- npc_05.glb — 5,611 tris, 0.55 MB (older man, brown galabeya with sleeves)
- npc_06.glb — 5,287 tris, 0.52 MB (businessman, dark suit)
- models.json — already wired per js/models.js contract

Total payload ~5.6 MB. All NPCs within the 3k–6k tri budget, hero within 15k.

## Contract
Every GLB: one skinned humanoid (UE-style joint names), clips named exactly
idle / walk / run (matches the loader's /idle|stand|breath/, /walk/, /run|jog/
regexes), height normalized by the loader to 1.78 (models.json carries
per-file heights for the woman 1.65, teen 1.68, older man 1.72).

## Verified
- All 8 GLBs + models.json fetched by the game (HTTP 200) and the hero renders
  in-engine (headless Chrome screenshot taken at spawn).
- Walk clips verified by re-importing the GLBs and rendering frames.

## Known limitations (be honest with the user)
- Clips are hand-keyed procedural cycles (idle sway, walk, run), not mocap.
  Good at phone distance, not cinematic close-up quality.
- Hero top is a mustard button shirt; no hoodie mesh exists in the CC0 set.
- Bodies/faces come from MakeHuman Community (MPFB2, CC0): realistic
  proportions and skin, but not bespoke-sculpted like the Gemini renders.
- Hijab, beret, galabeya, apron, backpack are procedural extras (simple
  geometry, solid colors); they read correctly at gameplay distance.
- Each GLB carries several small textures (skin/clothes/hair) rather than
  one atlas — a few extra draw calls, trivial for this cast size; total
  bytes are small. Textures are WebP inside the GLB.
- Hair/skin tints are applied via material base color, so they look darker
  in-game than in raw texture previews.
- Taxi driver shirt is striped (closest available); woman's skirt is
  knee-length, not ankle-length.

## If a model needs replacing
Drop a new GLB over the file, keep the name + clip names, keep tris in
budget. Nothing else to change.
