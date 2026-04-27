const axios = require('axios');

async function testApi() {
    try {
        const res = await axios.post('http://localhost:3001/api/crm/send-email', {
            to: "test@domain.com",
            subject: "Test Promo",
            message: "Promo message body",
            clientId: 1, // Must be an existing client ID in Prestashop or mock?
            type: "promo"
        });
        console.log("Success:", res.data);
    } catch (e) {
        console.error("Error API:", e.response ? e.response.data : e.message);
    }
}
testApi();
