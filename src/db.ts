import mysql, {RowDataPacket} from 'mysql2/promise';

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'customer_app', 
    waitForConnections: true,
    connectionLimit: 10
});

export async function executeQuery<T extends RowDataPacket = any>(query: string, values?: any[]): Promise<T[]> {
    const connection = await pool.getConnection();
    console.log('Connected to database')
    try {
        const [rows] = await connection.query<T[]>(query, values);
        return rows;
    } finally {
        connection.release();
    }
}


// (async()=> {
//     try{
//         const conn = await pool.getConnection();
//         console.log('connected to database')
//         conn.release();
//     }catch(err){
//         console.error('Error connecting database')
//     } finally{
//         pool.end
//     }
// })
export default pool;
