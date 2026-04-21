# HappyFood

ระบบร้านอาหารตัวอย่างที่มี 3 ฝั่งหลักในโปรเจคเดียว:
- `Customer` สำหรับลูกค้าเลือกโต๊ะ ดูเมนู สั่งอาหาร ชำระเงิน และรีวิว
- `Chef / Cook` สำหรับครัวดูออเดอร์และเปลี่ยนสถานะอาหาร
- `Admin` สำหรับจัดการโต๊ะ เมนู ผู้ใช้ ยอดขาย รีวิว และประวัติ

README นี้ตั้งใจเขียนสำหรับคนที่ยังไม่ค่อยคุ้นกับโค้ด เพื่อช่วยตอบคำถามว่า:
- โปรเจคนี้เริ่มจากไฟล์ไหน
- ไฟล์แต่ละส่วนมีหน้าที่อะไร
- ข้อมูลวิ่งจากหน้าเว็บไปฐานข้อมูลอย่างไร
- ถ้าจะเริ่มอ่านโค้ด ควรอ่านลำดับไหนก่อน

## 1. ภาพรวมการทำงาน

เวลารันโปรเจคนี้ โครงหลักจะเป็นแบบนี้:

1. `app.js`
   จุดเริ่มต้นของ server
2. Express เปิด route ต่าง ๆ
   เช่น auth, customer, chef, admin
3. หน้าเว็บใน `views/`
   เรียก API ผ่าน `public/db-client.js`
4. route ฝั่ง backend
   รับ request แล้ว query MySQL
5. ฐานข้อมูล `happyfood`
   เก็บโต๊ะ เมนู ออเดอร์ การชำระเงิน รีวิว ผู้ใช้

สั้น ๆ คือ:

`HTML/JS หน้าเว็บ -> fetch API -> route -> MySQL -> ส่งผลกลับ -> หน้าเว็บ render`

## 2. โครงสร้างไฟล์สำคัญ

### จุดเริ่มต้นของระบบ

- [app.js](E:\Project Food\food-main\food-main\app.js)
  เปิด Express, โหลด route ทั้งหมด, เปิด Swagger, และ start server

- [db.js](E:\Project Food\food-main\food-main\db.js)
  ตั้งค่า MySQL connection pool

- [happyfood.sql](E:\Project Food\food-main\food-main\happyfood.sql)
  โครงสร้างฐานข้อมูล + seed data เริ่มต้น

### Route ฝั่ง backend

- [routes/auth.js](E:\Project Food\food-main\food-main\routes\auth.js)
  login, register chef, cook invite code

- [routes/customer.js](E:\Project Food\food-main\food-main\routes\customer.js)
  route ฝั่ง customer แบบมี prefix `/customer/...`

- [routes/chef.js](E:\Project Food\food-main\food-main\routes\chef.js)
  route สำหรับ chef panel และการอัปเดตสถานะออเดอร์

- [routes/admin.js](E:\Project Food\food-main\food-main\routes\admin.js)
  route สำหรับ admin เช่น users, tables

- [routes/aliases.js](E:\Project Food\food-main\food-main\routes\aliases.js)
  route รวมหลาย endpoint ที่หน้าเว็บเรียกใช้บ่อย
  ไฟล์นี้สำคัญมาก เพราะมี menu, tables, orders, reviews, sales หลายส่วน

- [routes/pages.js](E:\Project Food\food-main\food-main\routes\pages.js)
  route สำหรับเปิดหน้า HTML เช่น `/`, `/menu-page`, `/checkout`

### Service / helper ฝั่ง backend

- [services/menu.js](E:\Project Food\food-main\food-main\services\menu.js)
  รวม query และ helper ที่เกี่ยวกับเมนู

- [services/orders.js](E:\Project Food\food-main\food-main\services\orders.js)
  รวม helper สำหรับดึงออเดอร์พร้อมรายการอาหารและ toppings

- [services/maintenance.js](E:\Project Food\food-main\food-main\services\maintenance.js)
  งานดูแลระบบอัตโนมัติ

