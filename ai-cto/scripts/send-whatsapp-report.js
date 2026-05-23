const https = require('https');
const { loadEngineeringState } = require('../whatsapp/state-reader');
const { groupChatDailyUpdate, immediateAlerts } = require('../whatsapp/school-mode-policy');
const { logAgentAction } = require('../whatsapp/agent-action-log');

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const from = process.env.TWILIO_WHATSAPP_FROM || '';
const to = process.env.FOUNDER_WHATSAPP_NUMBER || '';

function buildMessage(state) {
  const alerts = immediateAlerts(state);
  return [
    groupChatDailyUpdate(state),
    '',
    alerts.length
      ? `Immediate alerts: ${alerts.map((alert) => alert.risk).join(' | ')}`
      : 'Immediate alerts: none.'
  ].join('\n').slice(0, 1500);
}

function sendTwilioMessage(body) {
  return new Promise((resolve, reject) => {
    if (!accountSid || !authToken || !from || !to) {
      resolve({ skipped: true, reason: 'Twilio WhatsApp secrets not configured.' });
      return;
    }
    const payload = new URLSearchParams({
      From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      Body: body
    }).toString();
    const request = https.request({
      method: 'POST',
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      auth: `${accountSid}:${authToken}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve({ skipped: false, statusCode: response.statusCode });
        } else {
          reject(new Error(`Twilio send failed ${response.statusCode}: ${data.slice(0, 300)}`));
        }
      });
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

async function main() {
  const state = loadEngineeringState();
  const body = buildMessage(state);
  const result = await sendTwilioMessage(body);
  logAgentAction({
    agentName: 'CTO',
    actionTaken: 'sent daily WhatsApp school-mode report',
    reason: 'Daily 7am report always, even if nothing changed.',
    riskLevel: 'LOW',
    outcome: result.skipped ? `SKIPPED: ${result.reason}` : 'SENT'
  });
  console.log(`[whatsapp-report] ${result.skipped ? result.reason : 'sent'}`);
}

if (require.main === module) {
  main().catch((error) => {
    logAgentAction({
      agentName: 'CTO',
      actionTaken: 'attempted daily WhatsApp school-mode report',
      reason: 'Daily 7am report always.',
      riskLevel: 'MEDIUM',
      outcome: `FAILED: ${error.message}`
    });
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildMessage,
  sendTwilioMessage
};
