function formatMenuItem(m) {
  // แปลง shape จากผล SQL ให้ frontend ใช้งานง่ายขึ้น
  // name = ชื่ออังกฤษเป็นหลัก ถ้าไม่มีค่อย fallback ไปชื่อไทย
  return {
    id: m.id,
    name: m.name_en || m.name_th,
    name_th: m.name_th,
    category: m.category_code,
    price: parseFloat(m.price),
    img: m.emoji || "🍽️",
    image_url: m.image_url || null,
    available: m.is_available ? 1 : 0,
    toppings: m.toppings || [],
  };
}

// Query ส่วนแรก: ดึงข้อมูลเมนูหลัก + รวม topping ทุกตัวของเมนูเดียวกัน
// ไว้ใน field เดียวชื่อ toppings_raw เพื่อให้ query ออกมาทีละ 1 แถวต่อ 1 เมนู
const MENU_SELECT = `
  SELECT
    mi.id, mi.name_th, mi.name_en, mi.price, mi.emoji, mi.image_url, mi.is_available,
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

// Query ส่วนหลัง: จัดกลุ่มผลลัพธ์และเรียงลำดับเมนู
const MENU_GROUP = " GROUP BY mi.id, mc.code ORDER BY mc.sort_order, mi.name_th";

function parseToppings(raw) {
  // topping ถูกเก็บมาเป็น string เดียวคั่นด้วย ||
  // ฟังก์ชันนี้แยกให้กลับมาเป็น array สำหรับ frontend
  if (!raw) return [];
  return raw.split("||").map((t) => t.trim()).filter(Boolean);
}

module.exports = {
  formatMenuItem,
  MENU_SELECT,
  MENU_GROUP,
  parseToppings,
};
