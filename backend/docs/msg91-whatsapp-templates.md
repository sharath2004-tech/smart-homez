# MSG91 WhatsApp Template Definitions

## Multi-Language Strategy

> **You only create 17 templates total.** Each template is created **once** in MSG91, then you click **"Select Language"** inside that same template to add Telugu (`te`) and Hindi (`hi`) body variants. When sending via the API, pass the user's preferred `language` code and MSG91 automatically delivers the correct variant.

### How to add a language in MSG91

1. Open **MSG91 Dashboard → WhatsApp → Templates**.
2. Open an existing template (or create it with English first).
3. Click the **"Select Language"** dropdown.
4. Choose `te` (Telugu) or `hi` (Hindi).
5. Paste the translated body for that language and save.
6. Repeat for every language you need.

---

### API Usage

```json
{
  "template_id": "otp_verification",
  "language": "te",
  "variables": { "1": "483921", "2": "10" }
}
```

Change `"language"` to `"en"`, `"te"`, or `"hi"` per user preference. The template name stays the same.

---

## Template Creation Settings

| Field    | Value             |
|----------|-------------------|
| Category | **Transactional** |
| Language | **English (en)** — then add `te` / `hi` variants via "Select Language" |
| Variables | `{{1}}`, `{{2}}`, … in the exact order listed |

---

## 1. `otp_verification`

### English (`en`)
```
Your OTP for verification is *{{1}}*. It is valid for {{2}} minutes. Do not share it with anyone.
```

### Telugu (`te`)
```
మీ వెరిఫికేషన్ కోసం OTP *{{1}}*. ఇది {{2}} నిమిషాలు చెల్లుతుంది. దీన్ని ఎవరితోనూ పంచుకోకండి.
```

### Hindi (`hi`)
```
आपका OTP *{{1}}* है। यह {{2}} मिनट के लिए वैध है। इसे किसी के साथ साझा न करें।
```

| Position | Variable        | Example   |
|----------|-----------------|-----------|
| `{{1}}`  | OTP code        | `483921`  |
| `{{2}}`  | Expiry minutes  | `10`      |

---

## 2. `booking_confirmed`

### English (`en`)
```
Great news! Your booking for *{{1}}* on {{2}} at {{3}} has been confirmed. Booking ID: {{4}}. We look forward to serving you!
```

### Telugu (`te`)
```
శుభవార్త! {{2}} న {{3}} గంటలకు *{{1}}* కోసం మీ బుకింగ్ నిర్ధారించబడింది. బుకింగ్ ID: {{4}}. మీకు సేవ చేయడానికి మేము ఎదురు చూస్తున్నాము!
```

### Hindi (`hi`)
```
शानदार खबर! {{2}} को {{3}} बजे *{{1}}* के लिए आपकी बुकिंग की पुष्टि हो गई है। बुकिंग ID: {{4}}। हम आपकी सेवा करने के लिए उत्सुक हैं!
```

| Position | Variable      | Example              |
|----------|---------------|----------------------|
| `{{1}}`  | serviceName   | `Deep Cleaning`      |
| `{{2}}`  | date          | `29 Mar 2026`        |
| `{{3}}`  | time          | `10:00 AM`           |
| `{{4}}`  | bookingId     | `BK-00123`           |

---

## 3. `booking_cancelled`

### English (`en`)
```
Your booking for *{{1}}* has been cancelled. Reason: {{2}}. Refund amount: {{3}}. If you have questions, please contact support.
```

### Telugu (`te`)
```
మీ *{{1}}* బుకింగ్ రద్దు చేయబడింది. కారణం: {{2}}. రీఫండ్ మొత్తం: {{3}}. మీకు ప్రశ్నలు ఉంటే, దయచేసి సపోర్ట్‌ని సంప్రదించండి.
```

### Hindi (`hi`)
```
आपकी *{{1}}* बुकिंग रद्द कर दी गई है। कारण: {{2}}। रिफंड राशि: {{3}}। यदि आपके कोई प्रश्न हैं, कृपया सपोर्ट से संपर्क करें।
```

| Position | Variable      | Example              |
|----------|---------------|----------------------|
| `{{1}}`  | serviceName   | `Deep Cleaning`      |
| `{{2}}`  | reason        | `Cancelled by request` |
| `{{3}}`  | refundAmount  | `₹499` or `N/A`     |

---

## 4. `booking_rescheduled`

### English (`en`)
```
Your *{{1}}* booking has been rescheduled to {{2}} at {{3}}. If this doesn't suit you, please contact us.
```