- [services/swagger.js](E:\Project Food\food-main\food-main\services\swagger.js)
  ตั้งค่า Swagger docs

### หน้าเว็บหลัก

- [views/table.html](E:\Project Food\food-main\food-main\views\table.html)
  หน้าเลือกร้าน/โต๊ะ เป็น entry หลักของลูกค้า

- [views/menu.html](E:\Project Food\food-main\food-main\views\menu.html)
  หน้าเมนูอาหาร + ตะกร้า + รีวิว

- [views/checkout.html](E:\Project Food\food-main\food-main\views\checkout.html)
  หน้าชำระเงินและรีวิวหลังจ่าย

- [views/order-history.html](E:\Project Food\food-main\food-main\views\order-history.html)
  ประวัติการสั่งซื้อของลูกค้า

- [views/kitchen.html](E:\Project Food\food-main\food-main\views\kitchen.html)
  หน้า chef panel / KDS

- [views/admin.html](E:\Project Food\food-main\food-main\views\admin.html)
  หน้า admin dashboard ขนาดใหญ่

- [views/login.html](E:\Project Food\food-main\food-main\views\login.html)
  หน้า login / chef register

### Frontend helper

- [public/db-client.js](E:\Project Food\food-main\food-main\public\db-client.js)
  เป็นตัวกลางให้หน้าเว็บเรียก API และเก็บข้อมูลใน localStorage / sessionStorage

## 3. Flow ของผู้ใช้แต่ละบทบาท

### Customer Flow

ลำดับทำงานหลักของลูกค้า:

1. เข้า [table.html](E:\Project Food\food-main\food-main\views\table.html)
2. เลือกโต๊ะ
3. ระบบสร้าง session ลูกค้า
4. ไป [menu.html](E:\Project Food\food-main\food-main\views\menu.html)
5. เลือกอาหารและเพิ่มลงตะกร้า
6. กดสั่งอาหาร
7. backend สร้างข้อมูลใน `orders`, `order_items`, `order_item_toppings`
8. chef เห็นออเดอร์ใน kitchen page
9. ลูกค้าไป [checkout.html](E:\Project Food\food-main\food-main\views\checkout.html)
10. ชำระเงิน
11. ส่งรีวิว
12. ระบบปิด session และคืนสถานะโต๊ะ

ไฟล์ที่เกี่ยวข้องมากที่สุด:
- [views/table.html](E:\Project Food\food-main\food-main\views\table.html)
- [views/menu.html](E:\Project Food\food-main\food-main\views\menu.html)
- [views/checkout.html](E:\Project Food\food-main\food-main\views\checkout.html)
- [routes/aliases.js](E:\Project Food\food-main\food-main\routes\aliases.js)
- [public/db-client.js](E:\Project Food\food-main\food-main\public\db-client.js)

### Chef Flow

ลำดับทำงานหลักของเชฟ:

1. login ผ่าน [login.html](E:\Project Food\food-main\food-main\views\login.html)
2. เข้า [kitchen.html](E:\Project Food\food-main\food-main\views\kitchen.html)
3. ดึง active orders จาก backend
4. เปลี่ยนสถานะออเดอร์ เช่น `pending -> cooking -> serving`

ไฟล์ที่เกี่ยวข้องมากที่สุด:
- [routes/auth.js](E:\Project Food\food-main\food-main\routes\auth.js)
- [routes/chef.js](E:\Project Food\food-main\food-main\routes\chef.js)
- [views/kitchen.html](E:\Project Food\food-main\food-main\views\kitchen.html)
- [services/orders.js](E:\Project Food\food-main\food-main\services\orders.js)

### Admin Flow

แอดมินใช้ระบบเพื่อ:
- ดู dashboard
- จัดการโต๊ะ
- จัดการเมนู
- สร้าง Cook ID
- ดูยอดขาย
- ดูรีวิว
- ดูประวัติ

ไฟล์ที่เกี่ยวข้องมากที่สุด:
- [views/admin.html](E:\Project Food\food-main\food-main\views\admin.html)
- [routes/admin.js](E:\Project Food\food-main\food-main\routes\admin.js)
- [routes/aliases.js](E:\Project Food\food-main\food-main\routes\aliases.js)
- [public/db-client.js](E:\Project Food\food-main\food-main\public\db-client.js)

