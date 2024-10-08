import path from "path";
import express from "express";
import { db, admin } from "./firebase-initialize";
import dotenv from "dotenv";
import cors from "cors"; // Ensure you've installed this and @types/cors
import createPaymentIntent from "./api/create-payment-intent"; // API route
import webhook from "./api/webhook"; // Webhook route

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes

// Static files
app.use(express.static(path.join(__dirname, "../../frontend/dist")));

// Register the webhook route with bodyParser.raw for Stripe
app.use("/webhook", webhook);

// Use express.json() for other routes AFTER webhook route
app.use(express.json());

// Register other API routes
app.use("/api/create-payment-intent", createPaymentIntent);

// Front-end “catch-all” processing
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