### Telugu (`te`)
```
మీ *{{1}}* బుకింగ్ {{2}} న {{3}} గంటలకు రీషెడ్యూల్ చేయబడింది. ఇది మీకు అనుకూలంగా లేకుంటే, దయచేసి మాతో సంప్రదించండి.
```

### Hindi (`hi`)
```
आपकी *{{1}}* बुकिंग {{2}} को {{3}} बजे पुनर्निर्धारित की गई है। यदि यह आपके लिए उपयुक्त नहीं है, तो कृपया हमसे संपर्क करें।
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | serviceName | `Deep Cleaning` |
| `{{2}}`  | newDate     | `30 Mar 2026`   |
| `{{3}}`  | newTime     | `11:00 AM`      |

---

## 5. `worker_assigned`

### English (`en`)
```
*{{1}}* has been assigned to your *{{2}}* booking on {{3}} at {{4}}. They will arrive on time. Thank you for choosing us!
```

### Telugu (`te`)
```
{{3}} న {{4}} గంటలకు మీ *{{2}}* బుకింగ్‌కు *{{1}}* నియమించబడ్డారు. వారు సమయానికి వస్తారు. మా సేవలు ఎంచుకున్నందుకు ధన్యవాదాలు!
```

### Hindi (`hi`)
```
*{{1}}* को {{3}} को {{4}} बजे आपकी *{{2}}* बुकिंग के लिए नियुक्त किया गया है। वे समय पर पहुंचेंगे। हमें चुनने के लिए धन्यवाद!
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | workerName  | `Ravi Kumar`    |
| `{{2}}`  | serviceName | `Deep Cleaning` |
| `{{3}}`  | date        | `29 Mar 2026`   |
| `{{4}}`  | time        | `10:00 AM`      |

---

## 6. `worker_reassignment`

### English (`en`)
```
Your service provider has been updated. *{{1}}* has been replaced by *{{2}}*. Reason: {{3}}. Sorry for any inconvenience.
```

### Telugu (`te`)
```
మీ సేవా ప్రొవైడర్ మారింది. *{{1}}* స్థానంలో *{{2}}* వస్తారు. కారణం: {{3}}. ఏదైనా అసౌకర్యానికి క్షమించండి.
```

### Hindi (`hi`)
```
आपका सेवा प्रदाता बदल दिया गया है। *{{1}}* की जगह *{{2}}* आएंगे। कारण: {{3}}। किसी भी असुविधा के लिए खेद है।
```

| Position | Variable       | Example              |
|----------|----------------|----------------------|
| `{{1}}`  | oldWorkerName  | `Ravi Kumar`         |
| `{{2}}`  | newWorkerName  | `Suresh Patel`       |
| `{{3}}`  | reason         | `Schedule conflict`  |

---

## 7. `worker_enroute`

### English (`en`)
```
*{{1}}* is on the way to your location and will arrive in {{2}}. Please be available to receive them.
```

### Telugu (`te`)
```
*{{1}}* మీ స్థానానికి బయలుదేరారు మరియు {{2}} లో వస్తారు. వారిని స్వీకరించడానికి అందుబాటులో ఉండండి.
```

### Hindi (`hi`)
```
*{{1}}* आपके स्थान पर आ रहे हैं और {{2}} में पहुंचेंगे। कृपया उन्हें प्राप्त करने के लिए उपलब्ध रहें।
```

| Position | Variable   | Example      |
|----------|------------|--------------|
| `{{1}}`  | workerName | `Ravi Kumar` |
| `{{2}}`  | eta        | `15 minutes` |

---

## 8. `schedule_change`

### English (`en`)
```
The schedule for your *{{1}}* service has been updated to {{2}} at {{3}}. Please contact us if you have any concerns.
```

### Telugu (`te`)
```
మీ *{{1}}* సేవ షెడ్యూల్ {{2}} న {{3}} గంటలకు అప్‌డేట్ చేయబడింది. మీకు ఏమైనా సందేహాలు ఉంటే మాతో సంప్రదించండి.
```

