import UserModel from "../model/user.model.js";
import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

const stripe = new Stripe(
  process.env.STRIPE_SECRET || "sk_test_mock_secret_key"
);

/**
 * Create Stripe Checkout Session for Pro Plan
 */
export const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const appUrl = process.env.APP_URL || "http://localhost:9000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Lnaguage_Learning Pro subscription",
              description: "Unlock premium AI voice tutoring, unlimited chats, and advanced analytics feedback.",
            },
            unit_amount: 999, // $9.99
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      customer_email: user.email,
      success_url: `${appUrl}/api/v1/subscription/success?session_id={CHECKOUT_SESSION_ID}&userId=${userId}`,
      cancel_url: `${appUrl}/api/v1/subscription/cancel`,
    });

    return res.status(200).json({
      success: true,
      message: "Stripe checkout session created successfully",
      result: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error) {
    console.error("❌ Stripe Checkout Session Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Stripe billing session generation failed",
      error: error.message,
    });
  }
};

/**
 * Handle success callback from Stripe Checkout (simplified for testing/dev environments)
 */
export const stripeSuccessCallback = async (req, res) => {
  try {
    const { userId, session_id } = req.query;

    if (!userId || !session_id) {
      return res.status(400).send("<h1>Error: Missing required payment details</h1>");
    }

    // Verify session state
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === "paid") {
      await UserModel.findByIdAndUpdate(userId, { plan: "pro" });
      return res.send(`
        <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
          <h1 style="color: #8B1E4F;">🎉 Welcome to Lnaguage_Learning Premium!</h1>
          <p>Your subscription payment was processed successfully.</p>
          <p>You can close this tab and return to the mobile application now.</p>
        </div>
      `);
    } else {
      return res.status(400).send("<h1>Payment Verification Failed</h1>");
    }
  } catch (error) {
    console.error("❌ stripe success callback error:", error.message);
    return res.status(500).send("<h1>Server error during payment verification</h1>");
  }
};

/**
 * Upgrade plan to Pro manually (for in-app purchase validation or sandbox testing)
 */
export const upgradeToProManual = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.plan = "pro";
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Account upgraded to Pro successfully",
      result: {
        id: user._id,
        name: user.name,
        plan: user.plan,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to upgrade account", error: error.message });
  }
};

/**
 * Downgrade plan to Free
 */
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.plan = "free";
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      result: {
        id: user._id,
        name: user.name,
        plan: user.plan,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to cancel subscription", error: error.message });
  }
};
