# Realistic character models — integration note v2 (from the character-art specialist)

## What's here (v2 fixes)
- hero.glb — 14,010 tris, 1.6MB (default hero: mustard top, jeans, backpack)
- hero_hoodie.glb — 9,095 tris, 1.7MB (green hooded jacket + jeans, haircut short01)
- hero_redtee.glb — 10,443 tris, 1.4MB (red raglan tee + jeans, haircut short04)
- hero_bluetee.glb — 9,881 tris, 1.1MB (blue long-sleeve tee + jeans, haircut short03)
- police.glb 5,693 tris, npc_01 4,864, npc_02 5,654, npc_03 5,049,
  npc_04 4,882, npc_05 5,611, npc_06 5,287 (all 0.4–0.8MB)
- models.json — same contract as before, default hero entry stays hero.glb

## v2 changes
1. npc_03 hijab rebuilt: draped mesh covering hair, ears, neck and shoulders,
   face opening only, dark green. No scalp show-through.
2. Materials export OPAQUE everywhere EXCEPT hair/eyes/eyebrows
   (Human.short0X, Human.low-poly, Human.eyebrow0XX stay BLEND for
   alpha-clip). The loader-side opaque-forcing hack can be dropped.
3. Hero variants for the shops: hero_hoodie / hero_redtee / hero_bluetee.
   Same 53-joint rig, same idle/walk/run/talk clips, same 1.78m normalize,
   same budgets. To swap at runtime: load the variant GLB exactly like
   hero.glb and replace the hero instance — no other changes. Clothes shop
   swaps tops (all three), barber swaps haircuts (each variant has a
   different one; a recut of any variant with another short0X haircut is a
   12-second rebuild — ask).
4. New clip on EVERY GLB: "talk" (90-frame loop: head nods + one-hand
   gestures) for dialogue/cutscene moments. The loader's idle/walk/run
   regexes are unaffected; talk is opt-in via gltf.animations.

## Verified
- GLB-level: all 11 files parsed; clips idle/walk/run/talk present; alpha
  modes as above; tri counts in budget.
- In-engine: headless Chrome against the local repo, game fetched all GLBs
  (HTTP 200) and rendered the hero at spawn (screenshot taken).
- Hero variants rendered via GLB re-import (fixes.png in the report).

## Known limitations (unchanged from v1)
- Hand-keyed procedural clips, not mocap. Hero tops are CC0 assets: the
  hoodie variant is a hooded jacket (no pullover-hoodie mesh exists CC0).
- Hijab/beret/galabeya/apron/backpack are procedural extras, solid colors.
- Several small textures per GLB rather than one atlas (few extra draw
  calls, trivial at this cast size). Textures are WebP.
- Hair/skin tints via base color factor show darker in-game than raw
  texture previews.