### Hindi (`hi`)
```
आपकी *{{1}}* सेवा की अनुसूची {{2}} को {{3}} बजे अपडेट की गई है। यदि आपकी कोई चिंता है तो कृपया हमसे संपर्क करें।
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | serviceName | `Deep Cleaning` |
| `{{2}}`  | newDate     | `30 Mar 2026`   |
| `{{3}}`  | newTime     | `09:00 AM`      |

---

## 9. `delay_notification`

### English (`en`)
```
We're sorry! Your service provider will be delayed by {{1}} minutes. Reason: {{2}}. We apologise for the inconvenience.
```

### Telugu (`te`)
```
క్షమించండి! మీ సేవా ప్రొవైడర్ {{1}} నిమిషాలు ఆలస్యంగా వస్తారు. కారణం: {{2}}. అసౌకర్యానికి క్షమాపణలు.
```

### Hindi (`hi`)
```
हमें खेद है! आपका सेवा प्रदाता {{1}} मिनट देरी से पहुंचेगा। कारण: {{2}}। असुविधा के लिए क्षमा करें।
```

| Position | Variable      | Example         |
|----------|---------------|-----------------|
| `{{1}}`  | delayMinutes  | `20`            |
| `{{2}}`  | reason        | `Heavy traffic` |

---

## 10. `refund_processed`

### English (`en`)
```
Your refund of *{{1}}* for booking ID {{2}} has been processed and will reflect in your account within 5–7 business days.
```

### Telugu (`te`)
```
బుకింగ్ ID {{2}} కోసం *{{1}}* రీఫండ్ ప్రాసెస్ చేయబడింది మరియు 5–7 వ్యాపార దినాల్లో మీ ఖాతాలో కనిపిస్తుంది.
```

### Hindi (`hi`)
```
बुकिंग ID {{2}} के लिए *{{1}}* का रिफंड प्रोसेस हो गया है और 5–7 कार्य दिवसों में आपके खाते में दिखेगा।
```

| Position | Variable   | Example    |
|----------|------------|------------|
| `{{1}}`  | amount     | `₹499`     |
| `{{2}}`  | bookingId  | `BK-00123` |

---

## 11. `payment_received`

### English (`en`)
```
We have received your payment of *{{1}}* for *{{2}}*. Thank you! Your booking is now active.
```

### Telugu (`te`)
```
*{{2}}* కోసం మీ *{{1}}* చెల్లింపు అందింది. ధన్యవాదాలు! మీ బుకింగ్ ఇప్పుడు యాక్టివ్‌గా ఉంది.
```

### Hindi (`hi`)
```
*{{2}}* के लिए *{{1}}* का भुगतान प्राप्त हो गया। धन्यवाद! आपकी बुकिंग अब सक्रिय है।
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | amount      | `₹999`          |
| `{{2}}`  | serviceName | `Deep Cleaning` |

---

## 12. `subscription_activated`

### English (`en`)
```
Your *{{1}}* subscription has been activated! Start date: {{2}}. End date: {{3}}. Enjoy hassle-free home services!
```

### Telugu (`te`)
```
మీ *{{1}}* సబ్‌స్క్రిప్షన్ యాక్టివేట్ చేయబడింది! ప్రారంభ తేదీ: {{2}}. ముగింపు తేదీ: {{3}}. హాసిల్ ఫ్రీ హోమ్ సేవలు ఆనందించండి!
```

### Hindi (`hi`)
```
आपकी *{{1}}* सदस्यता सक्रिय हो गई है! प्रारंभ तिथि: {{2}}। समाप्ति तिथि: {{3}}। परेशानी मुक्त गृह सेवाओं का आनंद लें!
```

| Position | Variable  | Example          |
|----------|-----------|------------------|
| `{{1}}`  | planName  | `Monthly Plan`   |
| `{{2}}`  | startDate | `01 Apr 2026`    |
| `{{3}}`  | endDate   | `30 Apr 2026`    |

---

## 13. `subscription_renewal`

### English (`en`)
```
Your *{{1}}* subscription will renew on {{2}}. Renewal amount: {{3}}. Ensure sufficient balance to avoid service interruption.
```

### Telugu (`te`)
```
మీ *{{1}}* సబ్‌స్క్రిప్షన్ {{2}} న రెన్యూవల్ అవుతుంది. రెన్యూవల్ మొత్తం: {{3}}. సేవా అంతరాయాన్ని నివారించడానికి తగినంత బ్యాలెన్స్ ఉంచుకోండి.
```

### Hindi (`hi`)
```
आपकी *{{1}}* सदस्यता {{2}} को नवीनीकृत होगी। नवीनीकरण राशि: {{3}}। सेवा में रुकावट से बचने के लिए पर्याप्त बैलेंस सुनिश्चित करें।
```

| Position | Variable     | Example        |
|----------|--------------|----------------|
| `{{1}}`  | planName     | `Monthly Plan` |
| `{{2}}`  | renewalDate  | `01 May 2026`  |
| `{{3}}`  | amount       | `₹999`         |

---

## 14. `subscription_paused`

### English (`en`)
```
Your *{{1}}* subscription has been paused from {{2}} to {{3}}. It will automatically resume after the pause period ends.
```