## 4. ข้อมูลสำคัญในฐานข้อมูล

ตารางที่ควรรู้ก่อน:

- `users`
  เก็บ account ของ admin / chef

- `cook_ids`
  รหัสที่ admin สร้างให้ chef เอาไปสมัคร

- `restaurant_tables`
  เก็บสถานะโต๊ะ เช่น vacant, occupied, cleaning

- `customer_sessions`
  เก็บ session ของลูกค้าแต่ละโต๊ะ

- `menu_categories`
  หมวดหมู่เมนู

- `menu_items`
  รายการเมนูหลัก

- `menu_toppings`
  ตัวเลือกเสริมของแต่ละเมนู

- `orders`
  ข้อมูลออเดอร์หลัก

- `order_items`
  รายการอาหารในแต่ละออเดอร์

- `order_item_toppings`
  topping ของแต่ละ order item

- `sales`
  สรุปการขายหลังจ่ายเงินแล้ว

- `reviews`
  รีวิวและคะแนนจากลูกค้า

## 5. ถ้าจะเริ่มอ่านโค้ด ควรอ่านลำดับไหน

สำหรับมือใหม่ ผมแนะนำลำดับนี้:

1. [app.js](E:\Project Food\food-main\food-main\app.js)
   เพื่อดูว่า server ต่อ route ไหนบ้าง

2. [public/db-client.js](E:\Project Food\food-main\food-main\public\db-client.js)
   เพื่อเข้าใจว่าหน้าเว็บเรียก API ยังไง

3. [views/table.html](E:\Project Food\food-main\food-main\views\table.html)
   เพราะเป็นจุดเริ่มของลูกค้า

4. [views/menu.html](E:\Project Food\food-main\food-main\views\menu.html)
   เพื่อดูการเลือกเมนูและตะกร้า

5. [views/checkout.html](E:\Project Food\food-main\food-main\views\checkout.html)
   เพื่อดู flow จ่ายเงินและรีวิว

6. [routes/aliases.js](E:\Project Food\food-main\food-main\routes\aliases.js)
   เพราะ route หลักของ customer/admin จำนวนมากอยู่ที่นี่

7. [services/orders.js](E:\Project Food\food-main\food-main\services\orders.js)
   เพื่อดูการรวมข้อมูล order + items + toppings

8. [views/kitchen.html](E:\Project Food\food-main\food-main\views\kitchen.html)
   เพื่อดูฝั่ง chef

9. [views/admin.html](E:\Project Food\food-main\food-main\views\admin.html)
   ควรอ่านหลังสุด เพราะใหญ่และมีหลาย feature รวมกัน

## 6. วิธีรันโปรเจค

### 1) ติดตั้ง dependency

```powershell
npm install
```

### 2) import ฐานข้อมูล

ใช้ไฟล์:
- [happyfood.sql](E:\Project Food\food-main\food-main\happyfood.sql)

สร้างฐานข้อมูลชื่อ `happyfood` แล้ว import ไฟล์นี้เข้า phpMyAdmin หรือ MySQL

### 3) ตั้งค่า database

ค่าปัจจุบันอยู่ใน [db.js](E:\Project Food\food-main\food-main\db.js)

```js
host: 'localhost'
user: 'root'
password: ''
database: 'happyfood'
```

ถ้าเครื่องใหม่ใช้ user/password คนละแบบ ต้องแก้ตรงนี้ให้ตรงกับ MySQL ของเครื่องนั้น

### 4) รัน server

```powershell
node app.js
```

ถ้ารันสำเร็จจะเห็นประมาณนี้:

```text
HappyFood Server Running
http://localhost:3000
```

### 5) เปิดหน้าเว็บ

