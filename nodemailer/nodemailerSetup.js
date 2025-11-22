import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const emailAccounts = [
  { user: process.env.EMAIL_USER_1, pass: process.env.EMAIL_PASS_1 },
  { user: process.env.EMAIL_USER_2, pass: process.env.EMAIL_PASS_2 },
  { user: process.env.EMAIL_USER_3, pass: process.env.EMAIL_PASS_3 },
  // add more if needed
];

// Pick random transporter
function getRandomTransporter() {
  const randomAccount = emailAccounts[Math.floor(Math.random() * emailAccounts.length)];
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: randomAccount.user,
      pass: randomAccount.pass,
    },
  });
}

// Export function you call whenever you need a transporter
export function transporter() {
  return getRandomTransporter();
}

// ✅ Optional: Verify ALL accounts at startup
emailAccounts.forEach(acc => {
  const testTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: acc.user, pass: acc.pass },
  });

  testTransporter.verify((error, success) => {
    if (error) {
      console.error(`❌ Error with account ${acc.user}:`, error.message);
    } else {
      console.log(`✅ Account ready: ${acc.user}`);
    }
  });
});
