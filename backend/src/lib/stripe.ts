import Stripe from "stripe";
import { env } from "../config/env.js";

export const stripe = new Stripe(env.stripeSecretKey);
