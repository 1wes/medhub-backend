import express, { Request, Response } from "express";
import verifyToken from "../middleware/cookie-validation";
import { pool as db } from "../utils/database-config";
import { RowDataPacket } from "mysql2";

const router = express.Router();

router.get("/", verifyToken, async (req: Request, res: Response) => {
  try {
    const { tokenInfo } = req;
    const createdBy = tokenInfo.uuid;

    const [totalPatientsRows] = await db.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM patients WHERE created_by = ?",
      [createdBy]
    );
    const totalPatients = totalPatientsRows[0].total;

    const [recentVisitsRows] = await db.execute<RowDataPacket[]>(
      `
      SELECT v.uuid AS visitUuid,
             v.visit_date,
             v.diagnosis,
             v.prescribed_medications,
             v.notes,
             p.uuid AS patientUuid,
             p.name
      FROM visits v
      JOIN patients p ON v.patient_id = p.uuid
      WHERE v.created_by = ?
      ORDER BY v.visit_date DESC
      LIMIT 5
    `,
      [createdBy]
    );

    const [totalVisitsRows] = await db.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM visits WHERE created_by = ?",
      [createdBy]
    );
    const totalVisits = totalVisitsRows[0].total;

    const recentVisits = recentVisitsRows.map((row) => ({
      visitUuid: row.visitUuid,
      patientUuid: row.patientUuid,
      name: row.name,
      visit_date: row.visit_date,
      diagnosis: row.diagnosis,
      prescribed_medications: row.prescribed_medications,
      notes: row.notes,
    }));

    const [visitsPerWeekRows] = await db.execute<RowDataPacket[]>(
      `
      SELECT DATE_FORMAT(visit_date, '%x-W%v') AS week,
             COUNT(*) AS visits
      FROM visits
      WHERE created_by = ?
      GROUP BY week
      ORDER BY week DESC
      LIMIT 10
    `,
      [createdBy]
    );

    const visitsPerWeek = visitsPerWeekRows
      .map((row) => ({ week: row.week, visits: row.visits }))
      .reverse();

    res.json({
      totalPatients,
      totalVisits,
      recentVisits,
      visitsPerWeek,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});
export default router;