### Telugu (`te`)
```
మీ *{{1}}* సబ్‌స్క్రిప్షన్ {{2}} నుండి {{3}} వరకు పాజ్ చేయబడింది. పాజ్ పీరియడ్ తర్వాత ఇది స్వయంచాలకంగా రీసమ్ అవుతుంది.
```

### Hindi (`hi`)
```
आपकी *{{1}}* सदस्यता {{2}} से {{3}} तक रोकी गई है। पॉज़ अवधि समाप्त होने के बाद यह स्वचालित रूप से फिर से शुरू हो जाएगी।
```

| Position | Variable   | Example        |
|----------|------------|----------------|
| `{{1}}`  | planName   | `Monthly Plan` |
| `{{2}}`  | pauseStart | `01 Apr 2026`  |
| `{{3}}`  | pauseEnd   | `10 Apr 2026`  |

---

## 15. `sos_alert`

> ⚠️ Submit this template under **Utility** or **Alert** category.

### English (`en`)
```
🚨 SOS Alert! Customer *{{1}}* at {{2}} has triggered an emergency. Please respond immediately.
```

### Telugu (`te`)
```
🚨 SOS హెచ్చరిక! {{2}} లో కస్టమర్ *{{1}}* అత్యవసర పరిస్థితిని ట్రిగ్గర్ చేశారు. దయచేసి వెంటనే స్పందించండి.
```

### Hindi (`hi`)
```
🚨 SOS अलर्ट! {{2}} पर ग्राहक *{{1}}* ने आपातकालीन स्थिति ट्रिगर की है। कृपया तुरंत प्रतिक्रिया दें।
```

| Position | Variable      | Example             |
|----------|---------------|---------------------|
| `{{1}}`  | customerName  | `Priya Nair`        |
| `{{2}}`  | location      | `123 MG Road, HSR`  |

---

## 16. `welcome_message`

### English (`en`)
```
Welcome to SmartHomez, *{{1}}*! 🏠 We're delighted to have you. Book your first home service today and experience the difference.
```

### Telugu (`te`)
```
SmartHomez కు స్వాగతం, *{{1}}*! 🏠 మీరు వచ్చినందుకు మేము సంతోషంగా ఉన్నాము. నేడు మీ మొదటి హోమ్ సేవను బుక్ చేసుకోండి మరియు తేడాను అనుభవించండి.
```

### Hindi (`hi`)
```
SmartHomez में आपका स्वागत है, *{{1}}*! 🏠 आपको पाकर हम बहुत प्रसन्न हैं। आज अपनी पहली गृह सेवा बुक करें और अंतर का अनुभव करें।
```

| Position | Variable | Example  |
|----------|----------|----------|
| `{{1}}`  | name     | `Priya`  |

---

## 17. `generic_notification`

### English (`en`)
```
*{{1}}*

{{2}}

For assistance, contact our support team.
```

### Telugu (`te`)
```
*{{1}}*

{{2}}

సహాయం కోసం, మా సపోర్ట్ టీమ్‌ని సంప్రదించండి.
```

### Hindi (`hi`)
```
*{{1}}*

{{2}}

सहायता के लिए, हमारी सपोर्ट टीम से संपर्क करें।
```

| Position | Variable | Example                |
|----------|----------|------------------------|
| `{{1}}`  | title    | `Service Update`       |
| `{{2}}`  | message  | `Your service is ready.` |

---

## Environment Variables

After all 17 templates are approved in MSG91 (with `en`, `te`, and `hi` variants each), add these to your `.env`:

```env
MSG91_AUTH_KEY=your_auth_key_here
MSG91_WHATSAPP_INTEGRATED_NUMBER=91XXXXXXXXXX

# Template names — same name used for all languages; pass language code in the API call
MSG91_WA_TPL_OTP=otp_verification
MSG91_WA_TPL_BOOKING_CONFIRMED=booking_confirmed
MSG91_WA_TPL_BOOKING_CANCELLED=booking_cancelled
MSG91_WA_TPL_BOOKING_RESCHEDULED=booking_rescheduled
MSG91_WA_TPL_WORKER_ASSIGNED=worker_assigned
MSG91_WA_TPL_WORKER_REASSIGNMENT=worker_reassignment
MSG91_WA_TPL_WORKER_ENROUTE=worker_enroute
MSG91_WA_TPL_SCHEDULE_CHANGE=schedule_change
MSG91_WA_TPL_DELAY=delay_notification
MSG91_WA_TPL_REFUND=refund_processed
MSG91_WA_TPL_PAYMENT=payment_received
MSG91_WA_TPL_SUB_ACTIVATED=subscription_activated
MSG91_WA_TPL_SUB_RENEWAL=subscription_renewal
MSG91_WA_TPL_SUB_PAUSED=subscription_paused
MSG91_WA_TPL_SOS=sos_alert
MSG91_WA_TPL_WELCOME=welcome_message
MSG91_WA_TPL_GENERIC=generic_notification
```

