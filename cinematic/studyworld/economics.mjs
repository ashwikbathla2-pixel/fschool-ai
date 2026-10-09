// Unit economics with operating costs (PRD section 9 model, rebuilt for the spike "Unit economics with opex").
// Run: node economics.mjs            Prints the PRD table (revenue minus payouts) and the same cases with costs, at 100,000 and 10,000 students.
// EVERY COST BELOW IS A PLACEHOLDER ASSUMPTION, not a quote: replace with real vendor invoices and payroll before using it with investors.
// The PRD revenue and payout numbers are exact and are checked by economics.test.mjs.

export const PRD = { students: 100000, proShare: 0.5, proPrice: 49, basicPrice: 15, payout: 2000 };

export const ASSUMPTIONS = {                       // per month unless noted
  computeBasic: 2.5, computePro: 5.5,              // LLM + hosting + voice per active student: Pro studies more and gets the tutor plus plan updates
  paymentFeePct: 0.029, paymentFeeFixed: 0.30,     // card processing
  supportPerStudent: 0.8,                          // support and trust-and-safety
  portalPerProStudent: 0.6,                        // grade sync and verification
  reviewCostPerClaim: 25,                          // a person reviews held claims
  heldClaimShare: 0.3,                             // share of claims that are held for review
  staffAnnualBase: 1_200_000, staffPer10k: 250_000,// a small team at the start, growing with scale
  cac: 40,                                         // marketing cost per new paying student, once
  monthlyChurn: 0.06,                              // share of students who leave each month (drives how many new students must be bought)
  retakeTuitionShare: 0.5,                         // PRD proposal: pay as retake tuition/credit: the cash cost is lower than the face value. 1 = all cash
};

export function model({ students = PRD.students, proShare = PRD.proShare, proPrice = PRD.proPrice, basicPrice = PRD.basicPrice, payout = PRD.payout, claimRate, a = ASSUMPTIONS, withCosts = true }) {
  const pro = students * proShare, basic = students - pro;
  const revenue = (pro * proPrice + basic * basicPrice) * 12;
  const claims = pro * claimRate, payouts = claims * payout;
  const out = { students, revenue, claims, payoutsFace: payouts, netBeforeOpex: revenue - payouts };
  if (!withCosts) return out;
  const compute = (basic * a.computeBasic + pro * a.computePro) * 12;
  const fees = revenue * a.paymentFeePct + (pro + basic) * 12 * a.paymentFeeFixed;
  const support = students * a.supportPerStudent * 12 + pro * a.portalPerProStudent * 12;
  const review = claims * a.heldClaimShare * a.reviewCostPerClaim;
  const staff = a.staffAnnualBase + a.staffPer10k * (students / 10000);
  const marketing = students * a.monthlyChurn * 12 * a.cac;                     // replace churned students to hold the base steady
  const payoutCash = payouts * a.retakeTuitionShare;                                    // the cash-equivalent cost when part of each payout is retake tuition or credit
  const costs = { compute, fees, support, review, staff, marketing };
  const opex = Object.values(costs).reduce((s, v) => s + v, 0);
  return { ...out, costs, opex, payoutsCash: payoutCash, net: revenue - payouts - opex, netCashPayout: revenue - payoutCash - opex, perStudentNet: (revenue - payouts - opex) / students };
}

// Highest Pro claim rate at which the year still breaks even (net = 0), found by bisection.
export function breakEvenClaimRate(opts = {}) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (model({ ...opts, claimRate: mid }).net > 0) lo = mid; else hi = mid; }
  return Math.round(lo * 10000) / 10000;
}

const $m = v => (v / 1e6).toFixed(2) + 'M', $k = v => '$' + Math.round(v / 1000).toLocaleString() + 'k';
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const students of [100000, 10000]) {
    console.log(`\n${students.toLocaleString()} students, half Pro at $49, half Basic at $15, $2,000 per claim`);
    console.log('claim rate | revenue | payouts | net before opex (PRD) | opex | net after opex | per student');
    for (const claimRate of [0.05, 0.1, 0.2]) {
      const m = model({ students, claimRate });
      console.log(`${(claimRate * 100).toFixed(0).padStart(9)}% | $${$m(m.revenue)} | $${$m(m.payoutsFace)} | $${$m(m.netBeforeOpex)} | $${$m(m.opex)} | $${$m(m.net)} | $${Math.round(m.perStudentNet)}`);
    }
    console.log('break-even Pro claim rate:', (breakEvenClaimRate({ students }) * 100).toFixed(1) + '%');
  }
  console.log('\nCost lines at 10,000 students, 10% claim rate:', Object.fromEntries(Object.entries(model({ students: 10000, claimRate: 0.1 }).costs).map(([k, v]) => [k, $k(v)])));
}
