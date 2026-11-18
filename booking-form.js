/* Isolated from the exported Framer form so hydration cannot replace user input. */
class MasteryBookingForm extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="/booking-form.css">
      <form class="consultation-form" dir="rtl" lang="ar" aria-label="احجز استشارتك المجانية">
        <p class="required-note">الحقول المعلّمة بـ <span aria-hidden="true">*</span> مطلوبة.</p>
        <label for="booking-company">اسم الشركة <span aria-hidden="true">*</span></label>
        <input id="booking-company" name="company" placeholder="اسم المنشأة" autocomplete="organization" maxlength="200" required>
        <p class="field-error" id="error-company"></p>
        <div class="name-row">
          <div>
            <label for="booking-firstName">الاسم الأول <span aria-hidden="true">*</span></label>
            <input id="booking-firstName" name="firstName" placeholder="الاسم الأول" autocomplete="given-name" maxlength="80" required>
            <p class="field-error" id="error-firstName"></p>
          </div>
          <div>
            <label for="booking-lastName">اسم العائلة <span aria-hidden="true">*</span></label>
            <input id="booking-lastName" name="lastName" placeholder="اسم العائلة" autocomplete="family-name" maxlength="100" required>
            <p class="field-error" id="error-lastName"></p>
          </div>
        </div>
        <label for="booking-phone">رقم الهاتف <span aria-hidden="true">*</span></label>
        <input id="booking-phone" name="phone" type="tel" dir="ltr" placeholder="+966501234567"
          autocomplete="tel" maxlength="30" pattern="\\+[1-9][0-9 ]{7,28}" required
          aria-describedby="phone-help error-phone">
        <p class="help" id="phone-help">يرجى إدخال رمز الدولة مع رقم الهاتف.</p>
        <p class="field-error" id="error-phone"></p>
        <label for="booking-email">البريد الإلكتروني للعمل <span aria-hidden="true">*</span></label>
        <input id="booking-email" name="email" type="email" dir="ltr" placeholder="name@company.com"
          autocomplete="email" maxlength="254" required>
        <p class="field-error" id="error-email"></p>
        <label for="booking-employees">عدد الموظفين <span aria-hidden="true">*</span></label>
        <select id="booking-employees" name="employees" required disabled>
          <option value="">جارٍ تحميل الخيارات…</option>
        </select>
        <p class="field-error" id="error-employees"></p>
        <label for="booking-salespeople">عدد موظفي المبيعات في الشركة <span aria-hidden="true">*</span></label>
        <input id="booking-salespeople" name="salespeople" type="number" min="0" max="9999999"
          step="1" inputmode="numeric" placeholder="عدد أفراد فريق المبيعات" required>
        <p class="field-error" id="error-salespeople"></p>
        <label for="booking-country">الدولة <span aria-hidden="true">*</span></label>
        <select id="booking-country" name="country" required disabled>
          <option value="">جارٍ تحميل الدول…</option>
        </select>
        <p class="field-error" id="error-country"></p>
        <label for="booking-website">الموقع الإلكتروني <small>اختياري</small></label>
        <input id="booking-website" name="website" type="text" dir="ltr" inputmode="url"
          autocomplete="url" placeholder="https://company.com" maxlength="2048">
        <p class="field-error" id="error-website"></p>
        <div class="honeypot" aria-hidden="true">
          <label>اترك هذا الحقل فارغاً<input name="fax" tabindex="-1" autocomplete="off"></label>
        </div>
        <p id="booking-options-status" class="status" role="status" aria-live="polite"></p>
        <button type="button" id="booking-retry" class="secondary" hidden>إعادة تحميل الخيارات</button>
        <button type="submit" id="booking-submit" disabled>احجز استشارتك المجانية</button>
        <p id="booking-status" class="status" role="status" aria-live="polite" tabindex="-1"></p>
        <p class="privacy">سنستخدم بياناتك للتواصل معك بخصوص استشارتك.</p>
      </form>`;
    this.form = root.querySelector("form");
    this.submitButton = root.getElementById("booking-submit");
    this.status = root.getElementById("booking-status");
    this.key = crypto.randomUUID();
    this.busy = false;
    this.ready = false;
    this.form.addEventListener("submit", (event) => this.submit(event));
    root.getElementById("booking-retry").addEventListener("click", () => this.loadOptions());
    this.form.addEventListener("input", (event) => {
      const field = event.target;
      field.removeAttribute("aria-invalid");
      root.getElementById(`error-${field.name}`)?.replaceChildren();
    });
    this.form.elements.employees.addEventListener("change", () => {
      const selected = this.employees.find((item) => item.value === this.form.elements.employees.value);
      this.form.elements.salespeople.max = selected?.maximum || 9999999;
    });
    for (const field of this.form.elements) {
      if (root.getElementById(`error-${field.name}`) && field.name !== "phone") {
        field.setAttribute("aria-describedby", `error-${field.name}`);
      }
    }
    this.loadOptions();
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
      populate("country", "اختر الدولة", data.countries.map((item) => ({
        value: item.code, label: `${item.flag ? item.flag + " " : ""}${item.name}`,
      })));
      status.textContent = "";
      this.ready = true;
      this.submitButton.disabled = false;
    } catch {
      status.textContent = "تعذّر تحميل الدول وخيارات الموظفين. يرجى إعادة المحاولة.";
      status.dataset.state = "error";
      retry.hidden = false;
    }
  }

  async submit(event) {
    event.preventDefault();
    event.stopPropagation();
    if (this.busy || !this.ready || !this.form.reportValidity()) return;
    if (this.form.elements.fax.value) return;
    const payload = Object.fromEntries(new FormData(this.form));
    delete payload.fax;
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
          this.form.elements[name]?.setAttribute("aria-invalid", "true");
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
    } catch {
      this.status.dataset.state = "error";
      this.status.textContent = "تعذّر تأكيد الإرسال بسبب الاتصال. يمكنك المحاولة مجدداً بنفس البيانات دون تكرار الطلب.";
      this.status.focus();
    } finally {
      this.busy = false;
      if (!completed) {
        controls.forEach((field) => { field.disabled = false; });
        this.submitButton.disabled = false;
        this.submitButton.textContent = "احجز استشارتك المجانية";
      }
    }
  }
}

customElements.define("mastery-booking-form", MasteryBookingForm);
const bookingForm = document.createElement("mastery-booking-form");
function mountBookingForm() {
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
