Drop character GLB files here and add models.json (see js/models.js header):
{ "height": 1.78, "hero": "hero.glb", "police": ["police.glb"], "npcs": ["npc_01.glb", {"file": "npc_02.glb", "gender": "f"}] }
Without models.json the game uses the built-in procedural characters.
Budget: hero <= 15k tris, NPC/police 3k-6k tris, one 1024px texture (hero 2048), rigged humanoid, clips named idle/walk/run.
