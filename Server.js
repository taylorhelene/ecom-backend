const dotenv = require('dotenv');
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const unirest = require('unirest');
const ngrok = require('ngrok');
const nodemailer = require('nodemailer'); 
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
      addr: 3001,
  });

  console.log(`Listening on url ${url}`);
  console.log("Ngrok tunnel initialized!");
})();

// Get timestamp and encoded password for the Authorization API 

let Timestampstring = generateTimestamp();
let encodingpassword= `174379${process.env.passkey}${Timestampstring}`
let base64PasswordEncoded = Buffer.from(encodingpassword).toString('base64');
let CheckoutRequestID = "";

app.post('/payment', async (req, res) => {

  try {

  // create callback url with ngrok
  const callback_url = await ngrok.connect(3001);
  const api = ngrok.getApi();
  await api.listTunnels();
  const { amount, number, Order_ID } = req.body;
  //encode token
  const base64AuthEncoded = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64'); //Base64 Encode (Consumer Key : Consumer Secret)

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
    console.log(tokken)

    // this request is from the M-Pesa Express Api Simulate option
    unirest('POST', 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest')
    .headers({'Content-Type': 'application/json', 'Authorization': `Bearer ${tokken}`})
    .send(JSON.stringify({
            "BusinessShortCode": 174379,
            "Password": base64PasswordEncoded,
            "Timestamp": Timestampstring,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount,
            "PartyA": number,
            "PartyB": 174379,
            "PhoneNumber": number,
            "CallBackURL": `${callback_url}/payment-callback/${Order_ID}`,
            "AccountReference": "CompanyXLTD",
            "TransactionDesc": "Payment of X" }))
    .end(response2 => {
            if (response2.error) throw new Error(response2.error);
            console.log(response2)

              CheckoutRequestID=response2.body.CheckoutRequestID;
              res.send({ 
                ...response2.body,
                Order_ID: Order_ID 
              });  

          });
    })

  } catch (error) {
    res.status(500).send({ error: 'Payment initiation failed' });
    console.log("here",error)
  }
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
          "CheckoutRequestID": req.body.CheckoutRequestID,
      }))
      .end(response => {
        if (response.error) {
          res.status(500).send({ error: response.error });
        } else {
          res.status(200).send({
            CheckoutRequestID: req.body.CheckoutRequestID,
            ResultCode: response.body.ResultCode,
            ResultDesc: response.body.ResultDesc
          });
        }
        /* CORRECT RESPONSE BODY{
  ResponseCode: '0',
  ResponseDescription: 'The service request has been accepted successsfully',
  MerchantRequestID: '7071-4170-a0e4-8345632bad441412267',
  CheckoutRequestID: 'ws_CO_04072024151523730722724071',
  ResultCode: '1032',
  ResultDesc: 'The service request is processed successfully.'
}*/
      });
  
});

// Email configuration (update with your email service details)
const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
        user: process.env.nodemailergmail,
        pass: process.env.nodemailerpass,
  },
});

app.post('/send-receipt', async (req, res) => {
  const { email, checkoutId, totalCost, cartItems, orderId } = req.body;

  const itemsList = cartItems.map(item => 
    `${item.product.name} - ${item.amount} x ${item.product.price} = ${item.amount * item.product.price}`
  ).join('\n');

  const mailOptions = {
    from: 'your-email@gmail.com',
    to: email,
    subject: `Order Receipt #${orderId}`,
    text: `Thank you for your purchase!\n\nOrder ID: ${orderId}\nCheckout ID: ${checkoutId}\n\nItems:\n${itemsList}\n\nTotal: ${totalCost}\n\nPayment Status: Completed`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send({ message: 'Receipt sent successfully' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).send({ error: 'Failed to send receipt' });
  }
});

app.listen(3001, () => console.log("Server running on port 3001"));
