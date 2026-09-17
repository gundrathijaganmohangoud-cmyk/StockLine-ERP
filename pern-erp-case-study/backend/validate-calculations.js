// Sanity check for the pricing math. Run with: node validate-calculations.js
// (No dependencies - plain Node.)
const { calculateLineAmount, calculateGrandTotal } = require('./src/utils/calculations');

let failures = 0;
function check(label, actual, expected) {
  const ok = Math.abs(actual - expected) < 0.005;
  if (!ok) failures++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + label + '  got=' + actual + ' expected=' + expected);
}

// Case 1: 10 x 100, 10 pct discount, 18 pct GST -> 1062.00
const l1 = calculateLineAmount({ quantity: 10, unitPrice: 100, discountPct: 10, gstPct: 18 });
check('line1 base', l1.baseAmount, 1000);
check('line1 discount', l1.discountAmount, 100);
check('line1 gst', l1.gstAmount, 162);
check('line1 lineAmount', l1.lineAmount, 1062);

// Case 2: 5 x 200, 0 pct discount, 5 pct GST -> 1050.00
const l2 = calculateLineAmount({ quantity: 5, unitPrice: 200, discountPct: 0, gstPct: 5 });
check('line2 lineAmount', l2.lineAmount, 1050);

// Case 3: 1 x 999.99, 12.5 pct discount, 0 pct GST -> 874.99
const l3 = calculateLineAmount({ quantity: 1, unitPrice: 999.99, discountPct: 12.5, gstPct: 0 });
check('line3 lineAmount', l3.lineAmount, 874.99);

// Grand totals
check('grand(1+2)', calculateGrandTotal([
  { quantity: 10, unitPrice: 100, discountPct: 10, gstPct: 18 },
  { quantity: 5, unitPrice: 200, discountPct: 0, gstPct: 5 },
]), 2112);
check('grand(3)', calculateGrandTotal([{ quantity: 1, unitPrice: 999.99, discountPct: 12.5, gstPct: 0 }]), 874.99);

// Validation guards must reject bad input.
function expectThrow(label, fn) {
  try {
    fn();
    failures++;
    console.log('FAIL  ' + label + '  did not throw');
  } catch (err) {
    console.log('PASS  ' + label + '  threw: ' + err.message);
  }
}
expectThrow('qty 0 rejected', () => calculateLineAmount({ quantity: 0, unitPrice: 100 }));
expectThrow('discount 150 rejected', () => calculateLineAmount({ quantity: 2, unitPrice: 100, discountPct: 150 }));
expectThrow('negative price rejected', () => calculateLineAmount({ quantity: 2, unitPrice: -5 }));
expectThrow('empty lines rejected', () => calculateGrandTotal([]));

console.log(failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);