> No language-specific env vars needed. Store the user’s preferred language (`en`, `te`, or `hi`) on their profile and pass it as the `language` field in every MSG91 API call.

---

---

# Telugu (te) — Language Variant Texts

> Enter these texts in MSG91 by opening each template and clicking **"Select Language" → Telugu (te)**. Do **not** create separate templates with `_te` suffixes.

---

## 1. `otp_verification_te`

**Body:**
```
మీ వెరిఫికేషన్ కోసం OTP *{{1}}*. ఇది {{2}} నిమిషాలు చెల్లుతుంది. దీన్ని ఎవరితోనూ పంచుకోకండి.
```

| Position | Variable        | Example   |
|----------|-----------------|-----------|
| `{{1}}`  | OTP code        | `483921`  |
| `{{2}}`  | Expiry minutes  | `10`      |

---

## 2. `booking_confirmed_te`

**Body:**
```
శుభవార్త! {{2}} న {{3}} గంటలకు *{{1}}* కోసం మీ బుకింగ్ నిర్ధారించబడింది. బుకింగ్ ID: {{4}}. మీకు సేవ చేయడానికి మేము ఎదురు చూస్తున్నాము!
```

| Position | Variable      | Example              |
|----------|---------------|----------------------|
| `{{1}}`  | serviceName   | `Deep Cleaning`      |
| `{{2}}`  | date          | `29 Mar 2026`        |
| `{{3}}`  | time          | `10:00 AM`           |
| `{{4}}`  | bookingId     | `BK-00123`           |

---

## 3. `booking_cancelled_te`

**Body:**
```
మీ *{{1}}* బుకింగ్ రద్దు చేయబడింది. కారణం: {{2}}. రీఫండ్ మొత్తం: {{3}}. మీకు ప్రశ్నలు ఉంటే, దయచేసి సపోర్ట్‌ని సంప్రదించండి.
```

| Position | Variable      | Example              |
|----------|---------------|----------------------|
| `{{1}}`  | serviceName   | `Deep Cleaning`      |
| `{{2}}`  | reason        | `Cancelled by request` |
| `{{3}}`  | refundAmount  | `₹499` or `N/A`     |

---

## 4. `booking_rescheduled_te`

**Body:**
```
మీ *{{1}}* బుకింగ్ {{2}} న {{3}} గంటలకు రీషెడ్యూల్ చేయబడింది. ఇది మీకు అనుకూలంగా లేకుంటే, దయచేసి మాతో సంప్రదించండి.
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | serviceName | `Deep Cleaning` |
| `{{2}}`  | newDate     | `30 Mar 2026`   |
| `{{3}}`  | newTime     | `11:00 AM`      |

---

## 5. `worker_assigned_te`

**Body:**
```
{{3}} న {{4}} గంటలకు మీ *{{2}}* బుకింగ్‌కు *{{1}}* నియమించబడ్డారు. వారు సమయానికి వస్తారు. మా సేవలు ఎంచుకున్నందుకు ధన్యవాదాలు!
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | workerName  | `Ravi Kumar`    |
| `{{2}}`  | serviceName | `Deep Cleaning` |
| `{{3}}`  | date        | `29 Mar 2026`   |
| `{{4}}`  | time        | `10:00 AM`      |

---

## 6. `worker_reassignment_te`

**Body:**
```
మీ సేవా ప్రొవైడర్ మారింది. *{{1}}* స్థానంలో *{{2}}* వస్తారు. కారణం: {{3}}. ఏదైనా అసౌకర్యానికి క్షమించండి.
```

| Position | Variable       | Example              |
|----------|----------------|----------------------|
| `{{1}}`  | oldWorkerName  | `Ravi Kumar`         |
| `{{2}}`  | newWorkerName  | `Suresh Patel`       |
| `{{3}}`  | reason         | `Schedule conflict`  |

---

## 7. `worker_enroute_te`

**Body:**
```
*{{1}}* మీ స్థానానికి బయలుదేరారు మరియు {{2}} లో వస్తారు. వారిని స్వీకరించడానికి అందుబాటులో ఉండండి.
```

| Position | Variable   | Example      |
|----------|------------|--------------|
| `{{1}}`  | workerName | `Ravi Kumar` |
| `{{2}}`  | eta        | `15 minutes` |

---

## 8. `schedule_change_te`

