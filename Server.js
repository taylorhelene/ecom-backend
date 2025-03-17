const dotenv = require('dotenv');
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const unirest = require('unirest');
const ngrok = require('ngrok');
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

    const search = await User.findOne({ email });
    if ( search) {
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

    const accessToken = jwt.sign({ email: user.email }, "secret", { expiresIn: "1h" });
    res.json({ accessToken});
})

let tokken = "";

// Get the Daraja API credentials from the .env file
const consumerKey = process.env.consumerKey;
const consumerSecret = process.env.consumerSecret;

// Generate a timestamp with the following function (format: YYYYMMDDHHmmss)

const generateTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// initialize ngrok using the following function

(async function() {
  console.log("Initializing Ngrok tunnel...");

  // Initialize ngrok using auth token and hostname
  const url = await ngrok.connect({
      proto: "http",
      // Your authtoken if you want your hostname to be the same everytime
      authtoken: process.env.ngrokauth,
      // Your hostname if you want your hostname to be the same everytime
      hostname: "",
      // Your app port
      addr: port,
  });

  console.log(`Listening on url ${url}`);
  console.log("Ngrok tunnel initialized!");
})();

// Get timestamp and encoded password for the Authorization API 

let Timestampstring = generateTimestamp();
let encodingpassword= `174379${process.env.passkey}${Timestampstring}`
let base64PasswordEncoded = Buffer.from(encodingpassword).toString('base64');
let CheckoutRequestID = "";

app.post('/lipa', async (req, res) => {

  // create callback url with ngrok
  const callback_url = await ngrok.connect(port);
  const api = ngrok.getApi();
  await api.listTunnels();
  console.log("callback ",callback_url)
 
  //encode token
  const base64AuthEncoded = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64'); //Base64 Encode (Consumer Key : Consumer Secret)
  const {Order_ID} = req.body

  //promise to generate token
  let getToken=()=>{

    return new Promise((resolve,reject)=>{
      // request is from the auth api
      unirest('GET', 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials')
      .headers({ 'Authorization': `Basic ${base64AuthEncoded}` })
      .send()
      .end(response => {
        if (response.error) throw new Error(response.error);
          resolve(response)
          });
        })

  }

  //get token body
  getToken().then(response=>{
    //get token
    let jsonstring = response.body
    tokken = jsonstring.access_token;

    // this request is from the M-Pesa Express Api Simulate option
    unirest('POST', 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest')
    .headers({'Content-Type': 'application/json', 'Authorization': `Bearer ${tokken}`})
    .send(JSON.stringify({
            "BusinessShortCode": 174379,
            "Password": base64PasswordEncoded,
            "Timestamp": Timestampstring,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": 1,
            "PartyA": process.env.number,
            "PartyB": 174379,
            "PhoneNumber": process.env.number,
            "CallBackURL": `${callback_url}/payment-callback/${Order_ID}`,
            "AccountReference": "CompanyXLTD",
            "TransactionDesc": "Payment of X" }))
    .end(response2 => {
            if (response2.error) throw new Error(response2.error);
              CheckoutRequestID=response2.body.CheckoutRequestID;
              res.send(response2.body)
                        
               });
    })
});

app.post('/payment-callback/', async(req, res) => {
  // Handle payment callback logic here
  // Verify the payment and update your application's records
  // Respond with a success message
  Timestampstring = generateTimestamp();
  encodingpassword= `174379${process.env.passkey}${Timestampstring}`
  base64PasswordEncoded = Buffer.from(encodingpassword).toString('base64');

  unirest('POST', 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query')
      .headers({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokken}`
      })
      .send(JSON.stringify({
          "BusinessShortCode": 174379,
          "Password": base64PasswordEncoded,
          "Timestamp": Timestampstring,
          "CheckoutRequestID": `${CheckoutRequestID}`,
      }))
      .end(response => {
        if (response.error) throw new Error(response.error);
        console.log(response.body);
        res.status(200).send('Payment processed.');
      });
  
});

app.listen(3001, () => console.log("Server running on port 3001"));
