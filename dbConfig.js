import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

db.connect();
export default db;