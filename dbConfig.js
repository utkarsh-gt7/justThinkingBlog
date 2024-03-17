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

// SQL command to create the "comments" table
const createCommentsTableQuery = `
    CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        content TEXT,
        post_id INTEGER,
        date TEXT,
        name TEXT,
        grav_url TEXT
    )
`;

// SQL command to create the "blogposts" table
const createBlogpostsTableQuery = `
    CREATE TABLE IF NOT EXISTS blogposts (
        id SERIAL PRIMARY KEY,
        author_id INTEGER,
        title TEXT,
        subtitle TEXT,
        date TEXT,
        body TEXT,
        img_url TEXT
    )
`;

// SQL command to create the "users" table
const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT,
        password TEXT,
        role TEXT,
        grav_url TEXT
    )
`;

// Execute the SQL commands to create the tables
db.query(createCommentsTableQuery, (err, res) => {
    if (err) {
        console.error("Error creating 'comments' table", err);
    } else {
        console.log("Table 'comments' created successfully");
    }
});

db.query(createBlogpostsTableQuery, (err, res) => {
    if (err) {
        console.error("Error creating 'blogposts' table", err);
    } else {
        console.log("Table 'blogposts' created successfully");
    }
});

db.query(createUsersTableQuery, (err, res) => {
    if (err) {
        console.error("Error creating 'users' table", err);
    } else {
        console.log("Table 'users' created successfully");
    }
});

export default db;
