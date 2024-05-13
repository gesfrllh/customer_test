import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { executeQuery } from "../db";
import { Customer } from "../models/Customer";
import { jwtSecret } from "../config";
import bcrypt from "bcrypt";
import { RowDataPacket } from "mysql2";
import CustomRequest from "../types/CustomerRequest";
import { DecodedUser } from "../models/DecodedUser";
import { createProductsTable } from "../db";

const router = express.Router();

// Middleware to verify JWT token
const verifyToken = (req: CustomRequest, res: Response, next: any) => {
	const token = req.headers.authorization?.split(" ")[1];
	if (!token) {
		return res.status(401).json({ message: "Unauthorized" });
	}
	try {
		const decoded = jwt.verify(token, jwtSecret) as DecodedUser;
		req.customer = decoded;
		createProductsTable();

		next();
	} catch (err) {
		console.error(err);
		res.status(403).json({ message: "Invalid Token" });
	}
};

// Get all customers
router.get('/', verifyToken, async (req: CustomRequest, res: Response) => {
    try {
        const customerId = req.customer?.id; // Ambil id pelanggan dari token JWT yang terverifikasi
        const query = `
            SELECT
                customers.id AS customerId,
                customers.name AS customerName,
                customers.email AS customerEmail,
                GROUP_CONCAT(
                    JSON_OBJECT(
                        'id', products.id,
                        'name', products.name,
                        'price', products.price,
                        'image_data', products.image_data
                    ) ORDER BY products.id ASC
                ) AS products
            FROM customers
            LEFT JOIN products ON customers.id = products.customerId
            WHERE customers.id = ? 
            GROUP BY customers.id
        `;
        const results: RowDataPacket[] = await executeQuery<RowDataPacket>(query, [customerId]);

        if (results.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }

        const customerWithProducts = {
            id: results[0].customerId,
            name: results[0].customerName,
            email: results[0].customerEmail,
            products: JSON.parse(`[${results[0].products}]`)
        };

        res.status(200).json(customerWithProducts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Get a single customer by ID
router.get("/:id", verifyToken, async (req: Request, res: Response) => {
	const customerId = req.params.id;
	try {
		const customers: RowDataPacket[] = await executeQuery<RowDataPacket>(
			"SELECT * FROM customers WHERE id = ?",
			[customerId]
		);
		if (customers.length === 0) {
			return res.status(404).json({ message: "Customer not found" });
		}
		res.status(200).json(customers[0]);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Server error" });
	}
});

// Update a customer by ID
router.put("/:id", verifyToken, async (req: Request, res: Response) => {
	const customerId = req.params.id;
	const { name, email, password } = req.body;
	if (!name || !email || !password) {
		return res
			.status(400)
			.json({ message: "Name, email, and password are required" });
	}

	try {
		const hashedPassword = await bcrypt.hash(password, 10);
		const customer: Customer = {
			name,
			email,
			password: hashedPassword,
		};
		await executeQuery("UPDATE customers SET ? WHERE id = ?", [
			customer,
			customerId,
		]);
		res.status(200).json({ message: "Customer updated successfully" });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Server error" });
	}
});

// Delete a customer by ID
router.delete("/:id", verifyToken, async (req: Request, res: Response) => {
	const customerId = req.params.id;
	try {
		await executeQuery("DELETE FROM customers WHERE id = ?", [customerId]);
		res.status(200).json({ message: "Customer deleted successfully" });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Server error" });
	}
});

export default router;
