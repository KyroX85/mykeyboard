const { loadEngineeringState } = require('../whatsapp/state-reader');
const { groupChatDailyUpdate, immediateAlerts } = require('../whatsapp/school-mode-policy');
const { logAgentAction } = require('../whatsapp/agent-action-log');
const { sendWhatsAppMessageWithFallback } = require('../whatsapp/whatsapp-provider');
const { buildVisionStewardMessage } = require('../whatsapp/vision-steward');

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const from = process.env.TWILIO_WHATSAPP_FROM || '';
const to = process.env.FOUNDER_WHATSAPP_NUMBER || process.env.META_WHATSAPP_TO || '';

function buildMessage(state) {
  if (process.env.CTO_WHATSAPP_BODY) {
    return String(process.env.CTO_WHATSAPP_BODY).slice(0, 1500);
  }
  const alerts = immediateAlerts(state);
  return [
    groupChatDailyUpdate(state),
    '',
    alerts.length
      ? `Immediate alerts: ${alerts.map((alert) => alert.risk).join(' | ')}`
      : 'Immediate alerts: none.',
    '',
    buildVisionStewardMessage({ engineeringState: state })
  ].join('\n').slice(0, 1500);
}

async function sendDailyWhatsAppMessage(body) {
  if (!to) {
    return { skipped: true, reason: 'FOUNDER_WHATSAPP_NUMBER is not configured.' };
  }
  return sendWhatsAppMessageWithFallback({
    body,
    twilio: {
      accountSid,
      authToken,
      from,
      to
    },
    meta: {
      accessToken: process.env.META_WHATSAPP_ACCESS_TOKEN || '',
      phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID || '',
      graphVersion: process.env.META_WHATSAPP_GRAPH_VERSION || 'v25.0',
      to
    }
  });
}

async function main() {
  const state = loadEngineeringState();
  const body = buildMessage(state);
  const result = await sendDailyWhatsAppMessage(body);
  logAgentAction({
    agentName: 'CTO',
    actionTaken: 'sent daily WhatsApp school-mode report',
    reason: 'Daily 7am report always, even if nothing changed.',
    riskLevel: 'LOW',
    outcome: result.skipped ? `SKIPPED: ${result.reason}` : `SENT via ${result.provider}${result.fallbackUsed ? ' fallback' : ''}`
  });
  console.log(`[whatsapp-report] ${result.skipped ? result.reason : `sent via ${result.provider}`}`);
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
  sendDailyWhatsAppMessage
};
