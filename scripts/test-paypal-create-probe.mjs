import { Client, Functions } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_URL)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID);
const functions = new Functions(client);
const createId = process.env.VITE_CREATE_ORDER_FUNCTION_ID;

const exec = await functions.createExecution(
  createId,
  JSON.stringify({
    items: [{ id: "probe", name: "Test", price: 10, quantity: 1 }],
    amount: "10.00",
    currency: "USD",
    shipping: {
      full_name: "Test",
      phone: "+15551234567",
      line_1: "1 St",
      city: "NYC",
      postal_code: "10001",
      country: "US",
    },
    payment_method: "paypal",
  })
);
console.log("status", exec.responseStatusCode);
console.log((exec.responseBody || "").slice(0, 500));
