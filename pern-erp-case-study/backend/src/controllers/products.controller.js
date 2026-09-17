const prisma = require('../config/db');

// GET /api/products - catalog with live availability for dropdowns.
exports.listProducts = async function listProducts(_req, res) {
  const products = await prisma.product.findMany({
    orderBy: { productName: 'asc' },
    include: { inventory: true },
  });
  const data = products.map(function (p) {
    return {
      id: p.id,
      productCode: p.productCode,
      productName: p.productName,
      category: p.category,
      unit: p.unit,
      basePrice: p.basePrice,
      availableQty: p.inventory
        ? p.inventory.physicalQty - p.inventory.reservedQty - p.inventory.damagedQty
        : 0,
    };
  });
  return res.status(200).json(data);
};

