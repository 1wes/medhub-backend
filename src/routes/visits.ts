import express, { Request, Response, NextFunction } from "express";
import verifyToken from "../middleware/cookie-validation";
import { pool as db } from "../utils/database-config";

const router = express.Router();

interface VisitResponse {
  uuid: string;
  visit_date: string;
  diagnosis: string;
  prescribed_medications: string;
  notes?: string;
  patient_id: string;
  patient_name: string;
  patient_id_number?: string;
}

router.get("/", verifyToken, async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const search = (req.query.search as string) || "";
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const { tokenInfo } = req;
  const createdBy = tokenInfo.uuid;

  if (page <= 0 || limit <= 0) {
    return res.status(400).json({ message: "Invalid page or limit" });
  }

  const offset = (page - 1) * limit;

  try {
    let countQuery = `
      SELECT COUNT(*) AS total
      FROM visits v
      LEFT JOIN patients p ON p.uuid = v.patient_id
      WHERE v.created_by = ?
        AND (
          p.name LIKE ?
          OR p.id_number LIKE ?
          OR v.diagnosis LIKE ?
          OR v.prescribed_medications LIKE ?
        )
    `;
    const countParams: any[] = [
      createdBy,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
    ];

    if (startDate && endDate) {
      countQuery += " AND v.visit_date BETWEEN ? AND ?";
      countParams.push(startDate, endDate);
    }

    const [countResult] = await db.execute(countQuery, countParams);
    const total = (countResult as any)[0].total;

    let dataQuery = `
      SELECT 
        v.id,
        v.uuid,
        v.visit_date,
        v.diagnosis,
        v.prescribed_medications,
        v.patient_id,
        p.name AS patient_name,
        p.id_number AS patient_id_number
      FROM visits v
      LEFT JOIN patients p ON p.uuid = v.patient_id
      WHERE v.created_by = ?
        AND (
          p.name LIKE ?
          OR p.id_number LIKE ?
          OR v.diagnosis LIKE ?
          OR v.prescribed_medications LIKE ?
        )
    `;

    const dataParams: any[] = [
      createdBy,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
    ];

    if (startDate && endDate) {
      dataQuery += " AND v.visit_date BETWEEN ? AND ?";
      dataParams.push(startDate, endDate);
    }

    dataQuery += ` ORDER BY v.visit_date DESC LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await db.execute(dataQuery, dataParams);
    const items = (rows as any[]).map((row) => ({
      key: row.id,
      ...row,
    }));

    return res.json({ items, total });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "We encountered an error. Please retry" });
  }
});

router.get("/:uuid", verifyToken, async (req: Request, res: Response) => {
  const { uuid } = req.params;
  const { tokenInfo } = req;
  const createdBy = tokenInfo.uuid;

  try {
    const [rows]: any = await db.execute(
      `
      SELECT 
        v.uuid AS visit_uuid,
        v.visit_date,
        v.diagnosis,
        v.prescribed_medications,
        v.notes,
        v.patient_id,

        p.name AS patient_name,
        p.id_number AS patient_id_number

      FROM visits v
      LEFT JOIN patients p 
        ON p.uuid = v.patient_id
      WHERE v.uuid = ? AND v.created_by = ?
      `,
      [uuid, createdBy]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "Visit not found" });
    }

    const visit: VisitResponse = {
      uuid: rows[0].visit_uuid,
      visit_date: rows[0].visit_date,
      diagnosis: rows[0].diagnosis,
      prescribed_medications: rows[0].prescribed_medications,
      notes: rows[0].notes,
      patient_id: rows[0].patient_id,
      patient_name: rows[0].patient_name,
      patient_id_number: rows[0].patient_id_number,
    };

    return res.json(visit);
  } catch (err) {
    return res.status(500).json({
      message: "We encountered an error. Please try again",
    });
  }
});

router.delete("/:uuid", verifyToken, async (req: Request, res: Response) => {
  const { uuid } = req.params;
  const { tokenInfo } = req;
  const createdBy = tokenInfo.uuid;

  try {
    const [rows]: any = await db.execute(
      `SELECT uuid FROM visits WHERE uuid = ? AND created_by = ? LIMIT 1`,
      [uuid, createdBy]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Visit not found" });
    }

    await db.execute(`DELETE FROM visits WHERE uuid = ? AND created_by = ?`, [
      uuid,
      createdBy,
    ]);

    return res.status(200).json({ message: "Visit deleted successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "We encountered an error. Please try again" });
  }
});

router.put("/:uuid", verifyToken, async (req: Request, res: Response) => {
  const { uuid } = req.params;
  const { tokenInfo } = req;
  const createdBy = tokenInfo.uuid;

  const { visit_date, diagnosis, prescribed_medications, notes } = req.body;

  if (!visit_date || !diagnosis || !prescribed_medications) {
    return res.status(400).json({
      message: "visit_date, diagnosis, and prescribed_medications are required",
    });
  }

  try {
    const [rows]: any = await db.execute(
      `SELECT uuid FROM visits WHERE uuid = ? AND created_by = ? LIMIT 1`,
      [uuid, createdBy]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Visit not found" });
    }

    await db.execute(
      `
      UPDATE visits
      SET visit_date = ?, diagnosis = ?, prescribed_medications = ?, notes = ?
      WHERE uuid = ? AND created_by = ?
      `,
      [
        visit_date,
        diagnosis,
        prescribed_medications,
        notes || null,
        uuid,
        createdBy,
      ]
    );

    const [updatedRows]: any = await db.execute(
      `
      SELECT uuid, patient_id, visit_date, diagnosis, prescribed_medications, notes, created_at, created_by
      FROM visits
      WHERE uuid = ? AND created_by = ?
      `,
      [uuid, createdBy]
    );

    return res.status(200).json({
      message: "Visit updated successfully",
      visit: updatedRows[0],
    });
  } catch (err) {
    return res.status(500).json({
      message: "We encountered an error. Please try again",
    });
  }
});

export default router;
