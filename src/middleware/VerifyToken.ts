import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { jwtSecret } from "../config";
import { DecodedUser } from "../models/DecodedUser";
import CustomRequest from "../types/CustomerRequest";

const verifyToken = (req: CustomRequest, res: Response, next: NextFunction) => {
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

export default verifyToken;