**Body:**
```
మీ *{{1}}* సేవ షెడ్యూల్ {{2}} న {{3}} గంటలకు అప్‌డేట్ చేయబడింది. మీకు ఏమైనా సందేహాలు ఉంటే మాతో సంప్రదించండి.
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | serviceName | `Deep Cleaning` |
| `{{2}}`  | newDate     | `30 Mar 2026`   |
| `{{3}}`  | newTime     | `09:00 AM`      |

---

## 9. `delay_notification_te`

**Body:**
```
క్షమించండి! మీ సేవా ప్రొవైడర్ {{1}} నిమిషాలు ఆలస్యంగా వస్తారు. కారణం: {{2}}. అసౌకర్యానికి క్షమాపణలు.
```

| Position | Variable      | Example         |
|----------|---------------|-----------------|
| `{{1}}`  | delayMinutes  | `20`            |
| `{{2}}`  | reason        | `Heavy traffic` |

---

## 10. `refund_processed_te`

**Body:**
```
బుకింగ్ ID {{2}} కోసం *{{1}}* రీఫండ్ ప్రాసెస్ చేయబడింది మరియు 5–7 వ్యాపార దినాల్లో మీ ఖాతాలో కనిపిస్తుంది.
```

| Position | Variable   | Example    |
|----------|------------|------------|
| `{{1}}`  | amount     | `₹499`     |
| `{{2}}`  | bookingId  | `BK-00123` |

---

## 11. `payment_received_te`

**Body:**
```
*{{2}}* కోసం మీ *{{1}}* చెల్లింపు అందింది. ధన్యవాదాలు! మీ బుకింగ్ ఇప్పుడు యాక్టివ్‌గా ఉంది.
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | amount      | `₹999`          |
| `{{2}}`  | serviceName | `Deep Cleaning` |

---

## 12. `subscription_activated_te`

**Body:**
```
మీ *{{1}}* సబ్‌స్క్రిప్షన్ యాక్టివేట్ చేయబడింది! ప్రారంభ తేదీ: {{2}}. ముగింపు తేదీ: {{3}}. హాసిల్ ఫ్రీ హోమ్ సేవలు ఆనందించండి!
```

| Position | Variable  | Example          |
|----------|-----------|------------------|
| `{{1}}`  | planName  | `Monthly Plan`   |
| `{{2}}`  | startDate | `01 Apr 2026`    |
| `{{3}}`  | endDate   | `30 Apr 2026`    |

---

## 13. `subscription_renewal_te`

**Body:**
```
మీ *{{1}}* సబ్‌స్క్రిప్షన్ {{2}} న రెన్యూవల్ అవుతుంది. రెన్యూవల్ మొత్తం: {{3}}. సేవా అంతరాయాన్ని నివారించడానికి తగినంత బ్యాలెన్స్ ఉంచుకోండి.
```

| Position | Variable     | Example        |
|----------|--------------|----------------|
| `{{1}}`  | planName     | `Monthly Plan` |
| `{{2}}`  | renewalDate  | `01 May 2026`  |
| `{{3}}`  | amount       | `₹999`         |

---

## 14. `subscription_paused_te`

**Body:**
```
మీ *{{1}}* సబ్‌స్క్రిప్షన్ {{2}} నుండి {{3}} వరకు పాజ్ చేయబడింది. పాజ్ పీరియడ్ తర్వాత ఇది స్వయంచాలకంగా రీసమ్ అవుతుంది.
```

| Position | Variable   | Example        |
|----------|------------|----------------|
| `{{1}}`  | planName   | `Monthly Plan` |
| `{{2}}`  | pauseStart | `01 Apr 2026`  |
| `{{3}}`  | pauseEnd   | `10 Apr 2026`  |

---

## 15. `sos_alert_te`

**Body:**
```
🚨 SOS హెచ్చరిక! {{2}} లో కస్టమర్ *{{1}}* అత్యవసర పరిస్థితిని ట్రిగ్గర్ చేశారు. దయచేసి వెంటనే స్పందించండి.
```

> ⚠️ Submit this as a **Utility** or **Alert** category template.

| Position | Variable      | Example             |
|----------|---------------|---------------------|
| `{{1}}`  | customerName  | `Priya Nair`        |
| `{{2}}`  | location      | `123 MG Road, HSR`  |

---

## 16. `welcome_message_te`

**Body:**
```
SmartHomez కు స్వాగతం, *{{1}}*! 🏠 మీరు వచ్చినందుకు మేము సంతోషంగా ఉన్నాము. నేడు మీ మొదటి హోమ్ సేవను బుక్ చేసుకోండి మరియు తేడాను అనుభవించండి.
```

| Position | Variable | Example  |
|----------|----------|----------|
| `{{1}}`  | name     | `Priya`  |

