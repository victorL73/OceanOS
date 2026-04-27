const dashboardService = require('./dashboardService');

async function testStats() {
    console.log("=== Stats DAY ===");
    const day = await dashboardService.getStats('day');
    console.log(`CA: ${day.revenue}€ (vs ${day.revenueYesterday}€) | Commandes: ${day.orders}`);
    
    console.log("=== Stats MONTH ===");
    const month = await dashboardService.getStats('month');
    console.log(`CA: ${month.revenue}€ (vs ${month.revenueYesterday}€) | Commandes: ${month.orders}`);
    
    console.log("=== Stats YEAR ===");
    const year = await dashboardService.getStats('year');
    console.log(`CA: ${year.revenue}€ (vs ${year.revenueYesterday}€) | Commandes: ${year.orders}`);
}

testStats().catch(console.error);
