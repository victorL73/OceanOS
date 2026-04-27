const { getCustomers, getOrders } = require('./prestashopService');
require('dotenv').config();

async function test() {
    console.log("Testing PrestaShop connection...");
    console.log("URL:", process.env.PRESTASHOP_API_URL);
    console.log("KEY:", process.env.PRESTASHOP_API_KEY ? "PRESENT" : "MISSING");
    
    try {
        console.log("\nAttempting to fetch customers...");
        const customers = await getCustomers();
        console.log("Success! Received", customers.length, "customers.");
    } catch (err) {
        console.error("FAILED to fetch customers:", err.message);
    }

    try {
        console.log("\nAttempting to fetch orders...");
        const orders = await getOrders();
        console.log("Success! Received", orders.length, "orders.");
    } catch (err) {
        console.error("FAILED to fetch orders:", err.message);
    }
}

test();