- Customer: [http://localhost:3000/](http://localhost:3000/)
- Login / Chef: [http://localhost:3000/login](http://localhost:3000/login)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)
- Swagger: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

## 7. จุดที่มักทำให้งง

### ทำไมมีทั้ง `routes/customer.js` และ `routes/aliases.js`

เพราะในโปรเจคนี้มีทั้ง:
- route ที่มี prefix ชัดเจน เช่น `/customer/...`
- route แบบ alias ที่หน้าเว็บปัจจุบันเรียกตรง เช่น `/orders`, `/tables`, `/menu/all`

ดังนั้นเวลาหา endpoint ไม่เจอ ให้เช็คทั้งสองไฟล์

### ทำไมข้อมูลบางอย่างอยู่ใน localStorage

เช่น:
- โต๊ะที่เลือก
- current order
- ภาษาที่ผู้ใช้เลือก

เหตุผลคือหน้าเว็บหลายหน้าต้องแชร์ข้อมูลต่อกัน แม้ user จะเปลี่ยนหน้า

### ทำไม create order / pay order ต้องใช้ transaction

เพราะ 1 action เขียนหลายตารางพร้อมกัน

ตัวอย่าง create order:
- เพิ่ม `orders`
- เพิ่ม `order_items`
- เพิ่ม `order_item_toppings`
- อัปเดต `restaurant_tables`

ถ้าทำไปได้แค่ครึ่งหนึ่งแล้ว error จะทำให้ข้อมูลเพี้ยน จึงต้องใช้ transaction

## 8. ไฟล์ที่ควรระวังเวลาแก้

- [views/admin.html](E:\Project Food\food-main\food-main\views\admin.html)
  ไฟล์ใหญ่และมี logic เยอะมาก แก้อะไรควรเช็คหลายหน้า

- [routes/aliases.js](E:\Project Food\food-main\food-main\routes\aliases.js)
  เป็นไฟล์รวม route สำคัญหลายระบบ แก้แล้วกระทบได้กว้าง

- [public/db-client.js](E:\Project Food\food-main\food-main\public\db-client.js)
  ถ้าเปลี่ยน API client อาจกระทบหลายหน้า frontend พร้อมกัน

## 9. ถ้าจะพัฒนาต่อ ควรแยกอะไรเพิ่ม

ตอนนี้โปรเจคใช้งานได้ แต่ถ้าจะทำให้อ่านง่ายขึ้นอีกในอนาคต แนะนำ:

- แยก script ใน `views/*.html` ออกเป็นไฟล์ JS แยก
- แยก i18n ของแต่ละหน้าออกจาก HTML
- แยก helper ของ SweetAlert / modal / formatting ออกเป็น util
- แยก admin page ออกเป็นหลายไฟล์ย่อย
- เพิ่ม `name_en` ให้ topping ในฐานข้อมูลจริง แทนการแปลฝั่งหน้าเว็บ

## 10. สรุปสั้นที่สุด

ถ้าอยากเข้าใจโปรเจคนี้เร็วที่สุด:

1. อ่าน [app.js](E:\Project Food\food-main\food-main\app.js)
2. อ่าน [public/db-client.js](E:\Project Food\food-main\food-main\public\db-client.js)
3. อ่าน flow ลูกค้า:
   [table.html](E:\Project Food\food-main\food-main\views\table.html) -> [menu.html](E:\Project Food\food-main\food-main\views\menu.html) -> [checkout.html](E:\Project Food\food-main\food-main\views\checkout.html)
4. อ่าน [routes/aliases.js](E:\Project Food\food-main\food-main\routes\aliases.js)
5. ค่อยไปอ่าน [kitchen.html](E:\Project Food\food-main\food-main\views\kitchen.html) และ [admin.html](E:\Project Food\food-main\food-main\views\admin.html)

ถ้าต้องการ ผมช่วยทำต่อได้อีกแบบ:
- ใส่ comment ต่อใน `views/admin.html`, `views/menu.html`, `views/checkout.html`
- ทำไฟล์ `CODEMAP.md` แผนที่โปรเจคแบบสั้นสำหรับพรีเซนต์งาน
- ทำ `API_OVERVIEW.md` แบบภาษาไทยให้อ่านง่ายกว่า Swagger
