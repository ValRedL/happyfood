function formatMenuItem(m) {
  return {
    id: m.id,
    name: m.name_en || m.name_th,
    name_th: m.name_th,
    category: m.category_code,
    price: parseFloat(m.price),
    img: m.emoji || "🍽️",
    available: m.is_available ? 1 : 0,
    toppings: m.toppings || [],
  };
}

const MENU_SELECT = `
  SELECT
    mi.id, mi.name_th, mi.name_en, mi.price, mi.emoji, mi.is_available,
    mc.code AS category_code,
    GROUP_CONCAT(
      IF(mt.id IS NULL, NULL,
         CONCAT(mt.name_th, IF(mt.extra_price > 0, CONCAT(' (+', CAST(mt.extra_price AS CHAR), ')'), ''))
      )
      ORDER BY mt.sort_order SEPARATOR '||'
    ) AS toppings_raw
  FROM menu_items mi
  JOIN menu_categories mc ON mi.category_id = mc.id
  LEFT JOIN menu_toppings mt ON mt.menu_id = mi.id
  WHERE mi.is_deleted = FALSE
`;

const MENU_GROUP = " GROUP BY mi.id, mc.code ORDER BY mc.sort_order, mi.name_th";

function parseToppings(raw) {
  if (!raw) return [];
  return raw.split("||").map((t) => t.trim()).filter(Boolean);
}

module.exports = {
  formatMenuItem,
  MENU_SELECT,
  MENU_GROUP,
  parseToppings,
};
