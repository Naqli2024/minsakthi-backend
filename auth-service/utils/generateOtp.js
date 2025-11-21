exports.generateOtp = () => {
  const otp = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
  const expiry = new Date(Date.now() + 30 * 1000); // expires in 30 seconds
  return { otp, expiry };
};