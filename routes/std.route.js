import { Router } from "express";
import pool from "../config/pg.js";
import upload from "../middleware/upload.js";
const stdRoute = Router();

stdRoute.post("/create-std", async (req, res) => {
  try {
    // 1. รับค่าตามชื่อตัวแปรที่ Frontend ตัวใหม่ส่งมา
    const { fullname, std_class_id, username, password, profile, major } = req.body;
    
    if (!fullname || !std_class_id || !username || !password)
      return res.status(400).json({ err: "กรุณากรอกข้อมูลให้ครบถ้วน" });

    // 2. ค้นหาว่ามี username หรือ รหัสนักเรียน ซ้ำไหม
    const where = `select * from students where username = $1 or std_class_id = $2`;
    const fintExitStd = await pool.query(where, [username, std_class_id]);
    if (fintExitStd.rows.length > 0)
      return res.json({
        err: "มีข้อมูลรหัสนักศึกษานี้หรือ username นี้อยู่แล้ว",
      });

    // 3. เพิ่มคอลัมน์ profile และ major เข้าไปในคำสั่ง INSERT 
    const query = `INSERT INTO students (fullname, std_class_id, username, password, major, profile) 
                   VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`;

    const result = await pool.query(query, [
      fullname,
      std_class_id,
      username,
      password,
      major || "IT", // ถ้าหน้าเว็บไม่ได้ส่ง major มา ให้ตั้งค่าเริ่มต้นเป็น "IT"
      profile || "default_profile.png", // ใส่รูปโปรไฟล์เริ่มต้น (สำคัญมาก ป้องกัน Error NOT NULL)
    ]);
    
    if (!result.rows.length) return res.status(400).json({ err: "สมัครสมาชิกไม่สำเร็จ" });

    return res.status(200).json({ ok: true, message: "สมัครสมาชิกสำเร็จ" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ err: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์" });
  }
});

stdRoute.post("/create-easy", async (req, res) => {
  try {
  } catch (error) {
    console.error(error);
  }
});

stdRoute.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const { type } = req.query;
    console.log("🚀 ~ type:", type)

    if (!username || !password) {
      return res.status(400).json({ err: "กรุณากรอก username และ password" });
    }

    let query = `
      SELECT *
      FROM students
      WHERE username = $1
        AND password = $2
      LIMIT 1
    `;
    if (type == 2) {
      query = `
      SELECT *
      FROM professors
      WHERE username = $1
        AND password = $2
      LIMIT 1
    `;
    }

    const result = await pool.query(query, [username, password]);
    console.log("🚀 ~ query:", query)

    console.log("🚀 ~ result.rows:", result.rows)
    if (result.rows.length === 0) {
      return res.status(401).json({ err: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }

    return res.status(200).json({
      data: { ...result.rows[0], role: type },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ err: "Internal server error" });
  }
});

stdRoute.put("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🚀 ~ req.params:", req.params);
    const { fullname, major } = req.body;
    console.log("🚀 ~ req.body:", req.body);

    if (!id) {
      return res.status(400).json({ err: "กรุณาระบุ id" });
    }

    if (!fullname && !major) {
      return res.status(400).json({
        err: "ต้องมีอย่างน้อย fullname หรือ major",
      });
    }

    const query = `
      UPDATE students
      SET
        fullname = COALESCE($1, fullname),
        major = COALESCE($2, major)
      WHERE student_id = $3
      RETURNING  fullname, major
    `;

    const result = await pool.query(query, [fullname, major, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ err: "ไม่พบข้อมูลนักเรียน" });
    }

    return res.status(200).json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ err: "Internal server error" });
  }
});

stdRoute.get("/students/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ err: "กรุณาระบุ id" });
    }

    const query = `
      SELECT student_id, fullname, std_class_id, username, major
      FROM students
      WHERE student_id = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ err: "ไม่พบข้อมูลนักเรียน" });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ err: "Internal server error" });
  }
});

stdRoute.delete("/students/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ err: "กรุณาระบุ id" });
    }

    await client.query("BEGIN");

    // 1. ลบข้อมูลลูกก่อน
    await client.query("DELETE FROM enrollments WHERE student_id = $1", [id]);

    // 2. ลบนักเรียน (ต้องมี RETURNING)
    const result = await client.query(
      `
      DELETE FROM students
      WHERE student_id = $1
      RETURNING student_id
      `,
      [id],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ err: "ไม่พบข้อมูลนักเรียน" });
    }

    await client.query("COMMIT");

    return res.status(200).json({
      ok: true,
      msg: "ลบข้อมูลเรียบร้อย",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ err: "Internal server error" });
  } finally {
    client.release();
  }
});

stdRoute.get("/students", async (req, res) => {
  try {
    const query = `
   SELECT
  student_id,
  fullname,
  std_class_id,
  username,
  major
FROM students 

    `;

    const result = await pool.query(query);
    console.log("🚀 ~ result.rows:", result.rows);
    return res.status(200).json({
      total: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ err: "Internal server error" });
  }
});

stdRoute.post("/check-class", upload.single("leavDoc"), async (req, res) => {
  try {
    const { status, classId, stdId } = req.body;
    const filePath = req.file ? req.file.path : null;

    // ตรวจสอบว่ามีข้อมูลครบหรือไม่
    if (!status || !classId || !stdId) {
      return res.status(400).json({ 
        err: "กรุณากรอกข้อมูลให้ครบถ้วน" 
      });
    }

    // 1. ตรวจสอบว่าเช็คชื่อไปแล้วหรือยัง (วันนี้)
    const checkDuplicateQuery = `
      SELECT * FROM attendance 
      WHERE student_id = $1 
        AND course_id = $2 
        AND DATE(checkin_time) = CURRENT_DATE
    `;
    const duplicateResult = await pool.query(checkDuplicateQuery, [stdId, classId]);
    
    if (duplicateResult.rows.length > 0) {
      return res.status(400).json({ 
        err: "คุณเช็คชื่อวันนี้ไปแล้ว ไม่สามารถเช็คชื่อซ้ำได้",
        alreadyChecked: true,
        previousStatus: duplicateResult.rows[0].status,
        checkinTime: duplicateResult.rows[0].checkin_time
      });
    }

    // 2. ตรวจสอบเวลา (ถ้าต้องการจำกัดเวลาเช็คชื่อ)
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();
    
    // ตัวอย่าง: ให้เช็คชื่อได้แค่ 08:00 - 18:00
    if (currentHour < 8 || currentHour >= 18) {
      return res.status(400).json({ 
        err: "ไม่อยู่ในช่วงเวลาเช็คชื่อ (08:00 - 18:00)",
        outsideTime: true
      });
    }

    // 3. บันทึกการเช็คชื่อ
    const insertQuery = `
      INSERT INTO attendance
      (course_id, student_id, checkin_time, status, leave_file)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      classId, 
      stdId, 
      new Date(), 
      status, 
      filePath
    ]);

    res.status(200).json({ 
      ok: true, 
      message: "เช็คชื่อสำเร็จ",
      data: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    
    // ตรวจสอบ error ประเภทต่างๆ
    if (err.code === '23503') {
      return res.status(400).json({ 
        err: "ไม่พบข้อมูลนักศึกษาหรือรายวิชา" 
      });
    }
    
    res.status(500).json({ 
      err: "เกิดข้อผิดพลาดในการเช็คชื่อ กรุณาลองใหม่อีกครั้ง" 
    });
  }
});

export default stdRoute;