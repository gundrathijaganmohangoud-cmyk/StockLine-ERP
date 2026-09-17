// Pure, dependency-free pricing math, unit-testable in isolation.
// All arithmetic is done in integer "cents" to avoid binary floating point
// drift. The backend uses these functions as the single source of truth for
// line_amount and grand_total - values submitted by clients are ignored.

const PERCENT_BPS = 10000; // 100 percent expressed in basis points

function toCents(value, label) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new Error((label || 'value') + ' must be a finite number');
  }
  return Math.round(num * 100);
}

function pctToBps(value, label) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new Error((label || 'percentage') + ' must be a finite number');
  }
  return Math.round(num * 100);
}

function round2(cents) {
  return Math.round(cents) / 100;
}

// base           = quantity * unit_price
// after_discount = base * (1 - discount_pct/100)
// line_amount    = after_discount * (1 + gst_pct/100)
function calculateLineAmount(input) {
  const line = input || {};
  const qty = Number(line.quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error('quantity must be a positive integer');
  }
  const priceCents = toCents(line.unitPrice, 'unitPrice');
  if (priceCents < 0) throw new Error('unitPrice must not be negative');

  const discountBps = pctToBps(line.discountPct === undefined ? 0 : line.discountPct, 'discountPct');
  if (discountBps < 0 || discountBps > PERCENT_BPS) {
    throw new Error('discountPct must be between 0 and 100');
  }
  const gstBps = pctToBps(line.gstPct === undefined ? 0 : line.gstPct, 'gstPct');
  if (gstBps < 0) throw new Error('gstPct must not be negative');

  const baseCents = qty * priceCents;
  const afterDiscountCents = Math.round((baseCents * (PERCENT_BPS - discountBps)) / PERCENT_BPS);
  const gstCents = Math.round((afterDiscountCents * gstBps) / PERCENT_BPS);
  const lineCents = afterDiscountCents + gstCents;

  return {
    baseAmount: round2(baseCents),
    discountAmount: round2(baseCents - afterDiscountCents),
    gstAmount: round2(gstCents),
    lineAmount: round2(lineCents),
  };
}

// Recomputes every line from its raw inputs and sums the line amounts.
function calculateGrandTotal(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('at least one line item is required');
  }
  let totalCents = 0;
  for (const line of lines) {
    const calc = calculateLineAmount(line);
    totalCents += Math.round(calc.lineAmount * 100);
  }
  return round2(totalCents);
}

module.exports = { calculateLineAmount, calculateGrandTotal, toCents, pctToBps };

