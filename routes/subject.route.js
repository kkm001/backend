import { Router } from "express";
import pool from "../config/pg.js";

const subjectRoute = Router();

// CREATE: เพิ่มรายวิชา
subjectRoute.post("/create-subject", async (req, res) => {
  try {
    const { course_id, course_name, teacher_name, time_check } = req.body;

    if (!course_id || !course_name || !teacher_name || !time_check) {
      return res.status(400).json({
        error: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
      });
    }

    const query = `INSERT INTO courses (course_id, course_name, teacher_name, time_check) 
                   VALUES ($1, $2, $3, $4) RETURNING *`;

    const result = await pool.query(query, [
      course_id,
      course_name,
      teacher_name,
      time_check,
    ]);

    res.status(201).json({
      message: "เพิ่มรายวิชาสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "เกิดข้อผิดพลาดในการเพิ่มรายวิชา",
    });
  }
});

// GET ALL: ดึงข้อมูลทั้งหมด
subjectRoute.get("/get-all-subjects", async (req, res) => {
  try {
    const query = `SELECT * FROM courses ORDER BY course_id ASC`;
    const result = await pool.query(query);

    res.status(200).json({
      message: "ดึงข้อมูลสำเร็จ",
      total: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงข้อมูล",
    });
  }
});

// GET ONE: ดึงข้อมูลรายการเดียว
subjectRoute.get("/get-subject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = `SELECT * FROM courses WHERE course_id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "ไม่พบรายวิชานี้",
      });
    }

    res.status(200).json({
      message: "ดึงข้อมูลสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "เกิดข้อผิดพลาดในการดึงข้อมูล",
    });
  }
});

// UPDATE: แก้ไขข้อมูล ✅ เพิ่ม time_check
subjectRoute.put("/update-subject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { course_name, teacher_name, time_check } = req.body; // ✅ เพิ่ม time_check

    if (!course_name || !teacher_name || !time_check) { // ✅ validate time_check
      return res.status(400).json({
        error: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
      });
    }

    const query = `UPDATE courses 
                   SET course_name = $1, teacher_name = $2, time_check = $3
                   WHERE course_id = $4 
                   RETURNING *`; // ✅ เพิ่ม time_check = $3

    const result = await pool.query(query, [course_name, teacher_name, time_check, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "ไม่พบรายวิชานี้",
      });
    }

    res.status(200).json({
      message: "แก้ไขข้อมูลสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "เกิดข้อผิดพลาดในการแก้ไขข้อมูล",
    });
  }
});

// DELETE: ลบข้อมูล
subjectRoute.delete("/delete-subject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = `DELETE FROM courses WHERE course_id = $1 RETURNING *`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "ไม่พบรายวิชานี้",
      });
    }

    res.status(200).json({
      message: "ลบรายวิชาสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "เกิดข้อผิดพลาดในการลบข้อมูล",
    });
  }
});

// GET CLASS DETAIL
subjectRoute.get("/get-class-detail/:classId/:stdId", async (req, res) => {
  try {
    const { classId, stdId } = req.params;
    const queryData = `
      SELECT
        s.student_id,
        s.fullname,
        s.major,
        s.username,
        s.std_class_id,
        c.course_id,
        c.course_name,
        c.teacher_name,
        a.checkin_time,
        a.status
      FROM attendance a
      JOIN students s ON a.student_id = s.student_id
      JOIN courses c ON a.course_id = c.course_id
      WHERE s.student_id = $1
        AND c.course_id = $2
    `;

    const data = await pool.query(queryData, [stdId, classId]);

    const statisticQuery = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'มาเรียน') AS present,
        COUNT(*) FILTER (WHERE status = 'มาสาย')   AS late,
        COUNT(*) FILTER (WHERE status = 'ขาด')     AS absent,
        COUNT(*) FILTER (WHERE status = 'ลา')      AS leave
      FROM attendance
      WHERE student_id = $1
        AND course_id = $2
    `;

    const statistics = await pool.query(statisticQuery, [stdId, classId]);

    return res.status(200).json({
      data: data.rows,
      statistics: statistics.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
  }
});

export default subjectRoute;