---

## 17. `generic_notification_te`

**Body:**
```
*{{1}}*

{{2}}

సహాయం కోసం, మా సపోర్ట్ టీమ్‌ని సంప్రదించండి.
```

| Position | Variable | Example                |
|----------|----------|------------------------|
| `{{1}}`  | title    | `Service Update`       |
| `{{2}}`  | message  | `Your service is ready.` |

---

---

# Hindi (hi) — Language Variant Texts

> Enter these texts in MSG91 by opening each template and clicking **"Select Language" → Hindi (hi)**. Do **not** create separate templates with `_hi` suffixes.

---

## 1. `otp_verification_hi`

**Body:**
```
आपका OTP *{{1}}* है। यह {{2}} मिनट के लिए वैध है। इसे किसी के साथ साझा न करें।
```

| Position | Variable        | Example   |
|----------|-----------------|-----------|
| `{{1}}`  | OTP code        | `483921`  |
| `{{2}}`  | Expiry minutes  | `10`      |

---

## 2. `booking_confirmed_hi`

**Body:**
```
शानदार खबर! {{2}} को {{3}} बजे *{{1}}* के लिए आपकी बुकिंग की पुष्टि हो गई है। बुकिंग ID: {{4}}। हम आपकी सेवा करने के लिए उत्सुक हैं!
```

| Position | Variable      | Example              |
|----------|---------------|----------------------|
| `{{1}}`  | serviceName   | `Deep Cleaning`      |
| `{{2}}`  | date          | `29 Mar 2026`        |
| `{{3}}`  | time          | `10:00 AM`           |
| `{{4}}`  | bookingId     | `BK-00123`           |

---

## 3. `booking_cancelled_hi`

**Body:**
```
आपकी *{{1}}* बुकिंग रद्द कर दी गई है। कारण: {{2}}। रिफंड राशि: {{3}}। यदि आपके कोई प्रश्न हैं, कृपया सपोर्ट से संपर्क करें।
```

| Position | Variable      | Example              |
|----------|---------------|----------------------|
| `{{1}}`  | serviceName   | `Deep Cleaning`      |
| `{{2}}`  | reason        | `Cancelled by request` |
| `{{3}}`  | refundAmount  | `₹499` or `N/A`     |

---

## 4. `booking_rescheduled_hi`

**Body:**
```
आपकी *{{1}}* बुकिंग {{2}} को {{3}} बजे पुनर्निर्धारित की गई है। यदि यह आपके लिए उपयुक्त नहीं है, तो कृपया हमसे संपर्क करें।
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | serviceName | `Deep Cleaning` |
| `{{2}}`  | newDate     | `30 Mar 2026`   |
| `{{3}}`  | newTime     | `11:00 AM`      |

---

## 5. `worker_assigned_hi`

**Body:**
```
*{{1}}* को {{3}} को {{4}} बजे आपकी *{{2}}* बुकिंग के लिए नियुक्त किया गया है। वे समय पर पहुंचेंगे। हमें चुनने के लिए धन्यवाद!
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | workerName  | `Ravi Kumar`    |
| `{{2}}`  | serviceName | `Deep Cleaning` |
| `{{3}}`  | date        | `29 Mar 2026`   |
| `{{4}}`  | time        | `10:00 AM`      |

---

## 6. `worker_reassignment_hi`

**Body:**
```
आपका सेवा प्रदाता बदल दिया गया है। *{{1}}* की जगह *{{2}}* आएंगे। कारण: {{3}}। किसी भी असुविधा के लिए खेद है।
```

| Position | Variable       | Example              |
|----------|----------------|----------------------|
| `{{1}}`  | oldWorkerName  | `Ravi Kumar`         |
| `{{2}}`  | newWorkerName  | `Suresh Patel`       |
| `{{3}}`  | reason         | `Schedule conflict`  |

---

## 7. `worker_enroute_hi`

**Body:**
```
*{{1}}* आपके स्थान पर आ रहे हैं और {{2}} में पहुंचेंगे। कृपया उन्हें प्राप्त करने के लिए उपलब्ध रहें।
```

| Position | Variable   | Example      |
|----------|------------|--------------|
| `{{1}}`  | workerName | `Ravi Kumar` |
| `{{2}}`  | eta        | `15 minutes` |

---

## 8. `schedule_change_hi`

