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

/**
 * @swagger
 * /api/visits:
 *   get:
 *     summary: Get paginated visits with optional search and date filters
 *     tags:
 *       - Visits
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Text search across patient name, ID, diagnosis, and medications
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter visits from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter visits up to this date
 *
 *     responses:
 *       200:
 *         description: List of visits
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   example: 42
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: integer
 *                         example: 12
 *                       uuid:
 *                         type: string
 *                         example: "c1a9a913-bd12-45de-a03e-8484ce32db11"
 *                       visit_date:
 *                         type: string
 *                         format: date
 *                         example: "2025-11-12"
 *                       diagnosis:
 *                         type: string
 *                         example: "Malaria"
 *                       prescribed_medications:
 *                         type: string
 *                         example: "Coartem"
 *                       patient_id:
 *                         type: string
 *                         example: "2f5e54ed-3ae2-4ac2-9bb8-1ccfbb82ea20"
 *                       patient_name:
 *                         type: string
 *                         example: "Alice Johnson"
 *                       patient_id_number:
 *                         type: string
 *                         example: "12345678"
 *
 *       400:
 *         description: Invalid page or limit parameters
 *
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/visits/{uuid}:
 *   get:
 *     summary: Get a single visit by UUID
 *     tags:
 *       - Visits
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID of the visit to retrieve
 *
 *     responses:
 *       200:
 *         description: Visit details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uuid:
 *                   type: string
 *                   example: "c1a9a913-bd12-45de-a03e-8484ce32db11"
 *                 visit_date:
 *                   type: string
 *                   format: date
 *                   example: "2025-11-12"
 *                 diagnosis:
 *                   type: string
 *                   example: "Malaria"
 *                 prescribed_medications:
 *                   type: string
 *                   example: "Coartem"
 *                 notes:
 *                   type: string
 *                   example: "Patient should rest and hydrate"
 *                 patient_id:
 *                   type: string
 *                   example: "2f5e54ed-3ae2-4ac2-9bb8-1ccfbb82ea20"
 *                 patient_name:
 *                   type: string
 *                   example: "Alice Johnson"
 *                 patient_id_number:
 *                   type: string
 *                   example: "12345678"
 *
 *       404:
 *         description: Visit not found
 *
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/visits/{uuid}:
 *   delete:
 *     summary: Delete a visit by UUID
 *     tags:
 *       - Visits
 *     security:
 *       - cookieAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID of the visit to delete
 *
 *     responses:
 *       200:
 *         description: Visit deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Visit deleted successfully"
 *
 *       404:
 *         description: Visit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Visit not found"
 *
 *       500:
 *         description: Internal server error
 */
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

/**
 * @swagger
 * /api/visits/{uuid}:
 *   put:
 *     summary: Update a visit by UUID
 *     tags:
 *       - Visits
 *     security:
 *       - cookieAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID of the visit to update
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - visit_date
 *               - diagnosis
 *               - prescribed_medications
 *             properties:
 *               visit_date:
 *                 type: string
 *                 example: "2024-01-15"
 *               diagnosis:
 *                 type: string
 *                 example: "Malaria"
 *               prescribed_medications:
 *                 type: string
 *                 example: "Artemether-Lumefantrine"
 *               notes:
 *                 type: string
 *                 nullable: true
 *                 example: "Patient recovering well"
 *
 *     responses:
 *       200:
 *         description: Visit updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Visit updated successfully"
 *                 visit:
 *                   type: object
 *                   properties:
 *                     uuid:
 *                       type: string
 *                     patient_id:
 *                       type: string
 *                     visit_date:
 *                       type: string
 *                     diagnosis:
 *                       type: string
 *                     prescribed_medications:
 *                       type: string
 *                     notes:
 *                       type: string
 *                       nullable: true
 *                     created_at:
 *                       type: string
 *                     created_by:
 *                       type: string
 *
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "visit_date, diagnosis, and prescribed_medications are required"
 *
 *       404:
 *         description: Visit not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Visit not found"
 *
 *       500:
 *         description: Internal server error
 */
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
