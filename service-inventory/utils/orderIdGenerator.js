let counter = 1;

const generateOrderId = () => {
  const year = new Date().getFullYear();
  const formatted = String(counter).padStart(2, '0'); // 01, 02, 03
  counter++;
  return `ORD-${year}-${formatted}`;
};

module.exports = generateOrderId;