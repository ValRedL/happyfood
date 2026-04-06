function startAutoMaintenance(pool) {
  return setInterval(async () => {
    try {
      const [result1] = await pool.query(`
        UPDATE restaurant_tables
        SET status = 'vacant', current_order_id = NULL, updated_at = NOW()
        WHERE status = 'occupied' AND updated_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)
      `);
      if (result1.affectedRows > 0) {
        console.log(`✅ Auto-released ${result1.affectedRows} stuck occupied tables`);
      }

      const [result2] = await pool.query(`
        UPDATE restaurant_tables
        SET status = 'vacant', current_order_id = NULL, updated_at = NOW()
        WHERE status = 'cleaning' AND updated_at < DATE_SUB(NOW(), INTERVAL 10 MINUTE)
      `);
      if (result2.affectedRows > 0) {
        console.log(`✅ Auto-released ${result2.affectedRows} stuck cleaning tables`);
      }

      const [result3] = await pool.query(`
        UPDATE customer_sessions
        SET is_active = 0, ended_at = NOW()
        WHERE is_active = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 3 HOUR)
      `);
      if (result3.affectedRows > 0) {
        console.log(`✅ Auto-closed ${result3.affectedRows} stuck sessions`);
      }
    } catch (e) {
      console.error("❌ Auto-maintenance error:", e.message);
    }
  }, 300000);
}

module.exports = {
  startAutoMaintenance,
};
