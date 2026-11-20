import { CountryPicker } from "./country-picker.js";
import { EmployeePicker } from "./assets/js/booking-menu.js";

const englishDigits = (value) => value.replace(/[٠-٩۰-۹]/g, (digit) =>
  String(digit.charCodeAt(0) - (digit.charCodeAt(0) <= 0x669 ? 0x660 : 0x6f0)));

/* Isolated from the exported Framer form so hydration cannot replace user input. */
class MasteryBookingForm extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="/booking-form.css">
      <form class="consultation-form" dir="rtl" lang="ar" aria-label="احجز جلسة التشخيص المجانية">
        <p class="required-note">الحقول المعلّمة بـ <span aria-hidden="true">*</span> مطلوبة.</p>
        <div class="form-field">
          <label for="booking-company">اسم الشركة <span aria-hidden="true">*</span></label>
          <input id="booking-company" name="company" placeholder="اسم المنشأة" autocomplete="organization" maxlength="200" required>
          <p class="field-error" id="error-company"></p>
        </div>
        <div class="form-field">
          <label for="booking-fullName">الاسم الكامل للمسؤول <span aria-hidden="true">*</span></label>
          <input id="booking-fullName" name="fullName" placeholder="الاسم الأول واسم العائلة"
            autocomplete="name" maxlength="181" required aria-describedby="name-help error-fullName">
          <p class="help" id="name-help">اكتب الاسم الأول واسم العائلة، مع مسافة بينهما.</p>
          <p class="field-error" id="error-fullName"></p>
        </div>
        <div class="form-field">
          <label for="booking-phone">رقم الهاتف <span aria-hidden="true">*</span></label>
          <input id="booking-phone" name="phone" class="numeric-input" type="tel" dir="ltr" lang="en" placeholder="+966501234567"
            autocomplete="tel" maxlength="30" pattern="\\+[1-9][0-9 ]{7,28}" required
            aria-describedby="phone-help error-phone">
          <p class="help" id="phone-help">يرجى إدخال رمز الدولة مع رقم الهاتف.</p>
          <p class="field-error" id="error-phone"></p>
        </div>
        <div class="form-field">
          <label for="booking-email">البريد الإلكتروني للعمل <span aria-hidden="true">*</span></label>
          <input id="booking-email" name="email" type="email" dir="ltr" placeholder="name@company.com"
            autocomplete="email" maxlength="254" required>
          <p class="field-error" id="error-email"></p>
        </div>
        <div class="form-field">
          <label id="booking-employees-label" for="booking-employees-trigger">عدد الموظفين <span aria-hidden="true">*</span></label>
          <button type="button" id="booking-employees-trigger" class="employee-trigger numeric-input" role="combobox"
            aria-haspopup="listbox" aria-expanded="false" aria-required="true"
            aria-controls="booking-employees-list" aria-labelledby="booking-employees-label booking-employees-trigger"
            aria-describedby="error-employees" disabled>جارٍ تحميل الخيارات…</button>
          <select id="booking-employees" name="employees" class="sr-only" lang="en" tabindex="-1" aria-hidden="true" required disabled>
            <option value="">جارٍ تحميل الخيارات…</option>
          </select>
          <div id="booking-employees-list" class="employee-menu" role="listbox" aria-label="عدد الموظفين" hidden></div>
          <p class="field-error" id="error-employees"></p>
        </div>
        <div class="form-field">
          <label for="booking-salespeople">عدد موظفي المبيعات في الشركة <span aria-hidden="true">*</span></label>
          <input id="booking-salespeople" name="salespeople" class="numeric-input" type="text" dir="ltr" lang="en"
            pattern="[0-9]{1,7}" maxlength="7" inputmode="numeric" placeholder="0" required>
          <p class="field-error" id="error-salespeople"></p>
        </div>
        <div class="form-field">
          <label for="booking-country-search">الدولة <span aria-hidden="true">*</span></label>
          <div class="country-picker">
            <input id="booking-country-search" name="countrySearch" type="search" role="combobox"
              placeholder="ابحث عن الدولة" autocomplete="off" required disabled
              aria-autocomplete="list" aria-expanded="false" aria-controls="booking-country-list"
              aria-describedby="error-country">
            <input id="booking-country" name="country" type="hidden">
            <div id="booking-country-list" class="country-menu" role="listbox" aria-label="الدول" hidden></div>
          </div>
          <span id="country-search-status" class="sr-only" role="status" aria-live="polite"></span>
          <p class="field-error" id="error-country"></p>
        </div>
        <div class="form-field">
          <label for="booking-website">الموقع الإلكتروني <small>اختياري</small></label>
          <input id="booking-website" name="website" type="text" dir="ltr" inputmode="url"
            autocomplete="url" placeholder="https://company.com" maxlength="2048">
          <p class="field-error" id="error-website"></p>
        </div>
        <div class="honeypot" aria-hidden="true">
          <label>اترك هذا الحقل فارغاً<input name="fax" tabindex="-1" autocomplete="off"></label>
        </div>
        <p id="booking-options-status" class="status" role="status" aria-live="polite"></p>
        <button type="button" id="booking-retry" class="secondary" hidden>إعادة تحميل الخيارات</button>
        <button type="submit" id="booking-submit" disabled>احجز جلسة التشخيص المجانية</button>
        <p id="booking-status" class="status" role="status" aria-live="polite" tabindex="-1"></p>
        <p class="privacy">سنستخدم بياناتك للتواصل معك بخصوص استشارتك.</p>
      </form>`;
    this.form = root.querySelector("form");
    this.employeePicker = new EmployeePicker(root);
    this.submitButton = root.getElementById("booking-submit");
    this.status = root.getElementById("booking-status");
    this.key = crypto.randomUUID();
    this.busy = false;
    this.ready = false;
    this.form.addEventListener("submit", (event) => this.submit(event));
    root.getElementById("booking-retry").addEventListener("click", () => this.loadOptions());
    this.form.addEventListener("input", (event) => {
      const field = event.target;
      if (["phone", "salespeople"].includes(field.name)) field.value = englishDigits(field.value);
      if (field.name === "fullName" || field.name === "salespeople") this.validateFields();
      field.removeAttribute("aria-invalid");
      root.getElementById(`error-${field.name === "countrySearch" ? "country" : field.name}`)?.replaceChildren();
    });
    this.form.elements.employees.addEventListener("change", () => {
      this.validateFields();
    });
    for (const field of this.form.elements) {
      if (root.getElementById(`error-${field.name}`) && !["phone", "fullName", "country"].includes(field.name)) {
        field.setAttribute("aria-describedby", `error-${field.name}`);
      }
    }
    this.loadOptions();
  }

  validateFields() {
    const name = this.form.elements.fullName;
    const parts = name.value.trim().split(/\s+/u);
    const validName = parts.length >= 2 && parts.every((part) =>
      /\p{L}/u.test(part) && /^[\p{L}\p{M}'’.-]+$/u.test(part)) &&
      parts[0].length <= 80 && parts.slice(1).join(" ").length <= 100;
    name.setCustomValidity(validName ? "" : "اكتب الاسم الأول واسم العائلة مع مسافة بينهما.");
    const count = this.form.elements.salespeople;
    const maximum = this.employees?.find((item) =>
      item.value === this.form.elements.employees.value)?.maximum;
    count.setCustomValidity(maximum && Number(count.value) > maximum
      ? "عدد موظفي المبيعات لا يمكن أن يتجاوز إجمالي الموظفين." : "");
  }

  async loadOptions() {
    const root = this.shadowRoot;
    const status = root.getElementById("booking-options-status");
    const retry = root.getElementById("booking-retry");
    retry.hidden = true;
    this.ready = false;
    this.submitButton.disabled = true;
    status.textContent = "جارٍ تحميل خيارات النموذج…";
    try {
      const response = await fetch("/api/booking/options", { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error("options_unavailable");
      const data = await response.json();
      if (!data.countries?.length || !data.employees?.length) throw new Error("empty_options");
      this.employees = data.employees;
      const populate = (name, placeholder, values) => {
        const select = this.form.elements[name];
        select.replaceChildren(new Option(placeholder, ""));
        for (const item of values) select.add(new Option(item.label, item.value));
        select.disabled = false;
      };
      populate("employees", "اختر عدد الموظفين", data.employees);
      this.countryPicker = new CountryPicker(root, data.countries);
      status.textContent = "";
      this.ready = true;
      this.submitButton.disabled = false;
    } catch {
      status.textContent = "تعذّر تحميل الدول وخيارات الموظفين. يرجى إعادة المحاولة.";
      status.dataset.state = "error";
      retry.hidden = false;
    }
  }

  redirectToThankYou() {
    // Same-origin fixed destination: no personal data or CRM identifiers in URLs.
    window.location.assign("/thank-you");
  }

  async submit(event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.busy || !this.ready) return;
    this.form.elements.phone.value = englishDigits(this.form.elements.phone.value);
    this.form.elements.salespeople.value = englishDigits(this.form.elements.salespeople.value);
    this.validateFields();
    if (!this.form.reportValidity()) return;
    if (this.form.elements.fax.value) return;
    const payload = Object.fromEntries(new FormData(this.form));
    delete payload.fax;
    delete payload.countrySearch;
    payload.fullName = payload.fullName.trim().replace(/\s+/gu, " ");
    this.countryPicker.close();
    this.employeePicker.close();
    this.busy = true;
    const controls = [...this.form.querySelectorAll("input, select")];
    controls.forEach((field) => { field.disabled = true; });
    this.submitButton.disabled = true;
    this.submitButton.textContent = "جارٍ إرسال طلبك…";
    this.status.textContent = "";
    this.shadowRoot.querySelectorAll(".field-error").forEach((node) => node.replaceChildren());
    let completed = false;
    try {
      // The server tracks this key across retries and restarts to prevent duplicate records.
      const response = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": this.key },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data.ok !== true) {
        for (const [name, message] of Object.entries(data.fields || {})) {
          const error = this.shadowRoot.getElementById(`error-${name}`);
          if (error) error.textContent = message;
          (name === "country" ? this.countryPicker.input : this.form.elements[name])
            ?.setAttribute("aria-invalid", "true");
        }
        this.status.textContent = data.error || "تعذّر إرسال الطلب. يرجى المحاولة مجدداً.";
        this.status.dataset.state = "error";
        if (data.uncertain) {
          completed = true;
          this.submitButton.textContent = "بانتظار تأكيد استلام الطلب";
        }
        this.status.focus();
        return;
      }
      completed = true;
      this.status.dataset.state = "success";
      this.status.textContent = "تم استلام طلبك بنجاح. سيتواصل معك فريقنا لترتيب استشارتك المجانية.";
      this.submitButton.textContent = "تم إرسال طلبك";
      this.form.querySelectorAll("input, select").forEach((field) => { field.disabled = true; });
      this.status.focus();
      this.redirectToThankYou();
    } catch {
      this.status.dataset.state = "error";
      this.status.textContent = "تعذّر تأكيد الإرسال بسبب الاتصال. يمكنك المحاولة مجدداً بنفس البيانات دون تكرار الطلب.";
      this.status.focus();
    } finally {
      this.busy = false;
      if (!completed) {
        controls.forEach((field) => { field.disabled = false; });
        this.submitButton.disabled = false;
        this.submitButton.textContent = "احجز جلسة التشخيص المجانية";
      }
    }
  }
}

customElements.define("mastery-booking-form", MasteryBookingForm);
const bookingForm = document.createElement("mastery-booking-form");
function mountBookingForm() {
  // Hand-written landing page: mount into its slot.
  const slot = document.querySelector("[data-booking-slot]");
  if (slot) {
    if (bookingForm.parentElement !== slot) slot.append(bookingForm);
    return;
  }
  // Legacy Framer export: sit beside (and hide) the exported form.
  const original = document.querySelector('form[data-framer-name="Booking Form"]');
  if (!original) return;
  if (bookingForm.previousElementSibling !== original) original.after(bookingForm);
  original.hidden = true;
  original.setAttribute("aria-hidden", "true");
  original.style.setProperty("display", "none", "important");
}
// Framer can replace its SSR nodes during hydration. Keep our independent form instance
// (and any entered values) instead of editing DOM owned by React.
let scheduled = false;
new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; mountBookingForm(); });
}).observe(document.body, { childList: true, subtree: true });
mountBookingForm();
