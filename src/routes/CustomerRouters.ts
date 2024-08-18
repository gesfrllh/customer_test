import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { executeQuery } from "../db";
import { Customer } from "../models/Customer";
import { jwtSecret } from "../config";
import bcrypt from "bcrypt";
import { RowDataPacket } from "mysql2";
import CustomRequest from "../types/CustomerRequest";
import { DecodedUser } from "../models/DecodedUser";

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

		next();
	} catch (err) {
		console.error(err);
		res.status(403).json({ message: "Invalid Token" });
	}
};

// Get all customers
// Get customer along with their products
router.get('/', verifyToken, async (req: CustomRequest, res: Response) => {
    try {
        const customerId = req.customer?.id; // Extract customer ID from JWT

        // Ensure customerId is present
        if (!customerId) {
            return res.status(401).json({ message: "Unauthorized: No customer ID found" });
        }

        // Query to get customer details
        const customerQuery = `
            SELECT
                id AS customerId,
                name AS customerName,
                email AS customerEmail
            FROM customers
            WHERE id = ?
        `;
        const customerResults: RowDataPacket[] = await executeQuery<RowDataPacket>(customerQuery, [customerId]);

        if (customerResults.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }

        // Query to get products related to the customer
        const productsQuery = `
            SELECT
                id AS productId,
                name AS productName,
                price AS productPrice,
                image_id AS productImageId
            FROM products
            WHERE customerId = ?
        `;
        const productsResults: RowDataPacket[] = await executeQuery<RowDataPacket>(productsQuery, [customerId]);

        // Construct the response object with customer and products
        const customerWithProducts = {
            id: customerResults[0].customerId,
            name: customerResults[0].customerName,
            email: customerResults[0].customerEmail,
            products: productsResults.map(product => ({
                id: product.productId,
                name: product.productName,
                price: product.productPrice,
                image_id: product.productImageId
            }))
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
