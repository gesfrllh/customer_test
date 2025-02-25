import express, { Request, Response } from "express";
import path from "path";
import fs from 'fs-extra';
import multer from 'multer';
import { executeQuery } from "../db";

const router = express.Router();
const uploadDir = path.join(__dirname, "../uploads");
const productsDir = path.join(uploadDir, "products");

// Ensure the upload directory and products directory exist
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(productsDir);

// Multer configuration for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, productsDir);
    },
    filename: function (req, file, cb) {
        // Get the original file extension
        const fileExt = path.extname(file.originalname);

        // Generate a unique filename by appending timestamp and random number to the original filename
        const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;

        cb(null, filename); // Save file with the new unique name
    }
});

const upload = multer({ storage: storage });

// Endpoint to upload a file and save its metadata
router.post("/", upload.single('file'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const fileUrl = req.file.filename;
        const filePath = path.join(productsDir, fileUrl);
        const fileSize = req.file.size; // File size in bytes

        // Save file metadata to the database
        const insertQuery = `
            INSERT INTO images (filename, path, size)
            VALUES (?, ?, ?)
        `;
        const result: any = await executeQuery(insertQuery, [fileUrl, filePath, fileSize]);

        // Extract the insertId from the result
        const imageId = (result as any).insertId;

        // Get the complete file information
        const fileMetadata = {
            id: imageId,
            filename: fileUrl,
            path: filePath,
            size: fileSize,  // Size in bytes
            url: `/uploads/products/${fileUrl}` // Example URL path, adjust as needed
        };

        res.status(200).json({ message: "File uploaded successfully", file: fileMetadata });
    } catch (error) {
        console.error("Failed to upload image:", error);
        res.status(500).json({ message: "Server error while uploading image" });
    }
});

export default router;
