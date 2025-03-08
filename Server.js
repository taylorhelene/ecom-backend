const dotenv = require('dotenv');
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
dotenv.config();

const {User} = require('./User')

const salt = bcrypt.genSaltSync(10);
const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Register Route
app.post('/register',async(req,res)=>{
    const { email, password } = req.body;
    
    if (User.find(user => user.email === email)) {
      return res.status(400).json({ message: "User already exists" });
    }else{
      const hashedPassword = await bcrypt.hash(password, salt);
      const user = new User({ email, password: hashedPassword});
      await user.save();
      res.status(201).json({ message: "User registered successfully!" });
    }
})

// Login Route
app.post('/login',async(req,res)=>{
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials!" });

    const token = jwt.sign({ email: user.email }, "secret", { expiresIn: "1h" });
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
