import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { executeQuery } from "../db";
import CustomRequest from "../types/CustomerRequest";
import { jwtSecret } from "../config";
import { DecodedUser } from "../models/DecodedUser";
import { Dashboard } from "../models/Dashboard";
import { RowDataPacket } from "mysql2";

const router = express();

function verifyToken(req: CustomRequest, res: Response, next: any) {
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
}

// get all dashboard
router.get(`/`, verifyToken, async (req: CustomRequest, res: Response) => {
	try {
		const dashboard: RowDataPacket[] = await executeQuery<RowDataPacket>(
			"SELECT * FROM dashboard"
		);

		const formattedDashboard = dashboard.map((item: RowDataPacket) => {
			const month = JSON.parse(item.month);
			const price_per_month = JSON.parse(item.price_per_month);
			const total = JSON.parse(item.total);

			return {
				id: item.id,
				name: item.name,
				month: month,
				price_per_month: price_per_month,
				total: total,
				customerId: item.customerId,
			};
		});

		res.status(200).json(formattedDashboard);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Server Error" });
	}
});

router.post(`/`, verifyToken, async (req: CustomRequest, res: Response) => {
	const { name } = req.body;

	if (!name) {
		return res.status(400).json({ message: "Name is required" });
	}

	try {
		const lastDashboardIdQuery =
			"SELECT id FROM dashboard ORDER BY id DESC LIMIT 1";
		const lastDashboard: any[] = await executeQuery<any>(lastDashboardIdQuery);
		let newDashboardId = 1;

		if (lastDashboard.length > 0) {
			newDashboardId = lastDashboard[0].id + 1;
		}
		const customerId = req.customer?.id;

		const productsQuery = `
            SELECT price
            FROM products
            WHERE customerId = ?
        `;
		const products = await executeQuery<RowDataPacket>(productsQuery, [
			customerId,
		]);

		if (products.length === 0) {
			return res
				.status(404)
				.json({ message: "No products found for this customer" });
		}

		// Mengambil harga dari setiap produk
		const prices: number[] = products.map(
			(product: RowDataPacket) => product.price
		);

		const months = generateMonthsArray();
		const totalPrice = calculatePrices(months, prices);

		// Convert array to JSON string
		const monthsJSON = JSON.stringify(months);
		const pricesJSON = JSON.stringify(prices);
		const totalPriceJSON = JSON.stringify(totalPrice);

		const insertQuery = `
            INSERT INTO dashboard (name, month, price_per_month, total, customerId)
            VALUES (?, ?, ?, ?, ?)
        `;

		await executeQuery(insertQuery, [
			name,
			monthsJSON,
			pricesJSON,
			totalPriceJSON,
			customerId,
		]);

		res.status(201).json({ message: "Dashboard data added successfully" });
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Server Error" });
	}
});

export const generateMonthsArray = (): number[] => {
	// Generate array of 1 to 12 (representing 12 months)
	return Array.from({ length: 12 }, (_, index) => index + 1);
};

export const calculatePrices = (
	months: number[],
	prices: number[]
): number[] => {
	let monthlyPrices = [];
	let price = prices[0]; // Harga awal produk

	for (let i = 0; i < months.length; i++) {
		if ((i + 1) % 3 === 0) {
			price = price * 0.988;
		} else {
			price = price * 2;
		}
		monthlyPrices.push(Number(price.toFixed(2)));
	}

	return monthlyPrices;
};

export default router;
