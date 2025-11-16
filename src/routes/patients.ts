import express, { Request, Response, NextFunction } from "express";
import uuid from "../utils/uuid";
import verifyToken from "../middleware/cookie-validation";
import { pool as db } from "../utils/database-config";

const router = express.Router();

interface Visit {
  uuid: string;
  date: string;
  diagnosis: string;
  prescribed_medications: string;
  notes?: string | null;
}

interface PatientResponse {
  uuid: string;
  name: string;
  id_number: string;
  gender: string;
  contact: string;
  date_of_birth: string;
  visits: Visit[];
}

router.use((req: Request, res: Response, next: NextFunction) => {
  next();
});

/**
 * @swagger
 * /api/patients/new-patient:
 *   post:
 *     summary: Register a new patient
 *     tags:
 *       - Patients
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - idNumber
 *               - date_of_birth
 *               - gender
 *               - contact
 *             properties:
 *               name:
 *                 type: string
 *                 example: Alice Johnson
 *               idNumber:
 *                 type: string
 *                 example: "12345678"
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *                 example: "1990-05-21"
 *               gender:
 *                 type: string
 *                 example: Female
 *               contact:
 *                 type: string
 *                 example: "+254712345678"
 *     responses:
 *       201:
 *         description: Patient registered successfully
 *       400:
 *         description: Missing required fields
 *       409:
 *         description: Duplicate entry
 *       500:
 *         description: Internal server error
 */
router.post(
  "/new-patient",
  verifyToken,
  async (req: Request, res: Response) => {
    try {
      const { name, idNumber, date_of_birth, gender, contact } = req.body;
      const patientId = uuid();
      const { tokenInfo } = req;
      const createdBy = tokenInfo.uuid;

      if (!name || !idNumber || !date_of_birth || !gender || !contact) {
        return res.status(400).json({ message: "Missing fields" });
      }

      const sql = `
        INSERT INTO patients
          (uuid,name, id_number, date_of_birth, gender, contact, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await db.execute(sql, [
        patientId,
        name,
        idNumber,
        date_of_birth,
        gender,
        contact,
        createdBy,
      ]);

      res.status(201).json({ message: "Patient registered." });
    } catch (error: any) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          message:
            "User with this email or ID already exists. Retry using a different one",
        });
      }
      res.status(500).json({
        message: "We encountered a problem. Please retry",
      });
    }
  }
);

/**
 * @swagger
 * /api/patients/:
 *   get:
 *     summary: Get a paginated list of all patients for the authenticated user
 *     tags:
 *       - Patients
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
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
 *           default: ""
 *         description: Search by patient name or ID number
 *     responses:
 *       200:
 *         description: Paginated list of patients
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: integer
 *                         example: 1
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       uuid:
 *                         type: string
 *                         example: "550e8400-e29b-41d4-a716-446655440000"
 *                       name:
 *                         type: string
 *                         example: "Alice Johnson"
 *                       idNumber:
 *                         type: string
 *                         example: "12345678"
 *                       gender:
 *                         type: string
 *                         example: "Female"
 *                       contact:
 *                         type: string
 *                         example: "+254712345678"
 *                 total:
 *                   type: integer
 *                   example: 42
 *       400:
 *         description: Invalid page or limit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid page or limit"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "We encountered an error. Please retry"
 */
router.get("/", verifyToken, async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = (req.query.search as string) || "";
    const { tokenInfo } = req;
    const createdBy = tokenInfo.uuid;

    if (page <= 0 || limit <= 0) {
      return res.status(400).json({ message: "Invalid page or limit" });
    }

    const offset = (page - 1) * limit;

    const [countResult] = await db.execute(
      `
      SELECT COUNT(*) AS total
      FROM patients
      WHERE created_by = ?
      AND (name LIKE ? OR id_number LIKE ?)
      `,
      [createdBy, `%${search}%`, `%${search}%`]
    );
    const total = (countResult as any)[0].total;

    const [rows] = await db.execute(
      `
      SELECT id, name, id_number AS idNumber, gender, contact, uuid
      FROM patients
      WHERE created_by = ?
      AND (name LIKE ? OR id_number LIKE ?)
      ORDER BY id DESC
      LIMIT ${limit} OFFSET ${offset}
      `,
      [createdBy, `%${search}%`, `%${search}%`]
    );

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
 * /api/patients/{uuid}:
 *   get:
 *     summary: Get a patient and their visit history
 *     security:
 *       - cookieAuth: []
 *     tags:
 *       - Patients
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: The UUID of the patient
 *     responses:
 *       200:
 *         description: Patient record with visits
 *       404:
 *         description: Patient not found
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
        p.uuid AS patient_uuid,
        p.name,
        p.id_number,
        p.gender,
        p.contact,
        p.date_of_birth,
        
        v.uuid AS visit_uuid,
        v.visit_date,
        v.diagnosis,
        v.prescribed_medications,
        v.notes

      FROM patients p
      LEFT JOIN visits v 
        ON v.patient_id = p.uuid AND v.created_by = p.created_by
      WHERE p.uuid = ? AND p.created_by = ?
      ORDER BY v.visit_date DESC
      `,
      [uuid, createdBy]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patient: PatientResponse = {
      uuid: rows[0].patient_uuid,
      name: rows[0].name,
      id_number: rows[0].id_number,
      gender: rows[0].gender,
      contact: rows[0].contact,
      date_of_birth: rows[0].date_of_birth,
      visits: [],
    };

    rows.forEach((r: any) => {
      if (r.visit_uuid) {
        patient.visits.push({
          uuid: r.visit_uuid,
          date: r.visit_date,
          diagnosis: r.diagnosis,
          prescribed_medications: r.prescribed_medications,
          notes: r.notes,
        });
      }
    });

    return res.json(patient);
  } catch (err) {
    return res.status(500).json({
      message: "We encountered an error. Please try again",
    });
  }
});

