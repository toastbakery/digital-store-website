import { Router } from "express";
import { db, admin } from "../firebase-initialize";
import Stripe from "stripe";
import bodyParser from "body-parser"; // To handle raw body in webhooks
import sendOrderEmail from "../send-order-email"; // Import send-order-email module

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

// Stripe Webhook Handler
router.post(
  "/",
  bodyParser.raw({ type: "application/json" }), // Only parse raw body for webhook
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event;

    try {
      // Verify webhook signature using STRIPE_WEBHOOK_SECRET
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error processing webhook:", err.message);
      } else {
        console.error("Unknown error:", err);
      }
      return res.sendStatus(400);
    }

    const dataObject = event.data.object;

    // Ensure dataObject is a PaymentIntent
    if (dataObject && "id" in dataObject && typeof dataObject.id === "string") {
      const paymentId = dataObject.id;
      console.log("paymentId", paymentId);

      const eventType = event.type;
      let paymentConfirmed;

      if (eventType === "payment_intent.succeeded") {
        paymentConfirmed = true;
        console.log("eventType", eventType);
      } else if (eventType === "payment_intent.payment_failed") {
        paymentConfirmed = false;
      } else {
        return res.status(400).send({
          message: "Received unknown event type",
        });
      }

      try {
        // Find the corresponding payment record in Firestore
        const paymentRef = db
          .collection("payments")
          .where("payment_id", "==", paymentId);
        const paymentSnapshot = await paymentRef.get();
        console.log("Looking for payment with payment_id:", paymentId);
        if (paymentSnapshot.empty) {
          console.log("No payment found for payment_id:", paymentId);
          return res.status(404).send({
            message: "Payment not found",
          });
        }
        console.log("Payment found:", paymentSnapshot.docs[0].data());
        const paymentRecord = paymentSnapshot.docs[0];
        await paymentRecord.ref.update({ isConfirmed: paymentConfirmed });

        // Send order confirmation email
        const paymentData = paymentRecord.data();
        console.log("paymentData:", paymentData);
        await sendOrderEmail({ email: paymentData.user_email });

        return res.status(200).send({
          message: "Payment confirmed successfully",
        });
      } catch (error) {
        console.error("Error updating payment status:", error);
        return res.status(500).send({
          message: "Internal server error",
        });
      }
    } else {
      return res.status(400).send({
        message: "Invalid event data object",
      });
    }
  }
);

export default router;
