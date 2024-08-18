import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { executeQuery } from "../db";
import { Product } from "../models/Products";
import { jwtSecret } from "../config";
import { RowDataPacket } from "mysql2";
import CustomRequest from "../types/CustomerRequest";
import { DecodedUser } from "../models/DecodedUser";
import { generateMonthsArray, calculatePrices } from "./DashboardRoutes";
import path from "path";
import fs from 'fs-extra';
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
        next();
    } catch (err) {
        console.error(err);
        res.status(403).json({ message: "Invalid Token" });
    }
}

// Update price per month based on customer products
async function updatePricePerMonth(customerId: number) {
    try {
        const lastDashboardIdQuery = "SELECT id FROM dashboard ORDER BY id DESC LIMIT 1";
        const lastDashboard: any[] = await executeQuery<any>(lastDashboardIdQuery);
        let newDashboardId = 1;

        if (lastDashboard.length > 0) {
            newDashboardId = lastDashboard[0].id + 1;
        }
        const productsQuery = "SELECT price FROM products WHERE customerId = ?";
        const products = await executeQuery<RowDataPacket>(productsQuery, [customerId]);

        const prices: number[] = products.map((product: RowDataPacket) => product.price);

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

// Get all products for the authenticated customer with pagination
router.get("/", verifyToken, async (req: CustomRequest, res: Response) => {
    try {
        const customerId = req.customer?.id;
        const search = req.query.query as string | undefined;
        const page = parseInt(req.query.page as string) || 1; // Current page, default 1
        const limit = parseInt(req.query.limit as string) || 10; // Number of items per page, default 10

        if (!customerId) {
            return res.status(401).json({ message: "Unauthorized: No customer ID found" });
        }

        // Calculate offset based on page and limit
        const offset = (page - 1) * limit;

        // Query to get products with pagination and search
        const productsQuery = `
            SELECT p.id AS product_id, 
                   p.name, 
                   p.price, 
                   p.description, 
                   p.customerId, 
                   i.id AS image_id, 
                   i.filename, 
                   i.path, 
                   i.created_at
            FROM products p
            LEFT JOIN images i ON p.image_id = i.id
            WHERE p.customerId = ?
              ${search ? "AND p.name LIKE ?" : ""}
            LIMIT ? OFFSET ?
        `;
        const values: (number | string)[] = [customerId];
        if (search) {
            values.push(`%${search}%`);
        }
        values.push(limit, offset);

        const products: RowDataPacket[] = await executeQuery<RowDataPacket>(productsQuery, values);

        // Query to count total products for pagination
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM products p
            WHERE p.customerId = ?
              ${search ? "AND p.name LIKE ?" : ""}
        `;
        const countValues: (number | string)[] = [customerId];
        if (search) {
            countValues.push(`%${search}%`);
        }

        const countResult: RowDataPacket[] = await executeQuery<RowDataPacket>(countQuery, countValues);
        const totalItems = countResult[0].total; // Total items for pagination

        // Map results to include image details if available
        const baseUrl = `${req.protocol}://${req.get('host')}/uploads/products/`;
        const productsWithImage = products.map((product: any) => ({
            id: product.product_id,
            name: product.name,
            price: product.price,
            description: product.description,
            customerId: product.customerId,
            image: product.image_id ? {
                id: product.image_id,
                filename: product.filename,
                url: baseUrl + product.filename, // Construct image URL
                createdAt: product.created_at
            } : null
        }));

        // Calculate total pages
        const totalPages = Math.ceil(totalItems / limit);

        res.status(200).json({
            data: productsWithImage,
            pagination: {
                totalItems,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/:id", verifyToken, async (req: CustomRequest, res: Response) => {
    try {
        const customerId = req.customer?.id;
        const productId = parseInt(req.params.id, 10);

        if (!customerId) {
            return res.status(401).json({ message: "Unauthorized: No customer ID found" });
        }

        // Query to get product by ID
        const productQuery = `
            SELECT p.id AS product_id, 
                   p.name, 
                   p.price, 
                   p.description, 
                   p.customerId, 
                   i.id AS image_id, 
                   i.filename, 
                   i.path, 
                   i.created_at
            FROM products p
            LEFT JOIN images i ON p.image_id = i.id
            WHERE p.customerId = ? AND p.id = ?
        `;
        const values: (number | string)[] = [customerId, productId];

        const product: RowDataPacket[] = await executeQuery<RowDataPacket>(productQuery, values);

        if (product.length === 0) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Map the result to include image details if available
        const baseUrl = `${req.protocol}://${req.get('host')}/uploads/products/`;
        const productWithImage = {
            id: product[0].product_id,
            name: product[0].name,
            price: product[0].price,
            description: product[0].description,
            customerId: product[0].customerId,
            image: product[0].image_id ? {
                id: product[0].image_id,
                filename: product[0].filename,
                url: baseUrl + product[0].filename, // Construct image URL
                createdAt: product[0].created_at
            } : null
        };

        res.status(200).json(productWithImage);
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Create a new product
router.post("/", verifyToken, async (req: Request, res: Response) => {
    const { name, price, description, customerId, image_id } = req.body;

    const errors: string[] = [];
    if (!name) errors.push("Name is required.");
    if (!price) errors.push("Price is required.");
    if (!description) errors.push("Description is required.");
    if (!customerId) errors.push("CustomerId is required.");
    if (image_id === undefined) errors.push("Image ID is required.");

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    try {
        const imageQuery = "SELECT * FROM images WHERE id = ?";
        const [image] = await executeQuery(imageQuery, [image_id]);

        if (!image) {
            return res.status(404).json({ message: "Image not found" });
        }

        const lastProductIdQuery = "SELECT id FROM products ORDER BY id DESC LIMIT 1";
        const lastProduct: any[] = await executeQuery<any>(lastProductIdQuery);
        const newProductId = lastProduct.length > 0 ? lastProduct[0].id + 1 : 1;

        const product: Product = {
            id: newProductId,
            name,
            price,
            description,
            customerId,
            image_id
        };

        await executeQuery("INSERT INTO products SET ?", [product]);
        await updatePricePerMonth(customerId);

        res.status(201).json({ message: "Product created successfully" });
    } catch (error) {
        console.error("Failed to create product:", error);
        res.status(500).json({ message: "Server error while creating product" });
    }
});

// Update a product by ID
router.put("/:id", verifyToken, async (req: Request, res: Response) => {
    const productId = req.params.id;
    const { name, price, description, customerId, image_id } = req.body;
    if (!name || !price || !description || !customerId || !image_id) {
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
            image_id
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
    try {
        // Fetch product to get customerId for price update
        const productQuery = "SELECT customerId FROM products WHERE id = ?";
        const [product] = await executeQuery(productQuery, [productId]);

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        await executeQuery("DELETE FROM products WHERE id = ?", [productId]);
        await updatePricePerMonth(product.customerId);
        res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
