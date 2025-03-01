require('dotenv').config;
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const User = require('./User')

const salt = bcrypt.genSaltSync(10);
const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Register Route
app.post('/register',async(req,res)=>{
    const { email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({ email, password: hashedPassword, role });
    await user.save();
    res.status(201).json({ message: "User registered successfully!" });
})

// Login Route
app.post('/login',async(req,res)=>{
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials!" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token, role: user.role });
})

// Middleware for Auth
const auth = (req, res, next) => {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ message: "Access Denied" });
  
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      req.user = verified;
      next();
    } catch {
      res.status(400).json({ message: "Invalid Token" });
    }
};

// Admin Middleware
const adminAuth = (req, res, next) => {
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
    next();
};
  
// Get All Products
app.get("/products", async (req, res) => {
    const products = await Product.find();
    res.json(products);
});


// Add Product (Admin Only)
app.post("/products/add", auth, adminAuth, async (req, res) => {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ message: "Product added!" });
});