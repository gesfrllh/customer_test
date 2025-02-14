import express, {  Response } from "express";
import { executeQuery } from "../db";
import CustomRequest from "../types/CustomerRequest";
import { Dashboard } from "../models/Dashboard";
import { RowDataPacket } from "mysql2";
import verifyToken from "../middleware/VerifyToken";

const router = express();


router.get("/", verifyToken, async (req: CustomRequest, res: Response) => {
  const customerId = req.customer?.id;

  try {
    const dashboardQuery = `
      SELECT * FROM dashboard
      WHERE customerId = ?
    `;
    const dashboard: RowDataPacket[] = await executeQuery<RowDataPacket>(dashboardQuery, [customerId]);

    if (dashboard.length === 0) {
      return res.status(404).json({ message: "No dashboard found for this user" });
    }

    const productsQuery = `
      SELECT * FROM products
      WHERE customerId = ?
    `;
    const products: RowDataPacket[] = await executeQuery<RowDataPacket>(productsQuery, [customerId]);

    const formattedDashboard = dashboard.map((item: RowDataPacket) => ({
      id: item.id,
      name: item.name,
      month: JSON.parse(item.month),
      price_per_month: JSON.parse(item.price_per_month),
      total: JSON.parse(item.total),
      customerId: item.customerId,
      products: products, // Include products in the response
    }));

    res.status(200).json(formattedDashboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});


router.post("/", verifyToken, async (req: CustomRequest, res: Response) => {
  const { name } = req.body;
  const customerId = req.customer?.id;

  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    const productsQuery = `
      SELECT price
      FROM products
      WHERE customerId = ?
    `;
    const products: RowDataPacket[] = await executeQuery<RowDataPacket>(productsQuery, [
      customerId,
    ]);

    if (products.length === 0) {
      return res
        .status(404)
        .json({ message: "No products found for this customer" });
    }

    const prices: number[] = products.map(
      (product: RowDataPacket) => product.price
    );

    const months = generateMonthsArray();
    const totalPrice = calculatePrices(months, prices);

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

    res.status(201).json({ message: "Dashboard created successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

export const generateMonthsArray = (): number[] => {
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