/**
 * @swagger
 * /api/patients/{uuid}:
 *   put:
 *     summary: Update patient details
 *     security:
 *       - cookieAuth: []
 *     tags:
 *       - Patients
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID of the patient to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               gender:
 *                 type: string
 *               date_of_birth:
 *                 type: string
 *                 format: date
 *               contact:
 *                 type: string
 *               idNumber:
 *                 type: string
 *             required:
 *               - name
 *               - gender
 *               - date_of_birth
 *     responses:
 *       200:
 *         description: Patient details updated successfully
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Server error
 */

router.put("/:uuid", verifyToken, async (req: Request, res: Response) => {
  const { uuid } = req.params;
  const { tokenInfo } = req;
  const createdBy = tokenInfo.uuid;

  const { name, gender, date_of_birth, contact, idNumber } = req.body;

  if (!name || !gender || !date_of_birth) {
    return res
      .status(400)
      .json({ message: "Name, gender, and date_of_birth are required" });
  }

  try {
    const [rows]: any = await db.execute(
      `SELECT uuid FROM patients WHERE uuid = ? AND created_by = ? LIMIT 1`,
      [uuid, createdBy]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    await db.execute(
      `UPDATE patients
       SET name = ?, id_number = ?, date_of_birth = ?, gender = ?, contact = ?
       WHERE uuid = ? AND created_by = ?`,
      [
        name,
        idNumber || null,
        date_of_birth,
        gender,
        contact || null,
        uuid,
        createdBy,
      ]
    );

    const [updatedRows]: any = await db.execute(
      `SELECT uuid, name, id_number, date_of_birth, gender, contact, created_at, created_by
       FROM patients
       WHERE uuid = ? AND created_by = ?`,
      [uuid, createdBy]
    );

    return res
      .status(200)
      .json({ message: "Patient details updated", patient: updatedRows[0] });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "We encountered an error. Please try again" });
  }
});

/**
 * @swagger
 * /api/patients/{uuid}:
 *   delete:
 *     summary: Delete a patient
 *     security:
 *       - cookieAuth: []
 *     tags:
 *       - Patients
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID of the patient to delete
 *     responses:
 *       200:
 *         description: Patient deleted successfully
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Server error
 */

router.delete("/:uuid", verifyToken, async (req: Request, res: Response) => {
  const { uuid } = req.params;
  const { tokenInfo } = req;
  const createdBy = tokenInfo.uuid;

  try {
    const [rows]: any = await db.execute(
      `SELECT uuid FROM patients WHERE uuid = ? AND created_by = ? LIMIT 1`,
      [uuid, createdBy]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    await db.execute(`DELETE FROM patients WHERE uuid = ? AND created_by = ?`, [
      uuid,
      createdBy,
    ]);

    return res.status(200).json({ message: "Patient deleted successfully" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "We encountered an error. Please try again" });
  }
});

/**
 * @swagger
 * /api/patients/{uuid}/visits:
 *   post:
 *     summary: Add a new visit for a patient
 *     tags:
 *       - Patients
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: uuid
 *         required: true
 *         schema:
 *           type: string
 *         description: UUID of the patient
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - diagnosis
 *               - prescribed_medications
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2025-01-20"
 *               diagnosis:
 *                 type: string
 *                 example: "Malaria"
 *               prescribed_medications:
 *                 type: string
 *                 example: "Artemether, Lumefantrine"
 *               notes:
 *                 type: string
 *                 example: "Patient advised to return if symptoms persist"
 *     responses:
 *       201:
 *         description: Visit added successfully
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Server error
 */

router.post(
  "/:uuid/visits",
  verifyToken,
  async (req: Request, res: Response) => {
    const patientUuid = req.params.uuid;
    const { date, diagnosis, prescribed_medications, notes } = req.body;
    const { tokenInfo } = req;
    const createdBy = tokenInfo.uuid;
    const visitUuid = uuid();

    if (!date || !diagnosis || !prescribed_medications) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      const [patientRows]: any = await db.execute(
        `SELECT uuid FROM patients WHERE uuid = ? AND created_by = ? LIMIT 1`,
        [patientUuid, createdBy]
      );

      if (patientRows.length === 0) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const insertQuery = `
      INSERT INTO visits (uuid, patient_id, visit_date, diagnosis, prescribed_medications, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
      await db.execute(insertQuery, [
        visitUuid,
        patientUuid,
        date,
        diagnosis,
        prescribed_medications,
        notes || null,
        createdBy,
      ]);

      const [newVisitRows]: any = await db.execute(
        `SELECT * FROM visits WHERE uuid = ? LIMIT 1`,
        [visitUuid]
      );

      res.status(201).json({ message: "Visit added", visit: newVisitRows[0] });
    } catch (err) {
      res
        .status(500)
        .json({ message: "We encountered an error. Please try again" });
    }
  }
);

export default router;
