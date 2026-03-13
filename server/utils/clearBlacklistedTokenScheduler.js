import cron from "node-cron";
import BlacklistedToken from "../models/BlacklistedToken.js";

const clearBlacklistedTokenScheduler = cron.schedule("0 0 * * *", async () => {
  const currentDate = Math.floor(Date.now() / 1000);
  await BlacklistedToken.deleteMany({
    expiryAt: { $lte: currentDate },
  }).exec();
});

export default clearBlacklistedTokenScheduler;
