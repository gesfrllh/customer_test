import express, {  Request, Response } from "express";
import { executeQuery } from "../db";
import { Customer } from "../models/Customer";
import bcrypt from "bcrypt";
import { RowDataPacket } from "mysql2";
import CustomRequest from "../types/CustomerRequest";
import verifyToken from "../middleware/VerifyToken";

const router = express.Router();


const getDataDashboard = async (req: CustomRequest): Promise<any | null> => {
  const token = req.headers.authorization?.split(" ")[1];
  try {
    const getDashboardResponse = await fetch("http://localhost:8080/api/dashboard", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!getDashboardResponse.ok) {
      throw new Error("Failed to fetch dashboard data");
    }

    const dashboardData = await getDashboardResponse.json();
    return dashboardData.length > 0 ? dashboardData : null; // Return null if no dashboard exists
  } catch (err) {
    console.error(err);
    return null;
  }
};


router.get('/', verifyToken, async (req: CustomRequest, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  try {
    const customerId = req.customer?.id; // Extract customer ID from JWT

    if (!customerId) {
      return res.status(401).json({ message: "Unauthorized: No customer ID found" });
    }

    // Fetch customer details
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

    const customerWithProducts = {
      id: customerResults[0].customerId,
      name: customerResults[0].customerName,
      email: customerResults[0].customerEmail,
    };

    const dashboardData = await getDataDashboard(req);

    if (dashboardData) {
      return res.status(200).json({ customer: customerWithProducts, dashboard: dashboardData });
    }

    const createDashboardResponse = await fetch("http://localhost:8080/api/dashboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: "My Dashboard" }),
    });

    if (!createDashboardResponse.ok) {
      throw new Error("Failed to create dashboard");
    }
    const newDashboardData = await getDataDashboard(req);

    res.status(200).json({ customer: customerWithProducts, dashboard: newDashboardData });
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
