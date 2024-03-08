import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { executeQuery } from '../db';
import { Customer } from '../models/Customer';
import { jwtSecret } from '../config';
import { RowDataPacket } from 'mysql2';

const router = express.Router();

router.post('/register', async (req: Request, res: Response) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const customer: Customer = {
            name,
            email,
            password: hashedPassword,
        };
        const addUserQuery = `
            INSERT INTO customers (name, email, password)
            VALUES (?, ?, ?);
        `;
        await executeQuery(addUserQuery, [customer.name, customer.email, customer.password]);

        const fetchUserQuery = `
            SELECT id, name, email FROM customers
            WHERE email = ?;
        `;
        const newUser: RowDataPacket[] = await executeQuery<RowDataPacket>(fetchUserQuery, [customer.email]);

        const token = jwt.sign({ id: newUser[0].id, email: newUser[0].email }, jwtSecret, { expiresIn: '1h' });
        
        res.status(201).json({ message: 'Customer registered successfully', user: newUser[0], token });
    } catch (error) {
        console.error('Error registering user: ', error);
        res.status(500).json({ message: 'Server error' });
    }
});
router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const customers: RowDataPacket[] = await executeQuery<RowDataPacket>('SELECT * FROM customers WHERE email = ?', [email]);
        if (customers.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const customer = customers[0];
        const passwordMatch = await bcrypt.compare(password, customer.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: customer.id, email: customer.email }, jwtSecret, { expiresIn: '1h' });
        res.status(200).json({ message: 'Login successful', token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
