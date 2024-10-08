import { Router } from "express";
import Stripe from "stripe";
import { db, admin } from "../firebase-initialize";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

router.post("/", async (req, res) => {
  const { email, amount, currency } = req.body;

  console.log("Received create-payment-intent request:", req.body);

  if (!email || !amount || !currency) {
    return res.status(400).send({ error: "Missing required parameters" });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      receipt_email: email,
    });

    // Save payment record to Firestore
    const paymentId = paymentIntent.id;
    await db.collection("payments").add({
      user_email: email,
      payment_id: paymentId,
      isConfirmed: false, // Initially not confirmed
      amount,
      currency,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).send({
      client_secret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({ error: "Failed to create payment intent" });
  }
});

export default router;
