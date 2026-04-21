const mysql = require('mysql2');

// ใช้ connection pool แทนการเปิด connection ใหม่ทุก request
// ข้อดีคือเร็วขึ้นและควบคุมจำนวน connection พร้อมกันได้ง่ายกว่า
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'happyfood',
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0
});

// เช็คการเชื่อมต่อครั้งแรกตอนเปิด server
// เพื่อให้เห็น error ตั้งแต่เริ่ม run ว่าต่อฐานข้อมูลได้หรือไม่
pool.getConnection((err, connection) => {
  if (err) {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('❌ Database connection was closed.');
    }
    if (err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
      console.error('❌ Database had a fatal error.');
    }
    if (err.code === 'PROTOCOL_ENQUEUE_AFTER_DESTROY') {
      console.error('❌ Database connection was destroyed.');
    }
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully');
    if (connection) connection.release();
  }
});

// export แบบ promise() เพื่อให้ route ใช้ await pool.query(...) ได้ตรงๆ
module.exports = pool.promise();
