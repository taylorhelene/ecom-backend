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