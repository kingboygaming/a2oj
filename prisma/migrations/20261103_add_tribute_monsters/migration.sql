INSERT INTO "GachaCard" (
    "id", "slug", "name", "description", "rarity", "specialOnly", "category",
    "battleType", "attack", "defense", "manaCost", "level", "element", "icon", "specialEffect"
) VALUES
    ('a2oj_starter_tribute_five', 'a2oj-nguoi-gac-kho-du-lieu', 'Người Gác Kho Dữ Liệu',
     'Quái vật cấp 5. Cần hiến tế 1 quái vật đang có trên sân để triệu hồi theo luật OCG.',
     'COMMON', false, 'BATTLE', 'MONSTER', 1800, 2000, 2, 5, 'Tin học', '🛡️', 'NONE'),
    ('a2oj_starter_tribute_seven', 'a2oj-nguoi-giu-vong-lap', 'Người Giữ Vòng Lặp',
     'Quái vật cấp 7. Cần hiến tế 2 quái vật đang có trên sân để triệu hồi theo luật OCG.',
     'COMMON', false, 'BATTLE', 'MONSTER', 2500, 2200, 3, 7, 'Tin học', '🔱', 'NONE')
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "GachaBanner" ("id", "slug", "title", "description", "type", "active")
VALUES (
    'a2oj_tribute_monsters_banner',
    'a2oj-tribute-monsters',
    'Quái vật cần hiến tế',
    'Quái vật cấp cao nguyên bản, cần hiến tế quái vật trên sân theo luật OCG.',
    'NORMAL',
    true
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "GachaBannerCard" ("bannerId", "cardId", "dropRate")
SELECT banner."id", card."id", 50
FROM "GachaBanner" AS banner
CROSS JOIN "GachaCard" AS card
WHERE banner."slug" = 'a2oj-tribute-monsters'
AND card."slug" IN (
    'a2oj-nguoi-gac-kho-du-lieu',
    'a2oj-nguoi-giu-vong-lap'
)
ON CONFLICT ("bannerId", "cardId") DO NOTHING;
