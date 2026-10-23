const db = require('../src/config/database');
const { getAnalyticsOverview } = require('../src/controllers/analyticsController');

async function test() {
  for (const tid of [1, 2, 3]) {
    const ind = tid === 1 ? 'real_estate' : tid === 2 ? 'legal' : 'general';
    const mockReq = { user: { tenant_id: tid, tenant_industry: ind }, query: {} };
    const mockRes = {
      json: (payload) => {
        console.log(`\n=== Analytics Overview for Tenant ${tid} (${ind}) ===`);
        console.log('Gross Revenue:', payload.data.financialSummary.grossRevenueKes, 'Expenditure:', payload.data.financialSummary.totalExpenditureKes, 'Net Profit:', payload.data.financialSummary.netProfitKes, 'Net Margin:', payload.data.financialSummary.netMarginPercent + '%');
        console.log('Staff Productivity Leaderboard:');
        payload.data.staffProductivityLeaderboard.forEach((s) => {
          console.log(`  • ${s.name} (${s.role}): Won: KES ${s.wonRevenueKes.toLocaleString()} | Cost: KES ${s.allocatedCostKes.toLocaleString()} | Net: KES ${s.netContributionKes.toLocaleString()} | ROI: ${s.roiMultiplier}x | [${s.tier}] -> ${s.actionTag}`);
        });
      },
      status: (code) => ({
        json: (p) => console.error('Error:', code, p)
      })
    };
    await getAnalyticsOverview(mockReq, mockRes);
  }
  process.exit(0);
}

test();
