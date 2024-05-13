import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { createDashboardTable, executeQuery } from "../db";
import { Product } from "../models/Products";
import { jwtSecret } from "../config";
import { RowDataPacket } from "mysql2";
import CustomRequest from "../types/CustomerRequest";
import { DecodedUser } from "../models/DecodedUser";
import { generateMonthsArray, calculatePrices } from "./DashboardRoutes";
import path from "path";
import fs from 'fs-extra'
import multer from "multer";

const router = express.Router();

// Middleware to verify JWT token
function verifyToken(req: CustomRequest, res: Response, next: any) {
	const token = req.headers.authorization?.split(" ")[1];
	if (!token) {
		return res.status(401).json({ message: "Unauthorized" });
	}
	try {
		const decoded = jwt.verify(token, jwtSecret) as DecodedUser;
		req.customer = decoded;
		createDashboardTable();
		next();
	} catch (err) {
		console.error(err);
		res.status(403).json({ message: "Invalid Token" });
	}
}

async function updatePricePerMonth(customerId: number) {
	try {
		const lastDashboardIdQuery =
			"SELECT id FROM dashboard ORDER BY id DESC LIMIT 1";
		const lastDashboard: any[] = await executeQuery<any>(lastDashboardIdQuery);
		let newDashboardId = 1;

		if (lastDashboard.length > 0) {
			newDashboardId = lastDashboard[0].id + 1;
		}
		const productsQuery = `
            SELECT price
            FROM products
            WHERE customerId = ?
        `;
		const products = await executeQuery<RowDataPacket>(productsQuery, [
			customerId,
		]);

		const prices: number[] = products.map(
			(product: RowDataPacket) => product.price
		);

		const months = generateMonthsArray();
		const totalPrice = calculatePrices(months, prices);

		const updateQuery = `
            UPDATE dashboard
            SET price_per_month = ?,
                total = ?
            WHERE customerId = ?
        `;

		await executeQuery(updateQuery, [
			JSON.stringify(prices),
			JSON.stringify(totalPrice),
			customerId,
		]);
	} catch (err) {
		console.error("Error updating price_per_month:", err);
		throw err;
	}
}



// Get all products
router.get("/", verifyToken, async (req: CustomRequest, res: Response) => {
	try {
		const products: RowDataPacket[] = await executeQuery<RowDataPacket>(
			"SELECT * FROM products"	
		);

		const productWithUrl = products.map((product: any) => ({
			...product,
			image_data: {
				type: "url",
				data: `${req.protocol}://${req.get("host")}/images/products/${product.image_data}`
			}
		}))
		res.status(200).json(productWithUrl);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Server error" });
	}
});

// Get a single product by ID
router.get("/:id", verifyToken, async (req: Request, res: Response) => {
	const productId = req.params.id;
	try {
		const products: RowDataPacket[] = await executeQuery<RowDataPacket>(
			"SELECT * FROM products WHERE id = ?",
			[productId]
		);
		if (products.length === 0) {
			return res.status(404).json({ message: "Product not found" });
		}
		res.status(200).json(products[0]);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Server error" });
	}
});

const uploadDir = path.join(__dirname, "../uploads")

fs.ensureDirSync(uploadDir)

const storage = multer.diskStorage({
	destination: function(req, file, cb){
		cb(null, uploadDir)
	},
	filename: function(req, file, cb){
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
		cb(null, uniqueSuffix + path.extname(file.originalname))
	}
})


const upload = multer({ storage: storage})

// Create a new product
async function handleImageUpload(req: Request, res: Response): Promise<string> {
    try {
        if (!req.file) {
            throw new Error("Image file is required");
        }

        const imageFileName = req.file.filename;
        const imageFilePath = path.join(uploadDir, imageFileName);
        const newFilePath = path.join(uploadDir, "products", imageFileName);

        await fs.move(imageFilePath, newFilePath);
		const imageUrl = `${req.protocol}://${req.get("host")}//images/products/${imageFileName}`
        return imageUrl;
    } catch (error) {
        console.error(error);
        throw new Error("Failed to upload image");
    }
}


router.post("/", verifyToken, upload.single("image_data"), async (req: Request, res: Response) => {
	const { name, price, description, customerId} = req.body;
	if (!name || !price || !description || !customerId ) {
		return res.status(400).json({
			message: "Name, price, description, customerId, and image are required",
		});
	}

	try {
		const imageFileName = await handleImageUpload(req, res);

		const lastProductIdQuery =
			"SELECT id FROM products ORDER BY id DESC LIMIT 1";
		const lastProduct: any[] = await executeQuery<any>(lastProductIdQuery);
		let newProductId = 1;

		if (lastProduct.length > 0) {
			newProductId = lastProduct[0].id + 1;
		}

		const product: Product = {
			id: newProductId,
			name,
			price,
			description,
			customerId,
			image_data: imageFileName
		
		
		};


		await executeQuery("INSERT INTO products SET ?", [product]);
		await updatePricePerMonth(product.customerId);
		res.status(201).json({ message: "Product created successfully" });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Server error" });
	}
});

// Update a product by ID
router.put("/:id", verifyToken, async (req: Request, res: Response) => {
	const productId = req.params.id;
	const { name, price, description, customerId, image_data } = req.body;
	if (!name || !price || !description || !customerId || !image_data ) {
		return res.status(400).json({
			message: "Name, price, description, and customerId are required",
		});
	}

	try {
		const product: Product = {
			name,
			price,
			description,
			customerId,
			image_data
		};
		await executeQuery("UPDATE products SET ? WHERE id = ?", [
			product,
			productId,
		]);
		await updatePricePerMonth(product.customerId);
		res.status(200).json({ message: "Product updated successfully" });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Server error" });
	}
});

// Delete a product by ID
router.delete("/:id", verifyToken, async (req: Request, res: Response) => {
	const productId = req.params.id;
	const { name, price, description, customerId, image_data } = req.body;
	try {
		const product: Product = {
			name,
			price,
			description,
			customerId,
			image_data
		};
		await executeQuery("DELETE FROM products WHERE id = ?", [productId]);
		await updatePricePerMonth(product.customerId);
		res.status(200).json({ message: "Product deleted successfully" });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Server error" });
	}
});

export default router;
