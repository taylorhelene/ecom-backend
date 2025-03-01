let mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: String,
    stock: Number,
    price: Number,
    shortDesc: String,
    description: String,
})

const Product = mongoose.model("Product", ProductSchema);
module.exports(Product)