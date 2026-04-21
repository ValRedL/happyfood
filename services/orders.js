async function fetchOrdersWithItems(pool, whereClause = "") {
  // ขั้นที่ 1: ดึงออเดอร์หลักก่อน
  // whereClause ถูกส่งเข้ามาจาก route เพื่อใช้กรอง เช่น เฉพาะ active orders
  const [orders] = await pool.query(
    `SELECT o.id, o.table_id, o.session_id, o.status,
            o.subtotal, o.vat_amount, o.total,
            o.is_paid, o.payment_method, o.created_at, o.paid_at
     FROM orders o ${whereClause} ORDER BY o.created_at ASC`
  );
  if (!orders.length) return [];

  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map(() => "?").join(",");

  // ขั้นที่ 2: ดึงรายการอาหารทั้งหมดของออเดอร์เหล่านี้ใน query เดียว
  // จะได้ไม่ต้องวน query ทีละ order ซึ่งช้ากว่า
  const [items] = await pool.query(
    `SELECT oi.id, oi.order_id, oi.menu_id, oi.menu_name_th AS name,
            mi.emoji AS img, oi.qty, oi.unit_price AS price,
            oi.line_total AS totalPrice, oi.special_note AS note
     FROM order_items oi
     LEFT JOIN menu_items mi ON mi.id = oi.menu_id
     WHERE oi.order_id IN (${placeholders})`,
    orderIds
  );

  const itemIds = items.map((i) => i.id);
  const toppingMap = {};

  if (itemIds.length) {
    const tPlaceholders = itemIds.map(() => "?").join(",");
    // ขั้นที่ 3: ดึง topping ของแต่ละ order item แล้วจัดเป็น map
    // รูปแบบที่ได้คือ { order_item_id: [topping1, topping2] }
    const [toppings] = await pool.query(
      `SELECT order_item_id, topping_name FROM order_item_toppings WHERE order_item_id IN (${tPlaceholders})`,
      itemIds
    );
    toppings.forEach((t) => {
      if (!toppingMap[t.order_item_id]) toppingMap[t.order_item_id] = [];
      toppingMap[t.order_item_id].push(t.topping_name);
    });
  }

  const itemsByOrder = {};
  // ขั้นที่ 4: รวม item กลับเข้าไปตาม order_id
  items.forEach((i) => {
    if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = [];
    itemsByOrder[i.order_id].push({
      menuId: i.menu_id,
      name: i.name,
      img: i.img || "🍽️",
      qty: i.qty,
      price: parseFloat(i.price),
      totalPrice: parseFloat(i.totalPrice),
      note: i.note || null,
      toppings: toppingMap[i.id] || [],
    });
  });

  // ขั้นสุดท้าย: คืนค่าในรูปแบบที่ frontend ใช้งานง่าย
  return orders.map((o) => ({
    id: o.id,
    tableId: o.table_id,
    sessionId: o.session_id,
    items: itemsByOrder[o.id] || [],
    subtotal: parseFloat(o.subtotal),
    total: parseFloat(o.total),
    status: o.status,
    paid: o.is_paid ? 1 : 0,
    paymentMethod: o.payment_method || null,
    createdAt: o.created_at,
    paidAt: o.paid_at,
  }));
}

module.exports = {
  fetchOrdersWithItems,
};
