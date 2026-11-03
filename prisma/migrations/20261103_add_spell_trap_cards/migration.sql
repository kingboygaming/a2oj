ALTER TABLE "GachaCard" ADD COLUMN "battleType" TEXT NOT NULL DEFAULT 'MONSTER';

INSERT INTO "GachaCard" (
    "id", "slug", "name", "description", "rarity", "specialOnly", "category",
    "battleType", "manaCost", "level", "element", "icon", "specialEffect"
) VALUES
    ('a2oj_starter_spell_draw', 'a2oj-menh-de-tiep-te', 'Mệnh Đề Tiếp Tế',
     'Rút thêm một lá từ bộ bài nếu vẫn còn lá.',
     'COMMON', false, 'BATTLE', 'SPELL', 2, 1, 'Phép', '📚', 'SPELL_DRAW'),
    ('a2oj_starter_spell_heal', 'a2oj-vong-hoi-phuc', 'Vòng Hồi Phục',
     'Khôi phục 5 HP hoặc 1000 LP cho người sử dụng.',
     'COMMON', false, 'BATTLE', 'SPELL', 2, 1, 'Phép', '💚', 'SPELL_HEAL'),
    ('a2oj_starter_spell_strike', 'a2oj-xung-dot-bit', 'Xung Đột Bit',
     'Gây 4 sát thương hoặc 800 LP cho đối thủ.',
     'COMMON', false, 'BATTLE', 'SPELL', 3, 1, 'Phép', '⚡', 'SPELL_DAMAGE'),
    ('a2oj_starter_trap_negate', 'a2oj-luoi-chan-tin-hieu', 'Lưới Chặn Tín Hiệu',
     'Úp xuống sân. Khi đối thủ tấn công, hủy sát thương của đòn đánh đó.',
     'COMMON', false, 'BATTLE', 'TRAP', 2, 1, 'Bẫy', '🕸️', 'TRAP_NEGATE_ATTACK'),
    ('a2oj_starter_trap_reflect', 'a2oj-guong-doi-xung', 'Gương Đối Xứng',
     'Úp xuống sân. Khi đối thủ tấn công, phản lại 25% sát thương.',
     'COMMON', false, 'BATTLE', 'TRAP', 2, 1, 'Bẫy', '🪞', 'TRAP_REFLECT_DAMAGE')
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "GachaBanner" ("id", "slug", "title", "description", "type", "active")
VALUES (
    'a2oj_spell_trap_starter_banner',
    'a2oj-spell-trap-starter',
    'Bộ khởi đầu: Phép & Bẫy A2OJ',
    'Các lá Phép và Bẫy nguyên bản để bắt đầu xây dựng chiến thuật PvP.',
    'NORMAL',
    true
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "GachaBannerCard" ("bannerId", "cardId", "dropRate")
SELECT banner."id", card."id", 20
FROM "GachaBanner" AS banner
CROSS JOIN "GachaCard" AS card
WHERE banner."slug" = 'a2oj-spell-trap-starter'
AND card."slug" IN (
    'a2oj-menh-de-tiep-te',
    'a2oj-vong-hoi-phuc',
    'a2oj-xung-dot-bit',
    'a2oj-luoi-chan-tin-hieu',
    'a2oj-guong-doi-xung'
)
ON CONFLICT ("bannerId", "cardId") DO NOTHING;