**Body:**
```
आपकी *{{1}}* सेवा की अनुसूची {{2}} को {{3}} बजे अपडेट की गई है। यदि आपकी कोई चिंता है तो कृपया हमसे संपर्क करें।
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | serviceName | `Deep Cleaning` |
| `{{2}}`  | newDate     | `30 Mar 2026`   |
| `{{3}}`  | newTime     | `09:00 AM`      |

---

## 9. `delay_notification_hi`

**Body:**
```
हमें खेद है! आपका सेवा प्रदाता {{1}} मिनट देरी से पहुंचेगा। कारण: {{2}}। असुविधा के लिए क्षमा करें।
```

| Position | Variable      | Example         |
|----------|---------------|-----------------|
| `{{1}}`  | delayMinutes  | `20`            |
| `{{2}}`  | reason        | `Heavy traffic` |

---

## 10. `refund_processed_hi`

**Body:**
```
बुकिंग ID {{2}} के लिए *{{1}}* का रिफंड प्रोसेस हो गया है और 5–7 कार्य दिवसों में आपके खाते में दिखेगा।
```

| Position | Variable   | Example    |
|----------|------------|------------|
| `{{1}}`  | amount     | `₹499`     |
| `{{2}}`  | bookingId  | `BK-00123` |

---

## 11. `payment_received_hi`

**Body:**
```
*{{2}}* के लिए *{{1}}* का भुगतान प्राप्त हो गया। धन्यवाद! आपकी बुकिंग अब सक्रिय है।
```

| Position | Variable    | Example         |
|----------|-------------|-----------------|
| `{{1}}`  | amount      | `₹999`          |
| `{{2}}`  | serviceName | `Deep Cleaning` |

---

## 12. `subscription_activated_hi`

**Body:**
```
आपकी *{{1}}* सदस्यता सक्रिय हो गई है! प्रारंभ तिथि: {{2}}। समाप्ति तिथि: {{3}}। परेशानी मुक्त गृह सेवाओं का आनंद लें!
```

| Position | Variable  | Example          |
|----------|-----------|------------------|
| `{{1}}`  | planName  | `Monthly Plan`   |
| `{{2}}`  | startDate | `01 Apr 2026`    |
| `{{3}}`  | endDate   | `30 Apr 2026`    |

---

## 13. `subscription_renewal_hi`

**Body:**
```
आपकी *{{1}}* सदस्यता {{2}} को नवीनीकृत होगी। नवीनीकरण राशि: {{3}}। सेवा में रुकावट से बचने के लिए पर्याप्त बैलेंस सुनिश्चित करें।
```

| Position | Variable     | Example        |
|----------|--------------|----------------|
| `{{1}}`  | planName     | `Monthly Plan` |
| `{{2}}`  | renewalDate  | `01 May 2026`  |
| `{{3}}`  | amount       | `₹999`         |

---

## 14. `subscription_paused_hi`

**Body:**
```
आपकी *{{1}}* सदस्यता {{2}} से {{3}} तक रोकी गई है। पॉज़ अवधि समाप्त होने के बाद यह स्वचालित रूप से फिर से शुरू हो जाएगी।
```

| Position | Variable   | Example        |
|----------|------------|----------------|
| `{{1}}`  | planName   | `Monthly Plan` |
| `{{2}}`  | pauseStart | `01 Apr 2026`  |
| `{{3}}`  | pauseEnd   | `10 Apr 2026`  |

---

## 15. `sos_alert_hi`

**Body:**
```
🚨 SOS अलर्ट! {{2}} पर ग्राहक *{{1}}* ने आपातकालीन स्थिति ट्रिगर की है। कृपया तुरंत प्रतिक्रिया दें।
```

> ⚠️ Submit this as a **Utility** or **Alert** category template.

| Position | Variable      | Example             |
|----------|---------------|---------------------|
| `{{1}}`  | customerName  | `Priya Nair`        |
| `{{2}}`  | location      | `123 MG Road, HSR`  |

---

## 16. `welcome_message_hi`

**Body:**
```
SmartHomez में आपका स्वागत है, *{{1}}*! 🏠 आपको पाकर हम बहुत प्रसन्न हैं। आज अपनी पहली गृह सेवा बुक करें और अंतर का अनुभव करें।
```

| Position | Variable | Example  |
|----------|----------|----------|
| `{{1}}`  | name     | `Priya`  |

---

## 17. `generic_notification_hi`

**Body:**
```
*{{1}}*

{{2}}

सहायता के लिए, हमारी सपोर्ट टीम से संपर्क करें।
```

| Position | Variable | Example                |
|----------|----------|------------------------|
| `{{1}}`  | title    | `Service Update`       |
| `{{2}}`  | message  | `Your service is ready.` |

---

> **No additional env vars needed for Telugu/Hindi.** Use the same 17 template names listed above — just pass `"language": "te"` or `"language": "hi"` in the MSG91 API call.
