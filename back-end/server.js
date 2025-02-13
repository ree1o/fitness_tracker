require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;

const pool = new Pool({
    connectionString: process.env.DB_URL,
});

const path = require('path');

app.use(express.static(path.join(__dirname, '../front-end')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../front-end', 'index.html'));
  });
  
app.get('/api', (req, res) => {
  res.json({ message: "API is working" });
});


app.use(express.json());
app.use(cors());

pool.connect()
    .then(() => console.log("✅ Connected to PostgreSQL"))
    .catch((err) => console.error("❌ Database connection error:", err));

function authenticateToken(req, res, next) {
    const token = req.header("Authorization")?.split(" ")[1];

    if (!token) return res.status(401).json({ error: "Access denied" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
}

app.get("/", (req, res) => {
    res.send("Fitness Tracker API is running!");
});

app.post("/api/register", async (req, res) => {
    const { email, password, name, age, weight, height } = req.body;

    if (!email || !password || !name || !age || !weight || !height) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            "INSERT INTO users (email, password, name, age, weight, height) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            [email, hashedPassword, name, age, weight, height]
        );

        res.status(201).json({ success: true, message: "User registered successfully", userId: result.rows[0].id });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });

        res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/profile", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const result = await pool.query(
            "SELECT name, email, age, weight, height FROM users WHERE id = $1",
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Profile fetch error:", error);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

app.post("/api/meals", authenticateToken, async (req, res) => {
    const { meal_name, calories, date } = req.body;
    const userId = req.user.userId;

    if (!meal_name || !calories || !date) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        const result = await pool.query(
            "INSERT INTO meals (user_id, meal_name, calories, date) VALUES ($1, $2, $3, $4) RETURNING *",
            [userId, meal_name, calories, date]
        );

        res.status(201).json({ success: true, meal: result.rows[0] });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Failed to add meal" });
    }
});

app.get("/api/meals", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query("SELECT * FROM meals WHERE user_id = $1", [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Failed to fetch meals" });
    }
});

app.post("/api/calculate-bmi", authenticateToken, async (req, res) => {
    const { weight, height } = req.body;
    const userId = req.user.userId;

    if (!weight || !height) {
        return res.status(400).json({ error: "Weight and height are required" });
    }

    let bmi = weight / Math.pow(height / 100, 2);
    let bmiCategory =
        bmi < 18.5 ? "Underweight" :
        bmi < 24.9 ? "Normal weight" :
        bmi < 29.9 ? "Overweight" : "Obesity";

    try {
        await pool.query(
            "INSERT INTO bmi_records (user_id, weight, height, bmi, category) VALUES ($1, $2, $3, $4, $5)",
            [userId, weight, height, bmi.toFixed(2), bmiCategory]
        );

        res.json({ bmi: bmi.toFixed(2), category: bmiCategory });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Failed to save BMI record" });
    }
});

app.post("/api/workouts", authenticateToken, async (req, res) => {
    let { name, duration, calories, date } = req.body;
    const userId = req.user.userId;

    if (!name || !duration || !calories || !date) {
        return res.status(400).json({ error: "All fields are required" });
    }

    calories = Math.round(calories);

    try {
        const result = await pool.query(
            "INSERT INTO workouts (user_id, name, duration, calories, date) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [userId, name, duration, calories, date]
        );

        res.status(201).json({ success: true, workout: result.rows[0] });
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Failed to add workout" });
    }
});

app.get("/api/workouts", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const result = await pool.query("SELECT * FROM workouts WHERE user_id = $1", [userId]);
        res.json(result.rows);
    } catch (error) {
        console.error("Database error:", error);
        res.status(500).json({ error: "Failed to fetch workouts" });
    }
});


app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

