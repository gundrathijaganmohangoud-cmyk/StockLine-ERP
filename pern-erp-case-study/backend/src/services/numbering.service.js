const { httpError } = require('../utils/apiResponse');

// Atomically increments a document counter inside the CURRENT transaction and
// returns the formatted document number, e.g. ('ENQ') -> 'ENQ-0007'.
//
// Concurrency: the UPDATE takes a row lock on the counter row until the
// transaction commits, so two simultaneous creations get distinct numbers.
// Requires the counter rows to exist (created by prisma/seed.js and the test
// helper): ENQ, QTN, SO, DSP.
async function nextDocumentNumber(tx, docType, prefix) {
  let counter;
  try {
    counter = await tx.documentCounter.update({
      where: { docType: docType },
      data: { lastNumber: { increment: 1 } },
    });
  } catch (err) {
    if (err && err.code === 'P2025') {
      throw httpError(500, 'Document counter "' + docType + '" is missing. Run "prisma db seed" first.');
    }
    throw err;
  }
  return prefix + '-' + String(counter.lastNumber).padStart(4, '0');
}

module.exports = { nextDocumentNumber };
