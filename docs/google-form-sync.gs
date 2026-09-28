const HUITAO_ORDER_ENDPOINT = 'https://huitao.tw/api/import/google-form';
const TOKEN_PROPERTY = 'HUITAO_FORM_SYNC_TOKEN';

/**
 * Run once after pasting this script into the Apps Script project bound to the Google Form.
 * It installs an installable form-submit trigger for syncOrderToHuitao().
 */
function installHuitaoOrderSyncTrigger() {
  const form = FormApp.getActiveForm();
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'syncOrderToHuitao')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('syncOrderToHuitao')
    .forForm(form)
    .onFormSubmit()
    .create();
}

/**
 * Store the same secret as Netlify's HUITAO_FORM_SYNC_TOKEN.
 * Replace the placeholder locally before running once, then remove the plaintext value from the editor.
 */
function setHuitaoOrderSyncToken() {
  PropertiesService.getScriptProperties().setProperty(TOKEN_PROPERTY, 'REPLACE_WITH_RANDOM_SECRET');
}

function syncOrderToHuitao(event) {
  const token = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
  if (!token) throw new Error(`${TOKEN_PROPERTY} is not configured`);
  if (!event || !event.response) throw new Error('This function must run from a Google Form submit trigger');

  const response = event.response;
  const answers = {};
  response.getItemResponses().forEach((itemResponse) => {
    answers[itemResponse.getItem().getTitle().trim()] = itemResponse.getResponse();
  });

  const get = (...keywords) => {
    const entry = Object.entries(answers).find(([title]) => keywords.every((word) => title.includes(word)));
    if (!entry) return '';
    const value = entry[1];
    return Array.isArray(value) ? value.join(', ') : String(value || '').trim();
  };

  const planText = get('訂購') || get('方案');
  let plan;
  if (/2\s*ml|試用|樣本/i.test(planText)) plan = 'sample_2ml';
  else if (/2\s*瓶/.test(planText)) plan = 'two_bottles';
  else if (/1\s*瓶/.test(planText)) plan = 'one_bottle';
  else throw new Error(`Cannot map order plan: ${planText}`);

  const name = get('姓名') || get('名字');
  const email = get('Email') || get('電子郵件') || response.getRespondentEmail() || '';
  const phone = get('電話') || get('手機');
  const address = get('地址') || get('收件');

  const payload = {
    sourceSubmissionId: response.getId(),
    submittedAt: response.getTimestamp().toISOString(),
    plan,
    customer: {
      name,
      email,
      phone,
      lineId: get('LINE') || get('Line'),
    },
    shipping: { name, email, phone, address },
    paymentMethod: get('付款'),
    note: get('備註') || get('其他'),
  };

  const result = UrlFetchApp.fetch(HUITAO_ORDER_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-huitao-sync-token': token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const status = result.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(`Huitao sync failed (${status}): ${result.getContentText()}`);
  }

  console.log(result.getContentText());
}
