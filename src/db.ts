import mysql, { RowDataPacket } from "mysql2/promise";

const pool = mysql.createPool({
	host: "localhost",
	user: "root",
	password: "",
	database: "customer_app",
	waitForConnections: true,
	connectionLimit: 10,
});

export async function createCustomersTable() {
	const query = `
        CREATE TABLE IF NOT EXISTS customers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

	try {
		await executeQuery(query);
		console.log('Table "Customers" created successfully');
	} catch (error) {
		console.error("Error creating table:", error);
	}
}

export async function createProductsTable() {
	const query = `
    CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        description TEXT,
        image_data MEDIUMBLOB,
        customerId INT,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
	try {
		await executeQuery(query);
		console.log('Table "products" created successfully');
	} catch (error) {
		console.error("Error creating table:", error);
	}
}

export async function createDashboardTable(){
    const query = `
    CREATE TABLE IF NOT EXISTS dashboard (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        month JSON NOT NULL,
        price_per_month JSON NOT NULL,
        total JSON NOT NULL,
        customerId INT,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    
    `
    try{
        await executeQuery(query);
        console.log('Table "Dashboard" created succesfully')
    } catch(err) {
        console.error('Error creating table: ', err)
    }
}

export async function executeQuery<T extends RowDataPacket = any>(
	query: string,
	values?: any[]
): Promise<T[]> {
	const connection = await pool.getConnection();
	console.log("Connected to database");
	try {
		const [rows] = await connection.query<T[]>(query, values);
		return rows;
	} finally {
		connection.release();
	}
}

export default pool;
